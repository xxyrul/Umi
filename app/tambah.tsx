import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Keyboard,
  StatusBar,
  Alert,
  StyleSheet,
  ActivityIndicator,
  Image,
  findNodeHandle,
  Dimensions,
  Modal,
  BackHandler,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { firestore, auth } from "@/services/firebase";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  FadeInDown,
  SlideInRight,
  SlideOutLeft,
  FadeIn,
  FadeOut
} from "react-native-reanimated";

import type { PeganganType, LotStatusType, PropertyLocation, PropertyListing } from "@/types/listing";
import { createPropertyListing, updatePropertyListing } from "@/services/storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

const NEGERI_LIST = [
  "Selangor", "Kuala Lumpur", "Johor", "Penang", "Perak", "Kedah", "Pahang",
  "Negeri Sembilan", "Melaka", "Kelantan", "Terengganu", "Sabah", "Sarawak",
  "Perlis", "Putrajaya",
];

const JENIS_LIST = [
  "Residential / Teres", "Condominium / Apartment", "Bungalow / Semi-D",
  "Commercial / Shoplot", "Factory / Warehouse", "Agricultural Land",
];

const STATE_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  "kuala lumpur": { latitude: 3.139, longitude: 101.6869 },
  "selangor": { latitude: 3.0738, longitude: 101.5183 },
  "putrajaya": { latitude: 2.9264, longitude: 101.6964 },
  "perak": { latitude: 4.5921, longitude: 101.0901 },
  "penang": { latitude: 5.4164, longitude: 100.3327 },
  "pulau pinang": { latitude: 5.4164, longitude: 100.3327 },
  "johor": { latitude: 1.4927, longitude: 103.7414 },
  "kedah": { latitude: 6.1184, longitude: 100.3685 },
  "kelantan": { latitude: 6.1254, longitude: 102.2381 },
  "melaka": { latitude: 2.1896, longitude: 102.2501 },
  "malacca": { latitude: 2.1896, longitude: 102.2501 },
  "negeri sembilan": { latitude: 2.7258, longitude: 101.9424 },
  "pahang": { latitude: 3.8126, longitude: 103.3256 },
  "perlis": { latitude: 6.4449, longitude: 100.1986 },
  "sabah": { latitude: 5.9804, longitude: 116.0735 },
  "sarawak": { latitude: 1.5533, longitude: 110.3592 },
  "terengganu": { latitude: 5.3117, longitude: 103.1324 },
  "labuan": { latitude: 5.2831, longitude: 115.2308 },
};

function extractCoordsFromUrl(text: string): { latitude: number; longitude: number } | null {
  if (!text) return null;
  // 1. Google Maps @lat,lng
  const atMatch = text.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
  if (atMatch) return { latitude: parseFloat(atMatch[1]), longitude: parseFloat(atMatch[2]) };
  
  // 2. Google Maps / Search query ?q=lat,lng
  const qMatch = text.match(/[?&](?:q|query|daddr|ll|destination)=(-?\d+\.\d+)[,\s%2C]+(-?\d+\.\d+)/i);
  if (qMatch) return { latitude: parseFloat(qMatch[1]), longitude: parseFloat(qMatch[2]) };

  // 3. Waze latlng=lat,lng
  const wazeMatch = text.match(/latlng=(-?\d+\.\d+)[,\s%2C]+(-?\d+\.\d+)/i);
  if (wazeMatch) return { latitude: parseFloat(wazeMatch[1]), longitude: parseFloat(wazeMatch[2]) };

  // 4. Raw coordinate string: "3.1390, 101.6869"
  const rawMatch = text.match(/^(-?\d+\.\d+)[,\s]+(-?\d+\.\d+)$/);
  if (rawMatch) return { latitude: parseFloat(rawMatch[1]), longitude: parseFloat(rawMatch[2]) };

  return null;
}

const { width } = Dimensions.get("window");
const IMAGE_SIZE = (width - SPACING.lg * 2 - 16) / 3; 

