//! The `/api` router. Same routes on the desktop and on Umbrel.

use std::collections::HashMap;
use std::sync::Arc;

use axum::extract::{Path, Query, Request, State};
use axum::http::{header, HeaderValue, Method, StatusCode};
use axum::middleware::{self, Next};
use axum::response::{IntoResponse, Response};
use axum::routing::{get, post};
use axum::{Json, Router};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tower_http::cors::{AllowOrigin, CorsLayer};
use tower_http::services::{ServeDir, ServeFile};

use crate::db::{self, Event, MinerRow};
use crate::miner::{PoolConfig, Snapshot, Tuning};
use crate::{guess_subnet, Config, Engine, Fleet};

type Shared = Arc<Engine>;

pub struct ApiError(StatusCode, String);

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        (self.0, Json(json!({ "error": self.1 }))).into_response()
    }
}

impl From<anyhow::Error> for ApiError {
    fn from(e: anyhow::Error) -> Self {
        let msg = e.to_string();
        let code = if msg == "login required" { StatusCode::UNAUTHORIZED } else { StatusCode::BAD_GATEWAY };
        ApiError(code, msg)
    }
}

type R<T> = Result<Json<T>, ApiError>;

fn bad(msg: &str) -> ApiError {
    ApiError(StatusCode::BAD_REQUEST, msg.into())
}

fn not_found() -> ApiError {
    ApiError(StatusCode::NOT_FOUND, "no such miner".into())
}

#[derive(Serialize)]
pub struct MinerView {
    #[serde(flatten)]
    pub row: MinerRow,
    pub online: bool,
    pub last_seen: i64,
    pub error: String,
    pub needs_login: bool,
    pub snap: Option<Snapshot>,
}

fn view(e: &Engine, row: MinerRow) -> MinerView {
    let l = e.live_of(row.id);
    MinerView {
        online: l.online,
        last_seen: l.last_seen,
        needs_login: l.error == "login required",
        error: l.error,
        snap: l.snap,
        row,
    }
}

fn miner(e: &Engine, id: i64) -> Result<MinerRow, ApiError> {
    e.db.miner(id).map_err(ApiError::from)?.ok_or_else(not_found)
}

pub fn router(engine: Shared, cfg: &Config) -> Router {
    let api = Router::new()
        .route("/health", get(|| async { Json(json!({"ok": true, "version": env!("CARGO_PKG_VERSION")})) }))
        .route("/overview", get(overview))
        .route("/miners", get(list).post(add))
        .route("/miners/{id}", get(one).patch(rename).delete(remove))
        .route("/miners/{id}/history", get(miner_history))
        .route("/miners/{id}/pools", get(get_pools).put(put_pools))
        .route("/miners/{id}/tuning", get(get_tuning).put(put_tuning))
        .route("/miners/{id}/restart", post(restart))
        .route("/miners/{id}/retune", post(retune))
        .route("/miners/{id}/login", post(login))
        .route("/miners/{id}/swarm", get(swarm))
        .route("/pools/apply", post(apply_pools))
        .route("/history", get(fleet_history))
        .route("/market", get(market))
        .route("/leaderboard", get(leaderboard))
        .route("/events", get(events))
        .route("/scan", get(scan_info).post(scan))
        .route("/settings", get(get_settings).put(put_settings))
        .route("/pool", get(pool_status))
        .route("/pool/history", get(pool_history))
        .route("/pool/point/{id}", post(pool_point))
        .route("/export", get(export))
        .route("/import", post(import))
        .layer(middleware::from_fn_with_state(engine.clone(), auth))
        .with_state(engine);

    let mut app = Router::new().nest("/api", api);
    if let Some(dir) = &cfg.static_dir {
        let index = dir.join("index.html");
        app = app.fallback_service(ServeDir::new(dir).fallback(ServeFile::new(index)));
    }
    if !cfg.cors_origins.is_empty() {
        let origins: Vec<HeaderValue> = cfg.cors_origins.iter().filter_map(|o| o.parse().ok()).collect();
        app = app.layer(
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(origins))
                .allow_methods([Method::GET, Method::POST, Method::PUT, Method::PATCH, Method::DELETE])
                .allow_headers([header::CONTENT_TYPE, "x-axe-token".parse().unwrap()]),
        );
    }
    app
}

async fn auth(State(e): State<Shared>, req: Request, next: Next) -> Response {
    if let Some(tok) = &e.token {
        let ok = req
            .headers()
            .get("x-axe-token")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == tok)
            .unwrap_or(false);
        if !ok {
            return ApiError(StatusCode::UNAUTHORIZED, "missing app token".into()).into_response();
        }
    }
    next.run(req).await
}

