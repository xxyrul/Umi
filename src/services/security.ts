import * as LocalAuthentication from "expo-local-authentication";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

const APP_LOCK_ENABLED_KEY = "@umi_app_lock_enabled";
const BIOMETRICS_ENABLED_KEY = "@umi_biometrics_enabled";
const APP_LOCK_PIN_KEY = "@umi_app_lock_pin";

async function getSecurePin(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(APP_LOCK_PIN_KEY);
  } catch {
    return null;
  }
}

async function setSecurePin(pin: string): Promise<void> {
  await SecureStore.setItemAsync(APP_LOCK_PIN_KEY, pin, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

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

/**
 * Get stored 4-digit PIN
 */
export async function getAppLockPin(): Promise<string | null> {
  try {
    const securePin = await getSecurePin();
    if (securePin) return securePin;

    // Backward compatibility migration from AsyncStorage
    const legacyPin = await AsyncStorage.getItem(APP_LOCK_PIN_KEY);
    if (legacyPin) {
      await setSecurePin(legacyPin);
      await AsyncStorage.removeItem(APP_LOCK_PIN_KEY);
      return legacyPin;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Set stored 4-digit PIN
 */
export async function setAppLockPin(pin: string): Promise<void> {
  try {
    const normalizedPin = (pin || "").trim();
    if (!/^\d{4}$/.test(normalizedPin)) {
      throw new Error("PIN must be exactly 4 digits");
    }

    await setSecurePin(normalizedPin);
    await AsyncStorage.removeItem(APP_LOCK_PIN_KEY);
  } catch (error) {
    console.error("Error saving PIN:", error);
    throw error;
  }
}

/**
 * Verify input PIN against stored PIN
 */
export async function verifyAppLockPin(inputPin: string): Promise<boolean> {
  try {
    const storedPin = await getAppLockPin();
    if (!storedPin) return false;
    return storedPin === inputPin;
  } catch {
    return false;
  }
}

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
