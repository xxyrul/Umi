import firebase from "firebase/compat/app";
import "firebase/compat/auth";
import "firebase/compat/firestore";
import {
  FIREBASE_API_KEY,
  FIREBASE_PROJECT_ID,
  FIREBASE_STORAGE_BUCKET,
  FIREBASE_MESSAGING_SENDER_ID,
  FIREBASE_APP_ID,
} from "@/config/firebaseConfig";

const firebaseConfig = {
  apiKey: FIREBASE_API_KEY,
  authDomain: FIREBASE_PROJECT_ID ? `${FIREBASE_PROJECT_ID}.firebaseapp.com` : undefined,
  projectId: FIREBASE_PROJECT_ID,
  storageBucket: FIREBASE_STORAGE_BUCKET,
  messagingSenderId: FIREBASE_MESSAGING_SENDER_ID,
  appId: FIREBASE_APP_ID,
};

if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const webAuth = firebase.auth();
const webFirestore = firebase.firestore();

// Keep the same service shape as the native implementation so screens can
// render in the browser without changing the Android Firebase path.
export const firebaseAuth = webAuth;
export const firebaseDB = webFirestore;

export const onAuthStateChanged = (
  _authInstance: firebase.auth.Auth,
  listener: (user: firebase.User | null) => void,
) => webAuth.onAuthStateChanged(listener);

export type User = firebase.User;

export const auth = () => webAuth;
export const firestore = () => webFirestore;