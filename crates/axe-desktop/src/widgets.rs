//! The AxeForge dashboard pieces, drawn with egui: cards, stat tiles,
//! the ring gauge, area charts, segmented controls, toggles and pills.

use eframe::egui::{self, Align2, Color32, CornerRadius, FontFamily, FontId, Mesh, Pos2, Rect, Response, RichText, Sense, Shape, Stroke, Ui, Vec2};
use egui::epaint::{Shadow, Vertex};

use crate::fmt;
use crate::theme::{alpha, dtv_pulse, mix, Pal};

pub fn bold(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("bold".into()))
}

pub fn icon_font(size: f32) -> FontId {
    FontId::new(size, FontFamily::Name("icons".into()))
}

/// Icon glyphs: Segoe MDL2 on Windows, emoji from egui's built-in font elsewhere.
#[cfg(windows)]
pub mod ic {
    pub const HOME: &str = "\u{E80F}";
    pub const SWARM: &str = "\u{E968}";
    pub const POOLS: &str = "\u{E753}";
    pub const TUNE: &str = "\u{E945}";
    pub const GAME: &str = "\u{E7FC}";
    pub const TROPHY: &str = "\u{E734}";
    pub const SETTINGS: &str = "\u{E713}";
    pub const ADD: &str = "\u{E710}";
    pub const SEARCH: &str = "\u{E721}";
    pub const RESTART: &str = "\u{E72C}";
    pub const OPEN: &str = "\u{E8A7}";
    pub const EDIT: &str = "\u{E70F}";
    pub const BACK: &str = "\u{E72B}";
    pub const SHOP: &str = "\u{E719}";
    pub const SAVE: &str = "\u{E74E}";
    pub const FOLDER: &str = "\u{E838}";
    pub const COPY: &str = "\u{E8C8}";
    pub const LOCK: &str = "\u{E72E}";
}

#[cfg(not(windows))]
pub mod ic {
    pub const HOME: &str = "🏠";
    pub const SWARM: &str = "🖧";
    pub const POOLS: &str = "☁";
    pub const TUNE: &str = "⚡";
    pub const GAME: &str = "🎮";
    pub const TROPHY: &str = "🏆";
    pub const SETTINGS: &str = "⚙";
    pub const ADD: &str = "➕";
    pub const SEARCH: &str = "🔍";
    pub const RESTART: &str = "⟳";
    pub const OPEN: &str = "↗";
    pub const EDIT: &str = "✏";
    pub const BACK: &str = "⬅";
    pub const SHOP: &str = "🛒";
    pub const SAVE: &str = "💾";
    pub const FOLDER: &str = "🗁";
    pub const COPY: &str = "🗐";
    pub const LOCK: &str = "🔒";
}

// ---------------------------------------------------------------- cards

/// A dashboard card. In the DTV theme its border and glow breathe like the
/// old `.theme-dtv .card` rule, and it lifts on hover.
pub fn card<R>(ui: &mut Ui, p: &Pal, add: impl FnOnce(&mut Ui) -> R) -> egui::InnerResponse<R> {
    card_ex(ui, p, false, add)
}

