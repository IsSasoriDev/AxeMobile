//! The DTV intro. A black hole ray-traced on the GPU: light bends around
//! it, the accretion disk is Doppler-brightened on the side spinning toward
//! the camera, and the background stars and nebula get lensed into the
//! Einstein ring. The camera orbits, closes in, falls through the event
//! horizon, and the DTV logo comes out of the dark.

use std::sync::Arc;

use eframe::egui::{self, Align2, Color32, Pos2, Rect, Stroke, Vec2};
use eframe::glow::{self, HasContext};

use crate::theme::{alpha, hsla, radial};
use crate::widgets::bold;

const VS: &str = r#"
const vec2 verts[3] = vec2[3](vec2(-1.0, -1.0), vec2(3.0, -1.0), vec2(-1.0, 3.0));
void main() {
    gl_Position = vec4(verts[gl_VertexID], 0.0, 1.0);
}
"#;

const FS: &str = r#"
precision highp float;
uniform vec2 u_res;
uniform vec2 u_off;
uniform float u_time;
uniform float u_dist;
uniform float u_bright;
uniform float u_flash;
out vec4 out_color;

float hash(vec3 p) {
    p = fract(p * 0.3183099 + 0.1);
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

float noise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash(i), hash(i + vec3(1, 0, 0)), f.x),
                   mix(hash(i + vec3(0, 1, 0)), hash(i + vec3(1, 1, 0)), f.x), f.y),
               mix(mix(hash(i + vec3(0, 0, 1)), hash(i + vec3(1, 0, 1)), f.x),
                   mix(hash(i + vec3(0, 1, 1)), hash(i + vec3(1, 1, 1)), f.x), f.y), f.z);
}

float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; }
    return s;
}

// sky seen along direction d: DTV nebula (violet and ember) and two layers of stars
vec3 sky(vec3 d) {
    vec3 col = vec3(0.0);
    float n1 = fbm(d * 2.2 + vec3(0.0, 0.0, u_time * 0.01));
    float n2 = fbm(d * 3.1 + 7.0);
    col += vec3(0.28, 0.07, 0.38) * pow(n1, 3.0) * 1.1;
    col += vec3(0.50, 0.20, 0.03) * pow(n2, 4.0) * 0.9;
    for (int i = 0; i < 3; i++) {
        float s = 90.0 + float(i) * 140.0;
        vec3 p = d * s;
        vec3 id = floor(p);
        vec3 f = fract(p) - 0.5;
        float h = hash(id + float(i) * 17.31);
        if (h > 0.986) {
            float tw = 0.65 + 0.35 * sin(u_time * (2.0 + h * 4.0) + h * 80.0);
            float b = smoothstep(0.22, 0.0, length(f)) * tw;
            vec3 c = mix(vec3(1.0), vec3(1.0, 0.62, 0.28), step(0.994, h));
            col += c * b * (1.6 - float(i) * 0.4);
        }
    }
    return col;
}

