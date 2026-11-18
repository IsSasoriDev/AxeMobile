//! Reports: what the fleet did per day and per miner, with CSV export.

use axe_core::report::{self, Report};
use eframe::egui::{self, RichText, Sense, Vec2};

use crate::app::{App, Page, Tone};
use crate::fmt;
use crate::sys;
use crate::widgets::{self as w, bold, ic};

use super::header;

pub struct ReportsState {
    pub span: i64,
    cache: Option<(f64, i64, Report)>,
}

impl Default for ReportsState {
    fn default() -> Self {
        Self { span: 7, cache: None }
    }
}

/// The computer's UTC offset in seconds, so days start at local midnight.
fn offset() -> i64 {
    chrono_offset().unwrap_or(0)
}

#[cfg(windows)]
fn chrono_offset() -> Option<i64> {
    // GetTimeZoneInformation's bias is minutes west of UTC
    #[repr(C)]
    struct SystemTime([u16; 8]);
    #[repr(C)]
    struct Tzi {
        bias: i32,
        std_name: [u16; 32],
        std_date: SystemTime,
        std_bias: i32,
        dl_name: [u16; 32],
        dl_date: SystemTime,
        dl_bias: i32,
    }
    #[link(name = "kernel32")]
    extern "system" {
        fn GetTimeZoneInformation(t: *mut Tzi) -> u32;
    }
    let mut t: Tzi = unsafe { std::mem::zeroed() };
    let r = unsafe { GetTimeZoneInformation(&mut t) };
    let bias = match r {
        2 => t.bias + t.dl_bias,
        0 | 1 => t.bias + t.std_bias,
        _ => return None,
    };
    Some(-(bias as i64) * 60)
}

#[cfg(not(windows))]
fn chrono_offset() -> Option<i64> {
    // `date +%z` prints e.g. +0200
    let out = std::process::Command::new("date").arg("+%z").output().ok()?;
    let s = String::from_utf8(out.stdout).ok()?;
    let s = s.trim();
    if s.len() != 5 {
        return None;
    }
    let sign = if s.starts_with('-') { -1 } else { 1 };
    let h: i64 = s[1..3].parse().ok()?;
    let m: i64 = s[3..5].parse().ok()?;
    Some(sign * (h * 3600 + m * 60))
}

fn pct(v: Option<f64>) -> String {
    v.map(|x| format!("{:.1}%", x * 100.0)).unwrap_or_else(|| "–".into())
}

fn avail_color(p: &crate::theme::Pal, v: Option<f64>) -> egui::Color32 {
    match v {
        Some(x) if x >= 0.99 => p.good,
        Some(x) if x >= 0.95 => p.warn,
        Some(_) => p.bad,
        None => p.dim,
    }
}

fn weekday(day: i64) -> &'static str {
    // 1970-01-01 was a Thursday
    ["Thu", "Fri", "Sat", "Sun", "Mon", "Tue", "Wed"][day.rem_euclid(7) as usize]
}

