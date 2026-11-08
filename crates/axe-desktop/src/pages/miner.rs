use eframe::egui::{self, RichText, Sense, Vec2};

use crate::app::{App, Page, Tone};
use crate::fmt;
use crate::widgets::{self as w, bold, ic, icon_font, Series};

use super::{events_list, kind_tag, status_pill, LoginState, RANGES};

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context, now: f64, id: i64) {
    let p = app.pal;
    let Some(m) = app.miner(id).cloned() else {
        w::card(ui, &p, |ui| {
            ui.label("That miner is not in the list any more.");
            if w::alt(ui, &p, "Back to dashboard").clicked() {
                app.page = Page::Dashboard;
            }
        });
        return;
    };
    let s = m.snap().cloned();
    let online = m.online();

    ui.horizontal(|ui| {
        if ui.add(egui::Label::new(RichText::new(ic::BACK).font(icon_font(18.0)).color(p.dim)).sense(Sense::click())).on_hover_text("Back").clicked() {
            app.page = Page::Dashboard;
        }
        ui.add_space(4.0);
        ui.label(RichText::new(m.name()).font(bold(22.0)));
        if ui.add(egui::Label::new(RichText::new(ic::EDIT).font(icon_font(14.0)).color(p.dim)).sense(Sense::click())).on_hover_text("Rename").clicked() {
            app.st.rename = Some((id, m.row.name.clone()));
        }
        ui.label(RichText::new(format!("{} · {}", m.row.model, m.row.ip)).size(13.0).color(p.dim));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            status_pill(ui, app, &m);
            kind_tag(ui, app, &m.row.kind);
        });
    });
    ui.add_space(14.0);

    if m.needs_login() {
        notice(ui, &p, p.violet, "This miner has two-factor login on. Log in so AxeMobile can read and change it.");
        if w::primary(ui, &p, &format!("{}  Log in", ic::LOCK)).clicked() {
            app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
        }
        ui.add_space(12.0);
    } else if !m.live.online && m.live.fails > 0 {
        notice(ui, &p, p.bad, &format!("Not answering{}. The last data is shown below.", if m.live.error.is_empty() { String::new() } else { format!(": {}", m.live.error) }));
    }
    if let Some(f) = s.as_ref().map(|s| s.fault.clone()).filter(|f| !f.is_empty()) {
        notice(ui, &p, p.bad, &format!("Fault: {f}"));
    }

    let hist = app.history(now, Some(id), app.st.miner_range);
    let avail = ui.available_width();
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = 14.0;
        ui.allocate_ui_with_layout(Vec2::new(250.0, 0.0), egui::Layout::top_down(egui::Align::Center), |ui| {
            ui.set_width(250.0);
            w::card(ui, &p, |ui| {
                ui.vertical_centered(|ui| {
                    let sub = s.as_ref().and_then(|s| s.expected).map(|e| format!("expected {}", fmt::hash_str(Some(e)))).unwrap_or_else(|| "hashrate".into());
                    let max = s.as_ref().map(|s| s.expected.unwrap_or(0.0).max(s.hashrate.unwrap_or(0.0))).unwrap_or(1.0).max(1.0);
                    w::gauge(ui, &p, if online { s.as_ref().and_then(|s| s.hashrate) } else { None }, max, &sub);
                });
            });
        });
        let cw = avail - 264.0;
        ui.allocate_ui_with_layout(Vec2::new(cw, 0.0), egui::Layout::top_down(egui::Align::Min), |ui| {
            ui.set_width(cw);
            w::card_ex(ui, &p, true, |ui| {
                let mut r = app.st.miner_range;
                let mut se = app.st.miner_series;
                w::h3_row(ui, &p, "History", |ui| {
                    w::seg(ui, &p, &mut r, &RANGES, true);
                    w::seg(ui, &p, &mut se, &[(Series::Hashrate, "Hashrate"), (Series::Temp, "Temp"), (Series::Power, "Power")], true);
                });
                app.st.miner_range = r;
                app.st.miner_series = se;
                ui.add_space(4.0);
                w::chart(ui, &p, &hist, se, (se == Series::Hashrate).then_some(Series::Temp), 186.0);
            });
        });
    });
    ui.add_space(14.0);

    let g = |f: fn(&axe_core::Snapshot) -> Option<f64>| s.as_ref().and_then(f);
    let temp = g(|s| s.temp);
    let vr = g(|s| s.vr_temp);
    let eff = match (g(|s| s.power), g(|s| s.hashrate)) {
        (Some(pw), Some(h)) if h > 0.0 => Some(pw / (h / 1000.0)),
        _ => None,
    };
    w::cols(ui, 4, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(86.0);
            match i {
                0 => {
                    w::h3(ui, &p, "ASIC temp");
                    w::big(ui, &p, &fmt::num(temp, 1), "°C", Some(w::temp_color(&p, temp)));
                    w::bar(ui, &p, (temp.unwrap_or(0.0) / 85.0) as f32, Some(w::temp_color(&p, temp)));
                }
                1 => {
                    w::h3(ui, &p, "VR temp");
                    w::big(ui, &p, &fmt::num(vr, 1), "°C", Some(w::temp_color(&p, vr.map(|v| v - 15.0))));
                    w::bar(ui, &p, (vr.unwrap_or(0.0) / 110.0) as f32, None);
                }
                2 => {
                    w::h3(ui, &p, "Power");
                    w::big(ui, &p, &fmt::num(g(|s| s.power), 1), "W", None);
                    w::sub(ui, &p, format!("{} · {} V in", eff.map(|e| format!("{e:.1} J/TH")).unwrap_or_else(|| "–".into()), fmt::num(g(|s| s.vin), 2)));
                }
                _ => {
                    w::h3(ui, &p, "Fan");
                    w::big(ui, &p, &g(|s| s.fan_rpm).map(|r| format!("{r:.0}")).unwrap_or_else(|| "–".into()), "RPM", None);
                    w::bar(ui, &p, (g(|s| s.fan_pct).unwrap_or(0.0) / 100.0) as f32, None);
                    w::sub(ui, &p, format!("{}%", fmt::num(g(|s| s.fan_pct), 0)));
                }
            }
        });
    });
    ui.add_space(14.0);

    let acc = g(|s| s.accepted).unwrap_or(0.0);
    let rej = g(|s| s.rejected).unwrap_or(0.0);
    let rejp = if acc + rej > 0.0 { rej / (acc + rej) * 100.0 } else { 0.0 };
    let sn = s.clone().unwrap_or_default();
    w::cols(ui, 3, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(170.0);
            match i {
                0 => {
                    w::h3_row(ui, &p, "Now mining", |ui| {
                        w::dot(ui, if sn.pool_connected == Some(false) { p.bad } else if online { p.good } else { p.dim }, online);
                    });
                    let mut rows = vec![("Pool", if sn.pool_host.is_empty() { "–".into() } else { sn.pool_host.clone() })];
                    if !sn.pool_user.is_empty() {
                        rows.push(("Worker", sn.pool_user.clone()));
                    }
                    rows.extend([
                        ("Pool diff", fmt::diff(sn.pool_diff.unwrap_or(0.0))),
                        ("Accepted", format!("{}", acc as u64)),
                        ("Rejected", format!("{} ({rejp:.2}%)", rej as u64)),
                        ("Block", sn.block_height.map(|h| format!("{}", h as u64)).unwrap_or_else(|| "–".into())),
                    ]);
                    w::kv(ui, &p, "kv-pool", &rows);
                }
                1 => {
                    w::h3(ui, &p, "Best shares");
                    w::big(ui, &p, &fmt::diff(m.best()), "", Some(p.warn));
                    w::sub(ui, &p, "all time");
                    ui.add_space(8.0);
                    w::kv(ui, &p, "kv-best", &[
                        ("This session", fmt::diff(sn.session_best.unwrap_or(0.0))),
                        ("Network", fmt::diff(sn.network_diff.unwrap_or(0.0))),
                        ("Blocks found", format!("{}", m.row.blocks.max(sn.blocks.unwrap_or(0.0) as i64))),
                    ]);
                }
                _ => {
                    w::h3(ui, &p, "Device");
                    w::kv(ui, &p, "kv-dev", &[
                        ("Board", if sn.model.is_empty() { m.row.model.clone() } else { sn.model.clone() }),
                        ("ASIC", if sn.asic_model.is_empty() { "–".into() } else { format!("{}× {}", sn.asic_count.unwrap_or(1), sn.asic_model) }),
                        ("Clock", sn.freq.map(|f| format!("{f:.0} MHz @ {:.0} mV", sn.core_mv.unwrap_or(0.0))).unwrap_or_else(|| "–".into())),
                        ("Firmware", if sn.version.is_empty() { "–".into() } else { format!("{} {}", if m.row.kind == "axeforge" { "AxeForge" } else { "AxeOS" }, sn.version) }),
                        ("Uptime", fmt::uptime(sn.uptime)),
                        ("Wi-Fi", sn.rssi.map(|r| format!("{} {r:.0} dBm", sn.ssid)).unwrap_or_else(|| "–".into())),
                    ]);
                }
            }
        });
    });
    ui.add_space(14.0);

    let events = app.engine.db.events(Some(id), 12).unwrap_or_default();
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(150.0);
            if i == 0 {
                w::h3(ui, &p, "Actions");
                ui.add_space(4.0);
                ui.horizontal_wrapped(|ui| {
                    if w::alt(ui, &p, &format!("{}  Pools", ic::POOLS)).clicked() {
                        app.st.pools.sel = Some(id);
                        app.page = Page::Pools;
                    }
                    if w::alt(ui, &p, &format!("{}  Tuning", ic::TUNE)).clicked() {
                        app.st.tuning.sel = Some(id);
                        app.page = Page::Tuning;
                    }
                    if w::alt(ui, &p, &format!("{}  Open miner page", ic::OPEN)).clicked() {
                        ctx.open_url(egui::OpenUrl::new_tab(format!("http://{}/", m.row.ip)));
                    }
                    if w::confirm_button(ui, &p, false, &format!("{}  Restart", ic::RESTART), "Click again to restart") {
                        super::restart(app, ctx, id);
                    }
                });
                ui.add_space(14.0);
                if w::confirm_button(ui, &p, true, "Remove from AxeMobile", "Remove it and delete its history?") {
                    let _ = app.engine.db.delete_miner(id);
                    app.engine.live.write().unwrap().remove(&id);
                    app.refresh_now();
                    app.toast(format!("Removed {}", m.name()), Tone::Info);
                    app.page = Page::Swarm;
                }
            } else {
                w::h3(ui, &p, "Activity");
                ui.add_space(4.0);
                events_list(ui, app, &events, "Nothing yet.");
            }
        });
    });
}

pub fn notice(ui: &mut egui::Ui, p: &crate::theme::Pal, color: egui::Color32, text: &str) {
    egui::Frame::new()
        .fill(crate::theme::alpha(color, 0.12))
        .stroke(egui::Stroke::new(1.0, crate::theme::alpha(color, 0.5)))
        .corner_radius(12)
        .inner_margin(egui::Margin::symmetric(14, 10))
        .show(ui, |ui| {
            ui.set_min_width(ui.available_width());
            ui.label(RichText::new(text).color(p.text));
        });
    ui.add_space(12.0);
}