void main() {
    vec2 uv = (gl_FragCoord.xy - u_off - 0.5 * u_res) / u_res.y;

    // camera on a slow orbit, a little above the disk plane
    float ang = 0.9 + u_time * 0.12;
    float elev = 0.16 + 0.05 * sin(u_time * 0.3);
    vec3 ro = vec3(sin(ang), elev, -cos(ang)) * u_dist;
    vec3 ww = normalize(-ro);
    vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
    vec3 vv = cross(uu, ww);
    float roll = 0.18;
    vec2 q = mat2(cos(roll), -sin(roll), sin(roll), cos(roll)) * uv;
    vec3 rd = normalize(q.x * uu + q.y * vv + 1.5 * ww);

    vec3 p = ro;
    vec3 v = rd;
    vec3 hv = cross(p, v);
    float h2 = dot(hv, hv);
    vec3 col = vec3(0.0);
    float trans = 1.0;
    bool captured = false;
    float minr = 1e9;

    for (int i = 0; i < 360; i++) {
        float r2 = dot(p, p);
        float r = sqrt(r2);
        minr = min(minr, r);
        if (r < 1.0) { captured = true; break; }
        if (r > max(u_dist * 1.6, 30.0)) break;
        float dt = 0.012 + 0.045 * r;
        // Schwarzschild photon bending (rs = 1)
        vec3 acc = -1.5 * h2 * p / (r2 * r2 * r);
        v += acc * dt;
        vec3 pn = p + v * dt;

        if (p.y * pn.y < 0.0) {
            float k = p.y / (p.y - pn.y);
            vec3 c = mix(p, pn, k);
            float rc = length(c.xz);
            if (rc > 2.4 && rc < 11.0) {
                float a = atan(c.z, c.x);
                float spin = a - u_time * 1.6 / pow(rc, 1.5) * 2.5;
                float bands = fbm(vec3(rc * 2.2, spin * 3.0, u_time * 0.15));
                float fine = noise(vec3(rc * 14.0, spin * 18.0, 3.0));
                float edge = smoothstep(11.0, 6.0, rc) * smoothstep(2.4, 3.0, rc);
                float temp = pow(3.0 / rc, 1.5);
                vec3 vel = normalize(vec3(-c.z, 0.0, c.x));
                float dop = 1.0 + 0.75 * dot(vel, -normalize(v));
                vec3 ember = vec3(0.55, 0.12, 0.02);
                vec3 orange = vec3(1.0, 0.45, 0.06);
                vec3 white = vec3(1.0, 0.93, 0.82);
                vec3 dc = mix(ember, orange, clamp(temp * 1.2, 0.0, 1.0));
                dc = mix(dc, white, clamp((temp - 0.75) * 1.6, 0.0, 1.0));
                float inten = edge * (0.25 + bands * 1.1 + fine * 0.25) * temp * 1.8 * dop * dop * dop;
                col += trans * dc * inten;
                trans *= 1.0 - clamp(inten * 0.55, 0.0, 0.92);
                if (trans < 0.02) break;
            }
        }
        p = pn;
    }

    if (!captured) col += trans * sky(normalize(v));
    // photon ring: light that skimmed the horizon
    float ring = exp(-pow((minr - 1.5) * 6.0, 2.0)) * (captured ? 0.0 : 1.0);
    col += vec3(1.0, 0.7, 0.35) * ring * 0.9 * trans;

    col += vec3(1.0, 0.6, 0.25) * u_flash;
    col = 1.0 - exp(-col * 1.35);
    col = pow(col, vec3(0.92));
    // vignette
    col *= 1.0 - 0.35 * dot(uv, uv);
    out_color = vec4(col * u_bright, 1.0);
}
"#;

pub struct BlackHole {
    program: glow::Program,
    vao: glow::VertexArray,
}

#[derive(Clone, Copy)]
pub struct Uniforms {
    pub time: f32,
    pub dist: f32,
    pub bright: f32,
    pub flash: f32,
}

impl BlackHole {
    pub fn new(gl: &glow::Context) -> Option<Self> {
        let ver = egui_glow::ShaderVersion::get(gl);
        if !ver.is_new_shader_interface() {
            return None;
        }
        unsafe {
            let program = gl.create_program().ok()?;
            let mut shaders = vec![];
            for (ty, src) in [(glow::VERTEX_SHADER, VS), (glow::FRAGMENT_SHADER, FS)] {
                let s = gl.create_shader(ty).ok()?;
                gl.shader_source(s, &format!("{}\n{}", ver.version_declaration(), src));
                gl.compile_shader(s);
                if !gl.get_shader_compile_status(s) {
                    eprintln!("black hole shader: {}", gl.get_shader_info_log(s));
                    return None;
                }
                gl.attach_shader(program, s);
                shaders.push(s);
            }
            gl.link_program(program);
            if !gl.get_program_link_status(program) {
                eprintln!("black hole link: {}", gl.get_program_info_log(program));
                return None;
            }
            for s in shaders {
                gl.detach_shader(program, s);
                gl.delete_shader(s);
            }
            let vao = gl.create_vertex_array().ok()?;
            Some(Self { program, vao })
        }
    }

    fn paint(&self, gl: &glow::Context, u: Uniforms, vp: egui::epaint::ViewportInPixels) {
        unsafe {
            gl.use_program(Some(self.program));
            let loc = |n: &str| gl.get_uniform_location(self.program, n);
            gl.uniform_2_f32(loc("u_res").as_ref(), vp.width_px as f32, vp.height_px as f32);
            gl.uniform_2_f32(loc("u_off").as_ref(), vp.left_px as f32, vp.from_bottom_px as f32);
            gl.uniform_1_f32(loc("u_time").as_ref(), u.time);
            gl.uniform_1_f32(loc("u_dist").as_ref(), u.dist);
            gl.uniform_1_f32(loc("u_bright").as_ref(), u.bright);
            gl.uniform_1_f32(loc("u_flash").as_ref(), u.flash);
            gl.bind_vertex_array(Some(self.vao));
            gl.draw_arrays(glow::TRIANGLES, 0, 3);
        }
    }

