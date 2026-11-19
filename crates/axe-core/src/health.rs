//! Health check: looks at what a miner reports and how it has behaved
//! lately, and turns that into a short list of problems with a score.

use serde::Serialize;

use crate::firmware::Update;
use crate::miner::Snapshot;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Level {
    Info,
    Warn,
    Bad,
}

#[derive(Debug, Clone, Serialize)]
pub struct Issue {
    pub code: &'static str,
    pub level: Level,
    pub title: String,
    pub detail: String,
}

/// What the checks get to look at besides the live snapshot.
#[derive(Debug, Clone, Default)]
pub struct Context {
    pub online: bool,
    pub needs_login: bool,
    /// average hashrate over the last 30 minutes, GH/s
    pub recent_hashrate: Option<f64>,
    /// reboots in the last 24 h that nobody asked for
    pub reboots_24h: i64,
    pub alert_temp: f64,
    pub update: Option<Update>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Report {
    pub score: u32,
    pub level: Level,
    pub issues: Vec<Issue>,
}

fn issue(code: &'static str, level: Level, title: impl Into<String>, detail: impl Into<String>) -> Issue {
    Issue { code, level, title: title.into(), detail: detail.into() }
}

pub fn check(snap: Option<&Snapshot>, cx: &Context) -> Report {
    let mut out = vec![];
    if cx.needs_login {
        out.push(issue("login", Level::Warn, "Login needed", "Two-factor login is on. Log in from the miner page so AxeMobile can read it."));
    } else if !cx.online {
        out.push(issue("offline", Level::Bad, "Offline", "The miner isn't answering. Check power, Wi-Fi and its IP address."));
    }
    if let Some(s) = snap.filter(|_| cx.online) {
        checks(s, cx, &mut out);
    }
    if cx.reboots_24h >= 2 {
        let lvl = if cx.reboots_24h >= 5 { Level::Bad } else { Level::Warn };
        out.push(issue(
            "reboots",
            lvl,
            format!("Rebooted {} times today", cx.reboots_24h),
            "Restarts nobody asked for in the last 24 hours. Usually power (PSU, cable), heat or an unstable overclock.",
        ));
    }
    if let Some(u) = &cx.update {
        out.push(issue("firmware", Level::Info, format!("Firmware {} is out", u.latest), format!("Running {}. Update from the miner's own web page.", u.current)));
    }
    out.sort_by_key(|i| std::cmp::Reverse(i.level));
    let bad = out.iter().filter(|i| i.level == Level::Bad).count() as u32;
    let warn = out.iter().filter(|i| i.level == Level::Warn).count() as u32;
    let score = 100u32.saturating_sub(bad * 30 + warn * 10);
    let level = out.first().map(|i| i.level).filter(|l| *l != Level::Info).unwrap_or(Level::Info);
    Report { score, level, issues: out }
}

fn checks(s: &Snapshot, cx: &Context, out: &mut Vec<Issue>) {
    if !s.fault.is_empty() {
        out.push(issue("fault", Level::Bad, "Fault reported", format!("The miner says: {}", s.fault)));
    }
    if s.pool_connected == Some(false) {
        out.push(issue("pool", Level::Bad, "Not connected to a pool", "It's powered but has no pool. Check the pool address and the network."));
    }

    // hashrate against what the chips should do, averaged so one slow poll
    // doesn't count
    let hr = cx.recent_hashrate.or(s.hashrate);
    if let (Some(h), Some(e)) = (hr, s.expected) {
        if e > 0.0 && h > 0.0 {
            let pct = h / e * 100.0;
            if pct < 85.0 {
                let lvl = if pct < 60.0 { Level::Bad } else { Level::Warn };
                out.push(issue(
                    "hashrate",
                    lvl,
                    format!("Hashrate at {pct:.0}% of expected"),
                    "Averaged over 30 minutes. Often a chip running too hot, too little core voltage, or a bad pool connection.",
                ));
            }
        }
    }

    let acc = s.accepted.unwrap_or(0.0);
    let rej = s.rejected.unwrap_or(0.0);
    if acc + rej >= 100.0 {
        let pct = rej / (acc + rej) * 100.0;
        if pct >= 1.0 {
            let lvl = if pct >= 3.0 { Level::Bad } else { Level::Warn };
            out.push(issue(
                "rejects",
                lvl,
                format!("{pct:.1}% of shares rejected"),
                "Above 1% usually means a slow or far-away pool, or an unstable clock.",
            ));
        }
    }

    if let Some(t) = s.temp {
        let limit = if cx.alert_temp > 0.0 { cx.alert_temp } else { 70.0 };
        if t >= limit {
            out.push(issue("temp", Level::Bad, format!("Chip at {t:.0}°C"), format!("Over your {limit:.0}°C alert. Improve airflow or lower the clock.")));
        } else if t >= limit - 5.0 {
            out.push(issue("temp", Level::Warn, format!("Chip at {t:.0}°C"), format!("Close to your {limit:.0}°C alert.")));
        }
        if s.fan_pct.is_some_and(|f| f >= 99.0) && t >= limit - 8.0 {
            out.push(issue("fan", Level::Warn, "Fan maxed out", "The fan is at 100% and the chip is still warm, so there's no cooling left in reserve."));
        }
    }
    if let Some(v) = s.vr_temp {
        if v >= 80.0 {
            let lvl = if v >= 95.0 { Level::Bad } else { Level::Warn };
            out.push(issue("vr", lvl, format!("Voltage regulator at {v:.0}°C"), "The regulator runs hot. A heatsink or more airflow over it helps; past 100°C most boards throttle."));
        }
    }

    if let Some(v) = s.vin {
        // boards run from 5 V (Bitaxe, NerdAxe) or 12 V (NerdQaxe and up)
        let nominal = if v > 8.0 { 12.0 } else { 5.0 };
        let drop = (nominal - v) / nominal * 100.0;
        if v > 1.0 && drop >= 4.0 {
            let lvl = if drop >= 7.0 { Level::Bad } else { Level::Warn };
            out.push(issue(
                "vin",
                lvl,
                format!("Input voltage low: {v:.2} V"),
                format!("{drop:.0}% under {nominal:.0} V. A weak power supply or a thin cable; it can cause reboots."),
            ));
        }
    }

    if let Some(r) = s.rssi {
        if r <= -75.0 {
            let lvl = if r <= -85.0 { Level::Bad } else { Level::Warn };
            out.push(issue("wifi", lvl, format!("Weak Wi-Fi ({r:.0} dBm)"), "Can drop shares and connections. Move it closer to the router or add an access point."));
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn snap() -> Snapshot {
        Snapshot {
            hashrate: Some(1000.0),
            expected: Some(1000.0),
            temp: Some(55.0),
            vin: Some(5.1),
            rssi: Some(-50.0),
            accepted: Some(1000.0),
            rejected: Some(2.0),
            pool_connected: Some(true),
            ..Default::default()
        }
    }

    fn cx() -> Context {
        Context { online: true, alert_temp: 70.0, ..Default::default() }
    }

    #[test]
    fn healthy() {
        let r = check(Some(&snap()), &cx());
        assert!(r.issues.is_empty(), "{:?}", r.issues);
        assert_eq!(r.score, 100);
    }

    #[test]
    fn problems() {
        let mut s = snap();
        s.vin = Some(4.6);
        s.rssi = Some(-80.0);
        s.temp = Some(72.0);
        s.rejected = Some(40.0);
        let mut c = cx();
        c.recent_hashrate = Some(700.0);
        c.reboots_24h = 3;
        let r = check(Some(&s), &c);
        let codes: Vec<_> = r.issues.iter().map(|i| i.code).collect();
        for want in ["vin", "wifi", "temp", "rejects", "hashrate", "reboots"] {
            assert!(codes.contains(&want), "missing {want}: {codes:?}");
        }
        assert_eq!(r.level, Level::Bad);
        assert!(r.score < 50);
    }

    #[test]
    fn offline_skips_live_checks() {
        let mut s = snap();
        s.temp = Some(90.0);
        let c = Context { online: false, alert_temp: 70.0, ..Default::default() };
        let r = check(Some(&s), &c);
        assert_eq!(r.issues.len(), 1);
        assert_eq!(r.issues[0].code, "offline");
    }

    #[test]
    fn twelve_volt_boards() {
        let mut s = snap();
        s.vin = Some(11.98);
        assert!(check(Some(&s), &cx()).issues.is_empty());
        s.vin = Some(11.2);
        assert_eq!(check(Some(&s), &cx()).issues[0].code, "vin");
    }
}
