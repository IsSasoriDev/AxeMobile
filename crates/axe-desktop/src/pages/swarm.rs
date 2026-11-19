use std::sync::Arc;

use axe_core::Engine;
use eframe::egui::{self, RichText, Sense};

use crate::app::{App, Page, Tone};
use crate::fmt;
use crate::jobs;
use crate::widgets::{self as w, bold, ic};

use super::{header, kind_tag, modal, status_pill, LoginState};

/// "Set pool" on several miners at once.
pub struct BulkPool {
    pub ids: Vec<i64>,
    pub url: String,
    pub port: String,
    pub user: String,
    pub pass: String,
    pub worker: bool,
    pub err: String,
}

/// Worker names may only hold letters, digits, - and _.
fn worker_name(name: &str) -> String {
    let s: String = name.chars().map(|c| if c.is_ascii_alphanumeric() || c == '_' || c == '-' { c } else { '-' }).collect();
    let s = s.trim_matches('-').to_string();
    if s.is_empty() { "miner".into() } else { s }
}

/// Restarts the given miners, one after another. Returns a summary.
async fn restart_many(e: Arc<Engine>, ids: Vec<i64>) -> String {
    let (mut ok, mut fails) = (0, vec![]);
    for id in ids {
        let Ok(Some(m)) = e.db.miner(id) else { continue };
        let name = if m.name.is_empty() { m.ip.clone() } else { m.name.clone() };
        match e.restart(&m).await {
            Ok(_) => {
                ok += 1;
                let _ = e.db.add_event(Some(id), "restart", &format!("Restart sent to {name}"));
            }
            Err(x) => fails.push(format!("{name}: {x}")),
        }
    }
    if fails.is_empty() { format!("Restarting {ok} miner{}", if ok == 1 { "" } else { "s" }) } else { format!("{ok} restarting, {} failed. {}", fails.len(), fails[0]) }
}

