//! AxeMobile Setup: a small native installer with the AxeMobile black hole
//! spinning behind it. `--uninstall` turns it into the uninstaller,
//! `--quiet` skips the window.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

#[allow(dead_code)]
#[path = "../../axe-desktop/src/theme.rs"]
mod theme;
#[allow(dead_code)]
#[path = "../../axe-desktop/src/blackhole.rs"]
mod blackhole;
mod install;

mod widgets {
    use eframe::egui::{FontFamily, FontId};
    pub fn bold(size: f32) -> FontId {
        FontId::new(size, FontFamily::Name("bold".into()))
    }
}

use std::path::PathBuf;
use std::sync::{Arc, Mutex};

use blackhole::{BlackHole, Uniforms};
use eframe::egui::{self, Align2, Color32, CornerRadius, FontFamily, FontId, Pos2, Rect, RichText, Sense, Stroke, Vec2};
use theme::{alpha, mix, rgb};
use widgets::bold;

const CYAN: Color32 = rgb(0, 229, 255);
const MAG: Color32 = rgb(255, 43, 214);
const ORANGE: Color32 = rgb(255, 106, 0);
const TEXT: Color32 = rgb(236, 240, 248);
const DIM: Color32 = rgb(160, 168, 186);

#[derive(PartialEq)]
enum Step {
    Welcome,
    Working,
    Done,
    Failed(String),
}

struct Shared {
    progress: f32,
    status: String,
    result: Option<Result<Option<PathBuf>, String>>,
}

struct Setup {
    uninstall: bool,
    step: Step,
    dir: String,
    desktop: bool,
    start_menu: bool,
    launch_after: bool,
    remove_data: bool,
    existing: Option<PathBuf>,
    shared: Arc<Mutex<Shared>>,
    shown: f32,
    started: f64,
    exe: Option<PathBuf>,
    bh: Option<Arc<BlackHole>>,
    logo: Option<egui::TextureHandle>,
}

