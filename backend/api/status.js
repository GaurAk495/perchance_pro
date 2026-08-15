import admin from '../utils/firebaseAdmin.js';

export default async function handler(req, res) {
    // Enable CORS for the shared checkout page (auto-perchance.vercel.app)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'GET') {
        return res.status(405).send('Method Not Allowed');
    }

    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
        }

        const idToken = authHeader.split('Bearer ')[1];

        // Verify Firebase Token (perchance-pro project)
        let decodedToken;
        try {
            decodedToken = await admin.auth().verifyIdToken(idToken);
        } catch (e) {
            console.error('Firebase Token Verification Failed:', e.message);
            return res.status(401).json({ error: 'Unauthorized: Token validation failed', details: e.message });
        }

        const uid = decodedToken.uid;

        // Fetch user plan from Firestore
        const db = admin.firestore();
        const userDoc = await db.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(200).json({ isPremium: false });
        }

        const userData = userDoc.data();
        let isPremium = userData.isPremium || userData.premium || false;
        let plan = userData.plan || 'none';

        // Check if monthly plan has expired (valid for 30 days)
        if (plan === 'monthly' && userData.monthlyStartedAt) {
            const startDate = new Date(userData.monthlyStartedAt);
            const expiryDate = new Date(startDate.getTime() + 30 * 24 * 60 * 60 * 1000);
            if (new Date() > expiryDate) {
                isPremium = false;
                plan = 'none';

                // Sync the expired state to Firestore and Custom Claims
                try {
                    await db.collection('users').doc(uid).update({
                        isPremium: false,
                        premium: false,
                    });
                    await admin.auth().setCustomUserClaims(uid, {
                        premium: false,
                        plan: 'monthly',
                        planActivatedAt: userData.planActivatedAt || null
                    });
                } catch (updateErr) {
                    console.error('Failed to update expired status for user:', uid, updateErr);
                }
            }
        }

        return res.status(200).json({
            isPremium,
            plan
        });

    } catch (error) {
        console.error('Fetch Status Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
