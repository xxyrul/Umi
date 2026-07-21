import { initializeApp } from "@react-native-firebase/app";
import { getAuth, onAuthStateChanged, User } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";

// Firebase is initialized automatically via the google-services.json plugin
// in app.json when using @react-native-firebase/app

export const firebaseApp = initializeApp();
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDB = getFirestore(firebaseApp);

export { onAuthStateChanged };
export type { User };
