import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { firebaseAuth } from "./firebase";
import { unregisterFromUpdateNotifications } from "./updateNotifications";
import type { UserProfile } from "@/types/case";
import { Platform } from "react-native";

import { GOOGLE_WEB_CLIENT_ID } from "@/config/firebaseConfig";

const googleWebClientId = GOOGLE_WEB_CLIENT_ID;

/**
 * Initialize Google Sign-In
 */
export async function initializeGoogleSignIn(): Promise<void> {
  try {
    if (Platform.OS === "web") {
      return;
    }

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
    if (Platform.OS === "web") {
      throw new Error("Google Sign-In is available in the Android app.");
    }

    await GoogleSignin.signOut().catch(() => {}); // Clear any previous sign-in state
    const userInfo = await GoogleSignin.signIn();
    
    if (!userInfo.idToken) {
      throw new Error("No ID token received from Google Sign-In");
    }

    const credential = auth.GoogleAuthProvider.credential(userInfo.idToken);
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
    const userCredential = await firebaseAuth.signInWithEmailAndPassword(
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
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
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
    // Remove the authenticated user's device record while the Firestore rules
    // still recognize this session. This prevents a later update broadcast from
    // reaching a device after it has been signed out.
    await unregisterFromUpdateNotifications(firebaseAuth.currentUser?.uid);

    // Sign out from Google if signed in via Google
    try {
      await GoogleSignin.signOut();
    } catch (e) {
      // Ignore if not signed in via Google
    }

    // Sign out from Firebase
    await firebaseAuth.signOut();
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
    await firebaseAuth.sendPasswordResetEmail(email);
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
