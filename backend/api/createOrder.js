import Razorpay from 'razorpay';
import admin from '../utils/firebaseAdmin.js';
import { getPricingData } from '../utils/pricingData.js';

const APP_NAME = 'perchance_pro';

export default async function handler(req, res) {
    // Enable CORS for Chrome Extension + shared checkout page (auto-perchance.vercel.app)
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader('Access-Control-Allow-Headers', 'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    if (req.method !== 'POST') {
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
        const email = decodedToken.email || 'unknown';

        // Initialize Razorpay
        if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ error: 'Server misconfiguration: Missing Razorpay Keys' });
        }

        const razorpay = new Razorpay({
            key_id: process.env.RAZORPAY_KEY_ID,
            key_secret: process.env.RAZORPAY_KEY_SECRET,
        });

        // Initialize Pricing Data
        const { pricing } = await getPricingData();

        const currency = (req.body?.currency || 'USD').toUpperCase();
        const plan = req.body?.plan || 'lifetime';

        const selectedCurrency = pricing[currency] ? currency : 'USD';
        const planData = pricing[selectedCurrency][plan] || pricing[selectedCurrency].lifetime;
        const amount = planData.amount;
        const label = planData.label;

        const orderOptions = {
            amount,
            currency: selectedCurrency,
            receipt: `rcpt_${uid.substring(0, 5)}_${Date.now()}`,
            payment_capture: 1, // Auto capture
            notes: {
                uid,
                email,
                plan,
                description: label,
                app: APP_NAME
            }
        };

        const order = await razorpay.orders.create(orderOptions);
        return res.status(200).json({ ...order, prefill_email: email });

    } catch (error) {
        console.error('Create Order Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
};
