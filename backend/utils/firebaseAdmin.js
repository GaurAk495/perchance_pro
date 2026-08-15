import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config();

if (!admin.apps.length) {
    try {
        let serviceAccountData = process.env.FIREBASE_SERVICE_ACCOUNT;
        if (!serviceAccountData) {
            console.error("Missing FIREBASE_SERVICE_ACCOUNT env var");
        } else {
            // Clean common formatting issues like backticks or quotes that might be included by mistake in .env
            serviceAccountData = serviceAccountData.trim();
            if (serviceAccountData.startsWith('`') && serviceAccountData.endsWith('`')) {
                serviceAccountData = serviceAccountData.slice(1, -1);
            }

            const serviceAccount = JSON.parse(serviceAccountData);
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount)
            });
            console.log("Firebase Admin SDK Initialized for project:", serviceAccount.project_id);
        }
    } catch (error) {
        console.error("Firebase Admin SDK Initialization Error:", error.message);
    }
}

export default admin;
