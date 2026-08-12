import React, { useEffect, useState, useRef } from "react";
import * as Sentry from '@sentry/react-native';
import { View, Text, ActivityIndicator, AppState, AppStateStatus, Animated, StatusBar, Button, BackHandler } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, useSegments, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onAuthStateChanged, firebaseAuth, User } from "@/services/firebase";
import { getAppLockEnabled, getBiometricsEnabled, verifyAppLockPin, authenticateBiometric } from "@/services/security";
import { PinKeypad } from "@/components/PinKeypad";
import { AppSettingsProvider, useAppSettings } from "@/context/AppSettingsContext";
import { COLORS } from "@/constants/theme";

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

Sentry.init({
  dsn: 'https://5f6ba69eb0cba92e13ad453f2fb6c628@o4511887279587328.ingest.de.sentry.io/4511887297806416',

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Configure Session Replay
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1,
  integrations: [Sentry.mobileReplayIntegration(), Sentry.feedbackIntegration()],

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: __DEV__,
});

function AuthGuard({ user, authLoaded }: { user: User | null; authLoaded: boolean }) {
  const segments = useSegments() as string[];
  const router = useRouter();
  const [isOnboardingChecked, setIsOnboardingChecked] = useState(false);
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState(false);

  useEffect(() => {
    const checkOnboarding = async () => {
      try {
        const val = await AsyncStorage.getItem("hasCompletedOnboarding");
        setHasCompletedOnboarding(val === "true");
      } catch (e) {
        console.error(e);
      } finally {
        setIsOnboardingChecked(true);
      }
    };
    checkOnboarding();
  }, [segments]);

  useEffect(() => {
    if (!authLoaded || !isOnboardingChecked) return;

    const rootSegment = segments[0];
    const inOnboarding = rootSegment === "onboarding";
    const inTabs = rootSegment === "(tabs)";
    const inCaseRoute = rootSegment === "case";
    const inListingRoute = rootSegment === "listing";
    const inProtectedRoute = inTabs || inCaseRoute || inListingRoute;
    const inLogin = rootSegment === "login";

    if (!hasCompletedOnboarding) {
      if (!inOnboarding) {
        router.replace("/onboarding" as any);
      }
    } else {
      if (!user && inProtectedRoute) {
        router.replace("/login");
      } else if (user && inLogin) {
        router.replace("/(tabs)");
      }
    }
  }, [user, authLoaded, segments, isOnboardingChecked, hasCompletedOnboarding]);

  return null;
}

// App Lock overlay — lives INSIDE AppSettingsProvider so it can read themeColors
function AppLockOverlay({
  isLocked,
  allowBiometrics,
  isUnlockedSuccess,
  pinError,
  onPinSubmit,
  onBiometricSuccess,
}: {
  isLocked: boolean;
  allowBiometrics: boolean;
  isUnlockedSuccess: boolean;
  pinError: string;
  onPinSubmit: (pin: string) => void;
  onBiometricSuccess: () => void;
}) {
  const { themeColors } = useAppSettings();
  const lockOpacity = useRef(new Animated.Value(1)).current;
  const lockScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (isUnlockedSuccess) {
      Animated.parallel([
        Animated.timing(lockOpacity, {
          toValue: 0,
          duration: 400,
          useNativeDriver: true,
        }),
        Animated.timing(lockScale, {
          toValue: 1.08,
          duration: 400,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      lockOpacity.setValue(1);
      lockScale.setValue(1);
    }
  }, [isUnlockedSuccess]);

  if (!isLocked) return null;

  return (
    <Animated.View
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: themeColors.canvasBackground,
        justifyContent: "center",
        alignItems: "center",
        zIndex: 99999,
        opacity: lockOpacity,
        transform: [{ scale: lockScale }],
      }}
    >
      {isUnlockedSuccess ? (
        <View style={{ alignItems: "center" }}>
          <View
            style={{
              width: 96,
              height: 96,
              backgroundColor: themeColors.maroonLight,
              justifyContent: "center",
              alignItems: "center",
              marginBottom: 16,
            }}
          >
            <MaterialCommunityIcons name="lock-open-check-outline" size={54} color={themeColors.maroonPrimary} />
          </View>
          <Text style={{ fontSize: 24, fontWeight: "700", color: themeColors.textPrimary }}>
            Unlocked 🔓
          </Text>
        </View>
      ) : (
        <PinKeypad
          title="Umi is Locked 🔒"
          subtitle={allowBiometrics ? "Scan fingerprint or enter 4-digit PIN" : "Enter your 4-digit PIN to unlock"}
          onPinComplete={onPinSubmit}
          onBiometricSuccess={onBiometricSuccess}
          showBiometricOption={allowBiometrics}
          errorMessage={pinError}
        />
      )}
    </Animated.View>
  );
}

