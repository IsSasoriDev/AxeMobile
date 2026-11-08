//! Operating-system glue: data folder, start at login, notifications,
//! opening folders. Windows, macOS and Linux.

use std::path::PathBuf;

pub fn utc_offset_secs() -> i64 {
    use chrono::Offset;
    chrono::Local::now().offset().fix().local_minus_utc() as i64
}

fn home() -> PathBuf {
    std::env::var_os("HOME").or_else(|| std::env::var_os("USERPROFILE")).map(PathBuf::from).unwrap_or_else(|| PathBuf::from("."))
}

/// Where the database lives:
/// Windows `%APPDATA%\AxeMobile`, macOS `~/Library/Application Support/AxeMobile`,
/// Linux `$XDG_DATA_HOME/axemobile` (usually `~/.local/share/axemobile`).
pub fn data_dir() -> PathBuf {
    if cfg!(windows) {
        std::env::var_os("APPDATA").map(PathBuf::from).unwrap_or_else(home).join("AxeMobile")
    } else if cfg!(target_os = "macos") {
        home().join("Library/Application Support/AxeMobile")
    } else {
        std::env::var_os("XDG_DATA_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".local/share")).join("axemobile")
    }
}

pub fn exports_dir() -> PathBuf {
    home().join("Documents").join("AxeMobile")
}

pub fn open_folder(p: &std::path::Path) {
    let cmd = if cfg!(windows) { "explorer" } else if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
    let _ = std::process::Command::new(cmd).arg(p).spawn();
}

#[cfg(windows)]
pub fn set_autostart(on: bool) -> std::io::Result<()> {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
    let (key, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(RUN_KEY)?;
    if on {
        let exe = std::env::current_exe()?;
        key.set_value("AxeMobile", &format!("\"{}\" --minimized", exe.display()))
    } else {
        match key.delete_value("AxeMobile") {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            r => r,
        }
    }
}

#[cfg(target_os = "macos")]
pub fn set_autostart(on: bool) -> std::io::Result<()> {
    let plist = home().join("Library/LaunchAgents/com.issasoridev.axemobile.plist");
    if !on {
        return match std::fs::remove_file(&plist) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            r => r,
        };
    }
    let exe = std::env::current_exe()?;
    std::fs::create_dir_all(plist.parent().unwrap())?;
    std::fs::write(
        &plist,
        format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.issasoridev.axemobile</string>
<key>ProgramArguments</key><array><string>{}</string><string>--minimized</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>
"#,
            exe.display()
        ),
    )
}

#[cfg(not(any(windows, target_os = "macos")))]
pub fn set_autostart(on: bool) -> std::io::Result<()> {
    let dir = std::env::var_os("XDG_CONFIG_HOME").map(PathBuf::from).unwrap_or_else(|| home().join(".config")).join("autostart");
    let file = dir.join("axemobile.desktop");
    if !on {
        return match std::fs::remove_file(&file) {
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
            r => r,
        };
    }
    let exe = std::env::current_exe()?;
    std::fs::create_dir_all(&dir)?;
    std::fs::write(
        &file,
        format!("[Desktop Entry]\nType=Application\nName=AxeMobile\nExec=\"{}\" --minimized\nX-GNOME-Autostart-enabled=true\n", exe.display()),
    )
}

pub fn notify(title: &str, body: &str) {
    let title = title.to_string();
    let body = body.to_string();
    // the toast call can block for a moment; keep it off the UI thread
    std::thread::spawn(move || {
        let _ = notify_rust::Notification::new().appname("AxeMobile").summary(&title).body(&body).show();
    });
}
