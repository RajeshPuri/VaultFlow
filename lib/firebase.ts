
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
// Added missing firestore and storage imports
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBXwcy2PQ3yYx2bCHUJly5nxgNZ5yB61fY",
  authDomain: "voltflow-e5fe3.firebaseapp.com",
  projectId: "voltflow-e5fe3",
  storageBucket: "voltflow-e5fe3.firebasestorage.app",
  messagingSenderId: "438783464299",
  appId: "1:438783464299:web:3872180601e6906762f22e",
  measurementId: "G-N12J46RLR1"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
export const auth = getAuth(app);

// Added: Initialize and export Firestore (db) for use in components like FileVersionModal
export const db = getFirestore(app);

// Added: Initialize and export Storage for use in components like FileVersionModal
export const storage = getStorage(app);
