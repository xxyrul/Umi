import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
  Linking,
  Platform,
  StatusBar,
  StyleSheet,
  Share,
  Dimensions,
  Image,
  KeyboardAvoidingView,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import * as Haptics from "expo-haptics";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";

import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";
import {
  AdminAgent,
  subscribeToPendingAgents,
  subscribeToAllAgents,
  approveAgent,
  rejectOrSuspendAgent,
  updateAgentRole,
  subscribeToInviteCodes,
  generateBatchInviteCodes,
  sendBroadcastAnnouncement,
  updateAgencyListingStatus,
  subscribeToAllFeedback,
  updateFeedbackStatus,
  deleteFeedbackAsAdmin,
  BroadcastPayload,
} from "@/services/admin";
import {
  createInviteCode,
  revokeInviteCode,
  deleteInviteCode,
  batchRevokeInviteCodes,
  batchDeleteInviteCodes,
  deleteAllRevokedInviteCodes,
  InviteCodeDoc,
} from "@/services/inviteCodes";
import { FeedbackSubmission, FeedbackStatus } from "@/services/feedback";
import { getUserInitials, getUserRole } from "@/services/auth";
import { firebaseAuth, firebaseDB } from "@/services/firebase";
import { PropertyListing } from "@/types/listing";

type AdminTab = "approvals" | "invite_codes" | "broadcast" | "listings" | "feedback";

