import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";
import * as Crypto from "expo-crypto";

const APP_LOCK_ENABLED_KEY = "@umi_app_lock_enabled";
const BIOMETRICS_ENABLED_KEY = "@umi_biometrics_enabled";

// Legacy AsyncStorage key — used only to migrate away from plaintext storage.
const LEGACY_APP_LOCK_PIN_ASYNC_KEY = "@umi_app_lock_pin";

// Secure store key for the hashed PIN (stored as "hash:salt").
const APP_LOCK_PIN_SECURE_KEY = "umi_app_lock_pin_hash";

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Hash a PIN with the given hex salt using SHA-256.
 * Returns the hex digest string.
 */
async function hashPin(pin: string, saltHex: string): Promise<string> {
  return Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    pin + saltHex,
    { encoding: Crypto.CryptoEncoding.HEX }
  );
}

/**
 * Generate a random 16-byte hex salt.
 */
async function generateSalt(): Promise<string> {
  const bytes = Crypto.getRandomBytes(16);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ---------------------------------------------------------------------------
// Migration
// ---------------------------------------------------------------------------

/**
 * One-time migration: if a plaintext PIN exists in AsyncStorage, re-hash it
 * into SecureStore and remove the plaintext entry.
 * Called lazily on first PIN read/verify.
 */
async function migrateFromAsyncStorageIfNeeded(): Promise<void> {
  try {
    const legacyPin = await AsyncStorage.getItem(LEGACY_APP_LOCK_PIN_ASYNC_KEY);
    if (!legacyPin) return;

    // Only migrate if no hashed PIN is already in SecureStore.
    const existing = await SecureStore.getItemAsync(APP_LOCK_PIN_SECURE_KEY);
    if (!existing) {
      const salt = await generateSalt();
      const hash = await hashPin(legacyPin, salt);
      await SecureStore.setItemAsync(APP_LOCK_PIN_SECURE_KEY, `${hash}:${salt}`);
    }

    // Remove the plaintext entry regardless.
    await AsyncStorage.removeItem(LEGACY_APP_LOCK_PIN_ASYNC_KEY);
  } catch {
    // Migration failure is non-fatal; the user may need to re-enroll their PIN.
  }
}

// ---------------------------------------------------------------------------
// Biometric hardware
// ---------------------------------------------------------------------------

/**
 * Check if the device hardware supports biometric authentication
 */
export async function isBiometricSupported(): Promise<boolean> {
  try {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    return hasHardware && isEnrolled;
  } catch (error) {
    return false;
  }
}

// ---------------------------------------------------------------------------
// App Lock enabled flag
// ---------------------------------------------------------------------------

/**
 * Get whether App Lock (PIN) is enabled
 */
export async function getAppLockEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(APP_LOCK_ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/**
 * Save App Lock setting
 */
export async function setAppLockEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(APP_LOCK_ENABLED_KEY, enabled ? "true" : "false");
  } catch (error) {
    console.error("Error saving app lock setting:", error);
  }
}

// ---------------------------------------------------------------------------
// Biometrics enabled flag
// ---------------------------------------------------------------------------

/**
 * Get whether Biometric Unlock is enabled
 */
export async function getBiometricsEnabled(): Promise<boolean> {
  try {
    const val = await AsyncStorage.getItem(BIOMETRICS_ENABLED_KEY);
    return val === "true";
  } catch {
    return false;
  }
}

/**
 * Save Biometrics setting
 */
export async function setBiometricsEnabled(enabled: boolean): Promise<void> {
  try {
    await AsyncStorage.setItem(BIOMETRICS_ENABLED_KEY, enabled ? "true" : "false");
  } catch (error) {
    console.error("Error saving biometrics setting:", error);
  }
}

// ---------------------------------------------------------------------------
// PIN management — backed by expo-secure-store with SHA-256 hash+salt
// ---------------------------------------------------------------------------

/**
 * Returns the raw stored value (hash:salt) from SecureStore, or null if no
 * PIN has been enrolled. Callers should treat any non-null return as "PIN is
 * set" without inspecting the actual hash.
 *
 * Also triggers a one-time migration away from the legacy plaintext
 * AsyncStorage entry.
 */
export async function getAppLockPin(): Promise<string | null> {
  await migrateFromAsyncStorageIfNeeded();
  try {
    return await SecureStore.getItemAsync(APP_LOCK_PIN_SECURE_KEY);
  } catch {
    return null;
  }
}

/**
 * Hash and store a new PIN in SecureStore using a fresh random salt.
 * The plaintext PIN is never persisted.
 */
export async function setAppLockPin(pin: string): Promise<void> {
  try {
    const salt = await generateSalt();
    const hash = await hashPin(pin, salt);
    await SecureStore.setItemAsync(APP_LOCK_PIN_SECURE_KEY, `${hash}:${salt}`);

    // Ensure no leftover plaintext entry exists.
    await AsyncStorage.removeItem(LEGACY_APP_LOCK_PIN_ASYNC_KEY);
  } catch (error) {
    console.error("Error saving PIN:", error);
  }
}

/**
 * Verify an input PIN against the stored hash.
 *
 * Returns false (deny) when:
 *  - no PIN is enrolled (prevents bypass via cleared storage)
 *  - the hash comparison fails
 *  - any error occurs
 */
export async function verifyAppLockPin(inputPin: string): Promise<boolean> {
  try {
    const stored = await getAppLockPin();
    if (!stored) {
      // No PIN enrolled — deny access rather than silently granting it.
      return false;
    }

    const separatorIndex = stored.lastIndexOf(":");
    if (separatorIndex === -1) {
      // Malformed entry — deny.
      return false;
    }

    const storedHash = stored.substring(0, separatorIndex);
    const salt = stored.substring(separatorIndex + 1);
    const inputHash = await hashPin(inputPin, salt);

    return inputHash === storedHash;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Biometric authentication
// ---------------------------------------------------------------------------

/**
 * Trigger native Fingerprint / FaceID prompt
 */
export async function authenticateBiometric(promptMessage: string = "Unlock Umi CaseFlow"): Promise<boolean> {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: "Use PIN",
      disableDeviceFallback: false,
    });
    return result.success;
  } catch (error) {
    console.error("Biometric authentication error:", error);
    return false;
  }
}
