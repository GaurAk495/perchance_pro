import fetch from 'node-fetch';

const BASE_PRICES = {
    monthly: 6.99, // USD
    lifetime: 39.99 // USD
};

const DEFAULT_RATE = 95.48; // Fallback USD to INR

export async function getExchangeRate() {
    try {
        const response = await fetch('https://open.er-api.com/v6/latest/USD');
        const data = await response.json();
        if (data.result === 'success' && data.rates && data.rates.INR) {
            return data.rates.INR;
        }
    } catch (error) {
        console.error('Failed to fetch exchange rate:', error);
    }
    return DEFAULT_RATE;
}

export async function getPricingData() {
    const rate = await getExchangeRate();

    return {
        rate,
        pricing: {
            USD: {
                symbol: "$",
                monthly: {
                    amount: Math.round(BASE_PRICES.monthly * 100),
                    display: BASE_PRICES.monthly.toString(),
                    label: `Monthly Plan — $${BASE_PRICES.monthly}/mo`
                },
                lifetime: {
                    amount: Math.round(BASE_PRICES.lifetime * 100),
                    display: BASE_PRICES.lifetime.toString(),
                    label: `Lifetime Access — $${BASE_PRICES.lifetime} once`
                }
            },
            INR: {
                symbol: "₹",
                monthly: {
                    amount: Math.round(BASE_PRICES.monthly * rate * 100),
                    display: Math.round(BASE_PRICES.monthly * rate).toString(),
                    label: `Monthly Plan — ₹${Math.round(BASE_PRICES.monthly * rate)}/mo`
                },
                lifetime: {
                    amount: Math.round(BASE_PRICES.lifetime * rate * 100),
                    display: Math.round(BASE_PRICES.lifetime * rate).toString(),
                    label: `Lifetime Access — ₹${Math.round(BASE_PRICES.lifetime * rate)} once`
                }
            }
        }
    };
}
