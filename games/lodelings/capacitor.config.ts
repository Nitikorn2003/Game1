import { existsSync } from 'node:fs';
import type { CapacitorConfig } from '@capacitor/cli';

// The Firebase plugin stops the app at start without the Firebase project's google-services.json,
// so a build without one leaves it out: the game then runs with test ads and without sign-in,
// cloud saves or purchases. The Capacitor CLI runs in this folder.
const firebase = existsSync('android/app/google-services.json');

/**
 * The Android app around the web build in dist/. Run `npm run android:sync` after every web
 * change; see ANDROID.md for building and releasing.
 */
const config: CapacitorConfig = {
  // The Java package of the app's own code. The id on Google Play is applicationId in
  // android/release.properties, so it can be chosen before release.
  appId: 'com.game1.lodelings',
  appName: 'Lodelings',
  webDir: 'dist',
  backgroundColor: '#0b0807',
  android: {
    // The web build never loads plain http content.
    allowMixedContent: false,
    includePlugins: [
      '@capacitor-community/admob',
      '@capacitor/app',
      '@game1/capacitor-billing',
      ...(firebase ? ['@capacitor-firebase/authentication'] : []),
    ],
  },
  plugins: {
    FirebaseAuthentication: {
      // Sign in on the Android side too, so the Firebase ID token comes from the native SDK.
      skipNativeAuth: false,
      providers: ['google.com'],
    },
  },
};

export default config;
