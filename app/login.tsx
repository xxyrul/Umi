import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Modal,
  BackHandler,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";

import {
  signInWithGoogle,
  signInWithEmail,
  signUpWithEmail,
  initializeGoogleSignIn,
  sendPasswordReset,
  completeGoogleRegistration,
  isUserRegistrationComplete,
  signOut,
} from "@/services/auth";
import { firebaseAuth } from "@/services/firebase";
import { THEME } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";

export default function LoginScreen() {
  const insets = useSafeAreaInsets();
  const { themeColors, t, language } = useAppSettings();

  const [isLoading, setIsLoading] = useState(false);
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [inviteCode, setInviteCode] = useState("");

  const [isResetModalVisible, setIsResetModalVisible] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Google Sign-In Invite Code Gate State
  const [isGoogleModalVisible, setIsGoogleModalVisible] = useState(false);
  const [googleUserPending, setGoogleUserPending] = useState<{
    uid: string;
    email: string;
    displayName: string;
  } | null>(null);
  const [googleInviteInput, setGoogleInviteInput] = useState("");
  const [isActivatingGoogle, setIsActivatingGoogle] = useState(false);

  // Android hardware back button and swipe back gesture handler
  useEffect(() => {
    const backAction = () => {
      if (isGoogleModalVisible) {
        handleCancelGoogleModal();
        return true;
      }
      if (isResetModalVisible) {
        setIsResetModalVisible(false);
        return true;
      }
      if (isSigningUp) {
        setIsSigningUp(false);
        return true;
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", backAction);
    return () => subscription.remove();
  }, [isSigningUp, isResetModalVisible, isGoogleModalVisible, googleUserPending]);

  useEffect(() => {
    initializeGoogleSignIn();

    // Check if the current user session is missing an invite code
    const checkCurrentSession = async () => {
      const curr = firebaseAuth.currentUser;
      if (curr) {
        const { isRegistered, isSuspended } = await isUserRegistrationComplete(curr.uid);
        if (isSuspended) {
          await signOut();
          Alert.alert(
            language === "BM" ? "Akaun Digantung" : "Account Suspended",
            language === "BM"
              ? "Akaun ejen anda telah digantung oleh pentadbir agensi."
              : "Your agent account has been suspended by the agency administrator."
          );
          return;
        }
        if (!isRegistered) {
          setGoogleUserPending({
            uid: curr.uid,
            email: curr.email || "",
            displayName: curr.displayName || "Agent",
          });
          setIsGoogleModalVisible(true);
        }
      }
    };
    checkCurrentSession();
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      setIsLoading(true);
      const { userProfile, isRegistered } = await signInWithGoogle();
      if (isRegistered) {
        router.replace("/(tabs)");
      } else {
        // New Google user — prompt for Invite Code before granting entry
        setGoogleUserPending(userProfile);
        setGoogleInviteInput("");
        setIsGoogleModalVisible(true);
      }
    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      Alert.alert(t("authErrorTitle"), error?.message || (language === "BM" ? "Gagal log masuk dengan Google" : "Failed to sign in with Google"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleActivateGoogleAccount = async () => {
    if (!googleUserPending) return;
    if (!googleInviteInput.trim()) {
      Alert.alert(t("reqInfoTitle"), t("inviteCodeHint"));
      return;
    }

    try {
      setIsActivatingGoogle(true);
      await completeGoogleRegistration(
        googleUserPending.uid,
        googleUserPending.email,
        googleUserPending.displayName,
        googleInviteInput.trim()
      );
      setIsGoogleModalVisible(false);
      setGoogleUserPending(null);
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Google registration error:", error);
      const errMsg = error?.message || "";
      let userFriendlyMsg = errMsg || t("authErrorSub");

      if (errMsg.includes("EMPTY_CODE") || errMsg.includes("INVALID_CODE")) {
        userFriendlyMsg = t("invalidInviteCodeAlert");
      } else if (errMsg.includes("ALREADY_USED")) {
        userFriendlyMsg = t("alreadyUsedInviteCodeAlert");
      } else if (errMsg.includes("REVOKED_CODE")) {
        userFriendlyMsg = t("revokedInviteCodeAlert");
      }

      Alert.alert(t("authErrorTitle"), userFriendlyMsg);
    } finally {
      setIsActivatingGoogle(false);
    }
  };

  const handleCancelGoogleModal = async () => {
    setIsGoogleModalVisible(false);
    const userToCleanup = firebaseAuth.currentUser;
    setGoogleUserPending(null);
    setGoogleInviteInput("");
    try {
      if (userToCleanup) {
        // Delete unactivated user from Firebase Auth so it doesn't linger or block future signups
        await userToCleanup.delete().catch(() => {});
      }
      await signOut();
    } catch {}
  };

  const handleEmailSignIn = async () => {
    const cleanIdentifier = identifier.trim();
    if (!cleanIdentifier) {
      Alert.alert(t("reqInfoTitle"), isSigningUp ? t("invalidEmailSub") : t("reqInfoSub"));
      return;
    }

    if (isSigningUp && (!cleanIdentifier.includes("@") || !cleanIdentifier.includes("."))) {
      Alert.alert(
        t("reqInfoTitle"),
        language === "BM"
          ? "Sila masukkan alamat e-mel yang sah (cth: ejen@gmail.com)."
          : "Please enter a valid email address (e.g. agent@gmail.com)."
      );
      return;
    }

    if (!password) {
      Alert.alert(t("reqInfoTitle"), t("reqPassSub"));
      return;
    }

    if (isSigningUp && password.length < 6) {
      Alert.alert(
        t("reqInfoTitle"),
        language === "BM"
          ? "Kata laluan mestilah sekurang-kurangnya 6 aksara."
          : "Password must be at least 6 characters long."
      );
      return;
    }

    if (isSigningUp && !inviteCode.trim()) {
      Alert.alert(
        t("reqInfoTitle"),
        t("inviteCodeHint")
      );
      return;
    }

    try {
      setIsLoading(true);
      if (isSigningUp) {
        if (!displayName.trim()) {
          Alert.alert(t("reqInfoTitle"), t("reqNameSub"));
          setIsLoading(false);
          return;
        }
        await signUpWithEmail(cleanIdentifier, password, displayName.trim(), inviteCode.trim());
      } else {
        await signInWithEmail(cleanIdentifier, password);
      }
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Auth error:", error);
      const code = error?.code || "";
      const errMsg = error?.message || "";
      let userFriendlyMsg = errMsg || t("authErrorSub");

      if (errMsg.includes("EMPTY_CODE") || errMsg.includes("INVALID_CODE")) {
        userFriendlyMsg = t("invalidInviteCodeAlert");
      } else if (errMsg.includes("ALREADY_USED")) {
        userFriendlyMsg = t("alreadyUsedInviteCodeAlert");
      } else if (errMsg.includes("REVOKED_CODE")) {
        userFriendlyMsg = t("revokedInviteCodeAlert");
      } else if (code === "auth/email-already-in-use") {
        userFriendlyMsg =
          language === "BM"
            ? "Alamat e-mel ini telah digunakan. Jika anda pernah mendaftar melalui Google, sila tekan butang 'Log Masuk dengan Google' di bawah."
            : "This email address is already in use. If you signed in with Google, please tap 'Sign In with Google' below to activate with your invite code.";
      } else if (code === "auth/invalid-email") {
        userFriendlyMsg =
          language === "BM"
            ? "Format e-mel tidak sah. Sila periksa e-mel anda."
            : "Invalid email format. Please check your email.";
      } else if (code === "auth/weak-password") {
        userFriendlyMsg =
          language === "BM"
            ? "Kata laluan terlalu lemah (min 6 aksara)."
            : "Password is too weak (min 6 characters).";
      } else if (
        code === "auth/user-not-found" ||
        code === "auth/wrong-password" ||
        code === "auth/invalid-credential"
      ) {
        userFriendlyMsg =
          language === "BM"
            ? "E-mel atau kata laluan tidak tepat. Sila cuba lagi."
            : "Incorrect email or password. Please try again.";
      }

      Alert.alert(t("authErrorTitle"), userFriendlyMsg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendPasswordReset = async () => {
    const targetEmail = resetEmail.trim() || identifier.trim();
    if (!targetEmail || !targetEmail.includes("@")) {
      Alert.alert(t("reqInfoTitle"), t("invalidEmailSub"));
      return;
    }

    try {
      setIsResetting(true);
      await sendPasswordReset(targetEmail);
      setIsResetModalVisible(false);
      setResetEmail("");
      Alert.alert(
        t("resetLinkSentTitle"),
        `${t("resetLinkSentSub")} ${targetEmail}. ${t("resetLinkCheckInbox")}`
      );
    } catch (error: any) {
      console.error("Reset password error:", error);
      Alert.alert(t("authErrorTitle"), error?.message || t("authErrorSub"));
    } finally {
      setIsResetting(false);
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
            {/* Top Back Button when in Register mode */}
            {isSigningUp && (
              <TouchableOpacity
                onPress={() => setIsSigningUp(false)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                style={{
                  alignSelf: "flex-start",
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 6,
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  marginBottom: 16,
                  borderRadius: 10,
                  backgroundColor: themeColors.surfaceContainer,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                }}
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color={themeColors.textPrimary} />
                <Text style={{ color: themeColors.textPrimary, fontSize: 13, fontWeight: "700" }}>
                  {t("loginLink")}
                </Text>
              </TouchableOpacity>
            )}

            <View style={styles.brandingSection}>
              <View
                style={{
                  width: 58,
                  height: 58,
                  borderRadius: 16,
                  backgroundColor: themeColors.maroonPrimary,
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 14,
                  shadowColor: themeColors.maroonPrimary,
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.35,
                  shadowRadius: 8,
                  elevation: 6,
                }}
              >
                <MaterialCommunityIcons name="home-variant" size={32} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontSize: 30,
                  fontWeight: "800",
                  color: themeColors.textPrimary,
                  letterSpacing: -0.8,
                  textTransform: "lowercase",
                }}
              >
                artha
              </Text>
              <Text style={[styles.brandCategory, { color: themeColors.maroonPrimary }]}>Master Listing CRM</Text>
              <Text style={[styles.brandSubtitle, { color: themeColors.textMuted }]}>We build trust, you build future</Text>
            </View>

            <View style={styles.formContainer}>
              {isSigningUp && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t("fullNameLabel")}</Text>
                  <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                    <MaterialCommunityIcons name="account-outline" size={20} color={themeColors.textMuted} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[styles.textInput, { color: themeColors.textPrimary }]}
                      placeholder={t("fullNamePlaceholder")}
                      placeholderTextColor={themeColors.textMuted}
                      value={displayName}
                      onChangeText={setDisplayName}
                    />
                  </View>
                </View>
              )}

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {isSigningUp ? t("emailAddressLabel") : t("identifierLabel")}
                </Text>
                <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                  <MaterialCommunityIcons name={isSigningUp ? "email-outline" : "account-outline"} size={20} color={themeColors.textMuted} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={[styles.textInput, { color: themeColors.textPrimary }]}
                    placeholder={isSigningUp ? "nama@email.com" : t("identifierPlaceholder")}
                    placeholderTextColor={themeColors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={identifier}
                    onChangeText={setIdentifier}
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t("passwordLabel")}</Text>
                <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                  <MaterialCommunityIcons name="lock-outline" size={20} color={themeColors.textMuted} style={{ marginLeft: 12 }} />
                  <TextInput
                    style={[styles.textInput, { color: themeColors.textPrimary }]}
                    placeholder={t("passwordPlaceholder")}
                    placeholderTextColor={themeColors.textMuted}
                    secureTextEntry={!showPassword}
                    value={password}
                    onChangeText={setPassword}
                  />
                  <TouchableOpacity onPress={() => setShowPassword(!showPassword)} style={{ paddingRight: 12 }}>
                    <MaterialCommunityIcons name={showPassword ? "eye-off-outline" : "eye-outline"} size={20} color={themeColors.textMuted} />
                  </TouchableOpacity>
                </View>
              </View>

              {isSigningUp && (
                <View style={styles.inputGroup}>
                  <Text style={[styles.label, { color: themeColors.textPrimary }]}>{t("inviteCodeLabel")}</Text>
                  <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                    <MaterialCommunityIcons name="key-outline" size={20} color={themeColors.maroonPrimary} style={{ marginLeft: 12 }} />
                    <TextInput
                      style={[styles.textInput, { color: themeColors.textPrimary, textTransform: "uppercase", fontWeight: "700", letterSpacing: 1 }]}
                      placeholder={t("inviteCodePlaceholder")}
                      placeholderTextColor={themeColors.textMuted}
                      autoCapitalize="characters"
                      value={inviteCode}
                      onChangeText={(text) => setInviteCode(text.toUpperCase())}
                    />
                  </View>
                  <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 4, lineHeight: 16 }}>
                    {t("inviteCodeHint")}
                  </Text>
                </View>
              )}

              {!isSigningUp && (
                <TouchableOpacity
                  style={styles.forgotPasswordContainer}
                  onPress={() => {
                    setResetEmail(identifier);
                    setIsResetModalVisible(true);
                  }}
                >
                  <Text style={[styles.forgotPasswordText, { color: themeColors.maroonPrimary }]}>{t("forgotPasswordLink")}</Text>
                </TouchableOpacity>
              )}

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
                    {isSigningUp ? t("createAccountBtn") : t("signInBtn")}
                  </Text>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
                <Text style={[styles.dividerText, { color: themeColors.textMuted }]}>{t("orDivider")}</Text>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
              </View>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleGoogleSignIn}
                disabled={isLoading}
                style={[styles.googleButton, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}
              >
                <MaterialCommunityIcons name="google" size={20} color="#EA4335" />
                <Text style={[styles.googleButtonText, { color: themeColors.textPrimary }]}>{t("googleSignInBtn")}</Text>
              </TouchableOpacity>
            </View>

            {/* Footer Sign Up Switch */}
            <View style={styles.footerContainer}>
              <Text style={[styles.footerText, { color: themeColors.textMuted }]}>
                {isSigningUp ? t("haveAccountPrompt") : t("noAccountPrompt")}{" "}
              </Text>
              <TouchableOpacity onPress={() => setIsSigningUp(!isSigningUp)}>
                <Text style={[styles.footerLink, { color: themeColors.maroonPrimary }]}>
                  {isSigningUp ? t("loginLink") : t("registerLink")}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Forgot Password Custom Bottom Sheet Modal */}
      <Modal
        visible={isResetModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsResetModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setIsResetModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: themeColors.surfaceContainer,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              paddingHorizontal: 24,
              paddingTop: 20,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
              borderTopWidth: 1,
              borderColor: themeColors.borderColor,
            }}
          >
            {/* Header */}
            <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <View>
                <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>{t("forgotPasswordModalTitle")}</Text>
                <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 2 }}>
                  {t("forgotPasswordModalSub")}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setIsResetModalVisible(false)}
                style={{ padding: 4 }}
              >
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* Email input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.label, { color: themeColors.textPrimary, marginBottom: 6 }]}>{t("emailAddressLabel")}</Text>
              <View style={[styles.inputWithIcon, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
                <MaterialCommunityIcons name="email-outline" size={20} color={themeColors.textMuted} style={{ marginLeft: 12 }} />
                <TextInput
                  style={[styles.textInput, { color: themeColors.textPrimary }]}
                  placeholder="nama@email.com"
                  placeholderTextColor={themeColors.textMuted}
                  value={resetEmail}
                  onChangeText={setResetEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                />
              </View>
            </View>

            {/* Submit Reset Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleSendPasswordReset}
              disabled={isResetting}
              style={[styles.primaryButton, { backgroundColor: themeColors.maroonPrimary }, isResetting && { opacity: 0.7 }]}
            >
              {isResetting ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={styles.primaryButtonText}>{t("sendResetLinkBtn")}</Text>
                </View>
              )}
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Google Sign-In Invite Code Gate Modal */}
      <Modal
        visible={isGoogleModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={handleCancelGoogleModal}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={handleCancelGoogleModal}
          style={{
            flex: 1,
            backgroundColor: "rgba(0, 0, 0, 0.7)",
            justifyContent: "center",
            alignItems: "center",
            paddingHorizontal: 24,
          }}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              width: "100%",
              maxWidth: 380,
              backgroundColor: themeColors.cardBackground,
              borderRadius: 20,
              padding: 24,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
            }}
          >
            {/* Header */}
            <View style={{ alignItems: "center", marginBottom: 16 }}>
              <View
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 14,
                  backgroundColor: "rgba(225, 29, 72, 0.12)",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: 12,
                }}
              >
                <MaterialCommunityIcons name="shield-key-outline" size={28} color={themeColors.maroonPrimary} />
              </View>
              <Text
                style={{
                  fontSize: 18,
                  fontWeight: "800",
                  color: themeColors.textPrimary,
                  textAlign: "center",
                  marginBottom: 6,
                }}
              >
                {t("googleInviteTitle")}
              </Text>
              <Text
                style={{
                  fontSize: 12,
                  color: themeColors.textMuted,
                  textAlign: "center",
                  lineHeight: 18,
                }}
              >
                {t("googleInviteSub")}
              </Text>
            </View>

            {/* Google Account Preview Pill */}
            {googleUserPending && (
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: themeColors.surfaceContainer,
                  padding: 10,
                  borderRadius: 10,
                  marginBottom: 16,
                  gap: 10,
                }}
              >
                <MaterialCommunityIcons name="google" size={18} color="#EA4335" />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
                    {googleUserPending.displayName}
                  </Text>
                  <Text style={{ fontSize: 11, color: themeColors.textMuted }} numberOfLines={1}>
                    {googleUserPending.email}
                  </Text>
                </View>
              </View>
            )}

            {/* Invite Code Input */}
            <View style={{ marginBottom: 16 }}>
              <Text style={[styles.label, { color: themeColors.textPrimary, marginBottom: 6 }]}>
                {t("inviteCodeLabel")}
              </Text>
              <View
                style={[
                  styles.inputWithIcon,
                  { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                ]}
              >
                <MaterialCommunityIcons
                  name="key-outline"
                  size={20}
                  color={themeColors.maroonPrimary}
                  style={{ marginLeft: 12 }}
                />
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      color: themeColors.textPrimary,
                      textTransform: "uppercase",
                      fontWeight: "700",
                      letterSpacing: 1,
                    },
                  ]}
                  placeholder={t("inviteCodePlaceholder")}
                  placeholderTextColor={themeColors.textMuted}
                  value={googleInviteInput}
                  onChangeText={(text) => setGoogleInviteInput(text.toUpperCase())}
                  autoCapitalize="characters"
                />
              </View>
              <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 4 }}>
                {t("inviteCodeHint")}
              </Text>
            </View>

            {/* Activate Button */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={handleActivateGoogleAccount}
              disabled={isActivatingGoogle}
              style={[
                styles.primaryButton,
                { backgroundColor: themeColors.maroonPrimary },
                isActivatingGoogle && { opacity: 0.7 },
              ]}
            >
              {isActivatingGoogle ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.primaryButtonText}>{t("activateAccountBtn")}</Text>
              )}
            </TouchableOpacity>

            {/* Cancel Button */}
            <TouchableOpacity
              activeOpacity={0.7}
              onPress={handleCancelGoogleModal}
              disabled={isActivatingGoogle}
              style={{
                marginTop: 10,
                paddingVertical: 10,
                alignItems: "center",
              }}
            >
              <Text style={{ fontSize: 13, color: themeColors.textMuted, fontWeight: "600" }}>
                {t("cancelRegistrationBtn")}
              </Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
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
    fontSize: 28,
    fontWeight: "800",
    color: THEME.maroonPrimary,
    letterSpacing: -0.5,
  },
  brandCategory: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 2,
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


