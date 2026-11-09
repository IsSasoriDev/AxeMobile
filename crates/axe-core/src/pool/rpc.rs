//! Minimal bitcoind JSON-RPC client.

use std::time::Duration;

use serde_json::{json, Value};

#[derive(Debug, Clone, Default, PartialEq)]
pub struct NodeConfig {
    /// e.g. http://127.0.0.1:8332
    pub url: String,
    pub user: String,
    pub pass: String,
    /// path to bitcoind's .cookie file, used when user is empty
    pub cookie: String,
}

pub struct Rpc {
    http: reqwest::Client,
    cfg: NodeConfig,
}

impl Rpc {
    pub fn new(cfg: NodeConfig) -> Rpc {
        let http = reqwest::Client::builder().timeout(Duration::from_secs(20)).build().unwrap_or_default();
        Rpc { http, cfg }
    }

    fn auth(&self) -> Result<(String, String), String> {
        if !self.cfg.user.is_empty() {
            return Ok((self.cfg.user.clone(), self.cfg.pass.clone()));
        }
        if !self.cfg.cookie.is_empty() {
            let s = std::fs::read_to_string(&self.cfg.cookie).map_err(|e| format!("can't read cookie file: {e}"))?;
            if let Some((u, p)) = s.trim().split_once(':') {
                return Ok((u.into(), p.into()));
            }
            return Err("cookie file is empty".into());
        }
        Err("no RPC login set".into())
    }

    pub async fn call(&self, method: &str, params: Value) -> Result<Value, String> {
        let (user, pass) = self.auth()?;
        let mut url = self.cfg.url.trim().trim_end_matches('/').to_string();
        if url.is_empty() {
            return Err("no node address set".into());
        }
        if !url.contains("://") {
            url = format!("http://{url}");
        }
        let body = json!({"jsonrpc": "1.0", "id": "axepool", "method": method, "params": params});
        let r = self
            .http
            .post(&url)
            .basic_auth(user, Some(pass))
            .json(&body)
            .send()
            .await
            .map_err(|e| format!("can't reach the node: {}", short(&e)))?;
        let status = r.status();
        if status.as_u16() == 401 || status.as_u16() == 403 {
            return Err("the node rejected the RPC login".into());
        }
        let v: Value = r.json().await.map_err(|_| format!("node answered {status}"))?;
        if let Some(e) = v.get("error").filter(|e| !e.is_null()) {
            let msg = e.get("message").and_then(|m| m.as_str()).unwrap_or("error");
            return Err(msg.to_string());
        }
        Ok(v.get("result").cloned().unwrap_or(Value::Null))
    }

    pub async fn template(&self) -> Result<Value, String> {
        self.call("getblocktemplate", json!([{"rules": ["segwit", "signet"]}])).await
    }

    pub async fn best_hash(&self) -> Result<String, String> {
        Ok(self.call("getbestblockhash", json!([])).await?.as_str().unwrap_or_default().to_string())
    }

    /// None when the node accepted the block, otherwise its reason.
    pub async fn submit(&self, block_hex: &str) -> Result<Option<String>, String> {
        let r = self.call("submitblock", json!([block_hex])).await?;
        Ok(r.as_str().map(|s| s.to_string()))
    }
}

fn short(e: &reqwest::Error) -> String {
    if e.is_timeout() {
        "timed out".into()
    } else if e.is_connect() {
        "connection refused".into()
    } else {
        e.to_string()
    }
}
