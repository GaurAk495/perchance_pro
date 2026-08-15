import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signOut as firebaseSignOut,
} from 'firebase/auth/web-extension';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyDBIWb0Wsf4hiapfrLK18Vf6m_AJK945TE',
  authDomain: 'perchance-pro.firebaseapp.com',
  projectId: 'perchance-pro',
  storageBucket: 'perchance-pro.firebasestorage.app',
  messagingSenderId: '52923835846',
  appId: '1:52923835846:web:136977d57648ab8a1bfec7',
};
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export { GoogleAuthProvider, signInWithCredential, firebaseSignOut };
