use eframe::egui::{self, Align2, Color32, CornerRadius, Pos2, Rect, RichText, Sense, Stroke, Vec2};

use crate::app::{App, Tone};
use crate::fmt;
use crate::game::{self, Rarity};
use crate::theme::{alpha, mix, radial};
use crate::widgets::{self as w, bold};

use super::header;

fn rarity_color(p: &crate::theme::Pal, r: Rarity) -> Color32 {
    match r {
        Rarity::Common => p.dim,
        Rarity::Uncommon => p.good,
        Rarity::Rare => p.pri,
        Rarity::Epic => Color32::from_rgb(192, 132, 252),
        Rarity::Legendary => Color32::from_rgb(255, 196, 64),
    }
}

pub fn show(app: &mut App, ui: &mut egui::Ui, now: f64) {
    let p = app.pal;
    let unix = axe_core::db::now();
    header(ui, app, "The Cave", |ui| {
        ui.label(RichText::new(format!("{:.1} Cave BTC", app.game.balance)).font(bold(15.0)).color(p.warn));
    });
    ui.ctx().request_repaint();

    let ghs = app.fleet.hashrate;
    let interval = app.game.interval(ghs, unix);

    // ---- the dig scene
    w::card(ui, &p, |ui| {
        let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 260.0), Sense::hover());
        let painter = ui.painter_at(rect);
        // cave walls
        painter.rect_filled(rect, CornerRadius::same(10), Color32::from_rgb(14, 11, 9));
        let mut shapes = vec![];
        radial(&mut shapes, rect.center() + Vec2::new(-rect.width() * 0.15, 30.0), Vec2::new(rect.width() * 0.45, 200.0), alpha(Color32::from_rgb(255, 150, 60), 0.10));
        radial(&mut shapes, Pos2::new(rect.right() - 120.0, rect.center().y), Vec2::new(220.0, 180.0), alpha(p.pri, 0.07));
        painter.extend(shapes);
        for i in 0..36 {
            let fi = i as f32;
            let x = rect.left() + ((fi * 97.3) % rect.width());
            let y = rect.top() + ((fi * 53.7) % rect.height());
            let r = 6.0 + (fi * 1.7).sin().abs() * 16.0;
            painter.circle_filled(Pos2::new(x, y), r, Color32::from_rgba_unmultiplied(40, 32, 26, 90));
        }
        painter.rect_filled(Rect::from_min_max(Pos2::new(rect.left(), rect.bottom() - 34.0), rect.max), CornerRadius { nw: 0, ne: 0, sw: 10, se: 10 }, Color32::from_rgb(26, 20, 15));

        // ore wall on the right with embedded ores
        let wall = Rect::from_min_max(Pos2::new(rect.right() - 220.0, rect.top() + 20.0), Pos2::new(rect.right() - 20.0, rect.bottom() - 34.0));
        painter.rect_filled(wall, CornerRadius::same(18), Color32::from_rgb(38, 30, 24));
        for (i, o) in game::ORES.iter().enumerate() {
            if let Some(t) = app.tex.ores.get(o.id) {
                let pos = wall.min + Vec2::new(30.0 + (i % 3) as f32 * 62.0, 30.0 + (i / 3) as f32 * 62.0);
                painter.image(t.id(), Rect::from_center_size(pos, Vec2::splat(34.0)), Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::from_white_alpha(70));
            }
        }

        // the miner, swinging faster with more hashrate
        let swing_rate = interval.map(|i| 1.0 / i.max(0.3)).unwrap_or(0.0) * std::f64::consts::TAU;
        let phase = (now * swing_rate.max(0.0)).sin() as f32;
        let mx = wall.left() - 120.0;
        let bob = if interval.is_some() { phase.abs() * 4.0 } else { 0.0 };
        if let Some(t) = &app.tex.miner {
            let r = Rect::from_center_size(Pos2::new(mx, rect.bottom() - 34.0 - 80.0 - bob), Vec2::splat(160.0));
            ui.put(r, egui::Image::new((t.id(), Vec2::splat(160.0))).rotate(phase * 0.08, Vec2::splat(0.5)).corner_radius(80));
        }
        // sparks when the pick lands
        if interval.is_some() && phase > 0.85 {
            for k in 0..6 {
                let a = k as f32 * 1.1 + now as f32 * 7.0;
                let d = 10.0 + (now as f32 * 40.0 + k as f32 * 13.0) % 22.0;
                painter.circle_filled(Pos2::new(wall.left() - 6.0, rect.center().y + 10.0) + Vec2::angled(a) * d, 1.6, Color32::from_rgb(255, 190, 90));
            }
        }

        // last find pops out of the wall
        if let Some((id, at)) = app.game.last_find.clone() {
            let age = (now - at) as f32;
            if age < 3.0 {
                let o = game::ore(&id);
                let c = rarity_color(&p, o.rarity);
                let k = (age / 0.35).min(1.0);
                let s = 0.4 + 0.6 * (1.0 - (1.0 - k).powi(3)) + if o.rarity >= Rarity::Epic { (age * 6.0).sin().abs() * 0.05 } else { 0.0 };
                let fade = if age > 2.4 { 1.0 - (age - 2.4) / 0.6 } else { 1.0 };
                let center = Pos2::new(rect.center().x - 40.0, rect.center().y - 30.0 - age * 12.0);
                let mut glow = vec![];
                radial(&mut glow, center, Vec2::splat(90.0 * s), alpha(c, 0.45 * fade));
                painter.extend(glow);
                if o.rarity >= Rarity::Rare {
                    for k in 0..12 {
                        let a = k as f32 / 12.0 * std::f32::consts::TAU + age;
                        painter.line_segment([center + Vec2::angled(a) * 50.0 * s, center + Vec2::angled(a) * (70.0 + age * 30.0) * s], Stroke::new(2.0, alpha(c, 0.5 * fade)));
                    }
                }
                if let Some(t) = app.tex.ores.get(o.id) {
                    painter.image(t.id(), Rect::from_center_size(center, Vec2::splat(72.0 * s)), Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::from_white_alpha((255.0 * fade) as u8));
                }
                painter.text(center + Vec2::new(0.0, 56.0), Align2::CENTER_CENTER, format!("{} · {}", o.name, o.rarity.name()), bold(15.0), alpha(c, fade));
                painter.text(center + Vec2::new(0.0, 76.0), Align2::CENTER_CENTER, format!("+{:.1} Cave BTC", o.value * 0.1), egui::FontId::proportional(12.5), alpha(p.warn, fade));
            }
        }

        // progress to next find
        let bar = Rect::from_min_size(Pos2::new(rect.left() + 20.0, rect.bottom() - 22.0), Vec2::new(rect.width() - 260.0, 8.0));
        painter.rect_filled(bar, CornerRadius::same(4), Color32::from_rgb(50, 40, 32));
        let mut fill = bar;
        fill.set_width(bar.width() * app.game.progress.clamp(0.0, 1.0) as f32);
        painter.rect_filled(fill, CornerRadius::same(4), mix(p.pri, p.warn, app.game.progress as f32));
        let label = match interval {
            Some(i) => format!("digging · one find every {i:.1} s"),
            None => "your miners are off · the pick is resting".into(),
        };
        painter.text(Pos2::new(rect.left() + 20.0, rect.top() + 18.0), Align2::LEFT_CENTER, label, bold(12.5), Color32::from_rgb(220, 200, 180));
        if app.game.has("treasure_detector", unix) {
            if let Some(n) = &app.game.next {
                let o = game::ore(n);
                painter.text(Pos2::new(rect.left() + 20.0, rect.top() + 38.0), Align2::LEFT_CENTER, format!("detector: next is {}", o.name), egui::FontId::proportional(12.0), rarity_color(&p, o.rarity));
            }
        }
    });
    ui.add_space(14.0);

    let luck = app.game.luck(unix);
    let speed = app.game.speed(unix);
    let g = app.game.clone();
    w::cols(ui, 4, 14.0, |i, ui| match i {
        0 => w::stat(ui, &p, "Cave BTC", &format!("{:.1}", g.balance), "", &format!("best {:.1} · earned {:.1}", g.best_balance, g.earned), Some(p.warn)),
        1 => w::stat(ui, &p, "Ores dug", &format!("{}", g.total_mined), "", &format!("{} legendary", g.legendary), None),
        2 => w::stat(ui, &p, "Dig power", &fmt::hash(Some(ghs)).0, fmt::hash(Some(ghs)).1, "your real fleet hashrate", None),
        _ => w::stat(ui, &p, "Boosts", &format!("×{:.1}", luck), "luck", &format!("×{speed:.1} speed"), None),
    });
    ui.add_space(14.0);

    // ---- inventory
    let mut sell: Option<(String, u64)> = None;
    w::card(ui, &p, |ui| {
        w::h3_row(ui, &p, "Inventory", |ui| {
            ui.label(RichText::new(format!("worth {:.1} Cave BTC", g.inventory_value())).size(12.0).color(p.dim));
        });
        ui.add_space(6.0);
        let n = ((ui.available_width() + 10.0) / 150.0).floor().max(1.0) as usize;
        let ores: Vec<&game::Ore> = game::ORES.iter().collect();
        for chunk in ores.chunks(n) {
            w::cols(ui, n, 10.0, |i, ui| {
                let Some(o) = chunk.get(i) else { return };
                let count = g.inventory.get(o.id).copied().unwrap_or(0);
                let c = rarity_color(&p, o.rarity);
                egui::Frame::new().fill(p.panel2).stroke(Stroke::new(1.0, alpha(c, if count > 0 { 0.5 } else { 0.15 }))).corner_radius(12).inner_margin(10).show(ui, |ui| {
                    ui.set_min_width(ui.available_width());
                    ui.vertical_centered(|ui| {
                        if let Some(t) = app.tex.ores.get(o.id) {
                            ui.add(egui::Image::new((t.id(), Vec2::splat(46.0))).tint(if count > 0 { Color32::WHITE } else { Color32::from_white_alpha(60) }).corner_radius(8));
                        }
                        ui.label(RichText::new(o.name).font(bold(13.5)));
                        ui.label(RichText::new(o.rarity.name()).size(11.0).color(c));
                        ui.label(RichText::new(format!("× {count}")).font(bold(16.0)));
                        ui.add_enabled_ui(count > 0, |ui| {
                            ui.horizontal(|ui| {
                                if w::small(ui, &p, "Sell 1").clicked() {
                                    sell = Some((o.id.into(), 1));
                                }
                                if w::small(ui, &p, "All").clicked() {
                                    sell = Some((o.id.into(), count));
                                }
                            });
                        });
                    });
                });
            });
            ui.add_space(10.0);
        }
    });
    if let Some((id, n)) = sell {
        app.game.sell(&id, n);
        app.save_game();
    }
    ui.add_space(14.0);

    // ---- shop
    let mut buy: Option<&'static str> = None;
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Shop");
        ui.add_space(6.0);
        let n = ((ui.available_width() + 10.0) / 240.0).floor().max(1.0) as usize;
        let items: Vec<&game::ShopItem> = game::SHOP.iter().collect();
        for chunk in items.chunks(n) {
            w::cols(ui, n, 10.0, |i, ui| {
                let Some(it) = chunk.get(i) else { return };
                let owned = g.has(it.id, unix);
                egui::Frame::new().fill(p.panel2).stroke(Stroke::new(1.0, if owned { alpha(p.good, 0.5) } else { p.line })).corner_radius(12).inner_margin(12).show(ui, |ui| {
                    ui.set_min_width(ui.available_width());
                    ui.set_min_height(118.0);
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(it.icon).size(22.0).color(p.warn));
                        ui.vertical(|ui| {
                            ui.label(RichText::new(it.name).font(bold(14.0)));
                            ui.label(RichText::new(it.desc).size(11.5).color(p.dim));
                        });
                    });
                    ui.add_space(6.0);
                    ui.horizontal(|ui| {
                        ui.label(RichText::new(format!("{:.0} Cave BTC", it.price)).font(bold(13.0)).color(p.warn));
                        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                            if owned && it.minutes == 0 {
                                ui.label(RichText::new("owned").color(p.good));
                            } else {
                                if owned {
                                    let left = g.owned.get(it.id).copied().unwrap_or(0) - unix;
                                    ui.label(RichText::new(format!("{}m left", left / 60)).size(11.5).color(p.good));
                                }
                                if w::button(ui, &p, w::Kind::Primary, true, if owned { "Extend" } else { "Buy" }).clicked() {
                                    buy = Some(it.id);
                                }
                            }
                        });
                    });
                });
            });
            ui.add_space(10.0);
        }
    });
    if let Some(id) = buy {
        match app.game.buy(id, unix) {
            Ok(()) => {
                app.save_game();
                app.toast("Bought!", Tone::Ok);
            }
            Err(e) => app.toast(e, Tone::Err),
        }
    }
}
