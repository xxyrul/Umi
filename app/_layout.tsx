import React, { useEffect, useState, useRef } from "react";
import * as Sentry from '@sentry/react-native';
import * as Notifications from 'expo-notifications';
import { View, Text, ActivityIndicator, AppState, AppStateStatus, Animated, StatusBar, Button, BackHandler, Platform, Modal, KeyboardAvoidingView } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, Stack, useSegments, useRouter } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { onAuthStateChanged, firebaseAuth, User } from "@/services/firebase";
import { AppSettingsProvider, useAppSettings } from "@/context/AppSettingsContext";
import { COLORS } from "@/constants/theme";
import {
  fetchReleaseManifest,
  shouldShowUpdatePrompt,
  cleanupUpdateCache,
  NativeAppRelease,
} from "@/services/apkUpdater";
import {
  configureUpdateNotificationHandlers,
  registerForUpdateNotifications,
} from "@/services/updateNotifications";
import { isUserRegistrationComplete } from "@/services/auth";
import { GoogleSignin } from "@react-native-google-signin/google-signin";
import {
  getAppLockEnabled,
  verifyAppLockPin,
  getBiometricsEnabled,
  authenticateBiometric,
  getAppLockTimeout,
} from "@/services/security";
import { PinKeypad, OfflineBanner } from "@/components";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as ScreenCapture from "expo-screen-capture";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes cache
      retry: 2,
    },
  },
});

// Keep splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

// Sentry.init({
//   dsn: 'https://5f6ba69eb0cba92e13ad453f2fb6c628@o4511887279587328.ingest.de.sentry.io/4511887297806416',
// 
//   // Do NOT send PII (IP addresses, cookies, user identifiers, etc.) to Sentry.
//   sendDefaultPii: false,
// 
//   // Configure Session Replay with masking enabled to avoid capturing sensitive fields.
//   replaysSessionSampleRate: 0.1,
//   replaysOnErrorSampleRate: 1,
//   integrations: [
//     Sentry.mobileReplayIntegration({
//       // Mask all text and images by default to prevent PII capture in session recordings.
//       maskAllText: true,
//       maskAllImages: true,
//     }),
//     Sentry.feedbackIntegration(),
//   ],
// 
//   // Strip sensitive fields before events are transmitted to Sentry.
//   beforeSend(event) {
//     // Remove user identity fields
//     if (event.user) {
//       delete event.user.ip_address;
//       delete event.user.email;
//       delete event.user.username;
//       delete event.user.id;
//     }
//     // Remove request-level data that may contain credentials or session tokens
//     if (event.request) {
//       delete event.request.cookies;
//       delete event.request.headers;
//       delete event.request.env;
//     }
//     return event;
//   },
// 
//   // uncomment the line below to enable Spotlight (https://spotlightjs.com)
//   // spotlight: __DEV__,
// });