pub fn card_ex<R>(ui: &mut Ui, p: &Pal, accent: bool, add: impl FnOnce(&mut Ui) -> R) -> egui::InnerResponse<R> {
    let id = ui.next_auto_id().with("card");
    let prev: Option<Rect> = ui.ctx().data(|d| d.get_temp(id));
    let hovered = prev.is_some_and(|r| ui.rect_contains_pointer(r));
    let t = ui.input(|i| i.time);
    let (stroke, shadow) = if p.dtv() {
        let k = dtv_pulse(t);
        if hovered {
            (Stroke::new(1.0, alpha(p.pri, 0.8)), Shadow { offset: [0, 8], blur: 30, spread: 0, color: Color32::from_white_alpha(38) })
        } else {
            (
                Stroke::new(1.0, alpha(p.pri, 0.3 + 0.2 * k)),
                Shadow { offset: [0, 0], blur: (12.0 + 8.0 * k) as u8, spread: 0, color: Color32::from_white_alpha((25.0 + 25.0 * k) as u8) },
            )
        }
    } else {
        let s = if hovered { alpha(p.pri, 0.35) } else { p.line };
        (Stroke::new(1.0, s), Shadow { offset: [0, 6], blur: 18, spread: 0, color: Color32::from_black_alpha(70) })
    };
    if p.dtv() {
        ui.ctx().request_repaint();
    }
    let frame = egui::Frame::new()
        .fill(p.panel)
        .stroke(stroke)
        .corner_radius(CornerRadius::same(14))
        .inner_margin(egui::Margin::same(16))
        .shadow(shadow);
    let r = frame.show(ui, |ui| {
        ui.set_min_width(ui.available_width());
        if accent {
            let rr = ui.max_rect();
            ui.painter().rect_filled(
                Rect::from_min_size(Pos2::new(rr.left() - 16.0, rr.top()), Vec2::new(3.0, 16.0)),
                CornerRadius { nw: 0, ne: 3, sw: 0, se: 3 },
                p.pri,
            );
        }
        add(ui)
    });
    ui.ctx().data_mut(|d| d.insert_temp(id, r.response.rect));
    egui::InnerResponse::new(r.inner, r.response)
}

/// `n` equal columns with a gap, like `.grid.g4`.
pub fn cols<R>(ui: &mut Ui, n: usize, gap: f32, mut f: impl FnMut(usize, &mut Ui) -> R) {
    let avail = ui.available_width();
    let width = ((avail - gap * (n as f32 - 1.0)) / n as f32).floor();
    ui.horizontal_top(|ui| {
        ui.spacing_mut().item_spacing.x = gap;
        for i in 0..n {
            ui.allocate_ui_with_layout(Vec2::new(width, 0.0), egui::Layout::top_down(egui::Align::Min), |ui| {
                ui.set_width(width);
                let _ = f(i, ui);
            });
        }
    });
}

/// Small-caps card heading, with optional right-aligned content.
pub fn h3(ui: &mut Ui, p: &Pal, title: &str) {
    ui.label(RichText::new(title.to_uppercase()).font(bold(11.5)).color(p.dim).extra_letter_spacing(0.8));
}

pub fn h3_row(ui: &mut Ui, p: &Pal, title: &str, right: impl FnOnce(&mut Ui)) {
    ui.horizontal(|ui| {
        h3(ui, p, title);
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), right);
    });
}

pub fn big(ui: &mut Ui, p: &Pal, value: &str, unit: &str, color: Option<Color32>) {
    ui.horizontal(|ui| {
        ui.spacing_mut().item_spacing.x = 4.0;
        ui.label(RichText::new(value).font(bold(28.0)).color(color.unwrap_or(p.text)));
        if !unit.is_empty() {
            ui.label(RichText::new(unit).font(bold(13.0)).color(p.dim));
        }
    });
}

pub fn sub(ui: &mut Ui, p: &Pal, text: impl Into<String>) {
    ui.label(RichText::new(text.into()).size(12.0).color(p.dim));
}

pub fn stat(ui: &mut Ui, p: &Pal, title: &str, value: &str, unit: &str, subtext: &str, color: Option<Color32>) {
    card(ui, p, |ui| {
        ui.set_min_height(86.0);
        h3(ui, p, title);
        big(ui, p, value, unit, color);
        if !subtext.is_empty() {
            sub(ui, p, subtext);
        }
    });
}

pub fn bar(ui: &mut Ui, p: &Pal, frac: f32, color: Option<Color32>) {
    let (rect, _) = ui.allocate_exact_size(Vec2::new(ui.available_width(), 5.0), Sense::hover());
    ui.painter().rect_filled(rect, CornerRadius::same(3), p.line);
    let mut f = rect;
    f.set_width(rect.width() * frac.clamp(0.0, 1.0));
    ui.painter().rect_filled(f, CornerRadius::same(3), color.unwrap_or(p.pri));
}