export default function AdminHubScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { themeColors, isDark, language } = useAppSettings();

  const [activeTab, setActiveTab] = useState<AdminTab>("approvals");

  // ScrollView Refs for Auto-Scrolling Tabs & Content
  const tabScrollViewRef = useRef<ScrollView>(null);
  const mainScrollViewRef = useRef<ScrollView>(null);
  const tabLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});

  const scrollToTab = (tabId: string) => {
    const layout = tabLayouts.current[tabId];
    if (layout && tabScrollViewRef.current) {
      const screenWidth = Dimensions.get("window").width;
      const targetX = Math.max(0, layout.x - screenWidth / 2 + layout.width / 2);
      tabScrollViewRef.current.scrollTo({ x: targetX, animated: true });
    }
  };

  const handleSelectTab = (tabId: AdminTab) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setActiveTab(tabId);
    scrollToTab(tabId);
    mainScrollViewRef.current?.scrollTo({ y: 0, animated: false });
  };

  // State: Agent Approvals & Directory
  const [pendingAgents, setPendingAgents] = useState<AdminAgent[]>([]);
  const [allAgents, setAllAgents] = useState<AdminAgent[]>([]);
  const [agentSearch, setAgentSearch] = useState("");
  const [processingUid, setProcessingUid] = useState<string | null>(null);

  // State: Invite Codes
  const [inviteCodes, setInviteCodes] = useState<InviteCodeDoc[]>([]);
  const [codePrefix, setCodePrefix] = useState("ART");
  const [codeNotes, setCodeNotes] = useState("");
  const [batchCount, setBatchCount] = useState<5 | 10 | 20>(5);
  const [codeMode, setCodeMode] = useState<"SINGLE" | "BATCH">("SINGLE");
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [codeFilter, setCodeFilter] = useState<"ALL" | "ACTIVE" | "USED" | "REVOKED">("ALL");
  const [codeSearch, setCodeSearch] = useState("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [isGeneratorOpen, setIsGeneratorOpen] = useState(true);
  const [selectedCodes, setSelectedCodes] = useState<string[]>([]);
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [isProcessingBatchCodes, setIsProcessingBatchCodes] = useState(false);

  // State: Broadcast Push Composer
  const [broadcastTitle, setBroadcastTitle] = useState("");
  const [broadcastMessage, setBroadcastMessage] = useState("");
  const [broadcastCategory, setBroadcastCategory] = useState<"GENERAL" | "URGENT" | "LISTING" | "COMMISSION">("GENERAL");
  const [isPinned, setIsPinned] = useState(false);
  const [isSendingBroadcast, setIsSendingBroadcast] = useState(false);

  // State: Listing Moderation
  const [listings, setListings] = useState<PropertyListing[]>([]);
  const [listingSearch, setListingSearch] = useState("");
  const [selectedListing, setSelectedListing] = useState<PropertyListing | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [isUpdatingListing, setIsUpdatingListing] = useState(false);

  // State: Feedback & Bug Moderation Desk
  const [allFeedback, setAllFeedback] = useState<FeedbackSubmission[]>([]);
  const [feedbackSearch, setFeedbackSearch] = useState("");
  const [feedbackStatusFilter, setFeedbackStatusFilter] = useState<"ALL" | "PENDING" | "IN_PROGRESS" | "RESOLVED">("ALL");
  const [feedbackCategoryFilter, setFeedbackCategoryFilter] = useState<"ALL" | "Bug" | "Feature" | "Performance" | "General">("ALL");
  const [expandedFeedbackId, setExpandedFeedbackId] = useState<string | null>(null);
  const [adminReplyDrafts, setAdminReplyDrafts] = useState<{ [id: string]: string }>({});
  const [isUpdatingFeedback, setIsUpdatingFeedback] = useState<string | null>(null);
  const [selectedScreenshotModal, setSelectedScreenshotModal] = useState<string | null>(null);

  // Strict Admin Route Protection Check
  useEffect(() => {
    const checkRole = async () => {
      const user = firebaseAuth.currentUser;
      if (!user) {
        router.replace("/login");
        return;
      }
      const role = await getUserRole(user.uid);
      if (role !== "admin") {
        Alert.alert(
          language === "BM" ? "Akses Ditolak" : "Access Denied",
          language === "BM"
            ? "Hanya pentadbir agensi dibenarkan mengakses Pusat Pentadbir."
            : "Only agency administrators can access the Admin Hub."
        );
        router.replace("/(tabs)");
      }
    };
    checkRole();
  }, []);

  // Subscriptions
  useEffect(() => {
    const unsubPending = subscribeToPendingAgents(setPendingAgents);
    const unsubAgents = subscribeToAllAgents(setAllAgents);
    const unsubCodes = subscribeToInviteCodes(setInviteCodes);
    const unsubFeedback = subscribeToAllFeedback(setAllFeedback);

    const unsubListings = firebaseDB.collection("publicListings").onSnapshot(
      (snapshot) => {
        if (!snapshot) return;
        const list: PropertyListing[] = [];
        snapshot.forEach((doc) => {
          list.push({ id: doc.id, ...(doc.data() as any) });
        });
        list.sort((a, b) => ((b as any).createdAt || "").localeCompare((a as any).createdAt || ""));
        setListings(list);
      },
      (err) => console.warn("Listings subscription error:", err)
    );

    return () => {
      unsubPending();
      unsubAgents();
      unsubCodes();
      unsubListings();
      unsubFeedback();
    };
  }, []);

  // --- Handlers: Approvals ---
  const handleApprove = async (agent: AdminAgent) => {
    try {
      setProcessingUid(agent.uid);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await approveAgent(agent.uid);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        language === "BM" ? "Ejen Disahkan! 🎉" : "Agent Approved! 🎉",
        language === "BM"
          ? `Akaun ${agent.displayName || agent.email} kini telah disahkan dan mempunyai akses penuh.`
          : `Account for ${agent.displayName || agent.email} is now approved.`
      );
    } catch (e: any) {
      Alert.alert("Error", e.message || "Failed to approve agent.");
    } finally {
      setProcessingUid(null);
    }
  };

  const handleReject = (agent: AdminAgent) => {
    Alert.alert(
      language === "BM" ? "Tolak / Gantung Akaun" : "Reject / Suspend Account",
      language === "BM"
        ? `Adakah anda pasti untuk menolak atau menggantung akaun ${agent.displayName || agent.email}?`
        : `Are you sure you want to reject or suspend ${agent.displayName || agent.email}?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Tolak Akaun" : "Reject Account",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessingUid(agent.uid);
              await rejectOrSuspendAgent(agent.uid, "Pendaftaran ditolak oleh pentadbir.");
              Alert.alert(
                language === "BM" ? "Akaun Ditolak" : "Account Rejected",
                language === "BM" ? "Status akaun telah dikemas kini." : "Account status updated."
              );
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to update account.");
            } finally {
              setProcessingUid(null);
            }
          },
        },
      ]
    );
  };

  const handleToggleRole = (agent: AdminAgent) => {
    const nextRole = agent.role === "admin" ? "agent" : "admin";
    Alert.alert(
      language === "BM" ? "Tukar Peranan Ejen" : "Change Agent Role",
      language === "BM"
        ? `Tukar peranan ${agent.displayName || agent.email} kepada '${nextRole.toUpperCase()}'?`
        : `Change role of ${agent.displayName || agent.email} to '${nextRole.toUpperCase()}'?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Sahkan" : "Confirm",
          onPress: async () => {
            try {
              setProcessingUid(agent.uid);
              await updateAgentRole(agent.uid, nextRole);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to update role.");
            } finally {
              setProcessingUid(null);
            }
          },
        },
      ]
    );
  };

  // --- Handlers: Invite Codes ---
  const handleGenerateSingleCode = async () => {
    try {
      setIsGeneratingCodes(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const cleanPrefix = (codePrefix.trim() || "ART").toUpperCase();
      const code = await createInviteCode({
        code: `${cleanPrefix}-${Date.now().toString(36).slice(-4).toUpperCase()}-${Math.floor(Math.random() * 0xffff).toString(16).padStart(4, "0").toUpperCase()}`,
        isMaster: false,
        notes: codeNotes.trim() || "Generated from Mobile Admin",
      });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        language === "BM" ? "Kod Berjaya Dijana! 🎟️" : "Code Generated! 🎟️",
        `${code.code}\n\n${language === "BM" ? "Kod sedia dikongsi ke WhatsApp." : "Code ready to share via WhatsApp."}`,
        [
          {
            text: language === "BM" ? "Kongsi WhatsApp" : "Share WhatsApp",
            onPress: () => handleShareWhatsApp([code.code]),
          },
          { text: "OK" },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate code.");
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleGenerateBatch = async () => {
    try {
      setIsGeneratingCodes(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      const codes = await generateBatchInviteCodes({
        count: batchCount,
        prefix: codePrefix,
        notes: codeNotes.trim() || `Batch (${batchCount}) from Mobile Admin`,
      });
      const codeStrings = codes.map((c) => c.code);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        language === "BM" ? `Berjaya Jana ${codes.length} Kod! 🎟️` : `Generated ${codes.length} Codes! 🎟️`,
        `${codeStrings.join("\n")}`,
        [
          {
            text: language === "BM" ? "Salin Semua" : "Copy All",
            onPress: async () => {
              await Clipboard.setStringAsync(codeStrings.join("\n"));
              Alert.alert(language === "BM" ? "Disalin!" : "Copied!", language === "BM" ? "Semua kod disalin ke clipboard." : "Codes copied to clipboard.");
            },
          },
          {
            text: language === "BM" ? "Kongsi WhatsApp" : "Share WhatsApp",
            onPress: () => handleShareWhatsApp(codeStrings),
          },
          { text: "OK" },
        ]
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to generate batch codes.");
    } finally {
      setIsGeneratingCodes(false);
    }
  };

  const handleShareWhatsApp = (codes: string[]) => {
    const formattedCodes = codes.length === 1 ? `*${codes[0]}*` : codes.map((c, i) => `${i + 1}. *${c}*`).join("\n");
    const message =
      language === "BM"
        ? `Salam & Selamat Datang ke Artha Master Listing! 🏢\n\nBerikut adalah kod jemputan pendaftaran ejen anda:\n${formattedCodes}\n\n📱 Muat Turun Aplikasi Artha:\nhttps://artharen.web.app/\n\nSila masukkan kod semasa pendaftaran. Terima kasih!`
        : `Welcome to Artha Master Listing CRM! 🏢\n\nHere is your agent registration invite code:\n${formattedCodes}\n\n📱 Download Artha App:\nhttps://artharen.web.app/\n\nPlease enter the code during registration. Thank you!`;

    const waUrl = `whatsapp://send?text=${encodeURIComponent(message)}`;
    Linking.openURL(waUrl).catch(() => {
      Share.share({ message, title: "Artha Invite Code" }).catch(() => {});
    });
  };

  const handleRevokeCode = (code: string) => {
    Alert.alert(
      language === "BM" ? "Batalkan Kod" : "Revoke Code",
      language === "BM" ? `Adakah anda pasti mahu membatalkan kod ${code}?` : `Are you sure you want to revoke ${code}?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Batalkan" : "Revoke",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await revokeInviteCode(code);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert("Error", err.message || "Could not revoke code.");
            }
          },
        },
      ]
    );
  };

  const handleDeleteCode = (code: string) => {
    Alert.alert(
      language === "BM" ? "Padam Kod Jemputan" : "Delete Invite Code",
      language === "BM"
        ? `Adakah anda pasti mahu memadam kod ${code} secara kekal dari pangkalan data?`
        : `Are you sure you want to permanently delete code ${code} from the database?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Padam" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
              await deleteInviteCode(code);
              setSelectedCodes((prev) => prev.filter((c) => c !== code));
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert("Error", err.message || "Could not delete code.");
            }
          },
        },
      ]
    );
  };

  const handleToggleSelectCode = (code: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSelectedCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const handleSelectAllFiltered = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    const allFilteredCodeStrings = filteredCodes.map((c) => c.code);
    if (selectedCodes.length === allFilteredCodeStrings.length && allFilteredCodeStrings.length > 0) {
      setSelectedCodes([]);
    } else {
      setSelectedCodes(allFilteredCodeStrings);
    }
  };

  const handleBatchRevokeSelected = () => {
    if (selectedCodes.length === 0) return;
    Alert.alert(
      language === "BM" ? "Batalkan Kod Terpilih" : "Revoke Selected Codes",
      language === "BM"
        ? `Adakah anda pasti mahu membatalkan ${selectedCodes.length} kod jemputan terpilih?`
        : `Are you sure you want to revoke ${selectedCodes.length} selected invite codes?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Batalkan Semua" : "Revoke All",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessingBatchCodes(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              await batchRevokeInviteCodes(selectedCodes);
              setSelectedCodes([]);
              setIsMultiSelectMode(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert("Success", language === "BM" ? "Kod terpilih berjaya dibatalkan." : "Selected codes revoked successfully.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to batch revoke codes.");
            } finally {
              setIsProcessingBatchCodes(false);
            }
          },
        },
      ]
    );
  };

  const handleBatchDeleteSelected = () => {
    if (selectedCodes.length === 0) return;
    Alert.alert(
      language === "BM" ? "Padam Kod Terpilih" : "Delete Selected Codes",
      language === "BM"
        ? `Adakah anda pasti mahu memadam ${selectedCodes.length} kod jemputan terpilih secara kekal?`
        : `Are you sure you want to permanently delete ${selectedCodes.length} selected invite codes?`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Padam Semua" : "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessingBatchCodes(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              await batchDeleteInviteCodes(selectedCodes);
              setSelectedCodes([]);
              setIsMultiSelectMode(false);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert("Success", language === "BM" ? "Kod terpilih berjaya dipadam." : "Selected codes deleted successfully.");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to batch delete codes.");
            } finally {
              setIsProcessingBatchCodes(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAllRevoked = () => {
    const revokedCount = inviteCodes.filter((c) => c.status === "REVOKED").length;
    if (revokedCount === 0) {
      Alert.alert(
        language === "BM" ? "Tiada Kod Dibatalkan" : "No Revoked Codes",
        language === "BM" ? "Tiada kod jemputan yang berstatus REVOKED untuk dipadam." : "There are no REVOKED invite codes to delete."
      );
      return;
    }

    Alert.alert(
      language === "BM" ? "Padam Semua Kod Batal?" : "Delete All Revoked Codes?",
      language === "BM"
        ? `Adakah anda pasti mahu memadam semua ${revokedCount} kod jemputan berstatus REVOKED secara kekal? Tindakan ini tidak boleh diundur.`
        : `Are you sure you want to permanently delete all ${revokedCount} REVOKED codes? This cannot be undone.`,
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Padam Semua" : "Delete All",
          style: "destructive",
          onPress: async () => {
            try {
              setIsProcessingBatchCodes(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              const count = await deleteAllRevokedInviteCodes();
              setSelectedCodes([]);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert("Success", language === "BM" ? `${count} kod batal berjaya dipadam.` : `${count} revoked codes deleted.`);
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete revoked codes.");
            } finally {
              setIsProcessingBatchCodes(false);
            }
          },
        },
      ]
    );
  };

  // --- Handlers: Broadcast ---
  const handleSendBroadcast = async () => {
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) {
      Alert.alert(
        language === "BM" ? "Maklumat Diperlukan" : "Information Required",
        language === "BM" ? "Sila masukkan tajuk dan mesej siaran." : "Please enter broadcast title and message."
      );
      return;
    }

    Alert.alert(
      language === "BM" ? "Hantar Notifikasi Siaran" : "Send Broadcast Push",
      language === "BM"
        ? "Notifikasi tolak (push notification) akan dihantar serta-merta ke semua peranti ejen yang aktif. Teruskan?"
        : "A push notification will be delivered immediately to all registered agent devices. Continue?",
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Hantar Sekarang 🚀" : "Send Now 🚀",
          onPress: async () => {
            try {
              setIsSendingBroadcast(true);
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
              const payload: BroadcastPayload = {
                titleEN: broadcastTitle.trim(),
                titleBM: broadcastTitle.trim(),
                messageEN: broadcastMessage.trim(),
                messageBM: broadcastMessage.trim(),
                type: broadcastCategory,
                pinned: isPinned,
              };
              await sendBroadcastAnnouncement(payload, "Pentadbir Agensi");
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
              Alert.alert(
                language === "BM" ? "Siaran Berjaya Dihantar! 📢" : "Broadcast Sent! 📢",
                language === "BM"
                  ? `Pengumuman telah disimpan dan notifikasi tolak dihantar ke peranti ejen.`
                  : `Announcement posted and delivered to active agent devices.`
              );
              setBroadcastTitle("");
              setBroadcastMessage("");
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to send broadcast.");
            } finally {
              setIsSendingBroadcast(false);
            }
          },
        },
      ]
    );
  };

  // --- Handlers: Listing Moderation ---
  const handleSelectListingStatus = async (newStatus: string) => {
    if (!selectedListing?.id) return;
    try {
      setIsUpdatingListing(true);
      await updateAgencyListingStatus(selectedListing.id, newStatus);
      setIsStatusModalOpen(false);
      setSelectedListing(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update listing status.");
    } finally {
      setIsUpdatingListing(false);
    }
  };

  const handleCopyCode = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
      setCopiedCode(code);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      setTimeout(() => {
        setCopiedCode((current) => (current === code ? null : current));
      }, 2000);
    } catch {
      // ignore
    }
  };

  const handleCopyAllActive = async () => {
    const activeList = inviteCodes.filter((c) => c.status === "ACTIVE").map((c) => c.code);
    if (activeList.length === 0) {
      Alert.alert(language === "BM" ? "Tiada Kod Aktif" : "No Active Codes", language === "BM" ? "Tiada kod jemputan aktif untuk disalin." : "No active invite codes to copy.");
      return;
    }
    await Clipboard.setStringAsync(activeList.join("\n"));
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    Alert.alert(
      language === "BM" ? "Disalin! ✨" : "Copied! ✨",
      language === "BM"
        ? `${activeList.length} kod aktif telah disalin ke clipboard.`
        : `${activeList.length} active codes copied to clipboard.`
    );
  };

  // KPI Calculations
  const activeCodesCount = inviteCodes.filter((c) => c.status === "ACTIVE").length;
  const usedCodesCount = inviteCodes.filter((c) => c.status === "USED").length;
  const revokedCodesCount = inviteCodes.filter((c) => c.status === "REVOKED" || (!c.status && c.status !== "ACTIVE" && c.status !== "USED")).length;

  // Filtered Lists
  const filteredAgents = allAgents.filter((a) => {
    const q = agentSearch.toLowerCase();
    return (
      (a.displayName || "").toLowerCase().includes(q) ||
      (a.email || "").toLowerCase().includes(q) ||
      (a.phoneNumber || a.phone || "").includes(q)
    );
  });

  const filteredCodes = inviteCodes
    .filter((c) => {
      if (codeFilter === "ACTIVE") return c.status === "ACTIVE";
      if (codeFilter === "USED") return c.status === "USED";
      if (codeFilter === "REVOKED") return c.status === "REVOKED";
      return true;
    })
    .filter((c) => {
      if (!codeSearch.trim()) return true;
      const q = codeSearch.toLowerCase().trim();
      return (
        c.code.toLowerCase().includes(q) ||
        (c.notes || "").toLowerCase().includes(q) ||
        (c.usedByName || "").toLowerCase().includes(q) ||
        (c.usedBy || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      // Prioritize ACTIVE first, then USED, then REVOKED
      const rank = (status?: string) => (status === "ACTIVE" ? 1 : status === "USED" ? 2 : 3);
      const diff = rank(a.status) - rank(b.status);
      if (diff !== 0) return diff;
      return (b.createdAt || "").localeCompare(a.createdAt || "");
    });

  const filteredListings = listings.filter((l) => {
    const q = listingSearch.toLowerCase();
    return (
      (l.tajuk || "").toLowerCase().includes(q) ||
      (l.alamat || "").toLowerCase().includes(q) ||
      (l.negeri || "").toLowerCase().includes(q) ||
      (l.authorName || l.agentId || "").toLowerCase().includes(q)
    );
  });

  // --- Feedback Desk Calculations & Handlers ---
  const pendingFeedbackCount = allFeedback.filter(
    (f) => !f.status || f.status === "pending"
  ).length;
  const inProgressFeedbackCount = allFeedback.filter(
    (f) => f.status === "in-progress"
  ).length;
  const resolvedFeedbackCount = allFeedback.filter(
    (f) => f.status === "resolved"
  ).length;

  const filteredFeedback = allFeedback
    .filter((item) => {
      // Status filter
      if (feedbackStatusFilter === "PENDING") {
        if (item.status && item.status !== "pending") return false;
      } else if (feedbackStatusFilter === "IN_PROGRESS") {
        if (item.status !== "in-progress") return false;
      } else if (feedbackStatusFilter === "RESOLVED") {
        if (item.status !== "resolved" && item.status !== "closed") return false;
      }

      // Category filter
      if (feedbackCategoryFilter !== "ALL") {
        if (item.type !== feedbackCategoryFilter) return false;
      }

      // Search filter
      if (feedbackSearch.trim()) {
        const q = feedbackSearch.toLowerCase().trim();
        const titleMatch = (item.title || "").toLowerCase().includes(q);
        const descMatch = (item.description || "").toLowerCase().includes(q);
        const agentMatch = (item.userName || "").toLowerCase().includes(q) || (item.userEmail || "").toLowerCase().includes(q);
        const deviceMatch = (item.deviceModel || "").toLowerCase().includes(q);
        return titleMatch || descMatch || agentMatch || deviceMatch;
      }

      return true;
    });

  const handleUpdateFeedback = async (
    feedbackId: string,
    newStatus: FeedbackStatus,
    replyText?: string
  ) => {
    try {
      setIsUpdatingFeedback(feedbackId);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      await updateFeedbackStatus(feedbackId, newStatus, replyText);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      Alert.alert(
        language === "BM" ? "Status Dikemas Kini" : "Status Updated",
        language === "BM"
          ? "Status tiket maklum balas dan jawapan admin telah disimpan."
          : "Feedback ticket status and admin reply have been saved."
      );
    } catch (err: any) {
      Alert.alert("Error", err.message || "Failed to update feedback.");
    } finally {
      setIsUpdatingFeedback(null);
    }
  };

  const handleDeleteFeedbackItem = (feedbackId: string) => {
    Alert.alert(
      language === "BM" ? "Padam Tiket Maklum Balas?" : "Delete Feedback Ticket?",
      language === "BM"
        ? "Adakah anda pasti mahu memadamkan tiket ini secara kekal dari pangkalan data?"
        : "Are you sure you want to permanently delete this ticket from the database?",
      [
        { text: language === "BM" ? "Batal" : "Cancel", style: "cancel" },
        {
          text: language === "BM" ? "Padam" : "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setIsUpdatingFeedback(feedbackId);
              await deleteFeedbackAsAdmin(feedbackId);
              Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
            } catch (err: any) {
              Alert.alert("Error", err.message || "Failed to delete feedback.");
            } finally {
              setIsUpdatingFeedback(null);
            }
          },
        },
      ]
    );
  };

  const handleContactAgentWhatsApp = (phone?: string, agentName?: string, ticketTitle?: string) => {
    if (!phone) {
      Alert.alert(
        language === "BM" ? "Tiada Nombor Telefon" : "No Phone Number",
        language === "BM"
          ? "Ejen ini tidak mempunyai nombor telefon yang didaftarkan."
          : "This agent has no registered phone number."
      );
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, "");
    const formattedPhone = cleanPhone.startsWith("0") ? "6" + cleanPhone : cleanPhone.startsWith("6") ? cleanPhone : "60" + cleanPhone;
    const greeting = language === "BM"
      ? `Salam ${agentName || "Ejen"}, mengenai maklum balas/tiket bug anda di Artha ("${ticketTitle || "Maklum Balas"}"):`
      : `Hi ${agentName || "Agent"}, regarding your feedback/bug ticket in Artha ("${ticketTitle || "Feedback"}"):`;
    Linking.openURL(`whatsapp://send?phone=${formattedPhone}&text=${encodeURIComponent(greeting)}`).catch(() => {
      Linking.openURL(`https://wa.me/${formattedPhone}?text=${encodeURIComponent(greeting)}`).catch(() => {
        Alert.alert("Error", "Could not open WhatsApp.");
      });
    });
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <StatusBar
        barStyle={isDark ? "light-content" : "dark-content"}
        backgroundColor={themeColors.canvasBackground}
      />

      {/* Spacious Premium Header */}
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
          paddingHorizontal: SPACING.lg,
          paddingTop: 8,
          paddingBottom: 14,
        }}
      >
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => router.back()}
          style={{
            width: 40,
            height: 40,
            borderRadius: 12,
            backgroundColor: themeColors.surfaceContainer,
            borderWidth: 1,
            borderColor: themeColors.borderColor,
            justifyContent: "center",
            alignItems: "center",
          }}
        >
          <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>

        <View style={{ alignItems: "center" }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <MaterialCommunityIcons name="shield-crown" size={20} color="#F59E0B" />
            <Text style={{ fontSize: 18, fontWeight: "800", color: themeColors.textPrimary }}>
              {language === "BM" ? "Pusat Pentadbir" : "Admin Hub"}
            </Text>
          </View>
          <Text style={{ fontSize: 12, color: themeColors.textMuted, marginTop: 1 }}>
            Artha Management Suite
          </Text>
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() => Linking.openURL("https://artharen.web.app/admin").catch(() => {})}
          style={{
            flexDirection: "row",
            alignItems: "center",
            gap: 4,
            paddingVertical: 8,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: "rgba(245, 158, 11, 0.12)",
            borderWidth: 1,
            borderColor: "rgba(245, 158, 11, 0.3)",
          }}
        >
          <MaterialCommunityIcons name="open-in-new" size={14} color="#F59E0B" />
          <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#F59E0B" }}>Web</Text>
        </TouchableOpacity>
      </View>

      {/* Horizontal Scrollable Spacious Tab Bar */}
      <View style={{ marginBottom: 12 }}>
        <ScrollView
          ref={tabScrollViewRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            gap: 10,
          }}
        >
          {[
            { id: "approvals", label: language === "BM" ? "Pengesahan" : "Approvals", icon: "account-check", badge: pendingAgents.length },
            { id: "invite_codes", label: language === "BM" ? "Kod Jemputan" : "Invite Codes", icon: "ticket-percent", badge: activeCodesCount },
            { id: "broadcast", label: language === "BM" ? "Siaran" : "Broadcast", icon: "bullhorn", badge: 0 },
            { id: "listings", label: language === "BM" ? "Listing" : "Listings", icon: "home-city", badge: 0 },
            { id: "feedback", label: language === "BM" ? "Maklum Balas" : "Feedback", icon: "bug-outline", badge: pendingFeedbackCount },
          ].map((tab) => {
            const isActive = activeTab === tab.id;
            const activeBg = isDark ? "#881337" : themeColors.maroonPrimary;
            const activeBorder = isDark ? "#BE123C" : themeColors.maroonPrimary;
            return (
              <TouchableOpacity
                key={tab.id}
                activeOpacity={0.75}
                onLayout={(e) => {
                  tabLayouts.current[tab.id] = {
                    x: e.nativeEvent.layout.x,
                    width: e.nativeEvent.layout.width,
                  };
                }}
                onPress={() => handleSelectTab(tab.id as AdminTab)}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingVertical: 10,
                  paddingHorizontal: 16,
                  borderRadius: 14,
                  backgroundColor: isActive ? activeBg : themeColors.surfaceContainer,
                  borderWidth: 1.5,
                  borderColor: isActive ? activeBorder : themeColors.borderColor,
                  gap: 8,
                }}
              >
                <MaterialCommunityIcons
                  name={tab.icon as any}
                  size={18}
                  color={isActive ? "#FFFFFF" : themeColors.textMuted}
                />
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: "800",
                    color: isActive ? "#FFFFFF" : themeColors.textPrimary,
                  }}
                >
                  {tab.label}
                </Text>
                {tab.badge > 0 && (
                  <View
                    style={{
                      backgroundColor: isActive ? "#FFFFFF" : tab.id === "approvals" ? "#EF4444" : "#10B981",
                      paddingHorizontal: 7,
                      paddingVertical: 2,
                      borderRadius: 10,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 11,
                        fontWeight: "800",
                        color: isActive ? (tab.id === "approvals" ? "#EF4444" : "#047857") : "#FFFFFF",
                      }}
                    >
                      {tab.badge}
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Main Content Area with Generous Bottom Padding */}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          ref={mainScrollViewRef}
          style={{ flex: 1 }}
          contentContainerStyle={{
            paddingHorizontal: SPACING.lg,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 24) + 120,
          }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
        {/* ========================================================================= */}
        {/* TAB 1: PENGESAHAN EJEN & DIRECTORY */}
        {/* ========================================================================= */}
        {activeTab === "approvals" && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 20 }}>
            {/* Section A: Pending Approvals Queue */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Menunggu Pengesahan" : "Pending Approvals"}
                </Text>
                <View
                  style={{
                    backgroundColor: pendingAgents.length > 0 ? "rgba(239, 68, 68, 0.15)" : "rgba(16, 185, 129, 0.15)",
                    paddingHorizontal: 10,
                    paddingVertical: 3,
                    borderRadius: 10,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 11.5,
                      fontWeight: "800",
                      color: pendingAgents.length > 0 ? "#EF4444" : "#10B981",
                    }}
                  >
                    {pendingAgents.length} {language === "BM" ? "Permohonan" : "Requests"}
                  </Text>
                </View>
              </View>

              {pendingAgents.length === 0 ? (
                <View
                  style={{
                    backgroundColor: themeColors.cardBackground,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    padding: 24,
                    alignItems: "center",
                    gap: 8,
                  }}
                >
                  <View
                    style={{
                      width: 52,
                      height: 52,
                      borderRadius: 26,
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      justifyContent: "center",
                      alignItems: "center",
                      marginBottom: 4,
                    }}
                  >
                    <MaterialCommunityIcons name="check-decagram-outline" size={32} color="#10B981" />
                  </View>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Semua Ejen Telah Disahkan" : "All Caught Up!"}
                  </Text>
                  <Text style={{ fontSize: 13, color: themeColors.textMuted, textAlign: "center", lineHeight: 18 }}>
                    {language === "BM" ? "Tiada pendaftaran baru yang menunggu semakan buat masa ini." : "No pending agent registrations waiting for review."}
                  </Text>
                </View>
              ) : (
                pendingAgents.map((agent) => (
                  <View
                    key={agent.uid}
                    style={{
                      backgroundColor: themeColors.cardBackground,
                      borderRadius: 16,
                      borderWidth: 1.5,
                      borderColor: "rgba(245, 158, 11, 0.4)",
                      padding: 16,
                      marginBottom: 12,
                      gap: 12,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                      <View
                        style={{
                          width: 46,
                          height: 46,
                          borderRadius: 23,
                          backgroundColor: "rgba(245, 158, 11, 0.15)",
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: "rgba(245, 158, 11, 0.3)",
                        }}
                      >
                        <Text style={{ fontSize: 16, fontWeight: "800", color: "#F59E0B" }}>
                          {getUserInitials(agent.displayName || "Agent")}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                          {agent.displayName || "Ejen Baru"}
                        </Text>
                        {agent.registeredWithCode && (
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 }}>
                            <MaterialCommunityIcons
                              name={agent.registeredWithCode === "DIRECT_REQUEST" ? "account-clock-outline" : "ticket-percent"}
                              size={13}
                              color={agent.registeredWithCode === "DIRECT_REQUEST" ? "#F59E0B" : themeColors.maroonPrimary}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                color: agent.registeredWithCode === "DIRECT_REQUEST" ? "#F59E0B" : themeColors.maroonPrimary,
                                fontWeight: "700",
                              }}
                            >
                              {agent.registeredWithCode === "DIRECT_REQUEST"
                                ? (language === "BM" ? "Permohonan Akses Terus" : "Direct Access Request")
                                : agent.registeredWithCode}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Approve / Reject Actions with Generous Buttons */}
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 4 }}>
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => handleReject(agent)}
                        disabled={processingUid === agent.uid}
                        style={{
                          flex: 1,
                          backgroundColor: themeColors.surfaceContainer,
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                        }}
                      >
                        <Text style={{ fontSize: 13.5, fontWeight: "700", color: "#EF4444" }}>
                          {language === "BM" ? "Tolak" : "Reject"}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => handleApprove(agent)}
                        disabled={processingUid === agent.uid}
                        style={{
                          flex: 2,
                          backgroundColor: "#10B981",
                          paddingVertical: 12,
                          borderRadius: 12,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {processingUid === agent.uid ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="check-bold" size={16} color="#FFFFFF" />
                            <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                              {language === "BM" ? "Sahkan Akaun" : "Approve Agent"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                ))
              )}
            </View>

            {/* Section B: Registered Agents Directory */}
            <View>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Direktori Ejen Berdaftar" : "Registered Agents"} ({allAgents.length})
                </Text>
              </View>

              {/* Spacious Search bar */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  paddingHorizontal: 14,
                  paddingVertical: 4,
                  marginBottom: 14,
                }}
              >
                <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
                <TextInput
                  style={{
                    flex: 1,
                    paddingVertical: 8,
                    paddingHorizontal: 10,
                    fontSize: 14,
                    color: themeColors.textPrimary,
                  }}
                  placeholder={language === "BM" ? "Cari nama, e-mel atau nombor telefon..." : "Search name, email, or phone..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={agentSearch}
                  onChangeText={setAgentSearch}
                />
              </View>

              {filteredAgents.map((agent) => {
                const isAdmin = agent.role === "admin";
                const isSuspended = agent.status === "SUSPENDED";
                return (
                  <View
                    key={agent.uid}
                    style={{
                      backgroundColor: themeColors.cardBackground,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      padding: 14,
                      marginBottom: 10,
                      gap: 10,
                    }}
                  >
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 12, flex: 1 }}>
                        <View
                          style={{
                            width: 44,
                            height: 44,
                            borderRadius: 22,
                            backgroundColor: isAdmin ? "rgba(245, 158, 11, 0.15)" : themeColors.maroonLight,
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: isAdmin ? "#F59E0B" : themeColors.maroonPrimary,
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 16,
                              fontWeight: "800",
                              color: isAdmin ? "#F59E0B" : themeColors.maroonPrimary,
                            }}
                          >
                            {getUserInitials(agent.displayName || "Agent")}
                          </Text>
                        </View>

                        <View style={{ flex: 1 }}>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <Text style={{ fontSize: 15, fontWeight: "800", color: themeColors.textPrimary }} numberOfLines={1}>
                              {agent.displayName || "Ejen"}
                            </Text>
                            <View
                              style={{
                                backgroundColor: isAdmin ? "rgba(245, 158, 11, 0.15)" : themeColors.surfaceContainer,
                                paddingHorizontal: 7,
                                paddingVertical: 2,
                                borderRadius: 6,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 10,
                                  fontWeight: "800",
                                  color: isAdmin ? "#F59E0B" : themeColors.textMuted,
                                }}
                              >
                                {isAdmin ? "ADMIN" : "AGENT"}
                              </Text>
                            </View>
                            {isSuspended && (
                              <View style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6 }}>
                                <Text style={{ fontSize: 10, fontWeight: "800", color: "#EF4444" }}>SUSPENDED</Text>
                              </View>
                            )}
                          </View>
                          <Text style={{ fontSize: 12.5, color: themeColors.textMuted, marginTop: 1 }} numberOfLines={1}>
                            {agent.email}
                          </Text>
                        </View>
                      </View>

                      {/* Right Action Icons */}
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {(agent.phoneNumber || agent.phone) && (
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => {
                              const cleanPhone = (agent.phoneNumber || agent.phone || "").replace(/[^0-9]/g, "");
                              Linking.openURL(`https://wa.me/${cleanPhone}`).catch(() => {});
                            }}
                            style={{
                              width: 36,
                              height: 36,
                              borderRadius: 12,
                              backgroundColor: "#25D366",
                              justifyContent: "center",
                              alignItems: "center",
                            }}
                          >
                            <MaterialCommunityIcons name="whatsapp" size={20} color="#FFFFFF" />
                          </TouchableOpacity>
                        )}

                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleToggleRole(agent)}
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            backgroundColor: themeColors.surfaceContainer,
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: themeColors.borderColor,
                          }}
                        >
                          <MaterialCommunityIcons name="shield-account-outline" size={20} color={themeColors.textPrimary} />
                        </TouchableOpacity>
                      </View>
                    </View>

                    {(agent.phoneNumber || agent.phone) && (
                      <View
                        style={{
                          backgroundColor: themeColors.surfaceContainer,
                          paddingHorizontal: 12,
                          paddingVertical: 6,
                          borderRadius: 8,
                          alignSelf: "flex-start",
                        }}
                      >
                        <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                          WhatsApp: <Text style={{ fontWeight: "700", color: themeColors.textPrimary }}>{agent.phoneNumber || agent.phone}</Text>
                        </Text>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </Animated.View>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: KOD JEMPUTAN & WHATSAPP DISPATCHER */}
        {/* ========================================================================= */}
        {activeTab === "invite_codes" && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 16 }}>
            {/* 1. Quick KPI Metric Filter Cards */}
            <View style={{ flexDirection: "row", gap: 10 }}>
              {/* Active */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCodeFilter((curr) => (curr === "ACTIVE" ? "ALL" : "ACTIVE"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: codeFilter === "ACTIVE" ? "rgba(16, 185, 129, 0.22)" : "rgba(16, 185, 129, 0.1)",
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: codeFilter === "ACTIVE" ? "#10B981" : "rgba(16, 185, 129, 0.3)",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#10B981" }}>{activeCodesCount}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#10B981" }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#10B981" }}>
                    {language === "BM" ? "Aktif" : "Active"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Redeemed / Used */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCodeFilter((curr) => (curr === "USED" ? "ALL" : "USED"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: codeFilter === "USED" ? "rgba(59, 130, 246, 0.22)" : "rgba(59, 130, 246, 0.1)",
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: codeFilter === "USED" ? "#3B82F6" : "rgba(59, 130, 246, 0.3)",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#3B82F6" }}>{usedCodesCount}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#3B82F6" }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#3B82F6" }}>
                    {language === "BM" ? "Ditebus" : "Used"}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Revoked */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setCodeFilter((curr) => (curr === "REVOKED" ? "ALL" : "REVOKED"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: codeFilter === "REVOKED" ? "rgba(239, 68, 68, 0.22)" : "rgba(239, 68, 68, 0.1)",
                  borderRadius: 14,
                  paddingVertical: 12,
                  paddingHorizontal: 10,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: codeFilter === "REVOKED" ? "#EF4444" : "rgba(239, 68, 68, 0.3)",
                }}
              >
                <Text style={{ fontSize: 20, fontWeight: "900", color: "#EF4444" }}>{revokedCodesCount}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 }}>
                  <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: "#EF4444" }} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: "#EF4444" }}>
                    {language === "BM" ? "Dibatalkan" : "Revoked"}
                  </Text>
                </View>
              </TouchableOpacity>
            </View>

            {/* 2. Streamlined & Collapsible Code Generator */}
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                padding: 16,
                gap: 12,
              }}
            >
              {/* Generator Header & Toggle */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setIsGeneratorOpen(!isGeneratorOpen);
                }}
                style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}
              >
                <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                  <View
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      backgroundColor: isDark ? "rgba(244, 63, 94, 0.15)" : themeColors.maroonLight,
                      justifyContent: "center",
                      alignItems: "center",
                    }}
                  >
                    <MaterialCommunityIcons
                      name="ticket-percent"
                      size={20}
                      color={isDark ? "#FB7185" : themeColors.maroonPrimary}
                    />
                  </View>
                  <View>
                    <Text style={{ fontSize: 15.5, fontWeight: "800", color: themeColors.textPrimary }}>
                      {language === "BM" ? "Jana Kod Jemputan Baru" : "Generate Invite Codes"}
                    </Text>
                    <Text style={{ fontSize: 11.5, color: themeColors.textMuted }}>
                      {codeMode === "SINGLE"
                        ? (language === "BM" ? "1 Kod Segera sedia dikongsi" : "1 Instant code ready to share")
                        : (language === "BM" ? `Pek ${batchCount} kod sekaligus` : `Batch pack of ${batchCount} codes`)}
                    </Text>
                  </View>
                </View>

                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 8,
                    backgroundColor: themeColors.surfaceContainer,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MaterialCommunityIcons
                    name={isGeneratorOpen ? "chevron-up" : "chevron-down"}
                    size={20}
                    color={themeColors.textPrimary}
                  />
                </View>
              </TouchableOpacity>

              {isGeneratorOpen && (
                <Animated.View entering={FadeIn.duration(150)} style={{ gap: 12, marginTop: 4 }}>
                  {/* Mode Segmented Switcher */}
                  <View
                    style={{
                      flexDirection: "row",
                      backgroundColor: themeColors.surfaceContainer,
                      borderRadius: 12,
                      padding: 3,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                    }}
                  >
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setCodeMode("SINGLE");
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: codeMode === "SINGLE" ? (isDark ? "#881337" : themeColors.maroonPrimary) : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="flash"
                        size={15}
                        color={codeMode === "SINGLE" ? "#FFFFFF" : themeColors.textMuted}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "800",
                          color: codeMode === "SINGLE" ? "#FFFFFF" : themeColors.textPrimary,
                        }}
                      >
                        {language === "BM" ? "1 Kod Pantas" : "Single (1)"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setCodeMode("BATCH");
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 10,
                        backgroundColor: codeMode === "BATCH" ? (isDark ? "#881337" : themeColors.maroonPrimary) : "transparent",
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 6,
                      }}
                    >
                      <MaterialCommunityIcons
                        name="layers-outline"
                        size={15}
                        color={codeMode === "BATCH" ? "#FFFFFF" : themeColors.textMuted}
                      />
                      <Text
                        style={{
                          fontSize: 12.5,
                          fontWeight: "800",
                          color: codeMode === "BATCH" ? "#FFFFFF" : themeColors.textPrimary,
                        }}
                      >
                        {language === "BM" ? "Jana Pukal" : "Batch Pack"}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  {/* Prefix & Notes Input */}
                  <View style={{ flexDirection: "row", gap: 10 }}>
                    <View style={{ width: 90 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 5 }}>
                        Prefix
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: themeColors.surfaceContainer,
                          borderRadius: 12,
                          paddingHorizontal: 12,
                          paddingVertical: 9,
                          color: themeColors.textPrimary,
                          fontWeight: "800",
                          fontSize: 14,
                          textAlign: "center",
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                        }}
                        value={codePrefix}
                        onChangeText={(t) => setCodePrefix(t.toUpperCase())}
                        placeholder="ART"
                        placeholderTextColor={themeColors.textMuted}
                        maxLength={6}
                      />
                    </View>

                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 5 }}>
                        {language === "BM" ? "Catatan / Tag Kumpulan" : "Tag / Notes (Optional)"}
                      </Text>
                      <TextInput
                        style={{
                          backgroundColor: themeColors.surfaceContainer,
                          borderRadius: 12,
                          paddingHorizontal: 14,
                          paddingVertical: 9,
                          color: themeColors.textPrimary,
                          fontSize: 13,
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                        }}
                        value={codeNotes}
                        onChangeText={setCodeNotes}
                        placeholder={language === "BM" ? "Cth: Ambilan Mac 2026" : "E.g. March Intake"}
                        placeholderTextColor={themeColors.textMuted}
                      />
                    </View>
                  </View>

                  {/* Batch Quantity Selection (Only shown in BATCH mode) */}
                  {codeMode === "BATCH" && (
                    <View>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                        {language === "BM" ? "Jumlah Kod Dihasilkan:" : "Batch Pack Size:"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[5, 10, 20].map((num) => {
                          const isSel = batchCount === num;
                          return (
                            <TouchableOpacity
                              key={num}
                              onPress={() => {
                                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                                setBatchCount(num as any);
                              }}
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 10,
                                backgroundColor: isSel
                                  ? (isDark ? "#881337" : themeColors.maroonPrimary)
                                  : themeColors.surfaceContainer,
                                borderWidth: 1.5,
                                borderColor: isSel
                                  ? (isDark ? "#BE123C" : themeColors.maroonPrimary)
                                  : themeColors.borderColor,
                                alignItems: "center",
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 13,
                                  fontWeight: "800",
                                  color: isSel ? "#FFFFFF" : themeColors.textPrimary,
                                }}
                              >
                                {num} {language === "BM" ? "Kod" : "Codes"}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}

                  {/* Primary CTA Generator Button */}
                  <TouchableOpacity
                    activeOpacity={0.85}
                    onPress={codeMode === "SINGLE" ? handleGenerateSingleCode : handleGenerateBatch}
                    disabled={isGeneratingCodes}
                    style={{
                      backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                      paddingVertical: 12,
                      borderRadius: 12,
                      alignItems: "center",
                      justifyContent: "center",
                      flexDirection: "row",
                      gap: 8,
                      borderWidth: 1,
                      borderColor: isDark ? "#BE123C" : themeColors.maroonPrimary,
                      marginTop: 2,
                    }}
                  >
                    {isGeneratingCodes ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <MaterialCommunityIcons
                          name={codeMode === "SINGLE" ? "plus-circle-outline" : "layers-plus"}
                          size={18}
                          color="#FFFFFF"
                        />
                        <Text style={{ fontSize: 14, fontWeight: "800", color: "#FFFFFF" }}>
                          {codeMode === "SINGLE"
                            ? (language === "BM" ? "Jana 1 Kod Jemputan" : "Generate 1 Invite Code")
                            : (language === "BM" ? `Jana & Kongsi Pek ${batchCount} Kod` : `Generate ${batchCount} Codes Pack`)}
                        </Text>
                      </>
                    )}
                  </TouchableOpacity>
                </Animated.View>
              )}
            </View>

            {/* 3. Inventory List & Search Header */}
            <View style={{ gap: 10 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Senarai Kod Jemputan" : "Invite Codes"}
                  </Text>
                  <View
                    style={{
                      backgroundColor: themeColors.surfaceContainer,
                      paddingHorizontal: 8,
                      paddingVertical: 2,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                    }}
                  >
                    <Text style={{ fontSize: 11, fontWeight: "800", color: themeColors.textPrimary }}>
                      {filteredCodes.length}
                    </Text>
                  </View>
                </View>

                {activeCodesCount > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={handleCopyAllActive}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 4,
                      backgroundColor: "rgba(16, 185, 129, 0.12)",
                      paddingHorizontal: 10,
                      paddingVertical: 5,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "rgba(16, 185, 129, 0.3)",
                    }}
                  >
                    <MaterialCommunityIcons name="content-copy" size={13} color="#10B981" />
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#10B981" }}>
                      {language === "BM" ? "Salin Kod Aktif" : "Copy Active"}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Search Bar */}
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
                  placeholder={language === "BM" ? "Cari kod, catatan atau penama..." : "Search code, note, or agent..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={codeSearch}
                  onChangeText={setCodeSearch}
                />
                {codeSearch.length > 0 && (
                  <TouchableOpacity onPress={() => setCodeSearch("")} style={{ padding: 4 }}>
                    <MaterialCommunityIcons name="close-circle" size={16} color={themeColors.textMuted} />
                  </TouchableOpacity>
                )}
              </View>

              {/* Filter Chips Bar */}
              <View style={{ flexDirection: "row", gap: 6 }}>
                {[
                  { id: "ALL", label: language === "BM" ? "Semua" : "All", count: inviteCodes.length },
                  { id: "ACTIVE", label: language === "BM" ? "Aktif" : "Active", count: activeCodesCount },
                  { id: "USED", label: language === "BM" ? "Ditebus" : "Used", count: usedCodesCount },
                  { id: "REVOKED", label: language === "BM" ? "Batal" : "Revoked", count: revokedCodesCount },
                ].map((f) => {
                  const isSel = codeFilter === f.id;
                  return (
                    <TouchableOpacity
                      key={f.id}
                      onPress={() => {
                        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                        setCodeFilter(f.id as any);
                      }}
                      style={{
                        flex: 1,
                        paddingVertical: 6,
                        borderRadius: 10,
                        backgroundColor: isSel
                          ? (isDark ? "#881337" : themeColors.maroonPrimary)
                          : themeColors.surfaceContainer,
                        borderWidth: 1,
                        borderColor: isSel
                          ? (isDark ? "#BE123C" : themeColors.maroonPrimary)
                          : themeColors.borderColor,
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: "800",
                          color: isSel ? "#FFFFFF" : themeColors.textMuted,
                        }}
                      >
                        {f.label} ({f.count})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Batch & Maintenance Action Toolbar */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
                    setIsMultiSelectMode(!isMultiSelectMode);
                    if (isMultiSelectMode) setSelectedCodes([]);
                  }}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    backgroundColor: isMultiSelectMode
                      ? (isDark ? "#881337" : themeColors.maroonPrimary)
                      : themeColors.surfaceContainer,
                    paddingHorizontal: 12,
                    paddingVertical: 7,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: isMultiSelectMode
                      ? (isDark ? "#BE123C" : themeColors.maroonPrimary)
                      : themeColors.borderColor,
                  }}
                >
                  <MaterialCommunityIcons
                    name={isMultiSelectMode ? "checkbox-multiple-marked" : "checkbox-multiple-blank-outline"}
                    size={16}
                    color={isMultiSelectMode ? "#FFFFFF" : themeColors.textPrimary}
                  />
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: "700",
                      color: isMultiSelectMode ? "#FFFFFF" : themeColors.textPrimary,
                    }}
                  >
                    {isMultiSelectMode
                      ? (language === "BM" ? "Tutup Pilihan" : "Exit Selection")
                      : (language === "BM" ? "Pilih Banyak" : "Multi-Select")}
                  </Text>
                </TouchableOpacity>

                {revokedCodesCount > 0 && (
                  <TouchableOpacity
                    activeOpacity={0.8}
                    onPress={handleDeleteAllRevoked}
                    disabled={isProcessingBatchCodes}
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      gap: 5,
                      backgroundColor: "rgba(239, 68, 68, 0.12)",
                      paddingHorizontal: 12,
                      paddingVertical: 7,
                      borderRadius: 8,
                      borderWidth: 1,
                      borderColor: "rgba(239, 68, 68, 0.3)",
                    }}
                  >
                    <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                    <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#EF4444" }}>
                      {language === "BM" ? `Padam Semua Batal (${revokedCodesCount})` : `Delete All Revoked (${revokedCodesCount})`}
                    </Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Multi-Select Action Panel */}
              {isMultiSelectMode && (
                <View
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    padding: 12,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    gap: 10,
                  }}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <Text style={{ fontSize: 12.5, fontWeight: "800", color: themeColors.textPrimary }}>
                      {language === "BM"
                        ? `${selectedCodes.length} daripada ${filteredCodes.length} kod dipilih`
                        : `${selectedCodes.length} of ${filteredCodes.length} codes selected`}
                    </Text>
                    <TouchableOpacity onPress={handleSelectAllFiltered} style={{ paddingHorizontal: 6, paddingVertical: 2 }}>
                      <Text style={{ fontSize: 12, fontWeight: "700", color: isDark ? "#FDA4AF" : themeColors.maroonPrimary }}>
                        {selectedCodes.length === filteredCodes.length && filteredCodes.length > 0
                          ? (language === "BM" ? "Batal Semua" : "Deselect All")
                          : (language === "BM" ? "Pilih Semua" : "Select All")}
                      </Text>
                    </TouchableOpacity>
                  </View>

                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleBatchRevokeSelected}
                      disabled={selectedCodes.length === 0 || isProcessingBatchCodes}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: selectedCodes.length > 0 ? "rgba(245, 158, 11, 0.15)" : themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: selectedCodes.length > 0 ? "rgba(245, 158, 11, 0.4)" : themeColors.borderColor,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 4,
                        opacity: selectedCodes.length > 0 ? 1 : 0.5,
                      }}
                    >
                      <MaterialCommunityIcons name="cancel" size={15} color="#F59E0B" />
                      <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#F59E0B" }}>
                        {language === "BM" ? "Batalkan Terpilih" : "Revoke Selected"}
                      </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      activeOpacity={0.8}
                      onPress={handleBatchDeleteSelected}
                      disabled={selectedCodes.length === 0 || isProcessingBatchCodes}
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        borderRadius: 8,
                        backgroundColor: selectedCodes.length > 0 ? "rgba(239, 68, 68, 0.15)" : themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: selectedCodes.length > 0 ? "rgba(239, 68, 68, 0.4)" : themeColors.borderColor,
                        alignItems: "center",
                        justifyContent: "center",
                        flexDirection: "row",
                        gap: 4,
                        opacity: selectedCodes.length > 0 ? 1 : 0.5,
                      }}
                    >
                      <MaterialCommunityIcons name="trash-can-outline" size={15} color="#EF4444" />
                      <Text style={{ fontSize: 11.5, fontWeight: "800", color: "#EF4444" }}>
                        {language === "BM" ? "Padam Terpilih" : "Delete Selected"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>

            {/* 4. Code Cards List */}
            {filteredCodes.length === 0 ? (
              <View
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  padding: 24,
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <View
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    backgroundColor: themeColors.surfaceContainer,
                    justifyContent: "center",
                    alignItems: "center",
                    marginBottom: 4,
                  }}
                >
                  <MaterialCommunityIcons name="ticket-outline" size={26} color={themeColors.textMuted} />
                </View>
                <Text style={{ fontSize: 14.5, fontWeight: "700", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Tiada Kod Dijumpai" : "No Invite Codes Found"}
                </Text>
                <Text style={{ fontSize: 12.5, color: themeColors.textMuted, textAlign: "center" }}>
                  {codeSearch.trim()
                    ? (language === "BM" ? "Tiada padanan untuk carian anda." : "No matches for your search.")
                    : (language === "BM" ? "Jana kod baru menggunakan borang di atas." : "Generate new codes using the form above.")}
                </Text>
              </View>
            ) : (
              filteredCodes.map((codeDoc) => {
                const isActive = codeDoc.status === "ACTIVE";
                const isUsed = codeDoc.status === "USED";
                const isRevoked = !isActive && !isUsed;
                const isCopied = copiedCode === codeDoc.code;
                const isSelected = selectedCodes.includes(codeDoc.code);

                return (
                  <TouchableOpacity
                    key={codeDoc.code}
                    activeOpacity={isMultiSelectMode ? 0.75 : 1}
                    onPress={isMultiSelectMode ? () => handleToggleSelectCode(codeDoc.code) : undefined}
                    style={{
                      backgroundColor: themeColors.cardBackground,
                      borderRadius: 16,
                      borderWidth: 1,
                      borderColor: isSelected
                        ? (isDark ? "#FDA4AF" : themeColors.maroonPrimary)
                        : isActive
                        ? "rgba(16, 185, 129, 0.35)"
                        : themeColors.borderColor,
                      borderLeftWidth: isActive ? 4.5 : 1,
                      borderLeftColor: isActive
                        ? "#10B981"
                        : isUsed
                        ? "#3B82F6"
                        : "#EF4444",
                      padding: 14,
                      gap: 10,
                      opacity: isRevoked ? 0.75 : 1,
                    }}
                  >
                    {/* Header Row: Code String & Status Badge */}
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                        {isMultiSelectMode && (
                          <TouchableOpacity
                            onPress={() => handleToggleSelectCode(codeDoc.code)}
                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                          >
                            <MaterialCommunityIcons
                              name={isSelected ? "checkbox-marked" : "checkbox-blank-outline"}
                              size={20}
                              color={isSelected ? (isDark ? "#FDA4AF" : themeColors.maroonPrimary) : themeColors.textMuted}
                            />
                          </TouchableOpacity>
                        )}

                        {/* Tap to copy code badge */}
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCopyCode(codeDoc.code)}
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 6,
                            backgroundColor: themeColors.surfaceContainer,
                            paddingVertical: 5,
                            paddingHorizontal: 10,
                            borderRadius: 8,
                            borderWidth: 1,
                            borderColor: isCopied ? "#10B981" : themeColors.borderColor,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isCopied ? "check-bold" : "content-copy"}
                            size={15}
                            color={isCopied ? "#10B981" : themeColors.textPrimary}
                          />
                          <Text
                            style={{
                              fontSize: 14.5,
                              fontWeight: "900",
                              fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
                              color: isCopied ? "#10B981" : themeColors.textPrimary,
                              letterSpacing: 0.8,
                            }}
                          >
                            {codeDoc.code}
                          </Text>
                          {isCopied && (
                            <Text style={{ fontSize: 11, fontWeight: "800", color: "#10B981" }}>
                              {language === "BM" ? "Disalin!" : "Copied!"}
                            </Text>
                          )}
                        </TouchableOpacity>
                      </View>

                      {/* Status Badge */}
                      <View
                        style={{
                          backgroundColor: isActive
                            ? "rgba(16, 185, 129, 0.15)"
                            : isUsed
                            ? "rgba(59, 130, 246, 0.15)"
                            : "rgba(239, 68, 68, 0.15)",
                          paddingHorizontal: 8,
                          paddingVertical: 3,
                          borderRadius: 6,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 10.5,
                            fontWeight: "800",
                            color: isActive ? "#10B981" : isUsed ? "#3B82F6" : "#EF4444",
                          }}
                        >
                          {codeDoc.status || "REVOKED"}
                        </Text>
                      </View>
                    </View>

                    {/* Meta Details: Redeemed By or Tag */}
                    {isUsed && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 8,
                          backgroundColor: themeColors.surfaceContainer,
                          padding: 8,
                          borderRadius: 10,
                        }}
                      >
                        <View
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 13,
                            backgroundColor: "#3B82F6",
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 11, fontWeight: "800", color: "#FFFFFF" }}>
                            {getUserInitials(codeDoc.usedByName || codeDoc.usedBy || "Agent")}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                            {language === "BM" ? "Ditebus oleh" : "Redeemed by"}:
                          </Text>
                          <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
                            {codeDoc.usedByName || codeDoc.usedBy}
                          </Text>
                        </View>
                      </View>
                    )}

                    {codeDoc.notes ? (
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 5 }}>
                        <MaterialCommunityIcons name="tag-outline" size={13} color={themeColors.textMuted} />
                        <Text style={{ fontSize: 11.5, color: themeColors.textMuted }} numberOfLines={1}>
                          {codeDoc.notes}
                        </Text>
                      </View>
                    ) : null}

                    {/* Action Buttons for Code Cards */}
                    <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                      {isActive ? (
                        <>
                          {/* 1. Share WhatsApp Button */}
                          <TouchableOpacity
                            activeOpacity={0.8}
                            onPress={() => handleShareWhatsApp([codeDoc.code])}
                            style={{
                              flex: 1.4,
                              backgroundColor: "#25D366",
                              paddingVertical: 8,
                              borderRadius: 10,
                              flexDirection: "row",
                              justifyContent: "center",
                              alignItems: "center",
                              gap: 6,
                            }}
                          >
                            <MaterialCommunityIcons name="whatsapp" size={16} color="#FFFFFF" />
                            <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFFFFF" }}>
                              {language === "BM" ? "Kongsi" : "Share"}
                            </Text>
                          </TouchableOpacity>

                          {/* 2. Quick Copy Button */}
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleCopyCode(codeDoc.code)}
                            style={{
                              flex: 1,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: themeColors.surfaceContainer,
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: 1,
                              borderColor: themeColors.borderColor,
                              flexDirection: "row",
                              gap: 4,
                            }}
                          >
                            <MaterialCommunityIcons
                              name={isCopied ? "check" : "content-copy"}
                              size={14}
                              color={isCopied ? "#10B981" : themeColors.textPrimary}
                            />
                            <Text
                              style={{
                                fontSize: 12,
                                fontWeight: "700",
                                color: isCopied ? "#10B981" : themeColors.textPrimary,
                              }}
                            >
                              {isCopied ? (language === "BM" ? "Disalin" : "Copied") : (language === "BM" ? "Salin" : "Copy")}
                            </Text>
                          </TouchableOpacity>

                          {/* 3. Revoke Button */}
                          <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => handleRevokeCode(codeDoc.code)}
                            style={{
                              paddingHorizontal: 12,
                              paddingVertical: 8,
                              borderRadius: 10,
                              backgroundColor: "rgba(245, 158, 11, 0.12)",
                              justifyContent: "center",
                              alignItems: "center",
                              borderWidth: 1,
                              borderColor: "rgba(245, 158, 11, 0.3)",
                            }}
                          >
                            <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#F59E0B" }}>
                              {language === "BM" ? "Batal" : "Revoke"}
                            </Text>
                          </TouchableOpacity>
                        </>
                      ) : (
                        /* For Used or Revoked: Quick Copy & Full Delete */
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => handleCopyCode(codeDoc.code)}
                          style={{
                            flex: 1,
                            paddingVertical: 8,
                            borderRadius: 10,
                            backgroundColor: themeColors.surfaceContainer,
                            justifyContent: "center",
                            alignItems: "center",
                            borderWidth: 1,
                            borderColor: themeColors.borderColor,
                            flexDirection: "row",
                            gap: 4,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isCopied ? "check" : "content-copy"}
                            size={14}
                            color={isCopied ? "#10B981" : themeColors.textPrimary}
                          />
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: "700",
                              color: isCopied ? "#10B981" : themeColors.textPrimary,
                            }}
                          >
                            {isCopied ? (language === "BM" ? "Disalin" : "Copied") : (language === "BM" ? "Salin Kod" : "Copy Code")}
                          </Text>
                        </TouchableOpacity>
                      )}

                      {/* Delete Code from Database Button (Available for ALL codes) */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteCode(codeDoc.code)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        style={{
                          paddingHorizontal: 10,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                          justifyContent: "center",
                          alignItems: "center",
                          borderWidth: 1,
                          borderColor: "rgba(239, 68, 68, 0.25)",
                        }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={16} color="#EF4444" />
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                );
              })
            )}
          </Animated.View>
        )}

        {/* ========================================================================= */}
        {/* TAB 3: SIARAN NOTIFIKASI (BROADCAST PUSH COMPOSER) */}
        {/* ========================================================================= */}
        {activeTab === "broadcast" && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 20 }}>
            <View
              style={{
                backgroundColor: themeColors.cardBackground,
                borderRadius: 18,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                padding: 18,
                gap: 16,
              }}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 12,
                    backgroundColor: themeColors.maroonLight,
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  <MaterialCommunityIcons name="bullhorn-outline" size={24} color={themeColors.maroonPrimary} />
                </View>
                <View>
                  <Text style={{ fontSize: 17, fontWeight: "800", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Cipta Siaran Notifikasi" : "Compose Agency Push"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                    {language === "BM" ? "Notifikasi terus ke telefon semua ejen" : "Instant push to all agent devices"}
                  </Text>
                </View>
              </View>

              {/* Category selector */}
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 8 }}>
                  {language === "BM" ? "Kategori Notifikasi" : "Category"}
                </Text>
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                  {[
                    { id: "GENERAL", label: language === "BM" ? "Umum" : "General" },
                    { id: "URGENT", label: language === "BM" ? "Penting" : "Urgent" },
                    { id: "LISTING", label: language === "BM" ? "Hartanah" : "Listing" },
                    { id: "COMMISSION", label: language === "BM" ? "Komisen" : "Commission" },
                  ].map((cat) => {
                    const isSel = broadcastCategory === cat.id;
                    const activeBg = isDark ? "#881337" : themeColors.maroonPrimary;
                    const activeBorder = isDark ? "#BE123C" : themeColors.maroonPrimary;
                    return (
                      <TouchableOpacity
                        key={cat.id}
                        onPress={() => setBroadcastCategory(cat.id as any)}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 8,
                          borderRadius: 10,
                          backgroundColor: isSel ? activeBg : themeColors.surfaceContainer,
                          borderWidth: 1,
                          borderColor: isSel ? activeBorder : themeColors.borderColor,
                        }}
                      >
                        <Text
                          style={{
                            fontSize: 13,
                            fontWeight: "700",
                            color: isSel ? "#FFFFFF" : themeColors.textPrimary,
                          }}
                        >
                          {cat.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Title input */}
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                  {language === "BM" ? "Tajuk Siaran" : "Broadcast Title"}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14.5,
                    fontWeight: "700",
                    color: themeColors.textPrimary,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                  }}
                  placeholder={language === "BM" ? "Cth: Taklimat Agensi Hari Ini Jam 3 PM" : "E.g. Agency Briefing Today at 3 PM"}
                  placeholderTextColor={themeColors.textMuted}
                  value={broadcastTitle}
                  onChangeText={setBroadcastTitle}
                />
              </View>

              {/* Message input */}
              <View>
                <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textMuted, marginBottom: 6 }}>
                  {language === "BM" ? "Mesej Siaran" : "Message Body"}
                </Text>
                <TextInput
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    borderRadius: 12,
                    paddingHorizontal: 14,
                    paddingVertical: 12,
                    fontSize: 14,
                    color: themeColors.textPrimary,
                    minHeight: 110,
                    textAlignVertical: "top",
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                  }}
                  multiline
                  numberOfLines={4}
                  placeholder={language === "BM" ? "Tulis makluman atau pesanan untuk semua ejen..." : "Type message for all agents..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={broadcastMessage}
                  onChangeText={setBroadcastMessage}
                />
              </View>

              {/* Send Broadcast Button */}
              <TouchableOpacity
                activeOpacity={0.85}
                onPress={handleSendBroadcast}
                disabled={isSendingBroadcast}
                style={{
                  backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                  borderWidth: 1,
                  borderColor: isDark ? "#BE123C" : themeColors.maroonPrimary,
                  paddingVertical: 14,
                  borderRadius: 14,
                  flexDirection: "row",
                  justifyContent: "center",
                  alignItems: "center",
                  gap: 8,
                  marginTop: 6,
                }}
              >
                {isSendingBroadcast ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <>
                    <MaterialCommunityIcons name="send" size={20} color="#FFFFFF" />
                    <Text style={{ fontSize: 15, fontWeight: "800", color: "#FFFFFF" }}>
                      {language === "BM" ? "Hantar Notifikasi Tolak (Push)" : "Dispatch Push Notification"}
                    </Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* ========================================================================= */}
        {/* TAB 4: KAWALAN LISTING (AGENCY LISTING MODERATOR) */}
        {/* ========================================================================= */}
        {activeTab === "listings" && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 16 }}>
            {/* Search */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: themeColors.cardBackground,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                paddingHorizontal: 14,
                paddingVertical: 4,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  fontSize: 14,
                  color: themeColors.textPrimary,
                }}
                placeholder={language === "BM" ? "Cari listing atau ejen..." : "Search listing or agent..."}
                placeholderTextColor={themeColors.textMuted}
                value={listingSearch}
                onChangeText={setListingSearch}
              />
            </View>

            <Text style={{ fontSize: 14, fontWeight: "800", color: themeColors.textMuted }}>
              {language === "BM" ? "Semua Listing Agensi" : "Agency Listings"} ({filteredListings.length})
            </Text>

            {filteredListings.map((listing) => (
              <View
                key={listing.id}
                style={{
                  backgroundColor: themeColors.cardBackground,
                  borderRadius: 16,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  padding: 16,
                  gap: 10,
                }}
              >
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }} numberOfLines={1}>
                      {listing.tajuk || "Hartanah"}
                    </Text>
                    <Text style={{ fontSize: 12.5, color: themeColors.textMuted, marginTop: 2 }}>
                      {listing.alamat || listing.negeri || "Malaysia"}
                    </Text>
                  </View>
                  <View
                    style={{
                      backgroundColor: "rgba(225, 29, 72, 0.12)",
                      paddingHorizontal: 9,
                      paddingVertical: 4,
                      borderRadius: 8,
                    }}
                  >
                    <Text style={{ fontSize: 11.5, fontWeight: "800", color: themeColors.maroonPrimary }}>
                      {listing.status || "Aktif"}
                    </Text>
                  </View>
                </View>

                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <Text style={{ fontSize: 15, fontWeight: "800", color: themeColors.maroonPrimary }}>
                    {listing.harga ? `RM ${listing.harga}` : "RM -"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textMuted }}>
                    Ejen: {listing.authorName || listing.agentId || "Artha"}
                  </Text>
                </View>

                {/* Status Changer Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => {
                    setSelectedListing(listing);
                    setIsStatusModalOpen(true);
                  }}
                  style={{
                    backgroundColor: themeColors.surfaceContainer,
                    paddingVertical: 10,
                    borderRadius: 10,
                    alignItems: "center",
                    flexDirection: "row",
                    justifyContent: "center",
                    gap: 6,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    marginTop: 4,
                  }}
                >
                  <MaterialCommunityIcons name="pencil" size={15} color={themeColors.textPrimary} />
                  <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Tukar Status Listing" : "Change Status"}
                  </Text>
                </TouchableOpacity>
              </View>
            ))}
          </Animated.View>
        )}

        {/* --- TAB 5: FEEDBACK & BUG RESOLUTION DESK --- */}
        {activeTab === "feedback" && (
          <Animated.View entering={FadeInDown.duration(200)} style={{ gap: 16 }}>
            {/* Interactive KPI Metric Cards (Zero Text Wrapping) */}
            <View style={{ flexDirection: "row", gap: 8 }}>
              {/* Total */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFeedbackStatusFilter("ALL");
                }}
                style={{
                  flex: 1,
                  backgroundColor: feedbackStatusFilter === "ALL" ? (isDark ? "rgba(255,255,255,0.12)" : themeColors.surfaceContainer) : themeColors.cardBackground,
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: feedbackStatusFilter === "ALL" ? (isDark ? "#FDA4AF" : themeColors.maroonPrimary) : themeColors.borderColor,
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900", color: themeColors.textPrimary }}>
                  {allFeedback.length}
                </Text>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    color: themeColors.textMuted,
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {language === "BM" ? "Jumlah" : "All"}
                </Text>
              </TouchableOpacity>

              {/* Pending */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFeedbackStatusFilter((curr) => (curr === "PENDING" ? "ALL" : "PENDING"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: feedbackStatusFilter === "PENDING" ? "rgba(245, 158, 11, 0.22)" : "rgba(245, 158, 11, 0.08)",
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: feedbackStatusFilter === "PENDING" ? "#F59E0B" : "rgba(245, 158, 11, 0.25)",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#F59E0B" }}>
                  {pendingFeedbackCount}
                </Text>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    color: "#F59E0B",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {language === "BM" ? "Menunggu" : "Pending"}
                </Text>
              </TouchableOpacity>

              {/* In Progress */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFeedbackStatusFilter((curr) => (curr === "IN_PROGRESS" ? "ALL" : "IN_PROGRESS"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: feedbackStatusFilter === "IN_PROGRESS" ? "rgba(59, 130, 246, 0.22)" : "rgba(59, 130, 246, 0.08)",
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: feedbackStatusFilter === "IN_PROGRESS" ? "#3B82F6" : "rgba(59, 130, 246, 0.25)",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#3B82F6" }}>
                  {inProgressFeedbackCount}
                </Text>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    color: "#3B82F6",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {language === "BM" ? "Tindakan" : "Active"}
                </Text>
              </TouchableOpacity>

              {/* Resolved */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                  setFeedbackStatusFilter((curr) => (curr === "RESOLVED" ? "ALL" : "RESOLVED"));
                }}
                style={{
                  flex: 1,
                  backgroundColor: feedbackStatusFilter === "RESOLVED" ? "rgba(16, 185, 129, 0.22)" : "rgba(16, 185, 129, 0.08)",
                  borderRadius: 14,
                  paddingVertical: 10,
                  paddingHorizontal: 6,
                  alignItems: "center",
                  borderWidth: 1.5,
                  borderColor: feedbackStatusFilter === "RESOLVED" ? "#10B981" : "rgba(16, 185, 129, 0.25)",
                }}
              >
                <Text style={{ fontSize: 18, fontWeight: "900", color: "#10B981" }}>
                  {resolvedFeedbackCount}
                </Text>
                <Text
                  style={{
                    fontSize: 10.5,
                    fontWeight: "700",
                    color: "#10B981",
                    marginTop: 2,
                  }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {language === "BM" ? "Selesai" : "Done"}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                backgroundColor: themeColors.cardBackground,
                paddingHorizontal: 14,
                borderRadius: 14,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                gap: 10,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                value={feedbackSearch}
                onChangeText={setFeedbackSearch}
                placeholder={
                  language === "BM"
                    ? "Cari tajuk, ejen, ralat, atau peranti..."
                    : "Search title, agent, error, or device..."
                }
                placeholderTextColor={themeColors.textMuted}
                style={{
                  flex: 1,
                  paddingVertical: 12,
                  fontSize: 14,
                  color: themeColors.textPrimary,
                }}
              />
              {feedbackSearch.length > 0 && (
                <TouchableOpacity onPress={() => setFeedbackSearch("")}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            {/* Status Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { id: "ALL", label: language === "BM" ? "Semua Status" : "All Status" },
                { id: "PENDING", label: language === "BM" ? `Menunggu (${pendingFeedbackCount})` : `Pending (${pendingFeedbackCount})` },
                { id: "IN_PROGRESS", label: language === "BM" ? `Dalam Tindakan (${inProgressFeedbackCount})` : `In Progress (${inProgressFeedbackCount})` },
                { id: "RESOLVED", label: language === "BM" ? `Selesai (${resolvedFeedbackCount})` : `Resolved (${resolvedFeedbackCount})` },
              ].map((chip) => {
                const isSelected = feedbackStatusFilter === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => setFeedbackStatusFilter(chip.id as any)}
                    style={{
                      paddingVertical: 8,
                      paddingHorizontal: 14,
                      borderRadius: 10,
                      backgroundColor: isSelected ? (isDark ? "#881337" : themeColors.maroonPrimary) : themeColors.cardBackground,
                      borderWidth: 1,
                      borderColor: isSelected ? (isDark ? "#BE123C" : themeColors.maroonPrimary) : themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12.5,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected ? "#FFFFFF" : themeColors.textSecondary,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Category Filter Tabs */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {[
                { id: "ALL", label: language === "BM" ? "Semua Kategori" : "All Types" },
                { id: "Bug", label: language === "BM" ? "🐛 Ralat & Bug" : "🐛 Bugs" },
                { id: "Feature", label: language === "BM" ? "💡 Cadangan Ciri" : "💡 Features" },
                { id: "Performance", label: language === "BM" ? "⚡ Prestasi" : "⚡ Performance" },
                { id: "General", label: language === "BM" ? "⭐ Umum" : "⭐ General" },
              ].map((chip) => {
                const isSelected = feedbackCategoryFilter === chip.id;
                return (
                  <TouchableOpacity
                    key={chip.id}
                    onPress={() => setFeedbackCategoryFilter(chip.id as any)}
                    style={{
                      paddingVertical: 6,
                      paddingHorizontal: 12,
                      borderRadius: 10,
                      backgroundColor: isSelected ? themeColors.surfaceContainer : themeColors.cardBackground,
                      borderWidth: 1,
                      borderColor: isSelected ? themeColors.textPrimary : themeColors.borderColor,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: isSelected ? "700" : "500",
                        color: isSelected ? themeColors.textPrimary : themeColors.textMuted,
                      }}
                    >
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* List of Feedback Tickets */}
            {filteredFeedback.length === 0 ? (
              <View
                style={{
                  backgroundColor: themeColors.cardBackground,
                  padding: 32,
                  borderRadius: 18,
                  alignItems: "center",
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  gap: 10,
                  marginTop: 10,
                }}
              >
                <MaterialCommunityIcons name="check-decagram-outline" size={48} color="#10B981" />
                <Text style={{ fontSize: 16, fontWeight: "800", color: themeColors.textPrimary }}>
                  {language === "BM" ? "Tiada Tiket Ditemui" : "No Tickets Found"}
                </Text>
                <Text style={{ fontSize: 13, color: themeColors.textMuted, textAlign: "center" }}>
                  {language === "BM"
                    ? "Semua maklum balas dan laporan ralat telah diselesaikan atau tiada rekod yang sepadan dengan carian anda."
                    : "All feedback and bug reports have been addressed or no records match your filter."}
                </Text>
              </View>
            ) : (
              filteredFeedback.map((item) => {
                const ticketId = item.id || "";
                if (!ticketId) return null;

                const isExpanded = expandedFeedbackId === ticketId;
                const draftReply =
                  adminReplyDrafts[ticketId] !== undefined
                    ? adminReplyDrafts[ticketId]
                    : item.adminResponse || "";

                // Color mappings
                const isBug = item.type === "Bug";
                const isFeature = item.type === "Feature";
                const isPerf = item.type === "Performance";

                const typeColor = isBug
                  ? "#EF4444"
                  : isFeature
                  ? "#F59E0B"
                  : isPerf
                  ? "#8B5CF6"
                  : "#EC4899";

                const typeLabel = isBug
                  ? (language === "BM" ? "Ralat / Bug" : "Bug Report")
                  : isFeature
                  ? (language === "BM" ? "Cadangan Ciri" : "Feature Request")
                  : isPerf
                  ? (language === "BM" ? "Prestasi" : "Performance")
                  : (language === "BM" ? "Umum" : "General");

                const statusColor =
                  item.status === "resolved"
                    ? "#10B981"
                    : item.status === "in-progress"
                    ? "#3B82F6"
                    : item.status === "closed"
                    ? "#6B7280"
                    : "#F59E0B";

                const statusLabel =
                  item.status === "resolved"
                    ? (language === "BM" ? "Selesai" : "Resolved")
                    : item.status === "in-progress"
                    ? (language === "BM" ? "Dalam Tindakan" : "In Progress")
                    : item.status === "closed"
                    ? (language === "BM" ? "Ditutup" : "Closed")
                    : (language === "BM" ? "Menunggu" : "Pending");

                const severityColor =
                  item.severity === "Critical"
                    ? "#EF4444"
                    : item.severity === "High"
                    ? "#F97316"
                    : item.severity === "Medium"
                    ? "#F59E0B"
                    : "#3B82F6";

                return (
                  <View
                    key={ticketId}
                    style={{
                      backgroundColor: themeColors.cardBackground,
                      borderRadius: 18,
                      padding: 16,
                      borderWidth: 1,
                      borderColor: themeColors.borderColor,
                      gap: 12,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.04,
                      shadowRadius: 6,
                      elevation: 2,
                    }}
                  >
                    {/* Header Row: Type, Severity, Status, Delete */}
                    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap", flex: 1 }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: `${typeColor}18`,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <MaterialCommunityIcons
                            name={isBug ? "bug" : isFeature ? "lightbulb-on" : isPerf ? "lightning-bolt" : "information"}
                            size={13}
                            color={typeColor}
                          />
                          <Text style={{ fontSize: 11.5, fontWeight: "800", color: typeColor }}>
                            {typeLabel}
                          </Text>
                        </View>

                        {item.severity && (
                          <View
                            style={{
                              backgroundColor: `${severityColor}18`,
                              paddingHorizontal: 7,
                              paddingVertical: 3,
                              borderRadius: 6,
                            }}
                          >
                            <Text style={{ fontSize: 11, fontWeight: "800", color: severityColor }}>
                              {item.severity.toUpperCase()}
                            </Text>
                          </View>
                        )}

                        <View
                          style={{
                            backgroundColor: `${statusColor}18`,
                            paddingHorizontal: 8,
                            paddingVertical: 4,
                            borderRadius: 8,
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: "800", color: statusColor }}>
                            {statusLabel}
                          </Text>
                        </View>
                      </View>

                      {/* Trash Delete Action */}
                      <TouchableOpacity
                        activeOpacity={0.7}
                        onPress={() => handleDeleteFeedbackItem(ticketId)}
                        style={{
                          padding: 6,
                          borderRadius: 8,
                          backgroundColor: "rgba(239, 68, 68, 0.1)",
                        }}
                      >
                        <MaterialCommunityIcons name="trash-can-outline" size={17} color="#EF4444" />
                      </TouchableOpacity>
                    </View>

                    {/* Agent / Reporter Info Bar */}
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        backgroundColor: themeColors.surfaceContainer,
                        padding: 10,
                        borderRadius: 12,
                      }}
                    >
                      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                        <View
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: 16,
                            backgroundColor: themeColors.maroonPrimary,
                            justifyContent: "center",
                            alignItems: "center",
                          }}
                        >
                          <Text style={{ fontSize: 12, fontWeight: "800", color: "#FFFFFF" }}>
                            {getUserInitials(item.userName || item.userEmail || "A")}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={1}>
                            {item.userName || "Ejen Artha"}
                          </Text>
                          <Text style={{ fontSize: 11, color: themeColors.textMuted }} numberOfLines={1}>
                            {item.userEmail || item.userId || "No email"}
                          </Text>
                        </View>
                      </View>

                      {/* WhatsApp Direct Connect */}
                      <TouchableOpacity
                        activeOpacity={0.75}
                        onPress={() =>
                          handleContactAgentWhatsApp(
                            item.userPhone,
                            item.userName,
                            item.title
                          )
                        }
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 4,
                          backgroundColor: "rgba(37, 211, 102, 0.15)",
                          paddingHorizontal: 9,
                          paddingVertical: 6,
                          borderRadius: 8,
                          borderWidth: 1,
                          borderColor: "rgba(37, 211, 102, 0.3)",
                        }}
                      >
                        <MaterialCommunityIcons name="whatsapp" size={15} color="#25D366" />
                        <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#25D366" }}>
                          WhatsApp
                        </Text>
                      </TouchableOpacity>
                    </View>

                    {/* Device Diagnostics Pill */}
                    {(item.deviceModel || item.appVersion) && (
                      <View
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 6,
                          flexWrap: "wrap",
                        }}
                      >
                        {item.deviceModel && (
                          <View
                            style={{
                              flexDirection: "row",
                              alignItems: "center",
                              gap: 4,
                              backgroundColor: themeColors.surfaceContainer,
                              paddingHorizontal: 8,
                              paddingVertical: 3,
                              borderRadius: 6,
                            }}
                          >
                            <MaterialCommunityIcons name="cellphone" size={12} color={themeColors.textMuted} />
                            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                              {item.deviceModel} ({item.osVersion || item.platform || "Android"})
                            </Text>
                          </View>
                        )}

                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 4,
                            backgroundColor: themeColors.surfaceContainer,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 6,
                          }}
                        >
                          <MaterialCommunityIcons name="tag-outline" size={12} color={themeColors.textMuted} />
                          <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                            {item.appVersion ? (item.appVersion.startsWith("v") ? item.appVersion : `v${item.appVersion}`) : "v1.5.2"} (b{item.buildNumber || "57"})
                          </Text>
                        </View>
                      </View>
                    )}

                    {/* Title & Description */}
                    <View style={{ gap: 4 }}>
                      {item.title ? (
                        <Text style={{ fontSize: 15, fontWeight: "800", color: themeColors.textPrimary }}>
                          {item.title}
                        </Text>
                      ) : null}
                      <Text style={{ fontSize: 13.5, color: themeColors.textSecondary, lineHeight: 20 }}>
                        {item.description}
                      </Text>
                    </View>

                    {/* Rating Stars (ONLY for General / Rating submissions) */}
                    {(item.type === "General" || (item.type as any) === "rating") && item.rating ? (
                      <View style={{ flexDirection: "row", gap: 3, alignItems: "center" }}>
                        {[1, 2, 3, 4, 5].map((star) => (
                          <MaterialCommunityIcons
                            key={star}
                            name={star <= item.rating! ? "star" : "star-outline"}
                            size={18}
                            color="#F59E0B"
                          />
                        ))}
                        <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#F59E0B", marginLeft: 4 }}>
                          {item.rating}/5
                        </Text>
                      </View>
                    ) : null}

                    {/* Reproduction Steps & Expected vs Actual (Expandable) */}
                    {(item.stepsToReproduce && item.stepsToReproduce.length > 0) || item.actualBehavior ? (
                      <View
                        style={{
                          backgroundColor: themeColors.surfaceContainer,
                          padding: 12,
                          borderRadius: 12,
                          gap: 8,
                        }}
                      >
                        <TouchableOpacity
                          activeOpacity={0.7}
                          onPress={() => setExpandedFeedbackId(isExpanded ? null : ticketId)}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            alignItems: "center",
                          }}
                        >
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                            <MaterialCommunityIcons name="format-list-numbered" size={16} color={themeColors.textPrimary} />
                            <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textPrimary }}>
                              {language === "BM" ? "Langkah Menghasilkan Ralat (Steps)" : "Steps & Behaviors"}
                            </Text>
                          </View>
                          <MaterialCommunityIcons
                            name={isExpanded ? "chevron-up" : "chevron-down"}
                            size={18}
                            color={themeColors.textMuted}
                          />
                        </TouchableOpacity>

                        {isExpanded && (
                          <View style={{ gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: themeColors.borderColor }}>
                            {item.stepsToReproduce && item.stepsToReproduce.length > 0 && (
                              <View style={{ gap: 4 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted }}>
                                  {language === "BM" ? "Langkah demi langkah:" : "Steps to reproduce:"}
                                </Text>
                                {item.stepsToReproduce.map((step, idx) => (
                                  <View key={idx} style={{ flexDirection: "row", gap: 6 }}>
                                    <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.maroonPrimary }}>
                                      {idx + 1}.
                                    </Text>
                                    <Text style={{ fontSize: 12, color: themeColors.textSecondary, flex: 1 }}>
                                      {step}
                                    </Text>
                                  </View>
                                ))}
                              </View>
                            )}

                            {item.expectedBehavior && (
                              <View style={{ gap: 2 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#10B981" }}>
                                  {language === "BM" ? "Kelakuan Dijangka:" : "Expected Behavior:"}
                                </Text>
                                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                                  {item.expectedBehavior}
                                </Text>
                              </View>
                            )}

                            {item.actualBehavior && (
                              <View style={{ gap: 2 }}>
                                <Text style={{ fontSize: 11.5, fontWeight: "700", color: "#EF4444" }}>
                                  {language === "BM" ? "Kelakuan Sebenar (Ralat):" : "Actual Behavior:"}
                                </Text>
                                <Text style={{ fontSize: 12, color: themeColors.textSecondary }}>
                                  {item.actualBehavior}
                                </Text>
                              </View>
                            )}
                          </View>
                        )}
                      </View>
                    ) : null}

                    {/* Screenshot Preview Card */}
                    {item.screenshotUrl ? (
                      <TouchableOpacity
                        activeOpacity={0.8}
                        onPress={() => setSelectedScreenshotModal(item.screenshotUrl || null)}
                        style={{
                          flexDirection: "row",
                          alignItems: "center",
                          gap: 10,
                          backgroundColor: themeColors.surfaceContainer,
                          padding: 8,
                          borderRadius: 12,
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                        }}
                      >
                        <Image
                          source={{ uri: item.screenshotUrl }}
                          style={{ width: 48, height: 48, borderRadius: 8, backgroundColor: "#333" }}
                          resizeMode="cover"
                        />
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 12.5, fontWeight: "700", color: themeColors.textPrimary }}>
                            {language === "BM" ? "Tangkapan Skrin Lampiran" : "Attached Screenshot"}
                          </Text>
                          <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                            {language === "BM" ? "Ketik untuk besarkan imej" : "Tap to enlarge image"}
                          </Text>
                        </View>
                        <MaterialCommunityIcons name="magnify-plus-outline" size={20} color={themeColors.textPrimary} />
                      </TouchableOpacity>
                    ) : null}

                    {/* Status Switcher Button Group */}
                    <View style={{ gap: 6, paddingTop: 4 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted }}>
                        {language === "BM" ? "Tukar Status Tiket:" : "Update Ticket Status:"}
                      </Text>
                      <View style={{ flexDirection: "row", gap: 8 }}>
                        {[
                          { id: "pending", label: language === "BM" ? "Menunggu" : "Pending", color: "#F59E0B" },
                          { id: "in-progress", label: language === "BM" ? "Tindakan" : "In Progress", color: "#3B82F6" },
                          { id: "resolved", label: language === "BM" ? "Selesai" : "Resolved", color: "#10B981" },
                        ].map((st) => {
                          const isActive = (item.status || "pending") === st.id;
                          return (
                            <TouchableOpacity
                              key={st.id}
                              activeOpacity={0.7}
                              disabled={isUpdatingFeedback === ticketId}
                              onPress={() =>
                                handleUpdateFeedback(
                                  ticketId,
                                  st.id as FeedbackStatus,
                                  draftReply
                                )
                              }
                              style={{
                                flex: 1,
                                paddingVertical: 8,
                                borderRadius: 10,
                                alignItems: "center",
                                justifyContent: "center",
                                backgroundColor: isActive ? st.color : themeColors.surfaceContainer,
                                borderWidth: 1,
                                borderColor: isActive ? st.color : themeColors.borderColor,
                              }}
                            >
                              <Text
                                style={{
                                  fontSize: 12,
                                  fontWeight: "700",
                                  color: isActive ? "#FFFFFF" : themeColors.textSecondary,
                                }}
                              >
                                {st.label}
                              </Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>

                    {/* Admin Response Box */}
                    <View style={{ gap: 6, paddingTop: 4 }}>
                      <Text style={{ fontSize: 11.5, fontWeight: "700", color: themeColors.textMuted }}>
                        {language === "BM" ? "Jawapan / Tindakan Admin (Dilihat oleh Ejen):" : "Admin Reply (Visible to Agent):"}
                      </Text>
                      <TextInput
                        value={draftReply}
                        onChangeText={(txt) =>
                          setAdminReplyDrafts((prev) => ({ ...prev, [ticketId]: txt }))
                        }
                        placeholder={
                          language === "BM"
                            ? "Tulis maklum balas atau status pembaikan untuk ejen..."
                            : "Write a reply or fix update for the agent..."
                        }
                        placeholderTextColor={themeColors.textMuted}
                        multiline
                        style={{
                          backgroundColor: themeColors.surfaceContainer,
                          borderRadius: 10,
                          padding: 10,
                          fontSize: 13,
                          color: themeColors.textPrimary,
                          minHeight: 56,
                          textAlignVertical: "top",
                          borderWidth: 1,
                          borderColor: themeColors.borderColor,
                        }}
                      />
                      <TouchableOpacity
                        activeOpacity={0.8}
                        disabled={isUpdatingFeedback === ticketId}
                        onPress={() =>
                          handleUpdateFeedback(
                            ticketId,
                            item.status || "pending",
                            draftReply
                          )
                        }
                        style={{
                          backgroundColor: isDark ? "#881337" : themeColors.maroonPrimary,
                          paddingVertical: 10,
                          borderRadius: 10,
                          alignItems: "center",
                          justifyContent: "center",
                          flexDirection: "row",
                          gap: 6,
                        }}
                      >
                        {isUpdatingFeedback === ticketId ? (
                          <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                          <>
                            <MaterialCommunityIcons name="send" size={14} color="#FFFFFF" />
                            <Text style={{ fontSize: 12.5, fontWeight: "700", color: "#FFFFFF" }}>
                              {language === "BM" ? "Simpan & Hantar Jawapan" : "Save & Send Reply"}
                            </Text>
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })
            )}
          </Animated.View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>

      {/* Listing Status Selection Bottom Modal */}
      <Modal
        visible={isStatusModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsStatusModalOpen(false)}
      >
        <TouchableOpacity
          style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.6)", justifyContent: "flex-end" }}
          activeOpacity={1}
          onPress={() => setIsStatusModalOpen(false)}
        >
          <View
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              padding: 24,
              gap: 12,
            }}
          >
            <Text style={{ fontSize: 17, fontWeight: "800", color: themeColors.textPrimary }}>
              {language === "BM" ? "Pilih Status Listing Baharu" : "Select New Status"}
            </Text>

            {["Aktif", "Booking", "Under Loan", "Under SPA", "Sold", "Draft"].map((statusOption) => (
              <TouchableOpacity
                key={statusOption}
                activeOpacity={0.7}
                onPress={() => handleSelectListingStatus(statusOption)}
                style={{
                  backgroundColor: themeColors.surfaceContainer,
                  paddingVertical: 14,
                  paddingHorizontal: 18,
                  borderRadius: 12,
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                  {statusOption}
                </Text>
                {selectedListing?.status === statusOption && (
                  <MaterialCommunityIcons name="check" size={20} color="#10B981" />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>

      {/* Fullscreen Screenshot Viewer Modal */}
      <Modal
        visible={!!selectedScreenshotModal}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedScreenshotModal(null)}
      >
        <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center" }}>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={() => setSelectedScreenshotModal(null)}
            style={{
              position: "absolute",
              top: insets.top + 16,
              right: 20,
              zIndex: 10,
              backgroundColor: "rgba(255,255,255,0.2)",
              borderRadius: 20,
              padding: 8,
            }}
          >
            <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
          </TouchableOpacity>
          {selectedScreenshotModal && (
            <Image
              source={{ uri: selectedScreenshotModal }}
              style={{
                width: Dimensions.get("window").width - 32,
                height: Dimensions.get("window").height * 0.75,
                borderRadius: 16,
              }}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </SafeAreaView>
  );
}
