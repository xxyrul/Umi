import { firebaseAuth, firebaseDB } from "@/services/firebase";
import storage from "@react-native-firebase/storage";
import { Platform, Linking } from "react-native";
import Constants from "expo-constants";

export type FeedbackType = "Bug" | "Feature" | "Performance" | "General";
export type BugFrequency = "always" | "sometimes" | "once";
export type FeedbackStatus = "pending" | "in-progress" | "resolved" | "closed";

export interface FeedbackSubmission {
  id?: string;
  userId: string;
  userEmail: string;
  userName: string;
  userPhone?: string;
  type: FeedbackType;
  title: string;
  description: string;
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  frequency?: BugFrequency;
  severity?: "Low" | "Medium" | "High" | "Critical";
  rating?: number;
  appVersion: string;
  buildNumber: string;
  platform: string;
  osVersion: string;
  deviceModel: string;
  screenshotUrl?: string;
  status: FeedbackStatus;
  adminResponse?: string;
  createdAt: string;
  updatedAt: string;
}

const SUPPORT_DEVELOPER_PHONE = "601110887728"; // Support line

export async function uploadFeedbackScreenshot(imageUri: string, userId: string): Promise<string | undefined> {
  try {
    const filename = `feedback/${userId}/${Date.now()}_screenshot.jpg`;
    const reference = storage().ref(filename);

    const cleanPath = imageUri.replace("file://", "");
    await reference.putFile(cleanPath);
    return await reference.getDownloadURL();
  } catch (err) {
    console.warn("Feedback screenshot upload warning:", err);
    return undefined;
  }
}

export async function submitFeedbackDocument(
  data: {
    type: FeedbackType;
    title: string;
    description: string;
    stepsToReproduce?: string[];
    expectedBehavior?: string;
    actualBehavior?: string;
    frequency?: BugFrequency;
    severity?: "Low" | "Medium" | "High" | "Critical";
    rating?: number;
  },
  screenshotUri?: string | null
): Promise<string> {
  const user = firebaseAuth.currentUser;
  const userId = user?.uid || "anonymous";
  const userEmail = user?.email || "anonymous@artha.app";
  const userName = user?.displayName || "Agent";
  const now = new Date().toISOString();

  let screenshotUrl: string | undefined = undefined;
  if (screenshotUri) {
    screenshotUrl = await uploadFeedbackScreenshot(screenshotUri, userId);
  }

  const appVersion = Constants.nativeApplicationVersion || Constants.expoConfig?.version || "1.6.0";
  const buildNumber = Constants.nativeBuildVersion || "58";
  const osVersion = Platform.Version ? `${Platform.OS} ${Platform.Version}` : Platform.OS;
  const deviceModel =
    Platform.OS === "android"
      ? `${(Platform.constants as any)?.Manufacturer || ""} ${(Platform.constants as any)?.Model || "Android"}`.trim()
      : `${Platform.OS} Device`;

  const payload: Omit<FeedbackSubmission, "id"> = {
    userId,
    userEmail,
    userName,
    type: data.type,
    title: data.title.trim(),
    description: data.description.trim(),
    stepsToReproduce: data.stepsToReproduce?.filter((s) => s.trim().length > 0) || [],
    expectedBehavior: data.expectedBehavior?.trim() || "",
    actualBehavior: data.actualBehavior?.trim() || "",
    frequency: data.frequency || "always",
    severity: data.severity || "Medium",
    rating: data.rating !== undefined ? data.rating : (data.type === "General" ? 5 : undefined),
    appVersion: appVersion.startsWith("v") ? appVersion : `v${appVersion}`,
    buildNumber,
    platform: Platform.OS,
    osVersion,
    deviceModel,
    screenshotUrl: screenshotUrl || "",
    status: "pending",
    createdAt: now,
    updatedAt: now,
  };

  const docRef = await firebaseDB.collection("feedback").add(payload);
  return docRef.id;
}

export function subscribeToUserFeedback(
  userId: string,
  callback: (submissions: FeedbackSubmission[]) => void
): () => void {
  if (!userId) {
    callback([]);
    return () => {};
  }

  try {
    const unsubscribe = firebaseDB
      .collection("feedback")
      .where("userId", "==", userId)
      .onSnapshot(
        (snapshot) => {
          if (!snapshot) {
            callback([]);
            return;
          }
          const list: FeedbackSubmission[] = [];
          snapshot.forEach((doc) => {
            list.push({ id: doc.id, ...(doc.data() as any) });
          });
          // Sort newest first safely without assuming createdAt is string
          list.sort((a, b) => {
            const getMillis = (v: any) => {
              if (!v) return 0;
              if (typeof v === "string") {
                const t = new Date(v).getTime();
                return isNaN(t) ? 0 : t;
              }
              if (typeof v?.toMillis === "function") return v.toMillis();
              if (typeof v?.seconds === "number") return v.seconds * 1000;
              if (v instanceof Date) return v.getTime();
              return 0;
            };
            return getMillis(b.createdAt) - getMillis(a.createdAt);
          });
          callback(list);
        },
        (error) => {
          console.warn("User feedback subscription error:", error);
          callback([]);
        }
      );

    return typeof unsubscribe === "function" ? unsubscribe : () => {};
  } catch (err) {
    console.warn("subscribeToUserFeedback exception:", err);
    callback([]);
    return () => {};
  }
}

export async function deleteFeedbackDocument(feedbackId: string): Promise<void> {
  if (!feedbackId) return;
  await firebaseDB.collection("feedback").doc(feedbackId).delete();
}

export function openWhatsAppFeedbackDispatch(data: {
  type: FeedbackType;
  title: string;
  description: string;
  stepsToReproduce?: string[];
  expectedBehavior?: string;
  actualBehavior?: string;
  frequency?: BugFrequency;
  appVersion?: string;
}) {
  const user = firebaseAuth.currentUser;
  const userName = user?.displayName || "Agent";
  const userEmail = user?.email || "";
  const version = data.appVersion || `v${Constants.nativeApplicationVersion || "1.5.2"}`;
  const device = `${Platform.OS} (${Platform.Version})`;

  let stepsText = "";
  if (data.stepsToReproduce && data.stepsToReproduce.length > 0) {
    stepsText = `\n\n*🔢 Langkah Mengulangi Masalah:*\n` +
      data.stepsToReproduce.map((step, i) => `${i + 1}. ${step}`).join("\n");
  }

  let expActText = "";
  if (data.expectedBehavior || data.actualBehavior) {
    expActText = `\n\n*⚖️ Hasil Dijangka:* ${data.expectedBehavior || "-"}\n*💥 Hasil Sebenar:* ${data.actualBehavior || "-"}`;
  }

  const message =
    `*🚨 LAPORAN MAKLUM BALAS / BUG ARTHA*\n` +
    `------------------------------------\n` +
    `*Jenis:* ${data.type.toUpperCase()}\n` +
    `*Ejen:* ${userName} (${userEmail})\n` +
    `*Versi:* ${version} | ${device}\n` +
    `*Tajuk:* *${data.title}*\n\n` +
    `*Butiran:* ${data.description}` +
    stepsText +
    expActText +
    (data.frequency ? `\n*Kekerapan:* ${data.frequency}` : "");

  const url = `whatsapp://send?phone=${SUPPORT_DEVELOPER_PHONE}&text=${encodeURIComponent(message)}`;
  Linking.openURL(url).catch(() => {
    Linking.openURL(`https://wa.me/${SUPPORT_DEVELOPER_PHONE}?text=${encodeURIComponent(message)}`).catch(() => {});
  });
}