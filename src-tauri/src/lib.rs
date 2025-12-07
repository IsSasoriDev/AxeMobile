// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct MinerInfo {
    pub hostname: Option<String>,
    #[serde(rename = "hashRate")]
    pub hash_rate: Option<f64>,
    pub temp: Option<f64>,
    pub power: Option<f64>,
    #[serde(rename = "coreVoltageActual")]
    pub core_voltage_actual: Option<f64>,
    #[serde(rename = "coreVoltage")]
    pub core_voltage: Option<f64>,
    pub voltage: Option<f64>,
    #[serde(rename = "uptimeSeconds")]
    pub uptime_seconds: Option<u64>,
    #[serde(rename = "sharesAccepted")]
    pub shares_accepted: Option<u64>,
    #[serde(rename = "sharesRejected")]
    pub shares_rejected: Option<u64>,
    #[serde(rename = "ASICModel")]
    pub asic_model: Option<String>,
    pub version: Option<String>,
}

#[tauri::command]
async fn fetch_miner_info(ip: String) -> Result<serde_json::Value, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        // Don't follow redirects
        .redirect(reqwest::redirect::Policy::none())
        // Don't send default headers like Origin
        .build()
        .map_err(|e| e.to_string())?;

    // Try primary endpoint first
    let endpoints = ["/api/system/info", "/api/system/statistics"];
    
    for endpoint in endpoints {
        let url = format!("http://{}{}", ip, endpoint);
        
        let result = client
            .get(&url)
            .header("Accept", "application/json")
            .header("User-Agent", "AxeMobile/1.0")
            // Explicitly NOT setting Origin header
            .send()
            .await;

        match result {
            Ok(response) => {
                if response.status().is_success() {
                    match response.json::<serde_json::Value>().await {
                        Ok(data) => {
                            println!("✓ Successfully fetched data from {}", url);
                            return Ok(data);
                        }
                        Err(e) => {
                            println!("Failed to parse JSON from {}: {}", url, e);
                            continue;
                        }
                    }
                } else {
                    println!("Request to {} failed with status: {}", url, response.status());
                    continue;
                }
            }
            Err(e) => {
                println!("Request to {} failed: {}", url, e);
                continue;
            }
        }
    }

    Err(format!("Failed to connect to miner at {}", ip))
}

#[tauri::command]
async fn restart_miner(ip: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("http://{}/api/system/restart", ip);
    
    client
        .post(&url)
        .header("User-Agent", "AxeMobile/1.0")
        .send()
        .await
        .map_err(|e| e.to_string())?;

    Ok("Restart command sent".to_string())
}

#[tauri::command]
async fn update_miner_pool(ip: String, pool: Option<String>, password: Option<String>, fan_speed: Option<u8>) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("http://{}/api/system", ip);
    
    let mut payload = serde_json::Map::new();

    // Add pool settings if provided
    if let Some(p) = pool {
        payload.insert("stratumURL".to_string(), serde_json::json!(p));
    }
    if let Some(pw) = password {
        payload.insert("stratumPassword".to_string(), serde_json::json!(pw));
    }

    // Add fan speed if provided
    if let Some(speed) = fan_speed {
        payload.insert("fanspeed".to_string(), serde_json::json!(speed));
    }

    let response = client
        .patch(&url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "AxeMobile/1.0")
        .json(&serde_json::Value::Object(payload))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok("Settings updated".to_string())
    } else {
        Err(format!("Failed with status: {}", response.status()))
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .invoke_handler(tauri::generate_handler![fetch_miner_info, restart_miner, update_miner_pool])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
