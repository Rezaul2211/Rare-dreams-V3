import * as functions from 'firebase-functions/v2';
import { onDocumentCreated } from 'firebase-functions/v2/firestore';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

const db = getFirestore();

export const onOrderCreated = onDocumentCreated(
  {
    document: 'orders/{orderId}',
    database: 'ai-studio-52c30446-74a2-476d-a811-4a823b07db28'
  },
  async (event) => {
    const orderData = event.data?.data();
    if (!orderData) {
      console.log('No order data found.');
      return;
    }

    const orderId = event.params.orderId;
    const customerName = orderData.customerName || orderData.name || 'New Customer';
    const totalAmount = orderData.total || 0;

    console.log(`🎉 New order received: ${orderId} by ${customerName}`);

    // Idempotency check: look if this order has already been processed for notifications
    if (orderData.pushNotified) {
      console.log(`Order ${orderId} already notified. Skipping.`);
      return;
    }

    try {
      // 1. Get admin tokens from fcm_tokens collection
      const tokensSnap = await db.collection('fcm_tokens')
        .where('role', 'in', ['admin', 'seller', 'superadmin'])
        .get();

      if (tokensSnap.empty) {
        console.log('No admin tokens found in fcm_tokens collection.');
        return;
      }

      const tokens: string[] = [];
      const invalidTokens: string[] = [];

      tokensSnap.forEach(doc => {
        const d = doc.data();
        if (d.token && typeof d.token === 'string' && d.token.length > 20) {
          tokens.push(d.token);
        }
      });

      if (tokens.length === 0) {
        console.log('No valid admin FCM tokens found.');
        return;
      }

      console.log(`Found ${tokens.length} admin token(s). Sending FCM pushes...`);

      // 2. Prepare Notification Payload with proper webpush configuration
      const message = {
        notification: {
          title: `🛍️ New Order: ৳${totalAmount}`,
          body: `Order #${orderId.slice(0, 8)} placed by ${customerName}.`,
        },
        data: {
          orderId: orderId,
          url: `/admin/orders`
        },
        webpush: {
          notification: {
            icon: '/pwa-192x192.png',
            badge: '/favicon-32x32.png',
            vibrate: [350, 120, 350, 120, 350],
            requireInteraction: true,
            tag: `order_${orderId}`,
            renotify: true
          },
          fcmOptions: {
            link: '/admin/orders'
          }
        },
        tokens: tokens,
      };

      // 3. Send Multicast Message
      const response = await getMessaging().sendEachForMulticast(message);
      
      console.log(`Successfully sent ${response.successCount} messages; ${response.failureCount} failed.`);

      // 4. Cleanup invalid tokens
      if (response.failureCount > 0) {
        const batch = db.batch();
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            const error = resp.error;
            if (error?.code === 'messaging/invalid-registration-token' ||
                error?.code === 'messaging/registration-token-not-registered') {
              const failedToken = tokens[idx];
              console.log(`Removing invalid token: ${failedToken}`);
              invalidTokens.push(failedToken);
            }
          }
        });

        if (invalidTokens.length > 0) {
          const cleanupSnap = await db.collection('fcm_tokens')
            .where('token', 'in', invalidTokens)
            .get();
          cleanupSnap.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }

      // 5. Mark order as notified
      await event.data?.ref.update({
        pushNotified: true,
        notifiedAt: new Date().toISOString()
      });

    } catch (error) {
      console.error('Error sending order notification:', error);
    }
  }
);
