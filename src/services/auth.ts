import auth from "@react-native-firebase/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import { firebaseAuth, firebaseDB } from "./firebase";
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
 * Check if a user is an existing registered user or new user, and check suspension
 */
export async function isUserRegistrationComplete(uid: string): Promise<{ isRegistered: boolean; isSuspended: boolean }> {
  try {
    const doc = await firebaseDB.collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data?.status === "SUSPENDED") {
        return { isRegistered: false, isSuspended: true };
      }
      // Existing user account already active in the system
      return { isRegistered: true, isSuspended: false };
    }
  } catch (e) {
    console.warn("Could not check user registration status:", e);
  }
  return { isRegistered: false, isSuspended: false };
}

export async function checkUserRegistrationStatus(uid: string): Promise<{ isRegistered: boolean; userDoc?: any }> {
  const res = await isUserRegistrationComplete(uid);
  return { isRegistered: res.isRegistered };
}

import { validateInviteCodeOnly, claimInviteCodeOnly } from "./inviteCodes";

/**
 * Completes Google registration by validating and claiming the required invite code
 */
export async function completeGoogleRegistration(
  uid: string,
  email: string,
  displayName: string,
  inviteCode: string
): Promise<{ success: boolean; code: string }> {
  // 1. Validate invite code first (read-only, outside transaction)
  const { code: validatedCode, isMaster } = await validateInviteCodeOnly(inviteCode);

  // 2. Atomically create user doc + claim the invite code in a single transaction.
  //    If either step fails, both are rolled back — no orphaned states.
  await firebaseDB.runTransaction(async (transaction) => {
    const userRef = firebaseDB.collection("users").doc(uid);

    transaction.set(
      userRef,
      {
        uid,
        email,
        displayName,
        registeredWithCode: validatedCode,
        role: "agent",
        updatedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      { merge: true }
    );

    // Claim single-use codes inside the same transaction
    if (!isMaster) {
      const codeRef = firebaseDB.collection("invite_codes").doc(validatedCode);
      transaction.update(codeRef, {
        status: "USED",
        usedBy: email,
        usedByName: displayName,
        usedAt: new Date().toISOString(),
      });
    }
  });

  // Master code metadata update is best-effort (non-critical)
  if (isMaster) {
    await claimInviteCodeOnly(validatedCode, email, displayName, true).catch(() => {});
  }

  return { success: true, code: validatedCode };
}

/**
 * Sign in with Google
 */
export async function signInWithGoogle(): Promise<{ userProfile: UserProfile; isRegistered: boolean }> {
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

    // Check if this Google user is already a registered agent in Firestore
    const { isRegistered } = await checkUserRegistrationStatus(userCredential.user.uid);

    const userProfile: UserProfile = {
      uid: userCredential.user.uid,
      email: userCredential.user.email || "",
      displayName: userCredential.user.displayName || "Agent",
      photoURL: userCredential.user.photoURL || undefined,
    };

    return { userProfile, isRegistered };
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
 * Create account with email, password, and required invite code
 */
export async function signUpWithEmail(
  email: string,
  password: string,
  displayName: string,
  inviteCode: string
): Promise<UserProfile> {
  // 1. Validate invite code BEFORE creating account (does not consume it yet)
  const { code: validatedCode, isMaster } = await validateInviteCodeOnly(inviteCode);

  try {
    const userCredential = await firebaseAuth.createUserWithEmailAndPassword(
      email,
      password
    );

    // Update display name
    await userCredential.user.updateProfile({
      displayName,
    });

    // Dispatch email verification link (silently in background)
    userCredential.user.sendEmailVerification().catch(() => {});

    // Atomically create user doc + claim invite code in a single transaction
    try {
      await firebaseDB.runTransaction(async (transaction) => {
        const userRef = firebaseDB.collection("users").doc(userCredential.user.uid);

        transaction.set(
          userRef,
          {
            uid: userCredential.user.uid,
            email: userCredential.user.email || email,
            displayName: displayName,
            registeredWithCode: validatedCode,
            role: "agent",
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );

        // Claim single-use codes inside the same transaction
        if (!isMaster) {
          const codeRef = firebaseDB.collection("invite_codes").doc(validatedCode);
          transaction.update(codeRef, {
            status: "USED",
            usedBy: email,
            usedByName: displayName,
            usedAt: new Date().toISOString(),
          });
        }
      });
    } catch (dbError) {
      console.warn("Could not sync user profile to Firestore:", dbError);
    }

    // Master code metadata update is best-effort
    if (isMaster) {
      await claimInviteCodeOnly(validatedCode, email, displayName, true).catch(() => {});
    }

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
 * Check if the user has an admin role in Firestore
 */
export async function getUserRole(uid: string): Promise<"admin" | "agent"> {
  try {
    const doc = await firebaseDB.collection("users").doc(uid).get();
    if (doc.exists) {
      const data = doc.data();
      if (data?.role === "admin") {
        return "admin";
      }
    }
  } catch (e) {
    console.warn("Could not fetch user role:", e);
  }
  return "agent";
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