function AuthGuard({ user, authLoaded }: { user: User | null; authLoaded: boolean }) {
  const segments = useSegments() as string[];
  const router = useRouter();
  const { hasCompletedOnboarding, isOnboardingChecked } = useAppSettings();

  useEffect(() => {
    if (!authLoaded || !isOnboardingChecked) return;

    let isMounted = true;
    const activeUser = firebaseAuth.currentUser;
    const rootSegment = segments[0] || "";
    const inOnboarding = rootSegment === "onboarding";
    const inLogin = rootSegment === "login";

    if (!hasCompletedOnboarding) {
      if (firebaseAuth.currentUser) {
        firebaseAuth.signOut().catch(() => {});
        if (Platform.OS !== "web") {
          GoogleSignin.signOut().catch(() => {});
        }
      }
      if (!inOnboarding) {
        router.replace("/onboarding" as any);
      }
      return;
    }

    if (!activeUser) {
      if (!inLogin) {
        router.replace("/login");
      }
    } else {
      // Enforce Invite Code Gate & Suspension check before entering (tabs)
      isUserRegistrationComplete(activeUser.uid)
        .then(({ isRegistered, isSuspended }) => {
          if (!isMounted) return;
          if (!firebaseAuth.currentUser) {
            if (!inLogin) router.replace("/login");
            return;
          }
          if (isSuspended) {
            firebaseAuth.signOut().catch(() => {});
            if (!inLogin) router.replace("/login");
            return;
          }
          if (isRegistered) {
            if (inLogin || inOnboarding) {
              router.replace("/(tabs)");
            }
          } else {
            if (!inLogin) {
              router.replace("/login");
            }
          }
        })
        .catch(() => {
          if (!isMounted) return;
          if (!inLogin) {
            router.replace("/login");
          }
        });
    }

    return () => {
      isMounted = false;
    };
  }, [user, authLoaded, segments, isOnboardingChecked, hasCompletedOnboarding]);

  return null;
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
  const { themeColors, isDark, language, allowScreenshots } = useAppSettings();
  const router = useRouter();
  const segments = useSegments() as string[];

  // Screen Capture Protection
  useEffect(() => {
    if (allowScreenshots) {
      ScreenCapture.allowScreenCaptureAsync().catch(() => {});
    } else {
      ScreenCapture.preventScreenCaptureAsync().catch(() => {});
    }
  }, [allowScreenshots]);

  const userRef = useRef<User | null>(user);

  // Sync user reference
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  // Self-cleaning storage: purge cached update installers on app startup
  useEffect(() => {
    if (Platform.OS === "android") {
      void cleanupUpdateCache();
    }
  }, []);

  useEffect(() => {
    if (!user) return;

    void registerForUpdateNotifications({ uid: user.uid, language }, true);
  }, [user?.uid, language]);

  useEffect(() => {
    return configureUpdateNotificationHandlers(
      () => (userRef.current ? { uid: userRef.current.uid, language } : null),
      () => {
        router.push("/updates" as any);
      }
    );
  }, [language]);

  // Handle taps on push notifications
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data as { kind?: string; type?: string } | undefined;
      if (
        data?.kind === "broadcast-announcement" ||
        data?.kind === "announcement" ||
        data?.kind === "update-available"
      ) {
        router.push("/notifications" as any);
      }
    });
    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    // Auth state is now managed globally by RootLayout to avoid duplicate listeners.
    if (authLoaded && user) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [authLoaded, user]);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      if (router.canGoBack()) {
        router.back();
        return true;
      }
      return false;
    });

    return () => {
      backSubscription.remove();
    };
  }, [router]);

  // App Lock PIN & Biometrics Screen Protection
  const [isAppLocked, setIsAppLocked] = useState(false);
  const [pinUnlockError, setPinUnlockError] = useState("");

  const languageRef = useRef(language);
  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  const checkAppLock = async () => {
    try {
      const enabled = await getAppLockEnabled();
      if (enabled) {
        setIsAppLocked(true);
        const bioEnabled = await getBiometricsEnabled();
        if (bioEnabled) {
          const success = await authenticateBiometric(
            languageRef.current === "BM" ? "Buka artha" : "Unlock artha"
          );
          if (success) {
            setIsAppLocked(false);
          }
        }
      } else {
        setIsAppLocked(false);
      }
    } catch {
      setIsAppLocked(false);
    }
  };

  useEffect(() => {
    if (user && authLoaded) {
      checkAppLock();
    }
  }, [user, authLoaded]);

  const lastBackgroundTimeRef = useRef<number | null>(null);

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (nextState === "background" || nextState === "inactive") {
        lastBackgroundTimeRef.current = Date.now();
      } else if (nextState === "active" && userRef.current) {
        const lastBg = lastBackgroundTimeRef.current;
        const timeoutMs = await getAppLockTimeout();
        if (lastBg === null || Date.now() - lastBg >= timeoutMs) {
          checkAppLock();
        }
        lastBackgroundTimeRef.current = null;
      }
    };
    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => sub.remove();
  }, []);

  const handleUnlockWithPin = async (pin: string) => {
    setPinUnlockError("");
    const isValid = await verifyAppLockPin(pin);
    if (isValid) {
      setIsAppLocked(false);
    } else {
      setPinUnlockError(
        languageRef.current === "BM" ? "PIN tidak sah. Sila cuba lagi." : "Incorrect PIN. Please try again."
      );
    }
  };

  const handleUnlockWithBiometrics = async () => {
    const success = await authenticateBiometric(
      languageRef.current === "BM" ? "Buka artha" : "Unlock artha"
    );
    if (success) {
      setIsAppLocked(false);
    }
  };

  return (
    <SafeAreaProvider>
      <OfflineBanner />
      <AuthGuard user={user} authLoaded={authLoaded} />
      {/* Universal status bar — adapts to theme, prevents white flash */}
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.canvasBackground}
        translucent={false}
      />

      <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: "slide_from_right",
            contentStyle: { backgroundColor: themeColors.canvasBackground },
          }}
        >
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          <Stack.Screen name="tambah" options={{ presentation: "modal", animation: "slide_from_bottom" }} />
          <Stack.Screen name="updates" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="notifications" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="listing/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="case/[id]" options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="case/form" options={{ animation: "slide_from_right" }} />
        </Stack>
      </View>

      {/* App Lock PIN Shield Screen */}
      <Modal
        visible={isAppLocked}
        transparent={false}
        animationType="fade"
        onRequestClose={() => {}}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={{
            flex: 1,
            backgroundColor: themeColors.canvasBackground,
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <PinKeypad
            title={language === "BM" ? "Kunci Aplikasi" : "App Locked"}
            subtitle={
              language === "BM"
                ? "Masukkan PIN 4-digit untuk membuka artha"
                : "Enter your 4-digit PIN to unlock artha"
            }
            onPinComplete={handleUnlockWithPin}
            onBiometricSuccess={handleUnlockWithBiometrics}
            showBiometricOption={true}
            errorMessage={pinUnlockError}
          />
        </KeyboardAvoidingView>
      </Modal>
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
    <QueryClientProvider client={queryClient}>
      <AppSettingsProvider>
        <RootLayoutInner
          user={user}
          setUser={setUser}
          authLoaded={authLoaded}
          setAuthLoaded={setAuthLoaded}
        />
      </AppSettingsProvider>
    </QueryClientProvider>
  );
}

export default RootLayout;
