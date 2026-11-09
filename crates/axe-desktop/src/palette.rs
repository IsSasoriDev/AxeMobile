//! Ctrl+K command palette: type a few letters to jump to a page or a
//! miner, restart something, switch theme and so on.

use eframe::egui::{self, Align2, Color32, CornerRadius, Key, Pos2, Rect, RichText, Sense, Stroke, Vec2};

use crate::app::{App, Page, Tone, DTV_SHOP};
use crate::theme::{alpha, ThemeId};
use crate::widgets::{bold, ic, icon_font};

#[derive(Clone, Copy)]
pub enum Cmd {
    Page(Page),
    Miner(i64),
    Restart(i64),
    OpenWeb(i64),
    Theme(ThemeId),
    Intro,
    AddMiner,
    Scan,
    Refresh,
    Shop,
}

#[derive(Default)]
pub struct Palette {
    pub query: String,
    pub sel: usize,
    focus: bool,
}

struct Item {
    icon: &'static str,
    title: String,
    hint: String,
    cmd: Cmd,
}

fn items(app: &App) -> Vec<Item> {
    let mut v = vec![];
    let page = |icon, title: &str, hint: &str, p| Item { icon, title: title.into(), hint: hint.into(), cmd: Cmd::Page(p) };
    v.push(page(ic::HOME, "Dashboard", "Ctrl+1", Page::Dashboard));
    v.push(page(ic::SWARM, "Swarm", "Ctrl+2", Page::Swarm));
    v.push(page(ic::POOLS, "Pools", "Ctrl+3", Page::Pools));
    v.push(page(ic::TUNE, "Tuning", "Ctrl+4", Page::Tuning));
    v.push(page(ic::GAME, "The Cave", "Ctrl+5", Page::Cave));
    v.push(page(ic::TROPHY, "Leaderboard", "Ctrl+6", Page::Leaderboard));
    v.push(page(ic::SETTINGS, "System", "Ctrl+7", Page::System));
    for m in &app.miners {
        let id = m.row.id;
        let name = m.name();
        let state = if m.online() { crate::fmt::hash_str(m.snap().and_then(|s| s.hashrate)) } else { "offline".into() };
        v.push(Item { icon: ic::OPEN, title: name.clone(), hint: format!("{} · {}", m.row.ip, state), cmd: Cmd::Miner(id) });
        v.push(Item { icon: ic::RESTART, title: format!("Restart {name}"), hint: m.row.ip.clone(), cmd: Cmd::Restart(id) });
        v.push(Item { icon: ic::OPEN, title: format!("Open {name}'s web page"), hint: format!("http://{}/", m.row.ip), cmd: Cmd::OpenWeb(id) });
    }
    v.push(Item { icon: ic::ADD, title: "Add a miner".into(), hint: "Ctrl+N".into(), cmd: Cmd::AddMiner });
    v.push(Item { icon: ic::SEARCH, title: "Scan the network for miners".into(), hint: String::new(), cmd: Cmd::Scan });
    v.push(Item { icon: ic::RESTART, title: "Refresh all miners now".into(), hint: "F5".into(), cmd: Cmd::Refresh });
    if app.theme == ThemeId::Dtv {
        v.push(Item { icon: ic::SETTINGS, title: "Switch to the AxeForge theme".into(), hint: String::new(), cmd: Cmd::Theme(ThemeId::Forge) });
    } else {
        v.push(Item { icon: ic::SETTINGS, title: "Switch to the DTV Electronics theme".into(), hint: String::new(), cmd: Cmd::Theme(ThemeId::Dtv) });
    }
    v.push(Item { icon: ic::GAME, title: "Play the intro".into(), hint: String::new(), cmd: Cmd::Intro });
    v.push(Item { icon: ic::SHOP, title: "Open the DTV Electronics shop".into(), hint: "dtvelectronics.com".into(), cmd: Cmd::Shop });
    v
}

fn matches(item: &Item, q: &str) -> bool {
    let hay = format!("{} {}", item.title, item.hint).to_lowercase();
    q.split_whitespace().all(|w| hay.contains(w))
}

impl Palette {
    pub fn new() -> Self {
        Self { query: String::new(), sel: 0, focus: true }
    }
}

