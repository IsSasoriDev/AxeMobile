//! Firmware release check. Every few hours AxeMobile asks GitHub for the
//! latest release of each firmware family and flags miners that run an
//! older one. Nothing is installed: updating stays on the miner's own page.

use std::cmp::Ordering;

use anyhow::{bail, Result};
use serde::Serialize;
use serde_json::Value;

use crate::miner::{Client, AXEFORGE};

#[derive(Debug, Clone, Serialize)]
pub struct Release {
    pub repo: &'static str,
    pub tag: String,
    pub url: String,
    pub published: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Update {
    pub current: String,
    pub latest: String,
    pub url: String,
}

pub const REPOS: [&str; 3] = ["IsSasoriDev/AxeForge", "bitaxeorg/ESP-Miner", "shufps/ESP-Miner-NerdQAxePlus"];

/// Which GitHub repo a miner's firmware comes from.
pub fn repo_for(kind: &str, model: &str) -> &'static str {
    if kind == AXEFORGE {
        REPOS[0]
    } else if model.to_ascii_lowercase().starts_with("nerd") {
        REPOS[2]
    } else {
        REPOS[1]
    }
}

/// "v2.9.0", "Release-NerdAxe-v2.1.5", "1.4.9-dirty" -> [2, 9, 0] etc.
/// None when there's no dotted number in it (dev builds, git hashes).
pub fn parse_version(s: &str) -> Option<Vec<u64>> {
    let start = s.find(|c: char| c.is_ascii_digit())?;
    let tail = &s[start..];
    let end = tail.find(|c: char| !(c.is_ascii_digit() || c == '.')).unwrap_or(tail.len());
    let nums: Vec<u64> = tail[..end].split('.').filter(|p| !p.is_empty()).map_while(|p| p.parse().ok()).collect();
    if nums.len() < 2 {
        return None;
    }
    Some(nums)
}

fn cmp(a: &[u64], b: &[u64]) -> Ordering {
    for i in 0..a.len().max(b.len()) {
        let o = a.get(i).unwrap_or(&0).cmp(b.get(i).unwrap_or(&0));
        if o != Ordering::Equal {
            return o;
        }
    }
    Ordering::Equal
}

/// Some(update) when `latest` is newer than what the miner runs.
pub fn update_for(current: &str, latest: &Release) -> Option<Update> {
    let (c, l) = (parse_version(current)?, parse_version(&latest.tag)?);
    (cmp(&l, &c) == Ordering::Greater).then(|| Update { current: current.to_string(), latest: latest.tag.clone(), url: latest.url.clone() })
}

pub async fn fetch(client: &Client, repo: &'static str) -> Result<Release> {
    let r = client
        .http()
        .get(format!("https://api.github.com/repos/{repo}/releases/latest"))
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?;
    if !r.status().is_success() {
        bail!("GitHub said {}", r.status().as_u16());
    }
    let v: Value = r.json().await?;
    let s = |k: &str| v.get(k).and_then(|x| x.as_str()).unwrap_or_default().to_string();
    Ok(Release { repo, tag: s("tag_name"), url: s("html_url"), published: s("published_at") })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rel(tag: &str) -> Release {
        Release { repo: REPOS[0], tag: tag.into(), url: String::new(), published: String::new() }
    }

    #[test]
    fn versions() {
        assert_eq!(parse_version("v2.15.4"), Some(vec![2, 15, 4]));
        assert_eq!(parse_version("Release-NerdAxe-v2.1.5"), Some(vec![2, 1, 5]));
        assert_eq!(parse_version("1.4.9-dirty"), Some(vec![1, 4, 9]));
        assert_eq!(parse_version("a1b2c3d"), None);
        assert!(update_for("1.4.9", &rel("v1.5.0")).is_some());
        assert!(update_for("v2.15.4", &rel("v2.15.4")).is_none());
        assert!(update_for("v2.9.0", &rel("v2.15.4")).is_some());
        assert!(update_for("1.5.1", &rel("v1.5.0")).is_none());
        assert!(update_for("dev", &rel("v1.5.0")).is_none());
    }

    #[test]
    fn repos() {
        assert_eq!(repo_for("axeforge", "NerdQaxe++"), "IsSasoriDev/AxeForge");
        assert_eq!(repo_for("axeos", "NerdQAxe++"), "shufps/ESP-Miner-NerdQAxePlus");
        assert_eq!(repo_for("axeos", "Bitaxe 601"), "bitaxeorg/ESP-Miner");
    }
}
