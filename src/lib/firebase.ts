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

// Initialize Firestore with force long-polling and memory cache for highest network reliability
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalForceLongPolling: true,
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
    // Graceful background verification
    const testDoc = doc(db, 'settings', 'general');
    await getDocFromServer(testDoc).catch(() => {
      // Gracefully handle initial offline / cold-start state without unhandled error
    });
  } catch {
    // Non-blocking offline tolerance
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
    }, 2000);
  }
}