// Inner layout component — uses themeColors for status bar and background
function RootLayoutInner({
  user,
  setUser,
  authLoaded,
  setAuthLoaded,
}: {
  user: User | null;
  setUser: React.Dispatch<React.SetStateAction<User | null>>;
  authLoaded: boolean;
  setAuthLoaded: React.Dispatch<React.SetStateAction<boolean>>;
}) {
  const { themeColors, isDark } = useAppSettings();
  const router = useRouter();
  const segments = useSegments() as string[];

  const [isLocked, setIsLocked] = useState(false);
  const [allowBiometrics, setAllowBiometrics] = useState(false);
  const [pinError, setPinError] = useState("");
  const [isUnlockedSuccess, setIsUnlockedSuccess] = useState(false);

  const appState = useRef(AppState.currentState);
  const userRef = useRef<User | null>(user);
  const backgroundTimeRef = useRef<number | null>(null);

  // Sync user reference
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const triggerUnlockAnimation = () => {
    setIsUnlockedSuccess(true);
    setTimeout(() => {
      setIsLocked(false);
      setIsUnlockedSuccess(false);
    }, 450);
  };

  const checkAndAuthenticate = async () => {
    const lockEnabled = await getAppLockEnabled();
    const bioEnabled = await getBiometricsEnabled();
    setAllowBiometrics(bioEnabled);

    if (lockEnabled) {
      setIsLocked(true);
      setPinError("");
    } else {
      setIsLocked(false);
    }
  };

  const handlePinSubmit = async (inputPin: string) => {
    const valid = await verifyAppLockPin(inputPin);
    if (valid) {
      setPinError("");
      triggerUnlockAnimation();
    } else {
      setPinError("Incorrect PIN. Please try again.");
    }
  };

  const handleBiometricSuccess = () => {
    setPinError("");
    triggerUnlockAnimation();
  };

  // Auto-prompt biometrics when locked
  useEffect(() => {
    if (isLocked && allowBiometrics && !isUnlockedSuccess) {
      const timer = setTimeout(() => {
        authenticateBiometric("Scan Fingerprint to Unlock Umi").then((success) => {
          if (success) handleBiometricSuccess();
        });
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [isLocked, allowBiometrics, isUnlockedSuccess]);

  useEffect(() => {
    let initialCheckDone = false;

    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoaded(true);
      SplashScreen.hideAsync().catch(() => {});

      if (firebaseUser && !initialCheckDone) {
        initialCheckDone = true;
        checkAndAuthenticate();
      }
    });

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "inactive" || nextAppState === "background") {
        backgroundTimeRef.current = Date.now();
      } else if (
        appState.current.match(/inactive|background/) &&
        nextAppState === "active" &&
        userRef.current
      ) {
        // Only lock on backgrounding if app was backgrounded for > 30 seconds
        const elapsed = backgroundTimeRef.current ? Date.now() - backgroundTimeRef.current : 0;
        if (elapsed > 30000) {
          checkAndAuthenticate();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      unsubscribe();
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const rootSegment = segments[0];
      const inDetailFlow = rootSegment === "listing" || rootSegment === "case";

      if (!inDetailFlow) {
        return false;
      }

      const canGoBack = typeof (router as any).canGoBack === "function"
        ? (router as any).canGoBack()
        : false;

      if (canGoBack) {
        return false;
      }

      router.replace("/(tabs)");
      return true;
    });

    return () => {
      backSubscription.remove();
    };
  }, [router, segments]);

  return (
    <SafeAreaProvider>
      {/* Universal status bar — adapts to theme, prevents white flash */}
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.canvasBackground}
        translucent={false}
      />

      <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
        <AuthGuard user={user} authLoaded={authLoaded} />
        <Slot />
        {__DEV__ && (
          <View style={{ position: "absolute", bottom: 20, right: 20 }}>
            <Button title="Try Sentry" onPress={() => { Sentry.captureException(new Error("First error")); }} />
          </View>
        )}

        {/* App Lock Overlay — inside provider so it can use themeColors */}
        <AppLockOverlay
          isLocked={isLocked}
          allowBiometrics={allowBiometrics}
          isUnlockedSuccess={isUnlockedSuccess}
          pinError={pinError}
          onPinSubmit={handlePinSubmit}
          onBiometricSuccess={handleBiometricSuccess}
        />
      </View>
    </SafeAreaProvider>
  );
}

function RootLayout() {
  const [user, setUser] = useState<User | null>(null);
  const [authLoaded, setAuthLoaded] = useState(false);

  // Keep showing Splash/Loading while checking auth
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    });
    return () => unsubscribe();
  }, []);

  if (!authLoaded) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: COLORS.background,
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <AppSettingsProvider>
      <RootLayoutInner
        user={user}
        setUser={setUser}
        authLoaded={authLoaded}
        setAuthLoaded={setAuthLoaded}
      />
    </AppSettingsProvider>
  );
}

export default Sentry.wrap(RootLayout);
