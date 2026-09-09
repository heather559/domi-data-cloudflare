import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.heatherdomi.domidata',
  appName: 'Domi Data',
  webDir: 'dist',
  server: {
    // Remote mode: the native shell loads the live published site so
    // content/data changes ship without an App Store resubmission.
    // Swap to a bundled build by removing `server.url` and running
    // `bun run build` + `npx cap sync ios`.
    url: 'https://domidata.heatherdomi.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
    backgroundColor: '#f5efe6',
  },
};

export default config;
