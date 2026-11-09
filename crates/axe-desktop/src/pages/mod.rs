//! Page state and routing.

use std::collections::HashMap;

use axe_core::miner::{PoolConfig, SwarmPeer, Tuning};
use axe_core::Found;
use eframe::egui::{self, RichText};

use crate::app::{App, Page, Tone};
use crate::jobs::{self, Job};
use crate::widgets::{self as w, bold, Series};

mod cave;
mod dashboard;
mod leaderboard;
mod miner;
mod pools;
mod swarm;
mod system;
mod tuning;

pub const RANGES: [(&str, &str); 5] = [("1h", "1H"), ("6h", "6H"), ("24h", "24H"), ("7d", "7D"), ("30d", "30D")];

#[derive(Default)]
pub struct SwarmState {
    pub ip: String,
    pub name: String,
    pub subnet: String,
    pub focus: bool,
    pub auto_scan: bool,
    pub add: Option<Job<Result<String, String>>>,
    pub scan: Option<Job<(String, Vec<Found>)>>,
    pub found: Option<Vec<Found>>,
    pub peers: Option<(String, Vec<SwarmPeer>)>,
    pub peers_job: Option<Job<Result<(String, Vec<SwarmPeer>), String>>>,
}

#[derive(Default)]
pub struct PoolsState {
    pub sel: Option<i64>,
    pub loaded_for: Option<i64>,
    pub cfg: Option<PoolConfig>,
    pub load: Option<Job<Result<PoolConfig, String>>>,
    pub save: Option<Job<Result<String, String>>>,
    pub err: String,
    pub copy_open: bool,
    pub targets: Vec<i64>,
    pub copy: Option<Job<Vec<(String, Result<String, String>)>>>,
}

#[derive(Default)]
pub struct TuningState {
    pub sel: Option<i64>,
    pub loaded_for: Option<i64>,
    pub t: Option<Tuning>,
    pub load: Option<Job<Result<Tuning, String>>>,
    pub save: Option<Job<Result<String, String>>>,
    pub err: String,
}

pub struct LoginState {
    pub miner: i64,
    pub code: String,
    pub err: String,
    pub job: Option<Job<Result<(), String>>>,
}

#[derive(Default)]
pub struct SystemState {
    pub poll: String,
    pub price: String,
    pub currency: String,
    pub alert_temp: String,
    pub alert_drop: String,
}

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum LbTab {
    Shares,
    Miners,
    Cave,
    Achievements,
}

pub struct State {
    pub dash_range: &'static str,
    pub dash_series: Series,
    pub miner_range: &'static str,
    pub miner_series: Series,
    pub swarm: SwarmState,
    pub pools: PoolsState,
    pub tuning: TuningState,
    pub login: Option<LoginState>,
    pub rename: Option<(i64, String)>,
    pub system: SystemState,
    pub lb: LbTab,
    pub restart: Option<Job<Result<String, String>>>,
}

impl State {
    pub fn new(s: &HashMap<String, String>) -> Self {
        let g = |k: &str, d: &str| s.get(k).cloned().unwrap_or_else(|| d.to_string());
        Self {
            dash_range: "6h",
            dash_series: Series::Hashrate,
            miner_range: "1h",
            miner_series: Series::Hashrate,
            swarm: SwarmState { subnet: g("scan_subnet", ""), ..Default::default() },
            pools: PoolsState::default(),
            tuning: TuningState::default(),
            login: None,
            rename: None,
            system: SystemState {
                poll: g("poll_secs", "10"),
                price: g("energy_price", "0"),
                currency: g("currency", "€"),
                alert_temp: g("alert_temp", "70"),
                alert_drop: g("alert_drop", "25"),
            },
            lb: LbTab::Shares,
            restart: None,
        }
    }
}

pub fn header(ui: &mut egui::Ui, app: &App, title: &str, right: impl FnOnce(&mut egui::Ui)) {
    let p = app.pal;
    ui.horizontal(|ui| {
        ui.label(RichText::new(title).font(bold(22.0)).color(p.text));
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), right);
    });
    ui.add_space(14.0);
}

pub fn show(app: &mut App, ui: &mut egui::Ui, ctx: &egui::Context, now: f64) {
    // finished restarts report back wherever you are
    if let Some(r) = jobs::poll(&mut app.st.restart) {
        match r {
            Ok(m) => app.toast(m, Tone::Ok),
            Err(e) => app.toast(e, Tone::Err),
        }
    }
    match app.page {
        Page::Dashboard => dashboard::show(app, ui, now),
        Page::Miner(id) => miner::show(app, ui, ctx, now, id),
        Page::Swarm => swarm::show(app, ui, ctx),
        Page::Pools => pools::show(app, ui, ctx),
        Page::Tuning => tuning::show(app, ui, ctx),
        Page::Cave => cave::show(app, ui, now),
        Page::Leaderboard => leaderboard::show(app, ui),
        Page::System => system::show(app, ui, ctx),
    }
}