    /// Queues the shader to fill `rect`.
    pub fn draw(self: &Arc<Self>, painter: &egui::Painter, rect: Rect, u: Uniforms) {
        let me = self.clone();
        let cb = egui_glow::CallbackFn::new(move |info, p| me.paint(p.gl(), u, info.viewport_in_pixels()));
        painter.add(egui::PaintCallback { rect, callback: Arc::new(cb) });
    }
}

fn smooth(t: f32) -> f32 {
    let t = t.clamp(0.0, 1.0);
    t * t * (3.0 - 2.0 * t)
}

fn back_out(t: f32) -> f32 {
    // cubic-bezier(0.175, 0.885, 0.32, 1.275), close enough
    let t = t.clamp(0.0, 1.0);
    let c1 = 1.70158;
    let c3 = c1 + 1.0;
    1.0 + c3 * (t - 1.0).powi(3) + c1 * (t - 1.0).powi(2)
}

/// Timeline of the intro, in seconds.
const ORBIT: f32 = 2.2;
const APPROACH: f32 = 3.8;
const PLUNGE: f32 = 4.9;
const LOGO: f32 = 5.0;
const TEXT: f32 = 5.8;
const TYPE_MS: f32 = 0.055;
const TITLE: &str = "DTV ELECTRONICS";

pub struct Intro {
    start: Option<f64>,
    pub done: bool,
}

impl Intro {
    pub fn new() -> Self {
        Self { start: None, done: false }
    }

    fn end_time() -> f32 {
        TEXT + TITLE.len() as f32 * TYPE_MS + 0.9 + 1.0
    }

    /// Draws one frame over `rect`. Click or Esc skips it.
    pub fn show(&mut self, ui: &mut egui::Ui, rect: Rect, gl: Option<&Arc<BlackHole>>, logo: Option<&egui::TextureHandle>) {
        let now = ui.input(|i| i.time);
        let start = *self.start.get_or_insert(now);
        let t = (now - start) as f32;
        // ignore the click that started the intro (theme switch, replay button)
        let skip = t > 0.5 && ui.input(|i| i.key_pressed(egui::Key::Escape) || i.pointer.any_click());
        if t > Self::end_time() || skip {
            self.done = true;
            return;
        }
        ui.ctx().request_repaint();
        let painter = ui.painter_at(rect);
        let fade_out = 1.0 - smooth((t - (Self::end_time() - 1.0)) / 1.0);
        painter.rect_filled(rect, 0.0, Color32::from_black_alpha((255.0 * fade_out) as u8));

        // camera distance over the timeline
        let dist = if t < ORBIT {
            16.0
        } else if t < APPROACH {
            16.0 - 8.5 * smooth((t - ORBIT) / (APPROACH - ORBIT))
        } else if t < PLUNGE {
            let k = (t - APPROACH) / (PLUNGE - APPROACH);
            7.5 - 7.0 * k * k * k
        } else {
            // after the fall: a far, dim black hole behind the logo
            38.0
        };
        let bright = if t < 0.6 {
            smooth(t / 0.6)
        } else if t < PLUNGE {
            1.0
        } else {
            0.35 * smooth((t - PLUNGE - 0.5) / 1.2)
        } * fade_out;
        let flash = if (PLUNGE - 0.25..PLUNGE + 0.05).contains(&t) { 0.6 * (1.0 - ((t - PLUNGE + 0.25) / 0.3)) } else { 0.0 };

        match gl {
            Some(bh) => bh.draw(&painter, rect, Uniforms { time: t, dist, bright, flash }),
            None => fallback(&painter, rect, t, bright),
        }

        // logo pop with the glow rings and the burst ring
        if t >= LOGO {
            let lt = t - LOGO;
            let s = 0.5 + 0.5 * back_out(lt / 0.5);
            let op = smooth(lt / 0.5) * fade_out;
            let c = rect.center() - Vec2::new(0.0, 50.0);
            let size = if rect.width() >= 768.0 { 160.0 } else { 128.0 };
            let mut shapes = vec![];
            let g1 = smooth(lt / 0.7);
            radial(&mut shapes, c, Vec2::splat((size / 2.0 + 64.0) * (0.5 + 0.6 * g1)), hsla(25.0, 100.0, 50.0, 0.30 * g1 * fade_out));
            let g2 = smooth((lt - 0.1) / 0.5);
            radial(&mut shapes, c, Vec2::splat(size / 2.0 + 40.0), hsla(25.0, 100.0, 50.0, 0.20 * g2 * fade_out));
            painter.extend(shapes);
            let b = smooth(lt / 1.0);
            let br = (size / 2.0 + 96.0) * (0.75 + 1.25 * b);
            painter.circle_stroke(c, br, Stroke::new(2.0, alpha(Color32::from_rgb(255, 106, 0), 0.5 * 0.6 * (1.0 - b) * fade_out)));
            if let Some(tex) = logo {
                let r = Rect::from_center_size(c, Vec2::splat(size * s));
                painter.image(tex.id(), r, Rect::from_min_max(Pos2::ZERO, Pos2::new(1.0, 1.0)), Color32::from_white_alpha((255.0 * op) as u8));
            }
        }

        // typed title and subtitle
        if t >= TEXT {
            let tt = t - TEXT;
            let n = ((tt / TYPE_MS) as usize).min(TITLE.len());
            let shown = &TITLE[..n];
            let cursor = if (now * 2.0) as i64 % 2 == 0 { "|" } else { " " };
            let size = if rect.width() >= 1024.0 { 60.0 } else if rect.width() >= 768.0 { 48.0 } else { 30.0 };
            let rise = (1.0 - back_out(tt / 0.7)) * 24.0;
            let y = rect.center().y + 70.0 + rise;
            let op = smooth(tt / 0.7) * fade_out;
            let text = format!("{shown}{cursor}");
            for (o, a) in [(6.0, 0.10), (3.0, 0.18)] {
                for d in [Vec2::new(o, 0.0), Vec2::new(-o, 0.0), Vec2::new(0.0, o), Vec2::new(0.0, -o)] {
                    painter.text(Pos2::new(rect.center().x, y) + d, Align2::CENTER_CENTER, &text, bold(size), hsla(25.0, 100.0, 50.0, a * op));
                }
            }
            painter.text(Pos2::new(rect.center().x, y), Align2::CENTER_CENTER, &text, bold(size), Color32::from_rgba_unmultiplied(255, 236, 220, (255.0 * op) as u8));
            let sop = smooth((tt - 0.3) / 0.5) * fade_out;
            painter.text(
                Pos2::new(rect.center().x, y + size * 0.62 + 14.0),
                Align2::CENTER_CENTER,
                "E S T .   B L O C K   7 2 3 , 4 2 0",
                egui::FontId::proportional(15.0),
                hsla(25.0, 100.0, 50.0, 0.8 * sop),
            );
        }

        // faint scanlines, as before
        let mut y = rect.top();
        while y < rect.bottom() {
            painter.line_segment([Pos2::new(rect.left(), y + 2.0), Pos2::new(rect.right(), y + 2.0)], Stroke::new(2.0, Color32::from_white_alpha(1)));
            y += 4.0;
        }
        painter.text(rect.right_bottom() - Vec2::new(18.0, 16.0), Align2::RIGHT_BOTTOM, "click to skip", egui::FontId::proportional(11.0), Color32::from_white_alpha((40.0 * fade_out) as u8));
    }
}

