//! Bitcoin price, fees and chain tip from the public mempool.space API.
//! Only used for display; turn it off with the `market` setting.

use anyhow::Result;
use serde::Serialize;
use serde_json::Value;

use crate::miner::Client;

const BASE: &str = "https://mempool.space/api";

#[derive(Debug, Clone, Default, Serialize)]
pub struct Market {
    pub usd: Option<f64>,
    pub eur: Option<f64>,
    pub fee_fast: Option<f64>,
    pub fee_hour: Option<f64>,
    pub height: Option<f64>,
    pub retarget_pct: Option<f64>,
    pub retarget_blocks: Option<f64>,
    pub updated: i64,
}

async fn get(c: &Client, path: &str) -> Result<Value> {
    Ok(c.http().get(format!("{BASE}{path}")).send().await?.error_for_status()?.json::<Value>().await?)
}

pub async fn fetch(c: &Client) -> Result<Market> {
    let (prices, fees, height, adj) = tokio::join!(
        get(c, "/v1/prices"),
        get(c, "/v1/fees/recommended"),
        get(c, "/blocks/tip/height"),
        get(c, "/v1/difficulty-adjustment"),
    );
    let prices = prices?;
    let num = |v: &Value, k: &str| v.get(k).and_then(|x| x.as_f64());
    let fees = fees.unwrap_or(Value::Null);
    let adj = adj.unwrap_or(Value::Null);
    Ok(Market {
        usd: num(&prices, "USD"),
        eur: num(&prices, "EUR"),
        fee_fast: num(&fees, "fastestFee"),
        fee_hour: num(&fees, "hourFee"),
        height: height.ok().and_then(|h| h.as_f64()),
        retarget_pct: num(&adj, "difficultyChange"),
        retarget_blocks: num(&adj, "remainingBlocks"),
        updated: crate::db::now(),
    })
}

/// Chance of the fleet finding a block, per day, from GH/s and network difficulty.
pub fn odds_per_day(ghs: f64, network_diff: f64) -> Option<f64> {
    if ghs <= 0.0 || network_diff <= 0.0 {
        return None;
    }
    let per_sec = ghs * 1e9 / (network_diff * 4_294_967_296.0);
    Some(1.0 - (-per_sec * 86_400.0).exp())
}
