import { initializeApp, getApps, getApp } from "firebase/app";
import { 
  getAuth, 
  initializeAuth, 
  browserLocalPersistence, 
  browserSessionPersistence, 
  indexedDBLocalPersistence,
  inMemoryPersistence 
} from "firebase/auth";
import { 
  getFirestore, 
  initializeFirestore, 
  memoryLocalCache,
  doc,
  getDocFromServer
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import firebaseConfig from "../../firebase-applet-config.json";

// Initialize or reuse Firebase App
const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase Auth with reliable browser storage persistence hierarchy
let authInstance: any;
try {
  authInstance = initializeAuth(app, {
    persistence: [browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

const databaseId = firebaseConfig.firestoreDatabaseId || undefined;

// Initialize Firestore with auto-detect long-polling and resilient cache
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: memoryLocalCache()
    },
    databaseId
  );
} catch {
  try {
    firestoreDb = getFirestore(app, databaseId);
  } catch (e) {
    console.warn("Firestore initialization fallback:", e);
    firestoreDb = getFirestore(app);
  }
}

export const db = firestoreDb;
export const storage = getStorage(app);

// Connection test helper per Firebase integration guidelines
export async function testFirestoreConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error: any) {
    if (error?.code === 'unavailable' || (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('unavailable')))) {
      // Normal offline or initial handshake condition - Firestore operates in resilient offline mode
    } else {
      console.warn("Firestore connection check:", error?.message || error);
    }
  }
}

// Safely execute non-blocking connection check after window load/idle
if (typeof window !== 'undefined') {
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => {
      testFirestoreConnection();
    });
  } else {
    setTimeout(() => {
      testFirestoreConnection();
    }, 1000);
  }
}