/// Two-column key/value grid like `.kv` on the firmware page.
pub fn kv(ui: &mut Ui, p: &Pal, id: &str, rows: &[(&str, String)]) {
    egui::Grid::new(id).num_columns(2).spacing([16.0, 7.0]).show(ui, |ui| {
        let w = ui.available_width();
        for (k, v) in rows {
            ui.label(RichText::new(*k).color(p.dim));
            ui.allocate_ui_with_layout(Vec2::new((w - 90.0).max(80.0), 18.0), egui::Layout::right_to_left(egui::Align::Center), |ui| {
                ui.add(egui::Label::new(RichText::new(v).font(bold(13.5))).truncate());
            });
            ui.end_row();
        }
    });
}

pub fn temp_color(p: &Pal, t: Option<f64>) -> Color32 {
    match t {
        Some(t) if t >= 70.0 => p.bad,
        Some(t) if t >= 62.0 => p.warn,
        Some(_) => p.good,
        None => p.dim,
    }
}

// ---------------------------------------------------------------- buttons

#[derive(Clone, Copy, PartialEq)]
pub enum Kind {
    Primary,
    Alt,
    Warn,
}

/// A themed button. DTV keeps 1.x's look: orange text, orange outline,
/// faint orange fill, lifting on hover.
pub fn button(ui: &mut Ui, p: &Pal, kind: Kind, small: bool, label: &str) -> Response {
    let (fill, text, stroke) = if p.dtv() && kind != Kind::Warn {
        (alpha(p.pri, 0.08), crate::theme::hsl(25.0, 100.0, 55.0), Stroke::new(1.0, alpha(p.pri, 0.6)))
    } else {
        match kind {
            Kind::Primary => (p.pri, p.pri_fg, Stroke::NONE),
            Kind::Alt => (p.panel2, p.text, Stroke::new(1.0, p.line)),
            Kind::Warn => (p.bad, Color32::WHITE, Stroke::NONE),
        }
    };
    let size = if small { 12.5 } else { 14.0 };
    let pad = if small { Vec2::new(10.0, 5.0) } else { Vec2::new(16.0, 9.0) };
    let galley = ui.painter().layout_no_wrap(label.to_string(), bold(size), text);
    let desired = galley.size() + pad * 2.0;
    let (rect, resp) = ui.allocate_exact_size(desired, Sense::click());
    let hovered = resp.hovered();
    let lift = if hovered && p.dtv() { -1.0 } else { 0.0 };
    let r = rect.translate(Vec2::new(0.0, lift));
    let mut f = fill;
    if hovered {
        f = if p.dtv() && kind != Kind::Warn { alpha(p.pri, 0.15) } else { mix(fill, Color32::WHITE, 0.1) };
        if p.dtv() {
            ui.painter().add(Shadow { offset: [0, 4], blur: 16, spread: 0, color: Color32::from_white_alpha(50) }.as_shape(r, CornerRadius::same(10)));
        }
    }
    if resp.is_pointer_button_down_on() {
        f = mix(f, Color32::BLACK, 0.1);
    }
    ui.painter().rect(r, CornerRadius::same(if small { 8 } else { 10 }), f, stroke, egui::StrokeKind::Inside);
    ui.painter().galley(r.center() - galley.size() / 2.0, galley, text);
    if hovered {
        ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
    }
    resp
}

pub fn primary(ui: &mut Ui, p: &Pal, label: &str) -> Response {
    button(ui, p, Kind::Primary, false, label)
}

pub fn alt(ui: &mut Ui, p: &Pal, label: &str) -> Response {
    button(ui, p, Kind::Alt, false, label)
}

pub fn small(ui: &mut Ui, p: &Pal, label: &str) -> Response {
    button(ui, p, Kind::Alt, true, label)
}