pub fn bulk_pool_modal(app: &mut App, ctx: &egui::Context) {
    let p = app.pal;
    if let Some(msg) = jobs::poll(&mut app.st.swarm.bulk) {
        let bad = msg.contains("failed");
        app.toast(msg, if bad { Tone::Err } else { Tone::Ok });
        app.refresh_now();
    }
    let Some(b) = app.st.swarm.bulk_pool.as_mut() else { return };
    let names: Vec<(i64, String, String, String, String)> = app
        .miners
        .iter()
        .filter(|m| b.ids.contains(&m.row.id))
        .map(|m| (m.row.id, m.name(), m.row.ip.clone(), m.row.kind.clone(), m.row.session.clone()))
        .collect();
    let mut go = false;
    let mut close = false;
    let first = names.first().map(|n| worker_name(&n.1)).unwrap_or_default();
    modal(ctx, &p, "bulk-pool", &format!("Set pool on {} miner{}", names.len(), if names.len() == 1 { "" } else { "s" }), |ui| {
        ui.label(RichText::new("Replaces each miner's first pool. Fallback pools stay as they are. AxeOS miners restart to switch.").color(p.dim));
        ui.add_space(8.0);
        ui.label(RichText::new("Stratum host").size(12.0).color(p.dim));
        ui.horizontal(|ui| {
            ui.add(egui::TextEdit::singleline(&mut b.url).hint_text("public-pool.io").desired_width(ui.available_width() - 90.0));
            ui.add(egui::TextEdit::singleline(&mut b.port).hint_text("3333").desired_width(80.0));
        });
        ui.label(RichText::new("Bitcoin address").size(12.0).color(p.dim));
        ui.add(egui::TextEdit::singleline(&mut b.user).hint_text("bc1q…").desired_width(f32::INFINITY));
        ui.label(RichText::new("Password").size(12.0).color(p.dim));
        ui.add(egui::TextEdit::singleline(&mut b.pass).hint_text("x").desired_width(f32::INFINITY));
        ui.add_space(6.0);
        w::switch_row(ui, &p, "Add each miner's name as the worker", &format!("bc1q….{first}, so the pool shows them apart."), &mut b.worker);
        if !b.err.is_empty() {
            ui.label(RichText::new(&b.err).color(p.bad));
        }
        ui.add_space(6.0);
        ui.horizontal(|ui| {
            if w::primary(ui, &p, &format!("Set on {}", names.len())).clicked() {
                go = true;
            }
            if w::alt(ui, &p, "Cancel").clicked() {
                close = true;
            }
        });
    });
    if go {
        let port: u32 = b.port.trim().parse().unwrap_or(0);
        if b.url.trim().is_empty() || b.user.trim().is_empty() || port == 0 {
            b.err = "Fill in the host, port and address.".into();
            return;
        }
        let (url, user, pass, worker) = (b.url.trim().to_string(), b.user.trim().to_string(), b.pass.clone(), b.worker);
        let e = app.engine.clone();
        app.st.swarm.bulk = Some(app.spawn(ctx, async move {
            let (mut ok, mut fails, mut axeos) = (0, vec![], vec![]);
            for (id, name, ip, kind, session) in names {
                let u = if worker && !user.contains('.') { format!("{user}.{}", worker_name(&name)) } else { user.clone() };
                let cfg = axe_core::miner::PoolConfig {
                    pools: vec![axe_core::miner::PoolEntry { enabled: true, url: url.clone(), port, user: u, pass: pass.clone(), weight: None, connected: None }],
                    mode: String::new(),
                    needs_restart: false,
                };
                match e.client.set_pools(&ip, &kind, &session, &cfg).await {
                    Ok(_) => {
                        ok += 1;
                        let _ = e.db.add_event(Some(id), "config", &format!("Pools changed on {name}"));
                        if kind == axe_core::miner::AXEOS {
                            axeos.push(id);
                        }
                    }
                    Err(x) => fails.push(format!("{name}: {x}")),
                }
            }
            let n = axeos.len();
            if n > 0 {
                restart_many(e, axeos).await;
            }
            if fails.is_empty() {
                format!("Pool set on {ok} miner{}{}", if ok == 1 { "" } else { "s" }, if n > 0 { format!(", restarting {n} AxeOS") } else { String::new() })
            } else {
                format!("{ok} updated, {} failed. {}", fails.len(), fails[0])
            }
        }));
        app.st.swarm.bulk_pool = None;
        app.st.swarm.sel.clear();
    } else if close {
        app.st.swarm.bulk_pool = None;
    }
}

