use eframe::egui::{self, Color32, CornerRadius, Pos2, Rect, RichText, Sense, Stroke, Vec2};

use crate::app::{App, Tone, DTV_SHOP, VERSION};
use crate::sys;
use crate::theme::{hsl, hsla, radial, rgb, ThemeId};
use crate::widgets::{self as w, bold, ic};

use super::header;

fn swatch(ui: &mut egui::Ui, id: ThemeId, rect: Rect) {
    let painter = ui.painter_at(rect);
    let mut s = vec![];
    match id {
        ThemeId::Forge => {
            painter.rect_filled(rect, CornerRadius::same(8), rgb(7, 10, 16));
            radial(&mut s, rect.right_top(), Vec2::new(120.0, 60.0), rgb(16, 33, 58));
            painter.extend(s);
            let bar = Rect::from_min_size(rect.left_bottom() + Vec2::new(10.0, -16.0), Vec2::new(rect.width() * 0.55, 4.0));
            painter.rect_filled(bar, CornerRadius::same(2), rgb(0, 229, 255));
            painter.rect_filled(Rect::from_min_size(bar.center_top(), Vec2::new(bar.width() / 2.0, 4.0)), CornerRadius::same(2), rgb(255, 43, 214));
        }
        ThemeId::Dtv => {
            painter.rect_filled(rect, CornerRadius::same(8), hsl(0.0, 0.0, 2.0));
            radial(&mut s, rect.left_center() + Vec2::new(rect.width() * 0.25, -6.0), Vec2::new(70.0, 30.0), hsla(280.0, 60.0, 15.0, 0.8));
            radial(&mut s, rect.right_center() - Vec2::new(rect.width() * 0.25, -8.0), Vec2::new(60.0, 26.0), hsla(25.0, 80.0, 20.0, 0.7));
            painter.extend(s);
            for (x, y) in [(0.1, 0.2), (0.45, 0.15), (0.7, 0.3), (0.9, 0.6), (0.3, 0.7)] {
                painter.circle_filled(rect.min + Vec2::new(rect.width() * x, rect.height() * y), 1.0, Color32::WHITE);
            }
            painter.rect_filled(Rect::from_min_size(rect.left_bottom() + Vec2::new(10.0, -16.0), Vec2::new(rect.width() * 0.55, 4.0)), CornerRadius::same(2), hsl(25.0, 100.0, 50.0));
        }
    }
}

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context) {
    let p = app.pal;
    header(ui, app, "System", |_| {});

    // ---- theme
    let mut pick: Option<ThemeId> = None;
    let cur = app.theme;
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Theme");
        ui.add_space(6.0);
        w::cols(ui, 2, 12.0, |i, ui| {
            let (id, name, desc) = if i == 0 {
                (ThemeId::Forge, "AxeForge", "Dark glass, cyan and magenta, like the firmware dashboard.")
            } else {
                (ThemeId::Dtv, "DTV Electronics", "Black and orange, nebula, comets and the black-hole intro.")
            };
            let on = cur == id;
            let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 120.0), Sense::click());
            ui.painter().rect(rect, CornerRadius::same(12), p.panel2, Stroke::new(if on { 2.0 } else { 1.0 }, if on { p.pri } else { p.line }), egui::StrokeKind::Inside);
            swatch(ui, id, Rect::from_min_size(rect.min + Vec2::splat(12.0), Vec2::new(rect.width() - 24.0, 54.0)));
            ui.painter().text(Pos2::new(rect.left() + 12.0, rect.top() + 82.0), egui::Align2::LEFT_CENTER, name, bold(14.0), p.text);
            ui.painter().text(Pos2::new(rect.left() + 12.0, rect.top() + 102.0), egui::Align2::LEFT_CENTER, desc, egui::FontId::proportional(12.0), p.dim);
            if resp.hovered() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if resp.clicked() && !on {
                pick = Some(id);
            }
        });
        ui.add_space(10.0);
        let mut intro = app.setting("intro") != "0";
        let changed = w::switch_row(ui, &p, "Intro on start", "DTV plays the black hole, the AxeForge theme a short splash.", &mut intro);
        if changed {
            app.set_setting("intro", if intro { "1" } else { "0" });
        }
        ui.horizontal(|ui| {
            if w::small(ui, &p, "Play the intro now").clicked() {
                app.replay_intro();
            }
            if w::small(ui, &p, &format!("{}  DTV Electronics shop", ic::SHOP)).clicked() {
                ctx.open_url(egui::OpenUrl::new_tab(DTV_SHOP));
            }
        });
    });
    if let Some(t) = pick {
        app.set_theme(ctx, t);
        if t == ThemeId::Dtv && app.setting("intro") != "0" {
            app.replay_intro();
        }
    }
    ui.add_space(14.0);

    // ---- monitoring + alerts
    let mut save = false;
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(230.0);
            let st = &mut app.st.system;
            if i == 0 {
                w::h3(ui, &p, "Monitoring");
                field(ui, &p, "Read miners every (seconds)", &mut st.poll);
                field(ui, &p, "Electricity price per kWh (0 hides cost)", &mut st.price);
                field(ui, &p, "Currency symbol", &mut st.currency);
            } else {
                w::h3(ui, &p, "Alerts");
                field(ui, &p, "Warn when a chip reaches (°C, 0 = off)", &mut st.alert_temp);
                field(ui, &p, "Warn when hashrate drops below expected by (%, 0 = off)", &mut st.alert_drop);
                ui.add_space(4.0);
            }
            ui.add_space(8.0);
            if i == 0 && w::primary(ui, &p, &format!("{}  Save", ic::SAVE)).clicked() {
                save = true;
            }
            if i == 1 && w::primary(ui, &p, &format!("{}  Save alerts", ic::SAVE)).clicked() {
                save = true;
            }
        });
    });
    if save {
        let s = &app.st.system;
        let vals = [
            ("poll_secs", s.poll.trim().parse::<u64>().map(|x| x.clamp(3, 300).to_string()).unwrap_or_else(|_| "10".into())),
            ("energy_price", s.price.trim().replace(',', ".").parse::<f64>().map(|x| x.max(0.0).to_string()).unwrap_or_else(|_| "0".into())),
            ("currency", s.currency.trim().chars().take(4).collect()),
            ("alert_temp", s.alert_temp.trim().parse::<f64>().map(|x| x.max(0.0).to_string()).unwrap_or_else(|_| "70".into())),
            ("alert_drop", s.alert_drop.trim().parse::<f64>().map(|x| x.clamp(0.0, 95.0).to_string()).unwrap_or_else(|_| "25".into())),
        ];
        for (k, v) in vals {
            app.set_setting(k, &v);
        }
        app.toast("Saved", Tone::Ok);
    }
    ui.add_space(14.0);

    // ---- windows integration
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Desktop");
        let mut notify = app.setting("notify") != "0";
        if w::switch_row(ui, &p, "Desktop notifications", "Toasts when a miner goes offline, runs hot, loses hashrate, beats its best share or finds a block.", &mut notify) {
            app.set_setting("notify", if notify { "1" } else { "0" });
            if notify {
                sys::notify("AxeMobile", "Notifications are on.");
            }
        }
        if app.has_tray() {
            let mut tray = app.setting("tray_close") != "0";
            if w::switch_row(ui, &p, "Keep running in the tray", "Closing or minimising hides AxeMobile next to the clock. Hover the icon for a quick look at your fleet; right-click it to open a miner or quit.", &mut tray) {
                app.set_setting("tray_close", if tray { "1" } else { "0" });
            }
        }
        let mut auto = app.setting("autostart") == "1";
        if w::switch_row(ui, &p, "Start when you sign in", "Opens AxeMobile in the background when you sign in, so history keeps recording.", &mut auto) {
            match sys::set_autostart(auto) {
                Ok(()) => app.set_setting("autostart", if auto { "1" } else { "0" }),
                Err(e) => app.toast(format!("Couldn't change start-up: {e}"), Tone::Err),
            }
        }
        let mut market = app.setting("market") != "0";
        if w::switch_row(ui, &p, "Bitcoin price and fees", "Reads price, fees and chain height from mempool.space every 5 minutes.", &mut market) {
            app.set_setting("market", if market { "1" } else { "0" });
        }
    });
    ui.add_space(14.0);

    // ---- data
    let (samples, hourly, events) = app.engine.db.stats().unwrap_or((0, 0, 0));
    let size = app.engine.db.path_size();
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(190.0);
            if i == 0 {
                w::h3(ui, &p, "Database");
                w::kv(ui, &p, "kv-db", &[
                    ("Miners", app.miners.len().to_string()),
                    ("Recent samples", samples.to_string()),
                    ("Hourly averages", hourly.to_string()),
                    ("Events", events.to_string()),
                    ("Size", format!("{:.1} MB", size as f64 / 1_048_576.0)),
                ]);
                ui.label(RichText::new("One SQLite file in your AppData folder. Full detail for two days, hourly averages for a year.").size(12.0).color(p.dim));
                if w::small(ui, &p, &format!("{}  Open data folder", ic::FOLDER)).clicked() {
                    sys::open_folder(&sys::data_dir());
                }
            } else {
                w::h3(ui, &p, "Backup & export");
                ui.label(RichText::new("Your miner list and settings as JSON, or the last two days of readings as CSV for a spreadsheet.").size(12.5).color(p.dim));
                ui.add_space(6.0);
                ui.horizontal_wrapped(|ui| {
                    if w::alt(ui, &p, "Export backup").clicked() {
                        export_backup(app);
                    }
                    if w::alt(ui, &p, "Import backup").clicked() {
                        import_backup(app);
                    }
                    if w::alt(ui, &p, "Export CSV").clicked() {
                        export_csv(app);
                    }
                });
            }
        });
    });
    ui.add_space(14.0);

    // ---- fleet + about
    let online: Vec<i64> = app.miners.iter().filter(|m| m.online()).map(|m| m.row.id).collect();
    w::cols(ui, 2, 14.0, |i, ui| {
        w::card(ui, &p, |ui| {
            ui.set_min_height(130.0);
            if i == 0 {
                w::h3(ui, &p, "Fleet");
                ui.label(RichText::new("Sends a restart to every miner that is online right now.").size(12.5).color(p.dim));
                ui.add_space(6.0);
                if w::confirm_button(ui, &p, false, &format!("{}  Restart all", ic::RESTART), &format!("Restart {} miners?", online.len())) {
                    for id in &online {
                        super::restart(app, ctx, *id);
                    }
                    app.toast(format!("Restart sent to {} miner(s)", online.len()), Tone::Ok);
                }
            } else {
                w::h3(ui, &p, "About");
                w::kv(ui, &p, "kv-about", &[
                    ("Version", VERSION.to_string()),
                    ("Runs as", format!("Native {} app", std::env::consts::OS)),
                    ("Firmware", "AxeForge, AxeOS".into()),
                    ("Shortcuts", "Ctrl+1…8, Ctrl+N, F5".into()),
                ]);
                if ui.add(egui::Label::new(RichText::new("github.com/IsSasoriDev/AxeMobile").color(p.pri).underline()).sense(Sense::click())).clicked() {
                    ctx.open_url(egui::OpenUrl::new_tab("https://github.com/IsSasoriDev/AxeMobile"));
                }
            }
        });
    });
}

