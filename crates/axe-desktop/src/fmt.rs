//! Number formatting shared by every page.

pub fn num(v: Option<f64>, d: usize) -> String {
    match v {
        Some(x) if x.is_finite() => format!("{x:.d$}"),
        _ => "–".into(),
    }
}

/// GH/s in, best unit out.
pub fn hash(ghs: Option<f64>) -> (String, &'static str) {
    match ghs {
        Some(g) if g.is_finite() => {
            if g >= 1e6 {
                (format!("{:.2}", g / 1e6), "PH/s")
            } else if g >= 1000.0 {
                (format!("{:.2}", g / 1000.0), "TH/s")
            } else if g >= 100.0 {
                (format!("{g:.0}"), "GH/s")
            } else {
                (format!("{g:.1}"), "GH/s")
            }
        }
        _ => ("–".into(), "GH/s"),
    }
}

pub fn hash_str(ghs: Option<f64>) -> String {
    let (v, u) = hash(ghs);
    format!("{v} {u}")
}

pub fn diff(d: f64) -> String {
    if !d.is_finite() || d <= 0.0 {
        return "–".into();
    }
    const U: [&str; 7] = ["", "K", "M", "G", "T", "P", "E"];
    let mut v = d;
    let mut i = 0;
    while v >= 1000.0 && i < U.len() - 1 {
        v /= 1000.0;
        i += 1;
    }
    if v >= 100.0 {
        format!("{v:.0}{}", U[i])
    } else {
        format!("{v:.2}{}", U[i])
    }
}

pub fn uptime(s: Option<f64>) -> String {
    let Some(s) = s else { return "–".into() };
    let s = s as i64;
    let (d, h, m) = (s / 86400, (s % 86400) / 3600, (s % 3600) / 60);
    if d > 0 {
        format!("{d}d {h}h")
    } else if h > 0 {
        format!("{h}h {m}m")
    } else {
        format!("{m}m")
    }
}

pub fn ago(ts: i64) -> String {
    let s = (axe_core::db::now() - ts).max(0);
    if s < 60 {
        "just now".into()
    } else if s < 3600 {
        format!("{} min ago", s / 60)
    } else if s < 86400 {
        format!("{} h ago", s / 3600)
    } else {
        format!("{} d ago", s / 86400)
    }
}

pub fn clock(ts: i64, with_date: bool) -> String {
    // local wall-clock time from the offset measured once at start-up
    let t = ts + local_offset();
    let secs = t.rem_euclid(86400);
    let (h, m) = (secs / 3600, (secs % 3600) / 60);
    if with_date {
        let days = t.div_euclid(86400);
        let (y, mo, d) = civil(days);
        let _ = y;
        format!("{} {d}, {h:02}:{m:02}", MONTHS[(mo - 1) as usize])
    } else {
        format!("{h:02}:{m:02}")
    }
}

pub fn date(ts: i64) -> String {
    let days = (ts + local_offset()).div_euclid(86400);
    let (y, mo, d) = civil(days);
    format!("{} {d}, {y}", MONTHS[(mo - 1) as usize])
}

const MONTHS: [&str; 12] = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

fn civil(z: i64) -> (i64, i64, i64) {
    let z = z + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z - era * 146_097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146_096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    (if m <= 2 { y + 1 } else { y }, m, d)
}

/// Local UTC offset in seconds, read once from Windows.
pub fn local_offset() -> i64 {
    use std::sync::OnceLock;
    static OFF: OnceLock<i64> = OnceLock::new();
    *OFF.get_or_init(crate::sys::utc_offset_secs)
}
