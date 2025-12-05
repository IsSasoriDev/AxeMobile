import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.911e8d2b9f86490dabb8122918eb7a16',
  appName: 'axe-miner-hub',
  webDir: 'dist',
  server: {
    url: 'https://911e8d2b-9f86-490d-abb8-122918eb7a16.lovableproject.com?forceHideBadge=true',
    cleartext: true
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 0
    }
  }
};

export default config;