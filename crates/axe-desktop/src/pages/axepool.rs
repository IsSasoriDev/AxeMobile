//! AxePool: the built-in solo pool. Status, workers, found blocks, and the
//! node + payout settings.

use std::collections::HashMap;

use axe_core::db::{Point, PoolBlock};
use axe_core::pool::{self, Status};
use eframe::egui::{self, RichText};

use crate::app::{App, Tone};
use crate::fmt;
use crate::jobs::{self, Job};
use crate::widgets::{self as w, bold, ic, Series};

use super::header;

pub struct PoolPage {
    address: String,
    port: String,
    url: String,
    user: String,
    pass: String,
    cookie: String,
    show_node: bool,
    hist: Vec<Point>,
    blocks: Vec<PoolBlock>,
    loaded_at: f64,
    point: Option<Job<(String, Result<String, String>)>>,
    pointing: Option<i64>,
}

impl PoolPage {
    pub fn new(s: &HashMap<String, String>) -> Self {
        let g = |k: &str, d: &str| s.get(k).cloned().unwrap_or_else(|| d.to_string());
        PoolPage {
            address: g("pool_address", ""),
            port: g("pool_port", "3334"),
            url: g("node_url", "http://127.0.0.1:8332"),
            user: g("node_user", ""),
            pass: String::new(),
            cookie: g("node_cookie", ""),
            show_node: false,
            hist: vec![],
            blocks: vec![],
            loaded_at: -100.0,
            point: None,
            pointing: None,
        }
    }
}

fn btc(sats: u64) -> String {
    format!("{:.8}", sats as f64 / 1e8).trim_end_matches('0').trim_end_matches('.').to_string()
}

