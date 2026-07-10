import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.credwebstudio.waterapp',
  appName: 'SEMAPAM',
  webDir: 'www',
  bundledWebRuntime: false,
  plugins: {
    SplashScreen: {
      launchShowDuration: 0,
      launchAutoHide: true,
      showSpinner: false,
      backgroundColor: '#ffffffff'
    }
  },
  android: {
    allowMixedContent: true,
    minWebViewVersion: 66,
    webContentsDebuggingEnabled: true,
    backgroundColor: '#ffffffff'
  }
};

export default config;
