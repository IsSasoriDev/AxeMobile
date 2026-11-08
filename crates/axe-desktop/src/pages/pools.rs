use axe_core::miner::{PoolConfig, PoolEntry};
use eframe::egui::{self, RichText};

use crate::app::{App, Tone};
use crate::jobs;
use crate::widgets::{self as w, bold, ic};

use super::{header, kind_tag, modal, picker, LoginState};

const PRESETS: [(&str, &str, u32); 4] = [
    ("Public Pool", "public-pool.io", 21496),
    ("CKPool solo", "solo.ckpool.org", 3333),
    ("OCEAN", "mine.ocean.xyz", 3334),
    ("Braiins", "stratum.braiins.com", 3333),
];

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context) {
    let p = app.pal;
    if app.st.pools.sel.is_none() || app.st.pools.sel.is_some_and(|id| app.miner(id).is_none()) {
        app.st.pools.sel = app.miners.first().map(|m| m.row.id);
    }
    let sel_kind = app.st.pools.sel.and_then(|id| app.miner(id)).map(|m| m.row.kind.clone()).unwrap_or_default();
    header(ui, app, "Pools", |ui| {
        if !sel_kind.is_empty() {
            kind_tag(ui, app, &sel_kind);
        }
    });
    if app.miners.is_empty() {
        w::card(ui, &p, |ui| { ui.label(RichText::new("Add a miner first.").color(p.dim)); });
        return;
    }
    let mut sel = app.st.pools.sel;
    picker(app, ui, &mut sel);
    app.st.pools.sel = sel;
    let Some(id) = sel else { return };
    let Some(m) = app.miner(id).cloned() else { return };

    // (re)load when the selection changes
    if app.st.pools.loaded_for != Some(id) && app.st.pools.load.is_none() {
        app.st.pools.loaded_for = Some(id);
        app.st.pools.cfg = None;
        app.st.pools.err.clear();
        let (e, row) = (app.engine.clone(), m.row.clone());
        app.st.pools.load = Some(app.spawn(ctx, async move { e.client.pools(&row.ip, &row.kind, &row.session).await.map_err(|x| x.to_string()) }));
    }
    if let Some(r) = jobs::poll(&mut app.st.pools.load) {
        match r {
            Ok(c) => app.st.pools.cfg = Some(c),
            Err(e) => app.st.pools.err = e,
        }
    }
    if let Some(r) = jobs::poll(&mut app.st.pools.save) {
        match r {
            Ok(msg) => {
                app.toast(if msg.trim().is_empty() { "Saved".to_string() } else { msg }, Tone::Ok);
                app.st.pools.loaded_for = None;
            }
            Err(e) => {
                if e == "login required" {
                    app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
                }
                app.toast(e, Tone::Err);
            }
        }
    }

    if !app.st.pools.err.is_empty() {
        let err = app.st.pools.err.clone();
        super::miner::notice(ui, &p, p.bad, &format!("Couldn't read pools from {}: {err}", m.name()));
        ui.horizontal(|ui| {
            if err == "login required" && w::primary(ui, &p, &format!("{}  Log in", ic::LOCK)).clicked() {
                app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
            }
            if w::alt(ui, &p, "Retry").clicked() {
                app.st.pools.loaded_for = None;
            }
        });
        return;
    }
    let Some(mut cfg) = app.st.pools.cfg.clone() else {
        w::card(ui, &p, |ui| { ui.label(RichText::new(format!("Reading pools from {}…", m.name())).color(p.dim)); });
        return;
    };
    let forge = m.row.kind == "axeforge";

    if forge {
        w::card(ui, &p, |ui| {
            w::h3(ui, &p, "Mode");
            let mut mode = if cfg.mode == "failover" { "failover" } else { "split" };
            if w::seg(ui, &p, &mut mode, &[("split", "Split by %"), ("failover", "Failover")], false) {
                cfg.mode = mode.to_string();
            }
            ui.label(RichText::new(if mode == "failover" {
                "Mines on the first enabled pool and moves down the list when it drops."
            } else {
                "Splits the miner's work between the enabled pools by weight. The miner normalises the weights."
            }).size(12.0).color(p.dim));
        });
    } else {
        super::miner::notice(ui, &p, p.violet, "AxeOS has a main pool and a fallback. The miner needs a restart to pick up pool changes.");
    }
    ui.add_space(14.0);

    let total: u32 = cfg.pools.iter().filter(|x| x.enabled).map(|x| x.weight.unwrap_or(0)).sum();
    let mode = cfg.mode.clone();
    let n = cfg.pools.len();
    for i in 0..n {
        let pool: &mut PoolEntry = &mut cfg.pools[i];
        let title = if forge { format!("Pool {}", i + 1) } else if i == 0 { "Main pool".into() } else { "Fallback pool".into() };
        w::card(ui, &p, |ui| {
            ui.horizontal(|ui| {
                w::dot(ui, if pool.connected == Some(true) { p.good } else { p.dim }, pool.connected == Some(true));
                ui.label(RichText::new(&title).font(bold(15.0)));
                if pool.connected == Some(true) {
                    w::tag(ui, &p, "in use", None);
                }
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if forge || i > 0 {
                        w::toggle(ui, &p, &mut pool.enabled);
                    }
                });
            });
            ui.scope(|ui| {
                ui.horizontal(|ui| {
                    let wd = ui.available_width();
                    ui.vertical(|ui| {
                        ui.set_width(wd * 0.68);
                        ui.label(RichText::new("Stratum host").size(12.0).color(p.dim));
                        ui.add(egui::TextEdit::singleline(&mut pool.url).hint_text("public-pool.io").desired_width(f32::INFINITY));
                    });
                    ui.vertical(|ui| {
                        ui.label(RichText::new("Port").size(12.0).color(p.dim));
                        let mut port = pool.port.to_string();
                        if ui.add(egui::TextEdit::singleline(&mut port).desired_width(f32::INFINITY)).changed() {
                            pool.port = port.trim().parse().unwrap_or(pool.port);
                        }
                    });
                });
                ui.horizontal(|ui| {
                    let wd = ui.available_width();
                    ui.vertical(|ui| {
                        ui.set_width(wd * 0.68);
                        ui.label(RichText::new("Username (address.worker)").size(12.0).color(p.dim));
                        ui.add(egui::TextEdit::singleline(&mut pool.user).hint_text("bc1q….worker").desired_width(f32::INFINITY));
                    });
                    ui.vertical(|ui| {
                        ui.label(RichText::new("Password").size(12.0).color(p.dim));
                        ui.add(egui::TextEdit::singleline(&mut pool.pass).password(true).hint_text("unchanged").desired_width(f32::INFINITY));
                    });
                });
                if forge && mode != "failover" {
                    if let Some(wt) = pool.weight.as_mut() {
                        let share = if total > 0 && pool.enabled { *wt as f32 / total as f32 * 100.0 } else { 0.0 };
                        ui.horizontal(|ui| {
                            ui.label(RichText::new("Share of work").size(12.0).color(p.dim));
                            ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                                ui.label(RichText::new(format!("{share:.0}%")).font(bold(13.0)).color(p.pri));
                            });
                        });
                        ui.spacing_mut().slider_width = ui.available_width() - 70.0;
                        ui.add(egui::Slider::new(wt, 1..=100));
                    }
                }
                ui.add_space(4.0);
                ui.horizontal_wrapped(|ui| {
                    for (name, url, port) in PRESETS {
                        if w::small(ui, &p, name).clicked() {
                            pool.url = url.into();
                            pool.port = port;
                            pool.enabled = true;
                        }
                    }
                });
            });
        });
        ui.add_space(12.0);
    }
    app.st.pools.cfg = Some(cfg.clone());

    let saving = app.st.pools.save.is_some();
    ui.horizontal(|ui| {
        if w::primary(ui, &p, if saving { "Saving…" } else if forge { "Save & reconnect" } else { "Save" }).clicked() && !saving {
            let (e, row, c) = (app.engine.clone(), m.row.clone(), cfg.clone());
            let name = m.name();
            app.st.pools.save = Some(app.spawn(ctx, async move {
                let r = e.client.set_pools(&row.ip, &row.kind, &row.session, &c).await.map_err(|x| x.to_string());
                if r.is_ok() {
                    let _ = e.db.add_event(Some(row.id), "config", &format!("Pools changed on {name}"));
                }
                r
            }));
        }
        if app.miners.len() > 1 && w::alt(ui, &p, &format!("{}  Copy to other miners", ic::COPY)).clicked() {
            app.st.pools.targets.clear();
            app.st.pools.copy_open = true;
        }
        ui.label(RichText::new(if forge { "No reboot needed. An empty password keeps the saved one." } else { "Restart the miner afterwards. An empty password keeps the saved one." }).size(12.0).color(p.dim));
    });
}

