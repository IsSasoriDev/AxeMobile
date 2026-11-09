//! AxePool: a solo stratum pool backed by your own Bitcoin node.
//!
//! Miners connect over stratum v1. Each one mines a coinbase that pays the
//! whole block reward to its own address (taken from the worker name, like
//! `bc1q….rig1`) or to the pool's payout address. Nothing is pooled or
//! split; the pool is just the bridge between the miners and the node.

pub mod addr;
pub mod rpc;
pub mod work;

use std::collections::{HashMap, HashSet, VecDeque};
use std::net::SocketAddr;
use std::sync::atomic::{AtomicU32, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::Duration;

use serde::Serialize;
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::tcp::OwnedWriteHalf;
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::watch;
use tokio::task::JoinSet;

use crate::{db, fmt_diff, Engine};
use addr::Net;
use rpc::{NodeConfig, Rpc};
use work::{Template, H256};

pub const DEFAULT_PORT: u16 = 3334;
/// Written into the coinbase of every block AxePool finds. Not a setting.
pub const COINBASE_TAG: &str = "/AxeMobile AxePool/";
const START_DIFF: f64 = 1024.0;
const MIN_DIFF: f64 = 0.0001;
const VARDIFF_FLOOR: f64 = 1.0;
/// aim for one share every this many seconds per miner
const SHARE_SECS: f64 = 10.0;
const VERSION_MASK: u32 = 0x1fff_e000;
const EN1_LEN: usize = 4;
const EN2_LEN: usize = 8;
const HASHRATE_WINDOW: f64 = 600.0;

#[derive(Debug, Clone, Default, PartialEq)]
pub struct PoolConfig {
    pub enabled: bool,
    pub port: u16,
    /// pays the block when the worker name is not an address
    pub address: String,
    pub node: NodeConfig,
}

pub struct Job {
    pub id: String,
    pub tpl: Arc<Template>,
    pub steps: Arc<Vec<H256>>,
    pub clean: bool,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Worker {
    pub id: u64,
    pub name: String,
    pub address: String,
    pub ip: String,
    pub agent: String,
    pub since: i64,
    pub diff: f64,
    pub accepted: u64,
    pub rejected: u64,
    pub best: f64,
    pub last_share: i64,
    /// GH/s, from accepted shares over the last ten minutes
    pub hashrate: f64,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct NodeStatus {
    pub ok: bool,
    pub chain: String,
    pub blocks: u64,
    pub headers: u64,
    pub syncing: bool,
    pub progress: f64,
    pub version: String,
    pub error: String,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Status {
    pub enabled: bool,
    pub running: bool,
    pub port: u16,
    pub error: String,
    pub started: i64,
    pub node: NodeStatus,
    pub height: u64,
    pub net_diff: f64,
    /// sats, subsidy + fees of the current template
    pub reward: u64,
    pub fees: u64,
    pub txs: usize,
    pub template_at: i64,
    /// GH/s
    pub hashrate: f64,
    pub workers: Vec<Worker>,
    pub accepted: u64,
    pub rejected: u64,
    pub best: f64,
    pub blocks_found: usize,
    pub address_ok: bool,
    pub address_error: String,
}

pub struct Pool {
    status: RwLock<Status>,
    workers: RwLock<HashMap<u64, Worker>>,
    jobs: RwLock<VecDeque<Arc<Job>>>,
    job_tx: watch::Sender<Option<Arc<Job>>>,
    net: RwLock<Option<Net>>,
    rpc: RwLock<Option<Arc<Rpc>>>,
    next_session: AtomicU64,
    next_en1: AtomicU32,
    next_job: AtomicU64,
}

impl Default for Pool {
    fn default() -> Self {
        Pool {
            status: RwLock::default(),
            workers: RwLock::default(),
            jobs: RwLock::default(),
            job_tx: watch::channel(None).0,
            net: RwLock::new(None),
            rpc: RwLock::new(None),
            next_session: AtomicU64::new(1),
            next_en1: AtomicU32::new(rand_seed()),
            next_job: AtomicU64::new(1),
        }
    }
}

fn rand_seed() -> u32 {
    let t = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.subsec_nanos()).unwrap_or(7);
    t.wrapping_mul(2_654_435_761)
}

impl Pool {
    pub fn status(&self) -> Status {
        let mut s = self.status.read().unwrap().clone();
        let mut w: Vec<Worker> = self.workers.read().unwrap().values().cloned().collect();
        let now = db::now();
        for x in &mut w {
            if now - x.last_share > 900 {
                x.hashrate = 0.0;
            }
        }
        w.sort_by(|a, b| b.hashrate.total_cmp(&a.hashrate).then(a.id.cmp(&b.id)));
        // + 0.0: an empty f64 sum is -0.0, which prints as "-0.0"
        s.hashrate = w.iter().map(|x| x.hashrate).sum::<f64>() + 0.0;
        s.workers = w;
        s
    }

    fn net(&self) -> Net {
        self.net.read().unwrap().unwrap_or(Net::Main)
    }

    fn reset(&self, cfg: &PoolConfig, best: f64, blocks: usize) {
        self.workers.write().unwrap().clear();
        self.jobs.write().unwrap().clear();
        self.job_tx.send_replace(None);
        *self.rpc.write().unwrap() = None;
        let mut st = self.status.write().unwrap();
        *st = Status { enabled: cfg.enabled, port: cfg.port, best, blocks_found: blocks, ..Default::default() };
        if cfg.enabled {
            st.started = db::now();
        }
    }

    fn publish(&self, tpl: Template, clean: bool) {
        let id = format!("{:x}", self.next_job.fetch_add(1, Ordering::Relaxed));
        let steps = Arc::new(work::merkle_steps(&tpl.txids));
        {
            let mut st = self.status.write().unwrap();
            st.height = tpl.height;
            st.net_diff = tpl.network_diff();
            st.reward = tpl.coinbase_value;
            st.fees = tpl.fees;
            st.txs = tpl.txids.len();
            st.template_at = db::now();
        }
        let job = Arc::new(Job { id, tpl: Arc::new(tpl), steps, clean });
        {
            let mut jobs = self.jobs.write().unwrap();
            if clean {
                jobs.clear();
            }
            jobs.push_back(job.clone());
            while jobs.len() > 24 {
                jobs.pop_front();
            }
        }
        self.job_tx.send_replace(Some(job));
    }

    fn job(&self, id: &str) -> Option<Arc<Job>> {
        self.jobs.read().unwrap().iter().rev().find(|j| j.id == id).cloned()
    }
}

/// Reads the pool settings; `fixed` values (set by Umbrel) win.
pub fn config_from(get: impl Fn(&str) -> String) -> PoolConfig {
    PoolConfig {
        enabled: get("pool_enabled") == "1",
        port: get("pool_port").parse().ok().filter(|p| *p > 0).unwrap_or(DEFAULT_PORT),
        address: get("pool_address").trim().to_string(),
        node: NodeConfig { url: get("node_url"), user: get("node_user"), pass: get("node_pass"), cookie: get("node_cookie") },
    }
}

/// Keeps the pool in line with the settings: starts, stops and restarts it.
pub async fn supervise(e: Arc<Engine>) {
    let mut running: Option<(PoolConfig, tokio::task::JoinHandle<()>)> = None;
    loop {
        let cfg = e.pool_config();
        if running.as_ref().map(|(c, _)| c != &cfg).unwrap_or(true) {
            if let Some((_, h)) = running.take() {
                h.abort();
                let _ = h.await;
            }
            let best = e.db.pool_bests().ok().and_then(|v| v.first().map(|b| b.1)).unwrap_or(0.0);
            let blocks = e.db.pool_blocks(1000).map(|b| b.iter().filter(|b| b.result == "accepted").count()).unwrap_or(0);
            e.pool.reset(&cfg, best, blocks);
            let h = if cfg.enabled { tokio::spawn(serve(e.clone(), cfg.clone())) } else { tokio::spawn(async {}) };
            running = Some((cfg, h));
        }
        tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(3)) => {}
            _ = e.pool_wake.notified() => {}
        }
    }
}

async fn serve(e: Arc<Engine>, cfg: PoolConfig) {
    let rpc = Arc::new(Rpc::new(cfg.node.clone()));
    *e.pool.rpc.write().unwrap() = Some(rpc.clone());
    let mut set = JoinSet::new();
    set.spawn(templates(e.clone(), rpc));
    set.spawn(listen(e.clone(), cfg));
    set.spawn(sampler(e));
    while set.join_next().await.is_some() {}
}

async fn sampler(e: Arc<Engine>) {
    loop {
        tokio::time::sleep(Duration::from_secs(60)).await;
        let s = e.pool.status();
        if !s.workers.is_empty() {
            let _ = e.db.add_pool_sample(s.hashrate, s.workers.len() as i64);
        }
    }
}

fn set_node_err(e: &Engine, msg: String) {
    let mut st = e.pool.status.write().unwrap();
    st.node.ok = false;
    st.node.error = msg;
}

/// Watches the node for new blocks and turns templates into jobs.
async fn templates(e: Arc<Engine>, rpc: Arc<Rpc>) {
    let mut last_best = String::new();
    let mut last_full = 0i64;
    let mut last_info = 0i64;
    loop {
        let now = db::now();
        if now - last_info >= 30 {
            match rpc.call("getblockchaininfo", json!([])).await {
                Ok(v) => {
                    last_info = now;
                    let chain = v.get("chain").and_then(|x| x.as_str()).unwrap_or("main").to_string();
                    *e.pool.net.write().unwrap() = Some(Net::from_chain(&chain));
                    let version = match rpc.call("getnetworkinfo", json!([])).await {
                        Ok(n) => n.get("subversion").and_then(|x| x.as_str()).unwrap_or("").trim_matches('/').to_string(),
                        Err(_) => String::new(),
                    };
                    let mut st = e.pool.status.write().unwrap();
                    st.node.chain = chain;
                    st.node.blocks = v.get("blocks").and_then(|x| x.as_u64()).unwrap_or(0);
                    st.node.headers = v.get("headers").and_then(|x| x.as_u64()).unwrap_or(0);
                    st.node.syncing = v.get("initialblockdownload").and_then(|x| x.as_bool()).unwrap_or(false);
                    st.node.progress = v.get("verificationprogress").and_then(|x| x.as_f64()).unwrap_or(0.0);
                    st.node.version = version;
                    drop(st);
                    check_address(&e);
                }
                Err(err) => {
                    set_node_err(&e, err);
                    tokio::time::sleep(Duration::from_secs(5)).await;
                    continue;
                }
            }
        }
        match rpc.best_hash().await {
            Ok(h) => {
                let new_block = h != last_best;
                if new_block || now - last_full >= 30 {
                    match rpc.template().await.and_then(|v| Template::from_gbt(&v)) {
                        Ok(t) => {
                            if new_block {
                                tracing::info!("axepool: new block, height {}", t.height);
                            }
                            e.pool.publish(t, new_block);
                            last_best = h;
                            last_full = now;
                            let mut st = e.pool.status.write().unwrap();
                            st.node.ok = true;
                            st.node.error.clear();
                        }
                        Err(err) => {
                            let msg = if err.contains("initial sync") || err.contains("downloading blocks") {
                                "the node is still syncing".to_string()
                            } else {
                                format!("no block template: {err}")
                            };
                            set_node_err(&e, msg);
                            last_info = 0;
                            tokio::time::sleep(Duration::from_secs(5)).await;
                        }
                    }
                } else {
                    let mut st = e.pool.status.write().unwrap();
                    st.node.ok = true;
                    st.node.error.clear();
                }
            }
            Err(err) => {
                set_node_err(&e, err);
                last_info = 0;
                tokio::time::sleep(Duration::from_secs(4)).await;
            }
        }
        tokio::time::sleep(Duration::from_secs(1)).await;
    }
}

fn check_address(e: &Engine) {
    let cfg = e.pool_config();
    let (ok, err) = if cfg.address.is_empty() {
        (false, String::new())
    } else {
        match addr::script_for(&cfg.address, e.pool.net()) {
            Ok(_) => (true, String::new()),
            Err(x) => (false, x),
        }
    };
    let mut st = e.pool.status.write().unwrap();
    st.address_ok = ok;
    st.address_error = err;
}

async fn listen(e: Arc<Engine>, cfg: PoolConfig) {
    let addr = SocketAddr::from(([0, 0, 0, 0], cfg.port));
    let listener = match TcpListener::bind(addr).await {
        Ok(l) => l,
        Err(err) => {
            let msg = if err.kind() == std::io::ErrorKind::AddrInUse {
                format!("port {} is already in use by another program", cfg.port)
            } else {
                format!("can't listen on port {}: {err}", cfg.port)
            };
            tracing::warn!("axepool: {msg}");
            e.pool.status.write().unwrap().error = msg;
            return;
        }
    };
    {
        let mut st = e.pool.status.write().unwrap();
        st.running = true;
        st.error.clear();
    }
    check_address(&e);
    tracing::info!("axepool: stratum on {addr}");
    let mut sessions = JoinSet::new();
    loop {
        tokio::select! {
            r = listener.accept() => match r {
                Ok((sock, peer)) => {
                    let _ = sock.set_nodelay(true);
                    sessions.spawn(session(e.clone(), cfg.clone(), sock, peer));
                }
                Err(err) => {
                    tracing::debug!("axepool accept: {err}");
                    tokio::time::sleep(Duration::from_millis(200)).await;
                }
            },
            Some(_) = sessions.join_next(), if !sessions.is_empty() => {}
        }
    }
}

struct Session {
    id: u64,
    en1: [u8; EN1_LEN],
    subscribed: bool,
    authorized: bool,
    payout: Option<Vec<u8>>,
    worker: String,
    diff: f64,
    prev_diff: f64,
    diff_sent: bool,
    fixed_diff: bool,
    mask: u32,
    coinbases: HashMap<String, (Vec<u8>, Vec<u8>)>,
    seen: HashSet<(String, String, u32, u32, u32)>,
    shares: VecDeque<(i64, f64)>,
    retarget_at: i64,
    since_retarget: u32,
    current: Option<Arc<Job>>,
}

async fn send(w: &mut OwnedWriteHalf, v: &Value) -> std::io::Result<()> {
    let mut s = v.to_string();
    s.push('\n');
    w.write_all(s.as_bytes()).await
}

fn ok(id: &Value, result: Value) -> Value {
    json!({"id": id, "result": result, "error": null})
}

fn err(id: &Value, code: i32, msg: &str) -> Value {
    json!({"id": id, "result": null, "error": [code, msg, null]})
}

async fn session(e: Arc<Engine>, cfg: PoolConfig, sock: TcpStream, peer: SocketAddr) {
    let (r, mut w) = sock.into_split();
    let mut lines = BufReader::new(r).lines();
    let mut jobs = e.pool.job_tx.subscribe();
    jobs.borrow_and_update();
    let mut s = Session {
        id: e.pool.next_session.fetch_add(1, Ordering::Relaxed),
        en1: e.pool.next_en1.fetch_add(1, Ordering::Relaxed).to_be_bytes(),
        subscribed: false,
        authorized: false,
        payout: None,
        worker: String::new(),
        diff: START_DIFF,
        prev_diff: START_DIFF,
        diff_sent: false,
        fixed_diff: false,
        mask: 0,
        coinbases: HashMap::new(),
        seen: HashSet::new(),
        shares: VecDeque::new(),
        retarget_at: db::now(),
        since_retarget: 0,
        current: None,
    };
    let ip = peer.ip().to_string();
    let mut tick = tokio::time::interval(Duration::from_secs(30));
    tick.tick().await;
    loop {
        tokio::select! {
            line = tokio::time::timeout(Duration::from_secs(900), lines.next_line()) => {
                let line = match line {
                    Ok(Ok(Some(l))) => l,
                    _ => break,
                };
                if line.len() > 16_384 {
                    break;
                }
                let Ok(msg) = serde_json::from_str::<Value>(line.trim()) else { continue };
                if handle(&e, &cfg, &mut s, &mut w, &ip, msg).await.is_err() {
                    break;
                }
            }
            r = jobs.changed() => {
                if r.is_err() {
                    break;
                }
                let job = jobs.borrow_and_update().clone();
                if let Some(job) = job {
                    if s.authorized && send_job(&mut s, &mut w, job).await.is_err() {
                        break;
                    }
                }
            }
            _ = tick.tick() => {
                // nobody submitting: ease the difficulty off
                if s.authorized && !s.fixed_diff && db::now() - s.retarget_at >= 90 && s.since_retarget == 0 {
                    let d = (s.diff / 4.0).max(VARDIFF_FLOOR);
                    if d < s.diff && retarget(&e, &mut s, &mut w, d).await.is_err() {
                        break;
                    }
                    s.retarget_at = db::now();
                }
            }
        }
    }
    e.pool.workers.write().unwrap().remove(&s.id);
    tracing::debug!("axepool: {} ({ip}) left", s.worker);
}

async fn retarget(e: &Engine, s: &mut Session, w: &mut OwnedWriteHalf, d: f64) -> std::io::Result<()> {
    s.prev_diff = s.diff;
    s.diff = d;
    s.diff_sent = false;
    if let Some(wk) = e.pool.workers.write().unwrap().get_mut(&s.id) {
        wk.diff = d;
    }
    if let Some(job) = s.current.clone() {
        // resend the current work so the new difficulty applies right away
        send_job(s, w, job).await?;
    }
    Ok(())
}

async fn send_job(s: &mut Session, w: &mut OwnedWriteHalf, job: Arc<Job>) -> std::io::Result<()> {
    let Some(payout) = s.payout.clone() else { return Ok(()) };
    if !s.diff_sent {
        send(w, &json!({"id": null, "method": "mining.set_difficulty", "params": [s.diff]})).await?;
        s.diff_sent = true;
    }
    if job.clean {
        s.coinbases.clear();
        s.seen.clear();
    }
    let (c1, c2) = s
        .coinbases
        .entry(job.id.clone())
        .or_insert_with(|| work::coinbase_parts(&job.tpl, &payout, COINBASE_TAG, EN1_LEN + EN2_LEN))
        .clone();
    let clean = job.clean && s.current.as_ref().map(|c| c.id != job.id).unwrap_or(true);
    let params = work::notify_params(&job.id, &job.tpl, &job.steps, &c1, &c2, clean);
    s.current = Some(job);
    send(w, &json!({"id": null, "method": "mining.notify", "params": params})).await
}

fn parse_hex_u32(v: Option<&Value>) -> Option<u32> {
    let s = v?.as_str()?;
    if s.len() != 8 {
        return None;
    }
    u32::from_str_radix(s, 16).ok()
}

async fn handle(e: &Arc<Engine>, cfg: &PoolConfig, s: &mut Session, w: &mut OwnedWriteHalf, ip: &str, msg: Value) -> std::io::Result<()> {
    let id = msg.get("id").cloned().unwrap_or(Value::Null);
    let method = msg.get("method").and_then(|m| m.as_str()).unwrap_or("");
    let params = msg.get("params").and_then(|p| p.as_array()).cloned().unwrap_or_default();
    match method {
        "mining.configure" => {
            let mut res = serde_json::Map::new();
            let exts: Vec<String> = params
                .first()
                .and_then(|x| x.as_array())
                .map(|a| a.iter().filter_map(|x| x.as_str().map(String::from)).collect())
                .unwrap_or_default();
            if exts.iter().any(|x| x == "version-rolling") {
                let theirs = params
                    .get(1)
                    .and_then(|o| o.get("version-rolling.mask"))
                    .and_then(|m| m.as_str())
                    .and_then(|m| u32::from_str_radix(m, 16).ok())
                    .unwrap_or(0xffff_ffff);
                s.mask = VERSION_MASK & theirs;
                res.insert("version-rolling".into(), json!(true));
                res.insert("version-rolling.mask".into(), json!(format!("{:08x}", s.mask)));
            }
            send(w, &ok(&id, Value::Object(res))).await
        }
        "mining.subscribe" => {
            s.subscribed = true;
            let agent = params.first().and_then(|x| x.as_str()).unwrap_or("").to_string();
            let sid = format!("{:x}", s.id);
            send(
                w,
                &ok(&id, json!([[["mining.set_difficulty", sid], ["mining.notify", sid]], hex::encode(s.en1), EN2_LEN])),
            )
            .await?;
            if !agent.is_empty() {
                if let Some(wk) = e.pool.workers.write().unwrap().get_mut(&s.id) {
                    wk.agent = agent.clone();
                }
            }
            s.worker = agent; // replaced on authorize
            Ok(())
        }
        "mining.extranonce.subscribe" => send(w, &ok(&id, json!(true))).await,
        "mining.suggest_difficulty" => {
            if let Some(d) = params.first().and_then(|x| x.as_f64()).filter(|d| d.is_finite() && *d > 0.0) {
                let d = d.max(MIN_DIFF);
                if s.authorized {
                    send(w, &ok(&id, json!(true))).await?;
                    return retarget(e, s, w, d).await;
                }
                s.diff = d;
                s.prev_diff = d;
            }
            send(w, &ok(&id, json!(true))).await
        }
        "mining.authorize" => {
            let user = params.first().and_then(|x| x.as_str()).unwrap_or("").trim().to_string();
            let pass = params.get(1).and_then(|x| x.as_str()).unwrap_or("");
            let (first, rest) = user.split_once('.').map(|(a, b)| (a.to_string(), b.to_string())).unwrap_or((user.clone(), String::new()));
            let net = e.pool.net();
            let (payout, address, name) = match addr::script_for(&first, net) {
                Ok(sc) => (sc, first.clone(), if rest.is_empty() { short_addr(&first) } else { rest }),
                Err(_) => match addr::script_for(&cfg.address, net) {
                    Ok(sc) => (sc, cfg.address.clone(), if user.is_empty() { ip.to_string() } else { user.clone() }),
                    Err(_) => {
                        let why = if cfg.address.is_empty() {
                            "use your Bitcoin address as the username, or set a payout address in AxeMobile"
                        } else {
                            "the pool's payout address is not valid for this node's network"
                        };
                        tracing::info!("axepool: {user} ({ip}) refused: {why}");
                        return send(w, &err(&id, 24, why)).await;
                    }
                },
            };
            // "d=4096" in the password pins the difficulty
            if let Some(d) = pass.split(',').find_map(|p| p.trim().strip_prefix("d=")).and_then(|d| d.parse::<f64>().ok()) {
                if d.is_finite() && d > 0.0 {
                    s.diff = d.max(MIN_DIFF);
                    s.prev_diff = s.diff;
                    s.fixed_diff = true;
                }
            }
            s.payout = Some(payout);
            s.authorized = true;
            let agent = std::mem::take(&mut s.worker);
            s.worker = name.clone();
            e.pool.workers.write().unwrap().insert(
                s.id,
                Worker {
                    id: s.id,
                    name,
                    address,
                    ip: ip.to_string(),
                    agent,
                    since: db::now(),
                    diff: s.diff,
                    ..Default::default()
                },
            );
            tracing::info!("axepool: {} ({ip}) connected", s.worker);
            send(w, &ok(&id, json!(true))).await?;
            let job = e.pool.job_tx.borrow().clone();
            if let Some(job) = job {
                send_job(s, w, job).await?;
            }
            Ok(())
        }
        "mining.submit" => {
            let r = submit(e, s, &params);
            let res = match &r {
                Ok(()) => ok(&id, json!(true)),
                Err((code, m)) => err(&id, *code, m),
            };
            send(w, &res).await?;
            if !s.fixed_diff {
                vardiff(e, s, w).await?;
            }
            Ok(())
        }
        "mining.ping" => send(w, &ok(&id, json!("pong"))).await,
        "" => Ok(()), // replies to our own messages
        _ => send(w, &err(&id, 20, "unsupported method")).await,
    }
}

fn short_addr(a: &str) -> String {
    if a.len() > 14 {
        format!("{}…{}", &a[..8], &a[a.len() - 4..])
    } else {
        a.to_string()
    }
}

async fn vardiff(e: &Engine, s: &mut Session, w: &mut OwnedWriteHalf) -> std::io::Result<()> {
    let now = db::now();
    let elapsed = (now - s.retarget_at) as f64;
    if s.since_retarget < 20 && elapsed < 120.0 {
        return Ok(());
    }
    if elapsed < 20.0 {
        return Ok(());
    }
    let rate = s.since_retarget as f64 / elapsed; // shares per second
    let want = 1.0 / SHARE_SECS;
    let factor = (rate / want).clamp(0.25, 4.0);
    s.retarget_at = now;
    s.since_retarget = 0;
    if !(0.7..=1.4).contains(&factor) {
        // never push a miner that asked for less than the floor up to it
        let mut d = (s.diff * factor).max(VARDIFF_FLOOR.min(s.diff));
        if d >= 16.0 {
            // round to two significant figures so the numbers stay readable
            let mag = 10f64.powi(d.log10().floor() as i32 - 1);
            d = (d / mag).round() * mag;
        }
        retarget(e, s, w, d).await?;
    }
    Ok(())
}

fn submit(e: &Arc<Engine>, s: &mut Session, p: &[Value]) -> Result<(), (i32, String)> {
    let reject = |e: &Engine, s: &Session, code: i32, m: &str| {
        if let Some(wk) = e.pool.workers.write().unwrap().get_mut(&s.id) {
            wk.rejected += 1;
        }
        e.pool.status.write().unwrap().rejected += 1;
        Err((code, m.to_string()))
    };
    if !s.authorized {
        return Err((24, "not authorized".into()));
    }
    let job_id = p.get(1).and_then(|x| x.as_str()).unwrap_or("");
    let Some(job) = e.pool.job(job_id) else { return reject(e, s, 21, "stale job") };
    let Some((c1, c2)) = s.coinbases.get(job_id).cloned() else { return reject(e, s, 21, "stale job") };
    let en2 = match p.get(2).and_then(|x| x.as_str()).and_then(|x| hex::decode(x).ok()) {
        Some(b) if b.len() == EN2_LEN => b,
        _ => return reject(e, s, 20, "bad extranonce2"),
    };
    let (Some(ntime), Some(nonce)) = (parse_hex_u32(p.get(3)), parse_hex_u32(p.get(4))) else {
        return reject(e, s, 20, "bad ntime or nonce");
    };
    let vbits = match p.get(5) {
        Some(v) => match parse_hex_u32(Some(v)) {
            Some(b) => b,
            None => return reject(e, s, 20, "bad version bits"),
        },
        None => 0,
    };
    if vbits & !s.mask != 0 {
        return reject(e, s, 20, "version bits outside the mask");
    }
    let t = &job.tpl;
    let now = db::now() as u32;
    if ntime < t.mintime.min(t.curtime) || ntime > now.max(t.curtime) + 7200 {
        return reject(e, s, 20, "ntime out of range");
    }
    let key = (job_id.to_string(), hex::encode(&en2), ntime, nonce, vbits);
    if !s.seen.insert(key) {
        return reject(e, s, 22, "duplicate share");
    }
    let version = (t.version & !s.mask) | (vbits & s.mask);
    let coinbase = [c1.as_slice(), &s.en1, &en2, c2.as_slice()].concat();
    let c = work::check(t, &job.steps, coinbase, version, ntime, nonce);

    if c.is_block {
        found_block(e, s, &job, &c);
    }
    let need = s.diff.min(s.prev_diff);
    if c.diff < need * 0.999 && !c.is_block {
        return reject(e, s, 23, "low difficulty share");
    }

    let ts = db::now();
    s.since_retarget += 1;
    s.shares.push_back((ts, s.diff.min(c.diff)));
    while s.shares.front().is_some_and(|(t0, _)| (ts - t0) as f64 > HASHRATE_WINDOW) {
        s.shares.pop_front();
    }
    let mut new_best = false;
    {
        let mut workers = e.pool.workers.write().unwrap();
        if let Some(wk) = workers.get_mut(&s.id) {
            wk.accepted += 1;
            wk.last_share = ts;
            wk.diff = s.diff;
            if c.diff > wk.best {
                wk.best = c.diff;
            }
            let span = ((ts - wk.since) as f64).clamp(30.0, HASHRATE_WINDOW);
            let work: f64 = s.shares.iter().map(|(_, d)| d).sum();
            wk.hashrate = work * 4_294_967_296.0 / span / 1e9;
        }
    }
    {
        let mut st = e.pool.status.write().unwrap();
        st.accepted += 1;
        if c.diff > st.best {
            st.best = c.diff;
            new_best = true;
        }
    }
    if c.diff >= 1000.0 {
        if let Ok(true) = e.db.pool_best_share(&s.worker, c.diff) {
            if new_best && c.diff >= 1e6 {
                let _ = e.db.add_event(None, "best", &format!("AxePool: {} set a new best share, {}", s.worker, fmt_diff(c.diff)));
            }
        }
    }
    Ok(())
}

fn found_block(e: &Arc<Engine>, s: &Session, job: &Job, c: &work::Checked) {
    let hex_block = work::block_hex(&job.tpl, c);
    let hash = work::display(&c.hash);
    let height = job.tpl.height;
    let reward = job.tpl.coinbase_value;
    let worker = s.worker.clone();
    let rpc = e.pool.rpc.read().unwrap().clone();
    let e = e.clone();
    tracing::warn!("axepool: {worker} found block {height} ({hash}), submitting");
    tokio::spawn(async move {
        let result = match rpc {
            Some(r) => match r.submit(&hex_block).await {
                Ok(None) => "accepted".to_string(),
                Ok(Some(why)) => why,
                Err(x) => x,
            },
            None => "no node connection".into(),
        };
        let _ = e.db.add_pool_block(&db::PoolBlock {
            ts: db::now(),
            height: height as i64,
            hash: hash.clone(),
            worker: worker.clone(),
            reward: reward as i64,
            result: result.clone(),
        });
        if result == "accepted" {
            e.pool.status.write().unwrap().blocks_found += 1;
            let _ = e.db.add_event(None, "block", &format!("AxePool: {worker} found block {height}!"));
        } else {
            let _ = e.db.add_event(None, "fault", &format!("AxePool: block {height} from {worker} was refused by the node ({result})"));
        }
        tracing::warn!("axepool: block {height}: {result}");
        e.pool_wake.notify_one();
    });
}

/// Chance of finding at least one block in `secs` at `ghs` against `diff`.
pub fn odds(ghs: f64, diff: f64, secs: f64) -> f64 {
    if ghs <= 0.0 || diff <= 0.0 {
        return 0.0;
    }
    let per_sec = ghs * 1e9 / (diff * 4_294_967_296.0);
    1.0 - (-per_sec * secs).exp()
}

/// The LAN address miners should point at.
pub fn local_ip() -> String {
    std::net::UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("1.1.1.1:80")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

/// Host miners on this network should use for the pool.
pub fn stratum_host() -> String {
    std::env::var("AXEMOBILE_POOL_HOST").ok().filter(|h| !h.is_empty()).unwrap_or_else(local_ip)
}

/// Makes AxePool a miner's first pool. Its current first pool becomes the
/// fallback so it keeps mining if AxeMobile is closed.
///
/// `host` is the address the miner should dial; None uses `stratum_host()`.
/// It has to be an IP: Bitaxes can't resolve names like `umbrel.local`.
pub async fn point_miner(e: &Engine, m: &db::MinerRow, host: Option<String>) -> anyhow::Result<String> {
    let cfg = e.pool_config();
    if addr::script_for(&cfg.address, e.pool.net()).is_err() {
        anyhow::bail!("set a valid payout address for AxePool first");
    }
    let host = host.filter(|h| !h.trim().is_empty()).unwrap_or_else(stratum_host);
    if host.parse::<std::net::IpAddr>().is_err() {
        anyhow::bail!("open AxeMobile by its IP address (like http://192.168.1.20:3847) so the miner can be pointed at it; miners can't look up {host}");
    }
    let name: String = (if m.name.is_empty() { m.ip.replace('.', "-") } else { m.name.clone() })
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(24)
        .collect();
    let mut pc = e.client.pools(&m.ip, &m.kind, &m.session).await?;
    let slots = pc.pools.len().max(1);
    let mine = crate::miner::PoolEntry {
        enabled: true,
        url: host.clone(),
        port: cfg.port as u32,
        user: format!("{}.{}", cfg.address, if name.is_empty() { "miner".into() } else { name }),
        pass: "x".into(),
        weight: None,
        connected: None,
    };
    pc.pools.retain(|p| !(p.url.trim_start_matches("stratum+tcp://") == host && p.port == cfg.port as u32));
    pc.pools.insert(0, mine);
    pc.pools.truncate(slots);
    for p in pc.pools.iter_mut().skip(1) {
        // passwords are stored per slot and never read back, so a pool that
        // moved down a slot gets the usual "x"
        p.pass = "x".into();
    }
    if pc.mode == "split" {
        pc.mode = "failover".into();
    }
    let msg = e.client.set_pools(&m.ip, &m.kind, &m.session, &pc).await?;
    let label = if m.name.is_empty() { &m.ip } else { &m.name };
    let _ = e.db.add_event(Some(m.id), "config", &format!("{label} now mines on AxePool"));
    Ok(msg)
}
