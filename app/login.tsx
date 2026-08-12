import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  Image,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  initializeGoogleSignIn,
} from "@/services/auth";
import { THEME } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t } = useAppSettings();

  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const validateEmail = (emailStr: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(emailStr);
  };

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      await signInWithGoogle();
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      Alert.alert("Log Masuk Ralat", error?.message || "Gagal log masuk dengan Google");
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailSignIn = async () => {
    if (!identifier.trim()) {
      Alert.alert("Maklumat Diperlukan", "Sila masukkan E-mel atau No. Telefon anda.");
      return;
    }
    if (!password) {
      Alert.alert("Maklumat Diperlukan", "Sila masukkan kata laluan anda.");
      return;
    }

    try {
      setIsLoading(true);
      if (isSigningUp) {
        if (!displayName.trim()) {
          Alert.alert("Nama Diperlukan", "Sila masukkan nama penuh anda.");
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(identifier.trim(), password, displayName.trim());
      } else {
        await signInWithEmail(identifier.trim(), password);
      }
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Auth error:", error);
      Alert.alert("Ralat Log Masuk", error?.message || "Gagal log masuk / mendaftar akaun.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 20}
      >
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingVertical: Math.max(insets.bottom, 24),
          }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets={true}
        >
          <View style={styles.container}>
            {/* Branding Section (Stitch Design) */}
            <View style={styles.brandingSection}>
              <View style={[styles.brandBadge, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
                <MaterialCommunityIcons name="domain" size={32} color={themeColors.maroonPrimary} />
              </View>
              <Text style={[styles.brandTitle, { color: themeColors.maroonPrimary }]}>DRT MASTER LISTING</Text>
              <Text style={[styles.brandSubtitle, { color: themeColors.textMuted }]}>We build trust, you build future</Text>
            </View>

            {/* Form Section */}
            <View style={styles.formContainer}>
              {/* Display Name Input (Only on Sign Up) */}
              {isSigningUp && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>Nama Penuh</Text>
                  <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                    <MaterialCommunityIcons
                      name="account-outline"
                      size={20}
                      color={themeColors.textMuted}
                      style={{ marginLeft: 12 }}
                    />
                    <TextInput
                      style={[styles.textInput, { color: themeColors.textPrimary }]}
                      placeholder="Masukkan nama penuh"
                      placeholderTextColor={themeColors.textMuted}
                      value={displayName}
                      onChangeText={setDisplayName}
                    />
                  </View>
                </View>
              )}

              {/* Email / Identifier Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>No. Telefon / Email</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                  <MaterialCommunityIcons
                    name="account-outline"
                    size={20}
                    color={themeColors.textMuted}
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={[styles.textInput, { color: themeColors.textPrimary }]}
                    placeholder="Masukkan ID / E-mel anda"
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={identifier}
                    onChangeText={setIdentifier}
                    autoFocus={true}
                  />
                </View>
              </View>

              {/* Password Input */}
              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>Kata Laluan</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                  <MaterialCommunityIcons
                    name="lock-outline"
                    size={20}
                    color={themeColors.textMuted}
                    style={{ marginLeft: 12 }}
                  />
                  <TextInput
                    style={[styles.textInput, { color: themeColors.textPrimary }]}
                    placeholder="Masukkan kata laluan"
                    placeholderTextColor={themeColors.textMuted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={{ paddingRight: 12 }}
                  >
                    <MaterialCommunityIcons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={20}
                      color={themeColors.textMuted}
                    />
                  </TouchableOpacity>
                </View>
              </View>

              {/* Forgot Password Link */}
              {!isSigningUp && (
                <TouchableOpacity
                  style={styles.forgotPasswordContainer}
                  onPress={() =>
                    Alert.alert("Lupa Kata Laluan", "Sila hubungi pentadbir sistem untuk penetapan semula kata laluan.")
                  }
                >
                  <Text style={[styles.forgotPasswordText, { color: themeColors.maroonPrimary }]}>Lupa kata laluan?</Text>
                </TouchableOpacity>
              )}

              {/* Submit Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleEmailSignIn}
                disabled={isLoading}
                style={[styles.primaryButton, { backgroundColor: themeColors.maroonPrimary }, isLoading && { opacity: 0.7 }]}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.primaryButtonText}>
                    {isSigningUp ? "Daftar Akaun" : "Log Masuk"}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
                <Text style={[styles.dividerText, { color: themeColors.textMuted }]}>Atau</Text>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                style={[styles.googleButton, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }] }
              >
                <Image
                  source={require("../assets/google_logo.png")}
                  style={styles.googleIcon}
                  resizeMode="contain"
                />
                <Text style={[styles.googleButtonText, { color: themeColors.textPrimary }] }>Log Masuk dengan Google</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Sign Up Switch */}
            <View style={styles.footerContainer}>
              <Text style={styles.footerText}>
                {isSigningUp ? "Sudah mempunyai akaun?" : "Belum mempunyai akaun?"}{" "}
              </Text>
              <TouchableOpacity onPress={() => setIsSigningUp(!isSigningUp)}>
                <Text style={styles.footerLink}>
                  {isSigningUp ? "Log Masuk Akaun" : "Daftar Akaun Baru"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  brandingSection: {
    alignItems: "center",
    marginBottom: 32,
  },
  brandBadge: {
    width: 64,
    height: 64,
    borderRadius: 16,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: THEME.borderColor,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  brandTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: THEME.maroonPrimary,
    letterSpacing: -0.3,
  },
  brandSubtitle: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 4,
  },
  formContainer: {
    gap: 16,
  },
  inputGroup: {
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.textPrimary,
    marginBottom: 6,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: THEME.canvasBackground,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    borderRadius: 10,
  },
  textInput: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 10,
    fontSize: 14,
    color: THEME.textPrimary,
  },
  forgotPasswordContainer: {
    alignSelf: "flex-end",
    marginTop: -4,
    marginBottom: 4,
  },
  forgotPasswordText: {
    fontSize: 13,
    fontWeight: "600",
    color: THEME.maroonPrimary,
  },
  primaryButton: {
    backgroundColor: THEME.maroonPrimary,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 12,
    gap: 8,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: THEME.borderColor,
  },
  dividerText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  googleButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: THEME.canvasBackground,
    borderWidth: 1,
    borderColor: THEME.borderColor,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    gap: 10,
  },
  googleIcon: {
    width: 20,
    height: 20,
  },
  googleButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: THEME.textPrimary,
  },
  footerContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 32,
  },
  footerText: {
    fontSize: 13,
    color: THEME.textMuted,
  },
  footerLink: {
    fontSize: 13,
    fontWeight: "700",
    color: THEME.maroonPrimary,
  },
});