fn pct(x: f64) -> String {
    if x <= 0.0 {
        "0%".into()
    } else if x < 0.0001 {
        format!("1 in {}", fmt::diff(1.0 / x).replace(' ', ""))
    } else if x < 0.01 {
        format!("{:.3}%", x * 100.0)
    } else {
        format!("{:.1}%", x * 100.0)
    }
}

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context) {
    let p = app.pal;
    let st = app.engine.pool.status();
    let now = ui.input(|i| i.time);
    if now - app.st.axepool.loaded_at > 5.0 {
        app.st.axepool.loaded_at = now;
        let since = axe_core::db::now() - 86_400;
        app.st.axepool.hist = app
            .engine
            .db
            .pool_history(since, 600)
            .unwrap_or_default()
            .into_iter()
            .map(|(t, h)| Point { t, hashrate: Some(h), temp: None, power: None })
            .collect();
        app.st.axepool.blocks = app.engine.db.pool_blocks(20).unwrap_or_default();
    }
    ctx.request_repaint_after(std::time::Duration::from_secs(2));

    if let Some((name, r)) = jobs::poll(&mut app.st.axepool.point) {
        app.st.axepool.pointing = None;
        match r {
            Ok(m) => app.toast(if m.trim().is_empty() { format!("{name} now mines on AxePool") } else { format!("{name}: {m}") }, Tone::Ok),
            Err(e) => app.toast(format!("{name}: {e}"), Tone::Err),
        }
    }

    header(ui, app, "AxePool", |ui| {
        let (txt, col, blink) = if !st.enabled {
            ("Off", p.dim, false)
        } else if !st.error.is_empty() {
            ("Error", p.bad, false)
        } else if !st.node.ok {
            ("No node", p.warn, true)
        } else {
            ("Running", p.good, true)
        };
        w::pill(ui, txt, col, blink);
    });

    if !st.enabled {
        intro(app, ui);
        ui.add_space(14.0);
        settings(app, ui, &st);
        return;
    }

    if !st.error.is_empty() {
        super::miner::notice(ui, &p, p.bad, &st.error);
    } else if !st.node.ok {
        let msg = if st.node.error.is_empty() { "Connecting to your Bitcoin node…".to_string() } else { format!("Bitcoin node: {}", st.node.error) };
        super::miner::notice(ui, &p, p.warn, &msg);
    } else if !st.address_ok && st.workers.is_empty() {
        let msg = if st.address_error.is_empty() {
            "No payout address set. Miners can still connect with their own Bitcoin address as the username.".to_string()
        } else {
            format!("Payout address: {}", st.address_error)
        };
        super::miner::notice(ui, &p, p.warn, &msg);
    }

    // ---- headline numbers
    let (hv, hu) = fmt::hash(Some(st.hashrate));
    let day = pool::odds(st.hashrate, st.net_diff, 86_400.0);
    let year = pool::odds(st.hashrate, st.net_diff, 365.0 * 86_400.0);
    let n = if ui.available_width() > 900.0 { 4 } else { 2 };
    let tiles = [0usize, 1, 2, 3];
    for row in tiles.chunks(n) {
        w::cols(ui, n, 14.0, |i, ui| match row[i] {
            0 => w::stat(ui, &p, "Pool hashrate", &hv, hu, &format!("{} worker{}", st.workers.len(), if st.workers.len() == 1 { "" } else { "s" }), Some(p.pri)),
            1 => w::stat(ui, &p, "Best share", &fmt::diff(st.best), "", &format!("{} accepted · {} rejected", st.accepted, st.rejected), Some(p.warn)),
            2 => w::stat(ui, &p, "Chance of a block", &pct(day), "today", &format!("{} this year", pct(year)), None),
            _ => w::stat(
                ui,
                &p,
                "Blocks found",
                &st.blocks_found.to_string(),
                "",
                &if st.reward > 0 { format!("next one pays {} BTC", btc(st.reward)) } else { "waiting for a template".into() },
                if st.blocks_found > 0 { Some(p.good) } else { None },
            ),
        });
        ui.add_space(14.0);
    }

    // ---- connect + node
    let stratum = format!("stratum+tcp://{}:{}", pool::stratum_host(), st.port);
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(196.0);
            if i == 0 {
                w::h3(ui, &p, "Point your miners here");
                ui.add_space(6.0);
                copy_row(ui, app, "Stratum", &stratum);
                let user_hint = if app.st.axepool.address.trim().is_empty() { "your-btc-address.rig1".to_string() } else { format!("{}.rig1", app.st.axepool.address.trim()) };
                copy_row(ui, app, "Username", &user_hint);
                copy_row(ui, app, "Password", "x");
                ui.add_space(6.0);
                w::sub(ui, &p, "Each miner is paid to the address in its username. Without one, the payout address below is used. Add \"d=4096\" as the password to pin a difficulty.");
            } else {
                w::h3(ui, &p, "Bitcoin node");
                ui.add_space(6.0);
                let sync = if st.node.syncing { format!("syncing {:.1}%", st.node.progress * 100.0) } else if st.node.ok { "in sync".into() } else { "—".into() };
                w::kv(
                    ui,
                    &p,
                    "node",
                    &[
                        ("Node", if st.node.version.is_empty() { "—".into() } else { st.node.version.clone() }),
                        ("Network", if st.node.chain.is_empty() { "—".into() } else { st.node.chain.clone() }),
                        ("Height", if st.height > 0 { format!("{} ({sync})", st.height) } else { sync }),
                        ("Difficulty", if st.net_diff > 0.0 { fmt::diff(st.net_diff) } else { "—".into() }),
                        ("Block reward", if st.reward > 0 { format!("{} BTC, {} in fees", btc(st.reward), btc(st.fees)) } else { "—".into() }),
                        ("Transactions", if st.template_at > 0 { format!("{} · updated {}", st.txs, fmt::ago(st.template_at)) } else { "—".into() }),
                    ],
                );
            }
        });
    });
    ui.add_space(14.0);

    // ---- hashrate chart
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Pool hashrate, last 24 hours");
        ui.add_space(6.0);
        if app.st.axepool.hist.len() < 2 {
            ui.label(RichText::new("The chart fills in a few minutes after a miner connects.").color(p.dim));
        } else {
            let pts = app.st.axepool.hist.clone();
            w::chart(ui, &p, &pts, Series::Hashrate, None, 170.0);
        }
    });
    ui.add_space(14.0);

    // ---- workers
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Workers");
        ui.add_space(6.0);
        if st.workers.is_empty() {
            ui.label(RichText::new("Nobody connected yet. Use the stratum address above, or the buttons below to switch a miner over.").color(p.dim));
        }
        for (i, wk) in st.workers.iter().enumerate() {
            if i > 0 {
                let r = ui.available_rect_before_wrap();
                ui.painter().hline(r.x_range(), r.top(), egui::Stroke::new(1.0, p.line));
                ui.add_space(4.0);
            }
            ui.horizontal(|ui| {
                ui.set_min_height(40.0);
                w::dot(ui, if axe_core::db::now() - wk.last_share < 300 { p.good } else { p.warn }, false);
                let wid = (ui.available_width() * 0.34).max(120.0);
                ui.allocate_ui_with_layout(egui::vec2(wid, 36.0), egui::Layout::top_down(egui::Align::Min), |ui| {
                    ui.set_width(wid);
                    ui.add(egui::Label::new(RichText::new(&wk.name).font(bold(14.0))).truncate());
                    let sub = if wk.agent.is_empty() { wk.ip.clone() } else { format!("{} · {}", wk.ip, wk.agent) };
                    ui.add(egui::Label::new(RichText::new(sub).size(11.5).color(p.dim)).truncate());
                });
                let gap = ui.spacing().item_spacing.x;
                let col_w = ((ui.available_width() - gap * 4.0 - 2.0) / 4.0).max(50.0);
                for (label, value) in [
                    ("hashrate", fmt::hash_str(Some(wk.hashrate))),
                    ("difficulty", fmt::diff(wk.diff)),
                    ("shares", format!("{} / {}", wk.accepted, wk.rejected)),
                    ("best", fmt::diff(wk.best)),
                ] {
                    ui.allocate_ui_with_layout(egui::vec2(col_w, 36.0), egui::Layout::top_down(egui::Align::Max), |ui| {
                        ui.set_width(col_w);
                        ui.label(RichText::new(value).font(bold(13.5)));
                        ui.label(RichText::new(label).size(11.0).color(p.dim));
                    });
                }
            });
        }
    });
    ui.add_space(14.0);

    // ---- switch miners over
    if !app.miners.is_empty() {
        let connected: Vec<String> = st.workers.iter().map(|w| w.ip.clone()).collect();
        let mut go: Option<i64> = None;
        w::card(ui, &p, |ui| {
            w::h3(ui, &p, "Your miners");
            ui.add_space(4.0);
            w::sub(ui, &p, "Makes AxePool the miner's first pool and keeps its current pool as the fallback. AxeOS miners need a restart to switch.");
            ui.add_space(6.0);
            for m in &app.miners {
                ui.horizontal(|ui| {
                    ui.set_min_height(32.0);
                    let on = connected.contains(&m.row.ip);
                    w::dot(ui, if on { p.good } else { p.line }, on);
                    ui.label(RichText::new(m.name()).font(bold(13.5)));
                    ui.label(RichText::new(&m.row.ip).size(11.5).color(p.dim));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if on {
                            w::tag(ui, &p, "On AxePool", Some(p.good));
                        } else if app.st.axepool.pointing == Some(m.row.id) {
                            ui.label(RichText::new("Switching…").color(p.dim));
                        } else if w::confirm_button(ui, &p, true, "Mine here", &format!("Switch {} to AxePool?", m.name())) {
                            go = Some(m.row.id);
                        }
                    });
                });
            }
        });
        if let Some(id) = go {
            if let Some(m) = app.miner(id) {
                let (row, name, e) = (m.row.clone(), m.name(), app.engine.clone());
                app.st.axepool.pointing = Some(id);
                app.st.axepool.point = Some(app.spawn(ctx, async move { (name, pool::point_miner(&e, &row, None).await.map_err(|x| x.to_string())) }));
            }
        }
        ui.add_space(14.0);
    }

    // ---- blocks
    if !app.st.axepool.blocks.is_empty() {
        w::card(ui, &p, |ui| {
            w::h3(ui, &p, "Blocks");
            ui.add_space(6.0);
            for b in app.st.axepool.blocks.clone() {
                ui.horizontal(|ui| {
                    let ok = b.result == "accepted";
                    w::dot(ui, if ok { p.good } else { p.bad }, ok);
                    ui.label(RichText::new(format!("#{}", b.height)).font(bold(14.0)));
                    ui.label(RichText::new(format!("{} · {} BTC", b.worker, btc(b.reward as u64))).color(p.dim));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        ui.label(RichText::new(fmt::date(b.ts)).size(11.5).color(p.dim));
                        if !ok {
                            ui.label(RichText::new(&b.result).size(11.5).color(p.bad));
                        } else if w::small(ui, &p, &format!("{}  mempool.space", ic::OPEN)).clicked() {
                            ui.ctx().open_url(egui::OpenUrl::new_tab(format!("https://mempool.space/block/{}", b.hash)));
                        }
                    });
                });
            }
        });
        ui.add_space(14.0);
    }

    settings(app, ui, &st);
}

