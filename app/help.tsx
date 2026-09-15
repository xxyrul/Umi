import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Image,
  Platform,
  Linking,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import * as ImagePicker from "expo-image-picker";
import Animated, { FadeInDown, FadeIn } from "react-native-reanimated";
import Constants from "expo-constants";
import { useAppSettings } from "@/context/AppSettingsContext";
import { firebaseAuth } from "@/services/firebase";
import {
  FeedbackType,
  BugFrequency,
  FeedbackSubmission,
  submitFeedbackDocument,
  subscribeToUserFeedback,
  deleteFeedbackDocument,
} from "@/services/feedback";

type HelpTab = "submit" | "history" | "faq";

interface FAQItem {
  id: string;
  category: string;
  questionBM: string;
  questionEN: string;
  answerBM: string;
  answerEN: string;
  icon: string;
}

const FAQ_LIST: FAQItem[] = [
  {
    id: "invite_codes",
    category: "Pendaftaran & Kod",
    questionBM: "Bagaimana cara menjana & berkongsi kod jemputan ejen?",
    questionEN: "How to generate & share agent invite codes?",
    answerBM: "Pentadbir agensi boleh pergi ke Profil > Pusat Pentadbir > Kod Jemputan. Anda boleh menjana 1 kod pantas atau pek pukal (5, 10, 20 kod) dan kongsikan terus melalui WhatsApp dengan satu klik.",
    answerEN: "Agency administrators can go to Profile > Admin Hub > Invite Codes. You can generate 1 quick code or batch packs (5, 10, 20 codes) and share directly via WhatsApp with one tap.",
    icon: "ticket-percent-outline",
  },
  {
    id: "dsr_calc",
    category: "Kalkulator & Kewangan",
    questionBM: "Bagaimana formula DSR & kelayakan pinjaman dikira?",
    questionEN: "How is DSR & loan eligibility calculated?",
    answerBM: "Kalkulator DSR Artha mematuhi garis panduan Bank Negara Malaysia (BNM) & LPPSA. Ia mengira Nisbah Khidmat Hutang (DSR) berdasarkan pendapatan bersih bulanan dan komitmen semasa mengikut had ambang bank tempatan (sehingga 70-85%).",
    answerEN: "Artha's DSR Calculator follows Bank Negara Malaysia (BNM) & LPPSA guidelines. It calculates the Debt Service Ratio based on net monthly income and existing bank commitments up to Malaysian bank threshold limits (70-85%).",
    icon: "calculator-variant-outline",
  },
  {
    id: "offline_mode",
    category: "Sistem & Cache",
    questionBM: "Bolehkah saya menggunakan aplikasi semasa tiada internet (Offline)?",
    questionEN: "Can I use the app while offline?",
    answerBM: "Ya! Artha dilengkapi sistem cache tempatan (Firestore Offline Persistence). Listing dan kes yang telah dimuat sebelum ini boleh dibuka dan disemak walaupun anda berada di tapak projek tanpa liputan data.",
    answerEN: "Yes! Artha includes Firestore Offline Persistence. Previously loaded listings and cases can be viewed and reviewed even when at a project site without cellular data.",
    icon: "cloud-sync-outline",
  },
  {
    id: "doc_vault",
    category: "Keselamatan & Dokumen",
    questionBM: "Bagaimana keselamatan dokumen geran, IC & SPA dilindungi?",
    questionEN: "How is document security for Titles, IC & SPA handled?",
    answerBM: "Semua dokumen sensitif (IC pemilik, geran, salinan SPA) dienkripsi dalam storan selamat Firebase dan hanya boleh diakses oleh ejen yang mengendalikan kes tersebut atau pentadbir agensi.",
    answerEN: "All sensitive documents (owner IC, title grants, SPA copies) are encrypted in Firebase secure vaults and strictly restricted to the managing agent and verified agency administrators.",
    icon: "shield-lock-outline",
  },
  {
    id: "agent_approval",
    category: "Pendaftaran Ejen",
    questionBM: "Berapa lama masa diambil untuk permohonan akses ejen disahkan?",
    questionEN: "How long does new agent access approval take?",
    answerBM: "Pentadbir agensi menerima notifikasi secara langsung apabila permohonan baru dihantar. Pengesahan biasanya selesai dalam masa beberapa jam.",
    answerEN: "Agency administrators receive instant live queue notifications when new requests are submitted. Verification is typically completed within a few hours.",
    icon: "account-clock-outline",
  },
  {
    id: "share_listing",
    category: "Listing & Jualan",
    questionBM: "Bagaimana cara berkongsi listing ke WhatsApp pelanggan?",
    questionEN: "How to share property listings to client WhatsApp?",
    answerBM: "Buka butiran listing pilihan anda, tekan butang 'Kongsi WhatsApp'. Mesej terformat rapi bersama spesifikasi rumah dan pautan gambar akan dijana secara automatik.",
    answerEN: "Open your desired listing detail, tap the 'Share WhatsApp' button. A beautifully formatted property brochure with specs and image links will be generated automatically.",
    icon: "share-variant-outline",
  },
];

