// Embeds the release AxeMobile.exe (built first) and gives the installer
// its icon and an asInvoker manifest, so Windows doesn't ask for admin just
// because the file name says "Setup".
fn main() {
    let exe = std::env::var("AXEMOBILE_EXE").unwrap_or_else(|_| "../../target/release/AxeMobile.exe".into());
    let path = std::path::Path::new(&exe);
    let abs = if path.is_absolute() { path.to_path_buf() } else { std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join(path) };
    if !abs.exists() {
        panic!("{} not found: run `cargo build --release -p axe-desktop` first", abs.display());
    }
    println!("cargo:rustc-env=AXEMOBILE_PAYLOAD={}", abs.display());
    println!("cargo:rerun-if-changed={}", abs.display());
    println!("cargo:rerun-if-env-changed=AXEMOBILE_EXE");
    #[cfg(windows)]
    {
        let mut res = winresource::WindowsResource::new();
        res.set_icon("../axe-desktop/assets/icon.ico");
        res.set("ProductName", "AxeMobile Setup");
        res.set("FileDescription", "AxeMobile Setup");
        res.set("CompanyName", "IsSasoriDev");
        res.set_manifest(
            r#"<assembly xmlns="urn:schemas-microsoft-com:asm.v1" manifestVersion="1.0">
<trustInfo xmlns="urn:schemas-microsoft-com:asm.v3"><security><requestedPrivileges>
<requestedExecutionLevel level="asInvoker" uiAccess="false"/>
</requestedPrivileges></security></trustInfo>
</assembly>"#,
        );
        res.compile().expect("windows resources");
    }
}
