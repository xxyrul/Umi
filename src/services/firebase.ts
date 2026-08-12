import auth, { FirebaseAuthTypes } from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";

// Native Firebase modules are automatically initialized from google-services.json
export const firebaseAuth = auth();
export const firebaseDB = firestore();

export const onAuthStateChanged = (
  _authInstance: any,
  listener: (user: FirebaseAuthTypes.User | null) => void
) => {
  return auth().onAuthStateChanged(listener);
};

export type User = FirebaseAuthTypes.User;
export { auth, firestore };