/// A button that needs a second click within 3.5 s.
pub fn confirm_button(ui: &mut Ui, p: &Pal, small_btn: bool, label: &str, confirm: &str) -> bool {
    let id = ui.next_auto_id().with(label);
    let now = ui.input(|i| i.time);
    let armed_at: Option<f64> = ui.ctx().data(|d| d.get_temp(id));
    let armed = armed_at.is_some_and(|t| now - t < 3.5);
    let resp = button(ui, p, if armed { Kind::Warn } else { Kind::Alt }, small_btn, if armed { confirm } else { label });
    if armed {
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(300));
    }
    if resp.clicked() {
        if armed {
            ui.ctx().data_mut(|d| d.remove::<f64>(id));
            return true;
        }
        ui.ctx().data_mut(|d| d.insert_temp(id, now));
    }
    false
}

/// Segmented control (`.seg`). Laid out as one widget so it sits right in
/// both left-to-right and right-to-left rows.
pub fn seg<T: PartialEq + Copy>(ui: &mut Ui, p: &Pal, value: &mut T, options: &[(T, &str)], xs: bool) -> bool {
    let mut changed = false;
    let size = if xs { 11.5 } else { 13.0 };
    let pad = if xs { Vec2::new(9.0, 3.0) } else { Vec2::new(14.0, 6.0) };
    let inset = if xs { 2.0 } else { 3.0 };
    let galleys: Vec<_> = options
        .iter()
        .map(|(v, l)| ui.painter().layout_no_wrap(l.to_string(), bold(size), if *value == *v { p.pri_fg } else { p.dim }))
        .collect();
    let h = galleys.iter().map(|g| g.size().y).fold(0.0, f32::max) + pad.y * 2.0;
    let total_w: f32 = galleys.iter().map(|g| g.size().x + pad.x * 2.0).sum::<f32>() + inset * 2.0;
    let (outer, _) = ui.allocate_exact_size(Vec2::new(total_w, h + inset * 2.0), Sense::hover());
    ui.painter().rect(outer, CornerRadius::same(if xs { 8 } else { 10 }), p.panel2, Stroke::new(1.0, p.line), egui::StrokeKind::Inside);
    let mut x = outer.left() + inset;
    for (i, ((v, _), g)) in options.iter().zip(galleys).enumerate() {
        let w = g.size().x + pad.x * 2.0;
        let r = Rect::from_min_size(Pos2::new(x, outer.top() + inset), Vec2::new(w, h));
        let resp = ui.interact(r, ui.scope_id().with(("seg", i)), Sense::click());
        let on = *value == *v;
        if on {
            ui.painter().rect_filled(r, CornerRadius::same(if xs { 6 } else { 7 }), p.pri);
        } else if resp.hovered() {
            ui.painter().rect_filled(r, CornerRadius::same(7), alpha(p.pri, 0.08));
            ui.ctx().set_cursor_icon(egui::CursorIcon::PointingHand);
        }
        let col = if on { p.pri_fg } else { p.dim };
        ui.painter().galley(r.center() - g.size() / 2.0, g, col);
        if resp.clicked() && !on {
            *value = *v;
            changed = true;
        }
        x += w;
    }
    changed
}

/// `.tg` toggle switch.
pub fn toggle(ui: &mut Ui, p: &Pal, on: &mut bool) -> Response {
    let (rect, mut resp) = ui.allocate_exact_size(Vec2::new(44.0, 24.0), Sense::click());
    if resp.clicked() {
        *on = !*on;
        resp.mark_changed();
    }
    let k = ui.ctx().animate_bool(resp.id, *on);
    ui.painter().rect_filled(rect, CornerRadius::same(12), mix(p.line, p.pri, k));
    let x = rect.left() + 12.0 + 20.0 * k;
    ui.painter().circle_filled(Pos2::new(x, rect.center().y), 9.0, Color32::WHITE);
    resp
}

/// Labelled setting row with a toggle on the right (`.switch`).
pub fn switch_row(ui: &mut Ui, p: &Pal, title: &str, desc: &str, on: &mut bool) -> bool {
    let mut changed = false;
    ui.horizontal(|ui| {
        let w = ui.available_width() - 60.0;
        ui.vertical(|ui| {
            ui.set_width(w);
            ui.label(RichText::new(title).font(bold(14.0)));
            if !desc.is_empty() {
                ui.label(RichText::new(desc).size(12.0).color(p.dim));
            }
        });
        ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
            changed = toggle(ui, p, on).changed();
        });
    });
    ui.add_space(4.0);
    changed
}

