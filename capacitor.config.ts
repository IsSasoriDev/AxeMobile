import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.edu.axe',
  appName: 'AxeMobile',
  webDir: 'dist',
  // Allow HTTP requests to local network miners (BitAxe/NerdAxe/Avalon)
  // Default Android scheme is https://localhost which blocks cleartext fetches
  // to http://192.168.x.x devices as mixed content. Switching to http scheme
  // + cleartext fixes the network scanner on Android.
  server: {
    androidScheme: 'http',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    },
    LocalNotifications: {
      smallIcon: "ic_stat_icon",
      iconColor: "#FF6B00",
      sound: "notification.wav"
    }
  }
};

export default config;