fn copy_row(ui: &mut egui::Ui, app: &mut App, label: &str, value: &str) {
    let p = app.pal;
    let mut copied = false;
    ui.horizontal(|ui| {
        ui.set_min_height(28.0);
        ui.allocate_ui_with_layout(egui::vec2(80.0, 20.0), egui::Layout::left_to_right(egui::Align::Center), |ui| {
            ui.set_width(80.0);
            ui.label(RichText::new(label).color(p.dim));
        });
        let vw = (ui.available_width() - 48.0 - ui.spacing().item_spacing.x * 2.0).max(60.0);
        ui.allocate_ui_with_layout(egui::vec2(vw, 20.0), egui::Layout::left_to_right(egui::Align::Center), |ui| {
            ui.set_width(vw);
            ui.add(egui::Label::new(RichText::new(value).font(egui::FontId::monospace(13.0)).color(p.text)).truncate()).on_hover_text(value);
        });
        if w::small(ui, &p, ic::COPY).on_hover_text("Copy").clicked() {
            ui.ctx().copy_text(value.to_string());
            copied = true;
        }
    });
    if copied {
        app.toast(format!("{label} copied"), Tone::Ok);
    }
}

fn intro(app: &mut App, ui: &mut egui::Ui) {
    let p = app.pal;
    w::card_ex(ui, &p, true, |ui| {
        ui.label(RichText::new("Solo mine on your own node").font(bold(20.0)));
        ui.add_space(6.0);
        ui.label(RichText::new(
            "AxePool runs a small stratum pool inside AxeMobile. Your miners get their work straight from your own Bitcoin node, and if one of them finds a block the whole reward goes to your address. There are no fees and no middleman, and nothing is shared with anyone else.",
        ).color(p.dim));
        ui.add_space(8.0);
        ui.label(RichText::new("You need a Bitcoin Core node you can reach over RPC: one on this computer, or the Bitcoin Node app on your Umbrel (its RPC login is under Connect in that app).").color(p.dim));
        ui.add_space(12.0);
        if w::primary(ui, &p, &format!("{}  Turn on AxePool", ic::AXEPOOL)).clicked() {
            app.set_setting("pool_enabled", "1");
            app.engine.pool_wake.notify_one();
        }
    });
}

