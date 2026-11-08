//! System fonts so the app looks at home on each OS: Segoe UI (+ Segoe MDL2
//! icons) on Windows, Helvetica Neue / Arial on macOS, Noto or DejaVu on
//! Linux. Anything missing falls back to egui's built-in fonts.

use eframe::egui::{self, FontData, FontDefinitions, FontFamily};
use std::path::PathBuf;
use std::sync::Arc;

fn first(paths: &[PathBuf]) -> Option<Vec<u8>> {
    paths.iter().find_map(|p| std::fs::read(p).ok())
}

fn candidates() -> (Vec<PathBuf>, Vec<PathBuf>, Vec<PathBuf>) {
    if cfg!(windows) {
        let dir = std::env::var_os("WINDIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("Fonts");
        (
            vec![dir.join("segoeui.ttf")],
            vec![dir.join("segoeuib.ttf"), dir.join("seguisb.ttf")],
            vec![dir.join("SegoeIcons.ttf"), dir.join("segmdl2.ttf")],
        )
    } else if cfg!(target_os = "macos") {
        let s = PathBuf::from("/System/Library/Fonts/Supplemental");
        (vec![s.join("Arial.ttf")], vec![s.join("Arial Bold.ttf")], vec![])
    } else {
        let roots = ["/usr/share/fonts/truetype", "/usr/share/fonts"];
        let mut reg = vec![];
        let mut bol = vec![];
        for r in roots {
            reg.push(PathBuf::from(r).join("noto/NotoSans-Regular.ttf"));
            reg.push(PathBuf::from(r).join("dejavu/DejaVuSans.ttf"));
            bol.push(PathBuf::from(r).join("noto/NotoSans-Bold.ttf"));
            bol.push(PathBuf::from(r).join("dejavu/DejaVuSans-Bold.ttf"));
        }
        (reg, bol, vec![])
    }
}

pub fn install(ctx: &egui::Context) {
    let mut fonts = FontDefinitions::default();
    let defaults = fonts.families.get(&FontFamily::Proportional).cloned().unwrap_or_default();
    let (reg_paths, bold_paths, icon_paths) = candidates();
    let mut regular = vec![];
    let mut boldf = vec![];
    let mut icons = vec![];
    if let Some(b) = first(&reg_paths) {
        fonts.font_data.insert("ui".into(), Arc::new(FontData::from_owned(b)));
        regular.push("ui".to_string());
    }
    if let Some(b) = first(&bold_paths) {
        fonts.font_data.insert("ui-bold".into(), Arc::new(FontData::from_owned(b)));
        boldf.push("ui-bold".to_string());
    }
    if let Some(b) = first(&icon_paths) {
        fonts.font_data.insert("icons".into(), Arc::new(FontData::from_owned(b)));
        icons.push("icons".to_string());
    }
    #[cfg(windows)]
    let sym: Vec<String> = {
        let dir = std::env::var_os("WINDIR").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(r"C:\Windows")).join("Fonts");
        match std::fs::read(dir.join("seguisym.ttf")) {
            Ok(b) => {
                fonts.font_data.insert("symbols".into(), Arc::new(FontData::from_owned(b)));
                vec!["symbols".to_string()]
            }
            Err(_) => vec![],
        }
    };
    #[cfg(not(windows))]
    let sym: Vec<String> = vec![];

    let chain = |head: &[String]| -> Vec<String> {
        head.iter().cloned().chain(defaults.iter().cloned()).chain(sym.iter().cloned()).chain(icons.iter().cloned()).collect()
    };
    let prop = chain(&regular);
    let bold = chain(&[boldf.clone(), regular.clone()].concat());
    let icon_fam: Vec<String> = icons.iter().cloned().chain(defaults.iter().cloned()).collect();
    fonts.families.insert(FontFamily::Proportional, prop);
    fonts.families.insert(FontFamily::Name("bold".into()), bold);
    fonts.families.insert(FontFamily::Name("icons".into()), icon_fam);
    ctx.set_fonts(fonts);
}
