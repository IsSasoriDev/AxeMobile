//! The Cave: a small idle game powered by your real hashrate. The faster
//! your fleet hashes, the faster your miner digs; rarer ores sell for more
//! Cave BTC, which buys boosts. Saved in the app database.
//!
//! Also the achievement list, worked out from real mining data and the game.

use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum Rarity {
    Common,
    Uncommon,
    Rare,
    Epic,
    Legendary,
}

impl Rarity {
    pub fn name(self) -> &'static str {
        match self {
            Rarity::Common => "Common",
            Rarity::Uncommon => "Uncommon",
            Rarity::Rare => "Rare",
            Rarity::Epic => "Epic",
            Rarity::Legendary => "Legendary",
        }
    }
}

pub struct Ore {
    pub id: &'static str,
    pub name: &'static str,
    pub rarity: Rarity,
    pub value: f64,

}

pub const ORES: [Ore; 7] = [
    Ore { id: "coal", name: "Coal", rarity: Rarity::Common, value: 1.0 },
    Ore { id: "copper", name: "Copper", rarity: Rarity::Common, value: 2.0 },
    Ore { id: "iron", name: "Iron", rarity: Rarity::Uncommon, value: 5.0 },
    Ore { id: "gold", name: "Gold", rarity: Rarity::Rare, value: 10.0 },
    Ore { id: "emerald", name: "Emerald", rarity: Rarity::Epic, value: 25.0 },
    Ore { id: "diamond", name: "Diamond", rarity: Rarity::Legendary, value: 50.0 },
    Ore { id: "bitcoin", name: "Bitcoin", rarity: Rarity::Legendary, value: 100.0 },
];

pub fn ore(id: &str) -> &'static Ore {
    ORES.iter().find(|o| o.id == id).unwrap_or(&ORES[0])
}

pub struct ShopItem {
    pub id: &'static str,
    pub name: &'static str,
    pub desc: &'static str,
    pub price: f64,
    /// luck multiplier while active
    pub luck: f64,
    /// dig speed multiplier while active
    pub speed: f64,
    /// minutes, 0 = permanent
    pub minutes: i64,
    pub icon: &'static str,
}

pub const SHOP: [ShopItem; 8] = [
    ShopItem { id: "lucky_pickaxe", name: "Lucky Pickaxe", desc: "+50% rare ore chance for 30 min", price: 100.0, luck: 1.5, speed: 1.0, minutes: 30, icon: "⛏" },
    ShopItem { id: "speed_boost", name: "Speed Boost", desc: "Dig twice as fast for 1 hour", price: 200.0, luck: 1.0, speed: 2.0, minutes: 60, icon: "⚡" },
    ShopItem { id: "golden_pickaxe", name: "Golden Pickaxe", desc: "+100% rare ore chance for 1 hour", price: 250.0, luck: 2.0, speed: 1.0, minutes: 60, icon: "✦" },
    ShopItem { id: "diamond_drill", name: "Diamond Drill", desc: "+200% rare ore chance for 2 hours", price: 500.0, luck: 3.0, speed: 1.0, minutes: 120, icon: "◆" },
    ShopItem { id: "mega_luck", name: "Mega Luck Charm", desc: "+300% rare ore chance for 30 min", price: 750.0, luck: 4.0, speed: 1.0, minutes: 30, icon: "☘" },
    ShopItem { id: "auto_miner", name: "Auto Miner", desc: "Keeps digging even when your miners are off", price: 1000.0, luck: 1.0, speed: 1.0, minutes: 0, icon: "⚙" },
    ShopItem { id: "treasure_detector", name: "Treasure Detector", desc: "Shows what the next find will be", price: 1500.0, luck: 1.0, speed: 1.0, minutes: 0, icon: "◎" },
    ShopItem { id: "bitcoin_magnet", name: "Bitcoin Magnet", desc: "10x the chance of digging up Bitcoin", price: 2000.0, luck: 1.0, speed: 1.0, minutes: 0, icon: "₿" },
];

#[derive(Default, Serialize, Deserialize, Clone)]
pub struct Game {
    pub inventory: BTreeMap<String, u64>,
    pub balance: f64,
    pub best_balance: f64,
    pub total_mined: u64,
    pub legendary: u64,
    pub earned: f64,
    /// item id -> expiry (unix seconds), 0 for permanent
    pub owned: BTreeMap<String, i64>,
    #[serde(default)]
    pub progress: f64,
    #[serde(default)]
    pub next: Option<String>,
    #[serde(default)]
    pub seed: u64,
    #[serde(skip)]
    pub last_find: Option<(String, f64)>,
}

impl Game {
    pub fn load(raw: &str) -> Self {
        let mut g: Game = serde_json::from_str(raw).unwrap_or_default();
        if g.seed == 0 {
            g.seed = axe_core::db::now() as u64 ^ 0x9E37_79B9_7F4A_7C15;
        }
        g
    }