// ---------- overview & miners

#[derive(Serialize)]
struct Overview {
    fleet: Fleet,
    miners: Vec<MinerView>,
    events: Vec<Event>,
}

async fn overview(State(e): State<Shared>) -> R<Overview> {
    let miners = e.db.miners()?.into_iter().map(|m| view(&e, m)).collect();
    Ok(Json(Overview { fleet: e.fleet(), miners, events: e.db.events(None, 12)? }))
}

async fn list(State(e): State<Shared>) -> R<Vec<MinerView>> {
    Ok(Json(e.db.miners()?.into_iter().map(|m| view(&e, m)).collect()))
}

async fn one(State(e): State<Shared>, Path(id): Path<i64>) -> R<MinerView> {
    let m = miner(&e, id)?;
    Ok(Json(view(&e, m)))
}

#[derive(Deserialize)]
struct AddBody {
    ip: String,
    #[serde(default)]
    name: String,
}

fn clean_ip(ip: &str) -> String {
    ip.trim().trim_start_matches("http://").trim_start_matches("https://").trim_end_matches('/').to_string()
}

async fn add(State(e): State<Shared>, Json(b): Json<AddBody>) -> R<MinerView> {
    let ip = clean_ip(&b.ip);
    if ip.is_empty() {
        return Err(bad("enter an IP address or hostname"));
    }
    if e.db.miner_by_ip(&ip)?.is_some() {
        return Err(bad("that miner is already in the list"));
    }
    let found = e
        .client
        .detect_slow(&ip)
        .await
        .ok_or_else(|| ApiError(StatusCode::BAD_GATEWAY, format!("no AxeForge or AxeOS miner answered at {ip}")))?;
    let name = if b.name.trim().is_empty() {
        if found.hostname.is_empty() { found.model.clone() } else { found.hostname.clone() }
    } else {
        b.name.trim().to_string()
    };
    let id = e.db.add_miner(&ip, &name, &found.kind, &found.model)?;
    e.db.add_event(Some(id), "added", &format!("Added {name} ({}) at {ip}", found.model))?;
    e.poll_once().await;
    let m = miner(&e, id)?;
    Ok(Json(view(&e, m)))
}

#[derive(Deserialize)]
struct RenameBody {
    name: String,
}

async fn rename(State(e): State<Shared>, Path(id): Path<i64>, Json(b): Json<RenameBody>) -> R<MinerView> {
    miner(&e, id)?;
    e.db.rename_miner(id, b.name.trim())?;
    let m = miner(&e, id)?;
    Ok(Json(view(&e, m)))
}

async fn remove(State(e): State<Shared>, Path(id): Path<i64>) -> R<Value> {
    miner(&e, id)?;
    e.db.delete_miner(id)?;
    e.live.write().unwrap().remove(&id);
    Ok(Json(json!({"ok": true})))
}

// ---------- history & events

#[derive(Deserialize)]
struct RangeQ {
    #[serde(default)]
    range: String,
}

fn range(r: &str) -> (i64, i64) {
    match r {
        "6h" => (6 * 3600, 120),
        "24h" => (86_400, 600),
        "7d" => (7 * 86_400, 3600),
        "30d" => (30 * 86_400, 6 * 3600),
        _ => (3600, 30),
    }
}

async fn miner_history(State(e): State<Shared>, Path(id): Path<i64>, Query(q): Query<RangeQ>) -> R<Vec<db::Point>> {
    miner(&e, id)?;
    let (span, bucket) = range(&q.range);
    Ok(Json(e.db.history(Some(id), db::now() - span, bucket)?))
}

async fn fleet_history(State(e): State<Shared>, Query(q): Query<RangeQ>) -> R<Vec<db::Point>> {
    let (span, bucket) = range(&q.range);
    Ok(Json(e.db.history(None, db::now() - span, bucket)?))
}

#[derive(Deserialize)]
struct EventsQ {
    miner: Option<i64>,
    limit: Option<i64>,
}

async fn events(State(e): State<Shared>, Query(q): Query<EventsQ>) -> R<Vec<Event>> {
    Ok(Json(e.db.events(q.miner, q.limit.unwrap_or(100).clamp(1, 1000))?))
}

// ---------- pools, tuning, control

async fn get_pools(State(e): State<Shared>, Path(id): Path<i64>) -> R<PoolConfig> {
    let m = miner(&e, id)?;
    Ok(Json(e.client.pools(&m.ip, &m.kind, &m.session).await?))
}

