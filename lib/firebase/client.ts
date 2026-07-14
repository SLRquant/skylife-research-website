"use client";

import { FirebaseApp, getApp, getApps, initializeApp } from "firebase/app";
import {
  Auth,
  GoogleAuthProvider,
  getAuth,
  signInWithPopup,
  type UserCredential,
} from "firebase/auth";

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

/** Sign in with Google (popup). Throws if Firebase isn't configured. */
export async function signInWithGoogle(): Promise<UserCredential> {
  const auth = getFirebaseAuth();
  if (!auth) throw new Error("Firebase is not configured.");
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  return signInWithPopup(auth, provider);
}

/**
 * Call one of our own /api routes as the signed-in user.
 *
 * Attaches the Firebase ID token; the server verifies it and derives the user's email from the
 * token itself (never from the body), which is what makes the per-email quota unforgeable.
 */
export async function authedFetch(
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  const auth = getFirebaseAuth();
  const headers = new Headers(init.headers);
  const user = auth?.currentUser;
  if (user) headers.set("Authorization", `Bearer ${await user.getIdToken()}`);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  return fetch(path, { ...init, headers });
}
