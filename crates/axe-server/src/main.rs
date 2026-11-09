//! Headless AxeMobile: the web UI and API on one port, data in one SQLite
//! file. This is what runs in the Umbrel container.
//!
//! Environment:
//!   AXEMOBILE_PORT    listen port            (default 3847)
//!   AXEMOBILE_BIND    listen address         (default 0.0.0.0)
//!   AXEMOBILE_DATA    folder for axemobile.db (default ./data)
//!   AXEMOBILE_WEB     built web UI folder    (default ./dist)
//!   AXEMOBILE_TOKEN   optional API token

use std::net::SocketAddr;
use std::path::PathBuf;

use axe_core::{api, Config, Db, Engine};

fn env(key: &str, default: &str) -> String {
    std::env::var(key).ok().filter(|v| !v.is_empty()).unwrap_or_else(|| default.to_string())
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()))
        .init();

    let data = PathBuf::from(env("AXEMOBILE_DATA", "data"));
    let web = PathBuf::from(env("AXEMOBILE_WEB", "dist"));
    let port: u16 = env("AXEMOBILE_PORT", "3847").parse().expect("AXEMOBILE_PORT");
    let bind = env("AXEMOBILE_BIND", "0.0.0.0");
    let token = std::env::var("AXEMOBILE_TOKEN").ok().filter(|t| !t.is_empty());

    let db = match Db::open(&data.join("axemobile.db")) {
        Ok(db) => db,
        Err(e) => {
            // the usual cause on Umbrel/Docker is a data folder owned by root
            tracing::error!(
                "can't open {}: {e}. The folder must be writable by this user (uid 1000 in the image); \
                 starting the container as root lets entrypoint.sh fix the ownership.",
                data.join("axemobile.db").display()
            );
            std::process::exit(1);
        }
    };
    let engine = Engine::new(db, token.clone());
    let cfg = Config {
        db_path: data.join("axemobile.db"),
        token,
        static_dir: web.exists().then_some(web.clone()),
        cors_origins: vec![],
    };
    let app = api::router(engine.clone(), &cfg);
    tokio::spawn(engine.clone().run_market());
    tokio::spawn(engine.run_poller());

    let addr: SocketAddr = format!("{bind}:{port}").parse().expect("listen address");
    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    tracing::info!("AxeMobile listening on http://{addr} (data in {})", data.display());
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            let _ = tokio::signal::ctrl_c().await;
        })
        .await
        .expect("server");
}
