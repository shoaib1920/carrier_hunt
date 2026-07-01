import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyDs2psEdWjHFre8lY9DIvzvmLpZl95flr0',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'career-bridge-678b0.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'career-bridge-678b0',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'career-bridge-678b0.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '710863430647',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:710863430647:web:0ab0f88116e49714f244f2',
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
