import { getPricingData } from '../utils/pricingData.js';

export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Credentials', true);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        const pricingData = await getPricingData();
        return res.status(200).json({
            ...pricingData,
            razorpayKey: process.env.RAZORPAY_KEY_ID
        });
    } catch (error) {
        console.error('Pricing API Error:', error);
        return res.status(500).json({ error: 'Internal Server Error' });
    }
}
