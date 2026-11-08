//! Talking to miners. Two firmware families are supported:
//!
//! * AxeForge (NerdQaxe / Bitaxe builds): `/api/status`, `/api/settings`,
//!   `/api/pools`, `/api/restart`, `/api/swarm`, POST bodies are JSON and every
//!   request carries `X-AxeForge: 1` plus the session token when two-factor
//!   login is on.
//! * AxeOS (stock Bitaxe / NerdAxe firmware): `/api/system/info`,
//!   `PATCH /api/system`, `POST /api/system/restart`.
//!
//! Everything is normalised into [`Snapshot`], [`PoolConfig`] and [`Tuning`]
//! so the UI never has to care which one it is looking at.

use std::time::Duration;

use anyhow::{anyhow, bail, Result};
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

pub const AXEFORGE: &str = "axeforge";
pub const AXEOS: &str = "axeos";

#[derive(Debug, Clone, Default, Serialize)]
pub struct Snapshot {
    pub kind: String,
    pub hostname: String,
    pub model: String,
    pub asic_model: String,
    pub asic_count: Option<u32>,
    pub version: String,
    pub status: String,
    pub fault: String,
    pub hashrate: Option<f64>,
    pub expected: Option<f64>,
    pub temp: Option<f64>,
    pub vr_temp: Option<f64>,
    pub power: Option<f64>,
    pub vin: Option<f64>,
    pub freq: Option<f64>,
    pub core_mv: Option<f64>,
    pub fan_pct: Option<f64>,
    pub fan_rpm: Option<f64>,
    pub uptime: Option<f64>,
    pub best_diff: Option<f64>,
    pub session_best: Option<f64>,
    pub accepted: Option<f64>,
    pub rejected: Option<f64>,
    pub pool_host: String,
    pub pool_user: String,
    pub pool_connected: Option<bool>,
    pub pool_diff: Option<f64>,
    pub network_diff: Option<f64>,
    pub block_height: Option<f64>,
    pub blocks: Option<f64>,
    pub rssi: Option<f64>,
    pub ssid: String,
    pub overclocked: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PoolEntry {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub url: String,
    #[serde(default)]
    pub port: u32,
    #[serde(default)]
    pub user: String,
    /// Never sent back to the UI; an empty value on save keeps the old one.
    #[serde(default)]
    pub pass: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub weight: Option<u32>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub connected: Option<bool>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct PoolConfig {
    pub pools: Vec<PoolEntry>,
    /// AxeForge: "failover" or "split". AxeOS: always "failover".
    #[serde(default)]
    pub mode: String,
    #[serde(default)]
    pub needs_restart: bool,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Limits {
    pub max_freq: Option<f64>,
    pub min_mv: Option<f64>,
    pub max_mv: Option<f64>,
    pub max_power: Option<f64>,
    pub chip_ceiling: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Tuning {
    #[serde(default)]
    pub auto_tune: Option<bool>,
    #[serde(default)]
    pub freq: Option<f64>,
    #[serde(default)]
    pub core_mv: Option<f64>,
    /// Target chip temperature for the fan curve.
    #[serde(default)]
    pub fan_target: Option<f64>,
    /// AxeForge: minimum fan %. AxeOS: manual fan % when auto fan is off.
    #[serde(default)]
    pub fan_pct: Option<f64>,
    #[serde(default)]
    pub fan_auto: Option<bool>,
    #[serde(default)]
    pub limits: Option<Limits>,
    #[serde(default)]
    pub needs_restart: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct Found {
    pub ip: String,
    pub kind: String,
    pub model: String,
    pub hostname: String,
    pub hashrate: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SwarmPeer {
    pub ip: String,
    pub name: String,
    pub model: String,
}

pub struct Client {
    http: reqwest::Client,
    probe: reqwest::Client,
}

fn f(v: &Value, k: &str) -> Option<f64> {
    match v.get(k)? {
        Value::Number(n) => n.as_f64(),
        Value::String(s) => parse_si(s),
        Value::Bool(b) => Some(if *b { 1.0 } else { 0.0 }),
        _ => None,
    }
}

fn s(v: &Value, k: &str) -> String {
    match v.get(k) {
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => n.to_string(),
        _ => String::new(),
    }
}

fn b(v: &Value, k: &str) -> Option<bool> {
    match v.get(k)? {
        Value::Bool(b) => Some(*b),
        Value::Number(n) => n.as_f64().map(|x| x != 0.0),
        _ => None,
    }
}

/// Parses AxeOS style difficulty strings such as "4.29G" or "512k".
pub fn parse_si(s: &str) -> Option<f64> {
    let t = s.trim();
    if t.is_empty() {
        return None;
    }
    let (num, mul) = match t.chars().last()? {
        'k' | 'K' => (&t[..t.len() - 1], 1e3),
        'M' => (&t[..t.len() - 1], 1e6),
        'G' => (&t[..t.len() - 1], 1e9),
        'T' => (&t[..t.len() - 1], 1e12),
        'P' => (&t[..t.len() - 1], 1e15),
        'E' => (&t[..t.len() - 1], 1e18),
        _ => (t, 1.0),
    };
    num.trim().parse::<f64>().ok().map(|n| n * mul)
}

fn none_if_empty(s: String) -> String {
    s.trim().to_string()
}

impl Client {
    pub fn new() -> Self {
        let http = reqwest::Client::builder()
            .timeout(Duration::from_secs(6))
            .connect_timeout(Duration::from_secs(3))
            .user_agent("AxeMobile/2")
            .build()
            .expect("http client");
        let probe = reqwest::Client::builder()
            .timeout(Duration::from_millis(2500))
            .connect_timeout(Duration::from_millis(1200))
            .user_agent("AxeMobile/2")
            .build()
            .expect("http client");
        Self { http, probe }
    }

    pub fn http(&self) -> &reqwest::Client {
        &self.http
    }

    fn url(ip: &str, path: &str) -> String {
        if ip.starts_with("http://") || ip.starts_with("https://") {
            format!("{}{}", ip.trim_end_matches('/'), path)
        } else {
            format!("http://{ip}{path}")
        }
    }

    fn forge(&self, rb: reqwest::RequestBuilder, session: &str) -> reqwest::RequestBuilder {
        let rb = rb.header("X-AxeForge", "1");
        if session.is_empty() { rb } else { rb.header("X-AxeForge-Session", session) }
    }

    async fn get_json(&self, c: &reqwest::Client, url: String, forge_session: Option<&str>) -> Result<Value> {
        let mut rb = c.get(url).header("Accept", "application/json");
        if let Some(sess) = forge_session {
            rb = self.forge(rb, sess);
        }
        let r = rb.send().await?;
        if r.status() == reqwest::StatusCode::UNAUTHORIZED {
            bail!("login required");
        }
        if !r.status().is_success() {
            bail!("HTTP {}", r.status().as_u16());
        }
        Ok(r.json::<Value>().await?)
    }

    async fn send(&self, rb: reqwest::RequestBuilder) -> Result<String> {
        let r = rb.send().await?;
        let st = r.status();
        let text = r.text().await.unwrap_or_default();
        if st == reqwest::StatusCode::UNAUTHORIZED {
            bail!("login required");
        }
        if !st.is_success() {
            bail!("{}", if text.is_empty() { format!("HTTP {}", st.as_u16()) } else { text });
        }
        Ok(text)
    }

    /// Works out what firmware a host runs. Returns None when nothing answers.
    pub async fn detect(&self, ip: &str) -> Option<Found> {
        self.detect_with(&self.probe, ip).await
    }

    pub async fn detect_slow(&self, ip: &str) -> Option<Found> {
        self.detect_with(&self.http, ip).await
    }

    async fn detect_with(&self, c: &reqwest::Client, ip: &str) -> Option<Found> {
        if let Ok(v) = self.get_json(c, Self::url(ip, "/api/status"), Some("")).await {
            if v.get("board").is_some() && (v.get("pool").is_some() || v.get("pools").is_some()) {
                let snap = parse_axeforge(&v);
                return Some(Found {
                    ip: ip.into(),
                    kind: AXEFORGE.into(),
                    model: snap.model,
                    hostname: snap.hostname,
                    hashrate: snap.hashrate,
                });
            }
        }
        if let Ok(v) = self.get_json(c, Self::url(ip, "/api/system/info"), None).await {
            if v.get("hashRate").is_some() || v.get("ASICModel").is_some() {
                let snap = parse_axeos(&v);
                return Some(Found {
                    ip: ip.into(),
                    kind: AXEOS.into(),
                    model: snap.model,
                    hostname: snap.hostname,
                    hashrate: snap.hashrate,
                });
            }
        }
        None
    }

    pub async fn snapshot(&self, ip: &str, kind: &str, session: &str) -> Result<Snapshot> {
        if kind == AXEFORGE {
            let v = self.get_json(&self.http, Self::url(ip, "/api/status"), Some(session)).await?;
            Ok(parse_axeforge(&v))
        } else {
            let v = self.get_json(&self.http, Self::url(ip, "/api/system/info"), None).await?;
            Ok(parse_axeos(&v))
        }
    }

    pub async fn restart(&self, ip: &str, kind: &str, session: &str) -> Result<String> {
        if kind == AXEFORGE {
            let rb = self.forge(self.http.post(Self::url(ip, "/api/restart")).body(""), session);
            self.send(rb).await
        } else {
            self.send(self.http.post(Self::url(ip, "/api/system/restart"))).await
        }
    }

    /// AxeForge only: throw away the auto-tune result and search again.
    pub async fn retune(&self, ip: &str, kind: &str, session: &str) -> Result<String> {
        if kind != AXEFORGE {
            bail!("auto-tune is an AxeForge feature");
        }
        let rb = self.forge(self.http.post(Self::url(ip, "/api/retune")).body(""), session);
        self.send(rb).await
    }

    /// AxeForge two-factor login. Returns the session token.
    pub async fn login(&self, ip: &str, code: &str) -> Result<String> {
        let rb = self
            .forge(self.http.post(Self::url(ip, "/api/otp")), "")
            .body(json!({"action": "login", "code": code}).to_string());
        let text = self.send(rb).await?;
        let v: Value = serde_json::from_str(&text).unwrap_or(Value::Null);
        match v.get("token").and_then(|t| t.as_str()) {
            Some(t) if !t.is_empty() => Ok(t.to_string()),
            _ => Err(anyhow!(v.get("error").and_then(|e| e.as_str()).unwrap_or("login failed").to_string())),
        }
    }

    pub async fn swarm(&self, ip: &str, session: &str) -> Result<Vec<SwarmPeer>> {
        let v = self.get_json(&self.http, Self::url(ip, "/api/swarm"), Some(session)).await?;
        let mut out = vec![];
        for m in v.get("miners").and_then(|m| m.as_array()).into_iter().flatten() {
            if b(m, "self") == Some(true) {
                continue;
            }
            let ip = s(m, "ip");
            if ip.is_empty() {
                continue;
            }
            let name = if s(m, "worker").is_empty() { s(m, "name") } else { s(m, "worker") };
            out.push(SwarmPeer { ip, name, model: s(m, "model") });
        }
        Ok(out)
    }

    // ---------- pools

    pub async fn pools(&self, ip: &str, kind: &str, session: &str) -> Result<PoolConfig> {
        if kind == AXEFORGE {
            let v = self.get_json(&self.http, Self::url(ip, "/api/pools"), Some(session)).await?;
            let status = self.get_json(&self.http, Self::url(ip, "/api/status"), Some(session)).await.ok();
            let live = status.as_ref().and_then(|s| s.get("pools")).and_then(|p| p.as_array()).cloned();
            let pools = v
                .get("pools")
                .and_then(|p| p.as_array())
                .map(|arr| {
                    arr.iter()
                        .enumerate()
                        .map(|(i, p)| PoolEntry {
                            enabled: b(p, "enabled").unwrap_or(false),
                            url: s(p, "url"),
                            port: f(p, "port").unwrap_or(3333.0) as u32,
                            user: s(p, "user"),
                            pass: String::new(),
                            weight: f(p, "weight").map(|w| w as u32),
                            connected: live.as_ref().and_then(|l| l.get(i)).and_then(|l| b(l, "connected")),
                        })
                        .collect()
                })
                .unwrap_or_default();
            Ok(PoolConfig { pools, mode: s(&v, "mode"), needs_restart: false })
        } else {
            let v = self.get_json(&self.http, Self::url(ip, "/api/system/info"), None).await?;
            let fallback_active = b(&v, "isUsingFallbackStratum").unwrap_or(false);
            let primary = PoolEntry {
                enabled: true,
                url: s(&v, "stratumURL"),
                port: f(&v, "stratumPort").unwrap_or(3333.0) as u32,
                user: s(&v, "stratumUser"),
                pass: String::new(),
                weight: None,
                connected: Some(!fallback_active),
            };
            let fallback = PoolEntry {
                enabled: !s(&v, "fallbackStratumURL").is_empty(),
                url: s(&v, "fallbackStratumURL"),
                port: f(&v, "fallbackStratumPort").unwrap_or(3333.0) as u32,
                user: s(&v, "fallbackStratumUser"),
                pass: String::new(),
                weight: None,
                connected: Some(fallback_active),
            };
            Ok(PoolConfig { pools: vec![primary, fallback], mode: "failover".into(), needs_restart: true })
        }
    }

    pub async fn set_pools(&self, ip: &str, kind: &str, session: &str, cfg: &PoolConfig) -> Result<String> {
        if kind == AXEFORGE {
            // start from what the miner has so fields we do not edit (protocol,
            // SV2 keys) survive the round trip
            let mut cur = self.get_json(&self.http, Self::url(ip, "/api/pools"), Some(session)).await?;
            let arr = cur
                .get_mut("pools")
                .and_then(|p| p.as_array_mut())
                .ok_or_else(|| anyhow!("miner sent no pool list"))?;
            for (i, p) in cfg.pools.iter().enumerate().take(arr.len()) {
                let o = arr[i].as_object_mut().ok_or_else(|| anyhow!("bad pool entry"))?;
                o.insert("enabled".into(), json!(p.enabled));
                o.insert("url".into(), json!(none_if_empty(p.url.clone())));
                o.insert("port".into(), json!(p.port));
                o.insert("user".into(), json!(p.user.trim()));
                if !p.pass.is_empty() {
                    o.insert("pass".into(), json!(p.pass));
                }
                if let Some(w) = p.weight {
                    o.insert("weight".into(), json!(w));
                }
            }
            if !cfg.mode.is_empty() {
                cur["mode"] = json!(cfg.mode);
            }
            let rb = self
                .forge(self.http.post(Self::url(ip, "/api/pools")), session)
                .body(cur.to_string());
            self.send(rb).await
        } else {
            let mut body = Map::new();
            if let Some(p) = cfg.pools.first() {
                body.insert("stratumURL".into(), json!(p.url.trim()));
                body.insert("stratumPort".into(), json!(p.port));
                body.insert("stratumUser".into(), json!(p.user.trim()));
                if !p.pass.is_empty() {
                    body.insert("stratumPassword".into(), json!(p.pass));
                }
            }
            if let Some(p) = cfg.pools.get(1) {
                let url = if p.enabled { p.url.trim().to_string() } else { String::new() };
                body.insert("fallbackStratumURL".into(), json!(url));
                body.insert("fallbackStratumPort".into(), json!(p.port));
                body.insert("fallbackStratumUser".into(), json!(p.user.trim()));
                if !p.pass.is_empty() {
                    body.insert("fallbackStratumPassword".into(), json!(p.pass));
                }
            }
            self.send(self.http.patch(Self::url(ip, "/api/system")).json(&Value::Object(body))).await?;
            Ok("Saved. Restart the miner to switch pools.".into())
        }
    }

    // ---------- tuning

    pub async fn tuning(&self, ip: &str, kind: &str, session: &str) -> Result<Tuning> {
        if kind == AXEFORGE {
            let v = self.get_json(&self.http, Self::url(ip, "/api/settings"), Some(session)).await?;
            let l = v.get("limits").cloned().unwrap_or(Value::Null);
            Ok(Tuning {
                auto_tune: b(&v, "atune"),
                freq: f(&v, "freq"),
                core_mv: f(&v, "mv"),
                fan_target: f(&v, "fantgt"),
                fan_pct: f(&v, "fanmin"),
                fan_auto: None,
                limits: Some(Limits {
                    max_freq: f(&l, "maxFreq"),
                    min_mv: f(&l, "minMv"),
                    max_mv: f(&l, "maxMv"),
                    max_power: f(&l, "maxPower"),
                    chip_ceiling: f(&l, "chipCeil"),
                }),
                needs_restart: false,
            })
        } else {
            let v = self.get_json(&self.http, Self::url(ip, "/api/system/info"), None).await?;
            Ok(Tuning {
                auto_tune: None,
                freq: f(&v, "frequency"),
                core_mv: f(&v, "coreVoltage"),
                fan_target: f(&v, "temptarget"),
                fan_pct: f(&v, "fanspeed").or_else(|| f(&v, "manualFanSpeed")),
                fan_auto: b(&v, "autofanspeed"),
                limits: None,
                needs_restart: true,
            })
        }
    }

    pub async fn set_tuning(&self, ip: &str, kind: &str, session: &str, t: &Tuning) -> Result<String> {
        let mut body = Map::new();
        if kind == AXEFORGE {
            if let Some(x) = t.auto_tune { body.insert("atune".into(), json!(x)); }
            if let Some(x) = t.freq { body.insert("freq".into(), json!(x.round() as i64)); }
            if let Some(x) = t.core_mv { body.insert("mv".into(), json!(x.round() as i64)); }
            if let Some(x) = t.fan_target { body.insert("fantgt".into(), json!(x.round() as i64)); }
            if let Some(x) = t.fan_pct { body.insert("fanmin".into(), json!(x.round() as i64)); }
            let rb = self
                .forge(self.http.post(Self::url(ip, "/api/settings")), session)
                .body(Value::Object(body).to_string());
            self.send(rb).await
        } else {
            if let Some(x) = t.freq { body.insert("frequency".into(), json!(x.round() as i64)); }
            if let Some(x) = t.core_mv { body.insert("coreVoltage".into(), json!(x.round() as i64)); }
            if let Some(x) = t.fan_auto { body.insert("autofanspeed".into(), json!(if x { 1 } else { 0 })); }
            if let Some(x) = t.fan_pct { body.insert("fanspeed".into(), json!(x.round() as i64)); }
            if let Some(x) = t.fan_target { body.insert("temptarget".into(), json!(x.round() as i64)); }
            self.send(self.http.patch(Self::url(ip, "/api/system")).json(&Value::Object(body))).await?;
            Ok("Saved. Restart the miner to apply clock and voltage.".into())
        }
    }
}

impl Default for Client {
    fn default() -> Self {
        Self::new()
    }
}

pub fn parse_axeforge(v: &Value) -> Snapshot {
    let pool = v.get("pool").cloned().unwrap_or(Value::Null);
    let board = s(v, "board");
    // "NerdQaxe++ rev5.1/6 (TPS53647)" -> "NerdQaxe++"
    let model = board.split(" rev").next().unwrap_or(&board).trim().to_string();
    Snapshot {
        kind: AXEFORGE.into(),
        hostname: s(v, "hostname"),
        model,
        asic_model: s(v, "asicModel"),
        asic_count: f(v, "asicCount").map(|x| x as u32),
        version: s(v, "version"),
        status: s(v, "status"),
        fault: s(v, "fault"),
        hashrate: f(v, "hashrate"),
        expected: f(v, "expected"),
        temp: f(v, "chipTemp"),
        vr_temp: if b(v, "vrSensor") == Some(false) { None } else { f(v, "vrTemp") },
        power: f(v, "power"),
        vin: f(v, "vin"),
        freq: f(v, "freq"),
        core_mv: f(v, "coreMv"),
        fan_pct: f(v, "fanPct"),
        fan_rpm: f(v, "fanRpm"),
        uptime: f(v, "uptime"),
        best_diff: f(&pool, "bestDiff"),
        session_best: f(&pool, "sessionBest"),
        accepted: f(&pool, "accepted"),
        rejected: f(&pool, "rejected"),
        pool_host: s(&pool, "host"),
        pool_user: s(v, "worker"),
        pool_connected: b(&pool, "connected"),
        pool_diff: f(&pool, "diff"),
        network_diff: f(&pool, "networkDiff"),
        block_height: f(&pool, "height"),
        blocks: f(&pool, "blocks"),
        rssi: f(v, "rssi"),
        ssid: s(v, "ssid"),
        overclocked: b(v, "overclocked"),
    }
}

pub fn parse_axeos(v: &Value) -> Snapshot {
    let mut model = s(v, "deviceModel");
    if model.is_empty() {
        model = s(v, "boardVersion");
        if !model.is_empty() && model.chars().all(|c| c.is_ascii_digit()) {
            model = format!("Bitaxe {model}");
        }
    }
    if model.is_empty() {
        model = "AxeOS miner".into();
    }
    let fallback = b(v, "isUsingFallbackStratum").unwrap_or(false);
    let (host, user) = if fallback {
        (s(v, "fallbackStratumURL"), s(v, "fallbackStratumUser"))
    } else {
        (s(v, "stratumURL"), s(v, "stratumUser"))
    };
    let mut temp = f(v, "temp");
    if temp == Some(-1.0) {
        temp = None;
    }
    let mut vr = f(v, "vrTemp");
    if vr == Some(0.0) || vr == Some(-1.0) {
        vr = None;
    }
    Snapshot {
        kind: AXEOS.into(),
        hostname: s(v, "hostname"),
        model,
        asic_model: s(v, "ASICModel"),
        asic_count: f(v, "asicCount").map(|x| x as u32),
        version: s(v, "version"),
        status: "mining".into(),
        fault: if b(v, "overheat_mode") == Some(true) { "overheat".into() } else { String::new() },
        hashrate: f(v, "hashRate"),
        expected: f(v, "expectedHashrate"),
        temp,
        vr_temp: vr,
        power: f(v, "power"),
        vin: f(v, "voltage").map(|mv| if mv > 100.0 { mv / 1000.0 } else { mv }),
        freq: f(v, "frequency"),
        core_mv: f(v, "coreVoltageActual").or_else(|| f(v, "coreVoltage")),
        fan_pct: f(v, "fanspeed"),
        fan_rpm: f(v, "fanrpm"),
        uptime: f(v, "uptimeSeconds"),
        best_diff: f(v, "bestDiff"),
        session_best: f(v, "bestSessionDiff"),
        accepted: f(v, "sharesAccepted"),
        rejected: f(v, "sharesRejected"),
        pool_host: host,
        pool_user: user,
        pool_connected: None,
        pool_diff: f(v, "poolDifficulty").or_else(|| f(v, "stratumDiff")),
        network_diff: f(v, "networkDifficulty"),
        block_height: f(v, "blockHeight"),
        blocks: f(v, "blockFound"),
        rssi: f(v, "wifiRSSI"),
        ssid: s(v, "ssid"),
        overclocked: None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn si() {
        assert_eq!(parse_si("4.5G"), Some(4.5e9));
        assert_eq!(parse_si("512k"), Some(512e3));
        assert_eq!(parse_si("12"), Some(12.0));
        assert_eq!(parse_si(""), None);
    }

    #[test]
    fn axeforge_status() {
        let v: Value = serde_json::from_str(
            r#"{"status":"mining","hashrate":5655.0,"expected":5728.3,"chipTemp":43.8,"vrTemp":57.8,"vrSensor":true,
            "board":"NerdQaxe++ rev5.1/6 (TPS53647)","asicModel":"BM1370","asicCount":4,"power":95.2,"freq":684,"coreMv":1150,
            "fanPct":100,"fanRpm":2651,"uptime":80145,"hostname":"axeforge-32ec","version":"1.4.6",
            "pool":{"connected":true,"host":"public-pool.io","diff":32768,"accepted":3276,"rejected":4,"bestDiff":1358463938.1,"height":975098,"blocks":0},
            "pools":[]}"#,
        )
        .unwrap();
        let s = parse_axeforge(&v);
        assert_eq!(s.model, "NerdQaxe++");
        assert_eq!(s.temp, Some(43.8));
        assert_eq!(s.pool_host, "public-pool.io");
        assert_eq!(s.accepted, Some(3276.0));
    }

    #[test]
    fn axeos_info() {
        let v: Value = serde_json::from_str(
            r#"{"hashRate":1023.4,"temp":55.2,"vrTemp":0,"power":15.1,"voltage":5100,"frequency":525,"coreVoltage":1150,
            "bestDiff":"2.31G","sharesAccepted":10,"sharesRejected":1,"uptimeSeconds":100,"ASICModel":"BM1366",
            "boardVersion":"204","hostname":"bitaxe","stratumURL":"pool.example","stratumPort":3333,"stratumUser":"bc1q.w"}"#,
        )
        .unwrap();
        let s = parse_axeos(&v);
        assert_eq!(s.model, "Bitaxe 204");
        assert_eq!(s.best_diff, Some(2.31e9));
        assert_eq!(s.vin, Some(5.1));
        assert_eq!(s.vr_temp, None);
    }
}
