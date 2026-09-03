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
  persistentLocalCache,
  persistentMultipleTabManager,
  memoryLocalCache,
  doc,
  getDoc
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

// Initialize Firestore with persistent IndexedDB multi-tab cache and auto-detect long polling
let firestoreDb: any;
try {
  firestoreDb = initializeFirestore(
    app,
    {
      experimentalAutoDetectLongPolling: true,
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      })
    },
    databaseId
  );
} catch (err1) {
  try {
    // Fallback if IndexedDB multi-tab is restricted (e.g. private browsing or existing instance)
    firestoreDb = initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
        localCache: memoryLocalCache()
      },
      databaseId
    );
  } catch (err2) {
    try {
      firestoreDb = getFirestore(app, databaseId);
    } catch (err3) {
      console.warn("Firestore initialization fallback:", err3);
      firestoreDb = getFirestore(app);
    }
  }
}

export const db = firestoreDb;
export const storage = getStorage(app);