/// Draws the palette if open. Returns the command picked, if any.
pub fn show(app: &mut App, ctx: &egui::Context) -> Option<Cmd> {
    let p = app.pal;
    let all = items(app);
    let pal = app.palette.as_mut()?;
    let q = pal.query.trim().to_lowercase();
    let list: Vec<&Item> = all.iter().filter(|i| matches(i, &q)).take(9).collect();
    if pal.sel >= list.len() {
        pal.sel = list.len().saturating_sub(1);
    }
    let (up, down, enter, esc) = ctx.input(|i| (i.key_pressed(Key::ArrowUp), i.key_pressed(Key::ArrowDown), i.key_pressed(Key::Enter), i.key_pressed(Key::Escape)));
    if up {
        pal.sel = pal.sel.saturating_sub(1);
    }
    if down && pal.sel + 1 < list.len() {
        pal.sel += 1;
    }
    let mut picked: Option<Cmd> = if enter { list.get(pal.sel).map(|i| i.cmd) } else { None };
    let mut close = esc;

    let screen = ctx.content_rect();
    egui::Area::new(egui::Id::unique("palette-dim")).order(egui::Order::Foreground).fixed_pos(screen.min).show(ctx, |ui| {
        let (r, resp) = ui.allocate_exact_size(screen.size(), Sense::click());
        ui.painter().rect_filled(r, 0.0, Color32::from_black_alpha(150));
        if resp.clicked() {
            close = true;
        }
    });
    let width = 560.0f32.min(screen.width() - 40.0);
    let pos = Pos2::new(screen.center().x - width / 2.0, screen.top() + screen.height() * 0.16);
    egui::Area::new(egui::Id::unique("palette")).order(egui::Order::Foreground).fixed_pos(pos).show(ctx, |ui| {
        egui::Frame::new()
            .fill(p.panel2)
            .stroke(Stroke::new(1.0, if p.dtv() { alpha(p.pri, 0.5) } else { p.line }))
            .corner_radius(14)
            .inner_margin(10)
            .shadow(egui::epaint::Shadow { offset: [0, 16], blur: 48, spread: 0, color: Color32::from_black_alpha(170) })
            .show(ui, |ui| {
                ui.set_width(width - 20.0);
                ui.horizontal(|ui| {
                    ui.label(RichText::new(ic::SEARCH).font(icon_font(16.0)).color(p.dim));
                    let r = ui.add(
                        egui::TextEdit::singleline(&mut pal.query)
                            .hint_text("Jump to a page or miner, or run a command…")
                            .frame(egui::Frame::NONE)
                            .font(egui::FontId::proportional(16.0))
                            .desired_width(f32::INFINITY),
                    );
                    if pal.focus {
                        r.request_focus();
                        pal.focus = false;
                    }
                    if r.changed() {
                        pal.sel = 0;
                    }
                });
                ui.add_space(6.0);
                let rr = ui.available_rect_before_wrap();
                ui.painter().hline(rr.x_range(), rr.top(), Stroke::new(1.0, p.line));
                ui.add_space(6.0);
                if list.is_empty() {
                    ui.label(RichText::new("Nothing matches.").color(p.dim));
                }
                for (i, it) in list.iter().enumerate() {
                    let (r, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 38.0), Sense::click());
                    let on = i == pal.sel;
                    if resp.hovered() && ui.input(|x| x.pointer.delta().length() > 0.0) {
                        pal.sel = i;
                    }
                    if on {
                        ui.painter().rect_filled(r, CornerRadius::same(9), alpha(p.pri, 0.14));
                        ui.painter().rect_filled(Rect::from_min_size(r.min, Vec2::new(3.0, r.height())), CornerRadius::same(2), p.pri);
                    }
                    let col = if on { p.pri } else { p.text };
                    ui.painter().text(Pos2::new(r.left() + 16.0, r.center().y), Align2::LEFT_CENTER, it.icon, icon_font(15.0), if on { p.pri } else { p.dim });
                    ui.painter().text(Pos2::new(r.left() + 42.0, r.center().y), Align2::LEFT_CENTER, &it.title, bold(14.0), col);
                    ui.painter().text(Pos2::new(r.right() - 12.0, r.center().y), Align2::RIGHT_CENTER, &it.hint, egui::FontId::proportional(12.0), p.dim);
                    if resp.clicked() {
                        picked = Some(it.cmd);
                    }
                }
                ui.add_space(4.0);
                ui.label(RichText::new("↑ ↓ to move · Enter to run · Esc to close").size(11.0).color(p.dim));
            });
    });
    if picked.is_some() || close {
        app.palette = None;
    }
    picked
}

/// Carries out a palette command.
pub fn run(app: &mut App, ctx: &egui::Context, cmd: Cmd) {
    match cmd {
        Cmd::Page(p) => app.page = p,
        Cmd::Miner(id) => app.page = Page::Miner(id),
        Cmd::Restart(id) => crate::pages::restart(app, ctx, id),
        Cmd::OpenWeb(id) => {
            if let Some(m) = app.miner(id) {
                ctx.open_url(egui::OpenUrl::new_tab(format!("http://{}/", m.row.ip)));
            }
        }
        Cmd::Theme(t) => {
            app.set_theme(ctx, t);
            if t == ThemeId::Dtv && app.setting("intro") != "0" {
                app.replay_intro();
            }
        }
        Cmd::Intro => app.replay_intro(),
        Cmd::AddMiner => {
            app.page = Page::Swarm;
            app.st.swarm.focus = true;
        }
        Cmd::Scan => {
            app.page = Page::Swarm;
            app.st.swarm.auto_scan = true;
        }
        Cmd::Refresh => {
            app.engine.wake.notify_one();
            app.refresh_now();
            app.toast("Refreshing miners", Tone::Info);
        }
        Cmd::Shop => ctx.open_url(egui::OpenUrl::new_tab(DTV_SHOP)),
    }
}