fn settings(app: &mut App, ui: &mut egui::Ui, st: &Status) {
    let p = app.pal;
    let fixed = |k: &str| app.engine.is_fixed(k);
    let node_fixed = fixed("node_url");
    let pass_set = !app.setting("node_pass").is_empty();
    let mut save = false;
    let mut toggle: Option<bool> = None;
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Settings");
        ui.add_space(4.0);
        let mut on = st.enabled;
        if w::switch_row(ui, &p, "Run AxePool", "Listens for miners on the stratum port while AxeMobile is open.", &mut on) {
            toggle = Some(on);
        }
        let s = &mut app.st.axepool;
        w::cols(ui, 2, 14.0, |i, ui| {
            if i == 0 {
                field(ui, &p, "Payout address (used when a worker name has no address)", &mut s.address, false, false);
                field(ui, &p, "Stratum port", &mut s.port, fixed("pool_port"), false);
                ui.add_space(4.0);
                ui.label(RichText::new("Coinbase tag").size(12.0).color(p.dim));
                ui.label(RichText::new(pool::COINBASE_TAG).font(egui::FontId::monospace(13.0)).color(p.text))
                    .on_hover_text("Written into every block AxePool finds, so it shows up on block explorers");
            } else if node_fixed {
                ui.add_space(4.0);
                ui.label(RichText::new("Bitcoin node").size(12.0).color(p.dim));
                ui.label(RichText::new("Set up by Umbrel: AxePool uses the Bitcoin Node app on this device.").color(p.text));
            } else {
                field(ui, &p, "Node RPC address", &mut s.url, false, false);
                field(ui, &p, "RPC user", &mut s.user, false, false);
                let hint = if pass_set { "saved; leave empty to keep it" } else { "" };
                ui.add_space(4.0);
                ui.label(RichText::new("RPC password").size(12.0).color(p.dim));
                ui.add(egui::TextEdit::singleline(&mut s.pass).password(true).hint_text(hint).desired_width(f32::INFINITY));
                if ui.link(RichText::new(if s.show_node { "Hide cookie option" } else { "Use a .cookie file instead" }).size(12.0)).clicked() {
                    s.show_node = !s.show_node;
                }
                if s.show_node || !s.cookie.is_empty() {
                    field(ui, &p, "Path to bitcoind's .cookie (when the user is empty)", &mut s.cookie, false, false);
                }
            }
        });
        ui.add_space(10.0);
        if w::primary(ui, &p, &format!("{}  Save", ic::SAVE)).clicked() {
            save = true;
        }
    });
    if let Some(on) = toggle {
        app.set_setting("pool_enabled", if on { "1" } else { "0" });
        app.engine.pool_wake.notify_one();
    }
    if save {
        let s = &app.st.axepool;
        let port = s.port.trim().parse::<u16>().ok().filter(|p| *p >= 1024).map(|p| p.to_string());
        let vals: Vec<(&str, String)> = vec![
            ("pool_address", s.address.trim().to_string()),
            ("node_url", s.url.trim().to_string()),
            ("node_user", s.user.trim().to_string()),
            ("node_cookie", s.cookie.trim().to_string()),
        ];
        let pass = s.pass.clone();
        let bad_port = port.is_none() && !app.engine.is_fixed("pool_port");
        for (k, v) in vals {
            if !app.engine.is_fixed(k) {
                app.set_setting(k, &v);
            }
        }
        if let Some(port) = port {
            if !app.engine.is_fixed("pool_port") {
                app.set_setting("pool_port", &port);
            }
        }
        if !pass.is_empty() && !app.engine.is_fixed("node_pass") {
            app.set_setting("node_pass", &pass);
            app.st.axepool.pass.clear();
        }
        app.engine.pool_wake.notify_one();
        if bad_port {
            app.toast("Saved, but the port must be a number from 1024 to 65535", Tone::Err);
        } else {
            app.toast("Saved", Tone::Ok);
        }
    }
}

fn field(ui: &mut egui::Ui, p: &crate::theme::Pal, label: &str, v: &mut String, locked: bool, _secret: bool) {
    ui.add_space(4.0);
    ui.label(RichText::new(label).size(12.0).color(p.dim));
    ui.add_enabled(!locked, egui::TextEdit::singleline(v).desired_width(f32::INFINITY));
}