export default function HelpScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, isDark, language } = useAppSettings();
  const isBM = language === "BM";
  const currentUser = firebaseAuth.currentUser;

  const [activeTab, setActiveTab] = useState<HelpTab>("submit");

  // Form State
  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"Low" | "Medium" | "High" | "Critical">("Medium");
  const [steps, setSteps] = useState<string[]>([""]);
  const [expectedBehavior, setExpectedBehavior] = useState("");
  const [actualBehavior, setActualBehavior] = useState("");
  const [frequency, setFrequency] = useState<BugFrequency>("always");
  const [rating, setRating] = useState<number>(5);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Submissions State
  const [mySubmissions, setMySubmissions] = useState<FeedbackSubmission[]>([]);
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string | null>(null);

  // FAQ State
  const [faqSearch, setFaqSearch] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string | null>(null);

  // Auto-Diagnostics Metadata
  const appVersion = Constants.nativeApplicationVersion || Constants.expoConfig?.version || "1.5.2";
  const buildNumber = Constants.nativeBuildVersion || "57";
  const deviceModel =
    Platform.OS === "android"
      ? `${(Platform.constants as any)?.Manufacturer || ""} ${(Platform.constants as any)?.Model || "Android"}`.trim()
      : `${Platform.OS} Device`;
  const osVersion = Platform.Version ? `${Platform.OS} ${Platform.Version}` : Platform.OS;

  useEffect(() => {
    if (currentUser?.uid) {
      const unsub = subscribeToUserFeedback(currentUser.uid, setMySubmissions);
      return () => {
        if (typeof unsub === "function") unsub();
      };
    }
  }, [currentUser?.uid]);

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

  const handleSubmit = async () => {
    if (!title.trim()) {
      Alert.alert(
        isBM ? "Tajuk Diperlukan" : "Title Required",
        isBM ? "Sila masukkan tajuk ringkas untuk maklum balas anda." : "Please enter a brief feedback title."
      );
      return;
    }

    if (!description.trim() && feedbackType !== "General") {
      Alert.alert(
        isBM ? "Penerangan Diperlukan" : "Description Required",
        isBM ? "Sila masukkan butiran atau keterangan masalah." : "Please provide feedback description."
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

      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        isBM ? "Maklum Balas Berjaya Dihantar! 🎉" : "Feedback Submitted! 🎉",
        isBM
          ? "Terima kasih! Maklum balas anda telah disimpan dan kini boleh dijejak di tab 'Sejarah Saya'."
          : "Thank you! Your feedback has been recorded and can now be tracked in 'My Submissions'.",
        [
          {
            text: isBM ? "Lihat Sejarah" : "View History",
            onPress: () => setActiveTab("history"),
          },
          { text: "OK" },
        ]
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

  const handleDeleteSubmission = (subId: string) => {
    Alert.alert(
      isBM ? "Padam Maklum Balas?" : "Delete Feedback?",
      isBM ? "Adakah anda pasti ingin memadam rekod maklum balas ini dari sejarah?" : "Are you sure you want to delete this feedback from your history?",
      [
        { text: isBM ? "Batal" : "Cancel", style: "cancel" },
        {
          text: isBM ? "Padam" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await deleteFeedbackDocument(subId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert("Error", isBM ? "Gagal memadam maklum balas." : "Failed to delete feedback.");
            }
          },
        },
      ]
    );
  };

  const filteredFaq = FAQ_LIST.filter((f) => {
    if (!faqSearch.trim()) return true;
    const q = faqSearch.toLowerCase().trim();
    const text = (isBM ? `${f.questionBM} ${f.answerBM} ${f.category}` : `${f.questionEN} ${f.answerEN} ${f.category}`).toLowerCase();
    return text.includes(q);
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      {/* Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: 16,
          paddingTop: 8,
          paddingBottom: 14,
          borderBottomWidth: 1,
          borderBottomColor: themeColors.borderColor,
          backgroundColor: themeColors.cardBackground,
        }}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => router.back()}
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
            <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
          </TouchableOpacity>
          <View>
            <Text style={{ fontSize: 17.5, fontWeight: "800", color: themeColors.textPrimary }}>
              {isBM ? "Bantuan & Maklum Balas" : "Help & Feedback"}
            </Text>
            <Text style={{ fontSize: 11.5, color: themeColors.textMuted }}>
              Artha Quality & Support Hub
            </Text>
          </View>
        </View>
      </View>

      {/* Top Segmented Navigation Tabs */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 6 }}>
        <View
          style={{
            flexDirection: "row",
            backgroundColor: themeColors.surfaceContainer,
            borderRadius: 14,
            padding: 4,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            gap: 4,
          }}
        >
          {[
            { id: "submit" as HelpTab, label: isBM ? "Maklum Balas" : "Submit", icon: "square-edit-outline" },
            { id: "history" as HelpTab, label: isBM ? `Sejarah (${mySubmissions.length})` : `History (${mySubmissions.length})`, icon: "history" },
            { id: "faq" as HelpTab, label: isBM ? "Soalan Lazim" : "FAQ", icon: "help-circle-outline" },
          ].map((t) => {
            const isActive = activeTab === t.id;
            const activeBg = isDark ? "#881337" : themeColors.maroonPrimary;
            return (
              <TouchableOpacity
                key={t.id}
                activeOpacity={0.8}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setActiveTab(t.id);
                }}
                style={{
                  flex: 1,
                  paddingVertical: 9,
                  borderRadius: 10,
                  backgroundColor: isActive ? activeBg : "transparent",
                  alignItems: "center",
                  justifyContent: "center",
                  flexDirection: "row",
                  gap: 5,
                }}
              >
                <MaterialCommunityIcons
                  name={t.icon as any}
                  size={15}
                  color={isActive ? "#FFFFFF" : themeColors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "800",
                    color: isActive ? "#FFFFFF" : themeColors.textPrimary,
                  }}
                  numberOfLines={1}
                >
                  {t.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Main Content Area */}
      <ScrollView
        contentContainerStyle={{
          padding: 16,
          paddingBottom: Math.max(insets.bottom, 24) + 60,
          gap: 16,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* ========================================================================= */}
        {/* TAB 1: HANTAR MAKLUM BALAS / SUBMIT FORM */}
        {/* ========================================================================= */}
        {activeTab === "submit" && (
          <View style={{ gap: 16 }}>
            {/* Category Selector */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 8, textTransform: "uppercase" }}>
                {isBM ? "Pilih Jenis Maklum Balas" : "Select Feedback Type"}
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {[
                  { type: "Bug" as FeedbackType, label: isBM ? "Bug" : "Bug", icon: "bug-outline", color: "#EF4444" },
                  { type: "Feature" as FeedbackType, label: isBM ? "Cadangan" : "Feature", icon: "lightbulb-outline", color: "#F59E0B" },
                  { type: "Performance" as FeedbackType, label: isBM ? "Prestasi" : "Speed", icon: "speedometer", color: "#10B981" },
                  { type: "General" as FeedbackType, label: isBM ? "Ulasan" : "Rating", icon: "star-outline", color: "#3B82F6" },
                ].map((c) => {
                  const isSel = feedbackType === c.type;
                  const activeBg = isDark ? "#881337" : themeColors.maroonPrimary;
                  const activeBorder = isDark ? "#BE123C" : themeColors.maroonPrimary;
                  return (
                    <TouchableOpacity
                      key={c.type}
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setFeedbackType(c.type);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 10,
                        paddingHorizontal: 4,
                        borderRadius: 12,
                        backgroundColor: isSel ? activeBg : themeColors.surfaceContainer,
                        borderWidth: 1.5,
                        borderColor: isSel ? activeBorder : themeColors.borderColor,
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
                          fontSize: 11,
                          fontWeight: "800",
                          color: isSel ? "#FFFFFF" : themeColors.textPrimary,
                          textAlign: "center",
                        }}
                        numberOfLines={1}
                      >
                        {c.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Star Rating Box (for General/Review) */}
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
                <Text style={{ fontSize: 14.5, fontWeight: "800", color: themeColors.textPrimary }}>
                  {isBM ? "Bagaimana penilaian anda terhadap aplikasi Artha?" : "How would you rate the Artha App?"}
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
                {isBM ? "Tajuk Ringkas" : "Title / Summary"}
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
                    ? (isBM ? "Cth: Ralat semasa muat naik dokumen geran" : "E.g. Error when uploading title grant")
                    : feedbackType === "Feature"
                    ? (isBM ? "Cth: Tambah fungsi eksport borang SPA PDF" : "E.g. Add export SPA PDF document feature")
                    : (isBM ? "Cth: Pengalaman penggunaan & cadangan" : "E.g. App experience and feedback")
                }
                placeholderTextColor={themeColors.textMuted}
                value={title}
                onChangeText={setTitle}
              />
            </View>

            {/* Specialized Bug Section: Steps to Reproduce & Expected vs Actual */}
            {feedbackType === "Bug" && (
              <View
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 16,
                  borderWidth: 1.5,
                  borderColor: "rgba(239, 68, 68, 0.35)",
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

                {/* Step rows */}
                {steps.map((step, index) => (
                  <View key={index} style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <View
                      style={{
                        width: 26,
                        height: 26,
                        borderRadius: 13,
                        backgroundColor: themeColors.surfaceContainer,
                        alignItems: "center",
                        justifyContent: "center",
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                      }}
                    >
                      <Text style={{ fontSize: 11.5, fontWeight: "800", color: themeColors.textPrimary }}>
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
                        paddingVertical: 9,
                        fontSize: 13,
                        color: themeColors.textPrimary,
                      }}
                      placeholder={
                        index === 0
                          ? (isBM ? "Buka halaman / skrin mana..." : "Open which screen...")
                          : index === 1
                          ? (isBM ? "Buat tindakan atau tekan apa..." : "Tap button or action...")
                          : (isBM ? "Apa yang berlaku seterusnya..." : "What happens next...")
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

                {/* Expected & Actual */}
                <View style={{ gap: 10, marginTop: 4 }}>
                  <View>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 4 }}>
                      {isBM ? "Hasil Dijangka (Apa yang sepatutnya berlaku):" : "Expected Behavior:"}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: themeColors.surfaceContainer,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: themeColors.textPrimary,
                      }}
                      placeholder={isBM ? "Cth: Senarai berjaya ditapis..." : "E.g. List filtered successfully..."}
                      placeholderTextColor={themeColors.textMuted}
                      value={expectedBehavior}
                      onChangeText={setExpectedBehavior}
                    />
                  </View>

                  <View>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 4 }}>
                      {isBM ? "Hasil Sebenar (Ralat yang terjadi):" : "Actual Behavior:"}
                    </Text>
                    <TextInput
                      style={{
                        backgroundColor: themeColors.surfaceContainer,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        paddingHorizontal: 12,
                        paddingVertical: 9,
                        fontSize: 13,
                        color: themeColors.textPrimary,
                      }}
                      placeholder={isBM ? "Cth: Aplikasi tersekat atau keluar ralat..." : "E.g. App freezes or crashes..."}
                      placeholderTextColor={themeColors.textMuted}
                      value={actualBehavior}
                      onChangeText={setActualBehavior}
                    />
                  </View>

                  {/* Frequency */}
                  <View>
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                      {isBM ? "Kekerapan Masalah:" : "Issue Frequency:"}
                    </Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                      {[
                        { id: "always" as BugFrequency, label: isBM ? "Setiap Kali" : "Always" },
                        { id: "sometimes" as BugFrequency, label: isBM ? "Sekali-sekala" : "Sometimes" },
                        { id: "once" as BugFrequency, label: isBM ? "Sekali Sahaja" : "Only Once" },
                      ].map((f) => {
                        const isSel = frequency === f.id;
                        return (
                          <TouchableOpacity
                            key={f.id}
                            onPress={() => setFrequency(f.id)}
                            style={{
                              flex: 1,
                              height: 38,
                              borderRadius: 10,
                              backgroundColor: isSel ? "#EF4444" : themeColors.surfaceContainer,
                              borderWidth: 1,
                              borderColor: isSel ? "#DC2626" : themeColors.borderColor,
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 11.5,
                                fontWeight: "800",
                                color: isSel ? "#FFFFFF" : themeColors.textMuted,
                              }}
                            >
                              {f.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  </View>
                </View>
              </View>
            )}

            {/* Description Text Area */}
            <View>
              <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                {isBM ? "Penerangan Terperinci" : "Detailed Description"}
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
                    ? (isBM ? "Sebarang maklumat tambahan yang membantu developer memahami masalah..." : "Any additional notes to help developers...")
                    : (isBM ? "Kongsikan butiran lanjut atau cadangan penambahbaikan..." : "Share further details or improvement ideas...")
                }
                placeholderTextColor={themeColors.textMuted}
                multiline
                numberOfLines={4}
                value={description}
                onChangeText={setDescription}
              />
            </View>

            {/* Screenshot Attachment */}
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
                        {isBM ? "Padam Gambar" : "Remove Image"}
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

            {/* Auto Diagnostics Box */}
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

            {/* Action Button */}
            <View style={{ marginTop: 8 }}>
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={() => handleSubmit()}
                disabled={isSubmitting}
                style={{
                  backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                  height: 50,
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
            </View>
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: SEJARAH MAKLUM BALAS / MY SUBMISSIONS */}
        {/* ========================================================================= */}
        {activeTab === "history" && (
          <View style={{ gap: 12 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
              <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                {isBM ? "Sejarah Maklum Balas Anda" : "Your Feedback Submissions"}
              </Text>
              <View style={{ backgroundColor: themeColors.surfaceContainer, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8 }}>
                <Text style={{ fontSize: 11, fontWeight: "800", color: themeColors.textPrimary }}>
                  {mySubmissions?.length || 0}
                </Text>
              </View>
            </View>

            {(!mySubmissions || mySubmissions.length === 0) ? (
              <View
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  padding: 28,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons name="inbox-outline" size={36} color={themeColors.textMuted} />
                <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                  {isBM ? "Tiada Sejarah Maklum Balas" : "No Submissions Yet"}
                </Text>
                <Text style={{ fontSize: 12.5, color: themeColors.textMuted, textAlign: "center" }}>
                  {isBM
                    ? "Sebarang laporan bug atau cadangan ciri yang anda hantar akan dipaparkan di sini bersama status terkini."
                    : "Any bugs or suggestions you submit will be tracked here in real-time."}
                </Text>
                <TouchableOpacity
                  onPress={() => setActiveTab("submit")}
                  style={{
                    marginTop: 6,
                    backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                    paddingHorizontal: 16,
                    paddingVertical: 8,
                    borderRadius: 10,
                  }}
                >
                  <Text style={{ fontSize: 12.5, fontWeight: "800", color: "#FFFFFF" }}>
                    {isBM ? "Hantar Sekarang" : "Submit Feedback"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              mySubmissions.map((sub, index) => {
                const subId = sub?.id || `sub_${index}`;
                const isExpanded = expandedSubmissionId === subId;
                const status = typeof sub?.status === "string" ? sub.status.toLowerCase() : "pending";
                const statusColor =
                  status === "resolved"
                    ? "#10B981"
                    : status === "in-progress"
                    ? "#3B82F6"
                    : "#F59E0B";

                const statusLabel =
                  status === "resolved"
                    ? (isBM ? "Selesai" : "Resolved")
                    : status === "in-progress"
                    ? (isBM ? "Dalam Tindakan" : "In Progress")
                    : (isBM ? "Menunggu Semakan" : "Pending Review");

                const subType = sub?.type ? String(sub.type) : "General";
                const subTitle = sub?.title ? String(sub.title) : (isBM ? "Maklum Balas" : "Feedback");
                const subDescription = sub?.description ? String(sub.description) : "";
                const stepsList = Array.isArray(sub?.stepsToReproduce) ? sub.stepsToReproduce : [];

                return (
                  <TouchableOpacity
                    key={subId}
                    activeOpacity={0.85}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                      setExpandedSubmissionId(isExpanded ? null : subId);
                    }}
                    style={{
                      backgroundColor: themeColors.cardBackground,
                      borderRadius: 14,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      padding: 14,
                      gap: 8,
                    }}
                  >
                    {/* Header Row */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <MaterialCommunityIcons
                          name={
                            subType === "Bug"
                              ? "bug-outline"
                              : subType === "Feature"
                              ? "lightbulb-outline"
                              : subType === "Performance"
                              ? "speedometer"
                              : "star-outline"
                          }
                          size={16}
                          color={
                            subType === "Bug"
                              ? "#EF4444"
                              : subType === "Feature"
                              ? "#F59E0B"
                              : "#3B82F6"
                          }
                        />
                        <Text style={{ fontSize: 11, fontWeight: "800", color: themeColors.textMuted }}>
                          {subType.toUpperCase()}
                        </Text>
                      </View>

                      {/* Status Pill & Delete Button */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                        <View
                          style={{
                            backgroundColor: `${statusColor}22`,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                            borderWidth: 1,
                            borderColor: `${statusColor}44`,
                          }}
                        >
                          <Text style={{ fontSize: 10.5, fontWeight: "800", color: statusColor }}>
                            {statusLabel}
                          </Text>
                        </View>

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleDeleteSubmission(sub.id || subId)}
                          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          style={{
                            padding: 4,
                            borderRadius: 6,
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                          }}
                        >
                          <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Title */}
                    <Text style={{ fontSize: 14.5, fontWeight: "800", color: themeColors.textPrimary }}>
                      {subTitle}
                    </Text>

                    {/* Description preview */}
                    {!!subDescription && (
                      <Text style={{ fontSize: 12.5, color: themeColors.textMuted }} numberOfLines={isExpanded ? undefined : 2}>
                        {subDescription}
                      </Text>
                    )}

                    {/* Expanded details */}
                    {isExpanded && (
                      <View style={{ gap: 8, marginTop: 4, paddingTop: 8, borderTopWidth: 1, borderTopColor: themeColors.borderColor }}>
                        {stepsList.length > 0 && (
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: "800", color: themeColors.textPrimary, marginBottom: 3 }}>
                              {isBM ? "Langkah-langkah:" : "Steps:"}
                            </Text>
                            {stepsList.map((st, idx) => (
                              <Text key={idx} style={{ fontSize: 12, color: themeColors.textMuted }}>
                                {idx + 1}. {String(st)}
                              </Text>
                            ))}
                          </View>
                        )}

                        {sub?.expectedBehavior ? (
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#10B981", marginBottom: 2 }}>
                              {isBM ? "Hasil Dijangka:" : "Expected Behavior:"}
                            </Text>
                            <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                              {String(sub.expectedBehavior)}
                            </Text>
                          </View>
                        ) : null}

                        {sub?.actualBehavior ? (
                          <View>
                            <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#EF4444", marginBottom: 2 }}>
                              {isBM ? "Hasil Sebenar:" : "Actual Behavior:"}
                            </Text>
                            <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                              {String(sub.actualBehavior)}
                            </Text>
                          </View>
                        ) : null}

                        {sub?.adminResponse ? (
                          <View style={{ backgroundColor: themeColors.surfaceContainer, padding: 10, borderRadius: 8, marginTop: 4 }}>
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#10B981", marginBottom: 2 }}>
                              {isBM ? "Maklum Balas Pentadbir / Pembangun:" : "Admin/Developer Response:"}
                            </Text>
                            <Text style={{ fontSize: 12, color: themeColors.textPrimary }}>
                              {String(sub.adminResponse)}
                            </Text>
                          </View>
                        ) : null}

                        {sub?.screenshotUrl ? (
                          <Image
                            source={{ uri: sub.screenshotUrl }}
                            style={{ width: "100%", height: 140, borderRadius: 8, marginTop: 4 }}
                            resizeMode="cover"
                          />
                        ) : null}

                        <Text style={{ fontSize: 11, color: themeColors.textMuted, fontStyle: "italic", marginTop: 2 }}>
                          {isBM ? "Dihantar pada:" : "Submitted on:"}{" "}
                          {(() => {
                            if (!sub.createdAt) return "-";
                            try {
                              if (typeof sub.createdAt === "string") {
                                const d = new Date(sub.createdAt);
                                return isNaN(d.getTime()) ? sub.createdAt : d.toLocaleDateString();
                              }
                              if (typeof (sub.createdAt as any)?.toDate === "function") {
                                return (sub.createdAt as any).toDate().toLocaleDateString();
                              }
                              if (typeof (sub.createdAt as any)?.seconds === "number") {
                                return new Date((sub.createdAt as any).seconds * 1000).toLocaleDateString();
                              }
                              return String(sub.createdAt);
                            } catch {
                              return "-";
                            }
                          })()}
                        </Text>
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
            )}
          </View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SOALAN LAZIM (FAQ) */}
        {/* ========================================================================= */}
        {activeTab === "faq" && (
          <View style={{ gap: 12 }}>
            {/* Search FAQ */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: themeColors.cardBackground,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                paddingHorizontal: 12,
                paddingVertical: 2,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={18} color={themeColors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 8,
                  fontSize: 13.5,
                  color: themeColors.textPrimary,
                }}
                placeholder={isBM ? "Cari soalan atau panduan..." : "Search questions or guides..."}
                placeholderTextColor={themeColors.textMuted}
                value={faqSearch}
                onChangeText={setFaqSearch}
              />
              {faqSearch.length > 0 && (
                <TouchableOpacity onPress={() => setFaqSearch("")} style={{ padding: 4 }}>
                  <MaterialCommunityIcons name="close-circle" size={16} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* FAQ Accordion List */}
            {filteredFaq.map((item) => {
              const isExpanded = expandedFaqId === item.id;
              return (
                <TouchableOpacity
                  key={item.id}
                  activeOpacity={0.85}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                    setExpandedFaqId(isExpanded ? null : item.id);
                  }}
                  style={{
                    backgroundColor: themeColors.cardBackground,
                    borderRadius: 14,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    padding: 14,
                    gap: 8,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1, paddingRight: 8 }}>
                      <MaterialCommunityIcons name={item.icon as any} size={18} color={themeColors.maroonPrimary} />
                      <Text style={{ fontSize: 13.5, fontWeight: "800", color: themeColors.textPrimary, flex: 1 }}>
                        {isBM ? item.questionBM : item.questionEN}
                      </Text>
                    </View>
                    <MaterialCommunityIcons
                      name={isExpanded ? "chevron-up" : "chevron-down"}
                      size={20}
                      color={themeColors.textMuted}
                    />
                  </View>

                  {isExpanded && (
                    <View style={{ paddingTop: 6, borderTopWidth: 1, borderTopColor: themeColors.borderColor }}>
                      <Text style={{ fontSize: 13, color: themeColors.textMuted, lineHeight: 19 }}>
                        {isBM ? item.answerBM : item.answerEN}
                      </Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

