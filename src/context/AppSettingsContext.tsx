import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LIGHT_THEME, DARK_THEME } from "@/constants/theme";
import { TRANSLATIONS, TranslationKeys } from "@/constants/translations";
import { getCurrentUserProfile } from "@/services/auth";

export type ThemeMode = "system" | "light" | "dark";
export type LanguageMode = "BM" | "EN";

export interface AppSettingsContextType {
  theme: ThemeMode;
  language: LanguageMode;
  themeColors: typeof LIGHT_THEME;
  isDark: boolean;
  setTheme: (mode: ThemeMode) => void;
  toggleTheme: () => void;
  setLanguage: (lang: LanguageMode) => void;
  toggleLanguage: () => void;
  t: (key: TranslationKeys) => string;
  hasCompletedOnboarding: boolean;
  isOnboardingChecked: boolean;
  saveOnboardingCompleted: (agentName: string) => Promise<void>;
}

const STORAGE_KEY_THEME = "@umi_app_theme";
const STORAGE_KEY_LANG = "@umi_app_language";

const AppSettingsContext = createContext<AppSettingsContextType | undefined>(undefined);

export function AppSettingsProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [language, setLanguageState] = useState<LanguageMode>("BM");
  const [hasCompletedOnboarding, setHasCompletedOnboarding] = useState<boolean>(false);
  const [isOnboardingChecked, setIsOnboardingChecked] = useState<boolean>(false);

  // Load saved preferences on mount
  useEffect(() => {
    async function loadPreferences() {
      try {
        const savedTheme = await AsyncStorage.getItem(STORAGE_KEY_THEME);
        if (savedTheme === "system" || savedTheme === "light" || savedTheme === "dark") {
          setThemeState(savedTheme);
        }

        const savedLang = await AsyncStorage.getItem(STORAGE_KEY_LANG);
        if (savedLang === "BM" || savedLang === "EN") {
          setLanguageState(savedLang);
        }

        const onboardingCompleted = await AsyncStorage.getItem("hasCompletedOnboarding");
        setHasCompletedOnboarding(onboardingCompleted === "true");
      } catch (error) {
        console.error("Error loading app settings from AsyncStorage:", error);
      } finally {
        setIsOnboardingChecked(true);
      }
    }

    loadPreferences();
  }, []);

  const saveOnboardingCompleted = async (agentName: string) => {
    try {
      if (agentName.trim()) {
        await AsyncStorage.setItem("agentDisplayName", agentName.trim());
      }
      await AsyncStorage.setItem("hasCompletedOnboarding", "true");
      setHasCompletedOnboarding(true);
    } catch (error) {
      console.error("Error saving onboarding status:", error);
    }
  };

  const setTheme = async (mode: ThemeMode) => {
    try {
      setThemeState(mode);
      await AsyncStorage.setItem(STORAGE_KEY_THEME, mode);
    } catch (error) {
      console.error("Error saving theme preference:", error);
    }
  };

  const toggleTheme = () => {
    const nextTheme = theme === "light" ? "dark" : "light";
    setTheme(nextTheme);
  };

  const setLanguage = async (lang: LanguageMode) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(STORAGE_KEY_LANG, lang);
      
      // Keep push notification language preference in sync with user profile
      const user = getCurrentUserProfile();
      if (user?.uid) {
        import("@/services/updateNotifications").then(({ setUpdateNotificationsEnabled }) => {
          setUpdateNotificationsEnabled({ uid: user.uid, language: lang }, true).catch(() => {});
        });
      }
    } catch (error) {
      console.error("Error saving language preference:", error);
    }
  };

  const toggleLanguage = () => {
    const nextLang = language === "BM" ? "EN" : "BM";
    setLanguage(nextLang);
  };

  const t = (key: TranslationKeys): string => {
    const dict = TRANSLATIONS[language] || TRANSLATIONS.BM;
    return dict[key] || TRANSLATIONS.BM[key] || String(key);
  };

  const isDark = theme === "system" ? systemColorScheme === "dark" : theme === "dark";
  const themeColors = isDark ? DARK_THEME : LIGHT_THEME;

  return (
    <AppSettingsContext.Provider
      value={{
        theme,
        language,
        themeColors,
        isDark,
        setTheme,
        toggleTheme,
        setLanguage,
        toggleLanguage,
        t,
        hasCompletedOnboarding,
        isOnboardingChecked,
        saveOnboardingCompleted,
      }}
    >
      {children}
    </AppSettingsContext.Provider>
  );
}

export function useAppSettings(): AppSettingsContextType {
  const context = useContext(AppSettingsContext);
  if (!context) {
    throw new Error("useAppSettings must be used within an AppSettingsProvider");
  }
  return context;
}