pub fn copy_modal(app: &mut App, ctx: &egui::Context) {
    if let Some(results) = jobs::poll(&mut app.st.pools.copy) {
        let bad: Vec<_> = results.iter().filter(|r| r.1.is_err()).collect();
        if bad.is_empty() {
            app.toast(format!("Pools copied to {} miner(s)", results.len()), Tone::Ok);
        } else {
            app.toast(format!("{} failed: {}", bad[0].0, bad[0].1.clone().err().unwrap_or_default()), Tone::Err);
        }
        app.st.pools.copy_open = false;
    }
    if !app.st.pools.copy_open {
        return;
    }
    let p = app.pal;
    let sel = app.st.pools.sel;
    let others: Vec<(i64, String, String)> = app.miners.iter().filter(|m| Some(m.row.id) != sel).map(|m| (m.row.id, m.name(), format!("{} · {}", m.row.model, m.row.ip))).collect();
    let mut go = false;
    let mut close = false;
    let busy = app.st.pools.copy.is_some();
    let targets = &mut app.st.pools.targets;
    modal(ctx, &p, "copy", "Copy pools", |ui| {
        ui.label(RichText::new("Sends this pool setup to the miners you pick. AxeOS miners take the first two pools.").color(p.dim));
        ui.add_space(8.0);
        for (id, name, sub) in &others {
            let mut on = targets.contains(id);
            if w::switch_row(ui, &p, name, sub, &mut on) {
                if on { targets.push(*id) } else { targets.retain(|t| t != id) }
            }
        }
        ui.add_space(8.0);
        ui.horizontal(|ui| {
            if w::primary(ui, &p, &if busy { "Copying…".to_string() } else { format!("Copy to {} miner(s)", targets.len()) }).clicked() && !targets.is_empty() && !busy {
                go = true;
            }
            if w::alt(ui, &p, "Cancel").clicked() {
                close = true;
            }
        });
    });
    if close {
        app.st.pools.copy_open = false;
    }
    if go {
        let Some(cfg): Option<PoolConfig> = app.st.pools.cfg.clone() else { return };
        let rows: Vec<(String, axe_core::db::MinerRow)> = app.miners.iter().filter(|m| app.st.pools.targets.contains(&m.row.id)).map(|m| (m.name(), m.row.clone())).collect();
        let e = app.engine.clone();
        app.st.pools.copy = Some(app.spawn(ctx, async move {
            let mut out = vec![];
            for (name, row) in rows {
                let r = e.client.set_pools(&row.ip, &row.kind, &row.session, &cfg).await.map_err(|x| x.to_string());
                if r.is_ok() {
                    let _ = e.db.add_event(Some(row.id), "config", &format!("Pools changed on {name}"));
                }
                out.push((name, r));
            }
            out
        }));
    }
}