fn fonts(ctx: &egui::Context) {
    let mut f = egui::FontDefinitions::default();
    let dir = std::env::var_os("WINDIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("Fonts");
    let defaults = f.families.get(&FontFamily::Proportional).cloned().unwrap_or_default();
    let mut reg = vec![];
    let mut bol = vec![];
    if let Ok(b) = std::fs::read(dir.join("segoeui.ttf")) {
        f.font_data.insert("segoe".into(), Arc::new(egui::FontData::from_owned(b)));
        reg.push("segoe".to_string());
    }
    if let Ok(b) = std::fs::read(dir.join("segoeuib.ttf")) {
        f.font_data.insert("segoe-b".into(), Arc::new(egui::FontData::from_owned(b)));
        bol.push("segoe-b".to_string());
    }
    f.families.insert(FontFamily::Proportional, reg.iter().cloned().chain(defaults.iter().cloned()).collect());
    f.families.insert(FontFamily::Name("bold".into()), bol.iter().cloned().chain(reg.iter().cloned()).chain(defaults.iter().cloned()).collect());
    ctx.set_fonts(f);
}

impl Setup {
    fn new(cc: &eframe::CreationContext<'_>, uninstall: bool) -> Self {
        fonts(&cc.egui_ctx);
        let mut v = egui::Visuals::dark();
        v.override_text_color = Some(TEXT);
        v.panel_fill = Color32::TRANSPARENT;
        v.selection.bg_fill = alpha(CYAN, 0.35);
        v.widgets.inactive.bg_fill = rgb(20, 28, 42);
        v.widgets.inactive.weak_bg_fill = rgb(20, 28, 42);
        v.widgets.hovered.weak_bg_fill = rgb(28, 40, 58);
        v.extreme_bg_color = Color32::from_rgba_unmultiplied(5, 7, 14, 220);
        cc.egui_ctx.set_visuals(v);
        let logo = image::load_from_memory(include_bytes!("../../axe-desktop/assets/icon.png")).ok().map(|i| {
            let i = i.to_rgba8();
            let ci = egui::ColorImage::from_rgba_unmultiplied([i.width() as usize, i.height() as usize], i.as_raw());
            cc.egui_ctx.load_texture("logo", ci, egui::TextureOptions::LINEAR)
        });
        let existing = install::installed_dir();
        let dir = if uninstall {
            std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf())).or(existing.clone()).unwrap_or_else(install::default_dir)
        } else {
            existing.clone().unwrap_or_else(install::default_dir)
        };
        Self {
            uninstall,
            step: Step::Welcome,
            dir: dir.display().to_string(),
            desktop: true,
            start_menu: true,
            launch_after: true,
            remove_data: false,
            existing,
            shared: Arc::new(Mutex::new(Shared { progress: 0.0, status: String::new(), result: None })),
            shown: 0.0,
            started: 0.0,
            exe: None,
            bh: cc.gl.as_ref().and_then(|gl| BlackHole::new(gl)).map(Arc::new),
            logo,
        }
    }

    fn start(&mut self, now: f64, ctx: &egui::Context) {
        self.step = Step::Working;
        self.started = now;
        let shared = self.shared.clone();
        let ctx = ctx.clone();
        let uninstall = self.uninstall;
        let dir = PathBuf::from(self.dir.trim());
        let opts = install::Options { dir: dir.clone(), desktop: self.desktop, start_menu: self.start_menu };
        let remove_data = self.remove_data;
        std::thread::spawn(move || {
            let report = |p: f32, s: &str| {
                let mut g = shared.lock().unwrap();
                g.progress = p;
                g.status = s.to_string();
                ctx.request_repaint();
            };
            let r = if uninstall {
                install::uninstall(&dir, remove_data, &report).map(|_| None)
            } else {
                install::install(&opts, &report).map(Some)
            };
            shared.lock().unwrap().result = Some(r);
            ctx.request_repaint();
        });
    }

    fn button(ui: &mut egui::Ui, label: &str, primary: bool, width: f32) -> egui::Response {
        let (rect, resp) = ui.allocate_exact_size(Vec2::new(width, 42.0), Sense::click());
        let hover = resp.hovered();
        if primary {
            // cyan → magenta pill, glows on hover
            let mut mesh = egui::Mesh::default();
            let uv = egui::epaint::WHITE_UV;
            let (a, b) = if hover { (mix(CYAN, Color32::WHITE, 0.15), mix(MAG, Color32::WHITE, 0.15)) } else { (CYAN, MAG) };
            for (pos, c) in [(rect.left_top(), a), (rect.right_top(), b), (rect.right_bottom(), b), (rect.left_bottom(), a)] {
                mesh.vertices.push(egui::epaint::Vertex { pos, uv, color: c });
            }
            mesh.indices.extend_from_slice(&[0, 1, 2, 0, 2, 3]);
            if hover {
                ui.painter().add(egui::epaint::Shadow { offset: [0, 0], blur: 24, spread: 0, color: alpha(CYAN, 0.45) }.as_shape(rect, CornerRadius::same(12)));
            }
            let clip = ui.painter().with_clip_rect(rect);
            clip.add(mesh);
            ui.painter().rect_stroke(rect, CornerRadius::same(12), Stroke::new(0.0, Color32::TRANSPARENT), egui::StrokeKind::Inside);
            ui.painter().text(rect.center(), Align2::CENTER_CENTER, label, bold(15.0), rgb(0, 15, 20));
        } else {
            ui.painter().rect(rect, CornerRadius::same(12), if hover { rgb(32, 42, 60) } else { rgb(20, 28, 42) }, Stroke::new(1.0, rgb(40, 52, 72)), egui::StrokeKind::Inside);
            ui.painter().text(rect.center(), Align2::CENTER_CENTER, label, bold(14.0), TEXT);
        }
        if hover {
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }
        resp
    }

    fn check(ui: &mut egui::Ui, on: &mut bool, label: &str) {
        let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 28.0), Sense::click());
        if resp.clicked() {
            *on = !*on;
        }
        let k = ui.ctx().animate_bool(resp.id, *on);
        let b = Rect::from_min_size(Pos2::new(rect.left(), rect.center().y - 9.0), Vec2::splat(18.0));
        ui.painter().rect(b, CornerRadius::same(5), mix(rgb(20, 28, 42), CYAN, k), Stroke::new(1.0, mix(rgb(60, 72, 92), CYAN, k)), egui::StrokeKind::Inside);
        if k > 0.5 {
            ui.painter().line(vec![b.min + Vec2::new(4.0, 9.5), b.min + Vec2::new(7.5, 13.0), b.min + Vec2::new(14.0, 5.5)], Stroke::new(2.2, rgb(0, 15, 20)));
        }
        ui.painter().text(Pos2::new(b.right() + 10.0, rect.center().y), Align2::LEFT_CENTER, label, FontId::proportional(14.0), if resp.hovered() { TEXT } else { mix(DIM, TEXT, 0.4) });
    }
}

