import * as functions from 'firebase-functions/v2';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

if (!getApps().length) {
  initializeApp();
}

const db = getFirestore();

/**
 * Firebase Cloud Function: Track Product Price Changes
 * Triggers automatically whenever a product document in the 'products' collection is updated.
 */
export const onProductPriceUpdate = onDocumentUpdated(
  'products/{productId}',
  async (event) => {
    const beforeData = event.data?.before.data();
    const afterData = event.data?.after.data();
    const productId = event.params.productId;

    if (!beforeData || !afterData) {
      console.log(`No data available for product ${productId}`);
      return;
    }

    const oldPrice = Number(beforeData.price || 0);
    const newPrice = Number(afterData.price || 0);

    // Check if price has dropped
    if (newPrice < oldPrice && newPrice > 0) {
      const priceDifference = oldPrice - newPrice;
      const discountPercentage = Math.round((priceDifference / oldPrice) * 100);
      const productName = afterData.name || 'Exclusive Fashion Item';
      const productImage = afterData.images?.[0] || '';

      console.log(
        `🎉 Price drop detected for product "${productName}" (${productId}): ৳${oldPrice} -> ৳${newPrice} (-${discountPercentage}%)`
      );

      try {
        // Query all active price drop subscriptions for this product
        const alertsSnapshot = await db
          .collection('price_alerts')
          .where('productId', '==', productId)
          .where('status', '==', 'active')
          .get();

        if (alertsSnapshot.empty) {
          console.log(`No active subscriptions found for product ${productId}`);
          return;
        }

        console.log(`Found ${alertsSnapshot.size} active subscriber(s) to notify.`);

        const batch = db.batch();
        const notificationPromises: Promise<any>[] = [];

        alertsSnapshot.docs.forEach((docSnapshot) => {
          const alertData = docSnapshot.data();
          const targetPrice = Number(alertData.targetPrice || oldPrice);

          // Check if the new price satisfies the user's target price condition
          if (newPrice <= targetPrice || !alertData.targetPrice) {
            // 1. Mark subscription status as triggered
            batch.update(docSnapshot.ref, {
              status: 'triggered',
              notifiedPrice: newPrice,
              notifiedAt: FieldValue.serverTimestamp(),
              updatedAt: FieldValue.serverTimestamp()
            });

            // 2. Create in-app user notification
            const notifRef = db.collection('notifications').doc();
            batch.set(notifRef, {
              id: notifRef.id,
              userId: alertData.userId || null,
              userEmail: alertData.userEmail || null,
              userPhone: alertData.userPhone || null,
              type: 'price_drop',
              title: `🔥 মূল্য হ্রাস! ${productName}`,
              message: `আপনার পছন্দের "${productName}" এর দাম ৳${oldPrice} থেকে কমে এখন মাত্র ৳${newPrice} (-${discountPercentage}% ছাড়)! স্টক সীমিত, এখনই অর্ডার করুন।`,
              productId: productId,
              productName: productName,
              productImage: productImage,
              oldPrice: oldPrice,
              newPrice: newPrice,
              discountPercentage: discountPercentage,
              url: `/product/${productId}`,
              read: false,
              createdAt: FieldValue.serverTimestamp()
            });

            console.log(
              `Notifying subscriber: ${alertData.userEmail || alertData.userPhone} for target ৳${targetPrice}`
            );
          }
        });

        await batch.commit();
        console.log(`Successfully dispatched price drop notifications for product ${productId}`);
      } catch (error) {
        console.error(`Error processing price drop notifications for ${productId}:`, error);
      }
    } else {
      console.log(`Price did not drop for product ${productId}. (Old: ৳${oldPrice}, New: ৳${newPrice})`);
    }
  }
);

/**
 * Callable/HTTP Function to manually trigger price drop verification
 */
export const checkPriceDrops = functions.https.onRequest(async (req, res) => {
  try {
    const { productId, newPrice, oldPrice } = req.body;
    if (!productId || newPrice === undefined) {
      res.status(400).json({ error: 'Missing productId or newPrice' });
      return;
    }

    const productDoc = await db.collection('products').doc(productId).get();
    if (!productDoc.exists) {
      res.status(404).json({ error: 'Product not found' });
      return;
    }

    const product = productDoc.data()!;
    const effectiveOldPrice = oldPrice || product.comparePrice || (newPrice * 1.2);
    const discountPercentage = Math.round(((effectiveOldPrice - newPrice) / effectiveOldPrice) * 100);

    const alertsSnapshot = await db
      .collection('price_alerts')
      .where('productId', '==', productId)
      .where('status', '==', 'active')
      .get();

    const batch = db.batch();
    let notifiedCount = 0;

    alertsSnapshot.docs.forEach((docSnapshot) => {
      const alert = docSnapshot.data();
      if (!alert.targetPrice || newPrice <= alert.targetPrice) {
        batch.update(docSnapshot.ref, {
          status: 'triggered',
          notifiedPrice: newPrice,
          notifiedAt: FieldValue.serverTimestamp()
        });

        const notifRef = db.collection('notifications').doc();
        batch.set(notifRef, {
          id: notifRef.id,
          userId: alert.userId || null,
          userEmail: alert.userEmail || null,
          userPhone: alert.userPhone || null,
          type: 'price_drop',
          title: `🔥 মূল্য হ্রাস! ${product.name}`,
          message: `আপনার পছন্দের "${product.name}" এর দাম কমে এখন মাত্র ৳${newPrice}!`,
          productId,
          productName: product.name,
          productImage: product.images?.[0] || '',
          oldPrice: effectiveOldPrice,
          newPrice,
          discountPercentage,
          url: `/product/${productId}`,
          read: false,
          createdAt: FieldValue.serverTimestamp()
        });
        notifiedCount++;
      }
    });

    if (notifiedCount > 0) {
      await batch.commit();
    }

    res.json({ success: true, notifiedCount });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});
