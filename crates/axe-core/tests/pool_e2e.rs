//! AxePool end to end: a fake bitcoind, the real stratum server, and a
//! scripted miner that talks stratum the way AxeOS does.

use std::sync::{Arc, Mutex};
use std::time::Duration;

use axe_core::pool::work::{self, sha256d, H256};
use axe_core::{Db, Engine};
use axum::{routing::post, Json, Router};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpStream;

fn template() -> Value {
    json!({
        "version": 0x20000000u32,
        "previousblockhash": "000000000000000000025a0e1f6a1d1c2b3a49586776859493a2b1c0d0e0f001",
        "transactions": [
            {"txid": "11".repeat(32), "data": "aa", "fee": 500},
            {"txid": "22".repeat(32), "data": "bb", "fee": 700},
            {"txid": "33".repeat(32), "data": "cc", "fee": 900},
        ],
        "coinbasevalue": 312_502_100u64,
        "bits": "1d00ffff",
        // a block at difficulty ~0.001 so the test can find one
        "target": format!("000003e7{}", "ff".repeat(28)),
        "height": 901_234,
        "curtime": 1_760_000_000u32,
        "mintime": 1_759_990_000u32,
        "default_witness_commitment": format!("6a24aa21a9ed{}", "ab".repeat(32)),
    })
}

async fn fake_node(submitted: Arc<Mutex<Vec<String>>>) -> u16 {
    let app = Router::new().route(
        "/",
        post(move |Json(req): Json<Value>| {
            let submitted = submitted.clone();
            async move {
                let m = req["method"].as_str().unwrap_or("");
                let result = match m {
                    "getblockchaininfo" => json!({"chain": "regtest", "blocks": 901_233, "headers": 901_233, "initialblockdownload": false, "verificationprogress": 1.0}),
                    "getnetworkinfo" => json!({"subversion": "/Satoshi:29.0.0/"}),
                    "getbestblockhash" => json!("000000000000000000025a0e1f6a1d1c2b3a49586776859493a2b1c0d0e0f001"),
                    "getblocktemplate" => template(),
                    "submitblock" => {
                        submitted.lock().unwrap().push(req["params"][0].as_str().unwrap().to_string());
                        Value::Null
                    }
                    _ => return Json(json!({"result": null, "error": {"code": -32601, "message": "nope"}, "id": req["id"]})),
                };
                Json(json!({"result": result, "error": null, "id": req["id"]}))
            }
        }),
    );
    let l = tokio::net::TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = l.local_addr().unwrap().port();
    tokio::spawn(async move { axum::serve(l, app).await.unwrap() });
    port
}

fn free_port() -> u16 {
    std::net::TcpListener::bind("127.0.0.1:0").unwrap().local_addr().unwrap().port()
}

struct Miner {
    r: tokio::io::Lines<BufReader<tokio::net::tcp::OwnedReadHalf>>,
    w: tokio::net::tcp::OwnedWriteHalf,
    next: u64,
}

impl Miner {
    async fn call(&mut self, method: &str, params: Value) -> (Value, Vec<Value>) {
        self.next += 1;
        let id = self.next;
        let line = json!({"id": id, "method": method, "params": params}).to_string() + "\n";
        self.w.write_all(line.as_bytes()).await.unwrap();
        let mut notes = vec![];
        loop {
            let l = tokio::time::timeout(Duration::from_secs(10), self.r.next_line()).await.unwrap().unwrap().unwrap();
            let v: Value = serde_json::from_str(&l).unwrap();
            if v["id"] == json!(id) {
                return (v, notes);
            }
            notes.push(v);
        }
    }

    async fn until(&mut self, method: &str) -> Value {
        loop {
            let l = tokio::time::timeout(Duration::from_secs(10), self.r.next_line()).await.unwrap().unwrap().unwrap();
            let v: Value = serde_json::from_str(&l).unwrap();
            if v["method"] == method {
                return v;
            }
        }
    }
}

