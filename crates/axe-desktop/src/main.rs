//! AxeMobile for Windows: a native app (no browser, no webview). The engine
//! that reads the miners and the SQLite database run inside this process.

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod app;
mod blackhole;
mod fmt;
mod fonts;
mod game;
mod jobs;
mod pages;
mod sys;
mod theme;
mod tray;
mod widgets;

use axe_core::{Db, Engine};

fn main() -> eframe::Result {
    let minimized = std::env::args().any(|a| a == "--minimized");
    let data = sys::data_dir();
    let db = match Db::open(&data.join("axemobile.db")) {
        Ok(db) => db,
        Err(e) => {
            rfd::MessageDialog::new()
                .set_title("AxeMobile")
                .set_description(format!("Can't open the database in {}:\n{e}", data.display()))
                .set_level(rfd::MessageLevel::Error)
                .show();
            std::process::exit(1);
        }
    };
    let engine = Engine::new(db, None);
    let rt = tokio::runtime::Builder::new_multi_thread().worker_threads(2).enable_all().build().expect("tokio runtime");
    rt.spawn(engine.clone().run_poller());
    rt.spawn(engine.clone().run_market());
    // read-only summary for the macOS widget (and anything else local)
    let wr = axe_core::api::widget_router(engine.clone());
    rt.spawn(async move {
        if let Ok(l) = tokio::net::TcpListener::bind("127.0.0.1:3848").await {
            let _ = axum::serve(l, wr).await;
        }
    });

    let icon = image::load_from_memory(include_bytes!("../assets/icon.png")).ok().map(|i| {
        let i = i.to_rgba8();
        eframe::egui::IconData { width: i.width(), height: i.height(), rgba: i.into_raw() }
    });
    let mut viewport = eframe::egui::ViewportBuilder::default()
        .with_title("AxeMobile")
        .with_inner_size([1320.0, 860.0])
        .with_min_inner_size([960.0, 620.0]);
    if let Some(icon) = icon {
        viewport = viewport.with_icon(icon);
    }
    let options = eframe::NativeOptions {
        viewport,
        renderer: eframe::Renderer::Glow,
        multisampling: 4,
        ..Default::default()
    };
    eframe::run_native("AxeMobile", options, Box::new(move |cc| Ok(Box::new(app::App::new(cc, rt, engine, minimized)))))
}