async fn put_pools(State(e): State<Shared>, Path(id): Path<i64>, Json(cfg): Json<PoolConfig>) -> R<Value> {
    let m = miner(&e, id)?;
    let msg = e.client.set_pools(&m.ip, &m.kind, &m.session, &cfg).await?;
    e.db.add_event(Some(id), "config", &format!("Pools changed on {}", display(&m)))?;
    Ok(Json(json!({"ok": true, "message": msg})))
}

#[derive(Deserialize)]
struct ApplyBody {
    miners: Vec<i64>,
    pools: PoolConfig,
}

/// Copies one pool setup onto several miners. Fails per miner, not as a whole.
async fn apply_pools(State(e): State<Shared>, Json(b): Json<ApplyBody>) -> R<Value> {
    let mut results = vec![];
    for id in b.miners {
        let Ok(Some(m)) = e.db.miner(id) else { continue };
        let r = e.client.set_pools(&m.ip, &m.kind, &m.session, &b.pools).await;
        if r.is_ok() {
            let _ = e.db.add_event(Some(id), "config", &format!("Pools changed on {}", display(&m)));
        }
        results.push(json!({"id": id, "ok": r.is_ok(), "message": r.unwrap_or_else(|x| x.to_string())}));
    }
    Ok(Json(json!({"results": results})))
}

async fn get_tuning(State(e): State<Shared>, Path(id): Path<i64>) -> R<Tuning> {
    let m = miner(&e, id)?;
    Ok(Json(e.client.tuning(&m.ip, &m.kind, &m.session).await?))
}

async fn put_tuning(State(e): State<Shared>, Path(id): Path<i64>, Json(t): Json<Tuning>) -> R<Value> {
    let m = miner(&e, id)?;
    if let Some(l) = e.client.tuning(&m.ip, &m.kind, &m.session).await?.limits {
        if let (Some(f), Some(max)) = (t.freq, l.max_freq) {
            if f > max {
                return Err(bad(&format!("{f} MHz is above this board's limit of {max} MHz")));
            }
        }
        if let (Some(v), Some(lo), Some(hi)) = (t.core_mv, l.min_mv, l.max_mv) {
            if v < lo || v > hi {
                return Err(bad(&format!("core voltage must be between {lo} and {hi} mV")));
            }
        }
    }
    let msg = e.client.set_tuning(&m.ip, &m.kind, &m.session, &t).await?;
    e.db.add_event(Some(id), "config", &format!("Tuning changed on {}", display(&m)))?;
    Ok(Json(json!({"ok": true, "message": msg})))
}

async fn restart(State(e): State<Shared>, Path(id): Path<i64>) -> R<Value> {
    let m = miner(&e, id)?;
    let msg = e.client.restart(&m.ip, &m.kind, &m.session).await?;
    e.db.add_event(Some(id), "restart", &format!("Restart sent to {}", display(&m)))?;
    Ok(Json(json!({"ok": true, "message": if msg.trim().is_empty() { "Restarting".to_string() } else { msg }})))
}

async fn retune(State(e): State<Shared>, Path(id): Path<i64>) -> R<Value> {
    let m = miner(&e, id)?;
    let msg = e.client.retune(&m.ip, &m.kind, &m.session).await?;
    e.db.add_event(Some(id), "config", &format!("Auto-tune restarted on {}", display(&m)))?;
    Ok(Json(json!({"ok": true, "message": if msg.trim().is_empty() { "Auto-tune restarted".to_string() } else { msg }})))
}

#[derive(Deserialize)]
struct LoginBody {
    code: String,
}

async fn login(State(e): State<Shared>, Path(id): Path<i64>, Json(b): Json<LoginBody>) -> R<Value> {
    let m = miner(&e, id)?;
    let token = e.client.login(&m.ip, b.code.trim()).await?;
    e.db.set_session(id, &token)?;
    e.wake.notify_one();
    Ok(Json(json!({"ok": true})))
}

async fn swarm(State(e): State<Shared>, Path(id): Path<i64>) -> R<Value> {
    let m = miner(&e, id)?;
    let peers = e.client.swarm(&m.ip, &m.session).await?;
    let known: Vec<String> = e.db.miners()?.into_iter().map(|m| m.ip).collect();
    let out: Vec<Value> = peers
        .into_iter()
        .map(|p| json!({"ip": p.ip, "name": p.name, "model": p.model, "known": known.contains(&p.ip)}))
        .collect();
    Ok(Json(json!({ "peers": out })))
}

fn display(m: &MinerRow) -> String {
    if m.name.is_empty() { m.ip.clone() } else { m.name.clone() }
}

// ---------- scan

