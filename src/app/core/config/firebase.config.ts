import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, initializeAuth, browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence, browserPopupRedirectResolver, type Auth } from 'firebase/auth';

const DEFAULT_FIREBASE_CONFIG: FirebaseOptions = {
  apiKey: 'AIzaSyAA4Rf0vlYVR-8F7KVnMO00n2xxrUzGo7k',
  authDomain: 'cotizapp-d71c8.firebaseapp.com',
  projectId: 'cotizapp-d71c8',
  storageBucket: 'cotizapp-d71c8-catalog-assets',
  messagingSenderId: '246026823431',
  appId: '1:246026823431:web:2f62b8ed20a8af1f94c7a2'
};

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseOptions;
  }
}

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;

async function resolveFirebaseConfig(): Promise<FirebaseOptions> {
  if (typeof window === 'undefined') {
    return DEFAULT_FIREBASE_CONFIG;
  }

  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__?.apiKey) {
    return window.__FIREBASE_CONFIG__;
  }

  if (typeof fetch === 'undefined') {
    return DEFAULT_FIREBASE_CONFIG;
  }

  try {
    const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
    if (response.ok) {
      const hostingConfig = await response.json() as FirebaseOptions;
      const { measurementId: _unusedMeasurementId, ...configWithoutAnalytics } = hostingConfig;
      return {
        ...configWithoutAnalytics,
        storageBucket: DEFAULT_FIREBASE_CONFIG.storageBucket
      };
    }
  } catch {
    // Use the configured project when Firebase Hosting auto-configuration is unavailable.
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export async function getFirebaseApp(): Promise<FirebaseApp> {
  if (getApps().length > 0) {
    return getApp();
  }

  if (!appPromise) {
    appPromise = resolveFirebaseConfig().then((config) => initializeApp(config));
  }

  return appPromise;
}

export async function getFirebaseAuthInstance(): Promise<Auth> {
  if (!authPromise) authPromise = getFirebaseApp().then(app => {
    if (typeof window === 'undefined') return getAuth(app);
    // Match the localStorage persistence selected by login/register. Firebase's
    // default IndexedDB-first order migrates and removes that key in a new tab,
    // which signs out tabs still listening to localStorage. Retain IndexedDB as
    // a legacy fallback while keeping every new tab on the same preference.
    return initializeAuth(app, {
      persistence: [browserLocalPersistence, browserSessionPersistence, indexedDBLocalPersistence],
      popupRedirectResolver: browserPopupRedirectResolver
    });
  });
  return authPromise;
}
