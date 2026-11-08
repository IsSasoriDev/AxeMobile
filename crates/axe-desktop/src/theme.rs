//! Colours, egui styling and the animated window backgrounds.
//!
//! The DTV theme reproduces AxeMobile 1.x's CSS by hand: the same colours,
//! the three pulsing nebula ellipses (8 s), the ten twinkling stars (4 s),
//! the white and orange comets (6 s and 8 s, the second 3 s late) and the
//! 4 s border pulse on cards.

use eframe::egui::{self, Color32, CornerRadius, Mesh, Pos2, Rect, Shape, Stroke, Vec2};
use egui::epaint::Vertex;

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ThemeId {
    Forge,
    Dtv,
}

impl ThemeId {
    pub fn key(self) -> &'static str {
        match self {
            ThemeId::Forge => "default",
            ThemeId::Dtv => "dtv",
        }
    }
    pub fn from_key(s: &str) -> Self {
        if s == "dtv" { ThemeId::Dtv } else { ThemeId::Forge }
    }
}

#[derive(Clone, Copy)]
pub struct Pal {
    pub id: ThemeId,
    pub bg: Color32,
    pub bg2: Color32,
    pub panel: Color32,
    pub panel2: Color32,
    pub line: Color32,
    pub text: Color32,
    pub dim: Color32,
    pub pri: Color32,
    pub pri_fg: Color32,
    pub mag: Color32,
    pub good: Color32,
    pub warn: Color32,
    pub bad: Color32,
    pub violet: Color32,
    pub nav: Color32,
}

pub const fn rgb(r: u8, g: u8, b: u8) -> Color32 {
    Color32::from_rgb(r, g, b)
}

pub fn alpha(c: Color32, a: f32) -> Color32 {
    let [r, g, b, _] = c.to_srgba_unmultiplied();
    Color32::from_rgba_unmultiplied(r, g, b, (a.clamp(0.0, 1.0) * 255.0) as u8)
}

pub fn mix(a: Color32, b: Color32, t: f32) -> Color32 {
    let t = t.clamp(0.0, 1.0);
    let [ar, ag, ab, aa] = a.to_srgba_unmultiplied();
    let [br, bg, bb, ba] = b.to_srgba_unmultiplied();
    let l = |x: u8, y: u8| (x as f32 + (y as f32 - x as f32) * t) as u8;
    Color32::from_rgba_unmultiplied(l(ar, br), l(ag, bg), l(ab, bb), l(aa, ba))
}

/// `hsl(h s% l%)` as CSS writes it.
pub fn hsl(h: f32, s: f32, l: f32) -> Color32 {
    hsla(h, s, l, 1.0)
}

pub fn hsla(h: f32, s: f32, l: f32, a: f32) -> Color32 {
    let (s, l) = (s / 100.0, l / 100.0);
    let c = (1.0 - (2.0 * l - 1.0).abs()) * s;
    let hp = (h % 360.0) / 60.0;
    let x = c * (1.0 - (hp % 2.0 - 1.0).abs());
    let (r, g, b) = match hp as i32 {
        0 => (c, x, 0.0),
        1 => (x, c, 0.0),
        2 => (0.0, c, x),
        3 => (0.0, x, c),
        4 => (x, 0.0, c),
        _ => (c, 0.0, x),
    };
    let m = l - c / 2.0;
    let f = |v: f32| ((v + m) * 255.0).round().clamp(0.0, 255.0) as u8;
    Color32::from_rgba_unmultiplied(f(r), f(g), f(b), (a * 255.0) as u8)
}

impl Pal {
    pub fn get(id: ThemeId) -> Self {
        match id {
            ThemeId::Forge => Pal {
                id,
                bg: rgb(7, 10, 16),
                bg2: rgb(11, 18, 32),
                panel: rgb(15, 21, 32),
                panel2: rgb(20, 28, 42),
                line: rgb(28, 38, 53),
                text: rgb(230, 237, 246),
                dim: rgb(154, 168, 189),
                pri: rgb(0, 229, 255),
                pri_fg: rgb(0, 19, 24),
                mag: rgb(255, 43, 214),
                good: rgb(43, 255, 136),
                warn: rgb(255, 159, 28),
                bad: rgb(255, 59, 92),
                violet: rgb(139, 92, 255),
                nav: Color32::from_rgba_unmultiplied(10, 15, 24, 217),
            },
            ThemeId::Dtv => Pal {
                id,
                bg: hsl(0.0, 0.0, 2.0),
                bg2: hsl(0.0, 0.0, 3.0),
                panel: hsla(0.0, 0.0, 6.0, 0.92),
                panel2: hsl(0.0, 0.0, 10.0),
                line: hsl(25.0, 30.0, 14.0),
                text: hsl(0.0, 0.0, 95.0),
                dim: hsl(0.0, 0.0, 55.0),
                pri: hsl(25.0, 100.0, 50.0),
                pri_fg: rgb(0, 0, 0),
                mag: hsl(25.0, 80.0, 38.0),
                good: hsl(160.0, 100.0, 40.0),
                warn: hsl(25.0, 100.0, 50.0),
                bad: hsl(0.0, 84.0, 55.0),
                violet: hsl(25.0, 100.0, 50.0),
                nav: hsla(0.0, 0.0, 2.0, 0.95),
            },
        }
    }

