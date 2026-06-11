# Android Signing Configuration

This directory contains the signing configuration for Play Store releases.

## Setup Steps

### 1. Generate a Keystore

Run this command to generate your release signing key:

```bash
keytool -genkeypair -v -storetype PKCS12 -keystore android/app/release-keystore.jks -alias axemobile -keyalg RSA -keysize 2048 -validity 10000
```

You'll be prompted to set a password and enter your details (name, organization, etc.).

**⚠️ IMPORTANT:** Back up `release-keystore.jks` securely. If you lose it, you cannot update your app on the Play Store.

### 2. Create `keystore.properties`

Create `android/keystore.properties` with your signing details:

```properties
storeFile=app/release-keystore.jks
storePassword=YOUR_STORE_PASSWORD
keyAlias=axemobile
keyPassword=YOUR_KEY_PASSWORD
```

**⚠️ Never commit this file to git.** It's already in `.gitignore`.

### 3. Build the Release Bundle

```bash
cd android
./gradlew bundleRelease
```

The signed `.aab` file will be at:
```
android/app/build/outputs/bundle/release/app-release.aab
```

### 4. Upload to Play Store

1. Go to [Google Play Console](https://play.google.com/console)
2. Create your app listing
3. Upload the `.aab` file under **Production → Create new release**
4. Fill in store listing details, content rating, and pricing
5. Submit for review

## Files Overview

| File | Purpose |
|------|---------|
| `keystore.properties` | Signing credentials (DO NOT commit) |
| `app/release-keystore.jks` | Signing keystore (DO NOT commit) |
| `app/build.gradle` | Configured for release signing |
| `app/proguard-rules.pro` | ProGuard minification rules |
