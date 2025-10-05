import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.eduionita.eu',
  appName: 'AxeMobile',
  webDir: 'dist',
  server: {
    url: 'eduionita.eu',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;