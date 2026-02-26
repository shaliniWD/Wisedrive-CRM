// Firebase configuration for WiseDrive Mechanic App
import { initializeApp, getApps } from 'firebase/app';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyDy3g1mk527uyNwOtYsEKoOzlsznGbpZD4",
  authDomain: "wisedrive-ess-app.firebaseapp.com",
  projectId: "wisedrive-ess-app",
  storageBucket: "wisedrive-ess-app.firebasestorage.app",
  messagingSenderId: "1092481343577",
  appId: "1:1092481343577:web:2976c5a8786a8043f59148",
  measurementId: "G-Z0C2FRF7SB"
};

// Initialize Firebase (singleton pattern)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const storage = getStorage(app);

export { app, storage };
export default firebaseConfig;