    pub fn save(&self) -> String {
        serde_json::to_string(self).unwrap_or_default()
    }

    fn rand(&mut self) -> f64 {
        // xorshift64*
        let mut x = self.seed;
        x ^= x >> 12;
        x ^= x << 25;
        x ^= x >> 27;
        self.seed = x;
        (x.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 11) as f64 / (1u64 << 53) as f64
    }

    pub fn has(&self, id: &str, now: i64) -> bool {
        self.owned.get(id).is_some_and(|&exp| exp == 0 || exp > now)
    }

    pub fn luck(&self, now: i64) -> f64 {
        SHOP.iter().filter(|s| s.minutes > 0 && self.has(s.id, now)).map(|s| s.luck).product()
    }

    pub fn speed(&self, now: i64) -> f64 {
        SHOP.iter().filter(|s| s.minutes > 0 && self.has(s.id, now)).map(|s| s.speed).product()
    }

    /// Seconds per find for a fleet hashrate in GH/s (same curve as 1.x).
    pub fn interval(&self, ghs: f64, now: i64) -> Option<f64> {
        let eff = if ghs <= 0.0 && self.has("auto_miner", now) { 50.0 } else { ghs };
        if eff <= 0.0 {
            return None;
        }
        let bonus = (eff / 100.0).min(0.8);
        Some(10.0 * (1.0 - bonus) / self.speed(now))
    }

    fn roll(&mut self, now: i64) -> &'static str {
        let luck = self.luck(now);
        let r = self.rand() * 100.0 / luck;
        let btc = if self.has("bitcoin_magnet", now) { 5.0 } else { 0.5 };
        if r < btc {
            "bitcoin"
        } else if r < btc + 1.5 {
            "diamond"
        } else if r < 7.0 {
            "emerald"
        } else if r < 20.0 {
            "gold"
        } else if r < 45.0 {
            "iron"
        } else if r < 70.0 {
            "copper"
        } else {
            "coal"
        }
    }

    /// Advances the dig by `dt` seconds. Returns the ore found, if any.
    pub fn tick(&mut self, dt: f64, ghs: f64, now: i64, t: f64) -> Option<&'static Ore> {
        let interval = self.interval(ghs, now)?;
        self.progress += dt / interval;
        if self.next.is_none() {
            self.next = Some(self.roll(now).to_string());
        }
        if self.progress < 1.0 {
            return None;
        }
        self.progress = 0.0;
        let id = self.next.take().unwrap_or_else(|| "coal".into());
        let o = ore(&id);
        *self.inventory.entry(id.clone()).or_default() += 1;
        self.total_mined += 1;
        if o.rarity == Rarity::Legendary {
            self.legendary += 1;
        }
        self.credit(o.value * 0.1);
        self.last_find = Some((id, t));
        self.next = Some(self.roll(now).to_string());
        Some(o)
    }

    fn credit(&mut self, v: f64) {
        self.balance += v;
        self.earned += v;
        self.best_balance = self.best_balance.max(self.balance);
    }

    pub fn sell(&mut self, id: &str, n: u64) {
        let have = self.inventory.get(id).copied().unwrap_or(0);
        let n = n.min(have);
        if n == 0 {
            return;
        }
        self.inventory.insert(id.into(), have - n);
        self.credit(ore(id).value * n as f64 * 0.1);
    }

    pub fn buy(&mut self, id: &str, now: i64) -> Result<(), String> {
        let item = SHOP.iter().find(|s| s.id == id).ok_or("no such item")?;
        if item.minutes == 0 && self.has(id, now) {
            return Err("you already own it".into());
        }
        if self.balance < item.price {
            return Err(format!("you need {:.0} more Cave BTC", item.price - self.balance));
        }
        self.balance -= item.price;
        let exp = if item.minutes == 0 {
            0
        } else {
            let cur = self.owned.get(id).copied().unwrap_or(0).max(now);
            cur + item.minutes * 60
        };
        self.owned.insert(id.into(), exp);
        Ok(())
    }

    pub fn inventory_value(&self) -> f64 {
        self.inventory.iter().map(|(k, n)| ore(k).value * *n as f64 * 0.1).sum()
    }
}

// ---------------------------------------------------------------- achievements

pub struct Ach {
    pub id: &'static str,
    pub name: &'static str,
    pub desc: &'static str,
    pub rarity: Rarity,
}

