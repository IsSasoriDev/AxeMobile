import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.edu.axe',
  appName: 'AxeMobile',
  webDir: 'dist',
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