/// Without OpenGL 3.3 the intro falls back to the 1.x canvas version.
fn fallback(painter: &egui::Painter, rect: Rect, t: f32, bright: f32) {
    let c = rect.center();
    let grow = smooth((t - ORBIT) / (APPROACH - ORBIT));
    let consume = ((t - APPROACH) / (PLUNGE - APPROACH)).clamp(0.0, 1.0).powi(3);
    let max_r = rect.size().length() / 2.0 + 100.0;
    let hole = 50.0 + (t * 2.0).sin() * 5.0 + grow * 80.0 + consume * (max_r - 130.0);
    if t < PLUNGE {
        for i in 0..300 {
            let fi = i as f32;
            let base = 70.0 + (i % 3) as f32 * 50.0 + (fi * 7.31).sin().abs() * 40.0;
            let ang = fi * 2.399 + t * (0.6 + (fi * 1.7).cos().abs()) * (1.0 + grow * 2.0 + consume * 6.0);
            let shrink = 1.0 - grow * 0.2 - consume * 0.8;
            let r = base * shrink;
            let p = c + Vec2::new(ang.cos() * r * 1.4, ang.sin() * r * 0.35);
            let br = (ang.sin() + 1.0) / 2.0 * (1.0 - consume * 2.5).max(0.0) * bright;
            painter.circle_filled(p, 1.5, hsla(30.0, 100.0, 60.0, br));
        }
        painter.circle_stroke(c, hole + 4.0, Stroke::new(2.0 + grow * 2.0, Color32::from_rgba_unmultiplied(255, 180, 80, (180.0 * (1.0 - consume * 2.0).max(0.0) * bright) as u8)));
    }
    painter.circle_filled(c, hole.min(max_r), Color32::BLACK);
}
