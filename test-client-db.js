import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, query, orderBy } from "firebase/firestore";
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function run() {
  try {
    const q1 = query(collection(db, 'orders'));
    const snap1 = await getDocs(q1);
    console.log('Without orderBy:', snap1.size);

    const q2 = query(collection(db, 'orders'), orderBy('createdAt', 'desc'));
    const snap2 = await getDocs(q2);
    console.log('With orderBy:', snap2.size);
  } catch (err) {
    console.error('Error:', err.message);
  }
  process.exit(0);
}
run();
