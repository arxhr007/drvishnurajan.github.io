// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAf9MPruEYJCgWO6hEaVQsYHwgo5ZCDTwU",
  authDomain: "sahrdayacps.firebaseapp.com",
  databaseURL: "https://sahrdayacps-default-rtdb.firebaseio.com",
  projectId: "sahrdayacps",
  storageBucket: "sahrdayacps.firebasestorage.app",
  messagingSenderId: "578057227870",
  appId: "1:578057227870:web:05fe0f83ea4bd27039eecf",
  measurementId: "G-KXX9VSKPC9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and export it
export const db = getDatabase(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
