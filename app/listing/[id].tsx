import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  FlatList,
  TouchableOpacity,
  Modal,
  Linking,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Share,
  Platform,
  StatusBar,
  AppState,
  AppStateStatus,
  useWindowDimensions,
  ToastAndroid,
  NativeModules,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import * as Haptics from "expo-haptics";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { firestore, auth } from "@/services/firebase";
import type { PropertyListing } from "@/types/listing";
import { useAppSettings } from "@/context/AppSettingsContext";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as Clipboard from "expo-clipboard";
import { addEventToNativeCalendar } from "@/services/calendar";

function getListingImagesList(listing: any): string[] {
  if (!listing) return [];
  const list: string[] = [];
  const pushUnique = (value?: any) => {
    if (!value || typeof value !== "string") return;
    const cleaned = value.trim();
    if (!cleaned) return;
    if (!list.includes(cleaned)) {
      list.push(cleaned);
    }
  };

  pushUnique(listing.imageUrl);
  if (listing.images && listing.images.length > 0) {
    listing.images.forEach((img: any) => {
      pushUnique(img);
    });
  }
  if (listing.gambar) {
    if (Array.isArray(listing.gambar)) {
      listing.gambar.forEach((img: any) => {
        pushUnique(img);
      });
    } else if (typeof listing.gambar === "string") {
      pushUnique(listing.gambar);
    }
  }
  return list;
}

function getListingImageUri(item: any): string | null {
  if (!item) return null;
  if (item.imageUrl && typeof item.imageUrl === "string" && item.imageUrl.trim()) return item.imageUrl.trim();
  if (item.images && Array.isArray(item.images) && item.images.length > 0 && item.images[0]) return item.images[0];
  if (item.gambar && Array.isArray(item.gambar) && item.gambar.length > 0 && item.gambar[0]) return item.gambar[0];
  if (typeof item.gambar === "string" && item.gambar.trim()) return item.gambar.trim();
  return null;
}

function extractCoordinatesFromUrl(url: string): { latitude: number; longitude: number } | null {
  if (!url) return null;
  try {
    // Try matching `@latitude,longitude` format (Google Maps mobile/web URL)
    const googleAtRegex = /@(-?\d+\.\d+),(-?\d+\.\d+)/;
    const matchAt = url.match(googleAtRegex);
    if (matchAt && matchAt[1] && matchAt[2]) {
      return { latitude: parseFloat(matchAt[1]), longitude: parseFloat(matchAt[2]) };
    }

    // Try matching `query=latitude,longitude` or `q=latitude,longitude` or `ll=latitude,longitude`
    const queryCoordsRegex = /[?&](query|q|ll)=(-?\d+\.\d+),(-?\d+\.\d+)/;
    const matchQuery = url.match(queryCoordsRegex);
    if (matchQuery && matchQuery[2] && matchQuery[3]) {
      return { latitude: parseFloat(matchQuery[2]), longitude: parseFloat(matchQuery[3]) };
    }
  } catch (err) {
    console.warn("Error parsing coordinates from URL:", err);
  }
  return null;
}

function extractSearchQueryFromUrl(url: string): string | null {
  if (!url) return null;
  try {
    // Try matching `/maps/place/Name+Here`
    const placeRegex = /\/maps\/place\/([^/]+)/;
    const matchPlace = url.match(placeRegex);
    if (matchPlace && matchPlace[1]) {
      return decodeURIComponent(matchPlace[1].replace(/\+/g, " "));
    }

    // Try matching `q=...` or `query=...` query parameters
    const queryParamRegex = /[?&](q|query)=([^&]+)/;
    const matchParam = url.match(queryParamRegex);
    if (matchParam && matchParam[2]) {
      return decodeURIComponent(matchParam[2].replace(/\+/g, " "));
    }
  } catch (err) {
    console.warn("Error parsing search query from URL:", err);
  }
  return null;
}

function formatFullListingDate(dateStr?: string, lang: string = "EN"): string {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return "";
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const formattedDate = d.toLocaleDateString("en-MY", { day: "numeric", month: "short", year: "numeric" });
    
    if (diffDays === 0) return `${formattedDate} (${lang === "BM" ? "Hari ini" : "Today"})`;
    if (diffDays === 1) return `${formattedDate} (${lang === "BM" ? "Semalam" : "Yesterday"})`;
    if (diffDays < 7) return `${formattedDate} (${diffDays} ${lang === "BM" ? "hari lalu" : "days ago"})`;
    return formattedDate;
  } catch {
    return "";
  }
}

function formatListingStatus(status?: string, lang?: string) {
  const norm = (status || "Aktif").toLowerCase();
  const isBM = lang === "BM";
  if (norm === "aktif" || norm === "active") {
    return { label: isBM ? "Aktif" : "Active", color: "#10B981", bg: "#10B98115", border: "#10B98135" };
  }
  if (norm === "booking") {
    return { label: "Booking", color: "#F59E0B", bg: "#F59E0B15", border: "#F59E0B35" };
  }
  if (norm === "sold" || norm === "terjual") {
    return { label: isBM ? "Terjual" : "Sold", color: "#3B82F6", bg: "#3B82F615", border: "#3B82F635" };
  }
  return { label: isBM ? "Draf" : "Draft", color: "#6B7280", bg: "#6B728015", border: "#6B728035" };
}

function formatPropertyType(jenis?: string, lang?: string) {
  if (!jenis) return "";
  if (lang === "BM") return jenis;
  
  return jenis
    .replace(/Teres/gi, "Terrace")
    .replace(/Kedai/gi, "Shop Lot")
    .replace(/Pertanian/gi, "Agricultural")
    .replace(/Banglo/gi, "Bungalow")
    .replace(/Komersial/gi, "Commercial")
    .replace(/Perumahan/gi, "Residential")
    .replace(/Tanah/gi, "Land")
    .replace(/Kilang/gi, "Factory")
    .replace(/Pangsapuri/gi, "Apartment");
}