fn field(ui: &mut egui::Ui, p: &crate::theme::Pal, label: &str, v: &mut String) {
    ui.add_space(4.0);
    ui.label(RichText::new(label).size(12.0).color(p.dim));
    ui.add(egui::TextEdit::singleline(v).desired_width(f32::INFINITY));
}

fn export_backup(app: &mut App) {
    let miners: Vec<serde_json::Value> = app
        .engine
        .db
        .miners()
        .unwrap_or_default()
        .into_iter()
        .map(|m| serde_json::json!({"ip": m.ip, "name": m.name, "kind": m.kind, "model": m.model}))
        .collect();
    let mut settings = app.engine.settings();
    settings.remove("game");
    let data = serde_json::json!({"app": "axemobile", "version": 2, "miners": miners, "settings": settings, "game": app.game.save()});
    let _ = std::fs::create_dir_all(sys::exports_dir());
    let file = rfd::FileDialog::new()
        .set_directory(sys::exports_dir())
        .set_file_name(format!("axemobile-backup-{}.json", crate::fmt::date(axe_core::db::now()).replace([' ', ','], "-")))
        .add_filter("JSON", &["json"])
        .save_file();
    if let Some(path) = file {
        match std::fs::write(&path, serde_json::to_string_pretty(&data).unwrap_or_default()) {
            Ok(()) => app.toast(format!("Saved {}", path.display()), Tone::Ok),
            Err(e) => app.toast(e.to_string(), Tone::Err),
        }
    }
}