async fn scan_info(State(e): State<Shared>) -> R<Value> {
    let saved = e.setting("scan_subnet");
    Ok(Json(json!({ "subnet": if saved.is_empty() { guess_subnet() } else { saved } })))
}

#[derive(Deserialize)]
struct ScanBody {
    #[serde(default)]
    subnet: String,
}

async fn scan(State(e): State<Shared>, Json(b): Json<ScanBody>) -> R<Value> {
    let subnet = if b.subnet.trim().is_empty() { guess_subnet() } else { b.subnet.trim().to_string() };
    let base = crate::subnet_base(&subnet).ok_or_else(|| bad("subnet should look like 192.168.1"))?;
    let _ = e.db.set_setting("scan_subnet", &base);
    let found = e.scan(&base).await;
    let known: Vec<String> = e.db.miners()?.into_iter().map(|m| m.ip).collect();
    let out: Vec<Value> = found
        .into_iter()
        .map(|f| {
            let k = known.contains(&f.ip);
            let mut v = serde_json::to_value(f).unwrap_or(Value::Null);
            v["known"] = json!(k);
            v
        })
        .collect();
    Ok(Json(json!({"subnet": base, "found": out})))
}

// ---------- settings, backup

async fn get_settings(State(e): State<Shared>) -> R<Value> {
    let (samples, hourly, events) = e.db.stats()?;
    Ok(Json(json!({
        "settings": public_settings(&e),
        "fixed": e.fixed.read().unwrap().keys().cloned().collect::<Vec<_>>(),
        "db": {"samples": samples, "hourly": hourly, "events": events},
    })))
}

async fn put_settings(State(e): State<Shared>, Json(b): Json<HashMap<String, Value>>) -> R<Value> {
    for (k, v) in b {
        if !crate::DEFAULTS.iter().any(|(d, _)| *d == k) || e.is_fixed(&k) {
            continue;
        }
        let s = match v {
            Value::String(s) => s,
            Value::Bool(x) => (if x { "1" } else { "0" }).into(),
            other => other.to_string(),
        };
        // the UI never gets the password back, so empty means "keep it"
        if k == "node_pass" && s.is_empty() {
            continue;
        }
        e.db.set_setting(&k, &s)?;
    }
    e.wake.notify_one();
    e.pool_wake.notify_one();
    Ok(Json(json!({"settings": public_settings(&e)})))
}

/// Settings without secrets: the RPC password becomes `node_pass_set`.
fn public_settings(e: &Engine) -> HashMap<String, String> {
    let mut s = e.settings();
    let set = s.remove("node_pass").is_some_and(|p| !p.is_empty());
    s.insert("node_pass".into(), String::new());
    s.insert("node_pass_set".into(), if set { "1" } else { "0" }.into());
    s
}

async fn export(State(e): State<Shared>) -> R<Value> {
    let miners: Vec<Value> = e
        .db
        .miners()?
        .into_iter()
        .map(|m| json!({"ip": m.ip, "name": m.name, "kind": m.kind, "model": m.model}))
        .collect();
    let mut settings = e.settings();
    settings.retain(|k, _| k != "node_pass" && !e.is_fixed(k));
    Ok(Json(json!({"app": "axemobile", "version": 2, "miners": miners, "settings": settings})))
}

#[derive(Deserialize)]
struct ImportMiner {
    ip: String,
    #[serde(default)]
    name: String,
    #[serde(default)]
    kind: String,
    #[serde(default)]
    model: String,
}

#[derive(Deserialize)]
struct ImportBody {
    #[serde(default)]
    miners: Vec<ImportMiner>,
    #[serde(default)]
    settings: HashMap<String, String>,
}

async fn import(State(e): State<Shared>, Json(b): Json<ImportBody>) -> R<Value> {
    let mut added = 0;
    for m in b.miners {
        let ip = clean_ip(&m.ip);
        if ip.is_empty() || e.db.miner_by_ip(&ip)?.is_some() {
            continue;
        }
        let (kind, model) = if m.kind == crate::miner::AXEFORGE || m.kind == crate::miner::AXEOS {
            (m.kind, m.model)
        } else {
            match e.client.detect_slow(&ip).await {
                Some(f) => (f.kind, f.model),
                None => continue,
            }
        };
        e.db.add_miner(&ip, &m.name, &kind, &model)?;
        added += 1;
    }
    for (k, v) in b.settings {
        if crate::DEFAULTS.iter().any(|(d, _)| *d == k) && !e.is_fixed(&k) {
            e.db.set_setting(&k, &v)?;
        }
    }
    e.wake.notify_one();
    Ok(Json(json!({"added": added})))
}

// ---------- AxePool