/// Sends a restart to one miner in the background.
pub fn restart(app: &mut App, ctx: &egui::Context, id: i64) {
    let Some(m) = app.miner(id) else { return };
    let (row, name) = (m.row.clone(), m.name());
    let e = app.engine.clone();
    app.st.restart = Some(app.spawn(ctx, async move {
        match e.client.restart(&row.ip, &row.kind, &row.session).await {
            Ok(_) => {
                let _ = e.db.add_event(Some(row.id), "restart", &format!("Restart sent to {name}"));
                Ok(format!("{name} is restarting"))
            }
            Err(err) => Err(format!("{name}: {err}")),
        }
    }));
}

/// Dialogs drawn above the pages.
pub fn modals(app: &mut App, ctx: &egui::Context, _now: f64) {
    let p = app.pal;
    // two-factor login
    let mut close_login = false;
    let mut done_login = false;
    if let Some(l) = app.st.login.as_mut() {
        if let Some(r) = jobs::poll(&mut l.job) {
            match r {
                Ok(()) => done_login = true,
                Err(e) => l.err = e,
            }
        }
    }
    if done_login {
        app.st.login = None;
        app.st.pools.loaded_for = None;
        app.st.tuning.loaded_for = None;
        app.engine.wake.notify_one();
        app.toast("Logged in", Tone::Ok);
    }
    let names: HashMap<i64, (String, axe_core::db::MinerRow)> = app.miners.iter().map(|m| (m.row.id, (m.name(), m.row.clone()))).collect();
    if let Some(l) = app.st.login.as_mut() {
        let (name, row) = names.get(&l.miner).cloned().unwrap_or_default();
        let mut go = false;
        modal(ctx, &p, "login", &format!("Log in to {name}"), |ui| {
            ui.label(RichText::new("This miner has two-factor login on. Enter the 6-digit code from your authenticator app. AxeMobile keeps the session, so you only do this once.").color(p.dim));
            ui.add_space(8.0);
            let r = ui.add(egui::TextEdit::singleline(&mut l.code).hint_text("123456").desired_width(f32::INFINITY));
            r.request_focus();
            if r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter)) {
                go = true;
            }
            if !l.err.is_empty() {
                ui.label(RichText::new(&l.err).color(p.bad));
            }
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if w::primary(ui, &p, if l.job.is_some() { "Logging in…" } else { "Log in" }).clicked() {
                    go = true;
                }
                if w::alt(ui, &p, "Cancel").clicked() {
                    close_login = true;
                }
            });
        });
        if go && l.job.is_none() && l.code.trim().len() >= 6 {
            let e = app.engine.clone();
            let code = l.code.trim().to_string();
            l.err.clear();
            l.job = Some(Job::spawn(app.rt.handle(), ctx, async move {
                let tok = e.client.login(&row.ip, &code).await.map_err(|x| x.to_string())?;
                e.db.set_session(row.id, &tok).map_err(|x| x.to_string())?;
                Ok(())
            }));
        }
    }
    if close_login {
        app.st.login = None;
    }

    // rename
    let mut rename_done: Option<(i64, String)> = None;
    let mut rename_close = false;
    if let Some((id, name)) = app.st.rename.as_mut() {
        modal(ctx, &p, "rename", "Rename", |ui| {
            ui.label(RichText::new("Only changes the name inside AxeMobile, not the miner's hostname.").color(p.dim));
            ui.add_space(8.0);
            let r = ui.add(egui::TextEdit::singleline(name).desired_width(f32::INFINITY));
            r.request_focus();
            let enter = r.lost_focus() && ui.input(|i| i.key_pressed(egui::Key::Enter));
            ui.add_space(8.0);
            ui.horizontal(|ui| {
                if w::primary(ui, &p, "Save").clicked() || enter {
                    rename_done = Some((*id, name.trim().to_string()));
                }
                if w::alt(ui, &p, "Cancel").clicked() {
                    rename_close = true;
                }
            });
        });
    }
    if let Some((id, name)) = rename_done {
        let _ = app.engine.db.rename_miner(id, &name);
        app.st.rename = None;
        app.refresh_now();
    }
    if rename_close {
        app.st.rename = None;
    }

    pools::copy_modal(app, ctx);
}

