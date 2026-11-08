//! System tray (Windows notification area, macOS menu bar). Hovering the
//! icon shows the fleet at a glance; the menu lists every miner. Linux has
//! no tray here: the window just minimises.

use eframe::egui;

pub enum TrayMsg {
    Show,
    Quit,
    Miner(i64),
}

#[cfg(any(windows, target_os = "macos"))]
mod imp {
    use super::TrayMsg;
    use eframe::egui;
    use std::sync::mpsc::{channel, Receiver};
    use tray_icon::menu::{Menu, MenuEvent, MenuItem, PredefinedMenuItem};
    use tray_icon::{MouseButton, MouseButtonState, TrayIcon, TrayIconBuilder, TrayIconEvent};

    pub struct Tray {
        icon: TrayIcon,
        rx: Receiver<TrayMsg>,
    }

    impl Tray {
        pub fn new(ctx: &egui::Context) -> Option<Self> {
            let img = image::load_from_memory(include_bytes!("../assets/icon.png")).ok()?.resize(64, 64, image::imageops::FilterType::Lanczos3).to_rgba8();
            let (w, h) = img.dimensions();
            let icon = tray_icon::Icon::from_rgba(img.into_raw(), w, h).ok()?;
            let (tx, rx) = channel();
            let tx2 = tx.clone();
            let c1 = ctx.clone();
            TrayIconEvent::set_event_handler(Some(move |e: TrayIconEvent| {
                let show = matches!(
                    e,
                    TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. }
                        | TrayIconEvent::DoubleClick { button: MouseButton::Left, .. }
                );
                if show {
                    let _ = tx.send(TrayMsg::Show);
                    c1.request_repaint();
                }
            }));
            let c2 = ctx.clone();
            MenuEvent::set_event_handler(Some(move |e: MenuEvent| {
                let id = e.id.0.as_str();
                let msg = match id {
                    "show" => Some(TrayMsg::Show),
                    "quit" => Some(TrayMsg::Quit),
                    _ => id.strip_prefix("miner:").and_then(|x| x.parse().ok()).map(TrayMsg::Miner),
                };
                if let Some(m) = msg {
                    let _ = tx2.send(m);
                    c2.request_repaint();
                }
            }));
            let icon = TrayIconBuilder::new()
                .with_icon(icon)
                .with_tooltip("AxeMobile")
                .with_menu(Box::new(Self::menu(&[])))
                .with_menu_on_left_click(false)
                .build()
                .ok()?;
            Some(Self { icon, rx })
        }

        fn menu(lines: &[(i64, String)]) -> Menu {
            let m = Menu::new();
            let _ = m.append(&MenuItem::with_id("show", "Open AxeMobile", true, None));
            let _ = m.append(&PredefinedMenuItem::separator());
            if lines.is_empty() {
                let _ = m.append(&MenuItem::with_id("none", "No miners yet", false, None));
            }
            for (id, text) in lines.iter().take(15) {
                let _ = m.append(&MenuItem::with_id(format!("miner:{id}"), text, true, None));
            }
            let _ = m.append(&PredefinedMenuItem::separator());
            let _ = m.append(&MenuItem::with_id("quit", "Quit AxeMobile", true, None));
            m
        }

        pub fn update(&self, tooltip: &str, lines: &[(i64, String)]) {
            let _ = self.icon.set_tooltip(Some(tooltip));
            self.icon.set_menu(Some(Box::new(Self::menu(lines))));
        }

        pub fn poll(&self) -> Vec<TrayMsg> {
            self.rx.try_iter().collect()
        }
    }
}

#[cfg(not(any(windows, target_os = "macos")))]
mod imp {
    use super::TrayMsg;
    use eframe::egui;

    pub struct Tray;

    impl Tray {
        pub fn new(_ctx: &egui::Context) -> Option<Self> {
            None
        }
        pub fn update(&self, _tooltip: &str, _lines: &[(i64, String)]) {}
        pub fn poll(&self) -> Vec<TrayMsg> {
            vec![]
        }
    }
}

pub use imp::Tray;

/// Wakes the app every few seconds so the engine view, notifications and
/// tray tooltip stay fresh while the window is hidden.
pub fn keep_awake(ctx: &egui::Context) {
    let ctx = ctx.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(std::time::Duration::from_secs(4));
        ctx.request_repaint();
    });
}