    pub fn dtv(&self) -> bool {
        self.id == ThemeId::Dtv
    }
}

pub fn apply(ctx: &egui::Context, p: &Pal) {
    let mut v = egui::Visuals::dark();
    v.override_text_color = Some(p.text);
    v.panel_fill = Color32::TRANSPARENT;
    v.window_fill = p.panel2;
    v.window_stroke = Stroke::new(1.0, p.line);
    v.window_corner_radius = CornerRadius::same(14);
    v.extreme_bg_color = if p.dtv() { hsl(0.0, 0.0, 4.0) } else { p.bg };
    v.faint_bg_color = p.panel2;
    v.hyperlink_color = p.pri;
    v.selection.bg_fill = alpha(p.pri, 0.35);
    v.selection.stroke = Stroke::new(1.0, p.pri);
    v.text_cursor.stroke = Stroke::new(2.0, p.pri);
    let r = CornerRadius::same(10);
    let w = &mut v.widgets;
    w.noninteractive.bg_fill = p.panel;
    w.noninteractive.weak_bg_fill = p.panel;
    w.noninteractive.bg_stroke = Stroke::new(1.0, p.line);
    w.noninteractive.fg_stroke = Stroke::new(1.0, p.text);
    w.noninteractive.corner_radius = r;
    for (st, fill, stroke) in [
        (&mut w.inactive, p.panel2, p.line),
        (&mut w.hovered, mix(p.panel2, p.pri, 0.12), alpha(p.pri, 0.6)),
        (&mut w.active, mix(p.panel2, p.pri, 0.22), p.pri),
        (&mut w.open, p.panel2, p.pri),
    ] {
        st.bg_fill = fill;
        st.weak_bg_fill = fill;
        st.bg_stroke = Stroke::new(1.0, stroke);
        st.fg_stroke = Stroke::new(1.5, p.text);
        st.corner_radius = r;
        st.expansion = 0.0;
    }
    v.popup_shadow = egui::epaint::Shadow { offset: [0, 8], blur: 24, spread: 0, color: Color32::from_black_alpha(140) };
    v.window_shadow = v.popup_shadow;
    ctx.set_visuals(v);
    ctx.global_style_mut(|s| {
        s.spacing.item_spacing = Vec2::new(10.0, 8.0);
        s.spacing.button_padding = Vec2::new(14.0, 8.0);
        s.spacing.interact_size.y = 34.0;
        s.spacing.slider_width = 260.0;
        s.spacing.scroll.bar_width = 8.0;
        s.text_styles.insert(egui::TextStyle::Body, egui::FontId::proportional(14.0));
        s.text_styles.insert(egui::TextStyle::Button, egui::FontId::proportional(14.0));
        s.text_styles.insert(egui::TextStyle::Small, egui::FontId::proportional(12.0));
        s.text_styles.insert(egui::TextStyle::Heading, egui::FontId::new(20.0, egui::FontFamily::Name("bold".into())));
    });
}

// ---------------------------------------------------------------- painting

/// Radial gradient ellipse: `color` at the centre fading linearly to
/// transparent at `radius` (CSS `radial-gradient(color 0%, transparent X%)`).
pub fn radial(shapes: &mut Vec<Shape>, center: Pos2, radius: Vec2, color: Color32) {
    let rings = 6;
    let segs = 48;
    let mut mesh = Mesh::default();
    mesh.vertices.push(Vertex { pos: center, uv: egui::epaint::WHITE_UV, color });
    for r in 1..=rings {
        let t = r as f32 / rings as f32;
        let c = alpha_scale(color, 1.0 - t);
        for s in 0..segs {
            let a = s as f32 / segs as f32 * std::f32::consts::TAU;
            let pos = center + Vec2::new(a.cos() * radius.x * t, a.sin() * radius.y * t);
            mesh.vertices.push(Vertex { pos, uv: egui::epaint::WHITE_UV, color: c });
        }
    }
    for s in 0..segs {
        let n = (s + 1) % segs;
        mesh.indices.extend_from_slice(&[0, 1 + s as u32, 1 + n as u32]);
    }
    for r in 1..rings {
        let a0 = 1 + (r - 1) * segs;
        let b0 = 1 + r * segs;
        for s in 0..segs {
            let n = (s + 1) % segs;
            let (a, an, b, bn) = ((a0 + s) as u32, (a0 + n) as u32, (b0 + s) as u32, (b0 + n) as u32);
            mesh.indices.extend_from_slice(&[a, b, bn, a, bn, an]);
        }
    }
    shapes.push(Shape::mesh(mesh));
}

