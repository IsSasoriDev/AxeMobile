// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/

use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    Manager, WindowEvent, Emitter,
};

// Store miner IPs so menu click handlers can trigger restarts
static MINER_IPS: Mutex<Vec<String>> = Mutex::new(Vec::new());

// Global flag to track if we should minimize to tray
static MINIMIZE_TO_TRAY: AtomicBool = AtomicBool::new(false);

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
async fn update_miner_settings(
    ip: String,
    stratum_url: Option<String>,
    stratum_port: Option<u16>,
    stratum_user: Option<String>,
    stratum_password: Option<String>,
    fan_speed: Option<u8>,
    frequency: Option<u16>,
    core_voltage: Option<u16>,
) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(10))
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|e| e.to_string())?;

    let url = format!("http://{}/api/system", ip);
    
    let mut payload = serde_json::Map::new();

    // Pool settings - using correct API parameter names
    if let Some(pool_url) = stratum_url {
        payload.insert("stratumURL".to_string(), serde_json::json!(pool_url));
    }
    if let Some(port) = stratum_port {
        payload.insert("stratumPort".to_string(), serde_json::json!(port));
    }
    if let Some(user) = stratum_user {
        payload.insert("stratumUser".to_string(), serde_json::json!(user));
    }
    if let Some(password) = stratum_password {
        payload.insert("stratumPassword".to_string(), serde_json::json!(password));
    }

    // Fan speed (0-100)
    if let Some(speed) = fan_speed {
        payload.insert("fanspeed".to_string(), serde_json::json!(speed));
    }

    // Frequency in MHz
    if let Some(freq) = frequency {
        payload.insert("frequency".to_string(), serde_json::json!(freq));
    }

    // Core voltage in millivolts
    if let Some(voltage) = core_voltage {
        payload.insert("coreVoltage".to_string(), serde_json::json!(voltage));
    }

    println!("Sending PATCH to {} with payload: {:?}", url, payload);

    let response = client
        .patch(&url)
        .header("Content-Type", "application/json")
        .header("User-Agent", "AxeMobile/1.0")
        .json(&serde_json::Value::Object(payload))
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if response.status().is_success() {
        Ok("Settings updated successfully".to_string())
    } else {
        let status = response.status();
        let body = response.text().await.unwrap_or_default();
        Err(format!("Failed with status {}: {}", status, body))
    }
}

// Command to set minimize to tray preference
#[tauri::command]
fn set_minimize_to_tray(enabled: bool) {
    MINIMIZE_TO_TRAY.store(enabled, Ordering::SeqCst);
    println!("Minimize to tray set to: {}", enabled);
}

// Command to get minimize to tray preference
#[tauri::command]
fn get_minimize_to_tray() -> bool {
    MINIMIZE_TO_TRAY.load(Ordering::SeqCst)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrayMinerInfo {
    pub ip: String,
    pub name: String,
    #[serde(rename = "hashRate")]
    pub hash_rate: f64,
    pub temp: f64,
    pub power: f64,
    #[serde(rename = "isActive")]
    pub is_active: bool,
}

// Command to update tray tooltip and dynamic context menu with per-miner stats
#[tauri::command]
fn update_tray_stats(app: tauri::AppHandle, stats_text: String, miners: Vec<TrayMinerInfo>) {
    // Update tooltip
    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_tooltip(Some(&stats_text));
    }

    // Store IPs for restart handler
    if let Ok(mut ips) = MINER_IPS.lock() {
        *ips = miners.iter().map(|m| m.ip.clone()).collect();
    }

    // Rebuild tray menu with per-miner entries
    let _ = rebuild_tray_menu(&app, &miners);
}

fn rebuild_tray_menu(app: &tauri::AppHandle, miners: &[TrayMinerInfo]) -> Result<(), Box<dyn std::error::Error>> {
    let show_i = MenuItem::with_id(app, "show", "Show AxeMobile", true, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    let mut items: Vec<Box<dyn tauri::menu::IsMenuItem<tauri::Wry>>> = Vec::new();
    items.push(Box::new(show_i));
    items.push(Box::new(sep1));

    if miners.is_empty() {
        let no_miners = MenuItem::with_id(app, "no-miners", "No miners connected", false, None::<&str>)?;
        items.push(Box::new(no_miners));
    } else {
        for (i, miner) in miners.iter().enumerate() {
            let status = if miner.is_active { "🟢" } else { "🔴" };
            let label = if miner.is_active {
                format!(
                    "{} {} — {:.1} GH/s | {:.0}°C | {:.0}W",
                    status, miner.name, miner.hash_rate, miner.temp, miner.power
                )
            } else {
                format!("{} {} — Offline", status, miner.name)
            };

            let info_item = MenuItem::with_id(app, format!("miner-info-{}", i), &label, false, None::<&str>)?;
            items.push(Box::new(info_item));

            if miner.is_active {
                let restart_item = MenuItem::with_id(
                    app,
                    format!("restart-{}", i),
                    format!("   ↻ Restart {}", miner.name),
                    true,
                    None::<&str>,
                )?;
                items.push(Box::new(restart_item));
            }
        }
    }

    let sep2 = PredefinedMenuItem::separator(app)?;
    let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
    items.push(Box::new(sep2));
    items.push(Box::new(quit_i));

    // Build refs for Menu::with_items
    let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> = items.iter().map(|b| b.as_ref()).collect();
    let menu = Menu::with_items(app, &refs)?;

    if let Some(tray) = app.tray_by_id("main-tray") {
        let _ = tray.set_menu(Some(menu));
    }

    Ok(())
}

// Command to quit the app
#[tauri::command]
fn quit_app(app: tauri::AppHandle) {
    app.exit(0);
}

// Command to hide to tray
#[tauri::command]
fn hide_to_tray(app: tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            // Create tray menu
            let show_i = MenuItem::with_id(app, "show", "Show AxeMobile", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            // Build tray icon
            let _tray = TrayIconBuilder::with_id("main-tray")
                .icon(app.default_window_icon().unwrap().clone())
                .tooltip("AxeMobile - No miners connected")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| {
                    let id = event.id.0.as_str();
                    match id {
                        "show" => {
                            if let Some(window) = app.get_webview_window("main") {
                                let _ = window.show();
                                let _ = window.set_focus();
                            }
                        }
                        "quit" => {
                            app.exit(0);
                        }
                        _ if id.starts_with("restart-") => {
                            if let Ok(idx) = id.trim_start_matches("restart-").parse::<usize>() {
                                let ip = MINER_IPS.lock().ok().and_then(|ips| ips.get(idx).cloned());
                                if let Some(ip) = ip {
                                    let app = app.clone();
                                    tauri::async_runtime::spawn(async move {
                                        match restart_miner(ip.clone()).await {
                                            Ok(_) => println!("✓ Restarted miner at {}", ip),
                                            Err(e) => println!("✗ Failed to restart {}: {}", ip, e),
                                        }
                                        // Emit event to frontend
                                        let _ = app.emit("miner-restarted", ip);
                                    });
                                }
                            }
                        }
                        _ => {}
                    }
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            Ok(())
        })
        .on_window_event(|window, event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
                if MINIMIZE_TO_TRAY.load(Ordering::SeqCst) {
                    // Hide window instead of closing
                    let _ = window.hide();
                    api.prevent_close();
                }
                // If not minimizing to tray, let the window close normally
            }
        })
        .invoke_handler(tauri::generate_handler![
            fetch_miner_info,
            restart_miner,
            update_miner_settings,
            set_minimize_to_tray,
            get_minimize_to_tray,
            update_tray_stats,
            quit_app,
            hide_to_tray
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
