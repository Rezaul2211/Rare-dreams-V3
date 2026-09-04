const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const serviceAccount = require('./firebase-applet-config.json');

initializeApp({
  projectId: serviceAccount.projectId
});

const db = getFirestore();
db.settings({ databaseId: 'ai-studio-52c30446-74a2-476d-a811-4a823b07db28' });

async function check() {
  const allOrders = await db.collection('orders').get();
  console.log('Total orders:', allOrders.size);
  
  const orderedOrders = await db.collection('orders').orderBy('createdAt', 'desc').get();
  console.log('Total orders with createdAt:', orderedOrders.size);
}

check().catch(console.error);