fn alpha_scale(c: Color32, k: f32) -> Color32 {
    let [r, g, b, a] = c.to_srgba_unmultiplied();
    Color32::from_rgba_unmultiplied(r, g, b, (a as f32 * k.clamp(0.0, 1.0)) as u8)
}

pub fn vgradient(shapes: &mut Vec<Shape>, rect: Rect, top: Color32, bottom: Color32) {
    let mut mesh = Mesh::default();
    let uv = egui::epaint::WHITE_UV;
    for (pos, color) in [(rect.left_top(), top), (rect.right_top(), top), (rect.right_bottom(), bottom), (rect.left_bottom(), bottom)] {
        mesh.vertices.push(Vertex { pos, uv, color });
    }
    mesh.indices.extend_from_slice(&[0, 1, 2, 0, 2, 3]);
    shapes.push(Shape::mesh(mesh));
}

fn ease(t: f32) -> f32 {
    // CSS `ease-in-out`
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

/// Value of a CSS `alternate` animation over keyframes at 0/50/100%.
fn alternate3(t: f64, period: f64, a: f32, b: f32, c: f32) -> f32 {
    let cycle = (t / period) as i64;
    let mut u = ((t % period) / period) as f32;
    if cycle % 2 == 1 {
        u = 1.0 - u;
    }
    if u < 0.5 { a + (b - a) * ease(u * 2.0) } else { b + (c - b) * ease((u - 0.5) * 2.0) }
}

/// Paints the window background for the active theme.
pub fn background(painter: &egui::Painter, rect: Rect, p: &Pal, t: f64) {
    let mut shapes = Vec::new();
    let (w, h) = (rect.width(), rect.height());
    let at = |x: f32, y: f32| Pos2::new(rect.left() + w * x, rect.top() + h * y);
    match p.id {
        ThemeId::Forge => {
            vgradient(&mut shapes, rect, p.bg, p.bg2);
            // radial-gradient(1200px 600px at 80% -10%, glow 0, transparent 60%)
            radial(&mut shapes, at(0.8, -0.1), Vec2::new(720.0, 360.0), rgb(16, 33, 58));
        }
        ThemeId::Dtv => {
            shapes.push(Shape::rect_filled(rect, CornerRadius::ZERO, hsl(0.0, 0.0, 2.0)));
            // html::before — nebula, dtv-nebula-pulse 8s alternate: opacity .6 → 1 → .7, scale 1 → 1.03 → .98
            let op = alternate3(t, 8.0, 0.6, 1.0, 0.7);
            let sc = alternate3(t, 8.0, 1.0, 1.03, 0.98);
            let c = rect.center();
            let sp = |x: f32, y: f32| c + (at(x, y) - c) * sc;
            let small = w <= 768.0;
            if small {
                radial(&mut shapes, sp(0.25, 0.35), Vec2::new(w * 0.9 * 0.5, h * 0.6 * 0.5) * sc, hsla(280.0, 60.0, 15.0, 0.3 * op));
            } else {
                radial(&mut shapes, sp(0.2, 0.3), Vec2::new(w * 0.8 * 0.5, h * 0.5 * 0.5) * sc, hsla(280.0, 60.0, 15.0, 0.35 * op));
                radial(&mut shapes, sp(0.75, 0.7), Vec2::new(w * 0.6 * 0.45, h * 0.4 * 0.45) * sc, hsla(25.0, 80.0, 20.0, 0.25 * op));
                radial(&mut shapes, sp(0.5, 0.5), Vec2::new(w * 0.7 * 0.55, h * 0.6 * 0.55) * sc, hsla(260.0, 50.0, 12.0, 0.2 * op));
            }
            // body::before — ten stars, dtv-stars-twinkle 4s alternate: .6 → 1 → .7
            let tw = alternate3(t, 4.0, 0.6, 1.0, 0.7);
            let stars: [(f32, f32, f32, Color32); 10] = [
                (0.10, 0.15, 2.0, hsl(0.0, 0.0, 100.0)),
                (0.40, 0.10, 1.0, hsla(0.0, 0.0, 100.0, 0.6)),
                (0.55, 0.45, 2.0, hsl(25.0, 100.0, 60.0)),
                (0.70, 0.20, 1.0, hsla(0.0, 0.0, 100.0, 0.7)),
                (0.85, 0.55, 2.0, hsla(0.0, 0.0, 100.0, 0.9)),
                (0.15, 0.65, 1.0, hsl(25.0, 100.0, 55.0)),
                (0.30, 0.80, 2.0, hsla(0.0, 0.0, 100.0, 0.8)),
                (0.65, 0.85, 2.0, hsl(25.0, 100.0, 50.0)),
                (0.80, 0.75, 1.0, hsla(0.0, 0.0, 100.0, 0.7)),
                (0.95, 0.30, 2.0, hsl(0.0, 0.0, 100.0)),
            ];
            for (x, y, size, col) in stars {
                shapes.push(Shape::circle_filled(at(x, y), size * 0.6, alpha_scale(col, tw)));
            }
            if !small {
                comets(&mut shapes, rect, t);
            }
        }
    }
    painter.extend(shapes);
}

fn glow_dot(shapes: &mut Vec<Shape>, pos: Pos2, blur: f32, spread: f32, col: Color32) {
    radial(shapes, pos, Vec2::splat(spread + blur), col);
}

fn comets(shapes: &mut Vec<Shape>, rect: Rect, t: f64) {
    let (w, h) = (rect.width(), rect.height());
    let at = |x: f32, y: f32| Pos2::new(rect.left() + w * x, rect.top() + h * y);

    // #root::before — 6s, travels during the first 30%, rotated 25deg
    {
        let u = (t % 6.0) as f32 / 6.0;
        if u < 0.3 {
            let k = ease(u / 0.3);
            let op = if u < 0.05 { ease(u / 0.05) } else { 1.0 - ease((u - 0.05) / 0.25) };
            let pos = at(-0.10 + (1.15 + 0.10) * k, 0.05 + (0.45 - 0.05) * k);
            let rot = Vec2::angled(25f32.to_radians());
            let rv = |v: Vec2| Vec2::new(v.x * rot.x - v.y * rot.y, v.x * rot.y + v.y * rot.x);
            let white = |a: f32| hsla(0.0, 0.0, 100.0, a * op);
            glow_dot(shapes, pos + rv(Vec2::new(-60.0, 20.0)), 25.0, 0.0, white(0.1));
            glow_dot(shapes, pos + rv(Vec2::new(-30.0, 10.0)), 20.0, 1.0, white(0.3));
            glow_dot(shapes, pos, 25.0, 6.0, white(0.6));
            glow_dot(shapes, pos, 12.0, 3.0, white(1.0));
            shapes.push(Shape::circle_filled(pos, 3.0, white(1.0)));
        }
    }
    // #root::after — 8s, 3s delay, travels during the first 35%, rotated -25deg
    if t >= 3.0 {
        let u = ((t - 3.0) % 8.0) as f32 / 8.0;
        if u < 0.35 {
            let k = ease(u / 0.35);
            let op = if u < 0.05 { ease(u / 0.05) } else { 1.0 - ease((u - 0.05) / 0.30) };
            let pos = at(1.15 + (-0.15 - 1.15) * k, 0.18 + (0.58 - 0.18) * k);
            let rot = Vec2::angled((-25f32).to_radians());
            let rv = |v: Vec2| Vec2::new(v.x * rot.x - v.y * rot.y, v.x * rot.y + v.y * rot.x);
            let o = |l: f32, a: f32| hsla(25.0, 100.0, l, a * op);
            glow_dot(shapes, pos + rv(Vec2::new(55.0, 16.0)), 22.0, 0.0, o(45.0, 0.1));
            glow_dot(shapes, pos + rv(Vec2::new(25.0, 8.0)), 18.0, 1.0, o(50.0, 0.3));
            glow_dot(shapes, pos, 20.0, 5.0, o(55.0, 0.5));
            glow_dot(shapes, pos, 10.0, 3.0, o(60.0, 1.0));
            shapes.push(Shape::circle_filled(pos, 2.5, o(65.0, 1.0)));
        }
    }
}

/// `dtv-pulse`: border alpha and white glow breathing over 4 s.
pub fn dtv_pulse(t: f64) -> f32 {
    let u = ((t % 4.0) / 4.0) as f32;
    if u < 0.5 { ease(u * 2.0) } else { 1.0 - ease((u - 0.5) * 2.0) }
}
