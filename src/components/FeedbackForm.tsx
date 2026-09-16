import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  Modal,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  StyleSheet,
  KeyboardAvoidingView,
  Keyboard,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";
import Constants from "expo-constants";
import { SPACING } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";
import {
  FeedbackType,
  BugFrequency,
  submitFeedbackDocument,
  openWhatsAppFeedbackDispatch,
} from "@/services/feedback";

interface FeedbackFormProps {
  visible: boolean;
  onClose: () => void;
  caseId?: string;
  caseName?: string;
  initialType?: FeedbackType;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  visible,
  onClose,
  caseId,
  caseName,
  initialType = "Bug",
}) => {
  const insets = useSafeAreaInsets();
  const { themeColors, isDark, language } = useAppSettings();
  const isBM = language === "BM";

  const [feedbackType, setFeedbackType] = useState<FeedbackType>(initialType);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");

  // Bug reproduction states
  const [steps, setSteps] = useState<string[]>([""]);
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [frequency, setFrequency] = useState<BugFrequency>("always");

  // General rating state
  const [rating, setRating] = useState<number>(5);

  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);

  useEffect(() => {
    const showSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow",
      (e) => {
        setKeyboardHeight(e.endCoordinates.height);
      }
    );
    const hideSub = Keyboard.addListener(
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide",
      () => {
        setKeyboardHeight(0);
      }
    );
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Diagnostics metadata
  const appVersion = Constants.nativeApplicationVersion || Constants.expoConfig?.version || "1.5.2";
  const buildNumber = Constants.nativeBuildVersion || "57";
  const deviceModel =
    Platform.OS === "android"
      ? `${(Platform.constants as any)?.Manufacturer || ""} ${(Platform.constants as any)?.Model || "Android"}`.trim()
      : `${Platform.OS} Device`;
  const osVersion = Platform.Version ? `${Platform.OS} ${Platform.Version}` : Platform.OS;

  const handleAddStep = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSteps([...steps, ""]);
  };

  const handleUpdateStep = (text: string, index: number) => {
    const updated = [...steps];
    updated[index] = text;
    setSteps(updated);
  };

  const handleRemoveStep = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const updated = steps.filter((_, i) => i !== index);
    setSteps(updated.length > 0 ? updated : [""]);
  };

  const pickScreenshot = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
      });

      if (!result.canceled) {
        setScreenshot(result.assets[0].uri);
      }
    } catch {
      Alert.alert("Error", isBM ? "Gagal memilih gambar." : "Failed to pick image");
    }
  };

  const handleSubmit = async (openWhatsApp = false) => {
    if (!title.trim()) {
      Alert.alert(
        isBM ? "Tajuk Diperlukan" : "Title Required",
        isBM ? "Sila masukkan tajuk maklum balas atau masalah." : "Please enter a feedback title."
      );
      return;
    }

    if (!description.trim() && feedbackType !== "General") {
      Alert.alert(
        isBM ? "Penerangan Diperlukan" : "Description Required",
        isBM ? "Sila terangkan sedikit butiran maklum balas anda." : "Please provide feedback details."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await submitFeedbackDocument(
        {
          type: feedbackType,
          title,
          description: description || `Rating: ${rating} Star`,
          stepsToReproduce: feedbackType === "Bug" ? steps : undefined,
          expectedBehavior: feedbackType === "Bug" ? expectedBehavior : undefined,
          actualBehavior: feedbackType === "Bug" ? actualBehavior : undefined,
          frequency: feedbackType === "Bug" ? frequency : undefined,
          severity: feedbackType === "Bug" ? severity : undefined,
          rating: feedbackType === "General" ? rating : undefined,
        },
        screenshot
      );

      if (openWhatsApp) {
        openWhatsAppFeedbackDispatch({
          type: feedbackType,
          title,
          description,
          stepsToReproduce: steps,
          expectedBehavior,
          actualBehavior,
          frequency,
        });
      }

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        isBM ? "Maklum Balas Diterima! 🎉" : "Feedback Submitted! 🎉",
        isBM
          ? "Terima kasih! Maklum balas anda telah disimpan dan akan disemak oleh pasukan pembangun."
          : "Thank you! Your feedback has been recorded and will be reviewed by our development team.",
        [{ text: "OK", onPress: () => onClose() }]
      );

      // Reset
      setTitle("");
      setDescription("");
      setSteps([""]);
      setExpectedBehavior("");
      setActualBehavior("");
      setScreenshot(null);
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to submit feedback.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: 16,
            paddingTop: insets.top + 8,
            paddingBottom: 14,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.borderColor,
            backgroundColor: themeColors.cardBackground,
          }}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                onClose();
              }}
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                backgroundColor: themeColors.surfaceContainer,
                alignItems: "center",
                justifyContent: "center",
                borderWidth: 1,
                borderColor: themeColors.borderColor,
              }}
            >
              <MaterialCommunityIcons name="close" size={20} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <View>
              <Text style={{ fontSize: 17, fontWeight: "800", color: themeColors.textPrimary }}>
                {isBM ? "Hantar Maklum Balas" : "Send Feedback"}
              </Text>
              <Text style={{ fontSize: 11.5, color: themeColors.textMuted }}>
                Artha Quality & Experience Suite
              </Text>
            </View>
          </View>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: 16,
            paddingBottom: Math.max(insets.bottom, 24) + (keyboardHeight > 0 ? keyboardHeight + 40 : 40),
            gap: 16,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Category Chips */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
              {isBM ? "Pilih Kategori" : "Select Category"}
            </Text>
            <View style={{ flexDirection: "row", gap: 8 }}>
              {[
                { type: "Bug" as FeedbackType, label: isBM ? "Lapor Bug" : "Report Bug", icon: "bug-outline", color: "#EF4444" },
                { type: "Feature" as FeedbackType, label: isBM ? "Cadangan Ciri" : "Feature", icon: "lightbulb-outline", color: "#F59E0B" },
                { type: "General" as FeedbackType, label: isBM ? "Ulasan" : "Rating & Review", icon: "star-outline", color: "#3B82F6" },
              ].map((c) => {
                const isSel = feedbackType === c.type;
                return (
                  <TouchableOpacity
                    key={c.type}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setFeedbackType(c.type);
                    }}
                    style={{
                      flex: 1,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      borderRadius: 12,
                      backgroundColor: isSel ? (isDark ? "#881337" : themeColors.maroonPrimary) : themeColors.surfaceContainer,
                      borderWidth: 1.5,
                      borderColor: isSel ? (isDark ? "#BE123C" : themeColors.maroonPrimary) : themeColors.borderColor,
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 4,
                    }}
                  >
                    <MaterialCommunityIcons
                      name={c.icon as any}
                      size={18}
                      color={isSel ? "#FFFFFF" : themeColors.textMuted}
                    />
                    <Text
                      style={{
                        fontSize: 11.5,
                        fontWeight: "800",
                        color: isSel ? "#FFFFFF" : themeColors.textPrimary,
                        textAlign: "center",
                      }}
                    >
                      {c.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Star Rating for General Feedback */}
          {feedbackType === "General" && (
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 14,
                padding: 16,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                alignItems: "center",
                gap: 8,
              }}
            >
              <Text style={{ fontSize: 14, fontWeight: "800", color: themeColors.textPrimary }}>
                {isBM ? "Bagaimana pengalaman anda menggunakan Artha?" : "How is your experience with Artha?"}
              </Text>
              <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                {[1, 2, 3, 4, 5].map((s) => (
                  <TouchableOpacity
                    key={s}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setRating(s);
                    }}
                  >
                    <MaterialCommunityIcons
                      name={rating >= s ? "star" : "star-outline"}
                      size={32}
                      color={rating >= s ? "#F59E0B" : themeColors.textMuted}
                    />
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#F59E0B" }}>
                {rating === 5
                  ? "⭐⭐⭐⭐⭐ Cemerlang! (Excellent)"
                  : rating === 4
                  ? "⭐⭐⭐⭐ Sangat Baik (Very Good)"
                  : rating === 3
                  ? "⭐⭐⭐ Memuaskan (Satisfactory)"
                  : rating === 2
                  ? "⭐⭐ Perlu Diperbaiki (Needs Work)"
                  : "⭐ Kurang Memuaskan (Poor)"}
              </Text>
            </View>
          )}

          {/* Title Input */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
              {isBM ? "Tajuk Masalah / Cadangan" : "Title / Summary"}
            </Text>
            <TextInput
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 14,
                color: themeColors.textPrimary,
                fontWeight: "700",
              }}
              placeholder={
                feedbackType === "Bug"
                  ? (isBM ? "Cth: Skrin tertutup semasa tapis carian" : "E.g. App crashes when filtering listings")
                  : (isBM ? "Cth: Tambah pengiraan DSR automatik" : "E.g. Add instant loan eligibility calculator")
              }
              placeholderTextColor={themeColors.textMuted}
              value={title}
              onChangeText={setTitle}
            />
          </View>

          {/* Bug-Specific Section: Steps to Reproduce */}
          {feedbackType === "Bug" && (
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: "rgba(239, 68, 68, 0.3)",
                padding: 14,
                gap: 12,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <MaterialCommunityIcons name="format-list-numbered" size={18} color="#EF4444" />
                  <Text style={{ fontSize: 13.5, fontWeight: "800", color: themeColors.textPrimary }}>
                    {isBM ? "Langkah Mengulangi Masalah" : "Steps to Reproduce"}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={handleAddStep}
                  style={{
                    backgroundColor: "rgba(239, 68, 68, 0.12)",
                    paddingHorizontal: 8,
                    paddingVertical: 4,
                    borderRadius: 6,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 3,
                  }}
                >
                  <MaterialCommunityIcons name="plus" size={14} color="#EF4444" />
                  <Text style={{ fontSize: 11, fontWeight: "800", color: "#EF4444" }}>
                    {isBM ? "Tambah Langkah" : "Add Step"}
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Numbered Steps Inputs */}
              {steps.map((step, index) => (
                <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <View
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: 12,
                      backgroundColor: themeColors.surfaceContainer,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: themeColors.textPrimary }}>
                      {index + 1}
                    </Text>
                  </View>
                  <TextInput
                    style={{
                      flex: 1,
                      backgroundColor: themeColors.surfaceContainer,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: themeColors.textPrimary,
                    }}
                    placeholder={
                      index === 0
                        ? (isBM ? "1. Buka halaman / tab mana..." : "1. Go to screen...")
                        : index === 1
                        ? (isBM ? "2. Tekan butang atau buat apa..." : "2. Tap button or action...")
                        : (isBM ? `${index + 1}. Apa yang berlaku seterusnya...` : `${index + 1}. What happens next...`)
                    }
                    placeholderTextColor={themeColors.textMuted}
                    value={step}
                    onChangeText={(t) => handleUpdateStep(t, index)}
                  />
                  {steps.length > 1 && (
                    <TouchableOpacity onPress={() => handleRemoveStep(index)} style={{ padding: 4 }}>
                      <MaterialCommunityIcons name="close-circle-outline" size={18} color="#EF4444" />
                    </TouchableOpacity>
                  )}
                </View>
              ))}

              {/* Expected vs Actual */}
              <View style={{ gap: 10, marginTop: 4 }}>
                <View>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 4 }}>
                    {isBM ? "Hasil Dijangka (Expected Behavior):" : "Expected Behavior:"}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: themeColors.textPrimary,
                    }}
                    placeholder={isBM ? "Apa yang sepatutnya berlaku..." : "What should happen..."}
                    placeholderTextColor={themeColors.textMuted}
                    value={expectedBehavior}
                    onChangeText={setExpectedBehavior}
                  />
                </View>

                <View>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 4 }}>
                    {isBM ? "Hasil Sebenar (Actual Behavior):" : "Actual Behavior:"}
                  </Text>
                  <TextInput
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      fontSize: 13,
                      color: themeColors.textPrimary,
                    }}
                    placeholder={isBM ? "Apa yang berlaku (cth: skrin putih, ralat)..." : "What actually happened..."}
                    placeholderTextColor={themeColors.textMuted}
                    value={actualBehavior}
                    onChangeText={setActualBehavior}
                  />
                </View>

                {/* Occurrence Frequency */}
                <View>
                  <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                    {isBM ? "Kekerapan Masalah:" : "Frequency:"}
                  </Text>
                  <View style={{ flexDirection: "row", gap: 6 }}>
                    {[
                      { id: "always" as BugFrequency, label: isBM ? "Setiap Kali" : "Always" },
                      { id: "sometimes" as BugFrequency, label: isBM ? "Sekali-sekala" : "Sometimes" },
                      { id: "once" as BugFrequency, label: isBM ? "Sekali Sahaja" : "Only Once" },
                    ].map((f) => (
                      <TouchableOpacity
                        key={f.id}
                        onPress={() => setFrequency(f.id)}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          borderRadius: 8,
                          backgroundColor: frequency === f.id ? "#EF4444" : themeColors.surfaceContainer,
                          alignItems: "center",
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 11,
                            fontWeight: "800",
                            color: frequency === f.id ? "#FFFFFF" : themeColors.textMuted,
                          }}
                        >
                          {f.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>
            </View>
          )}

          {/* Description Input */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
              {isBM ? "Penerangan Tambahan" : "Detailed Description"}
            </Text>
            <TextInput
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 12,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                paddingHorizontal: 14,
                paddingVertical: 10,
                fontSize: 13.5,
                color: themeColors.textPrimary,
                minHeight: 80,
                textAlignVertical: "top",
              }}
              placeholder={
                feedbackType === "Bug"
                  ? (isBM ? "Sebarang maklumat tambahan atau catatan berkaitan..." : "Any additional notes...")
                  : (isBM ? "Terangkan bagaimana cadangan ini membantu kerja harian anda..." : "Describe how this helps your workflow...")
              }
              placeholderTextColor={themeColors.textMuted}
              multiline
              numberOfLines={4}
              value={description}
              onChangeText={setDescription}
            />
          </View>

          {/* Screenshot Picker Card */}
          <View>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
              {isBM ? "Tangkapan Skrin (Pilihan)" : "Screenshot (Optional)"}
            </Text>
            {screenshot ? (
              <View
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 14,
                  padding: 10,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  gap: 8,
                }}
              >
                <Image source={{ uri: screenshot }} style={{ width: "100%", height: 160, borderRadius: 10 }} resizeMode="cover" />
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 11.5, color: "#10B981", fontWeight: "700" }}>
                    ✓ {isBM ? "Gambar dilampirkan" : "Image attached"}
                  </Text>
                  <TouchableOpacity onPress={() => setScreenshot(null)} style={{ padding: 4 }}>
                    <Text style={{ fontSize: 12, color: "#EF4444", fontWeight: "800" }}>
                      {isBM ? "Padam" : "Remove"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <TouchableOpacity
                onPress={pickScreenshot}
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 14,
                  borderWidth: 1.5,
                  borderStyle: "dashed",
                  borderColor: themeColors.borderColor,
                  paddingVertical: 16,
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 6,
                }}
              >
                <MaterialCommunityIcons name="camera-plus-outline" size={24} color={themeColors.textMuted} />
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Muat Naik Gambar Skrin" : "Attach Screenshot"}
                </Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Auto-Captured Device Diagnostics Banner */}
          <View
            style={{
              backgroundColor: themeColors.surfaceContainer,
              borderRadius: 12,
              padding: 12,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              gap: 4,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <MaterialCommunityIcons name="chip" size={16} color="#10B981" />
                <Text style={{ fontSize: 12, fontWeight: "800", color: themeColors.textPrimary }}>
                  {isBM ? "Diagnostik Peranti Disertakan" : "Device Diagnostics Attached"}
                </Text>
              </View>
              <View style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#10B981" }}>AUTO</Text>
              </View>
            </View>
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
              App: v{appVersion} ({buildNumber}) • {deviceModel} • {osVersion}
            </Text>
          </View>

          {/* Action Buttons */}
          <View style={{ gap: 10, marginTop: 4 }}>
            {/* 1. Primary Submit to Database */}
            <TouchableOpacity
              activeOpacity={0.85}
              onPress={() => handleSubmit(false)}
              disabled={isSubmitting}
              style={{
                backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                paddingVertical: 14,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 8,
                borderWidth: 1,
                borderColor: isDark ? "#BE123C" : themeColors.maroonPrimary,
              }}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <MaterialCommunityIcons name="send" size={18} color="#FFFFFF" />
                  <Text style={{ fontSize: 14.5, fontWeight: "800", color: "#FFFFFF" }}>
                    {isBM ? "Hantar Maklum Balas" : "Submit Feedback"}
                  </Text>
                </>
              )}
            </TouchableOpacity>

            {/* 2. Direct WhatsApp Urgent Support */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={() => handleSubmit(true)}
              disabled={isSubmitting}
              style={{
                backgroundColor: "rgba(37, 211, 102, 0.12)",
                paddingVertical: 12,
                borderRadius: 14,
                alignItems: "center",
                justifyContent: "center",
                flexDirection: "row",
                gap: 6,
                borderWidth: 1,
                borderColor: "rgba(37, 211, 102, 0.3)",
              }}
            >
              <MaterialCommunityIcons name="whatsapp" size={18} color="#25D366" />
              <Text style={{ fontSize: 13, fontWeight: "800", color: "#25D366" }}>
                {isBM ? "Hantar & Terus ke WhatsApp Bantuan" : "Submit & Open WhatsApp Support"}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