/// Status pill with the blinking dot.
pub fn pill(ui: &mut Ui, text: &str, color: Color32, blink: bool) {
    let t = ui.input(|i| i.time);
    let galley = ui.painter().layout_no_wrap(text.to_uppercase(), bold(11.0), color);
    let size = Vec2::new(galley.size().x + 32.0, 22.0);
    let (rect, _) = ui.allocate_exact_size(size, Sense::hover());
    ui.painter().rect(rect, CornerRadius::same(11), alpha(color, 0.14), Stroke::new(1.0, color), egui::StrokeKind::Inside);
    let a = if blink {
        ui.ctx().request_repaint_after(std::time::Duration::from_millis(50));
        let u = (t % 1.6) / 1.6;
        if u < 0.5 { 1.0 - 0.75 * (u * 2.0) as f32 } else { 0.25 + 0.75 * ((u - 0.5) * 2.0) as f32 }
    } else {
        1.0
    };
    ui.painter().circle_filled(Pos2::new(rect.left() + 13.0, rect.center().y), 3.5, alpha(color, a));
    ui.painter().galley(Pos2::new(rect.left() + 22.0, rect.center().y - galley.size().y / 2.0), galley, color);
}

pub fn tag(ui: &mut Ui, p: &Pal, text: &str, color: Option<Color32>) {
    let col = color.unwrap_or(p.dim);
    let galley = ui.painter().layout_no_wrap(text.to_uppercase(), bold(10.0), col);
    let (rect, _) = ui.allocate_exact_size(galley.size() + Vec2::new(14.0, 5.0), Sense::hover());
    ui.painter().rect_filled(rect, CornerRadius::same(6), p.panel2);
    ui.painter().galley(rect.center() - galley.size() / 2.0, galley, col);
}

pub fn dot(ui: &mut Ui, color: Color32, glow: bool) {
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(12.0), Sense::hover());
    if glow {
        ui.painter().circle_filled(rect.center(), 7.0, alpha(color, 0.25));
    }
    ui.painter().circle_filled(rect.center(), 4.5, color);
}

/// A row of small-caps text over a value, used in miner tiles.
pub fn mini(ui: &mut Ui, p: &Pal, label: &str, value: &str, color: Option<Color32>, width: f32) {
    egui::Frame::new().fill(p.panel2).corner_radius(CornerRadius::same(8)).inner_margin(egui::Margin::symmetric(8, 6)).show(ui, |ui| {
        ui.set_width(width);
        ui.label(RichText::new(label.to_uppercase()).font(bold(9.5)).color(p.dim));
        ui.label(RichText::new(value).font(bold(13.0)).color(color.unwrap_or(p.text)));
    });
}

// ---------------------------------------------------------------- gauge

