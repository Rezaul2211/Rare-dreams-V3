import { create } from 'zustand';
import { User } from '../types';
import { auth, db } from '../lib/firebase';
import { onAuthStateChanged, signOut as firebaseSignOut } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { fetchUserRole } from '../lib/roles';
import { safeLocalStorageGetItem, safeLocalStorageSetItem, safeLocalStorageRemoveItem } from '../lib/safeStorage';

interface AuthState {
  user: User | null;
  loading: boolean;
  setUser: (user: User | null) => void;
  setLoading: (loading: boolean) => void;
  initialize: () => void;
  logout: () => Promise<void>;
  updateUserProfile: (data: Partial<User>) => Promise<void>;
}

const ADMIN_EMAIL = 'xmrezaul.karim998@gmail.com';

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  loading: true,
  setUser: (user) => {
    if (user) {
      safeLocalStorageSetItem('rare_dreams_user', JSON.stringify(user));
    } else {
      safeLocalStorageRemoveItem('rare_dreams_user');
    }
    set({ user });
  },
  setLoading: (loading) => set({ loading }),
  logout: async () => {
    // Clear user state and cached local storage immediately
    safeLocalStorageRemoveItem('rare_dreams_user');
    set({ user: null, loading: false });

    try {
      if (auth.currentUser) {
        await firebaseSignOut(auth);
      }
    } catch (e) {
      // Silently handle any browser IndexedDB closure or unmounting errors
      console.warn("Notice on logout signout:", e);
    }
  },
  updateUserProfile: async (data: Partial<User>) => {
    const currentUser = get().user;
    if (!currentUser) return;
    const updatedUser: User = { ...currentUser, ...data };
    set({ user: updatedUser });
    safeLocalStorageSetItem('rare_dreams_user', JSON.stringify(updatedUser));
    
    // Sync with Firestore
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await setDoc(userRef, data, { merge: true });
    } catch (err) {
      console.error("Error updating profile in Firestore:", err);
    }
  },
  initialize: () => {
    // First load from localStorage for instant response on custom domains like Vercel
    const cachedUser = safeLocalStorageGetItem('rare_dreams_user');
    if (cachedUser) {
      try {
        const parsed = JSON.parse(cachedUser);
        if (parsed && parsed.uid) {
          set({ user: parsed, loading: false });
        }
      } catch (e) {
        console.error("Error parsing cached user", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          const userRef = doc(db, 'users', firebaseUser.uid);
          const userDoc = await getDoc(userRef);
          
          const existingData = userDoc.exists() ? userDoc.data() : null;
          const role = await fetchUserRole(
            firebaseUser.email || '', 
            firebaseUser.uid, 
            existingData?.role
          );

          if (userDoc.exists()) {
            const data = userDoc.data();
            if (data.role !== role) {
              setDoc(userRef, { role }, { merge: true }).catch(console.error);
            }

            const activeUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || data.email || '',
              displayName: data.displayName || firebaseUser.displayName || 'User',
              phoneNumber: data.phoneNumber || '',
              photoURL: data.photoURL || firebaseUser.photoURL || '',
              role: role,
              addresses: data.addresses || [],
              paymentMethods: data.paymentMethods || [],
              createdAt: data.createdAt || new Date()
            };

            safeLocalStorageSetItem('rare_dreams_user', JSON.stringify(activeUser));
            set({ user: activeUser, loading: false });
          } else {
            const newUser: User = {
              uid: firebaseUser.uid,
              email: firebaseUser.email || '',
              displayName: firebaseUser.displayName || 'User',
              phoneNumber: '',
              photoURL: firebaseUser.photoURL || '',
              role: role,
              addresses: [],
              paymentMethods: [],
              createdAt: new Date()
            };
            
            setDoc(userRef, newUser).catch(console.error);
            safeLocalStorageSetItem('rare_dreams_user', JSON.stringify(newUser));
            set({ user: newUser, loading: false });
          }
        } catch (error) {
          console.error("Error fetching user role", error);
          const role = await fetchUserRole(firebaseUser.email || '', firebaseUser.uid);
          const fallbackUser: User = {
            uid: firebaseUser.uid,
            email: firebaseUser.email || '',
            displayName: firebaseUser.displayName || 'User',
            role: role,
            createdAt: new Date()
          };
          safeLocalStorageSetItem('rare_dreams_user', JSON.stringify(fallbackUser));
          set({ user: fallbackUser, loading: false });
        }
      } else {
        // If firebase auth emits null on transient refresh, check if localStorage user exists
        const existingCache = safeLocalStorageGetItem('rare_dreams_user');
        if (existingCache) {
          try {
            const parsed = JSON.parse(existingCache);
            if (parsed && parsed.uid) {
              set({ user: parsed, loading: false });
              return;
            }
          } catch (e) {
            console.error("Error restoring cached user on null auth state", e);
          }
        }
        set({ user: null, loading: false });
      }
    });
    return unsubscribe;
  }
}));

