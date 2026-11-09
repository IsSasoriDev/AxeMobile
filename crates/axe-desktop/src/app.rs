//! Window shell: sidebar, page routing, intro, toasts, notifications,
//! the Cave game clock and keyboard shortcuts.

use std::collections::{BTreeMap, HashMap};
use std::sync::Arc;

use axe_core::db::{Event, MinerRow, Point};
use axe_core::{Engine, Fleet, Live, Snapshot};
use eframe::egui::{self, Align2, Color32, CornerRadius, Pos2, Rect, RichText, Sense, Stroke, Vec2};

use crate::blackhole::{BlackHole, Intro};
use crate::game::{self, Game};
use crate::jobs::Job;
use crate::pages;
use crate::sys;
use crate::theme::{self, alpha, Pal, ThemeId};
use crate::tray::{self, Tray, TrayMsg};
use crate::widgets::{self as w, bold, ic, icon_font};

pub const DTV_SHOP: &str = "https://dtvelectronics.com/";
pub const VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Clone)]
pub struct MinerView {
    pub row: MinerRow,
    pub live: Live,
}

impl MinerView {
    pub fn name(&self) -> String {
        if self.row.name.is_empty() { self.row.ip.clone() } else { self.row.name.clone() }
    }
    pub fn online(&self) -> bool {
        self.live.online && self.live.snap.is_some()
    }
    pub fn snap(&self) -> Option<&Snapshot> {
        self.live.snap.as_ref()
    }
    pub fn needs_login(&self) -> bool {
        self.live.error == "login required"
    }
    pub fn best(&self) -> f64 {
        self.row.best_diff.max(self.snap().and_then(|s| s.best_diff).unwrap_or(0.0))
    }
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Page {
    Dashboard,
    Miner(i64),
    Swarm,
    Pools,
    AxePool,
    Tuning,
    Cave,
    Leaderboard,
    System,
}

#[derive(Clone, Copy, PartialEq)]
pub enum Tone {
    Ok,
    Err,
    Info,
}

pub struct Tex {
    pub dtv: Option<egui::TextureHandle>,
    pub icon: Option<egui::TextureHandle>,
    pub miner: Option<egui::TextureHandle>,
    pub ores: HashMap<&'static str, egui::TextureHandle>,
}

pub struct App {
    pub rt: tokio::runtime::Runtime,
    pub engine: Arc<Engine>,
    pub page: Page,
    pub theme: ThemeId,
    pub pal: Pal,
    intro: Option<Intro>,
    splash: Option<f64>,
    bh: Option<Arc<BlackHole>>,
    pub tex: Tex,
    toast: Option<(String, Tone, f64)>,
    pub miners: Vec<MinerView>,
    pub fleet: Fleet,
    pub events: Vec<Event>,
    refreshed: f64,
    last_event: i64,
    hist: HashMap<String, (f64, Vec<Point>)>,
    pub st: pages::State,
    pub game: Game,
    game_saved: f64,
    last_tick: Option<f64>,
    pub unlocked: BTreeMap<String, i64>,
    ach_checked: f64,
    pub settings: HashMap<String, String>,
    start_minimized: bool,
    clock: std::time::Instant,
    tray: Option<Tray>,
    tray_updated: f64,
    quitting: bool,
    hidden: bool,
    shown_page: Page,
    page_at: f64,
    pub palette: Option<crate::palette::Palette>,
}

fn load_tex(ctx: &egui::Context, name: &str, bytes: &[u8]) -> Option<egui::TextureHandle> {
    let img = image::load_from_memory(bytes).ok()?.to_rgba8();
    let size = [img.width() as usize, img.height() as usize];
    let ci = egui::ColorImage::from_rgba_unmultiplied(size, img.as_raw());
    Some(ctx.load_texture(name, ci, egui::TextureOptions::LINEAR))
}

impl App {
    pub fn new(cc: &eframe::CreationContext<'_>, rt: tokio::runtime::Runtime, engine: Arc<Engine>, start_minimized: bool) -> Self {
        let ctx = &cc.egui_ctx;
        crate::fonts::install(ctx);
        let settings = engine.settings();
        let theme_id = ThemeId::from_key(settings.get("theme").map(String::as_str).unwrap_or("default"));
        let pal = Pal::get(theme_id);
        theme::apply(ctx, &pal);
        let mut ores = HashMap::new();
        for (id, bytes) in [
            ("coal", &include_bytes!("../assets/coal.png")[..]),
            ("copper", include_bytes!("../assets/copper.png")),
            ("iron", include_bytes!("../assets/iron.png")),
            ("gold", include_bytes!("../assets/gold.png")),
            ("emerald", include_bytes!("../assets/emerald.png")),
            ("diamond", include_bytes!("../assets/diamond.png")),
            ("bitcoin", include_bytes!("../assets/bitcoin.png")),
        ] {
            if let Some(t) = load_tex(ctx, id, bytes) {
                ores.insert(id, t);
            }
        }
        let tex = Tex {
            dtv: load_tex(ctx, "dtv", include_bytes!("../assets/dtv.png")),
            icon: load_tex(ctx, "icon", include_bytes!("../assets/icon.png")),
            miner: load_tex(ctx, "miner", include_bytes!("../assets/miner.png")),
            ores,
        };
        tray::keep_awake(ctx);
        let bh = cc.gl.as_ref().and_then(|gl| BlackHole::new(gl)).map(Arc::new);
        let intro_on = settings.get("intro").map(String::as_str) != Some("0") && !start_minimized;
        let game = Game::load(&settings.get("game").cloned().unwrap_or_default());
        let unlocked: BTreeMap<String, i64> = settings.get("achievements").and_then(|s| serde_json::from_str(s).ok()).unwrap_or_default();
        let last_event = engine.db.events(None, 1).ok().and_then(|e| e.first().map(|e| e.id)).unwrap_or(0);
        Self {
            rt,
            page: Page::Dashboard,
            theme: theme_id,
            pal,
            intro: (intro_on && theme_id == ThemeId::Dtv).then(Intro::new),
            splash: (intro_on && theme_id == ThemeId::Forge).then_some(-1.0),
            bh,
            tex,
            toast: None,
            miners: vec![],
            fleet: Fleet::default(),
            events: vec![],
            refreshed: -10.0,
            last_event,
            hist: HashMap::new(),
            st: pages::State::new(&settings),
            game,
            game_saved: 0.0,
            last_tick: None,
            unlocked,
            ach_checked: -10.0,
            settings,
            engine,
            start_minimized,
            clock: std::time::Instant::now(),
            tray: Tray::new(ctx),
            tray_updated: -100.0,
            quitting: false,
            hidden: false,
            shown_page: Page::Dashboard,
            page_at: -10.0,
            palette: None,
        }
    }