export default function TambahScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const editId = params.id;
  const isEditMode = !!editId;

  const { themeColors, t, language } = useAppSettings();
  const scrollRef = useRef<ScrollView>(null);

  const handleInputFocus = (event: any) => {
    const node = findNodeHandle(event.target);
    if (node && scrollRef.current) {
      scrollRef.current.getScrollResponder()?.scrollResponderScrollNativeHandleToKeyboard(
        node,
        140, 
        true
      );
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);

  // Listing Form States
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [tajuk, setTajuk] = useState("");
  const [harga, setHarga] = useState("");
  const [alamat, setAlamat] = useState("");
  const [negeri, setNegeri] = useState("Selangor");
  const [jenis, setJenis] = useState("Residential / Teres");
  const [pegangan, setPegangan] = useState<PeganganType>("Freehold");
  const [lot, setLot] = useState<LotStatusType>("Bumi Lot");
  const [listingStatus, setListingStatus] = useState<"Aktif" | "Booking" | "Sold" | "Draft">("Aktif");
  const [bilikTidur, setBilikTidur] = useState("3");
  const [bilikAir, setBilikAir] = useState("2");
  const [keluasan, setKeluasan] = useState("");
  const [namaOwner, setNamaOwner] = useState("");
  const [telOwner, setTelOwner] = useState("");
  const [location, setLocation] = useState<PropertyLocation | null>(null);
  const [navLink, setNavLink] = useState("");
  const [gambar, setGambar] = useState<string[]>([]);
  const [hasEditedImages, setHasEditedImages] = useState(false);
  const [geran, setGeran] = useState<string | null>(null);
  const [geranName, setGeranName] = useState<string | null>(null);
  const [spa, setSpa] = useState<string | null>(null);
  const [spaName, setSpaName] = useState<string | null>(null);
  const [icOwner, setIcOwner] = useState<string | null>(null);
  const [icOwnerName, setIcOwnerName] = useState<string | null>(null);

  // Interactive Map Picker & Modal Dropdown States
  const [isMapPickerVisible, setIsMapPickerVisible] = useState(false);
  const [isStateModalVisible, setIsStateModalVisible] = useState(false);
  const [isPropertyTypeModalVisible, setIsPropertyTypeModalVisible] = useState(false);
  const [stateSearchQuery, setStateSearchQuery] = useState("");
  const [pickerCoords, setPickerCoords] = useState<{ latitude: number; longitude: number }>({ latitude: 3.139, longitude: 101.6869 });
  const [pickerAddressPreview, setPickerAddressPreview] = useState("");
  const [pickerSearchQuery, setPickerSearchQuery] = useState("");
  const [pickerSuggestions, setPickerSuggestions] = useState<any[]>([]);
  const [isSearchingMap, setIsSearchingMap] = useState(false);
  const pickerMapRef = useRef<MapView>(null);

  useEffect(() => {
    if (!isMapPickerVisible) return;
    const delayDebounceFn = setTimeout(async () => {
      if (pickerSearchQuery.length > 2) {
        setIsSearchingMap(true);
        try {
          const GOOGLE_API_KEY = "AIzaSyBjWosdtEPIJz6IpqUjZtPQ-62ed8ly7iE";
          const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': GOOGLE_API_KEY },
            body: JSON.stringify({ input: pickerSearchQuery, includedRegionCodes: ['MY'] })
          });
          const data = await response.json();
          setPickerSuggestions(data.suggestions || []);
        } catch (err) {
          console.error("Autocomplete error:", err);
          setPickerSuggestions([]);
        } finally {
          setIsSearchingMap(false);
        }
      } else {
        setPickerSuggestions([]);
      }
    }, 400);
    return () => clearTimeout(delayDebounceFn);
  }, [pickerSearchQuery, isMapPickerVisible]);

  const handleSelectSuggestion = async (rawPlaceId: string) => {
    Keyboard.dismiss();
    setPickerSuggestions([]);
    setIsSearchingMap(true);
    try {
      const placeId = rawPlaceId.replace(/^places\//, "");
      const GOOGLE_API_KEY = "AIzaSyBjWosdtEPIJz6IpqUjZtPQ-62ed8ly7iE";
      const response = await fetch(`https://places.googleapis.com/v1/places/${placeId}?fields=location`, {
        headers: { 'X-Goog-Api-Key': GOOGLE_API_KEY }
      });
      const data = await response.json();
      if (data.location) {
        const target = { latitude: data.location.latitude, longitude: data.location.longitude };
        setPickerCoords(target);
        pickerMapRef.current?.animateToRegion({
          ...target,
          latitudeDelta: 0.015,
          longitudeDelta: 0.015,
        }, 500);
        updatePickerAddress(target.latitude, target.longitude);
      }
    } catch (err) {
      console.error("Place details error:", err);
    } finally {
      setIsSearchingMap(false);
    }
  };

  // Intercept Hardware Back Button on Android
  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        if (currentStep > 1) {
          setCurrentStep(prev => prev - 1);
          return true; // Prevent default behavior
        }
        return false; // Let default behavior happen (go back)
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [currentStep])
  );

  // Animations
  const progressWidth = useSharedValue(1);
  const bedScale = useSharedValue(1);
  const bathScale = useSharedValue(1);

  useEffect(() => {
    progressWidth.value = withSpring(currentStep, { damping: 15 });
  }, [currentStep]);

  const progressStyle = useAnimatedStyle(() => {
    return {
      width: `${(progressWidth.value / 3) * 100}%`,
    };
  });

  const bedAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bedScale.value }]
  }));

  const bathAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: bathScale.value }]
  }));

  const triggerBounce = (animValue: any) => {
    animValue.value = withSpring(1.3, { damping: 10 }, () => {
      animValue.value = withSpring(1);
    });
  };

  const incrementBilikTidur = () => {
    setBilikTidur(String((parseInt(bilikTidur) || 0) + 1));
    triggerBounce(bedScale);
  };
  const decrementBilikTidur = () => {
    const val = parseInt(bilikTidur) || 0;
    if (val > 0) {
      setBilikTidur(String(val - 1));
      triggerBounce(bedScale);
    }
  };
  const incrementBilikAir = () => {
    setBilikAir(String((parseInt(bilikAir) || 0) + 1));
    triggerBounce(bathScale);
  };
  const decrementBilikAir = () => {
    const val = parseInt(bilikAir) || 0;
    if (val > 0) {
      setBilikAir(String(val - 1));
      triggerBounce(bathScale);
    }
  };

  useEffect(() => {
    if (!editId) return;
    const loadListingForEdit = async () => {
      try {
        let doc = await firestore().collection("listings").doc(editId).get();
        if (!doc.exists) {
          doc = await firestore().collection("publicListings").doc(editId).get();
        }
        if (doc.exists) {
          const data = doc.data() as PropertyListing;
          if (data.tajuk) setTajuk(data.tajuk);
          if (data.harga) setHarga(String(data.harga));
          if (data.alamat) setAlamat(data.alamat);
          if (data.negeri) setNegeri(data.negeri);
          if (data.jenis) setJenis(data.jenis);
          if (data.pegangan) setPegangan(data.pegangan as PeganganType);
          if (data.lot) setLot(data.lot as LotStatusType);
          if (data.status) setListingStatus(data.status as any);
          if (data.bilikTidur) setBilikTidur(String(data.bilikTidur));
          if (data.bilikAir) setBilikAir(String(data.bilikAir));
          if (data.keluasan) setKeluasan(String(data.keluasan));
          if (data.namaOwner) setNamaOwner(data.namaOwner);
          if (data.telOwner) setTelOwner(data.telOwner);
          if (data.location) setLocation(data.location);
          const loadedImages: string[] = [];
          if (data.imageUrl && typeof data.imageUrl === "string") loadedImages.push(data.imageUrl);
          if (Array.isArray(data.images)) {
            data.images.forEach((img) => {
              if (img && typeof img === "string" && !loadedImages.includes(img)) loadedImages.push(img);
            });
          }
          if (Array.isArray(data.gambar)) {
            data.gambar.forEach((img) => {
              if (img && typeof img === "string" && !loadedImages.includes(img)) loadedImages.push(img);
            });
          }
          if (loadedImages.length > 0) setGambar(loadedImages);
          if (data.geran) setGeran(data.geran);
          if (data.spa) setSpa(data.spa);
          if (data.icOwner) setIcOwner(data.icOwner);
          if (data.navLink) setNavLink(data.navLink);
        }
      } catch (err) {
        console.error("Error loading listing for edit:", err);
      }
    };
    loadListingForEdit();
  }, [editId]);

  const autoDetectAddressAndState = async (lat: number, lng: number, forceReplaceAddress = false) => {
    try {
      const addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addressList && addressList.length > 0) {
        const place = addressList[0];
        const parts = [
          place.name || place.streetNumber, place.street, place.district || place.subregion, place.city,
        ].filter(Boolean);
        const detectedAddress = parts.join(", ");
        if (detectedAddress && (forceReplaceAddress || !alamat.trim())) {
          setAlamat(detectedAddress);
        }
        if (place.region) {
          const matched = NEGERI_LIST.find((s) =>
            place.region?.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(place.region?.toLowerCase() || "")
          );
          if (matched) {
            setNegeri(matched);
          }
        }
        return detectedAddress;
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
    return "";
  };

  const updatePickerAddress = async (lat: number, lng: number) => {
    try {
      const addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addressList && addressList.length > 0) {
        const place = addressList[0];
        const parts = [
          place.name || place.streetNumber, place.street, place.district || place.subregion, place.city, place.region
        ].filter(Boolean);
        setPickerAddressPreview(parts.join(", ") || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      }
    } catch {
      setPickerAddressPreview(`${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    }
  };

  const handleOpenMapPicker = () => {
    const defaultCoords = location || STATE_COORDINATES[negeri.toLowerCase()] || { latitude: 3.139, longitude: 101.6869 };
    setPickerCoords(defaultCoords);
    setPickerAddressPreview(alamat || "Memuatkan alamat...");
    setPickerSearchQuery("");
    setIsMapPickerVisible(true);
    updatePickerAddress(defaultCoords.latitude, defaultCoords.longitude);
  };


  const handleConfirmMapPicker = async () => {
    setLocation(pickerCoords);
    if (pickerAddressPreview && pickerAddressPreview !== "Memuatkan alamat...") {
      if (!alamat.trim() || alamat.length < 5) {
        setAlamat(pickerAddressPreview);
      }
    }
    await autoDetectAddressAndState(pickerCoords.latitude, pickerCoords.longitude);
    
    // Auto-fill Google Maps Navigation link
    setNavLink(`https://maps.google.com/?q=${pickerCoords.latitude.toFixed(6)},${pickerCoords.longitude.toFixed(6)}`);
    
    setIsMapPickerVisible(false);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  };

  const handleNavLinkChange = (text: string) => {
    setNavLink(text);
    const coords = extractCoordsFromUrl(text);
    if (coords) {
      setLocation(coords);
      autoDetectAddressAndState(coords.latitude, coords.longitude);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  };

  const handleAddressBlur = async () => {
    if (alamat.trim() && !location) {
      try {
        const query = alamat.toLowerCase().includes("malaysia") ? alamat : `${alamat}, ${negeri}, Malaysia`;
        const results = await Location.geocodeAsync(query);
        if (results && results.length > 0) {
          setLocation({ latitude: results[0].latitude, longitude: results[0].longitude });
        }
      } catch (err) {
        console.error("Address forward-geocoding error:", err);
      }
    }
  };

  const handlePinLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("locationPermission") || "Permission Denied", t("locationPermissionMsg") || "Please grant location access");
        setIsFetchingLocation(false);
        return;
      }
      let coords = null;
      const lastKnown = await Location.getLastKnownPositionAsync({ maxAge: 5 * 60 * 1000, requiredAccuracy: 200 });
      if (lastKnown) {
        coords = { latitude: lastKnown.coords.latitude, longitude: lastKnown.coords.longitude };
        setLocation(coords);
        autoDetectAddressAndState(coords.latitude, coords.longitude);
      }
      try {
        const freshLoc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced, timeInterval: 8000 });
        const freshCoords = { latitude: freshLoc.coords.latitude, longitude: freshLoc.coords.longitude };
        const shouldUpdate = !coords ||
          Math.abs(freshCoords.latitude - coords.latitude) > 0.0005 ||
          Math.abs(freshCoords.longitude - coords.longitude) > 0.0005;
        if (shouldUpdate) {
          setLocation(freshCoords);
          await autoDetectAddressAndState(freshCoords.latitude, freshCoords.longitude);
        }
      } catch {
        if (!coords) throw new Error("Could not obtain GPS location. Please try again outdoors.");
      }
    } catch (err: any) {
      Alert.alert("Location Error", err?.message || "Failed to pin current GPS location.");
    } finally {
      setIsFetchingLocation(false);
    }
  };

  const handlePickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Library access permission is required.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        quality: 0.8,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const newUris = result.assets.map((asset) => asset.uri);
        setHasEditedImages(true);
        setGambar((prev) => [...prev, ...newUris]);
      }
    } catch (error) {
      console.error("Image picking error:", error);
    }
  };

  const handleRemoveImage = (index: number) => {
    setHasEditedImages(true);
    setGambar((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSetCoverImage = (index: number) => {
    if (index === 0) return;
    Haptics.selectionAsync().catch(() => {});
    setHasEditedImages(true);
    setGambar((prev) => {
      const next = [...prev];
      const [chosen] = next.splice(index, 1);
      return [chosen, ...next];
    });
  };

  const handleMoveImage = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= gambar.length) return;
    Haptics.selectionAsync().catch(() => {});
    setHasEditedImages(true);
    setGambar((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[targetIndex];
      next[targetIndex] = temp;
      return next;
    });
  };

  const handlePickDocument = async (docType: "geran" | "spa" | "icOwner") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });
      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        if (docType === "geran") { setGeran(file.uri); setGeranName(file.name); }
        else if (docType === "spa") { setSpa(file.uri); setSpaName(file.name); }
        else if (docType === "icOwner") { setIcOwner(file.uri); setIcOwnerName(file.name); }
      }
    } catch (error) {
      console.error("Document picking error:", error);
    }
  };

  const resetForm = () => {
    setTajuk(""); setHarga(""); setAlamat(""); setNegeri("Selangor"); setJenis("Residential / Teres");
    setPegangan("Freehold"); setLot("Bumi Lot"); setListingStatus("Aktif"); setBilikTidur("3"); setBilikAir("2");
    setKeluasan(""); setNamaOwner(""); setTelOwner(""); setLocation(null); setGambar([]);
    setGeran(null); setGeranName(null); setSpa(null); setSpaName(null); setIcOwner(null); setIcOwnerName(null);
    setNavLink(""); setCurrentStep(1);
  };

  const handleSubmitListing = async () => {
    if (!tajuk.trim()) { Alert.alert(t("incompleteInfo") || "Incomplete", t("enterTitle") || "Please enter title"); return; }
    if (!harga.trim()) { Alert.alert(t("incompleteInfo") || "Incomplete", t("enterPrice") || "Please enter price"); return; }
    try {
      setIsSubmitting(true);
      const listingData = {
        tajuk: tajuk.trim(), harga: harga.trim(), alamat: alamat.trim(), negeri, jenis, pegangan, lot,
        bilikTidur: parseInt(bilikTidur) || 0, bilikAir: parseInt(bilikAir) || 0, keluasan: keluasan.trim(),
        location, namaOwner: namaOwner.trim(), telOwner: telOwner.trim(), navLink: navLink.trim(), status: listingStatus,
      };
      const files = { gambar: isEditMode ? (hasEditedImages ? gambar : undefined) : gambar, geran, spa, icOwner };
      if (isEditMode && editId) {
        await updatePropertyListing(editId, listingData, files);
        Alert.alert(t("listingUpdated") || "Updated", `"${tajuk}"`, [{ text: t("goToListing") || "OK", onPress: () => { resetForm(); router.replace("/(tabs)/listings"); } }]);
      } else {
        await createPropertyListing(listingData, files);
        Alert.alert(t("listingSaved") || "Saved", `"${tajuk}"`, [{ text: t("goToListing") || "OK", onPress: () => { resetForm(); router.replace("/(tabs)/listings"); } }]);
      }
    } catch (error: any) {
      Alert.alert(t("saveFailed") || "Failed", error?.message || t("errorTitle"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerPaddingTop = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 12;

  const renderStep1 = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("basicInfo")}</Text>
      <TextInput placeholder={t("titlePlaceholder")} placeholderTextColor={themeColors.textMuted} value={tajuk} onChangeText={setTajuk} onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />

      <View style={[styles.priceInputContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
        <Text style={[styles.pricePrefix, { color: themeColors.textPrimary }]}>RM</Text>
        <TextInput placeholder={t("pricePlaceholder")} placeholderTextColor={themeColors.textMuted} value={harga.replace(/\B(?=(\d{3})+(?!\d))/g, ",")} onChangeText={(v) => setHarga(v.replace(/,/g, "").replace(/\D/g, ""))} keyboardType="numeric" onFocus={handleInputFocus} style={[styles.priceInput, { color: themeColors.textPrimary }]} />
      </View>

      {/* Property Type Dropdown Trigger */}
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("propertyType") || "Jenis Hartanah"}</Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsPropertyTypeModalVisible(true)}
        style={[styles.selectTrigger, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <MaterialCommunityIcons name="home-city-outline" size={20} color={themeColors.maroonPrimary} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
            {jenis}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>

      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("specsTitle")}</Text>
      
      {/* Tenure (Freehold / Leasehold) */}
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("tenure")}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {["Freehold", "Leasehold"].map((ten) => (
            <TouchableOpacity key={ten} onPress={() => setPegangan(ten as any)} style={[styles.gridChip, { flex: 1, alignItems: "center", justifyContent: "center", height: 46, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, pegangan === ten && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary }]}>
              <Text style={{ color: pegangan === ten ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>{ten}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Lot Status (Bumi / Non-Bumi) */}
      <View style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("lotStatus")}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {["Bumi", "Non-Bumi"].map((l) => {
            const label = l === "Bumi" ? "Bumi Lot" : "Non-Bumi Lot";
            return (
              <TouchableOpacity key={l} onPress={() => setLot(label as any)} style={[styles.gridChip, { flex: 1, alignItems: "center", justifyContent: "center", height: 46, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, lot === label && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={{ color: lot === label ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>{l === "Bumi" ? "Bumi Lot" : "Non-Bumi Lot"}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {/* Bedrooms & Bathrooms Steppers */}
      <View style={{ flexDirection: "row", gap: 12, marginBottom: SPACING.md }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("bedrooms")}</Text>
          <View style={[styles.stepperContainer, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
            <TouchableOpacity onPress={decrementBilikTidur} style={styles.stepperBtn}><MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} /></TouchableOpacity>
            <Animated.Text style={[styles.stepperValue, { color: themeColors.textPrimary }, bedAnimatedStyle]}>{bilikTidur}</Animated.Text>
            <TouchableOpacity onPress={incrementBilikTidur} style={styles.stepperBtn}><MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} /></TouchableOpacity>
          </View>
        </View>
        <View style={{ flex: 1 }}>
          <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("bathrooms")}</Text>
          <View style={[styles.stepperContainer, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
            <TouchableOpacity onPress={decrementBilikAir} style={styles.stepperBtn}><MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} /></TouchableOpacity>
            <Animated.Text style={[styles.stepperValue, { color: themeColors.textPrimary }, bathAnimatedStyle]}>{bilikAir}</Animated.Text>
            <TouchableOpacity onPress={incrementBilikAir} style={styles.stepperBtn}><MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} /></TouchableOpacity>
          </View>
        </View>
      </View>

      <TextInput placeholder={language === "BM" ? "Keluasan (sqft)" : "Size (sqft)"} placeholderTextColor={themeColors.textMuted} value={keluasan} onChangeText={setKeluasan} keyboardType="default" onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />
    </Animated.View>
  );

  const renderStep2 = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{language === "BM" ? "Lokasi Hartanah" : "Property Location"}</Text>
      
      {/* 2-Button Choice: Pick on Map OR Pin GPS */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handleOpenMapPicker}
          style={[
            styles.locationChoiceBtn,
            {
              flex: 1,
              backgroundColor: themeColors.maroonPrimary,
              borderColor: themeColors.maroonPrimary,
            },
          ]}
        >
          <MaterialCommunityIcons name="map-marker-outline" size={20} color="#FFFFFF" />
          <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 13 }}>
            {language === "BM" ? "Pilih di Peta" : "Pick on Map"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.8}
          onPress={handlePinLocation}
          disabled={isFetchingLocation}
          style={[
            styles.locationChoiceBtn,
            {
              flex: 1,
              backgroundColor: themeColors.surfaceContainer,
              borderColor: themeColors.borderColor,
            },
          ]}
        >
          {isFetchingLocation ? (
            <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons name="crosshairs-gps" size={18} color={themeColors.textPrimary} />
              <Text style={{ color: themeColors.textPrimary, fontWeight: "700", fontSize: 13 }}>
                {language === "BM" ? "GPS Terkini" : "Current GPS"}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Confirmed GPS Location Badge */}
      {location ? (
        <View
          style={[
            styles.confirmedLocationCard,
            {
              backgroundColor: `${themeColors.maroonPrimary}12`,
              borderColor: `${themeColors.maroonPrimary}30`,
            },
          ]}
        >
          <MaterialCommunityIcons name="check-circle" size={20} color="#10B981" />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 12, fontWeight: "700", color: themeColors.textPrimary }}>
              {language === "BM" ? "Koordinat GPS Disahkan" : "GPS Coordinates Set"}
            </Text>
            <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </Text>
          </View>
          <TouchableOpacity
            onPress={handleOpenMapPicker}
            style={{
              paddingHorizontal: 10,
              paddingVertical: 5,
              borderRadius: 6,
              backgroundColor: themeColors.maroonPrimary,
            }}
          >
            <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "700" }}>
              {language === "BM" ? "Ubah" : "Change"}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {/* State (Negeri) Dropdown Trigger */}
      <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 6, marginTop: 4 }]}>
        {language === "BM" ? "Negeri" : "State"}
      </Text>
      <TouchableOpacity
        activeOpacity={0.7}
        onPress={() => setIsStateModalVisible(true)}
        style={[styles.selectTrigger, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, marginBottom: SPACING.sm }]}
      >
        <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={20} color={themeColors.maroonPrimary} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: themeColors.textPrimary }}>
            {negeri}
          </Text>
        </View>
        <MaterialCommunityIcons name="chevron-down" size={20} color={themeColors.textMuted} />
      </TouchableOpacity>

      {/* Full Property Address */}
      <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 6 }]}>
        {t("addressPlaceholder") || "Alamat Penuh"}
      </Text>
      <TextInput
        placeholder={t("addressPlaceholder") || "Alamat penuh hartanah (cth: No 12, Jalan ABC...)"}
        placeholderTextColor={themeColors.textMuted}
        value={alamat}
        onChangeText={setAlamat}
        onBlur={handleAddressBlur}
        multiline
        numberOfLines={3}
        onFocus={handleInputFocus}
        style={[styles.input, styles.multilineInput, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      />

      {/* Navigation Link (Auto-generates or manual paste) */}
      <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 6, marginTop: 4 }]}>
        {language === "BM" ? "Pautan Navigasi (Google Maps / Waze)" : "Navigation Link (Google Maps / Waze)"}
      </Text>
      <TextInput
        placeholder={language === "BM" ? "Pautan Google Maps / Waze (Auto-isi dari peta)" : "Google Maps / Waze Link (Auto-fills from map)"}
        placeholderTextColor={themeColors.textMuted}
        value={navLink}
        onChangeText={handleNavLinkChange}
        onFocus={handleInputFocus}
        style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
      />

      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{language === "BM" ? "Status Listing" : "Listing Status"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {([{ value: "Aktif", label: language === "BM" ? "Aktif" : "Active", icon: "check-circle", color: "#10B981" }, { value: "Booking", label: "Booking", icon: "clock-outline", color: "#F59E0B" }, { value: "Sold", label: language === "BM" ? "Terjual" : "Sold", icon: "tag-check", color: "#3B82F6" }, { value: "Draft", label: "Draft", icon: "pencil-outline", color: "#6B7280" }] as const).map((opt) => {
          const isActive = listingStatus === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => setListingStatus(opt.value)} style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 2, flex: 1, minWidth: "45%", justifyContent: "center", borderColor: isActive ? opt.color : themeColors.borderColor, backgroundColor: isActive ? `${opt.color}18` : themeColors.cardBackground }]}>
              <MaterialCommunityIcons name={opt.icon as any} size={18} color={isActive ? opt.color : themeColors.textMuted} />
              <Text style={{ fontWeight: "700", fontSize: 14, color: isActive ? opt.color : themeColors.textSecondary }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("ownerDetails")}</Text>
      <TextInput placeholder={t("ownerNamePlaceholder") || "Nama Ejen"} placeholderTextColor={themeColors.textMuted} value={namaOwner} onChangeText={setNamaOwner} onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />
      <TextInput placeholder={t("ownerPhonePlaceholder") || "No. Telefon Ejen"} placeholderTextColor={themeColors.textMuted} value={telOwner} onChangeText={setTelOwner} keyboardType="phone-pad" onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{language === "BM" ? "Media & Dokumen" : "Media & Documents"}</Text>

      <View style={styles.imageGrid}>
        {gambar.map((uri, idx) => (
          <Animated.View entering={FadeInDown} key={idx} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.gridImage} />
            {idx === 0 ? (
              <View style={styles.coverBadge}>
                <MaterialCommunityIcons name="star" size={10} color="#FFF" />
                <Text style={styles.coverBadgeText}>Cover</Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleSetCoverImage(idx)}
                style={styles.setCoverBtn}
              >
                <Text style={styles.setCoverBtnText}>Set Cover</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={() => handleRemoveImage(idx)} style={styles.removeGridBtn}>
              <MaterialCommunityIcons name="close" size={14} color="#FFF" />
            </TouchableOpacity>
            {gambar.length > 1 && (
              <View style={styles.reorderControls}>
                {idx > 0 && (
                  <TouchableOpacity onPress={() => handleMoveImage(idx, "left")} style={styles.reorderBtn}>
                    <MaterialCommunityIcons name="chevron-left" size={14} color="#FFF" />
                  </TouchableOpacity>
                )}
                {idx < gambar.length - 1 && (
                  <TouchableOpacity onPress={() => handleMoveImage(idx, "right")} style={[styles.reorderBtn, { marginLeft: "auto" }]}>
                    <MaterialCommunityIcons name="chevron-right" size={14} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        ))}
        <TouchableOpacity onPress={handlePickImages} style={[styles.imageWrapper, styles.uploadGridBtn, { borderColor: themeColors.borderColor }]}>
          <MaterialCommunityIcons name="camera-plus-outline" size={26} color={themeColors.textMuted} />
          <Text style={{ fontSize: 11, color: themeColors.textMuted, marginTop: 4 }}>+ Foto</Text>
        </TouchableOpacity>
      </View>

      <View style={{ gap: SPACING.sm, marginTop: 10 }}>
        <TouchableOpacity onPress={() => handlePickDocument("geran")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
          <MaterialCommunityIcons name="file-document-outline" size={22} color={geran ? themeColors.maroonPrimary : themeColors.textMuted} />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>{geranName ? `${t("geranCopy")}: ${geranName}` : t("geranCopy")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handlePickDocument("spa")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
          <MaterialCommunityIcons name="file-sign" size={22} color={spa ? themeColors.maroonPrimary : themeColors.textMuted} />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>{spaName ? `${t("spaCopy")}: ${spaName}` : t("spaCopy")}</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handlePickDocument("icOwner")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
          <MaterialCommunityIcons name="card-account-details-outline" size={22} color={icOwner ? themeColors.maroonPrimary : themeColors.textMuted} />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>{icOwnerName ? `${t("ownerIcCopyFull")}: ${icOwnerName}` : t("ownerIcCopyFull")}</Text>
        </TouchableOpacity>
      </View>

      {/* Review Summary */}
      <View style={[styles.reviewContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor, marginTop: SPACING.lg }]}>
        <Text style={{ fontWeight: '700', color: themeColors.textPrimary, marginBottom: 8 }}>Review Listing</Text>
        <Text style={{ color: themeColors.textSecondary }}>Title: {tajuk || "-"}</Text>
        <Text style={{ color: themeColors.textSecondary }}>Price: RM{harga || "-"}</Text>
        <Text style={{ color: themeColors.textSecondary }}>State: {negeri}</Text>
        <Text style={{ color: themeColors.textSecondary }}>Images: {gambar.length}</Text>
        <Text style={{ color: themeColors.textSecondary }}>Documents: {[geran, spa, icOwner].filter(Boolean).length}</Text>
      </View>

      <TouchableOpacity onPress={handleSubmitListing} disabled={isSubmitting} style={[styles.submitBtn, { backgroundColor: themeColors.maroonPrimary }]}>
        {isSubmitting ? <ActivityIndicator color="#FFF" /> : <Text style={[styles.submitBtnText, { color: themeColors.canvasBackground }]}>{isEditMode ? (language === "BM" ? "Simpan Perubahan" : "Save Changes") : (language === "BM" ? "Tambah Listing" : "Create Listing")}</Text>}
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: themeColors.canvasBackground }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.header, { paddingTop: headerPaddingTop, borderBottomColor: themeColors.borderColor, flexDirection: "row", alignItems: "center" }]}>
        <TouchableOpacity onPress={() => {
          if (currentStep > 1) {
            setCurrentStep(prev => prev - 1);
          } else {
            router.canGoBack() ? router.back() : router.replace("/(tabs)/listings");
          }
        }} style={{ padding: 6, borderRadius: 20, backgroundColor: themeColors.surfaceContainer, marginRight: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary, flex: 1 }]}>{isEditMode ? t("editListing") : t("addListing")}</Text>
      </View>

      {/* Animated Step Indicator */}
      <View style={[styles.progressContainer, { backgroundColor: themeColors.borderColor }]}>
        <Animated.View style={[styles.progressBar, { backgroundColor: themeColors.maroonPrimary }, progressStyle]} />
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{
          padding: SPACING.lg,
          paddingBottom: Math.max(insets.bottom, 28) + 120,
        }}
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        
        {/* Navigation Buttons */}
        <View style={styles.navRow}>
          {currentStep > 1 && (
            <TouchableOpacity onPress={() => setCurrentStep(prev => prev - 1)} style={[styles.navBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
              <Text style={{ color: themeColors.textPrimary, fontWeight: "600" }}>Back</Text>
            </TouchableOpacity>
          )}
          {currentStep < 3 && (
            <TouchableOpacity onPress={() => setCurrentStep(prev => prev + 1)} style={[styles.navBtn, { backgroundColor: themeColors.maroonPrimary, marginLeft: 'auto' }]}>
              <Text style={{ color: themeColors.canvasBackground, fontWeight: "600" }}>Next</Text>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>

      {/* ========== Interactive Map Location Picker Modal ========== */}
      <Modal
        visible={isMapPickerVisible}
        animationType="slide"
        onRequestClose={() => setIsMapPickerVisible(false)}
      >
        <View style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}>
          {/* Modal Header */}
          <View
            style={{
              paddingTop: Math.max(insets.top, 16),
              paddingHorizontal: 16,
              paddingBottom: 12,
              flexDirection: "row",
              alignItems: "center",
              borderBottomWidth: 1,
              borderBottomColor: themeColors.borderColor,
              backgroundColor: themeColors.cardBackground,
              gap: 12,
            }}
          >
            <TouchableOpacity
              onPress={() => setIsMapPickerVisible(false)}
              style={{
                padding: 6,
                borderRadius: 20,
                backgroundColor: themeColors.surfaceContainer,
              }}
            >
              <MaterialCommunityIcons name="close" size={22} color={themeColors.textPrimary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 18, fontWeight: "700", color: themeColors.textPrimary, flex: 1 }}>
              {language === "BM" ? "Pilih Lokasi Hartanah" : "Pin Property Location"}
            </Text>
          </View>

          {/* Map View Area with Overlay Search */}
          <View style={{ flex: 1, position: "relative" }}>
            <MapView
              ref={pickerMapRef}
              style={{ flex: 1, width: "100%" }}
              provider={PROVIDER_GOOGLE}
              toolbarEnabled={false}
              showsUserLocation={true}
              showsMyLocationButton={true}
              mapPadding={{ bottom: Math.max(insets.bottom, 28) + 120, top: 70, right: 0, left: 0 }}
              initialRegion={{
                latitude: pickerCoords.latitude,
                longitude: pickerCoords.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }}
              onRegionChangeComplete={(region) => {
                setPickerCoords({ latitude: region.latitude, longitude: region.longitude });
                updatePickerAddress(region.latitude, region.longitude);
              }}
            />

            {/* Fixed Center Pin */}
            <View style={{ position: "absolute", top: "50%", left: "50%", marginTop: -36, marginLeft: -16, alignItems: "center", pointerEvents: "none" }}>
              <MaterialCommunityIcons name="map-marker" size={40} color={themeColors.maroonPrimary} />
            </View>

            {/* Instruction Tip */}
            {pickerSuggestions.length === 0 && (
              <View
                style={{
                  position: "absolute",
                  top: 75,
                  alignSelf: "center",
                  backgroundColor: "rgba(0,0,0,0.75)",
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 20,
                  pointerEvents: "none",
                }}
              >
                <Text style={{ color: "#FFF", fontSize: 12, fontWeight: "600" }}>
                  {language === "BM" ? "👉 Ketik atau seret pin ke lokasi tepat" : "👉 Tap or drag pin to exact location"}
                </Text>
              </View>
            )}

            {/* Floating Search Bar & Full-Touch Suggestions Overlay */}
            <View
              style={{
                position: "absolute",
                top: 12,
                left: 12,
                right: 12,
                zIndex: 9999,
                elevation: 9999,
              }}
            >
              {/* Search Input Box */}
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: themeColors.borderColor,
                  backgroundColor: themeColors.cardBackground,
                  gap: 8,
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 6,
                }}
              >
                <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
                <TextInput
                  placeholder={language === "BM" ? "Cari jalan / kawasan / bandar..." : "Search road / area / city..."}
                  placeholderTextColor={themeColors.textMuted}
                  value={pickerSearchQuery}
                  onChangeText={setPickerSearchQuery}
                  style={{ flex: 1, fontSize: 14, color: themeColors.textPrimary }}
                />
                {isSearchingMap ? (
                  <ActivityIndicator size="small" color={themeColors.maroonPrimary} />
                ) : pickerSearchQuery.length > 0 ? (
                  <TouchableOpacity onPress={() => { setPickerSearchQuery(""); setPickerSuggestions([]); }}>
                    <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
                  </TouchableOpacity>
                ) : null}
              </View>

              {/* Suggestions List */}
              {pickerSuggestions.length > 0 && (
                <View
                  style={{
                    marginTop: 6,
                    backgroundColor: themeColors.cardBackground,
                    borderRadius: 12,
                    borderWidth: 1,
                    borderColor: themeColors.borderColor,
                    maxHeight: 220,
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: 4 },
                    shadowOpacity: 0.3,
                    shadowRadius: 6,
                    elevation: 12,
                    overflow: "hidden",
                  }}
                >
                  <ScrollView
                    keyboardShouldPersistTaps="always"
                    nestedScrollEnabled={true}
                    showsVerticalScrollIndicator={true}
                    style={{ maxHeight: 220 }}
                  >
                    {pickerSuggestions.map((item, index) => (
                      <TouchableOpacity
                        key={item.placePrediction?.placeId || `place-${index}`}
                        activeOpacity={0.7}
                        style={{
                          paddingHorizontal: 14,
                          paddingVertical: 12,
                          borderBottomWidth: index === pickerSuggestions.length - 1 ? 0 : 1,
                          borderBottomColor: themeColors.borderColor,
                        }}
                        onPress={() => handleSelectSuggestion(item.placePrediction?.place || item.placePrediction?.placeId)}
                      >
                        <Text style={{ color: themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>
                          {item.placePrediction?.structuredFormat?.mainText?.text || item.placePrediction?.text?.text}
                        </Text>
                        {item.placePrediction?.structuredFormat?.secondaryText?.text ? (
                          <Text style={{ color: themeColors.textSecondary, fontSize: 12, marginTop: 2 }}>
                            {item.placePrediction.structuredFormat.secondaryText.text}
                          </Text>
                        ) : null}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}
            </View>
          </View>

          {/* Bottom Confirmation Bar */}
          <View
            style={{
              padding: 16,
              paddingBottom: Math.max(insets.bottom, 28) + 16,
              backgroundColor: themeColors.cardBackground,
              borderTopWidth: 1,
              borderTopColor: themeColors.borderColor,
              gap: 12,
            }}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="map-marker-check" size={22} color={themeColors.maroonPrimary} />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "700", color: themeColors.textPrimary }} numberOfLines={2}>
                  {pickerAddressPreview}
                </Text>
                <Text style={{ fontSize: 11, color: themeColors.textMuted }}>
                  {pickerCoords.latitude.toFixed(6)}, {pickerCoords.longitude.toFixed(6)}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              onPress={handleConfirmMapPicker}
              style={{
                backgroundColor: themeColors.maroonPrimary,
                paddingVertical: 14,
                borderRadius: 12,
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Text style={{ color: "#FFFFFF", fontWeight: "800", fontSize: 16 }}>
                {language === "BM" ? "Sahkan Lokasi Ini" : "Confirm This Location"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Property Type Bottom Sheet Modal */}
      <Modal
        visible={isPropertyTypeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsPropertyTypeModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsPropertyTypeModalVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.bottomSheetContainer,
              {
                backgroundColor: themeColors.cardBackground,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: themeColors.borderColor }]}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                {language === "BM" ? "Pilih Jenis Hartanah" : "Select Property Type"}
              </Text>
              <TouchableOpacity onPress={() => setIsPropertyTypeModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ paddingHorizontal: 16, paddingTop: 12 }}>
              {[
                { id: "Residential / Teres", icon: "home-outline", desc: language === "BM" ? "Rumah teres, townhouse" : "Terrace, townhouse" },
                { id: "Condominium / Apartment", icon: "city-variant-outline", desc: language === "BM" ? "Kondo, servis apartment, flat" : "Condo, serviced residence, flat" },
                { id: "Bungalow / Semi-D", icon: "home-modern", desc: language === "BM" ? "Banglo, semi-d, villa" : "Bungalow, semi-detached, villa" },
                { id: "Commercial / Shoplot", icon: "store-outline", desc: language === "BM" ? "Kedai, pejabat, ruang runcit" : "Shoplot, office, retail space" },
                { id: "Factory / Warehouse", icon: "factory", desc: language === "BM" ? "Kilang industri, gudang" : "Industrial factory, warehouse" },
                { id: "Agricultural Land", icon: "tree-outline", desc: language === "BM" ? "Tanah pertanian, dusun" : "Agri land, plantation" },
              ].map((item) => {
                const isSelected = jenis === item.id;
                return (
                  <TouchableOpacity
                    key={item.id}
                    activeOpacity={0.7}
                    onPress={() => {
                      setJenis(item.id);
                      setIsPropertyTypeModalVisible(false);
                      Haptics.selectionAsync().catch(() => {});
                    }}
                    style={[
                      styles.sheetOptionCard,
                      {
                        backgroundColor: isSelected ? `${themeColors.maroonPrimary}12` : themeColors.surfaceContainer,
                        borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.sheetOptionIconBox,
                        {
                          backgroundColor: isSelected ? themeColors.maroonPrimary : `${themeColors.maroonPrimary}18`,
                        },
                      ]}
                    >
                      <MaterialCommunityIcons
                        name={item.icon as any}
                        size={22}
                        color={isSelected ? "#FFFFFF" : themeColors.maroonPrimary}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sheetOptionTitle, { color: themeColors.textPrimary }]}>
                        {item.id}
                      </Text>
                      <Text style={[styles.sheetOptionDesc, { color: themeColors.textMuted }]}>
                        {item.desc}
                      </Text>
                    </View>
                    {isSelected && (
                      <MaterialCommunityIcons name="check-circle" size={22} color={themeColors.maroonPrimary} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* State (Negeri) Bottom Sheet Modal */}
      <Modal
        visible={isStateModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setIsStateModalVisible(false)}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setIsStateModalVisible(false)}
          style={styles.modalOverlay}
        >
          <TouchableOpacity
            activeOpacity={1}
            style={[
              styles.bottomSheetContainer,
              {
                backgroundColor: themeColors.cardBackground,
                paddingBottom: Math.max(insets.bottom, 24) + 16,
              },
            ]}
          >
            <View style={[styles.sheetHeader, { borderBottomColor: themeColors.borderColor }]}>
              <Text style={[styles.sheetTitle, { color: themeColors.textPrimary }]}>
                {language === "BM" ? "Pilih Negeri" : "Select State"}
              </Text>
              <TouchableOpacity onPress={() => setIsStateModalVisible(false)}>
                <MaterialCommunityIcons name="close" size={24} color={themeColors.textMuted} />
              </TouchableOpacity>
            </View>

            {/* State Search Bar */}
            <View
              style={{
                flexDirection: "row",
                alignItems: "center",
                marginHorizontal: 16,
                marginTop: 12,
                marginBottom: 8,
                paddingHorizontal: 12,
                paddingVertical: 8,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: themeColors.borderColor,
                backgroundColor: themeColors.surfaceContainer,
                gap: 8,
              }}
            >
              <MaterialCommunityIcons name="magnify" size={20} color={themeColors.textMuted} />
              <TextInput
                placeholder={language === "BM" ? "Cari negeri..." : "Search state..."}
                placeholderTextColor={themeColors.textMuted}
                value={stateSearchQuery}
                onChangeText={setStateSearchQuery}
                style={{ flex: 1, fontSize: 14, color: themeColors.textPrimary }}
              />
              {stateSearchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setStateSearchQuery("")}>
                  <MaterialCommunityIcons name="close-circle" size={18} color={themeColors.textMuted} />
                </TouchableOpacity>
              )}
            </View>

            <ScrollView style={{ paddingHorizontal: 16, maxHeight: 360 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingVertical: 8 }}>
                {NEGERI_LIST
                  .filter((s) => s.toLowerCase().includes(stateSearchQuery.toLowerCase()))
                  .map((stateItem) => {
                    const isSelected = negeri === stateItem;
                    return (
                      <TouchableOpacity
                        key={stateItem}
                        activeOpacity={0.7}
                        onPress={() => {
                          setNegeri(stateItem);
                          setIsStateModalVisible(false);
                          setStateSearchQuery("");
                          Haptics.selectionAsync().catch(() => {});
                        }}
                        style={[
                          styles.stateOptionChip,
                          {
                            backgroundColor: isSelected ? themeColors.maroonPrimary : themeColors.surfaceContainer,
                            borderColor: isSelected ? themeColors.maroonPrimary : themeColors.borderColor,
                          },
                        ]}
                      >
                        <MaterialCommunityIcons
                          name="map-marker"
                          size={16}
                          color={isSelected ? "#FFFFFF" : themeColors.maroonPrimary}
                        />
                        <Text
                          style={{
                            color: isSelected ? "#FFFFFF" : themeColors.textPrimary,
                            fontWeight: "700",
                            fontSize: 14,
                          }}
                        >
                          {stateItem}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
              </View>
            </ScrollView>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.lg, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  progressContainer: { height: 4, width: "100%", overflow: "hidden" },
  progressBar: { height: "100%" },
  stepContainer: { width: "100%" },
  sectionTitle: { fontSize: 13, fontWeight: "700", marginTop: 24, marginBottom: 10, textTransform: "uppercase", letterSpacing: 0.5 },
  subLabel: { fontSize: 14, marginBottom: 4 },
  input: { borderWidth: 1, borderRadius: 10, paddingHorizontal: SPACING.md, height: 52, fontSize: 15, marginBottom: SPACING.sm },
  multilineInput: { height: 100, paddingTop: 12, textAlignVertical: "top" },
  priceInputContainer: { flexDirection: "row", alignItems: "center", borderWidth: 1, borderRadius: 10, paddingHorizontal: SPACING.md, height: 52, marginBottom: SPACING.sm },
  pricePrefix: { fontSize: 15, fontWeight: "700", marginRight: 8 },
  priceInput: { flex: 1, fontSize: 15, height: '100%' },
  gridChip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8, borderWidth: 1 },
  stepperContainer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderWidth: 1, borderRadius: 10, height: 52 },
  stepperBtn: { width: 52, height: 52, alignItems: "center", justifyContent: "center" },
  stepperValue: { fontSize: 20, fontWeight: "700" },
  gpsBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, height: 52, borderRadius: 10, borderWidth: 1, marginTop: 4, marginBottom: 8 },
  imageGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: SPACING.md },
  imageWrapper: { width: IMAGE_SIZE, height: IMAGE_SIZE, borderRadius: 8, overflow: "hidden" },
  gridImage: { width: "100%", height: "100%" },
  removeGridBtn: { position: "absolute", top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center", zIndex: 10 },
  coverBadge: { position: "absolute", top: 4, left: 4, flexDirection: "row", alignItems: "center", gap: 2, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: "#D97706", zIndex: 5 },
  coverBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "700" },
  setCoverBtn: { position: "absolute", top: 4, left: 4, paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 5 },
  setCoverBtnText: { color: "#FFF", fontSize: 9, fontWeight: "600" },
  reorderControls: { position: "absolute", bottom: 4, left: 4, right: 4, flexDirection: "row", justifyContent: "space-between", zIndex: 5 },
  reorderBtn: { width: 22, height: 22, borderRadius: 11, backgroundColor: "rgba(0,0,0,0.65)", alignItems: "center", justifyContent: "center" },
  uploadGridBtn: { borderWidth: 1, borderStyle: "dashed", alignItems: "center", justifyContent: "center" },
  docBtn: { flexDirection: "row", alignItems: "center", gap: 12, height: 52, borderWidth: 1, borderRadius: 10, paddingHorizontal: SPACING.md },
  docBtnText: { flex: 1, fontSize: 15, fontWeight: "600" },
  reviewContainer: { padding: SPACING.md, borderRadius: 10, borderWidth: 1 },
  submitBtn: { height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 24, marginBottom: 20 },
  submitBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  navRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 28, marginBottom: 24 },
  navBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' },
  locationChoiceBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
  },
  confirmedLocationCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    height: 52,
    marginBottom: SPACING.sm,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.65)",
    justifyContent: "flex-end",
  },
  bottomSheetContainer: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "85%",
    paddingTop: 12,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  sheetTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  sheetOptionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 8,
  },
  sheetOptionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  sheetOptionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sheetOptionDesc: {
    fontSize: 12,
    marginTop: 2,
  },
  stateOptionChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
  },
});
