"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import { Auth, getAuth } from "firebase/auth";

/**
 * Firebase client SDK. Reads NEXT_PUBLIC_* env vars at build time.
 * If env vars are missing (e.g. on first local run without .env.local),
 * auth is disabled gracefully — components treat it as "unauthenticated".
 */

const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export function isFirebaseConfigured(): boolean {
  return Boolean(config.apiKey && config.projectId && config.appId);
}

let appInstance: FirebaseApp | null = null;
let authInstance: Auth | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  if (!isFirebaseConfigured()) return null;
  if (appInstance) return appInstance;
  appInstance = getApps().length ? getApp() : initializeApp(config);
  return appInstance;
}

export function getFirebaseAuth(): Auth | null {
  if (authInstance) return authInstance;
  const app = getFirebaseApp();
  if (!app) return null;
  authInstance = getAuth(app);
  return authInstance;
}
