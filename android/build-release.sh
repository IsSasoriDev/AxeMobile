#!/bin/bash
# AxeMobile Android Release Build Script
# Run from project root: bash android/build-release.sh

set -e

echo "🔧 Building web assets..."
npm run build

echo "📱 Syncing Capacitor..."
npx cap sync android

echo "📦 Building release AAB..."
cd android
./gradlew bundleRelease

echo ""
echo "✅ Release bundle built successfully!"
echo "📍 Output: android/app/build/outputs/bundle/release/app-release.aab"
echo ""
echo "Upload this file to Google Play Console → Production → Create new release"
