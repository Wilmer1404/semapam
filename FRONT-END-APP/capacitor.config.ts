import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.credwebstudio.waterapp',
  appName: 'WaterApp',
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
    webContentsDebuggingEnabled: false,
    backgroundColor: '#ffffffff'
  }
};

export default config;
