//! AxeMobile engine. The desktop app and the Umbrel server both run this:
//! a poller that reads every miner on a timer and writes the history into
//! SQLite, plus the `/api` router the UI talks to.

pub mod api;
pub mod db;
pub mod market;
pub mod miner;

use std::collections::HashMap;
use std::net::{Ipv4Addr, UdpSocket};
use std::path::PathBuf;
use std::sync::{Arc, RwLock};
use std::time::Duration;

use futures::stream::{self, StreamExt};
use serde::Serialize;
use tokio::sync::Notify;

pub use db::Db;
pub use miner::{Client, Found, Snapshot};

pub struct Config {
    pub db_path: PathBuf,
    /// When set, every `/api` call must carry `X-Axe-Token` with this value.
    pub token: Option<String>,
    /// Folder with the built web UI. None means API only.
    pub static_dir: Option<PathBuf>,
    /// Extra origins allowed to call the API (the desktop webview).
    pub cors_origins: Vec<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Live {
    pub online: bool,
    pub fails: u32,
    #[serde(skip)]
    pub hot: bool,
    #[serde(skip)]
    pub low: u32,
    pub last_seen: i64,
    pub error: String,
    pub snap: Option<Snapshot>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct Fleet {
    pub total: usize,
    pub online: usize,
    pub hashrate: f64,
    pub expected: f64,
    pub power: f64,
    pub efficiency: Option<f64>,
    pub best_diff: f64,
    pub accepted: f64,
    pub rejected: f64,
    pub hottest: Option<f64>,
    pub cost_per_day: Option<f64>,
    pub currency: String,
}

pub struct Engine {
    pub db: Db,
    pub client: Client,
    pub live: RwLock<HashMap<i64, Live>>,
    pub wake: Notify,
    pub token: Option<String>,
    pub market: RwLock<Option<market::Market>>,
}

pub const DEFAULTS: &[(&str, &str)] = &[
    ("poll_secs", "10"),
    ("theme", "default"),
    ("intro", "1"),
    ("energy_price", "0"),
    ("currency", "€"),
    ("scan_subnet", ""),
    ("tray_close", "1"),
    ("notify", "1"),
    ("alert_temp", "70"),
    ("alert_drop", "25"),
    ("market", "1"),
    ("autostart", "0"),
];

impl Engine {
    pub fn new(db: Db, token: Option<String>) -> Arc<Self> {
        Arc::new(Self {
            db,
            client: Client::new(),
            live: RwLock::new(HashMap::new()),
            wake: Notify::new(),
            token,
            market: RwLock::new(None),
        })
    }

    pub fn setting(&self, key: &str) -> String {
        if let Ok(all) = self.db.settings() {
            if let Some(v) = all.get(key) {
                return v.clone();
            }
        }
        DEFAULTS.iter().find(|(k, _)| *k == key).map(|(_, v)| v.to_string()).unwrap_or_default()
    }

    pub fn settings(&self) -> HashMap<String, String> {
        let mut out: HashMap<String, String> =
            DEFAULTS.iter().map(|(k, v)| (k.to_string(), v.to_string())).collect();
        if let Ok(all) = self.db.settings() {
            out.extend(all);
        }
        out
    }

    pub fn live_of(&self, id: i64) -> Live {
        self.live.read().unwrap().get(&id).cloned().unwrap_or_default()
    }

    pub fn fleet(&self) -> Fleet {
        let miners = self.db.miners().unwrap_or_default();
        let live = self.live.read().unwrap();
        let mut f = Fleet { total: miners.len(), currency: self.setting("currency"), ..Default::default() };
        for m in &miners {
            f.best_diff = f.best_diff.max(m.best_diff);
            let Some(l) = live.get(&m.id) else { continue };
            if !l.online {
                continue;
            }
            f.online += 1;
            if let Some(s) = &l.snap {
                f.hashrate += s.hashrate.unwrap_or(0.0);
                f.expected += s.expected.unwrap_or(0.0);
                f.power += s.power.unwrap_or(0.0);
                f.accepted += s.accepted.unwrap_or(0.0);
                f.rejected += s.rejected.unwrap_or(0.0);
                f.best_diff = f.best_diff.max(s.best_diff.unwrap_or(0.0));
                if let Some(t) = s.temp {
                    f.hottest = Some(f.hottest.map_or(t, |h: f64| h.max(t)));
                }
            }
        }
        if f.hashrate > 0.0 {
            f.efficiency = Some(f.power / (f.hashrate / 1000.0));
        }
        let price: f64 = self.setting("energy_price").parse().unwrap_or(0.0);
        if price > 0.0 {
            f.cost_per_day = Some(f.power / 1000.0 * 24.0 * price);
        }
        f
    }

    /// Reads every miner once and records what changed.
    pub async fn poll_once(&self) {
        let miners = match self.db.miners() {
            Ok(m) => m,
            Err(e) => {
                tracing::warn!("db: {e}");
                return;
            }
        };
        let results = stream::iter(miners.into_iter())
            .map(|m| async move {
                let r = self.client.snapshot(&m.ip, &m.kind, &m.session).await;
                (m, r)
            })
            .buffer_unordered(16)
            .collect::<Vec<_>>()
            .await;

        let ts = db::now();
        for (m, r) in results {
            let prev = self.live_of(m.id);
            let name = if m.name.is_empty() { m.ip.clone() } else { m.name.clone() };
            let mut next = prev.clone();
            match r {
                Ok(snap) => {
                    if !prev.online && prev.snap.is_some() {
                        let _ = self.db.add_event(Some(m.id), "online", &format!("{name} is back online"));
                    }
                    if let (Some(a), Some(b)) = (prev.snap.as_ref().and_then(|s| s.uptime), snap.uptime) {
                        if b + 30.0 < a {
                            let _ = self.db.add_event(Some(m.id), "restart", &format!("{name} restarted"));
                        }
                    }
                    if !snap.fault.is_empty() && prev.snap.as_ref().map(|s| s.fault.as_str()) != Some(snap.fault.as_str()) {
                        let _ = self.db.add_event(Some(m.id), "fault", &format!("{name}: {}", snap.fault));
                    }
                    let best = snap.best_diff.unwrap_or(0.0);
                    let blocks = snap.blocks.unwrap_or(0.0) as i64;
                    if best > m.best_diff || blocks > m.blocks {
                        if best > m.best_diff {
                            let _ = self.db.add_best_share(m.id, best);
                        }
                        if m.best_diff > 0.0 && best > m.best_diff {
                            let _ = self.db.add_event(
                                Some(m.id),
                                "best",
                                &format!("{name} set a new best difficulty: {}", fmt_diff(best)),
                            );
                        }
                        if blocks > m.blocks && prev.snap.is_some() {
                            let _ = self.db.add_event(Some(m.id), "block", &format!("{name} found a block!"));
                        }
                        let _ = self.db.set_records(m.id, best.max(m.best_diff), blocks.max(m.blocks));
                    }
                    if !snap.model.is_empty() && snap.model != m.model {
                        let _ = self.db.set_identity(m.id, &m.kind, &snap.model);
                    }
                    let _ = self.db.add_sample(
                        m.id,
                        ts,
                        &db::Sample {
                            hashrate: snap.hashrate,
                            temp: snap.temp,
                            vr_temp: snap.vr_temp,
                            power: snap.power,
                            fan_rpm: snap.fan_rpm,
                        },
                    );
                    let alert_temp: f64 = self.setting("alert_temp").parse().unwrap_or(70.0);
                    if let Some(t) = snap.temp {
                        if alert_temp > 0.0 && t >= alert_temp && !prev.hot {
                            next.hot = true;
                            let _ = self.db.add_event(Some(m.id), "hot", &format!("{name} is running hot: {t:.1}°C"));
                        } else if t < alert_temp - 3.0 {
                            next.hot = false;
                        }
                    }
                    let drop_pct: f64 = self.setting("alert_drop").parse().unwrap_or(25.0);
                    if let (Some(h), Some(e)) = (snap.hashrate, snap.expected) {
                        if drop_pct > 0.0 && e > 0.0 && h < e * (1.0 - drop_pct / 100.0) {
                            next.low += 1;
                            if next.low == 3 {
                                let _ = self.db.add_event(
                                    Some(m.id),
                                    "drop",
                                    &format!("{name} hashrate dropped to {:.0}% of expected", h / e * 100.0),
                                );
                            }
                        } else {
                            next.low = 0;
                        }
                    }
                    next.online = true;
                    next.fails = 0;
                    next.last_seen = ts;
                    next.error.clear();
                    next.snap = Some(snap);
                }
                Err(e) => {
                    next.fails += 1;
                    next.error = e.to_string();
                    if next.fails >= 2 && prev.online {
                        next.online = false;
                        let _ = self.db.add_event(Some(m.id), "offline", &format!("{name} stopped answering"));
                    }
                    if next.snap.is_none() {
                        next.online = false;
                    }
                }
            }
            self.live.write().unwrap().insert(m.id, next);
        }
    }

    /// Bitcoin price, fees and tip height from mempool.space every 5 minutes.
    pub async fn run_market(self: Arc<Self>) {
        loop {
            if self.setting("market") != "0" {
                match market::fetch(&self.client).await {
                    Ok(m) => *self.market.write().unwrap() = Some(m),
                    Err(e) => tracing::debug!("market: {e}"),
                }
            }
            tokio::time::sleep(Duration::from_secs(300)).await;
        }
    }

    pub async fn run_poller(self: Arc<Self>) {
        let mut last_prune = 0i64;
        loop {
            self.poll_once().await;
            let now = db::now();
            if now - last_prune > 3600 {
                let _ = self.db.prune();
                last_prune = now;
            }
            let secs: u64 = self.setting("poll_secs").parse().unwrap_or(10).clamp(3, 300);
            tokio::select! {
                _ = tokio::time::sleep(Duration::from_secs(secs)) => {}
                _ = self.wake.notified() => {}
            }
        }
    }

    /// Probes every host of a /24 and returns the miners that answered.
    pub async fn scan(&self, subnet: &str) -> Vec<Found> {
        let Some(base) = subnet_base(subnet) else { return vec![] };
        let hosts: Vec<String> = (1..=254).map(|i| format!("{base}.{i}")).collect();
        let mut found: Vec<Found> = stream::iter(hosts)
            .map(|ip| async move { self.client.detect(&ip).await })
            .buffer_unordered(64)
            .filter_map(|x| async move { x })
            .collect()
            .await;
        found.sort_by_key(|f| f.ip.split('.').last().and_then(|x| x.parse::<u32>().ok()).unwrap_or(0));
        found
    }
}

/// "192.168.1", "192.168.1.0/24" or "192.168.1.77" all become "192.168.1".
pub fn subnet_base(s: &str) -> Option<String> {
    let s = s.trim().split('/').next()?;
    let parts: Vec<&str> = s.split('.').filter(|p| !p.is_empty()).collect();
    if parts.len() < 3 || parts.len() > 4 {
        return None;
    }
    for p in &parts[..3] {
        p.parse::<u8>().ok()?;
    }
    Some(parts[..3].join("."))
}

/// The /24 of the interface that routes to the internet. No packet is sent.
pub fn guess_subnet() -> String {
    let ip = UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("1.1.1.1:80")?;
            s.local_addr()
        })
        .ok()
        .and_then(|a| match a.ip() {
            std::net::IpAddr::V4(v) if v != Ipv4Addr::UNSPECIFIED => Some(v),
            _ => None,
        });
    match ip {
        Some(v) => {
            let o = v.octets();
            format!("{}.{}.{}", o[0], o[1], o[2])
        }
        None => "192.168.1".into(),
    }
}

pub fn fmt_diff(d: f64) -> String {
    const U: [&str; 7] = ["", "K", "M", "G", "T", "P", "E"];
    let mut v = d;
    let mut i = 0;
    while v >= 1000.0 && i < U.len() - 1 {
        v /= 1000.0;
        i += 1;
    }
    format!("{v:.2}{}", U[i])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn subnets() {
        assert_eq!(subnet_base("192.168.1").as_deref(), Some("192.168.1"));
        assert_eq!(subnet_base("10.0.5.0/24").as_deref(), Some("10.0.5"));
        assert_eq!(subnet_base("10.0.5.77").as_deref(), Some("10.0.5"));
        assert_eq!(subnet_base("nope"), None);
        assert_eq!(fmt_diff(1_358_463_938.0), "1.36G");
    }
}