async fn pool_status(State(e): State<Shared>) -> R<Value> {
    let st = e.pool.status();
    let port = st.port;
    let host = crate::pool::stratum_host();
    let day = crate::pool::odds(st.hashrate, st.net_diff, 86_400.0);
    let month = crate::pool::odds(st.hashrate, st.net_diff, 30.0 * 86_400.0);
    let year = crate::pool::odds(st.hashrate, st.net_diff, 365.0 * 86_400.0);
    let expected_days = if st.hashrate > 0.0 && st.net_diff > 0.0 {
        Some(st.net_diff * 4_294_967_296.0 / (st.hashrate * 1e9) / 86_400.0)
    } else {
        None
    };
    Ok(Json(json!({
        "status": st,
        "stratum": format!("stratum+tcp://{host}:{port}"),
        "odds": {"day": day, "month": month, "year": year, "expected_days": expected_days},
        "blocks": e.db.pool_blocks(50)?,
        "bests": e.db.pool_bests()?.into_iter().map(|(w, d, ts)| json!({"worker": w, "diff": d, "ts": ts})).collect::<Vec<_>>(),
    })))
}

/// Makes AxePool the miner's first pool.
#[derive(Deserialize, Default)]
struct PointBody {
    /// the address the browser used to reach AxeMobile, when it is an IP
    #[serde(default)]
    host: Option<String>,
}

async fn pool_point(State(e): State<Shared>, Path(id): Path<i64>, Json(b): Json<PointBody>) -> R<Value> {
    let m = miner(&e, id)?;
    let msg = crate::pool::point_miner(&e, &m, b.host).await?;
    Ok(Json(json!({"ok": true, "message": msg})))
}

async fn pool_history(State(e): State<Shared>, Query(q): Query<RangeQ>) -> R<Value> {
    let (span, bucket) = range(if q.range.is_empty() { "24h" } else { &q.range });
    let pts = e.db.pool_history(db::now() - span, bucket)?;
    Ok(Json(json!(pts.into_iter().map(|(t, h)| json!({"t": t, "hashrate": h})).collect::<Vec<_>>())))
}

async fn market(State(e): State<Shared>) -> R<Value> {
    let m = e.market.read().unwrap().clone();
    Ok(Json(json!({ "market": m })))
}

async fn leaderboard(State(e): State<Shared>) -> R<Value> {
    let miners = e.db.miners()?;
    let name = |id: i64| miners.iter().find(|m| m.id == id).map(display).unwrap_or_else(|| "removed".into());
    let shares: Vec<Value> = e
        .db
        .top_shares(25)?
        .into_iter()
        .map(|(id, ts, d)| json!({"miner_id": id, "miner": name(id), "ts": ts, "diff": d}))
        .collect();
    let mut ranked: Vec<&MinerRow> = miners.iter().collect();
    ranked.sort_by(|a, b| b.best_diff.partial_cmp(&a.best_diff).unwrap_or(std::cmp::Ordering::Equal));
    let miners: Vec<Value> = ranked
        .into_iter()
        .map(|m| json!({"id": m.id, "name": display(m), "model": m.model, "best_diff": m.best_diff, "blocks": m.blocks}))
        .collect();
    Ok(Json(json!({ "shares": shares, "miners": miners })))
}

/// Read-only fleet summary for desktop widgets (the macOS WidgetKit widget
/// reads it from 127.0.0.1). No writes, no miner details beyond the basics.
pub fn widget_router(engine: Shared) -> Router {
    Router::new().route("/api/widget", get(widget)).with_state(engine)
}

async fn widget(State(e): State<Shared>) -> R<Value> {
    let f = e.fleet();
    let mut miners: Vec<Value> = e
        .db
        .miners()?
        .into_iter()
        .map(|m| {
            let l = e.live_of(m.id);
            let s = l.snap.as_ref();
            json!({
                "name": display(&m),
                "online": l.online,
                "hashrate": s.and_then(|s| s.hashrate),
                "temp": s.and_then(|s| s.temp),
                "power": s.and_then(|s| s.power),
            })
        })
        .collect();
    miners.sort_by(|a, b| b["hashrate"].as_f64().unwrap_or(0.0).partial_cmp(&a["hashrate"].as_f64().unwrap_or(0.0)).unwrap_or(std::cmp::Ordering::Equal));
    miners.truncate(6);
    Ok(Json(json!({
        "online": f.online,
        "total": f.total,
        "hashrate": f.hashrate,
        "power": f.power,
        "efficiency": f.efficiency,
        "best": f.best_diff,
        "hottest": f.hottest,
        "theme": e.setting("theme"),
        "miners": miners,
        "updated": db::now(),
    })))
}