fn swap_words(b: &[u8]) -> Vec<u8> {
    b.chunks(4).flat_map(|c| c.iter().rev().copied().collect::<Vec<_>>()).collect()
}

/// Grinds nonces like an ASIC until the hash reaches `min` difficulty.
fn grind(notify: &Value, en1: &[u8], en2: &[u8], vbits: u32, min: f64, max: f64, start: u32) -> (u32, u32, f64, H256) {
    let p = &notify["params"];
    let h = |i: usize| hex::decode(p[i].as_str().unwrap()).unwrap();
    let prev = swap_words(&h(1));
    let cb = [h(2), en1.to_vec(), en2.to_vec(), h(3)].concat();
    let mut root = sha256d(&cb);
    for b in p[4].as_array().unwrap() {
        let mut x = root.to_vec();
        x.extend(hex::decode(b.as_str().unwrap()).unwrap());
        root = sha256d(&x);
    }
    let version = u32::from_str_radix(p[5].as_str().unwrap(), 16).unwrap() | vbits;
    let bits = u32::from_str_radix(p[6].as_str().unwrap(), 16).unwrap();
    let ntime = u32::from_str_radix(p[7].as_str().unwrap(), 16).unwrap();
    let mut nonce = start;
    loop {
        let mut hdr = Vec::with_capacity(80);
        hdr.extend(version.to_le_bytes());
        hdr.extend(&prev);
        hdr.extend(root);
        hdr.extend(ntime.to_le_bytes());
        hdr.extend(bits.to_le_bytes());
        hdr.extend(nonce.to_le_bytes());
        let hash = sha256d(&hdr);
        let d = work::hash_diff(&hash);
        if d >= min && d < max {
            return (nonce, ntime, d, hash);
        }
        nonce += 1;
    }
}

