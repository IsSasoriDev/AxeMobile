use eframe::egui::{self, RichText, Sense, Vec2};

use crate::app::{App, Page};
use crate::fmt;
use crate::widgets::{self as w, bold, Series};

use super::{events_list, header, kind_tag, status_pill, RANGES};

pub fn show(app: &mut App, ui: &mut egui::Ui, now: f64) {
    let p = app.pal;
    let f = app.fleet.clone();
    header(ui, app, "Dashboard", |ui| {
        if f.total > 0 {
            let col = if f.online == f.total { p.good } else if f.online > 0 { p.warn } else { p.bad };
            w::pill(ui, &format!("{}/{} online", f.online, f.total), col, true);
        }
    });

    if f.total == 0 {
        w::card(ui, &p, |ui| {
            ui.vertical_centered(|ui| {
                ui.add_space(40.0);
                ui.label(RichText::new("No miners yet").font(bold(20.0)));
                ui.label(RichText::new("Add a miner by IP or scan your network. AxeForge and AxeOS (Bitaxe, NerdAxe, NerdQaxe) are supported.").color(p.dim));
                ui.add_space(12.0);
                if w::primary(ui, &p, &format!("{}  Add miners", w::ic::ADD)).clicked() {
                    app.page = Page::Swarm;
                }
                ui.add_space(40.0);
            });
        });
        return;
    }

    // hero: gauge + fleet chart
    let range = app.st.dash_range;
    let hist = app.history(now, None, range);
    let avail = ui.available_width();
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = 14.0;
        ui.allocate_ui_with_layout(Vec2::new(250.0, 0.0), egui::Layout::top_down(egui::Align::Center), |ui| {
            ui.set_width(250.0);
            w::card(ui, &p, |ui| {
                ui.vertical_centered(|ui| {
                    let sub = if f.expected > 0.0 { format!("{:.1}% of expected", f.hashrate / f.expected * 100.0) } else { "total hashrate".into() };
                    w::gauge(ui, &p, Some(f.hashrate), f.expected.max(f.hashrate).max(1.0), &sub);
                });
            });
        });
        let cw = avail - 250.0 - 14.0;
        ui.allocate_ui_with_layout(Vec2::new(cw, 0.0), egui::Layout::top_down(egui::Align::Min), |ui| {
            ui.set_width(cw);
            w::card_ex(ui, &p, true, |ui| {
                let mut r = app.st.dash_range;
                w::h3_row(ui, &p, "Fleet hashrate", |ui| {
                    w::seg(ui, &p, &mut r, &RANGES, true);
                    ui.add_space(6.0);
                    ui.label(RichText::new("— avg temp").size(11.0).color(p.mag));
                    ui.label(RichText::new("— hashrate").size(11.0).color(p.pri));
                });
                app.st.dash_range = r;
                ui.add_space(4.0);
                w::chart(ui, &p, &hist, Series::Hashrate, Some(Series::Temp), 186.0);
            });
        });
    });
    ui.add_space(14.0);

    let rej = if f.accepted + f.rejected > 0.0 { f.rejected / (f.accepted + f.rejected) * 100.0 } else { 0.0 };
    let (hv, hu) = fmt::hash(Some(f.hashrate));
    let power_sub = format!(
        "{}{}",
        f.efficiency.map(|e| format!("{e:.1} J/TH")).unwrap_or_else(|| "–".into()),
        f.cost_per_day.map(|c| format!(" · {}{:.2}/day", f.currency, c)).unwrap_or_default()
    );
    w::cols(ui, 4, 14.0, |i, ui| match i {
        0 => w::stat(ui, &p, "Total hashrate", &hv, hu, &format!("{} miner{} hashing", f.online, if f.online == 1 { "" } else { "s" }), None),
        1 => w::stat(ui, &p, "Power", &fmt::num(Some(f.power), 1), "W", &power_sub, None),
        2 => w::stat(ui, &p, "Best difficulty", &fmt::diff(f.best_diff), "", "across all miners", None),
        _ => w::stat(
            ui,
            &p,
            "Shares",
            &format!("{}", f.accepted as u64),
            "",
            &format!("{} rejected · {:.2}%{}", f.rejected as u64, rej, f.hottest.map(|t| format!(" · hottest {t:.0}°C")).unwrap_or_default()),
            None,
        ),
    });
    ui.add_space(14.0);

    // network & odds
    let market = app.engine.market.read().unwrap().clone();
    let net_diff = app.miners.iter().filter_map(|m| m.snap().and_then(|s| s.network_diff)).fold(0.0, f64::max);
    let height = app.miners.iter().filter_map(|m| m.snap().and_then(|s| s.block_height)).fold(0.0, f64::max);
    let odds = axe_core::market::odds_per_day(f.hashrate, net_diff);
    w::cols(ui, 3, 14.0, |i, ui| match i {
        0 => w::card(ui, &p, |ui| {
            ui.set_min_height(92.0);
            w::h3(ui, &p, "Bitcoin");
            match market.as_ref().and_then(|m| m.usd) {
                Some(usd) => {
                    w::big(ui, &p, &format!("${:.0}", usd), "", None);
                    let eur = market.as_ref().and_then(|m| m.eur).map(|e| format!("€{e:.0} · ")).unwrap_or_default();
                    let fee = market.as_ref().and_then(|m| m.fee_fast).map(|x| format!("fees {x:.0} sat/vB")).unwrap_or_default();
                    w::sub(ui, &p, format!("{eur}{fee}"));
                }
                None => {
                    w::big(ui, &p, "–", "", None);
                    w::sub(ui, &p, if app.setting("market") == "0" { "price lookup is off" } else { "fetching from mempool.space…" });
                }
            }
        }),
        1 => w::card(ui, &p, |ui| {
            ui.set_min_height(92.0);
            w::h3(ui, &p, "Chain");
            let h = market.as_ref().and_then(|m| m.height).unwrap_or(height);
            w::big(ui, &p, &if h > 0.0 { format!("{}", h as u64) } else { "–".into() }, "", None);
            let adj = market.as_ref().and_then(|m| m.retarget_pct.zip(m.retarget_blocks)).map(|(pc, b)| format!(" · next adj {pc:+.1}% in {b:.0} blocks")).unwrap_or_default();
            w::sub(ui, &p, format!("difficulty {}{adj}", fmt::diff(net_diff)));
        }),
        _ => w::card(ui, &p, |ui| {
            ui.set_min_height(92.0);
            w::h3(ui, &p, "Solo odds");
            match odds {
                Some(o) => {
                    let year = 1.0 - (1.0 - o).powf(365.0);
                    w::big(ui, &p, &format!("1 in {}", fmt_big(1.0 / o)), "per day", None);
                    w::sub(ui, &p, format!("{:.4}% chance this year", year * 100.0));
                }
                None => {
                    w::big(ui, &p, "–", "", None);
                    w::sub(ui, &p, "needs a hashing miner");
                }
            }
        }),
    });
    ui.add_space(18.0);

    // miner tiles
    ui.horizontal(|ui| {
        w::h3(ui, &p, "Miners");
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            if ui.add(egui::Label::new(RichText::new("Manage").size(12.0).color(p.dim).underline()).sense(Sense::click())).clicked() {
                app.page = Page::Swarm;
            }
        });
    });
    ui.add_space(6.0);
    let n = ((ui.available_width() + 14.0) / 300.0).floor().max(1.0) as usize;
    let miners = app.miners.clone();
    for chunk in miners.chunks(n) {
        let mut go = None;
        w::cols(ui, n, 14.0, |i, ui| {
            let Some(m) = chunk.get(i) else { return };
            let s = m.snap();
            let r = w::card(ui, &p, |ui| {
                ui.horizontal(|ui| {
                    w::dot(ui, if m.online() { p.good } else if s.is_some() { p.bad } else { p.warn }, m.online());
                    ui.add(egui::Label::new(RichText::new(m.name()).font(bold(15.0))).truncate());
                    ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| status_pill(ui, app, m));
                });
                let (v, u) = fmt::hash(if m.online() { s.and_then(|s| s.hashrate) } else { None });
                w::big(ui, &p, &v, u, None);
                ui.horizontal(|ui| {
                    ui.label(RichText::new(if m.row.model.is_empty() { "Unknown" } else { &m.row.model }).size(12.0).color(p.dim));
                    kind_tag(ui, app, &m.row.kind);
                    ui.label(RichText::new(&m.row.ip).size(12.0).color(p.dim));
                });
                ui.add_space(6.0);
                let cw = (ui.available_width() - 20.0) / 3.0 - 16.0;
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 6.0;
                    w::mini(ui, &p, "Temp", &format!("{}°", fmt::num(s.and_then(|s| s.temp), 1)), Some(w::temp_color(&p, s.and_then(|s| s.temp))), cw);
                    w::mini(ui, &p, "Power", &format!("{} W", fmt::num(s.and_then(|s| s.power), 1)), None, cw);
                    let up = if m.online() { fmt::uptime(s.and_then(|s| s.uptime)) } else if m.live.last_seen > 0 { fmt::ago(m.live.last_seen) } else { "never".into() };
                    w::mini(ui, &p, if m.online() { "Uptime" } else { "Seen" }, &up, None, cw);
                });
            });
            let resp = ui.interact(r.response.rect, ui.scope_id().with(("tile", m.row.id)), Sense::click());
            if resp.hovered() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if resp.clicked() {
                go = Some(m.row.id);
            }
        });
        if let Some(id) = go {
            app.page = Page::Miner(id);
        }
        ui.add_space(14.0);
    }

    let events = app.events.clone();
    w::card(ui, &p, |ui| {
        w::h3(ui, &p, "Activity");
        ui.add_space(4.0);
        events_list(ui, app, &events, "Events show up here: miners going offline, restarts, new best shares, blocks.");
    });
}

fn fmt_big(x: f64) -> String {
    if x >= 1e9 {
        format!("{:.1}B", x / 1e9)
    } else if x >= 1e6 {
        format!("{:.1}M", x / 1e6)
    } else if x >= 1e3 {
        format!("{:.0}K", x / 1e3)
    } else {
        format!("{x:.0}")
    }
}
