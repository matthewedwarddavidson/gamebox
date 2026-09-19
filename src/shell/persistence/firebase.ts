// Firebase configuration and lazy singletons. Config comes from `VITE_FIREBASE_*`
// environment variables (publishable web keys — security lives in Firestore
// rules, not the key). When the required variables are absent, the app runs in
// local-only guest mode with no sign-in UI, so nothing breaks in dev/CI/tests.
//
// The Firebase SDK itself is loaded via dynamic `import()` so it is code-split
// into a separate chunk. Guests (and unconfigured dev/CI builds) never download
// it — it's only fetched the first time cloud auth or storage is actually used.

import type { FirebaseApp } from 'firebase/app';
import type { Auth } from 'firebase/auth';
import type { Firestore } from 'firebase/firestore';

interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  appId: string;
  storageBucket?: string;
  messagingSenderId?: string;
}

function readConfig(): FirebaseConfig | null {
  const env = import.meta.env;
  const apiKey = env.VITE_FIREBASE_API_KEY;
  const authDomain = env.VITE_FIREBASE_AUTH_DOMAIN;
  const projectId = env.VITE_FIREBASE_PROJECT_ID;
  const appId = env.VITE_FIREBASE_APP_ID;
  if (!apiKey || !authDomain || !projectId || !appId) return null;
  return {
    apiKey,
    authDomain,
    projectId,
    appId,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  };
}

const config = readConfig();

/** Whether the app has enough config to offer cloud accounts. */
export function isFirebaseConfigured(): boolean {
  return config !== null;
}

let appPromise: Promise<FirebaseApp> | null = null;
let authPromise: Promise<Auth> | null = null;
let dbPromise: Promise<Firestore> | null = null;

function getApp(): Promise<FirebaseApp> {
  if (!config) return Promise.reject(new Error('Firebase is not configured.'));
  if (!appPromise) {
    appPromise = import('firebase/app').then(({ initializeApp }) => initializeApp(config));
  }
  return appPromise;
}

export function getFirebaseAuth(): Promise<Auth> {
  if (!authPromise) {
    authPromise = Promise.all([import('firebase/auth'), getApp()]).then(([{ getAuth }, app]) =>
      getAuth(app),
    );
  }
  return authPromise;
}

export function getFirebaseDb(): Promise<Firestore> {
  if (!dbPromise) {
    // `ignoreUndefinedProperties` lets records with optional (undefined) fields
    // — e.g. an in-progress game with no `score` yet — be written as-is.
    dbPromise = Promise.all([import('firebase/firestore'), getApp()]).then(
      ([{ initializeFirestore }, app]) =>
        initializeFirestore(app, { ignoreUndefinedProperties: true }),
    );
  }
  return dbPromise;
}