#[tokio::test(flavor = "multi_thread")]
async fn stratum_shares_and_block() {
    let submitted = Arc::new(Mutex::new(Vec::new()));
    let node_port = fake_node(submitted.clone()).await;
    let port = free_port();
    let e = Engine::new(Db::memory().unwrap(), None);
    e.fix("pool_enabled", "1");
    e.fix("pool_port", &port.to_string());
    e.fix("node_url", &format!("http://127.0.0.1:{node_port}"));
    e.fix("node_user", "u");
    e.fix("node_pass", "p");
    tokio::spawn(axe_core::pool::supervise(e.clone()));

    let mut tries = 0;
    let sock = loop {
        match TcpStream::connect(("127.0.0.1", port)).await {
            Ok(s) => break s,
            Err(_) if tries < 50 => {
                tries += 1;
                tokio::time::sleep(Duration::from_millis(100)).await;
            }
            Err(x) => panic!("{x}"),
        }
    };
    // wait for the first template
    for _ in 0..50 {
        if e.pool.status().height > 0 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    assert_eq!(e.pool.status().height, 901_234);
    assert!(e.pool.status().node.ok);

    let (r, w) = sock.into_split();
    let mut m = Miner { r: BufReader::new(r).lines(), w, next: 0 };

    let (v, _) = m.call("mining.configure", json!([["version-rolling"], {"version-rolling.mask": "ffffffff"}])).await;
    assert_eq!(v["result"]["version-rolling.mask"], "1fffe000");
    let (v, _) = m.call("mining.subscribe", json!(["bitaxe/BM1370/v2.9.0"])).await;
    let en1 = hex::decode(v["result"][1].as_str().unwrap()).unwrap();
    assert_eq!(v["result"][2], 8);
    let (v, _) = m.call("mining.suggest_difficulty", json!([0.0001])).await;
    assert_eq!(v["result"], true);

    // a non-address username is refused while no payout address is set
    let (v, _) = m.call("mining.authorize", json!(["rig1", "x"])).await;
    assert!(v["error"].is_array());

    let hrp = bech32::Hrp::parse("bcrt").unwrap();
    let addr = bech32::segwit::encode(hrp, bech32::segwit::VERSION_0, &[0x42; 20]).unwrap();
    let (v, notes) = m.call("mining.authorize", json!([format!("{addr}.rig1"), "x"])).await;
    assert_eq!(v["result"], true, "{v}");
    let notify = match notes.iter().find(|n| n["method"] == "mining.notify") {
        Some(n) => n.clone(),
        None => m.until("mining.notify").await,
    };
    assert_eq!(notify["params"][4].as_array().unwrap().len(), 2);
    let job = notify["params"][0].as_str().unwrap().to_string();

    // AxeMobile's tag sits in the coinbase script
    assert!(notify["params"][2].as_str().unwrap().contains(&hex::encode("/AxeMobile AxePool/")));
    // the coinbase pays the worker's own address
    let c2 = notify["params"][3].as_str().unwrap();
    assert!(c2.contains(&format!("0014{}", "42".repeat(20))));

    // an ordinary share
    let en2 = [0u8, 0, 0, 0, 0, 0, 0, 1];
    let vbits = 0x0000_4000;
    let (nonce, ntime, _, _) = grind(&notify, &en1, &en2, vbits, 0.0001, 0.001, 0);
    let share = json!([format!("{addr}.rig1"), job, hex::encode(en2), format!("{ntime:08x}"), format!("{nonce:08x}"), format!("{vbits:08x}")]);
    let (v, _) = m.call("mining.submit", share.clone()).await;
    assert_eq!(v["result"], true, "{v}");
    // same share twice
    let (v, _) = m.call("mining.submit", share).await;
    assert_eq!(v["error"][0], 22);

    // stale job id
    let (v, _) = m.call("mining.submit", json!(["x", "ffff", hex::encode(en2), format!("{ntime:08x}"), "00000000"])).await;
    assert_eq!(v["error"][0], 21);

    // keep mining until the share also meets the block target
    let (nonce, ntime, _, hash) = grind(&notify, &en1, &en2, vbits, 0.00102, f64::INFINITY, nonce + 1);
    let (v, _) = m.call("mining.submit", json!(["w", job, hex::encode(en2), format!("{ntime:08x}"), format!("{nonce:08x}"), format!("{vbits:08x}")])).await;
    assert_eq!(v["result"], true, "{v}");

    for _ in 0..50 {
        if !submitted.lock().unwrap().is_empty() {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    let blocks = submitted.lock().unwrap().clone();
    assert_eq!(blocks.len(), 1);
    let b = hex::decode(&blocks[0]).unwrap();
    // header hashes to what the miner found
    assert_eq!(sha256d(&b[..80]), hash);
    assert_eq!(b[80], 4); // coinbase + 3 txs
    // strip the coinbase witness, rebuild the merkle root from the txids
    let tail = &b[81..b.len() - 3]; // the 3 one-byte txs at the end
    assert_eq!(&b[b.len() - 3..], &[0xaa, 0xbb, 0xcc]);
    assert_eq!(&tail[4..6], &[0, 1]);
    let stripped = [&tail[..4], &tail[6..tail.len() - 38], &tail[tail.len() - 4..]].concat();
    let txids: Vec<H256> = ["11", "22", "33"].iter().map(|x| hex::decode(x.repeat(32)).unwrap().try_into().unwrap()).collect();
    let root = work::merkle_root(sha256d(&stripped), &work::merkle_steps(&txids));
    assert_eq!(&b[36..68], &root);

    for _ in 0..50 {
        if e.db.pool_blocks(10).unwrap().len() == 1 {
            break;
        }
        tokio::time::sleep(Duration::from_millis(100)).await;
    }
    let found = e.db.pool_blocks(10).unwrap();
    assert_eq!(found[0].result, "accepted");
    assert_eq!(found[0].height, 901_234);
    let st = e.pool.status();
    assert_eq!(st.blocks_found, 1);
    assert_eq!(st.workers.len(), 1);
    assert_eq!(st.workers[0].name, "rig1");
    assert!(st.workers[0].accepted >= 2);
    assert!(st.workers[0].hashrate > 0.0);
}