pub fn gauge(ui: &mut Ui, p: &Pal, value: Option<f64>, max: f64, subtext: &str) {
    let size = 210.0;
    let (rect, _) = ui.allocate_exact_size(Vec2::splat(size), Sense::hover());
    let c = rect.center();
    let r = 86.0;
    let start = 135f32.to_radians();
    let sweep = 270f32.to_radians();
    let arc = |from: f32, to: f32| -> Vec<Pos2> {
        let n = 90;
        (0..=n).map(|i| {
            let a = start + sweep * (from + (to - from) * i as f32 / n as f32);
            c + Vec2::angled(a) * r
        }).collect()
    };
    let painter = ui.painter();
    painter.add(Shape::line(arc(0.0, 1.0), Stroke::new(12.0, p.line)));
    let target = value.map(|v| if max > 0.0 { (v / max).clamp(0.0, 1.0) } else { 0.0 }).unwrap_or(0.0) as f32;
    let pct = ui.ctx().animate_value_with_time(ui.scope_id().with("gauge"), target, 0.8);
    if pct > 0.002 {
        let n = (pct * 120.0).max(2.0) as usize;
        // glow under the arc, then the gradient arc in short segments
        let pts = arc(0.0, pct);
        painter.add(Shape::line(pts, Stroke::new(18.0, alpha(p.pri, 0.18))));
        for i in 0..n {
            let a0 = pct * i as f32 / n as f32;
            let a1 = pct * (i + 1) as f32 / n as f32 + 0.002;
            let col = mix(p.pri, p.mag, (a0 + a1) / 2.0);
            painter.add(Shape::line(arc(a0, a1.min(pct)), Stroke::new(12.0, col)));
        }
        painter.circle_filled(c + Vec2::angled(start) * r, 6.0, p.pri);
        painter.circle_filled(c + Vec2::angled(start + sweep * pct) * r, 6.0, mix(p.pri, p.mag, pct));
    }
    let (v, u) = fmt::hash(value);
    painter.text(c + Vec2::new(0.0, -6.0), Align2::CENTER_CENTER, v, bold(40.0), p.text);
    painter.text(c + Vec2::new(0.0, 24.0), Align2::CENTER_CENTER, u, bold(15.0), p.pri);
    painter.text(c + Vec2::new(0.0, 46.0), Align2::CENTER_CENTER, subtext, FontId::proportional(11.5), p.dim);
}

// ---------------------------------------------------------------- charts

#[derive(Clone, Copy, PartialEq, Eq)]
pub enum Series {
    Hashrate,
    Temp,
    Power,
}

fn pick(pt: &axe_core::db::Point, s: Series) -> Option<f64> {
    match s {
        Series::Hashrate => pt.hashrate,
        Series::Temp => pt.temp,
        Series::Power => pt.power,
    }
}

fn label(s: Series, v: f64) -> String {
    match s {
        Series::Hashrate => fmt::hash_str(Some(v)),
        Series::Temp => format!("{v:.1} °C"),
        Series::Power => format!("{v:.1} W"),
    }
}