pub const ACHIEVEMENTS: &[Ach] = &[
    Ach { id: "hw-first", name: "First Miner", desc: "Add your first miner", rarity: Rarity::Common },
    Ach { id: "hw-3", name: "Small Fleet", desc: "Run 3 miners", rarity: Rarity::Uncommon },
    Ach { id: "hw-5", name: "Mining Squad", desc: "Run 5 miners", rarity: Rarity::Rare },
    Ach { id: "hw-10", name: "Hash Army", desc: "Run 10 miners", rarity: Rarity::Epic },
    Ach { id: "hr-500", name: "Half Terra", desc: "Fleet hashrate of 500 GH/s", rarity: Rarity::Uncommon },
    Ach { id: "hr-1t", name: "Terra Club", desc: "Fleet hashrate of 1 TH/s", rarity: Rarity::Rare },
    Ach { id: "hr-5t", name: "Hash Farm", desc: "Fleet hashrate of 5 TH/s", rarity: Rarity::Epic },
    Ach { id: "hr-10t", name: "Ten Tera", desc: "Fleet hashrate of 10 TH/s", rarity: Rarity::Legendary },
    Ach { id: "d-1m", name: "Millionaire", desc: "Best share above 1M", rarity: Rarity::Common },
    Ach { id: "d-100m", name: "Hundred Million", desc: "Best share above 100M", rarity: Rarity::Uncommon },
    Ach { id: "d-1g", name: "Giga Share", desc: "Best share above 1G", rarity: Rarity::Rare },
    Ach { id: "d-100g", name: "Big Fish", desc: "Best share above 100G", rarity: Rarity::Epic },
    Ach { id: "d-1t", name: "Tera Share", desc: "Best share above 1T", rarity: Rarity::Legendary },
    Ach { id: "block", name: "BLOCK FOUND!", desc: "Find a Bitcoin block", rarity: Rarity::Legendary },
    Ach { id: "up-1h", name: "First Hour", desc: "A miner up for an hour", rarity: Rarity::Common },
    Ach { id: "up-24h", name: "Day Shift", desc: "A miner up for 24 hours", rarity: Rarity::Uncommon },
    Ach { id: "up-7d", name: "Weekly Warrior", desc: "A miner up for 7 days", rarity: Rarity::Rare },
    Ach { id: "up-30d", name: "Monthly Machine", desc: "A miner up for 30 days", rarity: Rarity::Epic },
    Ach { id: "eff-20", name: "Efficient", desc: "Fleet under 20 J/TH", rarity: Rarity::Rare },
    Ach { id: "cave-1", name: "Into the Cave", desc: "Dig your first ore", rarity: Rarity::Common },
    Ach { id: "cave-btc", name: "Digital Gold", desc: "Dig up a Bitcoin ore", rarity: Rarity::Epic },
    Ach { id: "cave-1k", name: "Cave Whale", desc: "Hold 1,000 Cave BTC", rarity: Rarity::Rare },
    Ach { id: "cave-shop", name: "Big Spender", desc: "Buy something in the shop", rarity: Rarity::Uncommon },
];

pub struct Facts {
    pub miners: usize,
    pub fleet_ghs: f64,
    pub best_diff: f64,
    pub blocks: i64,
    pub max_uptime: f64,
    pub efficiency: Option<f64>,
}

pub fn earned(id: &str, f: &Facts, g: &Game) -> bool {
    match id {
        "hw-first" => f.miners >= 1,
        "hw-3" => f.miners >= 3,
        "hw-5" => f.miners >= 5,
        "hw-10" => f.miners >= 10,
        "hr-500" => f.fleet_ghs >= 500.0,
        "hr-1t" => f.fleet_ghs >= 1000.0,
        "hr-5t" => f.fleet_ghs >= 5000.0,
        "hr-10t" => f.fleet_ghs >= 10000.0,
        "d-1m" => f.best_diff >= 1e6,
        "d-100m" => f.best_diff >= 1e8,
        "d-1g" => f.best_diff >= 1e9,
        "d-100g" => f.best_diff >= 1e11,
        "d-1t" => f.best_diff >= 1e12,
        "block" => f.blocks > 0,
        "up-1h" => f.max_uptime >= 3600.0,
        "up-24h" => f.max_uptime >= 86400.0,
        "up-7d" => f.max_uptime >= 7.0 * 86400.0,
        "up-30d" => f.max_uptime >= 30.0 * 86400.0,
        "eff-20" => f.efficiency.is_some_and(|e| e > 0.0 && e < 20.0),
        "cave-1" => g.total_mined > 0,
        "cave-btc" => g.inventory.contains_key("bitcoin"),
        "cave-1k" => g.best_balance >= 1000.0,
        "cave-shop" => !g.owned.is_empty(),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn digs_and_buys() {
        let mut g = Game::load("");
        let now = 1_000_000;
        let mut found = 0;
        for i in 0..1000 {
            if g.tick(1.0, 600.0, now, i as f64).is_some() {
                found += 1;
            }
        }
        assert!(found > 400, "found {found}");
        assert!(g.balance > 0.0);
        g.balance = 5000.0;
        assert!(g.buy("auto_miner", now).is_ok());
        assert!(g.buy("auto_miner", now).is_err());
        assert!(g.interval(0.0, now).is_some());
        let s = g.save();
        assert_eq!(Game::load(&s).total_mined, g.total_mined);
    }
}
