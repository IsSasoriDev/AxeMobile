# Builds AxeMobile for Windows and wraps it in the installer.
# Output: dist-win\AxeMobile-Setup-<version>.exe (and the bare AxeMobile.exe)
$ErrorActionPreference = "Stop"
Set-Location (Join-Path $PSScriptRoot "..")

$version = (Select-String -Path Cargo.toml -Pattern '^version = "(.+)"' | Select-Object -First 1).Matches[0].Groups[1].Value

cargo build --release -p axe-desktop
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

$env:AXEMOBILE_EXE = (Resolve-Path "target\release\AxeMobile.exe").Path
cargo build --release -p axe-setup
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

New-Item -ItemType Directory -Force dist-win | Out-Null
Copy-Item target\release\AxeMobile.exe dist-win\AxeMobile.exe -Force
Copy-Item target\release\AxeMobile-Setup.exe "dist-win\AxeMobile-Setup-$version.exe" -Force
Get-ChildItem dist-win | Format-Table Name, @{n="MB"; e={[math]::Round($_.Length / 1MB, 1)}}
