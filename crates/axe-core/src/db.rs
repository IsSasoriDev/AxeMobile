//! Local SQLite store. One file holds the miner list, the sample history
//! (raw points for two days, hourly averages for a year), the activity log
//! and the app settings.

use std::collections::HashMap;
use std::path::Path;
use std::sync::Mutex;

use anyhow::Result;
use rusqlite::{params, Connection, OptionalExtension};
use serde::{Deserialize, Serialize};

const SCHEMA: &str = r#"
CREATE TABLE IF NOT EXISTS miners(
  id        INTEGER PRIMARY KEY,
  ip        TEXT NOT NULL UNIQUE,
  name      TEXT NOT NULL DEFAULT '',
  kind      TEXT NOT NULL,
  model     TEXT NOT NULL DEFAULT '',
  session   TEXT NOT NULL DEFAULT '',
  best_diff REAL NOT NULL DEFAULT 0,
  blocks    INTEGER NOT NULL DEFAULT 0,
  added_at  INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS samples(
  miner_id INTEGER NOT NULL,
  ts       INTEGER NOT NULL,
  hashrate REAL,
  temp     REAL,
  vr_temp  REAL,
  power    REAL,
  fan_rpm  REAL,
  PRIMARY KEY(miner_id, ts)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS hourly(
  miner_id INTEGER NOT NULL,
  ts       INTEGER NOT NULL,
  hashrate REAL,
  temp     REAL,
  power    REAL,
  n        INTEGER NOT NULL,
  PRIMARY KEY(miner_id, ts)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS events(
  id       INTEGER PRIMARY KEY,
  miner_id INTEGER,
  ts       INTEGER NOT NULL,
  kind     TEXT NOT NULL,
  message  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_ts ON events(ts);
CREATE TABLE IF NOT EXISTS best_shares(
  miner_id INTEGER NOT NULL,
  ts       INTEGER NOT NULL,
  diff     REAL NOT NULL,
  PRIMARY KEY(miner_id, ts)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS settings(
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"#;

pub const RAW_KEEP_SECS: i64 = 2 * 86_400;
pub const HOURLY_KEEP_SECS: i64 = 400 * 86_400;
pub const EVENTS_KEEP: i64 = 2_000;

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct MinerRow {
    pub id: i64,
    pub ip: String,
    pub name: String,
    pub kind: String,
    pub model: String,
    #[serde(skip_serializing)]
    pub session: String,
    pub best_diff: f64,
    pub blocks: i64,
    pub added_at: i64,
}

#[derive(Debug, Clone, Serialize)]
pub struct Event {
    pub id: i64,
    pub miner_id: Option<i64>,
    pub ts: i64,
    pub kind: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Point {
    pub t: i64,
    pub hashrate: Option<f64>,
    pub temp: Option<f64>,
    pub power: Option<f64>,
}

#[derive(Debug, Clone, Default)]
pub struct Sample {
    pub hashrate: Option<f64>,
    pub temp: Option<f64>,
    pub vr_temp: Option<f64>,
    pub power: Option<f64>,
    pub fan_rpm: Option<f64>,
}

pub struct Db {
    conn: Mutex<Connection>,
}

pub fn now() -> i64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

fn miner_from(r: &rusqlite::Row) -> rusqlite::Result<MinerRow> {
    Ok(MinerRow {
        id: r.get(0)?,
        ip: r.get(1)?,
        name: r.get(2)?,
        kind: r.get(3)?,
        model: r.get(4)?,
        session: r.get(5)?,
        best_diff: r.get(6)?,
        blocks: r.get(7)?,
        added_at: r.get(8)?,
    })
}

const MINER_COLS: &str = "id, ip, name, kind, model, session, best_diff, blocks, added_at";

impl Db {
    pub fn open(path: &Path) -> Result<Self> {
        if let Some(dir) = path.parent() {
            std::fs::create_dir_all(dir)?;
        }
        let conn = Connection::open(path)?;
        conn.execute_batch("PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA foreign_keys=ON;")?;
        conn.execute_batch(SCHEMA)?;
        // older databases had no share history: seed it with each miner's best
        conn.execute_batch(
            "INSERT OR IGNORE INTO best_shares SELECT id, added_at, best_diff FROM miners
             WHERE best_diff > 0 AND id NOT IN (SELECT miner_id FROM best_shares);
             PRAGMA user_version=2;",
        )?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    pub fn memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        conn.execute_batch(SCHEMA)?;
        Ok(Self { conn: Mutex::new(conn) })
    }

    fn c(&self) -> std::sync::MutexGuard<'_, Connection> {
        self.conn.lock().unwrap_or_else(|p| p.into_inner())
    }

    // ---------- miners

    pub fn miners(&self) -> Result<Vec<MinerRow>> {
        let c = self.c();
        let mut st = c.prepare(&format!("SELECT {MINER_COLS} FROM miners ORDER BY added_at, id"))?;
        let rows = st.query_map([], miner_from)?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn miner(&self, id: i64) -> Result<Option<MinerRow>> {
        let c = self.c();
        Ok(c.query_row(&format!("SELECT {MINER_COLS} FROM miners WHERE id=?"), [id], miner_from)
            .optional()?)
    }

    pub fn miner_by_ip(&self, ip: &str) -> Result<Option<MinerRow>> {
        let c = self.c();
        Ok(c.query_row(&format!("SELECT {MINER_COLS} FROM miners WHERE ip=?"), [ip], miner_from)
            .optional()?)
    }

    pub fn add_miner(&self, ip: &str, name: &str, kind: &str, model: &str) -> Result<i64> {
        let c = self.c();
        c.execute(
            "INSERT INTO miners(ip, name, kind, model, added_at) VALUES(?,?,?,?,?)",
            params![ip, name, kind, model, now()],
        )?;
        Ok(c.last_insert_rowid())
    }

    pub fn rename_miner(&self, id: i64, name: &str) -> Result<()> {
        self.c().execute("UPDATE miners SET name=? WHERE id=?", params![name, id])?;
        Ok(())
    }

    pub fn set_identity(&self, id: i64, kind: &str, model: &str) -> Result<()> {
        self.c()
            .execute("UPDATE miners SET kind=?, model=? WHERE id=?", params![kind, model, id])?;
        Ok(())
    }

    pub fn set_session(&self, id: i64, session: &str) -> Result<()> {
        self.c().execute("UPDATE miners SET session=? WHERE id=?", params![session, id])?;
        Ok(())
    }

    pub fn set_records(&self, id: i64, best_diff: f64, blocks: i64) -> Result<()> {
        self.c().execute(
            "UPDATE miners SET best_diff=?, blocks=? WHERE id=?",
            params![best_diff, blocks, id],
        )?;
        Ok(())
    }

    pub fn delete_miner(&self, id: i64) -> Result<()> {
        let c = self.c();
        c.execute("DELETE FROM samples WHERE miner_id=?", [id])?;
        c.execute("DELETE FROM hourly WHERE miner_id=?", [id])?;
        c.execute("DELETE FROM events WHERE miner_id=?", [id])?;
        c.execute("DELETE FROM best_shares WHERE miner_id=?", [id])?;
        c.execute("DELETE FROM miners WHERE id=?", [id])?;
        Ok(())
    }

    // ---------- samples

    pub fn add_sample(&self, miner_id: i64, ts: i64, s: &Sample) -> Result<()> {
        let c = self.c();
        c.execute(
            "INSERT OR REPLACE INTO samples VALUES(?,?,?,?,?,?,?)",
            params![miner_id, ts, s.hashrate, s.temp, s.vr_temp, s.power, s.fan_rpm],
        )?;
        let hour = ts / 3600 * 3600;
        c.execute(
            "INSERT INTO hourly(miner_id, ts, hashrate, temp, power, n) VALUES(?,?,?,?,?,1)
             ON CONFLICT(miner_id, ts) DO UPDATE SET
               hashrate = (COALESCE(hashrate,0)*n + COALESCE(excluded.hashrate,0))/(n+1),
               temp     = (COALESCE(temp,0)*n + COALESCE(excluded.temp,0))/(n+1),
               power    = (COALESCE(power,0)*n + COALESCE(excluded.power,0))/(n+1),
               n        = n+1",
            params![miner_id, hour, s.hashrate, s.temp, s.power],
        )?;
        Ok(())
    }

    /// Averaged history for one miner, or for the whole fleet when `miner_id`
    /// is None (hashrate and power summed across miners, temperature averaged).
    pub fn history(&self, miner_id: Option<i64>, since: i64, bucket: i64) -> Result<Vec<Point>> {
        let table = if now() - since > RAW_KEEP_SECS - 3600 { "hourly" } else { "samples" };
        let bucket = if table == "hourly" { bucket.max(3600) } else { bucket.max(1) };
        let c = self.c();
        let sql = format!(
            "SELECT t, SUM(h), AVG(tp), SUM(p) FROM (
               SELECT miner_id, (ts/{bucket})*{bucket} AS t, AVG(hashrate) h, AVG(temp) tp, AVG(power) p
               FROM {table} WHERE ts >= ?1 AND (?2 IS NULL OR miner_id = ?2)
               GROUP BY miner_id, t)
             GROUP BY t ORDER BY t"
        );
        let mut st = c.prepare(&sql)?;
        let rows = st
            .query_map(params![since, miner_id], |r| {
                Ok(Point { t: r.get(0)?, hashrate: r.get(1)?, temp: r.get(2)?, power: r.get(3)? })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Summary of one miner since `since`: (samples, avg hashrate, peak hashrate, avg temp, max temp).
    pub fn summary(&self, miner_id: i64, since: i64) -> Result<(i64, Option<f64>, Option<f64>, Option<f64>, Option<f64>)> {
        let c = self.c();
        Ok(c.query_row(
            "SELECT COUNT(*), AVG(hashrate), MAX(hashrate), AVG(temp), MAX(temp) FROM samples WHERE miner_id=? AND ts>=?",
            params![miner_id, since],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?, r.get(3)?, r.get(4)?)),
        )?)
    }

    /// How many poll rounds wrote anything since `since`. Every miner read in
    /// one round shares the round's timestamp, so this counts the times
    /// AxeMobile was actually running and polling.
    pub fn poll_rounds(&self, since: i64) -> Result<i64> {
        let c = self.c();
        Ok(c.query_row("SELECT COUNT(DISTINCT ts) FROM samples WHERE ts>=?", [since], |r| r.get(0))?)
    }

    pub fn prune(&self) -> Result<()> {
        let n = now();
        let c = self.c();
        c.execute("DELETE FROM samples WHERE ts < ?", [n - RAW_KEEP_SECS])?;
        c.execute("DELETE FROM hourly WHERE ts < ?", [n - HOURLY_KEEP_SECS])?;
        c.execute(
            "DELETE FROM events WHERE id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET ?)",
            [EVENTS_KEEP],
        )?;
        Ok(())
    }

    // ---------- events

    pub fn add_event(&self, miner_id: Option<i64>, kind: &str, message: &str) -> Result<()> {
        self.c().execute(
            "INSERT INTO events(miner_id, ts, kind, message) VALUES(?,?,?,?)",
            params![miner_id, now(), kind, message],
        )?;
        Ok(())
    }

    pub fn events(&self, miner_id: Option<i64>, limit: i64) -> Result<Vec<Event>> {
        let c = self.c();
        let mut st = c.prepare(
            "SELECT id, miner_id, ts, kind, message FROM events
             WHERE (?1 IS NULL OR miner_id = ?1) ORDER BY id DESC LIMIT ?2",
        )?;
        let rows = st
            .query_map(params![miner_id, limit], |r| {
                Ok(Event {
                    id: r.get(0)?,
                    miner_id: r.get(1)?,
                    ts: r.get(2)?,
                    kind: r.get(3)?,
                    message: r.get(4)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    // ---------- best shares (leaderboard)

    pub fn add_best_share(&self, miner_id: i64, diff: f64) -> Result<()> {
        self.c().execute("INSERT OR REPLACE INTO best_shares VALUES(?,?,?)", params![miner_id, now(), diff])?;
        Ok(())
    }

    /// The biggest shares the fleet has found, newest record per miner first.
    pub fn top_shares(&self, limit: i64) -> Result<Vec<(i64, i64, f64)>> {
        let c = self.c();
        let mut st = c.prepare("SELECT miner_id, ts, diff FROM best_shares ORDER BY diff DESC LIMIT ?")?;
        let rows = st
            .query_map([limit], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Raw samples as CSV (time, miner, hashrate, temps, power, fan).
    pub fn export_csv(&self, since: i64) -> Result<String> {
        let c = self.c();
        let mut st = c.prepare(
            "SELECT s.ts, m.name, m.ip, s.hashrate, s.temp, s.vr_temp, s.power, s.fan_rpm
             FROM samples s JOIN miners m ON m.id = s.miner_id WHERE s.ts >= ? ORDER BY s.ts, m.id",
        )?;
        let mut out = String::from("time,miner,ip,hashrate_ghs,chip_temp_c,vr_temp_c,power_w,fan_rpm
");
        let f = |v: Option<f64>| v.map(|x| format!("{x:.2}")).unwrap_or_default();
        let mut rows = st.query([since])?;
        while let Some(r) = rows.next()? {
            let name: String = r.get(1)?;
            out.push_str(&format!(
                "{},{},{},{},{},{},{},{}
",
                r.get::<_, i64>(0)?,
                name.replace(',', " "),
                r.get::<_, String>(2)?,
                f(r.get(3)?),
                f(r.get(4)?),
                f(r.get(5)?),
                f(r.get(6)?),
                f(r.get(7)?)
            ));
        }
        Ok(out)
    }

    pub fn path_size(&self) -> i64 {
        let c = self.c();
        c.query_row("SELECT page_count * page_size FROM pragma_page_count(), pragma_page_size()", [], |r| r.get(0))
            .unwrap_or(0)
    }

    // ---------- settings

    pub fn settings(&self) -> Result<HashMap<String, String>> {
        let c = self.c();
        let mut st = c.prepare("SELECT key, value FROM settings")?;
        let rows = st
            .query_map([], |r| Ok((r.get::<_, String>(0)?, r.get::<_, String>(1)?)))?
            .collect::<rusqlite::Result<HashMap<_, _>>>()?;
        Ok(rows)
    }

    pub fn set_setting(&self, key: &str, value: &str) -> Result<()> {
        self.c().execute(
            "INSERT INTO settings(key, value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn stats(&self) -> Result<(i64, i64, i64)> {
        let c = self.c();
        let s: i64 = c.query_row("SELECT COUNT(*) FROM samples", [], |r| r.get(0))?;
        let h: i64 = c.query_row("SELECT COUNT(*) FROM hourly", [], |r| r.get(0))?;
        let e: i64 = c.query_row("SELECT COUNT(*) FROM events", [], |r| r.get(0))?;
        Ok((s, h, e))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn miners_samples_history() {
        let db = Db::memory().unwrap();
        let a = db.add_miner("10.0.0.2", "a", "axeforge", "NerdQaxe++").unwrap();
        let b = db.add_miner("10.0.0.3", "b", "axeos", "Bitaxe").unwrap();
        let t = now() - 120;
        for i in 0..4 {
            let s = Sample { hashrate: Some(1000.0), temp: Some(50.0), power: Some(20.0), ..Default::default() };
            db.add_sample(a, t + i * 30, &s).unwrap();
            db.add_sample(b, t + i * 30, &s).unwrap();
        }
        let h = db.history(None, t - 1, 600).unwrap();
        assert!(!h.is_empty());
        let total: f64 = h.iter().filter_map(|p| p.hashrate).fold(0.0, f64::max);
        assert!((total - 2000.0).abs() < 1e-6);
        db.add_event(Some(a), "online", "up").unwrap();
        assert_eq!(db.events(None, 10).unwrap().len(), 1);
        db.delete_miner(a).unwrap();
        assert_eq!(db.miners().unwrap().len(), 1);
        db.set_setting("poll", "10").unwrap();
        db.set_setting("poll", "15").unwrap();
        assert_eq!(db.settings().unwrap()["poll"], "15");
    }
}