impl eframe::App for Setup {
    fn ui(&mut self, ui: &mut egui::Ui, _frame: &mut eframe::Frame) {
        let ctx = ui.ctx().clone();
        let now = ui.input(|i| i.time);
        ctx.request_repaint();
        let full = ui.max_rect();

        // black hole backdrop: the camera drifts in while the window opens
        let t = now as f32;
        let dist = 34.0 - 12.0 * (1.0 - (-t / 2.2).exp());
        let painter = ui.painter().clone();
        painter.rect_filled(full, CornerRadius::same(14), Color32::BLACK);
        match &self.bh {
            Some(bh) => bh.draw(&painter, full, Uniforms { time: 4.0 + t * 0.6, dist, bright: (t / 0.8).min(1.0) * 0.95, flash: 0.0 }),
            None => {
                let mut s = vec![];
                theme::radial(&mut s, full.center() + Vec2::new(160.0, 0.0), Vec2::new(260.0, 90.0), alpha(ORANGE, 0.35));
                painter.extend(s);
                painter.circle_filled(full.center() + Vec2::new(160.0, 0.0), 60.0, Color32::BLACK);
            }
        }
        // darken the left side so text reads well over the disk
        let mut mesh = egui::Mesh::default();
        let uv = egui::epaint::WHITE_UV;
        let l = Color32::from_black_alpha(215);
        let r = Color32::from_black_alpha(0);
        let split = Rect::from_min_max(full.min, Pos2::new(full.left() + full.width() * 0.72, full.bottom()));
        for (pos, c) in [(split.left_top(), l), (split.right_top(), r), (split.right_bottom(), r), (split.left_bottom(), l)] {
            mesh.vertices.push(egui::epaint::Vertex { pos, uv, color: c });
        }
        mesh.indices.extend_from_slice(&[0, 1, 2, 0, 2, 3]);
        painter.add(mesh);

        // title bar: drag anywhere on top, close on the right
        let bar = Rect::from_min_size(full.min, Vec2::new(full.width(), 40.0));
        let drag = ui.interact(bar, egui::Id::unique("drag"), Sense::click_and_drag());
        if drag.drag_started() {
            ctx.send_viewport_cmd(egui::ViewportCommand::StartDrag);
        }
        let close = Rect::from_center_size(Pos2::new(full.right() - 26.0, full.top() + 22.0), Vec2::splat(30.0));
        let cr = ui.interact(close, egui::Id::unique("close"), Sense::click());
        if cr.hovered() {
            painter.rect_filled(close, CornerRadius::same(8), alpha(rgb(255, 59, 92), 0.8));
        }
        let c = close.center();
        let d = 5.5;
        painter.line_segment([c - Vec2::splat(d), c + Vec2::splat(d)], Stroke::new(1.6, TEXT));
        painter.line_segment([c + Vec2::new(d, -d), c + Vec2::new(-d, d)], Stroke::new(1.6, TEXT));
        if cr.clicked() && self.step != Step::Working {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
        }
        painter.text(Pos2::new(full.left() + 20.0, full.top() + 22.0), Align2::LEFT_CENTER, if self.uninstall { "AxeMobile · Uninstall" } else { "AxeMobile · Setup" }, FontId::proportional(12.5), DIM);

        // progress from the worker
        if self.step == Step::Working {
            let (p, done) = {
                let g = self.shared.lock().unwrap();
                (g.progress, g.result.clone())
            };
            // keep the bar moving smoothly and never finish in under ~1.6 s
            let min_t = ((now - self.started) / 1.6).min(1.0) as f32;
            let target = p.min(min_t.max(0.02));
            self.shown += (target - self.shown) * 0.12;
            if let Some(r) = done {
                if self.shown > 0.985 {
                    match r {
                        Ok(exe) => {
                            self.exe = exe;
                            self.step = Step::Done;
                        }
                        Err(e) => self.step = Step::Failed(e),
                    }
                } else if self.shown > 0.9 {
                    self.shown += (1.0 - self.shown) * 0.2;
                }
            }
        }

        let panel = Rect::from_min_size(full.min + Vec2::new(44.0, 70.0), Vec2::new(380.0, full.height() - 110.0));
        let mut child = ui.new_child(egui::UiBuilder::new().max_rect(panel).layout(egui::Layout::top_down(egui::Align::Min)));
        let ui = &mut child;
        ui.horizontal(|ui| {
            if let Some(tex) = &self.logo {
                ui.add(egui::Image::new((tex.id(), Vec2::splat(46.0))).corner_radius(11));
            }
            ui.add_space(4.0);
            ui.vertical(|ui| {
                ui.horizontal(|ui| {
                    ui.spacing_mut().item_spacing.x = 0.0;
                    ui.label(RichText::new("Axe").font(bold(30.0)).color(CYAN));
                    ui.label(RichText::new("Mobile").font(bold(30.0)).color(TEXT));
                    ui.label(RichText::new(".").font(bold(30.0)).color(MAG));
                });
                ui.label(RichText::new(format!("version {}", install::VERSION)).size(12.5).color(DIM));
            });
        });
        ui.add_space(18.0);

        match &self.step {
            Step::Welcome if !self.uninstall => {
                if self.existing.is_some() {
                    ui.label(RichText::new("Time for an update.").font(bold(20.0)));
                    ui.label(RichText::new("Your miners, their history and your Cave progress stay right where they are. This only swaps in the new version.").size(13.5).color(DIM));
                } else {
                    ui.label(RichText::new("Every miner, one window.").font(bold(20.0)));
                    ui.label(RichText::new("Live hashrate, temps and power for your Bitaxe, NerdAxe and NerdQaxe, on AxeForge or AxeOS. Swap pools, tune clocks, get a ping when something runs hot, and dig for Bitcoin ore in the Cave while you wait for that block.").size(13.5).color(DIM));
                }
                ui.add_space(4.0);
                ui.label(RichText::new("Installs just for you. No admin prompt, no account to make.").size(12.0).color(mix(DIM, CYAN, 0.35)));
                ui.add_space(14.0);
                ui.label(RichText::new("Install to").size(12.0).color(DIM));
                ui.add(egui::TextEdit::singleline(&mut self.dir).desired_width(f32::INFINITY).margin(egui::Margin::symmetric(10, 8)));
                ui.add_space(8.0);
                Self::check(ui, &mut self.desktop, "Desktop shortcut");
                Self::check(ui, &mut self.start_menu, "Start menu shortcut");
                Self::check(ui, &mut self.launch_after, "Open AxeMobile when done");
                ui.add_space(12.0);
                if Self::button(ui, if self.existing.is_some() { "Update" } else { "Install" }, true, 200.0).clicked() {
                    self.start(now, &ctx);
                }
            }
            Step::Welcome => {
                ui.label(RichText::new("Remove AxeMobile?").font(bold(20.0)));
                ui.label(RichText::new("This removes the app, its shortcuts and its entry in Apps & features. Your miners keep running; nothing changes on them.").size(13.5).color(DIM));
                ui.add_space(14.0);
                Self::check(ui, &mut self.remove_data, "Also delete my data (miner list, history, Cave)");
                ui.add_space(16.0);
                ui.horizontal(|ui| {
                    if Self::button(ui, "Uninstall", true, 170.0).clicked() {
                        self.start(now, &ctx);
                    }
                    if Self::button(ui, "Keep it", false, 120.0).clicked() {
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });
            }
            Step::Working => {
                let status = self.shared.lock().unwrap().status.clone();
                ui.label(RichText::new(if self.uninstall { "Removing…" } else { "Installing…" }).font(bold(20.0)));
                ui.add_space(14.0);
                let (bar, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 10.0), Sense::hover());
                ui.painter().rect_filled(bar, CornerRadius::same(5), rgb(24, 32, 48));
                let mut fill = bar;
                fill.set_width(bar.width() * self.shown.clamp(0.0, 1.0));
                ui.painter().rect_filled(fill, CornerRadius::same(5), mix(CYAN, MAG, self.shown));
                let x = fill.right();
                ui.painter().circle_filled(Pos2::new(x, bar.center().y), 9.0, alpha(mix(CYAN, MAG, self.shown), 0.35));
                ui.add_space(10.0);
                ui.label(RichText::new(format!("{:.0}%  ·  {status}", self.shown * 100.0)).size(13.0).color(DIM));
            }
            Step::Done => {
                ui.label(RichText::new(if self.uninstall { "AxeMobile is gone." } else { "You're all set." }).font(bold(22.0)));
                ui.label(RichText::new(if self.uninstall {
                    "Thanks for mining with it. Your miners keep hashing either way."
                } else {
                    "Open AxeMobile, head to Swarm and add your first miner by IP, or let it scan your network and find them for you."
                }).size(13.5).color(DIM));
                ui.add_space(18.0);
                ui.horizontal(|ui| {
                    if !self.uninstall && Self::button(ui, "Open AxeMobile", true, 190.0).clicked() {
                        if let Some(exe) = &self.exe {
                            install::launch(exe);
                        }
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                    if Self::button(ui, "Close", false, 110.0).clicked() {
                        if !self.uninstall && self.launch_after {
                            if let Some(exe) = &self.exe {
                                install::launch(exe);
                            }
                        }
                        ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                    }
                });
            }
            Step::Failed(e) => {
                ui.label(RichText::new("That didn't work").font(bold(20.0)).color(rgb(255, 120, 140)));
                ui.label(RichText::new(e.clone()).size(13.5).color(DIM));
                ui.add_space(14.0);
                if Self::button(ui, "Close", false, 110.0).clicked() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            }
        }

        // frame border
        ui.ctx().layer_painter(egui::LayerId::new(egui::Order::Foreground, egui::Id::unique("border"))).rect_stroke(
            full.shrink(0.5),
            CornerRadius::same(14),
            Stroke::new(1.0, alpha(mix(CYAN, ORANGE, 0.5), 0.35)),
            egui::StrokeKind::Inside,
        );
    }
}

fn main() -> eframe::Result {
    let args: Vec<String> = std::env::args().collect();
    let uninstall = args.iter().any(|a| a == "--uninstall");
    if args.iter().any(|a| a == "--quiet") {
        let noop = |_: f32, _: &str| {};
        let r = if uninstall {
            let dir = std::env::current_exe().ok().and_then(|p| p.parent().map(|p| p.to_path_buf())).unwrap_or_else(install::default_dir);
            install::uninstall(&dir, false, &noop)
        } else {
            install::install(&install::Options { dir: install::installed_dir().unwrap_or_else(install::default_dir), desktop: true, start_menu: true }, &noop).map(|_| ())
        };
        std::process::exit(if r.is_ok() { 0 } else { 1 });
    }
    let icon = image::load_from_memory(include_bytes!("../../axe-desktop/assets/icon.png")).ok().map(|i| {
        let i = i.to_rgba8();
        egui::IconData { width: i.width(), height: i.height(), rgba: i.into_raw() }
    });
    let mut viewport = egui::ViewportBuilder::default()
        .with_title(if uninstall { "Uninstall AxeMobile" } else { "AxeMobile Setup" })
        .with_inner_size([860.0, 520.0])
        .with_resizable(false)
        .with_decorations(false)
        .with_transparent(true);
    if let Some(i) = icon {
        viewport = viewport.with_icon(i);
    }
    let options = eframe::NativeOptions { viewport, renderer: eframe::Renderer::Glow, centered: true, ..Default::default() };
    eframe::run_native("AxeMobile Setup", options, Box::new(move |cc| Ok(Box::new(Setup::new(cc, uninstall)))))
}
