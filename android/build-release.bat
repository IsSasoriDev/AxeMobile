@echo off
REM AxeMobile Android Release Build Script
REM Run from project root: android\build-release.bat

echo Building web assets...
call npm run build

echo Syncing Capacitor...
call npx cap sync android

echo Building release AAB...
cd android
call gradlew.bat bundleRelease

echo.
echo Release bundle built successfully!
echo Output: android\app\build\outputs\bundle\release\app-release.aab
echo.
echo Upload this file to Google Play Console
