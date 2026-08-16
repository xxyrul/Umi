import React, { useEffect, useState, useRef } from "react";
import * as Sentry from '@sentry/react-native';
import { View, Text, ActivityIndicator, AppState, AppStateStatus, Animated, StatusBar, Button, BackHandler, Platform } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, useSegments, useRouter } from "expo-router";
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
import { InAppUpdateModal } from "@/components";
import {
  configureUpdateNotificationHandlers,
  registerForUpdateNotifications,
} from "@/services/updateNotifications";

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
  const { themeColors, isDark, language } = useAppSettings();
  const router = useRouter();
  const segments = useSegments() as string[];

  const userRef = useRef<User | null>(user);

  // Sync user reference
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [availableRelease, setAvailableRelease] = useState<NativeAppRelease | null>(null);
  const [isUpdateModalVisible, setIsUpdateModalVisible] = useState(false);

  // Self-cleaning storage: purge cached update installers on app startup
  useEffect(() => {
    if (Platform.OS === "android") {
      void cleanupUpdateCache();
    }
  }, []);

  const triggerUpdateCheck = async (force: boolean = false) => {
    if (Platform.OS !== "android") return;
    try {
      const release = await fetchReleaseManifest();
      if (release) {
        const shouldShow = await shouldShowUpdatePrompt(release, force);
        if (shouldShow) {
          setAvailableRelease(release);
          setIsUpdateModalVisible(true);
        }
      }
    } catch (e) {
      console.warn("[_layout] Update check failed:", e);
    }
  };

  useEffect(() => {
    if (Platform.OS !== "android") return;

    const timer = setTimeout(() => {
      void triggerUpdateCheck(false);
    }, 2500);

    return () => clearTimeout(timer);
  }, [language]);

  useEffect(() => {
    if (!user) return;

    void registerForUpdateNotifications({ uid: user.uid, language });
  }, [user?.uid, language]);

  useEffect(() => {
    return configureUpdateNotificationHandlers(
      () => (userRef.current ? { uid: userRef.current.uid, language } : null),
      () => {
        void triggerUpdateCheck(true);
      }
    );
  }, [language]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoaded(true);
      SplashScreen.hideAsync().catch(() => {});
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    const backSubscription = BackHandler.addEventListener("hardwareBackPress", () => {
      const rootSegment = segments[0];
      if (rootSegment === "listing") {
        router.navigate("/(tabs)/listings");
        return true;
      }
      if (rootSegment === "case") {
        router.navigate("/(tabs)/cases");
        return true;
      }
      return false;
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
        <InAppUpdateModal
          visible={isUpdateModalVisible}
          release={availableRelease}
          onClose={() => setIsUpdateModalVisible(false)}
        />
        {__DEV__ && Platform.OS !== "web" && (
          <View style={{ position: "absolute", bottom: 20, right: 20 }}>
            <Button title="Try Sentry" onPress={() => { Sentry.captureException(new Error("First error")); }} />
          </View>
        )}
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

export default RootLayout;