pub fn show(app: &mut App, ui: &mut egui::Ui, now: f64) {
    let p = app.pal;
    let mut span = app.st.reports.span;
    header(ui, app, "Reports", |ui| {
        w::seg(ui, &p, &mut span, &[(7, "7 days"), (30, "30 days"), (90, "90 days")], false);
    });
    app.st.reports.span = span;

    let off = offset();
    let stale = app.st.reports.cache.as_ref().is_none_or(|(t, s, _)| *s != span || now - t > 30.0);
    if stale {
        match report::build(&app.engine, span, off, None) {
            Ok(r) => app.st.reports.cache = Some((now, span, r)),
            Err(e) => {
                app.toast(format!("Couldn't build the report: {e}"), Tone::Err);
                return;
            }
        }
    }
    let r = app.st.reports.cache.as_ref().map(|c| c.2.clone()).unwrap();

    if r.miners.is_empty() {
        w::card(ui, &p, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(30.0);
                ui.label(RichText::new("Add a miner first. Reports fill in as AxeMobile reads your miners.").color(p.dim));
                ui.add_space(10.0);
                if w::alt(ui, &p, "Add miners").clicked() {
                    app.page = Page::Swarm;
                }
                ui.add_space(30.0);
            });
        });
        return;
    }

    let t = r.total.clone();
    let money = |v: Option<f64>| v.map(|c| format!("{}{c:.2}", r.currency));
    let (hv, hu) = fmt::hash(Some(t.hashrate));
    w::cols(ui, 4, 14.0, |i, ui| match i {
        0 => w::stat(ui, &p, "Average hashrate", &hv, hu, &format!("over {} days, offline time counts as zero", r.span), None),
        1 => w::stat(
            ui,
            &p,
            "Energy",
            &format!("{:.1}", t.energy_kwh),
            "kWh",
            &format!(
                "{}{}",
                money(t.cost).unwrap_or_else(|| "set a price in System to see the cost".into()),
                t.efficiency.map(|e| format!(" · {e:.1} J/TH")).unwrap_or_default()
            ),
            None,
        ),
        2 => w::stat(
            ui,
            &p,
            "Uptime",
            &pct(t.availability),
            "",
            &format!("{} unplanned reboot{}", t.reboots, if t.reboots == 1 { "" } else { "s" }),
            Some(avail_color(&p, t.availability)),
        ),
        _ => w::stat(
            ui,
            &p,
            "Shares",
            &format!("{}", t.accepted as u64),
            "",
            &format!(
                "{} rejected{}{}",
                t.rejected as u64,
                t.reject_pct.map(|x| format!(" · {x:.2}%")).unwrap_or_default(),
                t.record.map(|x| format!(" · best {}", fmt::diff(x))).unwrap_or_default()
            ),
            None,
        ),
    });
    ui.add_space(14.0);

    // per miner
    let mut open = None;
    let mut export: Option<bool> = None;
    w::card(ui, &p, |ui| {
        w::h3_row(ui, &p, "By miner", |ui| {
            if w::small(ui, &p, &format!("{}  Raw readings (48 h)", ic::DOWNLOAD)).clicked() {
                export = Some(false);
            }
            if w::small(ui, &p, &format!("{}  Daily CSV", ic::DOWNLOAD)).clicked() {
                export = Some(true);
            }
        });
        ui.add_space(6.0);
        let head = ["Miner", "Avg hashrate", "Uptime", "Reboots", "Energy", "Efficiency", "Rejected", "Best share"];
        let widths = [0.22, 0.13, 0.10, 0.09, 0.13, 0.12, 0.10, 0.11];
        let total = ui.available_width();
        let row = |ui: &mut egui::Ui, cells: &mut dyn FnMut(usize, &mut egui::Ui)| {
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 0.0;
                for (i, wd) in widths.iter().enumerate() {
                    let layout = if i == 0 { egui::Layout::left_to_right(egui::Align::Center) } else { egui::Layout::right_to_left(egui::Align::Center) };
                    ui.allocate_ui_with_layout(Vec2::new(total * wd, 34.0), layout, |ui| {
                        ui.set_width(total * wd);
                        cells(i, ui);
                    });
                }
            })
            .response
        };
        row(ui, &mut |i, ui| {
            ui.label(RichText::new(head[i].to_uppercase()).font(bold(10.5)).color(p.dim));
        });
        for m in &r.miners {
            let line = ui.available_rect_before_wrap();
            ui.painter().hline(line.x_range(), line.top(), egui::Stroke::new(1.0, p.line));
            let resp = row(ui, &mut |i, ui| match i {
                0 => {
                    ui.vertical(|ui| {
                        ui.spacing_mut().item_spacing.y = 0.0;
                        ui.add(egui::Label::new(RichText::new(&m.name).font(bold(14.0))).truncate());
                        ui.label(RichText::new(&m.model).size(11.5).color(p.dim));
                    });
                }
                1 => {
                    ui.label(fmt::hash_str(Some(m.hashrate)));
                }
                2 => {
                    ui.label(RichText::new(pct(m.availability)).color(avail_color(&p, m.availability)));
                }
                3 => {
                    ui.label(RichText::new(m.reboots.to_string()).color(if m.reboots > 2 { p.warn } else { p.text }));
                }
                4 => {
                    ui.label(format!("{:.2} kWh{}", m.energy_kwh, money(m.cost).map(|c| format!(" · {c}")).unwrap_or_default()));
                }
                5 => {
                    ui.label(m.efficiency.map(|e| format!("{e:.1} J/TH")).unwrap_or_else(|| "–".into()));
                }
                6 => {
                    ui.label(m.reject_pct.map(|x| format!("{x:.2}%")).unwrap_or_else(|| "–".into()));
                }
                _ => {
                    ui.label(m.record.map(fmt::diff).unwrap_or_else(|| "–".into()));
                }
            });
            let hit = ui.interact(resp.rect, ui.scope_id().with(("rep", m.id)), Sense::click());
            if hit.hovered() {
                ui.painter().rect_filled(resp.rect, 6, crate::theme::alpha(p.panel2, 0.5));
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if hit.clicked() {
                open = Some(m.id);
            }
        }
    });
    if let Some(id) = open {
        app.page = Page::Miner(id);
    }
    if let Some(daily) = export {
        save_csv(app, &r, off, daily);
    }
    ui.add_space(14.0);

    // per day, newest first
    let peak = r.days.iter().map(|d| d.hashrate).fold(1.0, f64::max);
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "By day");
        ui.add_space(6.0);
        let head = ["Day", "Avg hashrate", "Uptime", "Reboots", "Energy", "Shares", "New best"];
        let widths = [0.14, 0.32, 0.10, 0.09, 0.14, 0.11, 0.10];
        let total = ui.available_width();
        ui.horizontal(|ui| {
            ui.spacing_mut().item_spacing.x = 0.0;
            for (i, wd) in widths.iter().enumerate() {
                let layout = if i == 0 { egui::Layout::left_to_right(egui::Align::Center) } else { egui::Layout::right_to_left(egui::Align::Center) };
                ui.allocate_ui_with_layout(Vec2::new(total * wd, 24.0), layout, |ui| {
                    ui.set_width(total * wd);
                    ui.label(RichText::new(head[i].to_uppercase()).font(bold(10.5)).color(p.dim));
                });
            }
        });
        for d in r.days.iter().rev() {
            let line = ui.available_rect_before_wrap();
            ui.painter().hline(line.x_range(), line.top(), egui::Stroke::new(1.0, p.line));
            ui.horizontal(|ui| {
                ui.spacing_mut().item_spacing.x = 0.0;
                for (i, wd) in widths.iter().enumerate() {
                    let layout = if i == 0 { egui::Layout::left_to_right(egui::Align::Center) } else { egui::Layout::right_to_left(egui::Align::Center) };
                    ui.allocate_ui_with_layout(Vec2::new(total * wd, 32.0), layout, |ui| {
                        ui.set_width(total * wd);
                        match i {
                            0 => {
                                ui.label(format!("{} {}", weekday(d.day), &d.date[5..]));
                            }
                            1 => {
                                // a track left of the number, filled to this day's share of the best day
                                let r = ui.max_rect();
                                let track = egui::Rect::from_min_max(egui::pos2(r.left() + 6.0, r.center().y - 4.0), egui::pos2((r.right() - 96.0).max(r.left() + 20.0), r.center().y + 4.0));
                                ui.painter().rect_filled(track, 4, p.panel2);
                                let mut fill = track;
                                fill.set_width(track.width() * (d.hashrate / peak).clamp(0.0, 1.0) as f32);
                                ui.painter().rect_filled(fill, 4, crate::theme::alpha(p.pri, 0.75));
                                ui.label(if d.availability.is_none() { "–".into() } else { fmt::hash_str(Some(d.hashrate)) });
                            }
                            2 => {
                                ui.label(RichText::new(pct(d.availability)).color(avail_color(&p, d.availability)));
                            }
                            3 => {
                                ui.label(RichText::new(d.reboots.to_string()).color(if d.reboots > 2 { p.warn } else { p.text }));
                            }
                            4 => {
                                ui.label(format!("{:.2} kWh", d.energy_kwh)).on_hover_text(money(d.cost).unwrap_or_default());
                            }
                            5 => {
                                ui.label(format!("{}", d.accepted as u64)).on_hover_text(format!("{} rejected", d.rejected as u64));
                            }
                            _ => {
                                ui.label(d.record.map(fmt::diff).unwrap_or_else(|| "–".into()));
                            }
                        }
                    });
                }
            });
        }
        ui.add_space(6.0);
        ui.label(
            RichText::new("Uptime is the share of AxeMobile's readings a miner answered. Days AxeMobile wasn't running show \"–\". Energy is what the miners reported while they were being read.")
                .size(12.0)
                .color(p.dim),
        );
    });
}

fn save_csv(app: &mut App, r: &Report, off: i64, daily: bool) {
    let (csv, name) = if daily {
        (report::csv(r, &app.engine, off, None), format!("axemobile-report-{}d.csv", r.span))
    } else {
        (app.engine.db.history_csv(None, axe_core::db::now() - axe_core::db::RAW_KEEP_SECS), "axemobile-history.csv".to_string())
    };
    let csv = match csv {
        Ok(c) => c,
        Err(e) => {
            app.toast(format!("Export failed: {e}"), Tone::Err);
            return;
        }
    };
    if let Some(path) = rfd::FileDialog::new().set_directory(sys::exports_dir()).set_file_name(&name).add_filter("CSV", &["csv"]).save_file() {
        match std::fs::write(&path, csv) {
            Ok(()) => app.toast(format!("Saved {}", path.display()), Tone::Ok),
            Err(e) => app.toast(format!("Couldn't save: {e}"), Tone::Err),
        }
    }
}
