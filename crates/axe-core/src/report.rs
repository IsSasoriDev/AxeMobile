//! Daily report: what the fleet did each day (hashrate, energy, cost,
//! shares, uptime, reboots) and the same per miner over the whole period.

use std::collections::HashMap;

use serde::Serialize;

use crate::db::{self, DayRow};
use crate::Engine;

#[derive(Debug, Clone, Default, Serialize)]
pub struct Day {
    /// days since 1970-01-01 in the caller's time zone
    pub day: i64,
    pub date: String,
    /// average GH/s over the day, counting offline time as zero
    pub hashrate: f64,
    pub energy_kwh: f64,
    pub cost: Option<f64>,
    pub accepted: f64,
    pub rejected: f64,
    /// 0..1, None when AxeMobile wasn't running that day
    pub availability: Option<f64>,
    pub reboots: i64,
    /// best share record set that day, if any
    pub record: Option<f64>,
}

#[derive(Debug, Clone, Default, Serialize)]
pub struct MinerTotal {
    pub id: i64,
    pub name: String,
    pub model: String,
    pub hashrate: f64,
    pub energy_kwh: f64,
    pub cost: Option<f64>,
    /// J/TH while it was running
    pub efficiency: Option<f64>,
    pub accepted: f64,
    pub rejected: f64,
    pub reject_pct: Option<f64>,
    pub availability: Option<f64>,
    pub reboots: i64,
    pub record: Option<f64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Report {
    pub days: Vec<Day>,
    pub miners: Vec<MinerTotal>,
    pub total: MinerTotal,
    pub currency: String,
    pub price: f64,
    /// how many days the report covers
    pub span: i64,
}

/// Days since 1970-01-01 -> "YYYY-MM-DD" (proleptic Gregorian).
pub fn date(day: i64) -> String {
    let z = day + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

/// Share of reads the miner answered that day.
fn up(r: &DayRow) -> f64 {
    let all = r.polls + r.misses;
    if all > 0 { r.polls as f64 / all as f64 } else { 0.0 }
}

fn opt_max(a: Option<f64>, b: Option<f64>) -> Option<f64> {
    match (a, b) {
        (Some(x), Some(y)) => Some(x.max(y)),
        (x, None) => x,
        (None, y) => y,
    }
}

/// `span` days ending today; `offset` is the caller's UTC offset in seconds.
pub fn build(e: &Engine, span: i64, offset: i64, only: Option<i64>) -> anyhow::Result<Report> {
    let span = span.clamp(1, 400);
    let today = (db::now() + offset).div_euclid(86_400);
    let first = today - span + 1;
    let since = first * 86_400 - offset;
    let price: f64 = e.setting("energy_price").parse().unwrap_or(0.0);
    let cost = |kwh: f64| (price > 0.0).then_some(kwh * price);

    let all = e.db.miners()?;
    let miners: Vec<_> = all.iter().filter(|m| only.is_none_or(|id| m.id == id)).collect();
    let rows = e.db.days(only, since, offset)?;
    let reboots = e.db.reboot_days(since, offset)?;
    let records = e.db.record_days(since, offset)?;

    let by: HashMap<(i64, i64), &DayRow> = rows.iter().map(|r| ((r.miner_id, r.day), r)).collect();

    let mut days = vec![];
    for d in first..=today {
        let mut day = Day { day: d, date: date(d), ..Default::default() };
        let (mut ok, mut want) = (0i64, 0i64);
        for m in &miners {
            day.reboots += reboots.get(&(m.id, d)).copied().unwrap_or(0);
            day.record = opt_max(day.record, records.get(&(m.id, d)).copied());
            let Some(row) = by.get(&(m.id, d)) else { continue };
            ok += row.polls;
            want += row.polls + row.misses;
            day.hashrate += row.hashrate.unwrap_or(0.0) * up(row);
            day.energy_kwh += row.energy_wh / 1000.0;
            day.accepted += row.accepted;
            day.rejected += row.rejected;
        }
        day.availability = (want > 0).then(|| (ok as f64 / want as f64).min(1.0));
        day.cost = cost(day.energy_kwh);
        days.push(day);
    }

    let mut totals = vec![];
    for m in &miners {
        let mut t = MinerTotal {
            id: m.id,
            name: if m.name.is_empty() { m.ip.clone() } else { m.name.clone() },
            model: m.model.clone(),
            ..Default::default()
        };
        let (mut hr_x_polls, mut polls, mut want, mut hours, mut hr_x_hours) = (0.0, 0i64, 0i64, 0i64, 0.0);
        for d in first..=today {
            t.reboots += reboots.get(&(m.id, d)).copied().unwrap_or(0);
            t.record = opt_max(t.record, records.get(&(m.id, d)).copied());
            if let Some(row) = by.get(&(m.id, d)) {
                let h = row.hashrate.unwrap_or(0.0);
                hr_x_polls += h * row.polls as f64;
                polls += row.polls;
                want += row.polls + row.misses;
                hours += row.hours;
                hr_x_hours += h * row.hours as f64;
                t.energy_kwh += row.energy_wh / 1000.0;
                t.accepted += row.accepted;
                t.rejected += row.rejected;
            }
        }
        if want > 0 {
            t.hashrate = hr_x_polls / want as f64;
            t.availability = Some((polls as f64 / want as f64).min(1.0));
        }
        if hours > 0 && hr_x_hours > 0.0 {
            // average watts while running over average TH/s while running
            t.efficiency = Some((t.energy_kwh * 1000.0 / hours as f64) / (hr_x_hours / hours as f64 / 1000.0));
        }
        let shares = t.accepted + t.rejected;
        t.reject_pct = (shares > 0.0).then(|| t.rejected / shares * 100.0);
        t.cost = cost(t.energy_kwh);
        totals.push(t);
    }

    let mut total = MinerTotal { name: "Fleet".into(), ..Default::default() };
    let (mut w_hr, mut avail_n, mut avail_sum) = (0.0, 0, 0.0);
    for t in &totals {
        total.hashrate += t.hashrate;
        total.energy_kwh += t.energy_kwh;
        total.accepted += t.accepted;
        total.rejected += t.rejected;
        total.reboots += t.reboots;
        total.record = opt_max(total.record, t.record);
        if let (Some(e), true) = (t.efficiency, t.hashrate > 0.0) {
            w_hr += t.hashrate;
            total.efficiency = Some(total.efficiency.unwrap_or(0.0) + e * t.hashrate);
        }
        if let Some(a) = t.availability {
            avail_n += 1;
            avail_sum += a;
        }
    }
    total.efficiency = total.efficiency.map(|x| x / w_hr);
    total.availability = (avail_n > 0).then(|| avail_sum / avail_n as f64);
    let shares = total.accepted + total.rejected;
    total.reject_pct = (shares > 0.0).then(|| total.rejected / shares * 100.0);
    total.cost = cost(total.energy_kwh);

    Ok(Report { days, miners: totals, total, currency: e.setting("currency"), price, span })
}

/// One row per miner per day, plus a fleet row per day.
pub fn csv(r: &Report, e: &Engine, offset: i64, only: Option<i64>) -> anyhow::Result<String> {
    let f = |v: f64| format!("{v:.2}");
    let o = |v: Option<f64>| v.map(|x| format!("{x:.2}")).unwrap_or_default();
    let mut out = String::from("date,miner,avg_hashrate_ghs,energy_kwh,cost,accepted,rejected,availability_pct,reboots\n");
    let first = r.days.first().map(|d| d.day).unwrap_or(0);
    let since = first * 86_400 - offset;
    let rows = e.db.days(only, since, offset)?;
    let reboots = e.db.reboot_days(since, offset)?;
    for d in &r.days {
        for m in &r.miners {
            let Some(row) = rows.iter().find(|x| x.miner_id == m.id && x.day == d.day) else { continue };
            let avail = (row.polls + row.misses > 0).then(|| up(row) * 100.0);
            let hr = row.hashrate.unwrap_or(0.0) * up(row);
            out.push_str(&format!(
                "{},{},{},{},{},{},{},{},{}\n",
                d.date,
                m.name.replace(',', " "),
                f(hr),
                f(row.energy_wh / 1000.0),
                o((r.price > 0.0).then_some(row.energy_wh / 1000.0 * r.price)),
                row.accepted.round(),
                row.rejected.round(),
                o(avail),
                reboots.get(&(m.id, d.day)).copied().unwrap_or(0)
            ));
        }
        if only.is_none() {
            out.push_str(&format!(
                "{},Fleet,{},{},{},{},{},{},{}\n",
                d.date,
                f(d.hashrate),
                f(d.energy_kwh),
                o(d.cost),
                d.accepted.round(),
                d.rejected.round(),
                o(d.availability.map(|a| a * 100.0)),
                d.reboots
            ));
        }
    }
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dates() {
        assert_eq!(date(0), "1970-01-01");
        assert_eq!(date(19_723), "2024-01-01");
        assert_eq!(date(20_411), "2025-11-19");
        assert_eq!(date(11_016), "2000-02-29");
    }

    #[test]
    fn report_counts_offline_as_zero() {
        let e = Engine::new(db::Db::memory().unwrap(), None);
        let a = e.db.add_miner("10.0.0.2", "a", "axeos", "Bitaxe").unwrap();
        e.db.set_setting("energy_price", "0.5").unwrap();
        let t0 = db::now() / 3600 * 3600;
        // 4 reads, the miner answered 2 of them
        e.db.add_miss(a, t0 + 2).unwrap();
        e.db.add_miss(a, t0 + 3).unwrap();
        for i in 0..2 {
            let s = db::Sample { hashrate: Some(1000.0), power: Some(20.0), acc: 10.0, rej: 1.0, ..Default::default() };
            e.db.add_sample(a, t0 + i, &s).unwrap();
        }
        e.db.add_reboot(a, t0, false).unwrap();
        let r = build(&e, 7, 0, None).unwrap();
        assert_eq!(r.days.len(), 7);
        let today = r.days.last().unwrap();
        assert!((today.hashrate - 500.0).abs() < 1e-6, "{}", today.hashrate);
        assert_eq!(today.accepted, 20.0);
        assert_eq!(today.reboots, 1);
        assert!((today.availability.unwrap() - 0.5).abs() < 1e-9);
        let m = &r.miners[0];
        assert!((m.reject_pct.unwrap() - 2.0 / 22.0 * 100.0).abs() < 1e-6);
        // 20 W for one hour of readings
        assert!((m.energy_kwh - 0.02).abs() < 1e-9);
        assert!((m.efficiency.unwrap() - 20.0).abs() < 1e-6);
        assert!((m.cost.unwrap() - 0.01).abs() < 1e-9);
        let c = csv(&r, &e, 0, None).unwrap();
        assert!(c.lines().count() >= 3, "{c}");
        assert!(c.contains(",Fleet,"));
    }
}
