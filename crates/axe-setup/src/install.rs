//! What the installer does on disk: per-user install into
//! %LOCALAPPDATA%\Programs\AxeMobile, Start menu and desktop shortcuts, an
//! entry in Apps & features, and the matching uninstall.

use std::path::{Path, PathBuf};
use std::process::Command;

pub const VERSION: &str = env!("CARGO_PKG_VERSION");
const UNINSTALL_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Uninstall\AxeMobile";
const RUN_KEY: &str = r"Software\Microsoft\Windows\CurrentVersion\Run";
pub const PAYLOAD: &[u8] = include_bytes!(env!("AXEMOBILE_PAYLOAD"));

#[derive(Clone)]
pub struct Options {
    pub dir: PathBuf,
    pub desktop: bool,
    pub start_menu: bool,
}

pub fn default_dir() -> PathBuf {
    let base = std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\AxeMobile"));
    base.join("Programs").join("AxeMobile")
}

fn env_dir(var: &str) -> PathBuf {
    std::env::var_os(var).map(PathBuf::from).unwrap_or_default()
}

#[cfg(windows)]
fn desktop_dir() -> PathBuf {
    use winreg::enums::HKEY_CURRENT_USER;
    use winreg::RegKey;
    // the Desktop can be redirected (OneDrive); ask the shell folders key
    let k = RegKey::predef(HKEY_CURRENT_USER).open_subkey(r"Software\Microsoft\Windows\CurrentVersion\Explorer\Shell Folders");
    if let Ok(k) = k {
        if let Ok(p) = k.get_value::<String, _>("Desktop") {
            return PathBuf::from(p);
        }
    }
    env_dir("USERPROFILE").join("Desktop")
}

fn start_menu_dir() -> PathBuf {
    env_dir("APPDATA").join(r"Microsoft\Windows\Start Menu\Programs")
}

pub fn data_dir() -> PathBuf {
    env_dir("APPDATA").join("AxeMobile")
}

pub fn installed_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let k = RegKey::predef(HKEY_CURRENT_USER).open_subkey(UNINSTALL_KEY).ok()?;
        let p: String = k.get_value("InstallLocation").ok()?;
        return Some(PathBuf::from(p));
    }
    #[allow(unreachable_code)]
    None
}

fn stop_running() {
    let _ = Command::new("taskkill").args(["/F", "/IM", "AxeMobile.exe"]).output();
    std::thread::sleep(std::time::Duration::from_millis(400));
}

#[cfg(windows)]
fn shortcut(target: &Path, at: &Path) -> std::io::Result<()> {
    let mut sl = mslnk::ShellLink::new(target).map_err(|e| std::io::Error::other(e.to_string()))?;
    sl.set_working_dir(target.parent().map(|p| p.display().to_string()));
    sl.set_icon_location(Some(target.display().to_string()));
    sl.set_name(Some("AxeMobile".into()));
    sl.create_lnk(at).map_err(|e| std::io::Error::other(e.to_string()))
}

/// Runs the install, reporting progress (0..1) and a status line.
pub fn install(o: &Options, progress: &dyn Fn(f32, &str)) -> Result<PathBuf, String> {
    progress(0.05, "Closing AxeMobile if it is running");
    stop_running();
    progress(0.15, "Creating the install folder");
    std::fs::create_dir_all(&o.dir).map_err(|e| format!("Can't create {}: {e}", o.dir.display()))?;
    let exe = o.dir.join("AxeMobile.exe");
    progress(0.30, "Copying AxeMobile.exe");
    std::fs::write(&exe, PAYLOAD).map_err(|e| format!("Can't write {}: {e}", exe.display()))?;
    progress(0.55, "Adding the uninstaller");
    let me = std::env::current_exe().map_err(|e| e.to_string())?;
    let uninst = o.dir.join("Uninstall AxeMobile.exe");
    if me != uninst {
        std::fs::copy(&me, &uninst).map_err(|e| format!("Can't write the uninstaller: {e}"))?;
    }
    #[cfg(windows)]
    {
        progress(0.70, "Creating shortcuts");
        if o.start_menu {
            shortcut(&exe, &start_menu_dir().join("AxeMobile.lnk")).map_err(|e| format!("Start menu shortcut: {e}"))?;
        }
        if o.desktop {
            shortcut(&exe, &desktop_dir().join("AxeMobile.lnk")).map_err(|e| format!("Desktop shortcut: {e}"))?;
        }
        progress(0.85, "Registering with Apps & features");
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let (k, _) = RegKey::predef(HKEY_CURRENT_USER).create_subkey(UNINSTALL_KEY).map_err(|e| e.to_string())?;
        let s = |n: &str, v: String| k.set_value(n, &v).map_err(|e| e.to_string());
        s("DisplayName", "AxeMobile".into())?;
        s("DisplayVersion", VERSION.into())?;
        s("Publisher", "IsSasoriDev".into())?;
        s("DisplayIcon", format!("{},0", exe.display()))?;
        s("InstallLocation", o.dir.display().to_string())?;
        s("UninstallString", format!("\"{}\" --uninstall", uninst.display()))?;
        s("QuietUninstallString", format!("\"{}\" --uninstall --quiet", uninst.display()))?;
        s("URLInfoAbout", "https://github.com/IsSasoriDev/AxeMobile".into())?;
        let _ = k.set_value("NoModify", &1u32);
        let _ = k.set_value("NoRepair", &1u32);
        let _ = k.set_value("EstimatedSize", &((PAYLOAD.len() as u32) / 1024 * 2));
    }
    progress(1.0, "Done");
    Ok(exe)
}

pub fn launch(exe: &Path) {
    let _ = Command::new(exe).current_dir(exe.parent().unwrap_or(Path::new("."))).spawn();
}

/// Removes the app. The running uninstaller can't delete itself, so a
/// short-lived cmd removes the folder a moment after we exit.
pub fn uninstall(dir: &Path, remove_data: bool, progress: &dyn Fn(f32, &str)) -> Result<(), String> {
    progress(0.1, "Closing AxeMobile");
    stop_running();
    progress(0.3, "Removing shortcuts");
    let _ = std::fs::remove_file(start_menu_dir().join("AxeMobile.lnk"));
    #[cfg(windows)]
    let _ = std::fs::remove_file(desktop_dir().join("AxeMobile.lnk"));
    progress(0.5, "Removing the app");
    let _ = std::fs::remove_file(dir.join("AxeMobile.exe"));
    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hk = RegKey::predef(HKEY_CURRENT_USER);
        let _ = hk.delete_subkey_all(UNINSTALL_KEY);
        if let Ok(run) = hk.open_subkey_with_flags(RUN_KEY, winreg::enums::KEY_SET_VALUE) {
            let _ = run.delete_value("AxeMobile");
        }
    }
    if remove_data {
        progress(0.75, "Deleting your data");
        let _ = std::fs::remove_dir_all(data_dir());
    }
    progress(0.9, "Cleaning up");
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        // raw_arg: cmd.exe does its own quote parsing, Rust's escaping breaks it
        let _ = Command::new("cmd")
            .raw_arg(format!("/C ping 127.0.0.1 -n 3 > nul & rmdir /s /q \"{}\"", dir.display()))
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    progress(1.0, "Done");
    Ok(())
}