/// Area chart with a gradient fill, optional second line and a hover readout.
pub fn chart(ui: &mut Ui, p: &Pal, points: &[axe_core::db::Point], main: Series, second: Option<Series>, height: f32) {
    let (rect, resp) = ui.allocate_exact_size(Vec2::new(ui.available_width(), height), Sense::hover());
    let painter = ui.painter_at(rect.expand(4.0));
    let pts: Vec<&axe_core::db::Point> = points.iter().filter(|x| pick(x, main).is_some()).collect();
    if pts.len() < 2 {
        painter.text(rect.center(), Align2::CENTER_CENTER, "Collecting history…", FontId::proportional(13.0), p.dim);
        return;
    }
    let plot = Rect::from_min_max(rect.min, Pos2::new(rect.max.x, rect.max.y - 18.0));
    let (t0, t1) = (pts[0].t as f64, pts[pts.len() - 1].t as f64);
    let sx = |t: f64| plot.left() + ((t - t0) / (t1 - t0).max(1.0)) as f32 * plot.width();
    let scale = |s: Series| {
        let vals: Vec<f64> = pts.iter().filter_map(|x| pick(x, s)).collect();
        let mut lo = vals.iter().cloned().fold(f64::INFINITY, f64::min);
        let mut hi = vals.iter().cloned().fold(f64::NEG_INFINITY, f64::max);
        if s == Series::Hashrate {
            lo = (lo - (hi - lo) * 0.6 - hi * 0.02).max(0.0);
        }
        if (hi - lo).abs() < 1e-9 {
            hi += 1.0;
            lo -= 1.0;
        }
        (lo, hi)
    };
    for f in [0.25f32, 0.5, 0.75] {
        let y = plot.top() + plot.height() * f;
        painter.add(Shape::dashed_line(&[Pos2::new(plot.left(), y), Pos2::new(plot.right(), y)], Stroke::new(1.0, p.line), 3.0, 5.0));
    }
    let line_for = |s: Series| -> Vec<Pos2> {
        let (lo, hi) = scale(s);
        pts.iter()
            .filter_map(|x| pick(x, s).map(|v| Pos2::new(sx(x.t as f64), plot.top() + 10.0 + (1.0 - ((v - lo) / (hi - lo)) as f32) * (plot.height() - 12.0))))
            .collect()
    };
    let main_pts = line_for(main);
    // gradient fill: one quad per segment, top colour at the line, clear at the bottom
    let mut mesh = Mesh::default();
    let uv = egui::epaint::WHITE_UV;
    let top = alpha(p.pri, 0.35);
    let bottom = alpha(p.pri, 0.0);
    for w in main_pts.windows(2) {
        let i = mesh.vertices.len() as u32;
        let (a, b) = (w[0], w[1]);
        let ya = (a.y - plot.top()) / plot.height();
        let yb = (b.y - plot.top()) / plot.height();
        mesh.vertices.push(Vertex { pos: a, uv, color: mix(top, bottom, ya * 0.6) });
        mesh.vertices.push(Vertex { pos: b, uv, color: mix(top, bottom, yb * 0.6) });
        mesh.vertices.push(Vertex { pos: Pos2::new(b.x, plot.bottom()), uv, color: bottom });
        mesh.vertices.push(Vertex { pos: Pos2::new(a.x, plot.bottom()), uv, color: bottom });
        mesh.indices.extend_from_slice(&[i, i + 1, i + 2, i, i + 2, i + 3]);
    }
    painter.add(Shape::mesh(mesh));
    painter.add(Shape::line(main_pts.clone(), Stroke::new(2.0, p.pri)));
    if let Some(s2) = second {
        let l2 = line_for(s2);
        if l2.len() >= 2 {
            painter.add(Shape::line(l2, Stroke::new(1.5, alpha(p.mag, 0.85))));
        }
    }
    let span = t1 - t0;
    let tl = |t: f64| if span > 2.0 * 86400.0 { fmt::date(t as i64) } else { fmt::clock(t as i64, false) };
    for (i, t) in [t0, t0 + span / 2.0, t1].iter().enumerate() {
        let align = [Align2::LEFT_BOTTOM, Align2::CENTER_BOTTOM, Align2::RIGHT_BOTTOM][i];
        painter.text(Pos2::new([rect.left(), rect.center().x, rect.right()][i], rect.bottom()), align, tl(*t), FontId::proportional(11.0), p.dim);
    }
    if let Some(pos) = resp.hover_pos() {
        let (idx, _) = pts.iter().enumerate().fold((0, f32::INFINITY), |(bi, bd), (i, x)| {
            let d = (sx(x.t as f64) - pos.x).abs();
            if d < bd { (i, d) } else { (bi, bd) }
        });
        let hp = pts[idx];
        let x = sx(hp.t as f64);
        painter.line_segment([Pos2::new(x, plot.top()), Pos2::new(x, plot.bottom())], Stroke::new(1.0, alpha(p.text, 0.4)));
        let mut lines = vec![(label(main, pick(hp, main).unwrap_or(0.0)), p.text)];
        if let Some(s2) = second {
            if let Some(v) = pick(hp, s2) {
                lines.push((label(s2, v), p.mag));
            }
        }
        lines.push((fmt::clock(hp.t, true), p.dim));
        let w = 130.0;
        let bx = (x - w / 2.0).clamp(rect.left(), rect.right() - w);
        let tip = Rect::from_min_size(Pos2::new(bx, plot.top() + 2.0), Vec2::new(w, 14.0 + 16.0 * lines.len() as f32));
        painter.rect(tip, CornerRadius::same(8), p.panel2, Stroke::new(1.0, p.line), egui::StrokeKind::Inside);
        for (i, (t, c)) in lines.into_iter().enumerate() {
            painter.text(tip.left_top() + Vec2::new(9.0, 7.0 + 16.0 * i as f32), Align2::LEFT_TOP, t, if i == 0 { bold(12.5) } else { FontId::proportional(11.5) }, c);
        }
    }
}
