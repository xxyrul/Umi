import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Linking,
  ActivityIndicator,
  Alert,
  StyleSheet,
  Share,
  Platform,
  StatusBar,
  useWindowDimensions,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import type { PropertyListing } from "@/types/listing";
import { THEME } from "@/constants/theme";
import { useAppSettings } from "@/context/AppSettingsContext";
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

export default function PropertyDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { themeColors, t, language } = useAppSettings();

  const [listing, setListing] = useState<PropertyListing | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [imageLoading, setImageLoading] = useState(false);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [contactProfile, setContactProfile] = useState<{ name: string; phone: string }>({
    name: "",
    phone: "",
  });

  const heroGalleryRef = useRef<ScrollView>(null);
  const fullScreenGalleryRef = useRef<ScrollView>(null);

  const goToImage = (index: number, allImages: string[], animated: boolean = true) => {
    const safeIndex = Math.max(0, Math.min(index, allImages.length - 1));
    setActiveImageIndex(safeIndex);
    heroGalleryRef.current?.scrollTo({ x: safeIndex * screenWidth, y: 0, animated });
    fullScreenGalleryRef.current?.scrollTo({ x: safeIndex * screenWidth, y: 0, animated });
  };

  useEffect(() => {
    if (!id) {
      setIsLoading(false);
      return;
    }

    const unsubscribe = firestore()
      .collection("listings")
      .doc(id)
      .onSnapshot(
        (docSnapshot) => {
          if (docSnapshot && docSnapshot.exists) {
            setListing({
              id: docSnapshot.id,
              ...docSnapshot.data(),
            } as PropertyListing);
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

    return () => unsubscribe();
  }, [id]);

  useEffect(() => {
    if (!listing) {
      setContactProfile({ name: "", phone: "" });
      return;
    }

    const fallbackName = listing.namaOwner || listing.authorName || "Owner";
    const fallbackPhone = listing.telOwner || "";

    const loadContactProfile = async () => {
      try {
        if (!listing.userId) {
          setContactProfile({ name: fallbackName, phone: fallbackPhone });
          return;
        }

        const userDoc = await firestore().collection("users").doc(listing.userId).get();
        const userData = userDoc.exists ? (userDoc.data() as Record<string, any> | undefined) : undefined;

        const nextName =
          userData?.displayName ||
          userData?.fullName ||
          userData?.name ||
          userData?.agentName ||
          fallbackName;

        const nextPhone =
          userData?.phoneNumber ||
          userData?.phone ||
          userData?.mobile ||
          userData?.agentPhone ||
          fallbackPhone;

        setContactProfile({
          name: nextName || fallbackName,
          phone: nextPhone || fallbackPhone,
        });
      } catch (error) {
        console.warn("Failed to fetch listing contact profile:", error);
        setContactProfile({ name: fallbackName, phone: fallbackPhone });
      }
    };

    loadContactProfile();
  }, [listing?.userId, listing?.namaOwner, listing?.authorName, listing?.telOwner]);

  const normalizePhoneForWhatsApp = (rawPhone?: string) => {
    if (!rawPhone) return "";
    let phone = rawPhone.replace(/[^0-9]/g, "");
    if (!phone) return "";
    if (phone.startsWith("0")) {
      phone = "60" + phone.slice(1);
    }
    return phone;
  };

  const currentUser = auth().currentUser;
  const isOwner = Boolean(currentUser && listing?.userId && listing.userId === currentUser.uid);
  const isCreator = Boolean(
    currentUser &&
      (
        (listing?.userId && listing.userId === currentUser.uid) ||
        (listing?.agentId && listing.agentId === currentUser.uid)
      )
  );
  const contactLabel = isOwner ? t("ownerDetails") : "Listing Agent / REN Information";
  const contactName = isOwner ? listing?.namaOwner || t("ownerNoName") : contactProfile.name || listing?.authorName || listing?.namaOwner || "Listing Agent";
  const contactPhone = isOwner ? listing?.telOwner || t("ownerNoPhone") : contactProfile.phone || listing?.telOwner || "No phone available";
  const callLabel = isOwner ? t("callOwner") : "Call Agent";
  const whatsappLabel = isOwner ? t("whatsappOwner") : "WhatsApp Agent";

  const handleCallContact = () => {
    const phone = (isOwner ? listing?.telOwner : contactProfile.phone || listing?.telOwner) || "";
    if (!phone) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }

    const cleanPhone = phone.replace(/[^0-9+]/g, "");
    Linking.openURL(`tel:${cleanPhone}`).catch(() => {
      Alert.alert(t("errorTitle"), t("callFailed"));
    });
  };

  // WhatsApp Handler
  const handleWhatsAppContact = () => {
    const phone = (isOwner ? listing?.telOwner : contactProfile.phone || listing?.telOwner) || "";
    if (!phone) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }

    const waPhone = normalizePhoneForWhatsApp(phone);
    if (!waPhone) {
      Alert.alert(t("noInfoTitle"), t("noPhoneMsg"));
      return;
    }

    const WhatsAppContactName = isOwner ? listing?.namaOwner || "Owner" : contactProfile.name || listing?.authorName || "Listing Agent";
    const message = encodeURIComponent(
      `Salam / Hai ${WhatsAppContactName}, saya berkenaan listing hartanah: "${listing?.tajuk || "property"}".`
    );
    const url = `https://wa.me/${waPhone}?text=${message}`;
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
    Linking.openURL(url).catch(() => {
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

  // 1-Click Promotional Share
  const handleShare = async () => {
    if (!listing) return;
    try {
      const formattedPrice =
        typeof listing.harga === "number"
          ? listing.harga.toLocaleString()
          : listing.harga;

      const sizeStr = listing.keluasan
        ? (String(listing.keluasan).toLowerCase().includes("sq") ? listing.keluasan : `${listing.keluasan} sqft`)
        : "N/A";

      const message =
        `WTS: ${listing.tajuk}\n` +
        `Harga: RM ${formattedPrice}\n` +
        `Lokasi: ${listing.alamat ? `${listing.alamat}, ` : ""}${listing.negeri}\n` +
        `Spesifikasi: ${listing.bilikTidur} Bilik, ${listing.bilikAir} Bilik Air | ${sizeStr}\n` +
        `Status: ${listing.pegangan || "Freehold"} / ${listing.lot || "Bumi Lot"}\n\n` +
        `Berminat? Hubungi saya segera untuk viewing!`;

      await Share.share({
        message,
        title: `Listing: ${listing.tajuk}`,
      });
    } catch (error) {
      console.error("Error sharing listing:", error);
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
              Alert.alert(t("successTitle"), t("listingDeleted"));
              router.back();
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
        <TouchableOpacity style={[styles.backBtn, { backgroundColor: themeColors.maroonPrimary }]} onPress={() => router.back()}>
          <MaterialCommunityIcons name="arrow-left" size={18} color="#FFF" />
          <Text style={styles.backBtnText}>{t("goBack")}</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const allImages = getListingImagesList(listing);
  const hasImages = allImages.length > 0;
  const formattedPrice =
    typeof listing.harga === "number" ? listing.harga.toLocaleString() : listing.harga;

  return (
    <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 24) + 40 }}
      >
        {/* HERO IMAGE CONTAINER */}
        <View style={[styles.heroContainer, { backgroundColor: themeColors.maroonLight }]}>
          {hasImages ? (
            <>
              <ScrollView
                ref={heroGalleryRef}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onMomentumScrollEnd={(e) => {
                  const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, screenWidth));
                  setActiveImageIndex(idx);
                }}
              >
                {allImages.map((imgUri, idx) => (
                  <TouchableOpacity
                    key={`hero-${idx}`}
                    activeOpacity={0.95}
                    onPress={() => {
                      setIsGalleryOpen(true);
                      setTimeout(() => goToImage(idx, allImages, false), 0);
                    }}
                    style={{ width: screenWidth, height: 240 }}
                  >
                    <Image
                      source={{ uri: imgUri }}
                      style={styles.heroImage}
                      resizeMode="cover"
                      onLoadStart={() => setImageLoading(true)}
                      onLoadEnd={() => setImageLoading(false)}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {imageLoading && (
                <View style={[StyleSheet.absoluteFill, { justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.1)" }]}>
                  <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
                </View>
              )}

              {allImages.length > 1 && (
                <View style={styles.slideHintWrap}>
                  <MaterialCommunityIcons name="gesture-swipe-horizontal" size={15} color="#FFFFFF" />
                  <Text style={styles.slideHintText}>Swipe photos</Text>
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
            onPress={() => router.back()}
          >
            <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.maroonPrimary} />
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
              <MaterialCommunityIcons name="delete-outline" size={20} color="#EA4335" />
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
              <MaterialCommunityIcons name="pencil-outline" size={20} color={themeColors.maroonPrimary} />
            </TouchableOpacity>
          )}

          {/* Floating Share Button */}
          <TouchableOpacity
            style={[styles.floatingShareButton, { top: Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6 }]}
            onPress={handleShare}
          >
            <MaterialCommunityIcons name="share-variant" size={20} color={themeColors.maroonPrimary} />
          </TouchableOpacity>

          {/* Image Gallery Strip Indicators */}
          {hasImages && allImages.length > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.galleryStrip}>
              {allImages.map((imgUri, idx) => (
                <TouchableOpacity
                  key={idx}
                  activeOpacity={0.8}
                  onPress={() => goToImage(idx, allImages)}
                  style={[
                    styles.galleryThumbContainer,
                    activeImageIndex === idx && { borderColor: themeColors.maroonPrimary },
                  ]}
                >
                  <Image source={{ uri: imgUri }} style={styles.galleryThumb} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        <View style={styles.contentContainer}>
          {/* HEADER SECTION */}
          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <View style={styles.statusRow}>
              <View style={[styles.statusBadge, { backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={styles.statusText}>{listing.status || "Aktif"}</Text>
              </View>
              {listing.jenis ? (
                <View style={[styles.jenisBadge, { backgroundColor: themeColors.surfaceContainer }]}>
                  <Text style={[styles.jenisText, { color: themeColors.textSecondary }]}>{listing.jenis}</Text>
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

          {isOwner && (
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

          <View style={[styles.card, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, borderWidth: 1 }]}>
            <Text style={[styles.cardSectionTitle, { color: themeColors.maroonPrimary }]}>{contactLabel}</Text>

            <View style={styles.ownerInfoRow}>
              <View style={[styles.ownerAvatar, { backgroundColor: themeColors.maroonLight, borderColor: themeColors.maroonBorder }]}>
                <MaterialCommunityIcons name="account" size={26} color={themeColors.maroonPrimary} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.ownerName, { color: themeColors.textPrimary, fontSize: 16 }]}>{contactName}</Text>
                <Text style={[styles.ownerPhone, { color: themeColors.textSecondary, fontSize: 15 }]}>{contactPhone}</Text>
              </View>
            </View>

            <View style={styles.contactActionRow}>
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleCallContact}
                style={[styles.callButton, { backgroundColor: themeColors.maroonPrimary, height: 52, justifyContent: "center", alignItems: "center" }]}
              >
                <MaterialCommunityIcons name="phone" size={20} color={themeColors.canvasBackground} />
                <Text style={[styles.callButtonText, { color: themeColors.canvasBackground, fontSize: 16 }]}>{callLabel}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                activeOpacity={0.8}
                onPress={handleWhatsAppContact}
                style={[styles.whatsappButton, { height: 52, justifyContent: "center", alignItems: "center" }]}
              >
                <MaterialCommunityIcons name="whatsapp" size={20} color="#FFF" />
                <Text style={[styles.whatsappButtonText, { color: "#FFF", fontSize: 16 }]}>{whatsappLabel}</Text>
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
                {/* Geran */}
                {(() => {
                  const hasGeran = Boolean(listing.geran);
                  return (
                    <TouchableOpacity
                      activeOpacity={hasGeran ? 0.8 : 1}
                      onPress={() => handleOpenDocument(listing.geran, t("geranCopy"))}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={hasGeran ? "file-document-outline" : "file-outline"}
                        size={24}
                        color={hasGeran ? themeColors.maroonPrimary : "#A0A0A0"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: themeColors.textPrimary }}>
                          {t("geranCopy")}
                        </Text>
                        <Text style={{ fontSize: 13, color: hasGeran ? themeColors.textSecondary : "#A0A0A0", marginTop: 2 }}>
                          {hasGeran ? t("docAvailable") : t("docNotUploaded")}
                        </Text>
                      </View>
                      {hasGeran && (
                        <MaterialCommunityIcons name="open-in-new" size={18} color={themeColors.maroonPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* SPA */}
                {(() => {
                  const hasSpa = Boolean(listing.spa);
                  return (
                    <TouchableOpacity
                      activeOpacity={hasSpa ? 0.8 : 1}
                      onPress={() => handleOpenDocument(listing.spa, t("spaCopy"))}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={hasSpa ? "file-sign" : "file-outline"}
                        size={24}
                        color={hasSpa ? themeColors.maroonPrimary : "#A0A0A0"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: themeColors.textPrimary }}>
                          {t("spaCopy")}
                        </Text>
                        <Text style={{ fontSize: 13, color: hasSpa ? themeColors.textSecondary : "#A0A0A0", marginTop: 2 }}>
                          {hasSpa ? t("docAvailable") : t("docNotUploaded")}
                        </Text>
                      </View>
                      {hasSpa && (
                        <MaterialCommunityIcons name="open-in-new" size={18} color={themeColors.maroonPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* IC Owner */}
                {(() => {
                  const hasIc = Boolean(listing.icOwner);
                  return (
                    <TouchableOpacity
                      activeOpacity={hasIc ? 0.8 : 1}
                      onPress={() => handleOpenDocument(listing.icOwner, t("ownerIcCopyFull"))}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={hasIc ? "card-account-details-outline" : "card-outline"}
                        size={24}
                        color={hasIc ? themeColors.maroonPrimary : "#A0A0A0"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: themeColors.textPrimary }}>
                          {t("ownerIcCopyFull")}
                        </Text>
                        <Text style={{ fontSize: 13, color: hasIc ? themeColors.textSecondary : "#A0A0A0", marginTop: 2 }}>
                          {hasIc ? t("docAvailable") : t("docNotUploaded")}
                        </Text>
                      </View>
                      {hasIc && (
                        <MaterialCommunityIcons name="open-in-new" size={18} color={themeColors.maroonPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })()}

                {/* Bil Utility */}
                {(() => {
                  const hasUtility = Boolean(listing.bilUtility);
                  return (
                    <TouchableOpacity
                      activeOpacity={hasUtility ? 0.8 : 1}
                      onPress={() => handleOpenDocument(listing.bilUtility, t("utilityBill"))}
                      style={{
                        flexDirection: "row",
                        alignItems: "center",
                        gap: 12,
                        backgroundColor: themeColors.cardBackground,
                        borderWidth: 1,
                        borderColor: themeColors.borderColor,
                        borderRadius: 12,
                        padding: 14,
                      }}
                    >
                      <MaterialCommunityIcons
                        name={hasUtility ? "receipt" : "receipt-outline"}
                        size={24}
                        color={hasUtility ? themeColors.maroonPrimary : "#A0A0A0"}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: "700", color: themeColors.textPrimary }}>
                          {t("utilityBill")}
                        </Text>
                        <Text style={{ fontSize: 13, color: hasUtility ? themeColors.textSecondary : "#A0A0A0", marginTop: 2 }}>
                          {hasUtility ? t("docAvailable") : t("docNotUploaded")}
                        </Text>
                      </View>
                      {hasUtility && (
                        <MaterialCommunityIcons name="open-in-new" size={18} color={themeColors.maroonPrimary} />
                      )}
                    </TouchableOpacity>
                  );
                })()}
              </View>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal
        visible={isGalleryOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setIsGalleryOpen(false)}
      >
        <View style={[styles.fullScreenModal, { paddingTop: Math.max(insets.top, 16), paddingBottom: Math.max(insets.bottom, 16) }]}> 
          <View style={styles.fullScreenTopBar}>
            <TouchableOpacity
              onPress={() => setIsGalleryOpen(false)}
              style={styles.fullScreenCloseBtn}
            >
              <MaterialCommunityIcons name="close" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <Text style={styles.fullScreenCounter}>{hasImages ? `${activeImageIndex + 1} / ${allImages.length}` : ""}</Text>
          </View>

          <ScrollView
            ref={fullScreenGalleryRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(e) => {
              const idx = Math.round(e.nativeEvent.contentOffset.x / Math.max(1, screenWidth));
              setActiveImageIndex(idx);
              heroGalleryRef.current?.scrollTo({ x: idx * screenWidth, y: 0, animated: false });
            }}
          >
            {allImages.map((imgUri, idx) => (
              <View key={`full-${idx}`} style={{ width: screenWidth, height: screenHeight - Math.max(insets.top, 16) - Math.max(insets.bottom, 16) - 64 }}>
                <Image source={{ uri: imgUri }} style={styles.fullScreenImage} resizeMode="contain" />
              </View>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  centerContainer: {
    flex: 1,
    backgroundColor: THEME.canvasBackground,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: THEME.textMuted,
    fontWeight: "500",
  },
  notFoundTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: THEME.textPrimary,
    marginTop: 12,
  },
  notFoundSub: {
    fontSize: 13,
    color: THEME.textMuted,
    marginTop: 4,
  },
  backBtn: {
    marginTop: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: THEME.maroonPrimary,
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
    backgroundColor: THEME.maroonLight,
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
    borderBottomColor: THEME.maroonBorder,
  },
  heroPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
    color: THEME.maroonPrimary,
    fontWeight: "600",
  },
  floatingBackButton: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  floatingShareButton: {
    position: "absolute",
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
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
    borderColor: THEME.maroonPrimary,
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
    backgroundColor: THEME.cardBackground,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: THEME.borderColor,
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
    backgroundColor: THEME.maroonPrimary,
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
    color: THEME.textSecondary,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    color: THEME.textPrimary,
    lineHeight: 26,
    marginBottom: 6,
  },
  price: {
    fontSize: 22,
    fontWeight: "800",
    color: THEME.maroonPrimary,
    marginBottom: 8,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: THEME.textMuted,
    flex: 1,
  },
  cardSectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.maroonPrimary,
    marginBottom: 12,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  specBox: {
    width: "48%",
    backgroundColor: THEME.maroonLight,
    borderWidth: 1,
    borderColor: THEME.maroonBorder,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  specBoxLabel: {
    fontSize: 11,
    color: THEME.textSecondary,
    marginTop: 4,
    fontWeight: "500",
  },
  specBoxValue: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.maroonDark,
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
    backgroundColor: THEME.maroonLight,
    borderWidth: 1,
    borderColor: THEME.maroonBorder,
    justifyContent: "center",
    alignItems: "center",
  },
  ownerName: {
    fontSize: 16,
    fontWeight: "700",
    color: THEME.textPrimary,
  },
  ownerPhone: {
    fontSize: 13,
    color: THEME.textMuted,
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
    backgroundColor: THEME.maroonPrimary,
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
    backgroundColor: THEME.accentWhatsApp,
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
    backgroundColor: THEME.maroonLight,
    borderWidth: 1,
    borderColor: THEME.maroonBorder,
    borderRadius: 12,
    padding: 12,
  },
  vaultItemDisabled: {
    backgroundColor: THEME.disabledBg,
    borderColor: THEME.borderColor,
  },
  vaultItemTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: THEME.maroonDark,
  },
  vaultItemTextDisabled: {
    color: THEME.disabledText,
  },
  vaultItemStatus: {
    fontSize: 11,
    color: THEME.textMuted,
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
