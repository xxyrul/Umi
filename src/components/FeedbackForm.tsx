import React, { useState } from "react";
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
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { SPACING } from "@/constants/theme";
import { firestore, auth } from "@/services/firebase";
import storage from "@react-native-firebase/storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import Constants from "expo-constants";

export type FeedbackType = "Bug" | "Feature" | "Feedback";
export type SeverityLevel = "Low" | "Medium" | "High" | "Critical";
export type FeatureCategory = "UI" | "Performance" | "Workflow" | "Integration" | "Other";

export interface FeedbackSubmission {
  id: string;
  userId: string;
  userEmail: string;
  userName: string;
  type: FeedbackType;
  severity?: SeverityLevel;
  category?: FeatureCategory;
  title: string;
  description: string;
  appVersion: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  screenshotUrl?: string;
  status: "new" | "reviewed" | "planned" | "in-progress" | "implemented" | "wont-fix";
  createdAt: string;
  updatedAt: string;
  adminNotes?: string;
  votes: number;
}

interface FeedbackFormProps {
  visible: boolean;
  onClose: () => void;
  caseId?: string;
  caseName?: string;
}

export const FeedbackForm: React.FC<FeedbackFormProps> = ({
  visible,
  onClose,
  caseId,
  caseName,
}) => {
  const { themeColors, language } = useAppSettings();
  const currentUser = auth().currentUser;

  const [feedbackType, setFeedbackType] = useState<FeedbackType>("Bug");
  const [severity, setSeverity] = useState<SeverityLevel>("Medium");
  const [category, setCategory] = useState<FeatureCategory>("UI");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const severityColors = {
    Low: "#3B82F6",
    Medium: "#F59E0B",
    High: "#EF4444",
    Critical: "#DC2626",
  };

  const pickScreenshot = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [16, 9],
        quality: 0.7,
      });

      if (!result.canceled) {
        setScreenshot(result.assets[0].uri);
      }
    } catch (error) {
      Alert.alert("Error", "Failed to pick image");
    }
  };

  const uploadScreenshot = async (imageUri: string): Promise<string | undefined> => {
    try {
      const response = await fetch(imageUri);
      const blob = await response.blob();
      const fileName = `feedback/${currentUser?.uid}/${Date.now()}.jpg`;
      const ref = storage().ref(fileName);
      await ref.put(blob);
      return await ref.getDownloadURL();
    } catch (error) {
      console.error("Screenshot upload error:", error);
      return undefined;
    }
  };

  const handleSubmitFeedback = async () => {
    if (!title.trim() || !description.trim()) {
      Alert.alert("Missing Info", "Please fill in title and description");
      return;
    }

    setIsSubmitting(true);

    try {
      let screenshotUrl: string | undefined;
      if (screenshot) {
        screenshotUrl = await uploadScreenshot(screenshot);
      }

      const submittedAt = new Date().toISOString();
      const appVersion = Constants.expoConfig?.version || "1.0.0";

      const feedbackData: Omit<FeedbackSubmission, "id"> = {
        userId: currentUser?.uid || "anonymous",
        userEmail: currentUser?.email || "unknown@email.com",
        userName: currentUser?.displayName || "Anonymous",
        type: feedbackType,
        severity: feedbackType === "Bug" ? severity : undefined,
        category: feedbackType === "Feature" ? category : undefined,
        title: title.trim(),
        description: description.trim(),
        appVersion,
        platform: Platform.OS === "ios" ? "iOS" : Platform.OS === "android" ? "Android" : "Web",
        osVersion: Platform.Version?.toString() || "Unknown",
        deviceModel: `${Platform.OS} Device`,
        screenshotUrl,
        status: "new",
        createdAt: submittedAt,
        updatedAt: submittedAt,
        votes: 1,
      };

      const docRef = await firestore().collection("feedback").add(feedbackData);

      // If linked to a case, also store reference
      if (caseId) {
        await firestore()
          .collection("cases")
          .doc(caseId)
          .update({
            linkedFeedback: firestore.FieldValue.arrayUnion({
              feedbackId: docRef.id,
              type: feedbackType,
              createdAt: submittedAt,
            }),
          })
          .catch(() => {
            // Case might not have this field yet, silently fail
          });
      }

      Alert.alert(
        "Success",
        language === "BM"
          ? "Terima kasih atas maklum balas anda! Tim kami akan mengkaji segera."
          : "Thank you! Your feedback has been submitted. We'll review it shortly."
      );

      // Reset form
      setTitle("");
      setDescription("");
      setScreenshot(null);
      setSeverity("Medium");
      setCategory("UI");
      onClose();
    } catch (error) {
      console.error("Feedback submission error:", error);
      Alert.alert("Error", "Failed to submit feedback");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <View
        style={{
          flex: 1,
          backgroundColor: themeColors.canvasBackground,
          paddingTop: Platform.OS === "ios" ? 60 : 40,
        }}
      >
        {/* Header */}
        <View
          style={{
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "space-between",
            paddingHorizontal: SPACING.lg,
            paddingBottom: SPACING.md,
            borderBottomWidth: 1,
            borderBottomColor: themeColors.borderColor,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: "700",
              color: themeColors.textPrimary,
            }}
          >
            {language === "BM" ? "Hantar Maklum Balas" : "Send Feedback"}
          </Text>
          <TouchableOpacity onPress={onClose} disabled={isSubmitting}>
            <MaterialCommunityIcons
              name="close"
              size={24}
              color={themeColors.textMuted}
            />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={{
            padding: SPACING.lg,
            paddingBottom: SPACING.xl,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Feedback Type Selector */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: themeColors.maroonPrimary,
              textTransform: "uppercase",
              marginBottom: SPACING.sm,
            }}
          >
            {language === "BM" ? "Jenis Maklum Balas" : "Feedback Type"}
          </Text>
          <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg }}>
            {(["Bug", "Feature", "Feedback"] as FeedbackType[]).map((type) => (
              <TouchableOpacity
                key={type}
                onPress={() => setFeedbackType(type)}
                style={{
                  flex: 1,
                  paddingVertical: SPACING.md,
                  paddingHorizontal: SPACING.sm,
                  borderRadius: 10,
                  backgroundColor:
                    feedbackType === type
                      ? themeColors.maroonPrimary
                      : themeColors.surfaceContainer,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  alignItems: "center",
                  gap: SPACING.xs,
                }}
              >
                <MaterialCommunityIcons
                  name={
                    type === "Bug"
                      ? "bug"
                      : type === "Feature"
                      ? "lightbulb"
                      : "chat"
                  }
                  size={20}
                  color={
                    feedbackType === type
                      ? "#FFF"
                      : themeColors.textMuted
                  }
                />
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color:
                      feedbackType === type
                        ? "#FFF"
                        : themeColors.textPrimary,
                  }}
                >
                  {type}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Severity / Category Selector */}
          {feedbackType === "Bug" && (
            <>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: themeColors.maroonPrimary,
                  textTransform: "uppercase",
                  marginBottom: SPACING.sm,
                }}
              >
                {language === "BM" ? "Tahap Keterukan" : "Severity"}
              </Text>
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg }}>
                {(["Low", "Medium", "High", "Critical"] as SeverityLevel[]).map((sev) => (
                  <TouchableOpacity
                    key={sev}
                    onPress={() => setSeverity(sev)}
                    style={{
                      flex: 1,
                      paddingVertical: SPACING.sm,
                      borderRadius: 8,
                      backgroundColor:
                        severity === sev
                          ? (severityColors as any)[sev]
                          : themeColors.surfaceContainer,
                      alignItems: "center",
                      borderWidth: 1,
                      borderColor:
                        severity === sev
                          ? (severityColors as any)[sev]
                          : themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: severity === sev ? "#FFF" : themeColors.textPrimary,
                      }}
                    >
                      {sev}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {feedbackType === "Feature" && (
            <>
              <Text
                style={{
                  fontSize: 12,
                  fontWeight: "600",
                  color: themeColors.maroonPrimary,
                  textTransform: "uppercase",
                  marginBottom: SPACING.sm,
                }}
              >
                {language === "BM" ? "Kategori" : "Category"}
              </Text>
              <View style={{ flexDirection: "row", gap: SPACING.sm, marginBottom: SPACING.lg, flexWrap: "wrap" }}>
                {(["UI", "Performance", "Workflow", "Integration", "Other"] as FeatureCategory[]).map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={{
                      paddingVertical: SPACING.sm,
                      paddingHorizontal: SPACING.md,
                      borderRadius: 8,
                      backgroundColor:
                        category === cat
                          ? themeColors.maroonPrimary
                          : themeColors.surfaceContainer,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "600",
                        color: category === cat ? "#FFF" : themeColors.textPrimary,
                      }}
                    >
                      {cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </>
          )}

          {/* Title */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: themeColors.maroonPrimary,
              textTransform: "uppercase",
              marginBottom: SPACING.sm,
            }}
          >
            {language === "BM" ? "Tajuk" : "Title"}
          </Text>
          <TextInput
            placeholder={
              feedbackType === "Bug"
                ? "e.g. App crashes when opening listings"
                : "e.g. Add bulk import for listings"
            }
            value={title}
            onChangeText={setTitle}
            style={{
              backgroundColor: themeColors.surfaceContainer,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              borderRadius: 10,
              paddingHorizontal: SPACING.md,
              paddingVertical: SPACING.md,
              color: themeColors.textPrimary,
              marginBottom: SPACING.lg,
              fontSize: 14,
            }}
            placeholderTextColor={themeColors.textMuted}
            editable={!isSubmitting}
          />

          {/* Description */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: themeColors.maroonPrimary,
              textTransform: "uppercase",
              marginBottom: SPACING.sm,
            }}
          >
            {language === "BM" ? "Butiran" : "Description"}
          </Text>
          <TextInput
            placeholder={
              feedbackType === "Bug"
                ? "What happened? When does it occur? What's expected?"
                : "Why would this help? How would you use it?"
            }
            value={description}
            onChangeText={setDescription}
            multiline
            numberOfLines={6}
            style={{
              backgroundColor: themeColors.surfaceContainer,
              borderWidth: 1,
              borderColor: themeColors.borderColor,
              borderRadius: 10,
              paddingHorizontal: SPACING.md,
              paddingVertical: SPACING.md,
              color: themeColors.textPrimary,
              marginBottom: SPACING.lg,
              fontSize: 14,
              textAlignVertical: "top",
            }}
            placeholderTextColor={themeColors.textMuted}
            editable={!isSubmitting}
          />

          {/* Screenshot */}
          <Text
            style={{
              fontSize: 12,
              fontWeight: "600",
              color: themeColors.maroonPrimary,
              textTransform: "uppercase",
              marginBottom: SPACING.sm,
            }}
          >
            {language === "BM" ? "Gambar Skrin (Pilihan)" : "Screenshot (Optional)"}
          </Text>
          {screenshot ? (
            <View style={{ marginBottom: SPACING.lg }}>
              <Image
                source={{ uri: screenshot }}
                style={{
                  width: "100%",
                  height: 200,
                  borderRadius: 10,
                  marginBottom: SPACING.sm,
                }}
              />
              <TouchableOpacity
                onPress={() => setScreenshot(null)}
                disabled={isSubmitting}
                style={{
                  padding: SPACING.sm,
                  backgroundColor: "#EF4444",
                  borderRadius: 8,
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#FFF", fontWeight: "600" }}>
                  {language === "BM" ? "Buang" : "Remove"}
                </Text>
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              onPress={pickScreenshot}
              disabled={isSubmitting}
              style={{
                borderWidth: 2,
                borderStyle: "dashed",
                borderColor: themeColors.borderColor,
                borderRadius: 10,
                paddingVertical: SPACING.lg,
                alignItems: "center",
                justifyContent: "center",
                marginBottom: SPACING.lg,
              }}
            >
              <MaterialCommunityIcons
                name="image-plus"
                size={32}
                color={themeColors.maroonPrimary}
              />
              <Text
                style={{
                  marginTop: SPACING.sm,
                  color: themeColors.textMuted,
                  fontSize: 12,
                }}
              >
                {language === "BM"
                  ? "Tap para pilih gambar"
                  : "Tap to pick screenshot"}
              </Text>
            </TouchableOpacity>
          )}

          {/* Case Link Info */}
          {caseId && caseName && (
            <View
              style={{
                backgroundColor: themeColors.maroonLight,
                borderRadius: 10,
                padding: SPACING.md,
                marginBottom: SPACING.lg,
                flexDirection: "row",
                alignItems: "center",
                gap: SPACING.sm,
              }}
            >
              <MaterialCommunityIcons
                name="link-variant"
                size={20}
                color={themeColors.maroonPrimary}
              />
              <View style={{ flex: 1 }}>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: "600",
                    color: themeColors.maroonPrimary,
                  }}
                >
                  {language === "BM" ? "Tertaut Dengan Kes" : "Linked to Case"}
                </Text>
                <Text
                  style={{
                    fontSize: 13,
                    color: themeColors.maroonPrimary,
                    marginTop: 2,
                  }}
                >
                  {caseName}
                </Text>
              </View>
            </View>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleSubmitFeedback}
            disabled={isSubmitting}
            style={{
              backgroundColor: isSubmitting
                ? themeColors.textMuted
                : themeColors.maroonPrimary,
              paddingVertical: SPACING.md,
              borderRadius: 10,
              alignItems: "center",
              flexDirection: "row",
              justifyContent: "center",
              gap: SPACING.sm,
            }}
          >
            {isSubmitting && <ActivityIndicator color="#FFF" size="small" />}
            <Text
              style={{
                color: "#FFF",
                fontWeight: "700",
                fontSize: 15,
              }}
            >
              {language === "BM" ? "Hantar Maklum Balas" : "Submit Feedback"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({});