/// Same steps as the API's add: probe, store, log, poll.
async fn add_miner(e: Arc<Engine>, ip: String, name: String) -> Result<String, String> {
    let ip = ip.trim().trim_start_matches("http://").trim_start_matches("https://").trim_end_matches('/').to_string();
    if ip.is_empty() {
        return Err("Enter an IP address or hostname".into());
    }
    if e.db.miner_by_ip(&ip).map_err(|x| x.to_string())?.is_some() {
        return Err(format!("{ip} is already in the list"));
    }
    let f = e.client.detect_slow(&ip).await.ok_or_else(|| format!("No AxeForge or AxeOS miner answered at {ip}"))?;
    let name = if name.trim().is_empty() { if f.hostname.is_empty() { f.model.clone() } else { f.hostname.clone() } } else { name.trim().to_string() };
    let id = e.db.add_miner(&ip, &name, &f.kind, &f.model).map_err(|x| x.to_string())?;
    let _ = e.db.add_event(Some(id), "added", &format!("Added {name} ({}) at {ip}", f.model));
    e.poll_once().await;
    Ok(format!("Added {name}"))
}

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context) {
    let p = app.pal;
    if app.st.swarm.subnet.is_empty() {
        app.st.swarm.subnet = axe_core::guess_subnet();
    }
    // finished background work
    if let Some(r) = jobs::poll(&mut app.st.swarm.add) {
        match r {
            Ok(msg) => {
                app.toast(msg, Tone::Ok);
                app.st.swarm.ip.clear();
                app.st.swarm.name.clear();
                app.refresh_now();
            }
            Err(e) => app.toast(e, Tone::Err),
        }
    }
    if let Some((base, found)) = jobs::poll(&mut app.st.swarm.scan) {
        app.toast(if found.is_empty() { format!("No miners on {base}.x") } else { format!("Found {} miner(s) on {base}.x", found.len()) }, Tone::Info);
        app.st.swarm.found = Some(found);
        app.st.swarm.peers = None;
    }
    if let Some(r) = jobs::poll(&mut app.st.swarm.peers_job) {
        match r {
            Ok(v) => {
                if v.1.is_empty() {
                    app.toast(format!("{} doesn't know any other miners", v.0), Tone::Info);
                }
                app.st.swarm.peers = Some(v);
                app.st.swarm.found = None;
            }
            Err(e) => app.toast(e, Tone::Err),
        }
    }

    let f = app.fleet.clone();
    header(ui, app, "Swarm", |ui| {
        if f.total > 0 {
            ui.label(RichText::new(format!("{} of {} online · {} · {:.0} W", f.online, f.total, fmt::hash_str(Some(f.hashrate)), f.power)).color(p.dim));
        }
    });

    let busy_add = app.st.swarm.add.is_some();
    let busy_scan = app.st.swarm.scan.is_some();
    let forge: Vec<(i64, String, axe_core::db::MinerRow)> = app.miners.iter().filter(|m| m.row.kind == "axeforge" && m.online()).map(|m| (m.row.id, m.name(), m.row.clone())).collect();
    let mut do_add = false;
    let mut do_scan = false;
    let mut peers_of: Option<(String, axe_core::db::MinerRow)> = None;
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(150.0);
            if i == 0 {
                w::h3(ui, &p, "Add a miner");
                ui.add_space(4.0);
                let st = &mut app.st.swarm;
                ui.label(RichText::new("IP address or hostname").size(12.0).color(p.dim));
                let r = ui.add(egui::TextEdit::singleline(&mut st.ip).hint_text("192.168.1.50").desired_width(f32::INFINITY));
                if st.focus {
                    r.request_focus();
                    st.focus = false;
                }
                let enter = r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));
                ui.label(RichText::new("Name (optional)").size(12.0).color(p.dim));
                ui.add(egui::TextEdit::singleline(&mut st.name).hint_text("uses the miner's hostname").desired_width(f32::INFINITY));
                ui.add_space(6.0);
                ui.horizontal(|ui| {
                    if (w::primary(ui, &p, &format!("{}  {}", ic::ADD, if busy_add { "Adding…" } else { "Add" })).clicked() || enter) && !busy_add {
                        do_add = true;
                    }
                    ui.label(RichText::new("AxeMobile works out whether it runs AxeForge or AxeOS.").size(12.0).color(p.dim));
                });
            } else {
                w::h3(ui, &p, "Scan the network");
                ui.add_space(4.0);
                ui.label(RichText::new("Subnet (/24)").size(12.0).color(p.dim));
                ui.horizontal(|ui| {
                    ui.add(egui::TextEdit::singleline(&mut app.st.swarm.subnet).hint_text("192.168.1").desired_width(ui.available_width() - 130.0));
                    if w::primary(ui, &p, &format!("{}  {}", ic::SEARCH, if busy_scan { "Scanning…" } else { "Scan" })).clicked() && !busy_scan {
                        do_scan = true;
                    }
                });
                ui.label(RichText::new("Checks .1 to .254 for AxeForge and AxeOS miners. Takes about 10 seconds.").size(12.0).color(p.dim));
                if !forge.is_empty() {
                    ui.add_space(8.0);
                    ui.horizontal_wrapped(|ui| {
                        for (_, name, row) in &forge {
                            if w::small(ui, &p, &format!("Import {name}'s swarm")).clicked() {
                                peers_of = Some((name.clone(), row.clone()));
                            }
                        }
                    });
                }
            }
        });
    });
    ui.add_space(14.0);

    if app.st.swarm.auto_scan {
        app.st.swarm.auto_scan = false;
        if app.st.swarm.scan.is_none() {
            do_scan = true;
        }
    }
    if do_add {
        let (e, ip, name) = (app.engine.clone(), app.st.swarm.ip.clone(), app.st.swarm.name.clone());
        app.st.swarm.add = Some(app.spawn(ctx, add_miner(e, ip, name)));
    }
    if do_scan {
        match axe_core::subnet_base(&app.st.swarm.subnet) {
            Some(base) => {
                app.set_setting("scan_subnet", &base);
                let e = app.engine.clone();
                app.st.swarm.scan = Some(app.spawn(ctx, async move {
                    let f = e.scan(&base).await;
                    (base, f)
                }));
            }
            None => app.toast("Subnet should look like 192.168.1", Tone::Err),
        }
    }
    if let Some((name, row)) = peers_of {
        let e = app.engine.clone();
        app.st.swarm.peers_job = Some(app.spawn(ctx, async move {
            e.client.swarm(&row.ip, &row.session).await.map(|v| (name, v)).map_err(|x| x.to_string())
        }));
    }

    // scan or swarm results
    let known: Vec<String> = app.miners.iter().map(|m| m.row.ip.clone()).collect();
    let mut add_from: Option<(String, String)> = None;
    let mut close = false;
    if app.st.swarm.found.is_some() || app.st.swarm.peers.is_some() {
        let found = app.st.swarm.found.clone();
        let peers = app.st.swarm.peers.clone();
        w::card(ui, &p, |ui| {
            let title = if let Some((from, _)) = &peers { format!("Miners {from} knows about") } else { format!("Found on {}.x", app.st.swarm.subnet) };
            w::h3_row(ui, &p, &title, |ui| {
                if w::small(ui, &p, "Close").clicked() {
                    close = true;
                }
            });
            let rows: Vec<(String, String, String, Option<f64>)> = match (&found, &peers) {
                (Some(f), _) => f.iter().map(|x| (x.ip.clone(), x.hostname.clone(), x.model.clone(), x.hashrate)).collect(),
                (_, Some((_, list))) => list.iter().map(|x| (x.ip.clone(), x.name.clone(), x.model.clone(), None)).collect(),
                _ => vec![],
            };
            if rows.is_empty() {
                ui.label(RichText::new("Nothing answered. Check the subnet, or add the miner by IP.").color(p.dim));
            }
            egui::Grid::new("found").num_columns(5).spacing([24.0, 10.0]).striped(false).show(ui, |ui| {
                for (ip, name, model, hr) in rows {
                    ui.label(RichText::new(&ip).monospace());
                    ui.label(if name.is_empty() { "–".to_string() } else { name.clone() });
                    ui.label(RichText::new(model).color(p.dim));
                    ui.label(hr.map(|h| fmt::hash_str(Some(h))).unwrap_or_default());
                    if known.contains(&ip) {
                        ui.label(RichText::new("added").color(p.dim));
                    } else if w::button(ui, &p, w::Kind::Primary, true, "Add").clicked() {
                        add_from = Some((ip, name));
                    }
                    ui.end_row();
                }
            });
        });
        ui.add_space(14.0);
    }
    if close {
        app.st.swarm.found = None;
        app.st.swarm.peers = None;
    }
    if let Some((ip, name)) = add_from {
        if app.st.swarm.add.is_none() {
            let e = app.engine.clone();
            app.st.swarm.add = Some(app.spawn(ctx, add_miner(e, ip, name)));
        }
    }

    // fleet table
    let miners = app.miners.clone();
    let health = app.health.clone();
    app.st.swarm.sel.retain(|id| miners.iter().any(|m| m.row.id == *id));
    let mut open: Option<i64> = None;
    let mut login: Option<i64> = None;
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Miners");
        ui.add_space(4.0);
        if miners.is_empty() {
            ui.label(RichText::new("No miners yet. Add one above, or press Ctrl+N.").color(p.dim));
            return;
        }
        let widths = [0.19, 0.08, 0.15, 0.15, 0.11, 0.08, 0.08, 0.08, 0.08];
        // checkbox column, status pill, and the gaps between the cells
        let total = ui.available_width() - 110.0 - 30.0 - ui.spacing().item_spacing.x * (widths.len() as f32 + 1.0);
        let head = ["Miner", "Health", "Model", "Firmware", "Hashrate", "Temp", "Power", "Best", "Uptime"];
        let all_on = !miners.is_empty() && miners.iter().all(|m| app.st.swarm.sel.contains(&m.row.id));
        ui.horizontal(|ui| {
            let mut all = all_on;
            if w::check(ui, &p, &mut all).on_hover_text("Select all").changed() {
                app.st.swarm.sel = if all { miners.iter().map(|m| m.row.id).collect() } else { vec![] };
            }
            ui.add_space(4.0);
            for (i, h) in head.iter().enumerate() {
                ui.allocate_ui(egui::vec2(total * widths[i], 18.0), |ui| {
                    ui.set_width(total * widths[i]);
                    ui.label(RichText::new(h.to_uppercase()).font(bold(10.5)).color(p.dim));
                });
            }
            ui.label(RichText::new("STATUS").font(bold(10.5)).color(p.dim));
        });
        for m in &miners {
            let s = m.snap();
            let r = ui.available_rect_before_wrap();
            ui.painter().hline(r.x_range(), r.top(), egui::Stroke::new(1.0, p.line));
            let mut ticked = app.st.swarm.sel.contains(&m.row.id);
            let mut tick_changed = false;
            let resp = ui.horizontal(|ui| {
                ui.set_min_height(46.0);
                tick_changed = w::check(ui, &p, &mut ticked).changed();
                ui.add_space(4.0);
                let cell = |ui: &mut egui::Ui, i: usize, f: &mut dyn FnMut(&mut egui::Ui)| {
                    ui.allocate_ui(egui::vec2(total * widths[i], 40.0), |ui| {
                        ui.set_width(total * widths[i]);
                        f(ui);
                    });
                };
                cell(ui, 0, &mut |ui| {
                    ui.vertical(|ui| {
                        ui.horizontal(|ui| {
                            w::dot(ui, if m.online() { p.good } else if s.is_some() { p.bad } else { p.warn }, m.online());
                            ui.add(egui::Label::new(RichText::new(m.name()).font(bold(14.0))).truncate());
                        });
                        ui.label(RichText::new(&m.row.ip).monospace().size(11.5).color(p.dim));
                    });
                });
                let h = health.get(&m.row.id);
                cell(ui, 1, &mut |ui| { w::score(ui, &p, h, false); });
                cell(ui, 2, &mut |ui| {
                    ui.horizontal(|ui| {
                        ui.add(egui::Label::new(RichText::new(&m.row.model).color(p.dim)).truncate());
                        kind_tag(ui, app, &m.row.kind);
                    });
                });
                cell(ui, 3, &mut |ui| {
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(s.map(|s| s.version.as_str()).filter(|v| !v.is_empty()).unwrap_or("–")).monospace().size(12.0));
                        if let Some(u) = h.and_then(|h| h.update.as_ref()) {
                            let r = ui.add(egui::Label::new(RichText::new(format!("↑ {}", u.latest)).font(bold(10.5)).color(p.warn)).sense(Sense::click()));
                            if r.clone().on_hover_text(format!("{} is out. Opens the release notes.", u.latest)).clicked() {
                                ui.ctx().open_url(egui::OpenUrl::new_tab(&u.url));
                            }
                            if r.hovered() {
                                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
                            }
                        }
                    });
                });
                let on = m.online();
                cell(ui, 4, &mut |ui| { ui.label(if on { fmt::hash_str(s.and_then(|s| s.hashrate)) } else { "–".into() }); });
                cell(ui, 5, &mut |ui| { ui.label(RichText::new(if on { format!("{}°", fmt::num(s.and_then(|s| s.temp), 1)) } else { "–".into() }).color(w::temp_color(&p, s.and_then(|s| s.temp)))); });
                cell(ui, 6, &mut |ui| { ui.label(if on { format!("{} W", fmt::num(s.and_then(|s| s.power), 1)) } else { "–".into() }); });
                cell(ui, 7, &mut |ui| { ui.label(fmt::diff(m.best())); });
                cell(ui, 8, &mut |ui| { ui.label(if on { fmt::uptime(s.and_then(|s| s.uptime)) } else if m.live.last_seen > 0 { fmt::ago(m.live.last_seen) } else { "–".into() }); });
                status_pill(ui, app, m);
            });
            if tick_changed {
                if ticked { app.st.swarm.sel.push(m.row.id) } else { app.st.swarm.sel.retain(|x| *x != m.row.id) }
            }
            // the checkbox column keeps its own clicks
            let mut row_rect = resp.response.rect;
            row_rect.min.x += 30.0;
            let hit = ui.interact(row_rect, ui.scope_id().with(("row", m.row.id)), Sense::click());
            if hit.hovered() {
                ui.painter().rect_filled(resp.response.rect, 6, crate::theme::alpha(p.panel2, 0.5));
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if hit.clicked() {
                if m.needs_login() { login = Some(m.row.id) } else { open = Some(m.row.id) }
            }
        }
    });
    // bulk actions for the ticked miners
    let n = app.st.swarm.sel.len();
    if n > 0 {
        ui.add_space(14.0);
        let mut set_pool = false;
        let mut restart = false;
        let mut clear = false;
        let busy = app.st.swarm.bulk.is_some();
        egui::Frame::new()
            .fill(p.panel)
            .stroke(egui::Stroke::new(1.0, crate::theme::alpha(p.pri, 0.5)))
            .corner_radius(14)
            .inner_margin(egui::Margin::symmetric(14, 10))
            .show(ui, |ui| {
                ui.set_min_width(ui.available_width());
                ui.horizontal(|ui| {
                    ui.label(RichText::new(format!("{n} selected")).font(bold(14.0)));
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                        if w::small(ui, &p, "Clear").clicked() {
                            clear = true;
                        }
                        if w::confirm_button(ui, &p, true, &format!("{}  Restart", ic::RESTART), &format!("Restart {n}?")) && !busy {
                            restart = true;
                        }
                        if w::small(ui, &p, &format!("{}  Set pool", ic::POOLS)).clicked() && !busy {
                            set_pool = true;
                        }
                        if busy {
                            ui.label(RichText::new("Working…").color(p.dim));
                        }
                    });
                });
            });
        if clear {
            app.st.swarm.sel.clear();
        }
        if set_pool {
            app.st.swarm.bulk_pool = Some(BulkPool {
                ids: app.st.swarm.sel.clone(),
                url: String::new(),
                port: "3333".into(),
                user: String::new(),
                pass: String::new(),
                worker: true,
                err: String::new(),
            });
        }
        if restart {
            let ids = std::mem::take(&mut app.st.swarm.sel);
            app.st.swarm.bulk = Some(app.spawn(ctx, restart_many(app.engine.clone(), ids)));
        }
    }
    if let Some(id) = open {
        app.page = Page::Miner(id);
    }
    if let Some(id) = login {
        app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
    }
}
