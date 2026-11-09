use std::sync::Arc;

use axe_core::Engine;
use eframe::egui::{self, RichText, Sense};

use crate::app::{App, Page, Tone};
use crate::fmt;
use crate::jobs;
use crate::widgets::{self as w, bold, ic};

use super::{header, kind_tag, status_pill, LoginState};

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
    let mut open: Option<i64> = None;
    let mut login: Option<i64> = None;
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Miners");
        ui.add_space(4.0);
        if miners.is_empty() {
            ui.label(RichText::new("No miners yet. Add one above, or press Ctrl+N.").color(p.dim));
            return;
        }
        let widths = [0.24, 0.20, 0.12, 0.09, 0.09, 0.09, 0.09];
        let total = ui.available_width() - 110.0;
        let head = ["Miner", "Model", "Hashrate", "Temp", "Power", "Best", "Uptime"];
        ui.horizontal(|ui| {
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
            let resp = ui.horizontal(|ui| {
                ui.set_min_height(46.0);
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
                cell(ui, 1, &mut |ui| {
                    ui.horizontal(|ui| {
                        ui.add(egui::Label::new(RichText::new(&m.row.model).color(p.dim)).truncate());
                        kind_tag(ui, app, &m.row.kind);
                    });
                });
                let on = m.online();
                cell(ui, 2, &mut |ui| { ui.label(if on { fmt::hash_str(s.and_then(|s| s.hashrate)) } else { "–".into() }); });
                cell(ui, 3, &mut |ui| { ui.label(RichText::new(if on { format!("{}°", fmt::num(s.and_then(|s| s.temp), 1)) } else { "–".into() }).color(w::temp_color(&p, s.and_then(|s| s.temp)))); });
                cell(ui, 4, &mut |ui| { ui.label(if on { format!("{} W", fmt::num(s.and_then(|s| s.power), 1)) } else { "–".into() }); });
                cell(ui, 5, &mut |ui| { ui.label(fmt::diff(m.best())); });
                cell(ui, 6, &mut |ui| { ui.label(if on { fmt::uptime(s.and_then(|s| s.uptime)) } else if m.live.last_seen > 0 { fmt::ago(m.live.last_seen) } else { "–".into() }); });
                status_pill(ui, app, m);
            });
            let hit = ui.interact(resp.response.rect, ui.scope_id().with(("row", m.row.id)), Sense::click());
            if hit.hovered() {
                ui.painter().rect_filled(resp.response.rect, 6, crate::theme::alpha(p.panel2, 0.5));
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if hit.clicked() {
                if m.needs_login() { login = Some(m.row.id) } else { open = Some(m.row.id) }
            }
        }
    });
    if let Some(id) = open {
        app.page = Page::Miner(id);
    }
    if let Some(id) = login {
        app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
    }
}
