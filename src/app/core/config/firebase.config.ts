import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';

declare global {
  interface Window {
    __FIREBASE_CONFIG__?: FirebaseOptions;
  }
}

let appPromise: Promise<FirebaseApp> | null = null;

async function resolveFirebaseConfig(): Promise<FirebaseOptions> {
  if (typeof window !== 'undefined' && window.__FIREBASE_CONFIG__?.apiKey) {
    return window.__FIREBASE_CONFIG__;
  }

  if (typeof fetch === 'undefined') {
    throw new Error('Firebase no esta configurado para este entorno.');
  }

  const response = await fetch('/__/firebase/init.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('No se pudo cargar la configuracion de Firebase Hosting.');
  }

  return response.json() as Promise<FirebaseOptions>;
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
  return getAuth(await getFirebaseApp());
}
