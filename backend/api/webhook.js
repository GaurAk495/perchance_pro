import crypto from 'crypto';
import admin from '../utils/firebaseAdmin.js';

const APP_NAME = 'perchance_pro';

// Disable standard Vercel body parser to properly verify Razorpay signature bytes
export const config = {
    api: {
        bodyParser: false,
    },
};

const getRawBody = async (req) => {
    const chunks = [];
    for await (const chunk of req) {
        chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const rawBody = await getRawBody(req);
        const signature = req.headers['x-razorpay-signature'];
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;

        // Verify Razorpay Webhook Signature
        const expectedSignature = crypto
            .createHmac('sha256', secret)
            .update(rawBody)
            .digest('hex');

        if (signature !== expectedSignature) {
            return res.status(400).json({ error: 'Invalid signature. Discarding.' });
        }

        const event = JSON.parse(rawBody);

        // When payment goes through successfully
        if (event.event === 'payment.captured' || event.event === 'order.paid') {
            const paymentEntity = event.payload?.payment?.entity;
            const notes = paymentEntity?.notes;

            if (notes.app !== APP_NAME) {
                console.warn(`Ignored: 'app' note is not '${APP_NAME}'. Value:`, notes.app);
                return res.status(200).send('Ignored');
            }

            const uid = paymentEntity?.notes?.uid || null;
            const plan = paymentEntity?.notes?.plan || 'lifetime'; // 'monthly' | 'lifetime'
            const paymentId = paymentEntity?.id || null;
            const orderId = paymentEntity?.order_id || null;
            const amount = paymentEntity?.amount || 0;  // in paise
            const currency = paymentEntity?.currency || 'INR';

            if (uid) {
                console.log(`Granting premium [${plan}] to UID: ${uid}`);

                const userEmail = paymentEntity?.notes?.email || 'unknown';
                const paymentEmail = paymentEntity?.email || 'unknown';

                // 1. Set Firebase Custom Claims (used by extension for instant unlock)
                await admin.auth().setCustomUserClaims(uid, {
                    premium: true,
                    plan,                             // 'monthly' or 'lifetime'
                    planActivatedAt: Date.now(),
                });

                // 2. Upsert user record in Firestore → users/{uid}
                const db = admin.firestore();
                const now = new Date().toISOString();

                try {
                    await db.collection('users').doc(uid).set({
                        uid,
                        userEmail,
                        paymentEmail,
                        premium: true,
                        isPremium: true,
                        plan,
                        updatedAt: now,
                        ...(plan === 'lifetime' ? { lifetimePurchasedAt: now } : {}),
                        ...(plan === 'monthly' ? { monthlyStartedAt: now } : {}),
                    }, { merge: true });

                    // 3. Append to transactions log → transactions/{paymentId}
                    await db.collection('transactions').doc(paymentId || `txn_${Date.now()}`).set({
                        uid,
                        userEmail,
                        paymentEmail,
                        plan,
                        paymentId,
                        orderId,
                        amount,        // paise — divide by 100 in admin UI
                        currency,
                        status: 'paid',
                        createdAt: now,
                    });

                    console.log(`Stored transaction + user record for ${uid} (${plan})`);
                } catch (dbErr) {
                    // Don't fail the webhook — custom claims already activated the account
                    console.error('Firestore write failed:', dbErr);
                }
            } else {
                console.warn('Payment captured but NO UID found in notes!');
            }
        }

        return res.status(200).json({ status: 'ok' });
    } catch (error) {
        console.error('Webhook Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
