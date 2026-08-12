import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Alert,
  Modal,
  Image,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import { KeyboardAwareForm } from "@/components/KeyboardAwareForm";
import { requestCalendarPermissions } from "@/services/calendar";
import { requestNotificationPermissions } from "@/services/notifications";
import { signInWithGoogle, initializeGoogleSignIn } from "@/services/auth";

const { width } = Dimensions.get("window");

export default function OnboardingScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeColors, language, toggleLanguage, isDark, saveOnboardingCompleted } = useAppSettings();
  const isBM = language === "BM";

  const [step, setStep] = useState(0);
  const [agentName, setAgentName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = React.useRef<ScrollView>(null);

  const handleInputFocus = (offset: number) => {
    requestAnimationFrame(() => {
      scrollViewRef.current?.scrollTo({
        y: offset,
        animated: true,
      });
    });
  };

  // Permission explanation modal state
  const [showPermissionModal, setShowPermissionModal] = useState(false);

  useEffect(() => {
    initializeGoogleSignIn();
  }, []);

  const handleNext = () => {
    if (step === 1) {
      // Validate agent name before proceeding
      if (!agentName.trim()) {
        Alert.alert(
          isBM ? "Nama Diperlukan" : "Name Required",
          isBM
            ? "Sila masukkan nama penuh anda untuk meneruskan."
            : "Please enter your full name to continue."
        );
        return;
      }
    }
    if (step < 2) {
      setStep(step + 1);
    }
  };

  const handleBack = () => {
    if (step > 0) {
      setStep(step - 1);
    }
  };

  // Trigger both Notifications + Calendar permissions back-to-back
  const handleGrantAllPermissions = async () => {
    setShowPermissionModal(false);
    // Add small delay to let modal close animation finish
    await new Promise((resolve) => setTimeout(resolve, 350));

    try {
      // 1. Notifications first
      await requestNotificationPermissions();
      // Add delay to prevent race conditions on Android/iOS when returning from permission dialog
      await new Promise((resolve) => setTimeout(resolve, 500));
      // 2. Calendar second
      await requestCalendarPermissions();
    } catch (err) {
      console.error("Permission request error:", err);
    }
  };

  // "Get Started" / "Mula Ejen CRM" â€” show explanation modal first
  const handleGetStarted = () => {
    setShowPermissionModal(true);
  };

  // Final complete: save onboarding flag, go to login
  const completeOnboarding = async () => {
    try {
      await saveOnboardingCompleted(agentName);
      const currentUser = await AsyncStorage.getItem("currentUserUid");
      if (currentUser) {
        try {
          await firestore().collection("users").doc(currentUser).set(
            { onboardingCompleted: true, displayName: agentName.trim() || "User", updatedAt: new Date().toISOString() },
            { merge: true }
          );
        } catch (error: any) {
          const msg = String(error?.code || error?.message || "");
          if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) {
            console.warn("Firestore onboarding write denied; continuing locally.", error);
          } else {
            console.warn("Could not sync onboarding state to Firestore:", error);
          }
        }
      }
      router.replace("/login");
    } catch (e) {
      console.error(e);
      router.replace("/login");
    }
  };

  // After granting permissions, finish onboarding
  const handlePermissionsThenComplete = async () => {
    await handleGrantAllPermissions();
    await completeOnboarding();
  };

  // Skip permissions and finish
  const handleSkipPermissions = async () => {
    setShowPermissionModal(false);
    await completeOnboarding();
  };

  // Google sign-in during onboarding
  const handleGoogleSignIn = async () => {
    // Show permission explanation modal first, then sign in after
    setShowPermissionModal(true);
  };

  const handleGoogleSignInAfterPermissions = async () => {
    await handleGrantAllPermissions();

    try {
      setIsLoading(true);
      const signedInUser = await signInWithGoogle();
      await saveOnboardingCompleted(agentName || signedInUser.displayName || "User");
      await AsyncStorage.setItem("currentUserUid", signedInUser.uid);

      try {
        await firestore().collection("users").doc(signedInUser.uid).set(
          {
            uid: signedInUser.uid,
            displayName: signedInUser.displayName || agentName || "User",
            onboardingCompleted: true,
            updatedAt: new Date().toISOString(),
          },
          { merge: true }
        );
      } catch (error: any) {
        const msg = String(error?.code || error?.message || "");
        if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) {
          console.warn("Firestore sync denied after Google sign-in; continuing locally.", error);
        } else {
          console.warn("Google sign-in profile sync failed:", error);
        }
      }
      router.replace("/(tabs)");
    } catch (error: any) {
      console.error("Google Sign-In error:", error);
      Alert.alert(
        isBM ? "Ralat Log Masuk" : "Sign-In Error",
        error?.message || (isBM ? "Gagal log masuk dengan Google" : "Failed to sign in with Google")
      );
      // Still complete onboarding even if Google fails
      await completeOnboarding();
    } finally {
      setIsLoading(false);
    }
  };

  // Determine the mode for permission modal action
  const [pendingAction, setPendingAction] = useState<"getStarted" | "google">("getStarted");

  const onGetStartedPress = () => {
    setPendingAction("getStarted");
    setShowPermissionModal(true);
  };

  const onGooglePress = () => {
    setPendingAction("google");
    setShowPermissionModal(true);
  };

  const onModalGrant = async () => {
    if (pendingAction === "google") {
      await handleGoogleSignInAfterPermissions();
    } else {
      await handlePermissionsThenComplete();
    }
  };

  const onModalSkip = async () => {
    setShowPermissionModal(false);
    if (pendingAction === "google") {
      // Try Google sign-in without permissions
      try {
        setIsLoading(true);
        const signedInUser = await signInWithGoogle();
        await saveOnboardingCompleted(agentName || signedInUser.displayName || "User");
        await AsyncStorage.setItem("currentUserUid", signedInUser.uid);

        try {
          await firestore().collection("users").doc(signedInUser.uid).set(
            {
              uid: signedInUser.uid,
              displayName: signedInUser.displayName || agentName || "User",
              onboardingCompleted: true,
              updatedAt: new Date().toISOString(),
            },
            { merge: true }
          );
        } catch (error: any) {
          const msg = String(error?.code || error?.message || "");
          if (msg.includes("permission-denied") || msg.includes("PERMISSION_DENIED")) {
            console.warn("Firestore sync denied on skip-permission path; continuing locally.", error);
          } else {
            console.warn("Skip-permission user sync failed:", error);
          }
        }
        router.replace("/(tabs)");
      } catch (error: any) {
        console.error("Google Sign-In error:", error);
        await completeOnboarding();
      } finally {
        setIsLoading(false);
      }
    } else {
      await completeOnboarding();
    }
  };

  return (
    <View
      style={[
        styles.container,
        {
          backgroundColor: themeColors.canvasBackground,
          paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16),
        },
      ]}
    >
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.canvasBackground}
      />

      {/* Top Header Row: Progress dots + Language toggle */}
      <View style={styles.headerRow}>
        <View style={styles.progressBar}>
          {[0, 1, 2].map((s) => (
            <View
              key={s}
              style={[
                styles.progressDot,
                {
                  backgroundColor: s === step ? themeColors.maroonPrimary : themeColors.borderColor,
                  width: s === step ? 24 : 8,
                },
              ]}
            />
          ))}
        </View>

        {/* Language Toggle */}
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={toggleLanguage}
          style={[styles.langToggle, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor }]}
        >
          <MaterialCommunityIcons name="translate" size={16} color={themeColors.maroonPrimary} />
          <Text style={[styles.langToggleText, { color: themeColors.maroonPrimary }]}>
            {language === "BM" ? "EN" : "BM"}
          </Text>
        </TouchableOpacity>
      </View>

      <KeyboardAwareForm bottomPadding={180}>
        <View style={{ paddingHorizontal: 20 }}>
          {/* Step 0: Welcome */}
          {step === 0 && (
            <View style={styles.stepContainer}>
              <View style={[styles.iconFrame, { backgroundColor: themeColors.maroonLight }]}>
                <MaterialCommunityIcons name="domain" size={64} color={themeColors.maroonPrimary} />
              </View>

              <Text style={[styles.title, { color: themeColors.maroonPrimary }]}>
                {isBM ? "Selamat Datang ke Umi" : "Welcome to Umi"}
              </Text>

              <Text style={[styles.subtitle, { color: themeColors.textMuted }]}>
                DRT MASTER LISTING CRM
              </Text>

              <Text style={[styles.description, { color: themeColors.textSecondary }]}>
                {isBM
                  ? "Aplikasi CRM Master Listing & Penjejakan Kes terbaik untuk Ejen Hartanah Malaysia. Urus listing, kes transaksi, dan dokumen dengan teratur."
                  : "The ultimate Real Estate CRM & Case Tracking app for Malaysian Property Agents. Manage listings, transaction cases, and documents seamlessly."}
              </Text>

              {/* Feature highlights */}
              <View style={styles.featuresList}>
                {[
                  {
                    icon: "home-city-outline" as const,
                    titleBM: "Listing & Peti Besi Dokumen",
                    titleEN: "Listings & Document Vault",
                    subBM: "Simpan geran, SPA & gambar secara selamat",
                    subEN: "Store grants, SPA copies & photos securely",
                  },
                  {
                    icon: "calculator-variant-outline" as const,
                    titleBM: "Kalkulator DSR & Kelayakan",
                    titleEN: "DSR & Eligibility Calculator",
                    subBM: "Kira kelayakan pinjaman pelanggan segera",
                    subEN: "Calculate buyer loan eligibility instantly",
                  },
                  {
                    icon: "briefcase-check-outline" as const,
                    titleBM: "Penjejakan Kes Transaksi",
                    titleEN: "Transaction Case Tracking",
                    subBM: "Jejak status kes dari Viewing ke Completed",
                    subEN: "Track case status from Viewing to Completed",
                  },
                ].map((f, i) => (
                  <View
                    key={i}
                    style={[styles.featureItem, { backgroundColor: themeColors.surfaceContainer }]}
                  >
                    <View style={[styles.featureIconCircle, { backgroundColor: themeColors.maroonLight }]}>
                      <MaterialCommunityIcons name={f.icon} size={22} color={themeColors.maroonPrimary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.featureTitle, { color: themeColors.textPrimary }]}>
                        {isBM ? f.titleBM : f.titleEN}
                      </Text>
                      <Text style={[styles.featureSub, { color: themeColors.textMuted }]}>
                        {isBM ? f.subBM : f.subEN}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Step 1: Agent Profile */}
          {step === 1 && (
            <View style={styles.stepContainer}>
              <View style={[styles.iconFrame, { backgroundColor: themeColors.maroonLight }]}>
                <MaterialCommunityIcons name="account-edit-outline" size={64} color={themeColors.maroonPrimary} />
              </View>

              <Text style={[styles.title, { color: themeColors.maroonPrimary }]}>
                {isBM ? "Profil Ejen Anda" : "Your Agent Profile"}
              </Text>

              <Text style={[styles.description, { color: themeColors.textSecondary, marginBottom: 28 }]}>
                {isBM
                  ? "Masukkan nama penuh anda. Nama ini akan dipaparkan pada listing hartanah dan dokumen kes."
                  : "Enter your full name. This will be displayed on property listings and case documents."}
              </Text>

              <View style={styles.inputWrapper}>
                <Text style={[styles.label, { color: themeColors.textPrimary }]}>
                  {isBM ? "Nama Penuh *" : "Full Name *"}
                </Text>
                <TextInput
                  style={[
                    styles.textInput,
                    {
                      backgroundColor: themeColors.surfaceContainer,
                      borderColor: themeColors.borderColor,
                      color: themeColors.textPrimary,
                    },
                  ]}
                  placeholder={isBM ? "Cth: Azrul Baharum" : "e.g. Azrul Baharum"}
                  placeholderTextColor={themeColors.textMuted}
                  value={agentName}
                  onChangeText={setAgentName}
                  autoFocus={step === 1}
                  returnKeyType="next"
                  onFocus={() => handleInputFocus(220)}
                />
              </View>
            </View>
          )}

          {/* Step 2: Get Started / Sign In */}
          {step === 2 && (
            <View style={styles.stepContainer}>
              <View style={[styles.iconFrame, { backgroundColor: themeColors.maroonLight }]}>
                <MaterialCommunityIcons name="rocket-launch-outline" size={64} color={themeColors.maroonPrimary} />
              </View>

              <Text style={[styles.title, { color: themeColors.maroonPrimary }]}>
                {isBM ? "Sedia untuk Mula!" : "Ready to Go!"}
              </Text>

              <Text style={[styles.description, { color: themeColors.textSecondary, marginBottom: 32 }]}>
                {isBM
                  ? "Log masuk dengan akaun Google anda untuk menyimpan data anda dengan selamat di awan, atau teruskan ke halaman log masuk."
                  : "Sign in with your Google account to securely save your data to the cloud, or continue to the login page."}
              </Text>

              {/* Google Sign-In Button */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onGooglePress}
                disabled={isLoading}
                style={[
                  styles.googleBtn, { backgroundColor: themeColors.surfaceContainer, borderColor: themeColors.borderColor, },
                ]}
              >
                {isLoading ? (
                  <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
                ) : (
                  <>
                    <Image
                      source={require("../assets/google_logo.png")}
                      style={styles.googleLogo}
                      resizeMode="contain"
                    />
                    <Text style={[styles.googleBtnText, { color: themeColors.textPrimary }] }>
                      {isBM ? "Log Masuk dengan Google" : "Sign in with Google"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>

              {/* Divider */}
              <View style={styles.dividerRow}>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
                <Text style={[styles.dividerText, { color: themeColors.textMuted }]}>
                  {isBM ? "Atau" : "Or"}
                </Text>
                <View style={[styles.dividerLine, { backgroundColor: themeColors.borderColor }]} />
              </View>

              {/* Get Started / Continue to Login */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onGetStartedPress}
                disabled={isLoading}
                style={[styles.getStartedBtn, { backgroundColor: themeColors.maroonPrimary }]}
              >
                <Text style={styles.getStartedBtnText}>
                  {isBM ? "Teruskan ke Log Masuk" : "Continue to Login"}
                </Text>
                <MaterialCommunityIcons name="arrow-right" size={20} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          )}
        </View>
      </KeyboardAwareForm>

      {/* Footer Navigation Buttons (Step 0 & 1 only) */}
      {step < 2 && (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          {step > 0 ? (
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleBack}
              style={[styles.btnSecondary, { backgroundColor: themeColors.surfaceContainer }]}
            >
              <Text style={[styles.btnTextSecondary, { color: themeColors.textSecondary }]}>
                {isBM ? "Kembali" : "Back"}
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ flex: 1 }} />
          )}

          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleNext}
            style={[styles.btnPrimary, { backgroundColor: themeColors.maroonPrimary }]}
          >
            <Text style={styles.btnTextPrimary}>
              {isBM ? "Teruskan" : "Next"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Permission Explanation Modal */}
      <Modal
        visible={showPermissionModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowPermissionModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: themeColors.surfaceContainer }]}>
            {/* Shield Icon */}
            <View style={[styles.modalIconCircle, { backgroundColor: themeColors.maroonLight }]}>
              <MaterialCommunityIcons name="shield-check-outline" size={48} color={themeColors.maroonPrimary} />
            </View>

            <Text style={[styles.modalTitle, { color: themeColors.textPrimary }]}>
              {isBM ? "Kebenaran Diperlukan" : "Permissions Required"}
            </Text>

            <Text style={[styles.modalBody, { color: themeColors.textSecondary }]}>
              {isBM
                ? "Untuk memberikan pengalaman terbaik, Umi memerlukan akses berikut:"
                : "For the best experience, Umi needs the following access:"}
            </Text>

            {/* Permission items */}
            <View style={styles.modalPermList}>
              <View style={[styles.modalPermItem, { backgroundColor: themeColors.surfaceContainer }]}>
                <MaterialCommunityIcons name="bell-ring-outline" size={22} color="#10B981" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalPermTitle, { color: themeColors.textPrimary }]}>
                    {isBM ? "Notifikasi" : "Notifications"}
                  </Text>
                  <Text style={[styles.modalPermSub, { color: themeColors.textMuted }]}>
                    {isBM
                      ? "Makluman peringatan janji temu & tarikh akhir kes"
                      : "Appointment reminders & case milestone alerts"}
                  </Text>
                </View>
              </View>

              <View style={[styles.modalPermItem, { backgroundColor: themeColors.surfaceContainer }]}>
                <MaterialCommunityIcons name="calendar-month-outline" size={22} color="#4F46E5" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalPermTitle, { color: themeColors.textPrimary }]}>
                    {isBM ? "Kalendar" : "Calendar"}
                  </Text>
                  <Text style={[styles.modalPermSub, { color: themeColors.textMuted }]}>
                    {isBM
                      ? "Segerakkan janji temu hartanah ke kalendar telefon"
                      : "Sync property viewings to your device calendar"}
                  </Text>
                </View>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.modalActions}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onModalSkip}
                style={[styles.modalBtnSkip, { backgroundColor: themeColors.surfaceContainer }]}
              >
                <Text style={[styles.modalBtnSkipText, { color: themeColors.textSecondary }]}>
                  {isBM ? "Nanti Dahulu" : "Later"}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={onModalGrant}
                style={[styles.modalBtnGrant, { backgroundColor: themeColors.maroonPrimary }]}
              >
                <MaterialCommunityIcons name="check-circle-outline" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                <Text style={styles.modalBtnGrantText}>
                  {isBM ? "Teruskan & Benarkan" : "Continue & Grant"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 24,
    marginTop: 8,
    marginBottom: 8,
  },
  progressBar: {
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
  },
  progressDot: {
    height: 8,
    borderRadius: 4,
  },
  langToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  langToggleText: {
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  stepContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 24,
    paddingTop: 16,
  },
  iconFrame: {
    width: 120,
    height: 120,
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 28,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 2,
    textAlign: "center",
    marginBottom: 16,
  },
  description: {
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    paddingHorizontal: 8,
  },
  featuresList: {
    width: "100%",
    gap: 12,
    marginTop: 28,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 14,
    borderRadius: 14,
  },
  featureIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    justifyContent: "center",
    alignItems: "center",
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  featureSub: {
    fontSize: 12,
    lineHeight: 16,
  },
  inputWrapper: {
    width: "100%",
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
  textInput: {
    width: "100%",
    height: 52,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  // Google button
  googleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 52,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  googleLogo: {
    width: 24,
    height: 24,
  },
  googleBtnText: {
    fontSize: 15,
    fontWeight: "700",
  },
  // Divider
  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginVertical: 20,
    gap: 12,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    fontSize: 13,
    fontWeight: "600",
  },
  // Get Started
  getStartedBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
    height: 52,
    borderRadius: 14,
    gap: 8,
  },
  getStartedBtnText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  // Footer
  footer: {
    flexDirection: "row",
    gap: 14,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  btnPrimary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  btnSecondary: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  btnTextPrimary: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "700",
  },
  btnTextSecondary: {
    fontSize: 15,
    fontWeight: "700",
  },
  // Modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  modalCard: {
    width: "100%",
    maxWidth: 360,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 8,
  },
  modalIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
  },
  modalBody: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20,
  },
  modalPermList: {
    width: "100%",
    gap: 10,
    marginBottom: 24,
  },
  modalPermItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
  },
  modalPermTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalPermSub: {
    fontSize: 12,
    lineHeight: 16,
    marginTop: 2,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  modalBtnSkip: {
    flex: 1,
    height: 46,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnSkipText: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalBtnGrant: {
    flex: 1.4,
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  modalBtnGrantText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});



