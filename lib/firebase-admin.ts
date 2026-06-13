import * as admin from 'firebase-admin';

function getApp(): admin.app.App {
  if (admin.apps.length > 0) {
    return admin.apps[0]!;
  }

  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!privateKey || !clientEmail || !projectId) {
    // During build time env vars may not be available — skip initialization
    // The app will fail at runtime if these are truly missing
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[firebase-admin] Missing env vars — skipping initialization');
    }
    // Return a dummy to prevent crash during Next.js build static analysis
    return admin.apps[0] as admin.app.App;
  }

  return admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

function getDb() {
  try {
    const app = getApp();
    if (!app) return null;
    return admin.firestore(app);
  } catch {
    return null;
  }
}

function getAuth() {
  try {
    const app = getApp();
    if (!app) return null;
    return admin.auth(app);
  } catch {
    return null;
  }
}

function getStorage() {
  try {
    const app = getApp();
    if (!app) return null;
    return admin.storage(app);
  } catch {
    return null;
  }
}

// Lazy getters — won't crash during build if env vars are missing
export const adminDb = new Proxy({} as admin.firestore.Firestore, {
  get(_, prop) {
    const db = getDb();
    if (!db) throw new Error('[firebase-admin] Firestore not initialized. Check FIREBASE_* env vars on Vercel.');
    return (db as any)[prop];
  }
});

export const adminAuth = new Proxy({} as admin.auth.Auth, {
  get(_, prop) {
    const auth = getAuth();
    if (!auth) throw new Error('[firebase-admin] Auth not initialized. Check FIREBASE_* env vars on Vercel.');
    return (auth as any)[prop];
  }
});

export const adminStorage = new Proxy({} as admin.storage.Storage, {
  get(_, prop) {
    const storage = getStorage();
    if (!storage) throw new Error('[firebase-admin] Storage not initialized. Check FIREBASE_* env vars on Vercel.');
    return (storage as any)[prop];
  }
});