pub fn modal(ctx: &egui::Context, p: &crate::theme::Pal, id: &str, title: &str, add: impl FnOnce(&mut egui::Ui)) {
    let screen = ctx.content_rect();
    egui::Area::new(egui::Id::unique(("dim", id))).order(egui::Order::Foreground).fixed_pos(screen.min).show(ctx, |ui| {
        let (r, _) = ui.allocate_exact_size(screen.size(), egui::Sense::click());
        ui.painter().rect_filled(r, 0.0, egui::Color32::from_black_alpha(150));
    });
    egui::Window::new(title)
        .id(egui::Id::unique(("modal", id)))
        .collapsible(false)
        .resizable(false)
        .title_bar(false)
        .order(egui::Order::Foreground)
        .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
        .fixed_size([440.0, 0.0])
        .frame(
            egui::Frame::new()
                .fill(p.panel2)
                .stroke(egui::Stroke::new(1.0, if p.dtv() { crate::theme::alpha(p.pri, 0.5) } else { p.line }))
                .corner_radius(14)
                .inner_margin(20)
                .shadow(egui::epaint::Shadow { offset: [0, 12], blur: 40, spread: 0, color: egui::Color32::from_black_alpha(160) }),
        )
        .show(ctx, |ui| {
            ui.label(RichText::new(title).font(bold(18.0)));
            ui.add_space(4.0);
            add(ui);
        });
}

/// Row of chips to pick which miner a page works on.
pub fn picker(app: &App, ui: &mut egui::Ui, sel: &mut Option<i64>) {
    let p = app.pal;
    ui.horizontal_wrapped(|ui| {
        for m in &app.miners {
            let on = *sel == Some(m.row.id);
            let col = if m.online() { p.good } else if m.snap().is_some() { p.bad } else { p.warn };
            let text = m.name();
            let galley = ui.painter().layout_no_wrap(text, bold(13.0), if on { p.pri } else { p.dim });
            let size = galley.size() + egui::vec2(40.0, 16.0);
            let (r, resp) = ui.allocate_exact_size(size, egui::Sense::click());
            let fill = if on { crate::theme::alpha(p.pri, 0.1) } else { p.panel2 };
            let stroke = if on { p.pri } else { p.line };
            ui.painter().rect(r, 10, fill, egui::Stroke::new(1.0, stroke), egui::StrokeKind::Inside);
            ui.painter().circle_filled(egui::pos2(r.left() + 16.0, r.center().y), 4.5, col);
            ui.painter().galley(egui::pos2(r.left() + 28.0, r.center().y - galley.size().y / 2.0), galley, p.text);
            if resp.clicked() {
                *sel = Some(m.row.id);
            }
            if resp.hovered() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
        }
    });
    ui.add_space(14.0);
}

pub fn kind_tag(ui: &mut egui::Ui, app: &App, kind: &str) {
    let p = app.pal;
    if kind == "axeforge" {
        w::tag(ui, &p, "AxeForge", Some(p.pri));
    } else {
        w::tag(ui, &p, "AxeOS", None);
    }
}

pub fn status_pill(ui: &mut egui::Ui, app: &App, m: &crate::app::MinerView) {
    let p = app.pal;
    if m.needs_login() {
        w::pill(ui, "Login", p.warn, false);
    } else if !m.online() {
        w::pill(ui, "Offline", p.bad, false);
    } else if m.snap().is_some_and(|s| !s.fault.is_empty()) {
        w::pill(ui, "Fault", p.bad, true);
    } else if m.snap().and_then(|s| s.pool_connected) == Some(false) {
        w::pill(ui, "No pool", p.warn, true);
    } else {
        w::pill(ui, "Mining", p.good, true);
    }
}

pub fn events_list(ui: &mut egui::Ui, app: &App, events: &[axe_core::db::Event], empty: &str) {
    let p = app.pal;
    if events.is_empty() {
        ui.label(RichText::new(empty).color(p.dim));
        return;
    }
    for (i, e) in events.iter().enumerate() {
        if i > 0 {
            let r = ui.available_rect_before_wrap();
            ui.painter().hline(r.x_range(), r.top(), egui::Stroke::new(1.0, p.line));
            ui.add_space(6.0);
        }
        ui.horizontal(|ui| {
            let c = match e.kind.as_str() {
                "online" | "added" => p.good,
                "offline" | "fault" | "hot" | "drop" => p.bad,
                "best" | "block" => p.warn,
                _ => p.pri,
            };
            w::dot(ui, c, matches!(e.kind.as_str(), "best" | "block"));
            // fixed widths so a long message truncates instead of widening the card
            let time_w = 90.0;
            let msg_w = (ui.available_width() - time_w - 10.0).max(60.0);
            ui.allocate_ui_with_layout(egui::vec2(msg_w, 20.0), egui::Layout::left_to_right(egui::Align::Center), |ui| {
                ui.set_width(msg_w);
                ui.add(egui::Label::new(RichText::new(&e.message).size(13.5)).truncate());
            });
            ui.allocate_ui_with_layout(egui::vec2(time_w, 20.0), egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.set_width(time_w);
                ui.label(RichText::new(crate::fmt::ago(e.ts)).size(11.5).color(p.dim));
            });
        });
        ui.add_space(4.0);
    }
}
