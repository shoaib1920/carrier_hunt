import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDs2psEdWjHFre8lY9DIvzvmLpZl95flr0",
  authDomain: "career-bridge-678b0.firebaseapp.com",
  projectId: "career-bridge-678b0",
  storageBucket: "career-bridge-678b0.firebasestorage.app",
  messagingSenderId: "710863430647",
  appId: "1:710863430647:web:0ab0f88116e49714f244f2",
  measurementId: "G-MPY7QKGG28"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;