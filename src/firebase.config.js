// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCDKhIQpZCw7zrwjyGe3n2g3xyqX5g5-zM",
  authDomain: "cps-sahrdaya.firebaseapp.com",
  databaseURL: "https://cps-sahrdaya-default-rtdb.firebaseio.com",
  projectId: "cps-sahrdaya",
  storageBucket: "cps-sahrdaya.firebasestorage.app",
  messagingSenderId: "202864487390",
  appId: "1:202864487390:web:311ff3994c61c3e6428b4f",
  measurementId: "G-XBCC4PNG7G"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Realtime Database and export it
export const db = getDatabase(app);

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