    // ---------------------------------------------------------------- helpers

    /// Seconds since start, also while the window is hidden.
    pub fn wall(&self) -> f64 {
        self.clock.elapsed().as_secs_f64()
    }

    pub fn has_tray(&self) -> bool {
        self.tray.is_some()
    }

    fn show_window(&mut self, ctx: &egui::Context) {
        self.hidden = false;
        ctx.send_viewport_cmd(egui::ViewportCommand::Visible(true));
        ctx.send_viewport_cmd(egui::ViewportCommand::Minimized(false));
        ctx.send_viewport_cmd(egui::ViewportCommand::Focus);
    }

    fn hide_window(&mut self, ctx: &egui::Context) {
        self.hidden = true;
        ctx.send_viewport_cmd(egui::ViewportCommand::Visible(false));
    }

    fn update_tray(&mut self, now: f64) {
        let Some(t) = &self.tray else { return };
        if now - self.tray_updated < 5.0 {
            return;
        }
        self.tray_updated = now;
        let f = &self.fleet;
        let tip = if f.total == 0 {
            "AxeMobile
No miners yet".to_string()
        } else {
            let mut tip = format!(
                "AxeMobile
{}/{} online · {}
{:.0} W{}",
                f.online,
                f.total,
                crate::fmt::hash_str(Some(f.hashrate)),
                f.power,
                f.efficiency.map(|e| format!(" · {e:.1} J/TH")).unwrap_or_default()
            );
            if let Some(h) = f.hottest {
                tip.push_str(&format!("
hottest {h:.0}°C · best {}", crate::fmt::diff(f.best_diff)));
            }
            tip
        };
        let lines: Vec<(i64, String)> = self
            .miners
            .iter()
            .map(|m| {
                let s = m.snap();
                let text = if m.online() {
                    format!(
                        "● {}   {}   {:.0}°C",
                        m.name(),
                        crate::fmt::hash_str(s.and_then(|s| s.hashrate)),
                        s.and_then(|s| s.temp).unwrap_or(0.0)
                    )
                } else {
                    format!("○ {}   offline", m.name())
                };
                (m.row.id, text)
            })
            .collect();
        t.update(&tip, &lines);
    }

    pub fn toast(&mut self, msg: impl Into<String>, tone: Tone) {
        self.toast = Some((msg.into(), tone, -1.0));
    }

    pub fn spawn<T: Send + 'static>(&self, ctx: &egui::Context, fut: impl std::future::Future<Output = T> + Send + 'static) -> Job<T> {
        Job::spawn(self.rt.handle(), ctx, fut)
    }

    pub fn setting(&self, k: &str) -> String {
        self.settings.get(k).cloned().unwrap_or_else(|| self.engine.setting(k))
    }

    pub fn set_setting(&mut self, k: &str, v: &str) {
        let _ = self.engine.db.set_setting(k, v);
        self.settings.insert(k.into(), v.into());
        self.engine.wake.notify_one();
    }

    pub fn set_theme(&mut self, ctx: &egui::Context, t: ThemeId) {
        self.theme = t;
        self.pal = Pal::get(t);
        theme::apply(ctx, &self.pal);
        self.set_setting("theme", t.key());
    }

    pub fn replay_intro(&mut self) {
        if self.theme == ThemeId::Dtv {
            self.intro = Some(Intro::new());
        } else {
            self.splash = Some(-1.0);
        }
    }

    pub fn refresh_now(&mut self) {
        self.refreshed = -10.0;
        self.hist.clear();
    }

    /// History for one miner or the fleet, cached for 15 s.
    pub fn history(&mut self, now: f64, miner: Option<i64>, range: &str) -> Vec<Point> {
        let key = format!("{miner:?}:{range}");
        if let Some((t, v)) = self.hist.get(&key) {
            if now - t < 15.0 {
                return v.clone();
            }
        }
        let (span, bucket) = match range {
            "6h" => (6 * 3600, 120),
            "24h" => (86_400, 600),
            "7d" => (7 * 86_400, 3600),
            "30d" => (30 * 86_400, 6 * 3600),
            _ => (3600, 30),
        };
        let v = self.engine.db.history(miner, axe_core::db::now() - span, bucket).unwrap_or_default();
        self.hist.insert(key, (now, v.clone()));
        v
    }

    pub fn miner(&self, id: i64) -> Option<&MinerView> {
        self.miners.iter().find(|m| m.row.id == id)
    }

    fn refresh(&mut self, now: f64) {
        if now - self.refreshed < 1.0 {
            return;
        }
        self.refreshed = now;
        let rows = self.engine.db.miners().unwrap_or_default();
        self.miners = rows.into_iter().map(|row| MinerView { live: self.engine.live_of(row.id), row }).collect();
        self.fleet = self.engine.fleet();
        self.events = self.engine.db.events(None, 14).unwrap_or_default();
        // desktop notifications for anything new
        let fresh: Vec<Event> = self.events.iter().filter(|e| e.id > self.last_event).cloned().collect();
        if let Some(top) = self.events.first() {
            self.last_event = self.last_event.max(top.id);
        }
        if self.setting("notify") != "0" {
            for e in fresh.iter().rev() {
                let title = match e.kind.as_str() {
                    "offline" => "Miner offline",
                    "online" => "Miner back online",
                    "hot" => "Miner running hot",
                    "drop" => "Hashrate dropped",
                    "fault" => "Miner fault",
                    "best" => "New best share",
                    "block" => "BLOCK FOUND!",
                    _ => continue,
                };
                sys::notify(title, &e.message);
            }
        }
    }

    fn tick_game(&mut self, now: f64) {
        let dt = self.last_tick.map(|t| (now - t).min(5.0)).unwrap_or(0.0);
        self.last_tick = Some(now);
        let unix = axe_core::db::now();
        if let Some(o) = self.game.tick(dt, self.fleet.hashrate, unix, now) {
            if self.page != Page::Cave && o.rarity >= game::Rarity::Epic {
                self.toast(format!("The Cave: you dug up {}!", o.name), Tone::Ok);
            }
        }
        if now - self.game_saved > 10.0 {
            self.game_saved = now;
            let s = self.game.save();
            let _ = self.engine.db.set_setting("game", &s);
        }
    }

    pub fn save_game(&mut self) {
        let s = self.game.save();
        let _ = self.engine.db.set_setting("game", &s);
    }

    fn check_achievements(&mut self, now: f64) {
        if now - self.ach_checked < 5.0 || self.miners.is_empty() && self.game.total_mined == 0 {
            return;
        }
        self.ach_checked = now;
        let facts = game::Facts {
            miners: self.miners.len(),
            fleet_ghs: self.fleet.hashrate,
            best_diff: self.miners.iter().map(|m| m.best()).fold(0.0, f64::max),
            blocks: self.miners.iter().map(|m| m.row.blocks).sum(),
            max_uptime: self.miners.iter().filter(|m| m.online()).filter_map(|m| m.snap().and_then(|s| s.uptime)).fold(0.0, f64::max),
            efficiency: self.fleet.efficiency,
        };
        let mut new = vec![];
        for a in game::ACHIEVEMENTS {
            if !self.unlocked.contains_key(a.id) && game::earned(a.id, &facts, &self.game) {
                self.unlocked.insert(a.id.into(), axe_core::db::now());
                new.push(a.name);
            }
        }
        if !new.is_empty() {
            let s = serde_json::to_string(&self.unlocked).unwrap_or_default();
            let _ = self.engine.db.set_setting("achievements", &s);
            if new.len() <= 3 && self.ach_checked > 0.0 {
                self.toast(format!("Achievement unlocked: {}", new.join(", ")), Tone::Ok);
            }
        }
    }

    // ---------------------------------------------------------------- frame

    fn nav(&mut self, ui: &mut egui::Ui) {
        let p = self.pal;
        let rect = ui.max_rect();
        ui.painter().rect_filled(rect, CornerRadius::ZERO, p.nav);
        let border = if p.dtv() { alpha(p.pri, 0.3) } else { p.line };
        ui.painter().line_segment([rect.right_top(), rect.right_bottom()], Stroke::new(1.0, border));
        ui.add_space(18.0);
        ui.horizontal(|ui| {
            ui.add_space(14.0);
            if p.dtv() {
                if let Some(t) = &self.tex.dtv {
                    let (r, _) = ui.allocate_exact_size(Vec2::splat(44.0), Sense::hover());
                    let mut glow = vec![];
                    theme::radial(&mut glow, r.center(), Vec2::splat(30.0), alpha(p.pri, 0.25));
                    ui.painter().extend(glow);
                    ui.painter().image(t.id(), r, Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::WHITE);
                }
                ui.label(RichText::new("AxeMobile").font(bold(20.0)).color(p.text));
            } else {
                if let Some(t) = &self.tex.icon {
                    ui.add(egui::Image::new((t.id(), Vec2::splat(28.0))).corner_radius(7));
                }
                ui.spacing_mut().item_spacing.x = 0.0;
                ui.label(RichText::new("Axe").font(bold(22.0)).color(p.pri));
                ui.label(RichText::new("Mobile").font(bold(22.0)).color(p.text));
                ui.label(RichText::new(".").font(bold(22.0)).color(p.mag));
            }
        });
        // typing tagline, as in 1.x
        let t = ui.input(|i| i.time);
        let lines: &[&str] = if p.dtv() { &["EST. BLOCK 723,420"] } else { &["Open Source Mining", "Hack the planet"] };
        let tag = typing(lines, t);
        ui.horizontal(|ui| {
            ui.add_space(16.0);
            ui.label(RichText::new(tag).monospace().size(10.5).color(p.dim));
        });
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(60));
        ui.add_space(10.0);
        {
            let (r, resp) = ui.allocate_exact_size(Vec2::new(rect.width(), 36.0), Sense::click());
            let r = r.shrink2(Vec2::new(12.0, 2.0));
            let hover = resp.hovered();
            ui.painter().rect(r, CornerRadius::same(10), if hover { p.panel2 } else { p.panel }, Stroke::new(1.0, if hover { alpha(p.pri, 0.5) } else { p.line }), egui::StrokeKind::Inside);
            ui.painter().text(Pos2::new(r.left() + 12.0, r.center().y), Align2::LEFT_CENTER, ic::SEARCH, icon_font(13.0), p.dim);
            ui.painter().text(Pos2::new(r.left() + 34.0, r.center().y), Align2::LEFT_CENTER, "Search", egui::FontId::proportional(13.0), p.dim);
            ui.painter().text(Pos2::new(r.right() - 10.0, r.center().y), Align2::RIGHT_CENTER, "Ctrl K", bold(10.5), alpha(p.dim, 0.8));
            if hover {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
            if resp.clicked() {
                self.palette = Some(crate::palette::Palette::new());
            }
        }
        ui.add_space(12.0);

        let items: [(Page, &str, &str); 8] = [
            (Page::Dashboard, ic::HOME, "Dashboard"),
            (Page::Swarm, ic::SWARM, "Swarm"),
            (Page::Pools, ic::POOLS, "Pools"),
            (Page::AxePool, ic::AXEPOOL, "AxePool"),
            (Page::Tuning, ic::TUNE, "Tuning"),
            (Page::Cave, ic::GAME, "The Cave"),
            (Page::Leaderboard, ic::TROPHY, "Leaderboard"),
            (Page::System, ic::SETTINGS, "System"),
        ];
        for (i, (page, icon, label)) in items.iter().enumerate() {
            let active = self.page == *page || (*page == Page::Dashboard && matches!(self.page, Page::Miner(_)));
            let (r, resp) = ui.allocate_exact_size(Vec2::new(rect.width(), 40.0), Sense::click());
            let r = r.shrink2(Vec2::new(12.0, 1.0));
            if active {
                let mut mesh = egui::Mesh::default();
                let uv = egui::epaint::WHITE_UV;
                let a = alpha(p.pri, 0.16);
                for (pos, c) in [(r.left_top(), a), (r.right_top(), Color32::TRANSPARENT), (r.right_bottom(), Color32::TRANSPARENT), (r.left_bottom(), a)] {
                    mesh.vertices.push(egui::epaint::Vertex { pos, uv, color: c });
                }
                mesh.indices.extend_from_slice(&[0, 1, 2, 0, 2, 3]);
                ui.painter().add(mesh);
                ui.painter().rect_filled(Rect::from_min_size(r.left_top(), Vec2::new(3.0, r.height())), CornerRadius::same(2), p.pri);
            } else if resp.hovered() {
                ui.painter().rect_filled(r, CornerRadius::same(10), p.panel);
            }
            let col = if active { p.pri } else if resp.hovered() { p.text } else { p.dim };
            ui.painter().text(Pos2::new(r.left() + 14.0, r.center().y), Align2::LEFT_CENTER, *icon, icon_font(16.0), col);
            ui.painter().text(Pos2::new(r.left() + 42.0, r.center().y), Align2::LEFT_CENTER, *label, bold(14.0), col);
            if *page == Page::Swarm && self.fleet.total > 0 {
                ui.painter().text(Pos2::new(r.right() - 8.0, r.center().y), Align2::RIGHT_CENTER, format!("{}/{}", self.fleet.online, self.fleet.total), bold(11.0), p.dim);
            }
            let resp = resp.on_hover_text(format!("Ctrl+{}", i + 1));
            if resp.clicked() {
                self.page = *page;
            }
            if resp.hovered() {
                ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
            }
        }

        // footer: live fleet card, the DTV shop in the DTV theme, version
        let foot_h = if p.dtv() { 172.0 } else { 122.0 };
        ui.add_space((ui.available_height() - foot_h).max(8.0));
        let f = self.fleet.clone();
        let (card, resp) = ui.allocate_exact_size(Vec2::new(rect.width(), 70.0), Sense::click());
        let card = card.shrink2(Vec2::new(12.0, 0.0));
        let hover = resp.hovered();
        ui.painter().rect(card, CornerRadius::same(12), if hover { p.panel2 } else { p.panel }, Stroke::new(1.0, if p.dtv() { alpha(p.pri, 0.35) } else { p.line }), egui::StrokeKind::Inside);
        let dot_col = if f.total == 0 { p.dim } else if f.online == f.total { p.good } else if f.online > 0 { p.warn } else { p.bad };
        let t = ui.input(|i| i.time);
        let pulse = 0.35 + 0.35 * ((t * 2.0).sin() as f32 + 1.0) / 2.0;
        let dot = Pos2::new(card.left() + 16.0, card.top() + 20.0);
        ui.painter().circle_filled(dot, 7.0, alpha(dot_col, pulse * 0.5));
        ui.painter().circle_filled(dot, 4.0, dot_col);
        ui.painter().text(Pos2::new(card.left() + 28.0, card.top() + 20.0), Align2::LEFT_CENTER, if f.total == 0 { "No miners yet".to_string() } else { format!("{}/{} online", f.online, f.total) }, bold(12.0), p.text);
        let (hv, hu) = crate::fmt::hash(Some(f.hashrate));
        let g = ui.painter().layout_no_wrap(hv, bold(20.0), p.text);
        let gw = g.size().x;
        ui.painter().galley(Pos2::new(card.left() + 14.0, card.top() + 32.0), g, p.text);
        ui.painter().text(Pos2::new(card.left() + 18.0 + gw, card.top() + 46.0), Align2::LEFT_CENTER, hu, bold(11.0), p.pri);
        ui.painter().text(Pos2::new(card.right() - 12.0, card.top() + 46.0), Align2::RIGHT_CENTER, format!("{:.0} W", f.power), egui::FontId::proportional(12.0), p.dim);
        if hover {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }
        if resp.on_hover_text("Open the dashboard").clicked() {
            self.page = Page::Dashboard;
        }
        ui.add_space(10.0);
        ui.horizontal(|ui| {
            ui.add_space(16.0);
            ui.vertical(|ui| {
                if p.dtv() {
                    if w::button(ui, &p, w::Kind::Primary, false, &format!("{}  DTV Shop", ic::SHOP)).on_hover_text(DTV_SHOP).clicked() {
                        ui.ctx().open_url(egui::OpenUrl::new_tab(DTV_SHOP));
                    }
                    ui.add_space(10.0);
                }
                ui.label(RichText::new(format!("AxeMobile {VERSION}")).size(11.5).color(p.dim));
            });
        });
    }

    fn draw_toast(&mut self, ctx: &egui::Context, now: f64) {
        let Some((msg, tone, at)) = self.toast.as_mut() else { return };
        if *at < 0.0 {
            *at = now;
        }
        let age = now - *at;
        if age > 3.6 {
            self.toast = None;
            return;
        }
        ctx.request_repaint();
        let p = self.pal;
        let k = if age < 0.25 { age / 0.25 } else if age > 3.3 { (3.6 - age) / 0.3 } else { 1.0 } as f32;
        let screen = ctx.content_rect();
        let galley = ctx.fonts_mut(|f| f.layout_no_wrap(msg.clone(), egui::FontId::proportional(14.0), p.text));
        let size = galley.size() + Vec2::new(36.0, 24.0);
        let pos = Pos2::new(screen.center().x - size.x / 2.0, screen.bottom() - 24.0 - size.y + (1.0 - k) * 80.0);
        let r = Rect::from_min_size(pos, size);
        let border = match tone {
            Tone::Ok => alpha(p.good, 0.6),
            Tone::Err => p.bad,
            Tone::Info => p.line,
        };
        let painter = ctx.layer_painter(egui::LayerId::new(egui::Order::Tooltip, egui::Id::unique("toast")));
        painter.add(egui::epaint::Shadow { offset: [0, 10], blur: 30, spread: 0, color: Color32::from_black_alpha(130) }.as_shape(r, CornerRadius::same(12)));
        painter.rect(r, CornerRadius::same(12), p.panel2, Stroke::new(1.0, border), egui::StrokeKind::Inside);
        painter.galley(r.min + Vec2::new(18.0, 12.0), galley, p.text);
    }

    fn shortcuts(&mut self, ctx: &egui::Context) {
        let pages = [Page::Dashboard, Page::Swarm, Page::Pools, Page::AxePool, Page::Tuning, Page::Cave, Page::Leaderboard, Page::System];
        ctx.input(|i| {
            if i.modifiers.command {
                for (n, key) in [egui::Key::Num1, egui::Key::Num2, egui::Key::Num3, egui::Key::Num4, egui::Key::Num5, egui::Key::Num6, egui::Key::Num7, egui::Key::Num8].iter().enumerate() {
                    if i.key_pressed(*key) {
                        self.page = pages[n];
                    }
                }
                if i.key_pressed(egui::Key::K) {
                    self.palette = if self.palette.is_some() { None } else { Some(crate::palette::Palette::new()) };
                }
                if i.key_pressed(egui::Key::N) {
                    self.page = Page::Swarm;
                    self.st.swarm.focus = true;
                }
            }
        });
        if ctx.input(|i| i.key_pressed(egui::Key::F5)) {
            self.engine.wake.notify_one();
            self.refresh_now();
            self.toast("Refreshing miners", Tone::Info);
        }
    }
}

/// The sidebar's typing / deleting tagline, driven by time.
fn typing(lines: &[&str], t: f64) -> String {
    let (ty, del, pause) = (0.06, 0.025, 2.0);
    let per: Vec<f64> = lines.iter().map(|l| l.len() as f64 * ty + pause + l.len() as f64 * del + 0.3).collect();
    let total: f64 = per.iter().sum();
    let mut u = t % total;
    let cursor = if (t * 2.0) as i64 % 2 == 0 { "|" } else { " " };
    for (i, l) in lines.iter().enumerate() {
        if u < per[i] {
            let n = l.len() as f64;
            let shown = if u < n * ty {
                (u / ty) as usize
            } else if u < n * ty + pause {
                l.len()
            } else {
                let d = ((u - n * ty - pause) / del) as usize;
                l.len().saturating_sub(d)
            };
            return format!("{}{cursor}", &l[..shown.min(l.len())]);
        }
        u -= per[i];
    }
    cursor.into()
}

impl eframe::App for App {
    /// Runs every frame and, while hidden in the tray, every few seconds.
    fn logic(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        let now = self.wall();
        if self.start_minimized {
            self.start_minimized = false;
            if self.tray.is_some() {
                self.hide_window(ctx);
            } else {
                ctx.send_viewport_cmd(egui::ViewportCommand::Minimized(true));
            }
        }
        self.refresh(now);
        self.tick_game(now);
        self.check_achievements(now);
        self.update_tray(now);
        let msgs = self.tray.as_ref().map(|t| t.poll()).unwrap_or_default();
        for m in msgs {
            match m {
                TrayMsg::Show => self.show_window(ctx),
                TrayMsg::Miner(id) => {
                    self.page = Page::Miner(id);
                    self.show_window(ctx);
                }
                TrayMsg::Quit => {
                    self.quitting = true;
                    self.save_game();
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
        }
        // close and minimise go to the tray when that is on
        let to_tray = self.tray.is_some() && !self.quitting && self.setting("tray_close") != "0";
        let (close, minimized) = ctx.input(|i| (i.viewport().close_requested(), i.viewport().minimized == Some(true)));
        if to_tray && close {
            ctx.send_viewport_cmd(egui::ViewportCommand::CancelClose);
            self.hide_window(ctx);
        } else if to_tray && minimized && !self.hidden {
            self.hide_window(ctx);
        }
    }

    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let now = self.wall();
        self.shortcuts(&ctx);
        ctx.request_repaint_after(std::time::Duration::from_millis(500));

        let full = ui.max_rect();
        theme::background(ui.painter(), full, &self.pal, now);
        if self.pal.dtv() {
            ctx.request_repaint();
        }

        let p = self.pal;
        egui::Panel::left("nav")
            .exact_size(224.0)
            .resizable(false)
            .show_separator_line(false)
            .frame(egui::Frame::new())
            .show(ui, |ui| self.nav(ui));

        egui::CentralPanel::default().frame(egui::Frame::new()).show(ui, |ui| {
            // a new page fades and slides in, like the firmware dashboard
            if self.page != self.shown_page {
                self.shown_page = self.page;
                self.page_at = now;
            }
            let k = ((now - self.page_at) / 0.22).clamp(0.0, 1.0) as f32;
            let k = 1.0 - (1.0 - k) * (1.0 - k);
            if k < 1.0 {
                ctx.request_repaint();
            }
            egui::ScrollArea::vertical().id_salt(("page", format!("{:?}", self.page))).auto_shrink([false, false]).show(ui, |ui| {
                // one centred column, at most 1280 px wide, like `main` on AxeForge
                let avail = ui.available_width();
                let pad = (avail * 0.025).clamp(16.0, 34.0);
                let content = (avail - pad * 2.0).clamp(300.0, 1280.0);
                let left = ((avail - content) / 2.0).max(0.0);
                ui.add_space(22.0 + (1.0 - k) * 8.0);
                ui.horizontal_top(|ui| {
                    ui.add_space(left);
                    ui.vertical(|ui| {
                        ui.set_width(content);
                        ui.multiply_opacity(k);
                        pages::show(self, ui, &ctx, now);
                        ui.add_space(40.0);
                    });
                });
            });
        });

        pages::modals(self, &ctx, now);
        if self.palette.is_some() {
            if let Some(cmd) = crate::palette::show(self, &ctx) {
                crate::palette::run(self, &ctx, cmd);
            }
        }
        if self.intro.is_none() && self.splash.is_none() {
            self.draw_toast(&ctx, now);
        }

        // intro on top of everything
        if self.intro.is_some() || self.splash.is_some() {
            let area = egui::Area::new(egui::Id::unique("intro")).order(egui::Order::Foreground).fixed_pos(full.min);
            area.show(&ctx, |ui| {
                ui.set_min_size(full.size());
                if let Some(intro) = self.intro.as_mut() {
                    intro.show(ui, full, self.bh.as_ref(), self.tex.dtv.as_ref());
                    if intro.done {
                        self.intro = None;
                    }
                } else if let Some(s) = self.splash.as_mut() {
                    if *s < 0.0 {
                        *s = now;
                    }
                    let age = (now - *s) as f32;
                    if age > 1.6 || (age > 0.4 && ui.input(|i| i.pointer.any_click())) {
                        self.splash = None;
                    } else {
                        splash(ui, full, &p, age, self.tex.icon.as_ref());
                        ctx.request_repaint();
                    }
                }
            });
        }
    }

    fn on_exit(&mut self, _gl: Option<&eframe::glow::Context>) {
        self.save_game();
    }
}

fn splash(ui: &mut egui::Ui, rect: Rect, p: &Pal, age: f32, icon: Option<&egui::TextureHandle>) {
    let out = ((age - 1.1) / 0.5).clamp(0.0, 1.0);
    let a = 1.0 - out;
    let painter = ui.painter_at(rect);
    painter.rect_filled(rect, 0.0, alpha(p.bg, a));
    let inn = (age / 0.7).clamp(0.0, 1.0);
    let c = rect.center() + Vec2::new(0.0, 8.0 * (1.0 - inn) - 20.0);
    let mut shapes = vec![];
    theme::radial(&mut shapes, c, Vec2::new(260.0, 160.0), alpha(p.pri, 0.10 * a));
    painter.extend(shapes);
    if let Some(t) = icon {
        let s = 72.0 * (0.9 + 0.1 * inn);
        painter.image(t.id(), Rect::from_center_size(c - Vec2::new(0.0, 60.0), Vec2::splat(s)), Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::from_white_alpha((255.0 * a * inn) as u8));
    }
    let col = |c: Color32| alpha(c, a * inn);
    let font = bold(34.0);
    let g1 = painter.layout_no_wrap("Axe".into(), font.clone(), col(p.pri));
    let g2 = painter.layout_no_wrap("Mobile".into(), font.clone(), col(p.text));
    let g3 = painter.layout_no_wrap(".".into(), font, col(p.mag));
    let wsum = g1.size().x + g2.size().x + g3.size().x;
    let mut x = c.x - wsum / 2.0;
    let y = c.y + 4.0;
    for g in [g1, g2, g3] {
        let wd = g.size().x;
        let h = g.size().y;
        painter.galley(Pos2::new(x, y - h / 2.0), g, Color32::WHITE);
        x += wd;
    }
    let bar = Rect::from_center_size(Pos2::new(c.x, y + 34.0), Vec2::new(160.0, 3.0));
    painter.rect_filled(bar, CornerRadius::same(2), alpha(p.line, a));
    let k = 1.0 - (1.0 - (age / 1.1).clamp(0.0, 1.0)).powi(3);
    let mut fill = bar;
    fill.set_width(bar.width() * k);
    painter.rect_filled(fill, CornerRadius::same(2), alpha(theme::mix(p.pri, p.mag, k), a));
}
