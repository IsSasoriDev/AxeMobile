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
  acc      REAL NOT NULL DEFAULT 0,
  rej      REAL NOT NULL DEFAULT 0,
  miss     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(miner_id, ts)
) WITHOUT ROWID;
CREATE TABLE IF NOT EXISTS reboots(
  miner_id INTEGER NOT NULL,
  ts       INTEGER NOT NULL,
  planned  INTEGER NOT NULL DEFAULT 0,
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
CREATE TABLE IF NOT EXISTS pool_blocks(
  id     INTEGER PRIMARY KEY,
  ts     INTEGER NOT NULL,
  height INTEGER NOT NULL,
  hash   TEXT NOT NULL,
  worker TEXT NOT NULL,
  reward INTEGER NOT NULL,
  result TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS pool_best(
  worker TEXT PRIMARY KEY,
  diff   REAL NOT NULL,
  ts     INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS pool_samples(
  ts       INTEGER PRIMARY KEY,
  hashrate REAL NOT NULL,
  workers  INTEGER NOT NULL
);
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
    /// shares accepted / rejected since the previous poll
    pub acc: f64,
    pub rej: f64,
}

#[derive(Debug, Clone, Serialize)]
pub struct PoolBlock {
    pub ts: i64,
    pub height: i64,
    pub hash: String,
    pub worker: String,
    /// sats
    pub reward: i64,
    /// "accepted" or the node's reason for refusing it
    pub result: String,
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

/// Adds the columns newer versions need to tables an older AxeMobile made.
fn migrate(c: &Connection) -> Result<()> {
    let has_hourly: bool = c.query_row("SELECT COUNT(*) FROM sqlite_master WHERE name='hourly'", [], |r| r.get::<_, i64>(0))? > 0;
    if has_hourly {
        let cols: Vec<String> = c
            .prepare("SELECT name FROM pragma_table_info('hourly')")?
            .query_map([], |r| r.get(0))?
            .collect::<rusqlite::Result<_>>()?;
        for (col, ty) in [("acc", "REAL"), ("rej", "REAL"), ("miss", "INTEGER")] {
            if !cols.iter().any(|x| x == col) {
                c.execute_batch(&format!("ALTER TABLE hourly ADD COLUMN {col} {ty} NOT NULL DEFAULT 0"))?;
            }
        }
    }
    Ok(())
}

/// One day of one miner, from the hourly table.
#[derive(Debug, Clone, Serialize)]
pub struct DayRow {
    pub miner_id: i64,
    /// days since 1970-01-01 in the caller's time zone
    pub day: i64,
    /// GH/s, averaged over the polls that reached the miner
    pub hashrate: Option<f64>,
    /// watt-hours measured while AxeMobile was polling
    pub energy_wh: f64,
    pub polls: i64,
    /// reads that got no answer
    pub misses: i64,
    /// hours with at least one reading
    pub hours: i64,
    pub accepted: f64,
    pub rejected: f64,
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
        migrate(&conn)?;
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
        migrate(&conn)?;
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
        c.execute("DELETE FROM reboots WHERE miner_id=?", [id])?;
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
            "INSERT INTO hourly(miner_id, ts, hashrate, temp, power, n, acc, rej) VALUES(?,?,?,?,?,1,?,?)
             ON CONFLICT(miner_id, ts) DO UPDATE SET
               hashrate = (COALESCE(hashrate,0)*n + COALESCE(excluded.hashrate,0))/(n+1),
               temp     = (COALESCE(temp,0)*n + COALESCE(excluded.temp,0))/(n+1),
               power    = (COALESCE(power,0)*n + COALESCE(excluded.power,0))/(n+1),
               n        = n+1,
               acc      = acc + excluded.acc,
               rej      = rej + excluded.rej",
            params![miner_id, hour, s.hashrate, s.temp, s.power, s.acc, s.rej],
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

    /// A read of this miner that got no answer (see `availability`).
    pub fn add_miss(&self, miner_id: i64, ts: i64) -> Result<()> {
        self.c().execute(
            "INSERT INTO hourly(miner_id, ts, n, miss) VALUES(?,?,0,1)
             ON CONFLICT(miner_id, ts) DO UPDATE SET miss = miss+1",
            params![miner_id, ts / 3600 * 3600],
        )?;
        Ok(())
    }

    /// Share of AxeMobile's reads since `since` that the miner answered,
    /// 0..1. Time when AxeMobile wasn't running doesn't count either way.
    pub fn availability(&self, miner_id: i64, since: i64) -> Result<Option<f64>> {
        let (ok, miss): (i64, i64) = self.c().query_row(
            "SELECT COALESCE(SUM(n),0), COALESCE(SUM(miss),0) FROM hourly WHERE miner_id=? AND ts>=?",
            params![miner_id, since / 3600 * 3600],
            |r| Ok((r.get(0)?, r.get(1)?)),
        )?;
        Ok((ok + miss > 0).then(|| ok as f64 / (ok + miss) as f64))
    }

    pub fn add_reboot(&self, miner_id: i64, ts: i64, planned: bool) -> Result<()> {
        self.c().execute("INSERT OR IGNORE INTO reboots VALUES(?,?,?)", params![miner_id, ts, planned as i64])?;
        Ok(())
    }

    /// Reboots nobody asked for since `since`.
    pub fn reboots(&self, miner_id: i64, since: i64) -> Result<i64> {
        Ok(self.c().query_row(
            "SELECT COUNT(*) FROM reboots WHERE miner_id=? AND ts>=? AND planned=0",
            params![miner_id, since],
            |r| r.get(0),
        )?)
    }

    /// Per-day rows for every miner (or one) since `since`. `offset` is the
    /// caller's UTC offset in seconds, so days start at their midnight.
    pub fn days(&self, miner_id: Option<i64>, since: i64, offset: i64) -> Result<Vec<DayRow>> {
        let c = self.c();
        let mut st = c.prepare(
            "SELECT miner_id, (ts + ?1) / 86400 AS d,
                    SUM(hashrate * n) / NULLIF(SUM(CASE WHEN hashrate IS NULL THEN 0 ELSE n END), 0),
                    COALESCE(SUM(power), 0), SUM(n), SUM(miss), SUM(CASE WHEN n > 0 THEN 1 ELSE 0 END), SUM(acc), SUM(rej)
             FROM hourly WHERE ts >= ?2 AND (?3 IS NULL OR miner_id = ?3)
             GROUP BY miner_id, d ORDER BY d, miner_id",
        )?;
        let rows = st
            .query_map(params![offset, since, miner_id], |r| {
                Ok(DayRow {
                    miner_id: r.get(0)?,
                    day: r.get(1)?,
                    hashrate: r.get(2)?,
                    energy_wh: r.get(3)?,
                    polls: r.get(4)?,
                    misses: r.get(5)?,
                    hours: r.get(6)?,
                    accepted: r.get(7)?,
                    rejected: r.get(8)?,
                })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// ((miner, day), unplanned reboots) in the caller's time zone.
    pub fn reboot_days(&self, since: i64, offset: i64) -> Result<HashMap<(i64, i64), i64>> {
        let c = self.c();
        let mut st = c.prepare("SELECT miner_id, (ts + ?1) / 86400 AS d, COUNT(*) FROM reboots WHERE ts >= ?2 AND planned=0 GROUP BY miner_id, d")?;
        let rows = st
            .query_map(params![offset, since], |r| Ok(((r.get(0)?, r.get(1)?), r.get(2)?)))?
            .collect::<rusqlite::Result<HashMap<_, _>>>()?;
        Ok(rows)
    }

    /// ((miner, day), best share record set that day).
    pub fn record_days(&self, since: i64, offset: i64) -> Result<HashMap<(i64, i64), f64>> {
        let c = self.c();
        let mut st = c.prepare("SELECT miner_id, (ts + ?1) / 86400 AS d, MAX(diff) FROM best_shares WHERE ts >= ?2 GROUP BY miner_id, d")?;
        let rows = st
            .query_map(params![offset, since], |r| Ok(((r.get(0)?, r.get(1)?), r.get(2)?)))?
            .collect::<rusqlite::Result<HashMap<_, _>>>()?;
        Ok(rows)
    }

    pub fn prune(&self) -> Result<()> {
        let n = now();
        let c = self.c();
        c.execute("DELETE FROM samples WHERE ts < ?", [n - RAW_KEEP_SECS])?;
        c.execute("DELETE FROM hourly WHERE ts < ?", [n - HOURLY_KEEP_SECS])?;
        c.execute("DELETE FROM reboots WHERE ts < ?", [n - HOURLY_KEEP_SECS])?;
        c.execute("DELETE FROM pool_samples WHERE ts < ?", [n - 7 * 86_400])?;
        c.execute(
            "DELETE FROM events WHERE id <= (SELECT id FROM events ORDER BY id DESC LIMIT 1 OFFSET ?)",
            [EVENTS_KEEP],
        )?;
        Ok(())
    }

    // ---------- AxePool

    pub fn add_pool_block(&self, b: &PoolBlock) -> Result<()> {
        self.c().execute(
            "INSERT INTO pool_blocks(ts, height, hash, worker, reward, result) VALUES(?,?,?,?,?,?)",
            params![b.ts, b.height, b.hash, b.worker, b.reward, b.result],
        )?;
        Ok(())
    }

    pub fn pool_blocks(&self, limit: i64) -> Result<Vec<PoolBlock>> {
        let c = self.c();
        let mut st = c.prepare("SELECT ts, height, hash, worker, reward, result FROM pool_blocks ORDER BY id DESC LIMIT ?")?;
        let rows = st
            .query_map([limit], |r| {
                Ok(PoolBlock { ts: r.get(0)?, height: r.get(1)?, hash: r.get(2)?, worker: r.get(3)?, reward: r.get(4)?, result: r.get(5)? })
            })?
            .collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    /// Keeps the highest share per worker name. True when it is a new record.
    pub fn pool_best_share(&self, worker: &str, diff: f64) -> Result<bool> {
        let c = self.c();
        let old: Option<f64> = c.query_row("SELECT diff FROM pool_best WHERE worker=?", [worker], |r| r.get(0)).optional()?;
        if old.is_some_and(|o| o >= diff) {
            return Ok(false);
        }
        c.execute("INSERT OR REPLACE INTO pool_best(worker, diff, ts) VALUES(?,?,?)", params![worker, diff, now()])?;
        Ok(true)
    }

    pub fn pool_bests(&self) -> Result<Vec<(String, f64, i64)>> {
        let c = self.c();
        let mut st = c.prepare("SELECT worker, diff, ts FROM pool_best ORDER BY diff DESC LIMIT 50")?;
        let rows = st.query_map([], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
    }

    pub fn add_pool_sample(&self, hashrate: f64, workers: i64) -> Result<()> {
        self.c().execute("INSERT OR REPLACE INTO pool_samples(ts, hashrate, workers) VALUES(?,?,?)", params![now(), hashrate, workers])?;
        Ok(())
    }

    /// (ts, hashrate GH/s) averaged into `bucket`-second steps.
    pub fn pool_history(&self, since: i64, bucket: i64) -> Result<Vec<(i64, f64)>> {
        let c = self.c();
        let mut st = c.prepare("SELECT (ts / ?1) * ?1 AS b, AVG(hashrate) FROM pool_samples WHERE ts >= ?2 GROUP BY b ORDER BY b")?;
        let rows = st.query_map(params![bucket.max(1), since], |r| Ok((r.get(0)?, r.get(1)?)))?.collect::<rusqlite::Result<Vec<_>>>()?;
        Ok(rows)
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
        self.history_csv(None, since)
    }

    /// Raw samples as CSV for one miner or all of them.
    pub fn history_csv(&self, miner_id: Option<i64>, since: i64) -> Result<String> {
        let c = self.c();
        let mut st = c.prepare(
            "SELECT s.ts, m.name, m.ip, s.hashrate, s.temp, s.vr_temp, s.power, s.fan_rpm
             FROM samples s JOIN miners m ON m.id = s.miner_id
             WHERE s.ts >= ?1 AND (?2 IS NULL OR m.id = ?2) ORDER BY s.ts, m.id",
        )?;
        let mut out = String::from("time,miner,ip,hashrate_ghs,chip_temp_c,vr_temp_c,power_w,fan_rpm
");
        let f = |v: Option<f64>| v.map(|x| format!("{x:.2}")).unwrap_or_default();
        let mut rows = st.query(params![since, miner_id])?;
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
        let b = db.add_miner("10.0.0.4", "c", "axeos", "Bitaxe").unwrap();
        let mut s = Sample { hashrate: Some(500.0), power: Some(10.0), ..Default::default() };
        let t0 = now() / 3600 * 3600;
        // a miss first, before any reading made the hour's row
        db.add_miss(b, t0).unwrap();
        for i in 1..4 {
            s.acc = 3.0;
            db.add_sample(b, t0 + i, &s).unwrap();
        }
        let av = db.availability(b, t0).unwrap().unwrap();
        assert!((av - 0.75).abs() < 1e-9, "{av}");
        let days = db.days(Some(b), t0, 0).unwrap();
        assert_eq!(days.len(), 1);
        assert_eq!(days[0].accepted, 9.0);
        assert_eq!((days[0].polls, days[0].misses), (3, 1));
        assert_eq!(days[0].hashrate, Some(500.0));
        db.add_reboot(b, t0, false).unwrap();
        db.add_reboot(b, t0 + 1, true).unwrap();
        assert_eq!(db.reboots(b, t0).unwrap(), 1);
        db.set_setting("poll", "10").unwrap();
        db.set_setting("poll", "15").unwrap();
        assert_eq!(db.settings().unwrap()["poll"], "15");
    }
}