fn import_backup(app: &mut App) {
    let Some(path) = rfd::FileDialog::new().set_directory(sys::exports_dir()).add_filter("JSON", &["json"]).pick_file() else { return };
    let Ok(text) = std::fs::read_to_string(&path) else {
        app.toast("Couldn't read that file", Tone::Err);
        return;
    };
    let Ok(v) = serde_json::from_str::<serde_json::Value>(&text) else {
        app.toast("That file isn't an AxeMobile backup", Tone::Err);
        return;
    };
    let mut added = 0;
    for m in v.get("miners").and_then(|m| m.as_array()).into_iter().flatten() {
        let s = |k: &str| m.get(k).and_then(|x| x.as_str()).unwrap_or("").to_string();
        let ip = s("ip");
        let kind = s("kind");
        if ip.is_empty() || !(kind == "axeforge" || kind == "axeos") {
            continue;
        }
        if app.engine.db.miner_by_ip(&ip).ok().flatten().is_none() && app.engine.db.add_miner(&ip, &s("name"), &kind, &s("model")).is_ok() {
            added += 1;
        }
    }
    if let Some(obj) = v.get("settings").and_then(|s| s.as_object()) {
        for (k, val) in obj {
            if let Some(val) = val.as_str() {
                if axe_core::DEFAULTS.iter().any(|(d, _)| d == k) {
                    let _ = app.engine.db.set_setting(k, val);
                }
            }
        }
    }
    app.engine.wake.notify_one();
    app.refresh_now();
    app.toast(format!("Imported {added} miner(s)"), Tone::Ok);
}

fn export_csv(app: &mut App) {
    let csv = match app.engine.db.export_csv(axe_core::db::now() - axe_core::db::RAW_KEEP_SECS) {
        Ok(c) => c,
        Err(e) => {
            app.toast(e.to_string(), Tone::Err);
            return;
        }
    };
    let _ = std::fs::create_dir_all(sys::exports_dir());
    if let Some(path) = rfd::FileDialog::new().set_directory(sys::exports_dir()).set_file_name("axemobile-history.csv").add_filter("CSV", &["csv"]).save_file() {
        match std::fs::write(&path, csv) {
            Ok(()) => app.toast(format!("Saved {}", path.display()), Tone::Ok),
            Err(e) => app.toast(e.to_string(), Tone::Err),
        }
    }
}

