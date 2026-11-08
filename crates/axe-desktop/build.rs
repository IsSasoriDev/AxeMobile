// Puts the icon and version info into AxeMobile.exe.
fn main() {
    #[cfg(windows)]
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("windows") {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("assets/icon.ico");
        res.set("ProductName", "AxeMobile");
        res.set("FileDescription", "AxeMobile");
        res.set("CompanyName", "IsSasoriDev");
        res.set("LegalCopyright", "IsSasoriDev, MIT licence");
        res.compile().expect("windows resources");
    }
}
