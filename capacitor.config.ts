import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eduionita.axemobile',
  appName: 'AxeMobile',
  webDir: 'dist',
  server: {
    url: 'https://127.1.1.0',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;