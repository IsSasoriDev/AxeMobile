use eframe::egui::{self, Color32, RichText, Stroke, Vec2};

use crate::app::App;
use crate::fmt;
use crate::game::{self, Rarity};
use crate::theme::alpha;
use crate::widgets::{self as w, bold};

use super::{header, LbTab};

fn medal(rank: usize) -> (String, Color32) {
    match rank {
        1 => ("1".into(), Color32::from_rgb(255, 200, 60)),
        2 => ("2".into(), Color32::from_rgb(200, 210, 225)),
        3 => ("3".into(), Color32::from_rgb(214, 140, 80)),
        n => (n.to_string(), Color32::from_gray(140)),
    }
}

fn rank_badge(ui: &mut egui::Ui, rank: usize) {
    let (txt, col) = medal(rank);
    let (r, _) = ui.allocate_exact_size(Vec2::splat(30.0), egui::Sense::hover());
    if rank <= 3 {
        ui.painter().circle_filled(r.center(), 14.0, alpha(col, 0.18));
        ui.painter().circle_stroke(r.center(), 14.0, Stroke::new(1.5, col));
    }
    ui.painter().text(r.center(), egui::Align2::CENTER_CENTER, txt, bold(14.0), col);
}

pub fn show(app: &mut App, ui: &mut egui::Ui) {
    let p = app.pal;
    let unlocked = app.unlocked.len();
    header(ui, app, "Leaderboard", |ui| {
        ui.label(RichText::new(format!("{unlocked}/{} achievements", game::ACHIEVEMENTS.len())).color(p.dim));
    });
    let mut tab = app.st.lb;
    w::seg(ui, &p, &mut tab, &[(LbTab::Shares, "Best shares"), (LbTab::Miners, "Miners"), (LbTab::Cave, "The Cave"), (LbTab::Achievements, "Achievements")], false);
    app.st.lb = tab;
    ui.add_space(14.0);

    match tab {
        LbTab::Shares => {
            let shares = app.engine.db.top_shares(25).unwrap_or_default();
            w::card(ui, &p, |ui| {
                w::h3(ui, &p, "Biggest shares your fleet has found");
                ui.add_space(6.0);
                if shares.is_empty() {
                    ui.label(RichText::new("Each time a miner beats its best share it lands here. Give it a little time.").color(p.dim));
                }
                for (i, (mid, ts, d)) in shares.iter().enumerate() {
                    let name = app.miner(*mid).map(|m| m.name()).unwrap_or_else(|| "removed miner".into());
                    row(ui, &p, i + 1, &name, &fmt::date(*ts), &fmt::diff(*d), i == 0);
                }
            });
        }
        LbTab::Miners => {
            let mut ms = app.miners.clone();
            ms.sort_by(|a, b| b.best().partial_cmp(&a.best()).unwrap_or(std::cmp::Ordering::Equal));
            w::card(ui, &p, |ui| {
                w::h3(ui, &p, "Miners by best difficulty");
                ui.add_space(6.0);
                if ms.is_empty() {
                    ui.label(RichText::new("No miners yet.").color(p.dim));
                }
                for (i, m) in ms.iter().enumerate() {
                    let blocks = if m.row.blocks > 0 { format!(" · {} block(s)!", m.row.blocks) } else { String::new() };
                    row(ui, &p, i + 1, &m.name(), &format!("{}{blocks}", m.row.model), &fmt::diff(m.best()), i == 0);
                }
            });
        }
        LbTab::Cave => {
            let g = app.game.clone();
            w::cols(ui, 3, 14.0, |i, ui| match i {
                0 => w::stat(ui, &p, "Richest moment", &format!("{:.1}", g.best_balance), "Cave BTC", "highest balance you held", Some(p.warn)),
                1 => w::stat(ui, &p, "Total earned", &format!("{:.1}", g.earned), "Cave BTC", "from digs and sales", None),
                _ => w::stat(ui, &p, "Legendary finds", &format!("{}", g.legendary), "", &format!("of {} ores dug", g.total_mined), None),
            });
            ui.add_space(14.0);
            w::card(ui, &p, |ui| {
                w::h3(ui, &p, "Collection");
                ui.add_space(6.0);
                let mut ores: Vec<(&game::Ore, u64)> = game::ORES.iter().map(|o| (o, g.inventory.get(o.id).copied().unwrap_or(0))).collect();
                ores.sort_by(|a, b| b.0.value.partial_cmp(&a.0.value).unwrap());
                for (i, (o, n)) in ores.iter().enumerate() {
                    row(ui, &p, i + 1, o.name, o.rarity.name(), &format!("× {n}"), false);
                }
            });
        }
        LbTab::Achievements => {
            let n = ((ui.available_width() + 12.0) / 260.0).floor().max(1.0) as usize;
            let list: Vec<&game::Ach> = game::ACHIEVEMENTS.iter().collect();
            for chunk in list.chunks(n) {
                w::cols(ui, n, 12.0, |i, ui| {
                    let Some(a) = chunk.get(i) else { return };
                    let got = app.unlocked.get(a.id).copied();
                    let col = match a.rarity {
                        Rarity::Common => p.dim,
                        Rarity::Uncommon => p.good,
                        Rarity::Rare => p.pri,
                        Rarity::Epic => Color32::from_rgb(192, 132, 252),
                        Rarity::Legendary => Color32::from_rgb(255, 196, 64),
                    };
                    egui::Frame::new()
                        .fill(if got.is_some() { alpha(col, 0.08) } else { p.panel })
                        .stroke(Stroke::new(1.0, if got.is_some() { alpha(col, 0.55) } else { p.line }))
                        .corner_radius(12)
                        .inner_margin(12)
                        .show(ui, |ui| {
                            ui.set_min_width(ui.available_width());
                            ui.set_min_height(74.0);
                            ui.horizontal(|ui| {
                                ui.label(RichText::new(if got.is_some() { "★" } else { "☆" }).size(24.0).color(if got.is_some() { col } else { p.dim }));
                                ui.vertical(|ui| {
                                    ui.label(RichText::new(a.name).font(bold(14.0)).color(if got.is_some() { p.text } else { p.dim }));
                                    ui.label(RichText::new(a.desc).size(11.5).color(p.dim));
                                    ui.label(RichText::new(match got {
                                        Some(ts) => format!("{} · {}", a.rarity.name(), fmt::date(ts)),
                                        None => a.rarity.name().to_string(),
                                    }).size(10.5).color(col));
                                });
                            });
                        });
                });
                ui.add_space(12.0);
            }
        }
    }
}

fn row(ui: &mut egui::Ui, p: &crate::theme::Pal, rank: usize, name: &str, sub: &str, value: &str, top: bool) {
    let r = ui.available_rect_before_wrap();
    if rank > 1 {
        ui.painter().hline(r.x_range(), r.top(), Stroke::new(1.0, p.line));
    }
    ui.horizontal(|ui| {
        ui.set_min_height(44.0);
        rank_badge(ui, rank);
        ui.add_space(6.0);
        ui.vertical(|ui| {
            ui.label(RichText::new(name).font(bold(14.5)));
            ui.label(RichText::new(sub).size(11.5).color(p.dim));
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            ui.label(RichText::new(value).font(bold(if top { 20.0 } else { 16.0 })).color(if top { p.warn } else { p.text }));
        });
    });
}
