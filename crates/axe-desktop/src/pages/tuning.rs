use eframe::egui::{self, RichText};

use crate::app::{App, Tone};
use crate::fmt;
use crate::jobs;
use crate::widgets::{self as w, bold, ic};

use super::{header, kind_tag, picker, LoginState};

fn slider_row(ui: &mut egui::Ui, p: &crate::theme::Pal, label: &str, unit: &str, v: &mut f64, lo: f64, hi: f64, step: f64) {
    ui.horizontal(|ui| {
        ui.label(RichText::new(label).size(12.5).color(p.dim));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(format!("{:.0} {unit}", v)).font(bold(13.0)).color(p.pri));
        });
    });
    ui.spacing_mut().slider_width = ui.available_width() - 80.0;
    ui.add(egui::Slider::new(v, lo..=hi).step_by(step).show_value(true));
    ui.add_space(6.0);
}

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context) {
    let p = app.pal;
    if app.st.tuning.sel.is_none() || app.st.tuning.sel.is_some_and(|id| app.miner(id).is_none()) {
        app.st.tuning.sel = app.miners.first().map(|m| m.row.id);
    }
    let sel_kind = app.st.tuning.sel.and_then(|id| app.miner(id)).map(|m| m.row.kind.clone()).unwrap_or_default();
    header(ui, app, "Tuning", |ui| {
        if !sel_kind.is_empty() {
            kind_tag(ui, app, &sel_kind);
        }
    });
    if app.miners.is_empty() {
        w::card(ui, &p, |ui| { ui.label(RichText::new("Add a miner first.").color(p.dim)); });
        return;
    }
    let mut sel = app.st.tuning.sel;
    picker(app, ui, &mut sel);
    app.st.tuning.sel = sel;
    let Some(id) = sel else { return };
    let Some(m) = app.miner(id).cloned() else { return };

    if app.st.tuning.loaded_for != Some(id) && app.st.tuning.load.is_none() {
        app.st.tuning.loaded_for = Some(id);
        app.st.tuning.t = None;
        app.st.tuning.err.clear();
        let (e, row) = (app.engine.clone(), m.row.clone());
        app.st.tuning.load = Some(app.spawn(ctx, async move { e.client.tuning(&row.ip, &row.kind, &row.session).await.map_err(|x| x.to_string()) }));
    }
    if let Some(r) = jobs::poll(&mut app.st.tuning.load) {
        match r {
            Ok(t) => app.st.tuning.t = Some(t),
            Err(e) => app.st.tuning.err = e,
        }
    }
    if let Some(r) = jobs::poll(&mut app.st.tuning.save) {
        match r {
            Ok(msg) => {
                app.toast(if msg.trim().is_empty() { "Saved".to_string() } else { msg }, Tone::Ok);
                app.st.tuning.loaded_for = None;
            }
            Err(e) => {
                if e == "login required" {
                    app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
                }
                app.toast(e, Tone::Err);
            }
        }
    }
    if !app.st.tuning.err.is_empty() {
        let err = app.st.tuning.err.clone();
        super::miner::notice(ui, &p, p.bad, &format!("Couldn't read settings from {}: {err}", m.name()));
        ui.horizontal(|ui| {
            if err == "login required" && w::primary(ui, &p, &format!("{}  Log in", ic::LOCK)).clicked() {
                app.st.login = Some(LoginState { miner: id, code: String::new(), err: String::new(), job: None });
            }
            if w::alt(ui, &p, "Retry").clicked() {
                app.st.tuning.loaded_for = None;
            }
        });
        return;
    }
    let Some(mut t) = app.st.tuning.t.clone() else {
        w::card(ui, &p, |ui| { ui.label(RichText::new(format!("Reading settings from {}…", m.name())).color(p.dim)); });
        return;
    };
    let forge = m.row.kind == "axeforge";
    let s = m.snap().cloned().unwrap_or_default();

    w::cols(ui, 3, 14.0, |i, ui| match i {
        0 => w::stat(ui, &p, "Running at", &s.freq.map(|f| format!("{f:.0}")).unwrap_or_else(|| "–".into()), "MHz", &s.core_mv.map(|v| format!("{v:.0} mV core")).unwrap_or_default(), None),
        1 => {
            let (v, u) = fmt::hash(s.hashrate);
            w::stat(ui, &p, "Hashrate", &v, u, &s.expected.map(|e| format!("expected {}", fmt::hash_str(Some(e)))).unwrap_or_default(), None)
        }
        _ => w::stat(ui, &p, "Chip temp", &fmt::num(s.temp, 1), "°C", &s.power.map(|x| format!("{x:.1} W")).unwrap_or_default(), Some(w::temp_color(&p, s.temp))),
    });
    ui.add_space(14.0);

    let mut retune = false;
    if forge {
        w::card(ui, &p, |ui| {
            w::h3(ui, &p, "Auto-tune");
            let mut on = t.auto_tune.unwrap_or(false);
            if w::switch_row(ui, &p, "Let AxeForge find the best clock", "The miner searches for the most efficient clock and voltage within the board limits and keeps adjusting. Turn off to set a fixed point.", &mut on) {
                t.auto_tune = Some(on);
            }
            if w::confirm_button(ui, &p, true, &format!("{}  Restart auto-tune search", ic::RESTART), "Click again to start over") {
                retune = true;
            }
        });
        ui.add_space(14.0);
    }

    let l = t.limits.clone().unwrap_or_default();
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, if forge { if t.auto_tune == Some(true) { "Tuner start point" } else { "Manual point" } } else { "Clock & voltage" });
        let mut f = t.freq.unwrap_or(500.0);
        slider_row(ui, &p, "Frequency", "MHz", &mut f, 100.0, l.max_freq.unwrap_or(1000.0), 5.0);
        t.freq = Some(f);
        let mut v = t.core_mv.unwrap_or(1150.0);
        slider_row(ui, &p, "Core voltage", "mV", &mut v, l.min_mv.unwrap_or(1000.0), l.max_mv.unwrap_or(1400.0), 5.0);
        t.core_mv = Some(v);
        if !forge {
            ui.label(RichText::new("AxeOS applies clock and voltage after a restart.").size(12.0).color(p.dim));
        }
    });
    ui.add_space(14.0);

    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Cooling");
        if !forge {
            let mut a = t.fan_auto.unwrap_or(false);
            if w::switch_row(ui, &p, "Automatic fan", "Drive the fan to hold the target temperature.", &mut a) {
                t.fan_auto = Some(a);
            }
        }
        if (forge || t.fan_auto == Some(true)) && t.fan_target.is_some() {
            let mut tt = t.fan_target.unwrap_or(60.0);
            slider_row(ui, &p, "Target chip temperature", "°C", &mut tt, 40.0, l.chip_ceiling.unwrap_or(75.0), 1.0);
            t.fan_target = Some(tt);
        }
        if forge || t.fan_auto != Some(true) {
            let mut fp = t.fan_pct.unwrap_or(100.0);
            slider_row(ui, &p, if forge { "Minimum fan speed" } else { "Fan speed" }, "%", &mut fp, 0.0, 100.0, 1.0);
            t.fan_pct = Some(fp);
        }
    });
    ui.add_space(14.0);

    if t.limits.is_some() {
        w::card(ui, &p, |ui| {
            w::h3(ui, &p, "Board limits (set by the firmware)");
            ui.add_space(4.0);
            let mut items = vec![];
            if let Some(x) = l.max_freq { items.push((format!("{x:.0} MHz"), "max clock")); }
            if let (Some(a), Some(b)) = (l.min_mv, l.max_mv) { items.push((format!("{a:.0}–{b:.0} mV"), "core voltage")); }
            if let Some(x) = l.chip_ceiling { items.push((format!("{x:.0}°C"), "chip ceiling")); }
            if let Some(x) = l.max_power { items.push((format!("{x:.0} W"), "max power")); }
            let n = items.len().max(1);
            w::cols(ui, n, 10.0, |i, ui| {
                if let Some((v, k)) = items.get(i) {
                    egui::Frame::new().fill(p.panel2).corner_radius(10).inner_margin(10).show(ui, |ui| {
                        ui.set_min_width(ui.available_width());
                        ui.label(RichText::new(v).font(bold(18.0)));
                        ui.label(RichText::new(*k).size(11.0).color(p.dim));
                    });
                }
            });
        });
        ui.add_space(14.0);
    }
    app.st.tuning.t = Some(t.clone());

    let saving = app.st.tuning.save.is_some();
    let mut save = false;
    let mut reset = false;
    ui.horizontal(|ui| {
        if w::primary(ui, &p, if saving { "Saving…" } else { "Save tuning" }).clicked() && !saving {
            save = true;
        }
        if w::alt(ui, &p, "Reset").clicked() {
            reset = true;
        }
    });
    if reset {
        app.st.tuning.loaded_for = None;
    }
    let name = m.name();
    if save {
        if let (Some(f), Some(max)) = (t.freq, l.max_freq) {
            if f > max {
                app.toast(format!("{f:.0} MHz is above this board's limit of {max:.0} MHz"), Tone::Err);
                return;
            }
        }
        let (e, row) = (app.engine.clone(), m.row.clone());
        app.st.tuning.save = Some(app.spawn(ctx, async move {
            let r = e.client.set_tuning(&row.ip, &row.kind, &row.session, &t).await.map_err(|x| x.to_string());
            if r.is_ok() {
                let _ = e.db.add_event(Some(row.id), "config", &format!("Tuning changed on {name}"));
            }
            r
        }));
    } else if retune {
        let (e, row) = (app.engine.clone(), m.row.clone());
        app.st.tuning.save = Some(app.spawn(ctx, async move {
            e.client.retune(&row.ip, &row.kind, &row.session).await.map(|_| "Auto-tune restarted".to_string()).map_err(|x| x.to_string())
        }));
    }
}
