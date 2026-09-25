// Import the functions you need from the SDKs you need
import { initializeApp, getApps, getApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// ---------------------------------------------------------------------------
// Primary project (sahrdayacps)
// Google sign-in, digital-twin `assets`, `categories` and `soil_monitoring`.
// ---------------------------------------------------------------------------
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

// ---------------------------------------------------------------------------
// Secondary project (rps-sahrdaya)
// Village field telemetry streamed by the Unnat Bharat Abhiyan prototype nodes
// (currently deployed at Puthenchira). Only the Realtime Database is used, so
// the app is initialised with just its URL. Override with VITE_SENSOR_DB_URL in
// a local .env file to point the dashboard at a different instance.
// ---------------------------------------------------------------------------
export const SENSOR_DB_URL = (
  import.meta.env.VITE_SENSOR_DB_URL ||
  "https://rps-sahrdaya-bfe70-default-rtdb.asia-southeast1.firebasedatabase.app"
).replace(/\/+$/, "");

const SENSOR_APP_NAME = "rps-sensors";

const hasApp = (name) => getApps().some((existing) => existing.name === name);

// Initialize Firebase (guarded so Vite hot reloads don't re-create the apps)
const app = hasApp("[DEFAULT]") ? getApp() : initializeApp(firebaseConfig);
const sensorApp = hasApp(SENSOR_APP_NAME)
  ? getApp(SENSOR_APP_NAME)
  : initializeApp({ databaseURL: SENSOR_DB_URL }, SENSOR_APP_NAME);

// Initialize Realtime Databases and export them
export const db = getDatabase(app);          // sahrdayacps: assets / categories / soil_monitoring
export const sensorDb = getDatabase(sensorApp); // rps-sahrdaya: village sensor telemetry + dashboard config

// Additional telemetry databases (see src/data/sensorSources.js). Each URL gets
// its own named Firebase app so listeners and writes go to the right project.
const extraDbs = new Map();
export const getSensorDatabase = (url) => {
  const clean = String(url || "").replace(/\/+$/, "");
  if (!clean || clean === SENSOR_DB_URL) return sensorDb;
  if (extraDbs.has(clean)) return extraDbs.get(clean);
  const name = `sensors-${clean.replace(/[^a-z0-9]/gi, "-").slice(0, 60)}`;
  const extraApp = hasApp(name) ? getApp(name) : initializeApp({ databaseURL: clean }, name);
  const database = getDatabase(extraApp);
  extraDbs.set(clean, database);
  return database;
};

// Initialize Auth
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
