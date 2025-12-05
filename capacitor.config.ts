import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.eduionita.axemobile',
  appName: 'AxeMobile',
  webDir: 'dist',
  server: {
    url: 'http://localhost:3000/',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;
