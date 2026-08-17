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

// Initialize Firebase Auth with graceful persistence hierarchy
let authInstance: any;
try {
  authInstance = initializeAuth(app, {
    persistence: [indexedDBLocalPersistence, browserLocalPersistence, browserSessionPersistence, inMemoryPersistence]
  });
} catch {
  authInstance = getAuth(app);
}

export const auth = authInstance;

const databaseId = firebaseConfig.firestoreDatabaseId || undefined;

// Initialize Firestore with memory cache or safe fallback to prevent IndexedDB closing/hidden crashes in iframes
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


