# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /sdk/tools/proguard/proguard-android-optimize.txt

# Keep JavaScript interface for Capacitor
-keep class com.getcapacitor.** { *; }
-keep class com.edu.axe.** { *; }

# Keep WebView JavaScript interface
-keepclassmembers class * {
    @android.webkit.JavascriptInterface <methods>;
}

# Capacitor plugins
-keep public class * extends com.getcapacitor.Plugin {
    public <methods>;
}

# Keep annotations
-keepattributes *Annotation*
-keepattributes JavascriptInterface

# Disable warnings for common libraries
-dontwarn com.google.**
-dontwarn org.apache.**
