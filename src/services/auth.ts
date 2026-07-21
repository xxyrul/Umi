import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
} from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { firebaseAuth, firebaseApp } from "./firebase";
import type { UserProfile } from "@/types/case";

// Extract web client ID from google-services.json
import googleServicesJson from "../../google-services.json";

const googleWebClientId = googleServicesJson.client[0]?.oauth_client?.find(
  (oc: any) => oc.client_type === 3
)?.client_id || "";

/**
 * Initialize Google Sign-In
 */
export async function initializeGoogleSignIn(): Promise<void> {
  try {
    if (!googleWebClientId) {
      console.warn("Google Web Client ID not found in google-services.json");
      return;
    }

    GoogleSignin.configure({
      webClientId: googleWebClientId,
      offlineAccess: true,
      iosClientId: undefined, // Optional: Add iOS client ID if available
    });
  } catch (error) {
    console.error("Error initializing Google Sign-In:", error);
  }
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<UserProfile> {
  try {
    await GoogleSignin.signOut(); // Clear any previous sign-in state
    const userInfo = await GoogleSignin.signIn();
    
    if (!userInfo.data?.idToken) {
      throw new Error("No ID token received from Google Sign-In");
    }

    const credential = firebaseAuth.GoogleAuthProvider.credential(
      userInfo.data.idToken
    );

    const userCredential = await firebaseAuth.signInWithCredential(credential);

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email || "",
      displayName: userCredential.user.displayName || "User",
      photoURL: userCredential.user.photoURL || undefined,
    };
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
}

/**
 * Sign in with email and password
 */
export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserProfile> {
  try {
    const userCredential = await signInWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email || "",
      displayName: userCredential.user.displayName || "User",
      photoURL: userCredential.user.photoURL || undefined,
    };
  } catch (error) {
    console.error("Error signing in with email:", error);
    throw error;
  }
}

/**
 * Create account with email and password
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string
): Promise<UserProfile> {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      firebaseAuth,
      email,
      password
    );

    // Update display name
    await userCredential.user.updateProfile({
      displayName,
    });

    return {
      uid: userCredential.user.uid,
      email: userCredential.user.email || "",
      displayName: userCredential.user.displayName || displayName,
      photoURL: userCredential.user.photoURL || undefined,
    };
  } catch (error) {
    console.error("Error creating account:", error);
    throw error;
  }
}

/**
 * Sign out the current user
 */
export async function signOut(): Promise<void> {
  try {
    // Sign out from Google if signed in via Google
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in via Google
    }

    // Sign out from Firebase
    await firebaseSignOut(firebaseAuth);
  } catch (error) {
    console.error("Error signing out:", error);
    throw error;
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<void> {
  try {
    await sendPasswordResetEmail(firebaseAuth, email);
  } catch (error) {
    console.error("Error sending password reset email:", error);
    throw error;
  }
}

/**
 * Get current user profile
 */
export function getCurrentUserProfile(): UserProfile | null {
  const user = firebaseAuth.currentUser;
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email || "",
    displayName: user.displayName || "User",
    photoURL: user.photoURL || undefined,
  };
}

/**
 * Get user's initials
 */
export function getUserInitials(displayName: string): string {
  return displayName
    .split(" ")
    .map((n) => n.charAt(0).toUpperCase())
    .join("")
    .slice(0, 2);
}