function DocumentVaultItem({ hasDoc, onPress, title, iconHas, iconNone, themeColors, t }: any) {
  return (
    <TouchableOpacity
      activeOpacity={hasDoc ? 0.8 : 1}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        backgroundColor: themeColors.cardBackground,
        borderWidth: 1,
        borderColor: themeColors.borderColor,
        borderRadius: 12,
        padding: 14,
      }}
    >
      <MaterialCommunityIcons
        name={hasDoc ? iconHas : iconNone}
        size={24}
        color={hasDoc ? themeColors.maroonPrimary : '#A0A0A0'}
      />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: themeColors.textPrimary }}>
          {title}
        </Text>
        <Text style={{ fontSize: 13, color: hasDoc ? themeColors.textSecondary : '#A0A0A0', marginTop: 2 }}>
          {hasDoc ? t('docAvailable') : t('docNotUploaded')}
        </Text>
      </View>
      {hasDoc && (
        <MaterialCommunityIcons name='open-in-new' size={18} color={themeColors.maroonPrimary} />
      )}
    </TouchableOpacity>
  );
}

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { themeColors, t, language } = useAppSettings();
  const styles = useStyles(themeColors);

  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [isShareModalVisible, setIsShareModalVisible] = useState(false);
  const [isSharingImage, setIsSharingImage] = useState(false);
  const heroGalleryRef = useRef<FlatList<string>>(null);
  const fullScreenGalleryRef = useRef<FlatList<string>>(null);

  const handleBackToListings = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.navigate("/(tabs)/listings");
    }
  };

  const goToImage = (index: number, allImages: string[], animated: boolean = true) => {
    const safeIndex = Math.max(0, Math.min(index, allImages.length - 1));
    setActiveImageIndex(safeIndex);
    try {
      heroGalleryRef.current?.scrollToIndex({ index: safeIndex, animated });
    } catch (_) {}
    try {
      fullScreenGalleryRef.current?.scrollToIndex({ index: safeIndex, animated });
    } catch (_) {}
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    let unsubscribeSnapshot: (() => void) | null = null;

    const attachListener = () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }

      unsubscribeSnapshot = firestore()
        .collection("publicListings")
        .doc(id)
        .onSnapshot(
          (docSnapshot) => {
            if (docSnapshot && docSnapshot.exists) {
              const publicListing = {
                id: docSnapshot.id,
                ...docSnapshot.data(),
              } as PropertyListing;

              const currentUid = auth().currentUser?.uid;
              const isOwner =
                currentUid &&
                [publicListing.userId, publicListing.agentId, (publicListing as any).created_by, (publicListing as any).ownerId].includes(currentUid);

              // If listing is a draft and user is not owner, block access
              const rawStatus = (publicListing.status || "").toString().toLowerCase().trim();
              if (rawStatus === "draft" && !isOwner) {
                setListing(null);
                setIsLoading(false);
                return;
              }

              setListing(publicListing);

              if (isOwner) {
                void firestore()
                  .collection("listings")
                  .doc(id)
                  .get()
                  .then((privateSnapshot) => {
                    if (privateSnapshot.exists) {
                      setListing({
                        ...publicListing,
                        ...privateSnapshot.data(),
                        id: privateSnapshot.id,
                      } as PropertyListing);
                    }
                  })
                  .catch((error) => console.warn("Private listing details unavailable:", error));
              }
            } else {
              setListing(null);
            }
            setIsLoading(false);
          },
          (error) => {
            console.error("Error fetching listing details:", error);
            setIsLoading(false);
          }
        );
    };

    const detachListener = () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }
    };

    attachListener();

    const subscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        attachListener();
      } else {
        detachListener();
      }
    });

    return () => {
      detachListener();
      subscription.remove();
    };
  }, [id]);

  // Phone Call Handler
  const handleCallOwner = () => {
    if (!listing?.telOwner) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }
    const cleanPhone = listing.telOwner.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert(t("errorTitle"), t("callFailed"));
    });
  };

  // WhatsApp Handler
  const handleWhatsAppOwner = () => {
    if (!listing?.telOwner) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }
    let phone = listing.telOwner.replace(/[^0-9]/g, "");
    if (phone.startsWith("0")) {
      phone = "60" + phone.slice(1);
    }
    const message = encodeURIComponent(
      `Salam / Hai ${listing.namaOwner || "Owner"}, saya berkenaan listing hartanah: "${listing.tajuk}".`
    );
    const url = `https://wa.me/${phone}?text=${message}`;
    Linking.openURL(url).catch(() => {
      Alert.alert(t("waError"), t("waFailed"));
    });
  };

  // Document Vault Viewer Handler
  const handleOpenDocument = (url?: string, docName?: string) => {
    if (!url) {
      Alert.alert(t("docNone"), `"${docName}" ${t("docNotUploaded")}`);
      return;
    }
    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith("https://") && !cleanUrl.startsWith("http://")) {
      Alert.alert(t("docOpenError"), "Invalid document URL scheme.");
      return;
    }
    Linking.openURL(cleanUrl).catch(() => {
      Alert.alert(t("docOpenError"), t("docOpenFailed"));
    });
  };

  // Waze Navigation Intent Handler
  const handleOpenWaze = () => {
    let url = "";
    if (listing?.navLink) {
      const isWazeUrl = listing.navLink.toLowerCase().includes("waze.com") || listing.navLink.toLowerCase().includes("waze://");
      if (isWazeUrl) {
        url = listing.navLink;
      } else {
        // It's likely a Google Maps link or general link. Let's try to parse coordinates or query!
        const coords = extractCoordinatesFromUrl(listing.navLink);
        if (coords) {
          url = `https://waze.com/ul?ll=${coords.latitude},${coords.longitude}&navigate=yes`;
        } else {
          const query = extractSearchQueryFromUrl(listing.navLink);
          if (query) {
            url = `https://waze.com/ul?q=${encodeURIComponent(query)}`;
          } else {
            // Fallback: Open original link directly
            url = listing.navLink;
          }
        }
      }
    } else if (listing?.location?.latitude && listing?.location?.longitude) {
      url = `https://waze.com/ul?ll=${listing.location.latitude},${listing.location.longitude}&navigate=yes`;
    } else if (listing?.alamat) {
      url = `https://waze.com/ul?q=${encodeURIComponent(listing.alamat)}`;
    } else {
      Alert.alert(t("noLocation"), t("noLocationMsg"));
      return;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(t("wazeError"), t("wazeFailed"));
    });
  };

  // Google Maps Navigation Intent Handler
  const handleOpenGoogleMaps = () => {
    let url = "";
    if (listing?.navLink) {
      const isGoogleMapsUrl = listing.navLink.toLowerCase().includes("google.com/maps") || listing.navLink.toLowerCase().includes("maps.google") || listing.navLink.toLowerCase().includes("maps.app.goo.gl");
      if (isGoogleMapsUrl) {
        url = listing.navLink;
      } else {
        // It's likely a Waze link. Let's try to parse coordinates or query!
        const coords = extractCoordinatesFromUrl(listing.navLink);
        if (coords) {
          url = `https://www.google.com/maps/search/?api=1&query=${coords.latitude},${coords.longitude}`;
        } else {
          const query = extractSearchQueryFromUrl(listing.navLink);
          if (query) {
            url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
          } else {
            // Fallback: Open original link directly
            url = listing.navLink;
          }
        }
      }
    } else if (listing?.location?.latitude && listing?.location?.longitude) {
      url = `https://www.google.com/maps/search/?api=1&query=${listing.location.latitude},${listing.location.longitude}`;
    } else if (listing?.alamat) {
      url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(listing.alamat)}`;
    } else {
      Alert.alert(t("noLocation"), t("noLocationMsg"));
      return;
    }

    Linking.openURL(url).catch(() => {
      Alert.alert(t("mapsError"), t("mapsFailed"));
    });
  };

  // Native Calendar Integration Handler
  const handleAddToCalendar = async () => {
    if (!listing) return;
    await addEventToNativeCalendar({
      title: `Viewing: ${listing.tajuk}`,
      startDate: new Date(Date.now() + 3600 * 1000 * 2),
      endDate: new Date(Date.now() + 3600 * 1000 * 3),
      location: listing.alamat || listing.negeri || "Lokasi Hartanah",
      notes: `Temujanji Viewing Hartanah.\nRM ${typeof listing.harga === "number" ? listing.harga.toLocaleString() : listing.harga}\nOwner: ${listing.namaOwner || "N/A"} (${listing.telOwner || "N/A"})`,
    });
  };

  // Format share message
  const getFormattedShareMessage = () => {
    if (!listing) return "";
    const formattedPrice =
      typeof listing.harga === "number"
        ? listing.harga.toLocaleString()
        : listing.harga;

    const sizeStr = listing.keluasan
      ? (String(listing.keluasan).toLowerCase().includes("sq") ? listing.keluasan : `${listing.keluasan} sqft`)
      : "N/A";

    const isBM = language === "BM";

    if (isBM) {
      return (
        `WTS: ${listing.tajuk}\n` +
        `Harga: RM ${formattedPrice}\n` +
        `Lokasi: ${listing.alamat ? `${listing.alamat}, ` : ""}${listing.negeri || ""}\n` +
        `Spesifikasi: ${listing.bilikTidur || 0} Bilik, ${listing.bilikAir || 0} Bilik Air | ${sizeStr}\n` +
        `Status: ${listing.pegangan || "Freehold"} / ${listing.lot || "Bumi Lot"}\n\n` +
        `Berminat? Hubungi saya segera untuk maklumat lanjut dan viewing!`
      );
    }

    return (
      `FOR SALE: ${listing.tajuk}\n` +
      `Price: RM ${formattedPrice}\n` +
      `Location: ${listing.alamat ? `${listing.alamat}, ` : ""}${listing.negeri || ""}\n` +
      `Specs: ${listing.bilikTidur || 0} Beds, ${listing.bilikAir || 0} Baths | ${sizeStr}\n` +
      `Tenure: ${listing.pegangan || "Freehold"} / ${listing.lot || "Bumi Lot"}\n\n` +
      `Interested? Contact me now for more details and viewing appointment!`
    );
  };

  // Helper to safely and quickly prepare image for sharing with caching
  const prepareListingImageForSharing = async (imgUri: string, index: number = 0): Promise<string> => {
    const cacheDir = FileSystem.cacheDirectory || "";
    
    if (imgUri.startsWith("http://") || imgUri.startsWith("https://")) {
      // Create a deterministic hash/filename so we reuse already downloaded images instantly
      let hash = 0;
      for (let i = 0; i < imgUri.length; i++) {
        hash = ((hash << 5) - hash) + imgUri.charCodeAt(i);
        hash |= 0;
      }
      const filename = `cached_img_${Math.abs(hash)}_${index}.jpg`;
      const targetPath = `${cacheDir}${filename}`;

      try {
        const info = await FileSystem.getInfoAsync(targetPath);
        if (info.exists && info.size > 0) {
          return targetPath;
        }
        const res = await FileSystem.downloadAsync(imgUri, targetPath);
        return res.uri;
      } catch (err) {
        console.warn("Fast image download failed:", err);
        return imgUri;
      }
    }

    if (imgUri.startsWith("data:image")) {
      const targetPath = `${cacheDir}share_b64_${Date.now()}_${index}.jpg`;
      const base64Data = imgUri.split(",")[1];
      if (base64Data) {
        await FileSystem.writeAsStringAsync(targetPath, base64Data, {
          encoding: FileSystem.EncodingType.Base64,
        });
        return targetPath;
      }
    }

    if (imgUri.startsWith("file://")) {
      return imgUri;
    }

    return imgUri;
  };

  // 1-Click Promotional Share -> Opens Modal
  const handleShare = () => {
    setIsShareModalVisible(true);
  };

  const handleShareWhatsApp = async () => {
    setIsShareModalVisible(false);
    if (!listing) return;
    try {
      const message = getFormattedShareMessage();
      const url = `whatsapp://send?text=${encodeURIComponent(message)}`;
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
      } else {
        await Share.share({ message, title: listing.tajuk });
      }
    } catch (e) {
      console.error("WhatsApp share error:", e);
      const message = getFormattedShareMessage();
      await Share.share({ message, title: listing.tajuk });
    }
  };

  const handleSharePhoto = async () => {
    if (!listing) return;
    const allImages = getListingImagesList(listing);
    if (allImages.length === 0) {
      Alert.alert(
        language === "BM" ? "Tiada Gambar" : "No Photo Available",
        language === "BM" ? "Listing ini tidak mempunyai gambar untuk dikongsi." : "This listing does not have any photos attached."
      );
      return;
    }

    setIsShareModalVisible(false);
    setIsSharingImage(true);

    try {
      // 1. Auto-copy complete property details to clipboard and show toast
      const message = getFormattedShareMessage();
      try {
        await Clipboard.setStringAsync(message);
        if (Platform.OS === "android") {
          ToastAndroid.show(
            language === "BM"
              ? "📋 Maklumat listing telah disalin! Sila tampal dalam ruangan teks/kapsyen."
              : "📋 Listing details copied! Paste it in the caption/text field.",
            ToastAndroid.LONG
          );
        }
      } catch (clipErr) {
        console.warn("Clipboard copy failed:", clipErr);
      }

      // 2. Prepare all available listing photos (up to 12)
      const imagesToShare = allImages.slice(0, 12);
      const preparedUris = await Promise.all(
        imagesToShare.map((imgUri, idx) => prepareListingImageForSharing(imgUri, idx))
      );

      // 3. Multi-image Android sharing with native Parcelable Uri MultiShareModule
      if (Platform.OS === "android" && NativeModules.MultiShare) {
        try {
          await NativeModules.MultiShare.shareMultipleImages(
            preparedUris,
            listing.tajuk || "Property Listing",
            message
          );
          return;
        } catch (nativeShareErr) {
          console.warn("Native MultiShare fallback:", nativeShareErr);
        }
      }

      // 4. Single photo share fallback via Sharing API
      const primaryUri = preparedUris[0];
      const isAvailable = await Sharing.isAvailableAsync();
      
      if (isAvailable) {
        await Sharing.shareAsync(primaryUri, {
          dialogTitle: listing.tajuk || "Property Listing",
          mimeType: "image/jpeg",
          UTI: "public.jpeg",
        });
      } else {
        await Share.share({ message, title: listing.tajuk });
      }
    } catch (e) {
      console.error("Photo share error:", e);
      Alert.alert(
        language === "BM" ? "Ralat Perkongsian" : "Share Error",
        language === "BM" ? "Gagal memproses gambar untuk dikongsi." : "Failed to prepare images for sharing."
      );
    } finally {
      setIsSharingImage(false);
    }
  };

  const handleShareGeneric = async () => {
    setIsShareModalVisible(false);
    if (!listing) return;
    try {
      const message = getFormattedShareMessage();
      await Share.share({
        message,
        title: listing.tajuk,
      });
    } catch (e) {
      console.error("Generic share error:", e);
    }
  };

  const handleDeleteListing = () => {
    Alert.alert(
      t("confirmDeleteTitle"),
      t("confirmDeleteMsg"),
      [
        { text: t("cancelBtnText"), style: "cancel" },
        {
          text: t("deleteBtnText"),
          style: "destructive",
          onPress: async () => {
            try {
              setIsLoading(true);
              await firestore().collection("listings").doc(id).delete();
              await firestore().collection("publicListings").doc(id).delete();
              Alert.alert(t("successTitle"), t("listingDeleted"));
              handleBackToListings();
            } catch (err: any) {
              console.error("Failed to delete listing:", err);
              Alert.alert(t("errorTitle"), err?.message || "Failed to delete listing.");
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <ActivityIndicator size="large" color={themeColors.maroonPrimary} />
        <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("propertyDetails")}...</Text>
      </View>
    );
  }

  if (!listing) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: themeColors.canvasBackground }]}>
        <MaterialCommunityIcons name="home-remove-outline" size={60} color={themeColors.maroonPrimary} />
        <Text style={[styles.notFoundTitle, { color: themeColors.textPrimary }]}>{t("noListingsFound")}</Text>
        <Text style={[styles.notFoundSub, { color: themeColors.textMuted }]}>{t("recordDeleted")}</Text>
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: themeColors.maroonPrimary }]} onPress={handleBackToListings}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
          <Text style={styles.backBtnText}>{t("goBack")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allImages = getListingImagesList(listing);
  const hasImages = allImages.length > 0;
  const numericPrice = typeof listing.harga === "number" ? listing.harga : Number(String(listing.harga || "0").replace(/[^0-9.]/g, ""));
  const formattedPrice = !isNaN(numericPrice) && numericPrice > 0 ? numericPrice.toLocaleString("en-MY") : (listing.harga || "0");

  const currentUser = auth().currentUser;
  const isCreator = Boolean(
    currentUser &&
      (
        (listing.userId && listing.userId === currentUser.uid) ||
        (listing.agentId && listing.agentId === currentUser.uid)
      )
  );

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 28) + 60 }}
      >
        {/* HERO IMAGE CONTAINER */}
        <View style={[styles.heroContainer, { backgroundColor: themeColors.maroonLight }]}>
          {hasImages ? (
            <>
              <FlatList
                ref={heroGalleryRef}
                data={allImages}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                initialNumToRender={2}
                maxToRenderPerBatch={2}
                windowSize={3}
                removeClippedSubviews={Platform.OS === "android"}
                getItemLayout={(_, index) => ({
                  length: screenWidth,
                  offset: screenWidth * index,
                  index,
                })}
                keyExtractor={(_, idx) => `hero-img-${idx}`}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, screenWidth));
                  setActiveImageIndex(idx);
                }}
                renderItem={({ item: imgUri, index: idx }) => (
                  <TouchableOpacity
                    activeOpacity={0.95}
                    onPress={() => {
                      Haptics.selectionAsync().catch(() => {});
                      setActiveImageIndex(idx);
                      setIsGalleryOpen(true);
                    }}
                    style={{ width: screenWidth, height: 240 }}
                  >
                    <ExpoImage
                      source={{ uri: imgUri }}
                      style={styles.heroImage}
                      contentFit="cover"
                      transition={150}
                      cachePolicy="memory-disk"
                      recyclingKey={imgUri}
                    />
                  </TouchableOpacity>
                )}
              />

              {allImages.length > 1 && (
                <View style={styles.slideHintWrap}>
                  <MaterialCommunityIcons name="camera" size={13} color="#FFFFFF" />
                  <Text style={styles.slideHintText}>{activeImageIndex + 1} / {allImages.length}</Text>
                </View>
              )}
            </>
          ) : (
            <View style={[styles.heroPlaceholder, { borderBottomColor: themeColors.maroonBorder }]}>
              <MaterialCommunityIcons name="home-city-outline" size={64} color={themeColors.maroonPrimary} />
              <Text style={[styles.heroPlaceholderText, { color: themeColors.maroonPrimary }]}>{t("noImage")}</Text>
            </View>
          )}

          {/* Floating Back Button */}
          <TouchableOpacity
            style={[styles.floatingBackButton, { top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6 }]}
            onPress={handleBackToListings}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Floating Delete Button */}
          {isCreator && (
            <TouchableOpacity
              style={[
                styles.floatingShareButton,
                {
                  right: 112,
                  top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6,
                },
              ]}
              onPress={handleDeleteListing}
            >
              <MaterialCommunityIcons name="delete-outline" size={20} color="#FF6B6B" />
            </TouchableOpacity>
          )}

          {/* Floating Edit Button */}
          {isCreator && (
            <TouchableOpacity
              style={[
                styles.floatingShareButton,
                {
                  right: 64,
                  top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6,
                },
              ]}
              onPress={() => router.push(`/listing/edit/${listing.id}` as any)}
            >
              <MaterialCommunityIcons name="pencil-outline" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          )}

          {/* Floating Share Button */}
          <TouchableOpacity
            style={[styles.floatingShareButton, { top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6 }]}
            onPress={handleShare}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Image Gallery Strip Indicators */}
          {hasImages && allImages.length > 1 && (
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.galleryStrip}
              data={allImages}
              keyExtractor={(_, idx) => `thumb-${idx}`}
              initialNumToRender={6}
              maxToRenderPerBatch={4}
              windowSize={3}
              removeClippedSubviews={Platform.OS === "android"}
              renderItem={({ item: imgUri, index: idx }) => (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={() => goToImage(idx, allImages)}
                  style={[
                    styles.galleryThumbContainer,
                    activeImageIndex === idx && { borderColor: themeColors.maroonPrimary },
                  ]}
                >
                  <ExpoImage
                    source={{ uri: imgUri }}
                    style={styles.galleryThumb}
                    contentFit="cover"
                    transition={100}
                    cachePolicy="memory-disk"
                    recyclingKey={imgUri}
                  />
                </TouchableOpacity>
              )}
            />
          )}
        </View>

        <View style={styles.contentContainer}>
          {/* HEADER SECTION */}
          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <View style={styles.statusRow}>
              {(() => {
                const s = formatListingStatus(listing.status, language);
                return (
                  <View style={[styles.statusBadge, { backgroundColor: s.bg, borderColor: s.border, borderWidth: 1 }]}>
                    <Text style={[styles.statusText, { color: s.color, fontWeight: "700" }]}>{s.label}</Text>
                  </View>
                );
              })()}
              {listing.jenis ? (
                <View style={[styles.jenisBadge, { backgroundColor: themeColors.surfaceContainer }]}>
                  <Text style={[styles.jenisText, { color: themeColors.textSecondary }]}>
                    {formatPropertyType(listing.jenis, language)}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text style={[styles.title, { color: themeColors.textPrimary }]}>{listing.tajuk}</Text>
            <Text style={[styles.price, { color: themeColors.maroonPrimary }]}>RM {formattedPrice}</Text>

            {listing.alamat || listing.negeri ? (
              <View style={styles.locationRow}>
                <MaterialCommunityIcons name="map-marker-outline" size={16} color={themeColors.textMuted} />
                <Text style={[styles.locationText, { color: themeColors.textMuted }]}>
                  {listing.alamat ? `${listing.alamat}, ` : ""}
                  {listing.negeri}
                </Text>
              </View>
            ) : null}

            {listing.authorName ? (
              <View style={[styles.locationRow, { marginTop: 8, borderTopWidth: 1, borderTopColor: themeColors.borderColor, paddingTop: 8 }]}>
                <MaterialCommunityIcons name="account-outline" size={16} color={themeColors.maroonPrimary} />
                <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginLeft: 4 }}>
                  {t("uploadedBy")}: <Text style={{ fontWeight: "700", color: themeColors.textPrimary }}>{listing.authorName}</Text>
                </Text>
              </View>
            ) : null}

            {(listing.createdAt || listing.updatedAt) && formatFullListingDate(listing.createdAt || listing.updatedAt, language) ? (
              <View style={[styles.locationRow, { marginTop: listing.authorName ? 6 : 8, borderTopWidth: listing.authorName ? 0 : 1, borderTopColor: themeColors.borderColor, paddingTop: listing.authorName ? 0 : 8 }]}>
                <MaterialCommunityIcons name="calendar-clock" size={16} color={themeColors.maroonPrimary} />
                <Text style={{ fontSize: 13, color: themeColors.textSecondary, marginLeft: 4 }}>
                  {language === "BM" ? "Tarikh Disiarkan" : "Posted on"}: <Text style={{ fontWeight: "700", color: themeColors.textPrimary }}>{formatFullListingDate(listing.createdAt || listing.updatedAt, language)}</Text>
                </Text>
              </View>
            ) : null}
          </View>

          {/* PROPERTY SPECS CARD */}
          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <Text style={[styles.cardSectionTitle, { color: themeColors.maroonPrimary }]}>{t("specsTitle")}</Text>

            <View style={styles.specsGrid}>
              <View style={[styles.specBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
                <MaterialCommunityIcons name="certificate-outline" size={22} color={themeColors.maroonPrimary} />
                <Text style={[styles.specBoxLabel, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("tenure")}</Text>
                <Text style={[styles.specBoxValue, { color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }]}>{listing.pegangan || "Freehold"}</Text>
              </View>

              <View style={[styles.specBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
                <MaterialCommunityIcons name="shield-home-outline" size={22} color={themeColors.maroonPrimary} />
                <Text style={[styles.specBoxLabel, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("lotStatus")}</Text>
                <Text style={[styles.specBoxValue, { color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }]}>{listing.lot || "Bumi Lot"}</Text>
              </View>

              <View style={[styles.specBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
                <MaterialCommunityIcons name="bed-king-outline" size={22} color={themeColors.maroonPrimary} />
                <Text style={[styles.specBoxLabel, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("bedrooms")}</Text>
                <Text style={[styles.specBoxValue, { color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }]}>{listing.bilikTidur || 0}</Text>
              </View>

              <View style={[styles.specBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
                <MaterialCommunityIcons name="shower-head" size={22} color={themeColors.maroonPrimary} />
                <Text style={[styles.specBoxLabel, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("bathrooms")}</Text>
                <Text style={[styles.specBoxValue, { color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }]}>{listing.bilikAir || 0}</Text>
              </View>

              {listing.keluasan ? (
                <View style={[styles.specBox, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
                  <MaterialCommunityIcons name="ruler-square" size={22} color={themeColors.maroonPrimary} />
                  <Text style={[styles.specBoxLabel, { color: themeColors.textSecondary, fontSize: 15 }]}>{t("areaLabel")}</Text>
                  <Text style={[styles.specBoxValue, { color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }]}>
                    {String(listing.keluasan).toLowerCase().includes("sq") || String(listing.keluasan).toLowerCase().includes("kaki")
                      ? listing.keluasan
                      : `${listing.keluasan} sqft`}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

          {/* LOCATION & NAVIGATION CARD — private to the listing creator */}
          {isCreator && (
            <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
              <View style={styles.vaultTitleRow}>
                <MaterialCommunityIcons name="navigation-variant-outline" size={22} color={themeColors.maroonPrimary} />
                <Text style={[styles.cardSectionTitle, { color: themeColors.maroonPrimary, marginBottom: 0 }]}>
                  {t("navigationTitle")}
                </Text>
              </View>

              <Text style={{ fontSize: 15, color: themeColors.textSecondary, marginTop: 6, marginBottom: 12 }}>
                {listing.location
                  ? `GPS: ${listing.location.latitude.toFixed(5)}, ${listing.location.longitude.toFixed(5)}`
                  : listing.alamat || t("navigationSub")}
              </Text>

              <View style={{ flexDirection: "row", gap: 10 }}>
                {/* Waze Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleOpenWaze}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: "#33CCFF",
                    borderRadius: 10,
                    height: 52,
                  }}
                >
                  <MaterialCommunityIcons name="waze" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Waze</Text>
                </TouchableOpacity>

                {/* Google Maps Button */}
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={handleOpenGoogleMaps}
                  style={{
                    flex: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 8,
                    backgroundColor: "#EA4335",
                    borderRadius: 10,
                    height: 52,
                  }}
                >
                  <MaterialCommunityIcons name="google-maps" size={22} color="#FFFFFF" />
                  <Text style={{ color: "#FFFFFF", fontSize: 16, fontWeight: "700" }}>Google Maps</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* OWNER DETAILS CARD */}
          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <Text style={[styles.cardSectionTitle, { color: themeColors.maroonPrimary }]}>{t("ownerDetails")}</Text>

            <View style={styles.ownerInfoRow}>
              <View style={[styles.ownerAvatar, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
                <MaterialCommunityIcons name="account" size={26} color={themeColors.maroonPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ownerName, { color: themeColors.textPrimary, fontSize: 16 }]}>{listing.namaOwner || t("ownerNoName")}</Text>
                <Text style={[styles.ownerPhone, { color: themeColors.textSecondary, fontSize: 15 }]}>{listing.telOwner || t("ownerNoPhone")}</Text>
              </View>
            </View>

            <View style={styles.contactActionRow}>
              {/* Phone Call */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCallOwner}
                style={[styles.callButton, { backgroundColor: themeColors.maroonPrimary, height: 52, justifyContent: "center", alignItems: "center" }]}
              >
                <MaterialCommunityIcons name="phone" size={20} color={themeColors.canvasBackground} />
                <Text style={[styles.callButtonText, { color: themeColors.canvasBackground, fontSize: 16 }]}>{t("callOwner")}</Text>
              </TouchableOpacity>

              {/* WhatsApp */}
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleWhatsAppOwner}
                style={[styles.whatsappButton, { height: 52, justifyContent: "center", alignItems: "center" }]}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" />
                <Text style={[styles.whatsappButtonText, { color: "#FFF", fontSize: 16 }]}>{t("whatsappOwner")}</Text>
              </TouchableOpacity>
            </View>

            {/* Native Calendar Event Action */}
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={handleAddToCalendar}
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
                gap: 8,
                backgroundColor: themeColors.cardBackground,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                borderRadius: 10,
                height: 52,
                marginTop: 12,
              }}
            >
              <MaterialCommunityIcons name="calendar-plus" size={22} color={themeColors.maroonPrimary} />
              <Text style={{ color: themeColors.textPrimary, fontSize: 16, fontWeight: "700" }}>
                {t("addToCalendar")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* DOCUMENT VAULT VIEWER CARD */}
          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <View style={styles.vaultTitleRow}>
              <MaterialCommunityIcons name="folder-lock-outline" size={22} color={themeColors.maroonPrimary} />
              <Text style={[styles.cardSectionTitle, { color: themeColors.maroonPrimary, marginBottom: 0 }]}>{t("documentVaultViewer")}</Text>
            </View>

            {!isCreator ? (
              <View style={{ alignItems: "center", justifyContent: "center", paddingVertical: 24, gap: 8, paddingHorizontal: 12 }}>
                <MaterialCommunityIcons name="lock-outline" size={32} color={themeColors.textMuted} />
                <Text style={{ fontSize: 14, color: themeColors.textMuted, textAlign: "center", fontWeight: "600", lineHeight: 20 }}>
                  {language === "BM"
                    ? "Kandungan dikunci. Hanya pemilik listing boleh mengakses dokumen sulit."
                    : "Content locked. Only the listing owner can access private documents."}
                </Text>
              </View>
            ) : (
              
              <View style={[styles.vaultGrid, { marginTop: 12 }]}>
                <DocumentVaultItem
                  hasDoc={Boolean(listing.geran)}
                  onPress={() => handleOpenDocument(listing.geran, t("geranCopy"))}
                  title={t("geranCopy")}
                  iconHas="file-document-outline"
                  iconNone="file-outline"
                  themeColors={themeColors}
                  t={t}
                />
                
                <DocumentVaultItem
                  hasDoc={Boolean(listing.spa)}
                  onPress={() => handleOpenDocument(listing.spa, t("spaCopy"))}
                  title={t("spaCopy")}
                  iconHas="file-sign"
                  iconNone="file-outline"
                  themeColors={themeColors}
                  t={t}
                />

                <DocumentVaultItem
                  hasDoc={Boolean(listing.icOwner)}
                  onPress={() => handleOpenDocument(listing.icOwner, t("ownerIcCopyFull"))}
                  title={t("ownerIcCopyFull")}
                  iconHas="card-account-details-outline"
                  iconNone="card-outline"
                  themeColors={themeColors}
                  t={t}
                />

                <DocumentVaultItem
                  hasDoc={Boolean(listing.bilUtility)}
                  onPress={() => handleOpenDocument(listing.bilUtility, t("utilityBill"))}
                  title={t("utilityBill")}
                  iconHas="receipt"
                  iconNone="receipt-outline"
                  themeColors={themeColors}
                  t={t}
                />
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      {/* Native 100% Opaque Fullscreen Photo Gallery */}
      <Modal
        visible={isGalleryOpen}
        transparent={false}
        animationType="fade"
        statusBarTranslucent={true}
        onRequestClose={() => setIsGalleryOpen(false)}
      >
        <View style={{ flex: 1, backgroundColor: "#000000" }}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          
          {/* Top Bar Header */}
          <View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              zIndex: 10,
              paddingTop: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 28) : 20) + 12,
              paddingHorizontal: 20,
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <View
              style={{
                backgroundColor: "rgba(30,30,30,0.85)",
                paddingHorizontal: 14,
                paddingVertical: 6,
                borderRadius: 20,
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontSize: 14, fontWeight: "700" }}>
                {activeImageIndex + 1} / {allImages.length}
              </Text>
            </View>

            <TouchableOpacity
              onPress={() => setIsGalleryOpen(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              style={{
                width: 42,
                height: 42,
                borderRadius: 21,
                backgroundColor: "rgba(30,30,30,0.85)",
                justifyContent: "center",
                alignItems: "center",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.2)",
              }}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          {/* High Performance 60FPS Virtualized Fullscreen Swiper */}
          <FlatList
            ref={fullScreenGalleryRef}
            data={allImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            initialScrollIndex={activeImageIndex}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            keyExtractor={(_, index) => `fs-img-${index}`}
            windowSize={3}
            maxToRenderPerBatch={2}
            initialNumToRender={2}
            removeClippedSubviews={Platform.OS === "android"}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, screenWidth));
              setActiveImageIndex(idx);
              try {
                heroGalleryRef.current?.scrollToIndex({ index: idx, animated: false });
              } catch (_) {}
            }}
            renderItem={({ item: imgUri }) => (
              <View
                style={{
                  width: screenWidth,
                  height: screenHeight,
                  justifyContent: "center",
                  alignItems: "center",
                  backgroundColor: "#000000",
                }}
              >
                <ExpoImage
                  source={{ uri: imgUri }}
                  style={{ width: screenWidth, height: "100%" }}
                  contentFit="contain"
                  cachePolicy="memory-disk"
                  transition={100}
                  recyclingKey={imgUri}
                />
              </View>
            )}
            style={{ flex: 1, backgroundColor: "#000000" }}
          />
        </View>
      </Modal>

      {/* Share Options Bottom Sheet Modal */}
      <Modal
        visible={isShareModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setIsShareModalVisible(false)}
      >
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: "rgba(0,0,0,0.65)",
            justifyContent: "flex-end",
          }}
          activeOpacity={1}
          onPress={() => setIsShareModalVisible(false)}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={{
              backgroundColor: themeColors.cardBackground,
              borderTopLeftRadius: 24,
              borderTopRightRadius: 24,
              borderTopWidth: 1,
              borderColor: themeColors.borderColor,
              paddingHorizontal: 20,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 28) + 20,
            }}
          >
            {/* Drag handle */}
            <View
              style={{
                width: 40,
                height: 4,
                borderRadius: 2,
                backgroundColor: themeColors.borderColor,
                alignSelf: "center",
                marginBottom: 16,
              }}
            />

            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "space-between",
                marginBottom: 4,
              }}
            >
              <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary }}>
                {language === "BM" ? "Kongsi Listing" : "Share Listing"}
              </Text>
              <TouchableOpacity
                onPress={() => setIsShareModalVisible(false)}
                style={{
                  padding: 6,
                  borderRadius: 16,
                  backgroundColor: themeColors.surfaceContainer,
                }}
              >
                <MaterialCommunityIcons name="close" size={18} color={themeColors.textSecondary} />
              </TouchableOpacity>
            </View>

            {listing?.tajuk ? (
              <Text
                numberOfLines={1}
                style={{
                  fontSize: 13,
                  color: themeColors.textMuted,
                  marginBottom: 16,
                }}
              >
                {listing.tajuk}
              </Text>
            ) : (
              <View style={{ marginBottom: 12 }} />
            )}

            {/* Share Options */}
            <View style={{ gap: 10 }}>
              {/* WhatsApp Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleShareWhatsApp}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#25D36622",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="whatsapp" size={22} color="#25D366" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "WhatsApp (Teks)" : "WhatsApp (Text)"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka WhatsApp terus dengan maklumat listing"
                      : "Open WhatsApp directly with formatted property details"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>

              {/* Photo & Caption Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleSharePhoto}
                disabled={isSharingImage}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: `${themeColors.maroonPrimary}22`,
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {isSharingImage ? (
                    <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
                  ) : (
                    <MaterialCommunityIcons name="image-outline" size={22} color={themeColors.maroonPrimary} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Kongsi Gambar (Brochure)" : "Share Photo & Details"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka gambar dalam menu perkongsian (teks disalin ke papan keratan)"
                      : "Open photo in share menu (caption copied to clipboard)"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>

              {/* More Apps Option */}
              <TouchableOpacity
                activeOpacity={0.75}
                onPress={handleShareGeneric}
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  padding: 14,
                  borderRadius: 14,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.surfaceContainer,
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 20,
                    backgroundColor: "#6366F122",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <MaterialCommunityIcons name="share-variant-outline" size={22} color="#6366F1" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
                    {language === "BM" ? "Pilihan Lain" : "More Sharing Options"}
                  </Text>
                  <Text style={{ fontSize: 12, color: themeColors.textSecondary, marginTop: 2 }}>
                    {language === "BM"
                      ? "Buka menu perkongsian sistem untuk aplikasi lain"
                      : "Open system share sheet for Telegram, Copy, and other apps"}
                  </Text>
                </View>
                <MaterialCommunityIcons name="chevron-right" size={20} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

const useStyles = (themeColors: any) => StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: themeColors.canvasBackground,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: themeColors.textMuted,
    fontWeight: "500",
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: themeColors.textPrimary,
    marginTop: 12,
  },
  notFoundSub: {
    fontSize: 13,
    color: themeColors.textMuted,
    marginTop: 4,
  },
  backBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: themeColors.maroonPrimary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  backBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 14,
  },
  heroContainer: {
    position: "relative",
    width: "100%",
    height: 240,
    backgroundColor: themeColors.maroonLight,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  slideHintWrap: {
    position: "absolute",
    bottom: 66,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.42)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  slideHintText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
  },
  heroPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: themeColors.maroonBorder,
  },
  heroPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    color: themeColors.maroonPrimary,
    fontWeight: "600",
  },
  floatingBackButton: {
    position: "absolute",
    left: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  floatingShareButton: {
    position: "absolute",
    right: 16,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  galleryStrip: {
    position: "absolute",
    bottom: 12,
    left: 16,
    right: 16,
    flexDirection: "row",
  },
  galleryThumbContainer: {
    width: 44,
    height: 44,
    borderRadius: 8,
    marginRight: 8,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
  },
  galleryThumbActive: {
    borderColor: themeColors.maroonPrimary,
  },
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
  contentContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },
  card: {
    backgroundColor: themeColors.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: themeColors.borderColor,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  statusBadge: {
    backgroundColor: themeColors.maroonPrimary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  jenisBadge: {
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  jenisText: {
    fontSize: 11,
    fontWeight: "600",
    color: themeColors.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: themeColors.textPrimary,
    lineHeight: 26,
    marginBottom: 6,
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: themeColors.maroonPrimary,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: themeColors.textMuted,
    flex: 1,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: themeColors.maroonPrimary,
    marginBottom: 12,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specBox: {
    width: "48%",
    backgroundColor: themeColors.maroonLight,
    borderWidth: 1,
    borderColor: themeColors.maroonBorder,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  specBoxLabel: {
    fontSize: 11,
    color: themeColors.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  specBoxValue: {
    fontSize: 14,
    fontWeight: "700",
    color: themeColors.maroonDark,
    marginTop: 2,
  },
  ownerInfoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 14,
  },
  ownerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: themeColors.maroonLight,
    borderWidth: 1,
    borderColor: themeColors.maroonBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: themeColors.textPrimary,
  },
  ownerPhone: {
    fontSize: 13,
    color: themeColors.textMuted,
    marginTop: 2,
  },
  contactActionRow: {
    flexDirection: "row",
    gap: 10,
  },
  callButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: themeColors.maroonPrimary,
    borderRadius: 10,
    paddingVertical: 12,
  },
  callButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  whatsappButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: themeColors.accentWhatsApp,
    borderRadius: 10,
    paddingVertical: 12,
  },
  whatsappButtonText: {
    color: "#FFF",
    fontSize: 14,
    fontWeight: "700",
  },
  vaultTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  vaultGrid: {
    gap: 10,
    marginTop: 4,
  },
  vaultItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: themeColors.maroonLight,
    borderWidth: 1,
    borderColor: themeColors.maroonBorder,
    borderRadius: 12,
    padding: 12,
  },
  vaultItemDisabled: {
    backgroundColor: themeColors.disabledBg,
    borderColor: themeColors.borderColor,
  },
  vaultItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: themeColors.maroonDark,
  },
  vaultItemTextDisabled: {
    color: themeColors.disabledText,
  },
  vaultItemStatus: {
    fontSize: 11,
    color: themeColors.textMuted,
    marginTop: 2,
  },
  fullScreenModal: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
  },
  fullScreenTopBar: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  fullScreenCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  fullScreenCounter: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
  fullScreenImage: {
    width: "100%",
    height: "100%",
  },
});
