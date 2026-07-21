import React, { useEffect, useState } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Slot, useSegments, useRootNavigationState, router } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { onAuthStateChanged, firebaseAuth } from "@/services/firebase";

// Keep the splash screen visible while we fetch resources
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const segments = useSegments();
  const navigationState = useRootNavigationState();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!navigationState?.routes) return;

    const unsubscribe = onAuthStateChanged(firebaseAuth, (user) => {
      if (isLoading) setIsLoading(false);

      const inAuthGroup = segments[0] === "(tabs)" || segments[0] === "case-form";

      if (user) {
        // User is authenticated
        if (!inAuthGroup) {
          // Redirect to dashboard if on login screen
          router.replace("/(tabs)");
        }
      } else {
        // User is not authenticated
        if (inAuthGroup) {
          // Redirect to login if on protected route
          router.replace("/login");
        }
      }

      // Hide splash screen after auth state is determined
      SplashScreen.hideAsync().catch(() => {});
    });

    return unsubscribe;
  }, [navigationState?.routes]);

  // Don't render anything until we've determined auth state
  if (isLoading && !navigationState?.routes) {
    return null;
  }

  return (
    <SafeAreaProvider>
      <Slot />
    </SafeAreaProvider>
  );
}
