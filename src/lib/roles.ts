import { doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
import { db } from './firebase';

export const SUPER_ADMIN_EMAIL = 'xmrezaul.karim998@gmail.com';

/**
 * Checks if a given email is granted admin or seller role.
 */
export async function fetchUserRole(email: string, userUid?: string, existingRole?: string): Promise<'admin' | 'seller' | 'customer'> {
  const cleanEmail = (email || '').toLowerCase().trim();
  
  if (cleanEmail === SUPER_ADMIN_EMAIL) {
    return 'admin';
  }

  // Check authorized_roles collection first
  try {
    if (cleanEmail) {
      const authRoleDoc = await getDoc(doc(db, 'authorized_roles', cleanEmail));
      if (authRoleDoc.exists()) {
        const data = authRoleDoc.data();
        if (data.role === 'admin' || data.role === 'seller') {
          return data.role;
        }
      }
    }
  } catch (e) {
    console.warn("Could not check authorized_roles collection:", e);
  }

  if (existingRole === 'admin' || existingRole === 'seller') {
    return existingRole;
  }

  // Check users collection if userUid provided
  if (userUid) {
    try {
      const uDoc = await getDoc(doc(db, 'users', userUid));
      if (uDoc.exists()) {
        const role = uDoc.data().role;
        if (role === 'admin' || role === 'seller') {
          return role;
        }
      }
    } catch (e) {
      console.warn("Could not check user doc role:", e);
    }
  }

  return 'customer';
}

/**
 * Assigns role to an email address in authorized_roles AND updates any matching user doc.
 */
export async function assignUserRoleByEmail(email: string, role: 'admin' | 'seller' | 'customer') {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) throw new Error("Email is required");

  // 1. Save in authorized_roles collection
  const authRoleRef = doc(db, 'authorized_roles', cleanEmail);
  await setDoc(authRoleRef, {
    email: cleanEmail,
    role: role,
    updatedAt: new Date()
  }, { merge: true });

  // 2. Query matching users in 'users' collection and update role
  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    const updates = snap.docs.map(userDoc => 
      updateDoc(doc(db, 'users', userDoc.id), { role: role })
    );
    await Promise.all(updates);
  } catch (e) {
    console.warn("Could not update users collection for email:", cleanEmail, e);
  }
}

/**
 * Revokes role from an email address
 */
export async function revokeUserRoleByEmail(email: string) {
  const cleanEmail = email.toLowerCase().trim();
  if (!cleanEmail) return;

  try {
    // Delete from authorized_roles
    const authRoleRef = doc(db, 'authorized_roles', cleanEmail);
    await setDoc(authRoleRef, { role: 'customer' }, { merge: true });
  } catch (e) {
    console.warn("Could not update authorized_roles for revoke:", e);
  }

  try {
    const q = query(collection(db, 'users'), where('email', '==', cleanEmail));
    const snap = await getDocs(q);
    const updates = snap.docs.map(userDoc => 
      updateDoc(doc(db, 'users', userDoc.id), { role: 'customer' })
    );
    await Promise.all(updates);
  } catch (e) {
    console.warn("Could not update users collection for revoke:", e);
  }
}
