import React, { useState, useEffect, useRef } from "react";
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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import * as Haptics from "expo-haptics";
import { useRouter, useLocalSearchParams } from "expo-router";
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

  const stateLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});
  const stateScrollViewRef = useRef<ScrollView>(null);
  const [stateContainerWidth, setStateContainerWidth] = useState(0);

  const handleStateSelect = (state: string) => {
    setNegeri(state);
    const layout = stateLayouts.current[state];
    if (layout && stateScrollViewRef.current && stateContainerWidth > 0) {
      const targetX = layout.x - stateContainerWidth / 2 + layout.width / 2;
      stateScrollViewRef.current.scrollTo({
        x: Math.max(0, targetX),
        animated: true,
      });
    }
  };

  const propertyTypeLayouts = useRef<{ [key: string]: { x: number; width: number } }>({});
  const propertyTypeScrollViewRef = useRef<ScrollView>(null);

  const handlePropertyTypeSelect = (type: string) => {
    setJenis(type);
    const layout = propertyTypeLayouts.current[type];
    if (layout && propertyTypeScrollViewRef.current && stateContainerWidth > 0) {
      const targetX = layout.x - stateContainerWidth / 2 + layout.width / 2;
      propertyTypeScrollViewRef.current.scrollTo({
        x: Math.max(0, targetX),
        animated: true,
      });
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

  const autoDetectAddressAndState = async (lat: number, lng: number) => {
    try {
      const addressList = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (addressList && addressList.length > 0) {
        const place = addressList[0];
        const parts = [
          place.name || place.streetNumber, place.street, place.district || place.subregion, place.city,
        ].filter(Boolean);
        const detectedAddress = parts.join(", ");
        if (detectedAddress && !alamat.trim()) setAlamat(detectedAddress);
        if (place.region) {
          const matchedState = NEGERI_LIST.find((s) => s.toLowerCase() === place.region?.toLowerCase());
          if (matchedState) setNegeri(matchedState);
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
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
      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("basicInfo")}</Text>
      <TextInput placeholder={t("titlePlaceholder")} placeholderTextColor={themeColors.textMuted} value={tajuk} onChangeText={setTajuk} onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />

      <View style={[styles.priceInputContainer, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}>
        <Text style={[styles.pricePrefix, { color: themeColors.textPrimary }]}>RM</Text>
        <TextInput placeholder={t("pricePlaceholder")} placeholderTextColor={themeColors.textMuted} value={harga} onChangeText={setHarga} keyboardType="numeric" onFocus={handleInputFocus} style={[styles.priceInput, { color: themeColors.textPrimary }]} />
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Negeri" : "State"}</Text>
      <View onLayout={(e) => setStateContainerWidth(e.nativeEvent.layout.width)}>
        <ScrollView ref={stateScrollViewRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {NEGERI_LIST.map((state) => {
            const active = negeri === state;
            return (
              <TouchableOpacity key={state} onLayout={(e) => { stateLayouts.current[state] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; }} onPress={() => handleStateSelect(state)} style={[styles.gridChip, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, active && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={{ color: active ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700" }}>{state}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("propertyType") || "Jenis Hartanah"}</Text>
      <View>
        <ScrollView ref={propertyTypeScrollViewRef} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 4 }}>
          {JENIS_LIST.map((type) => {
            const active = jenis === type;
            return (
              <TouchableOpacity key={type} onLayout={(e) => { propertyTypeLayouts.current[type] = { x: e.nativeEvent.layout.x, width: e.nativeEvent.layout.width }; }} onPress={() => handlePropertyTypeSelect(type)} style={[styles.gridChip, { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, active && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={{ color: active ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700" }}>{type}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("specsTitle")}</Text>
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

      <View style={{ marginBottom: SPACING.md }}>
        <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("lotStatus")}</Text>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {["Bumi", "Non-Bumi"].map((l) => {
            const label = l === "Bumi" ? "Bumi Lot" : "Non-Bumi Lot";
            return (
              <TouchableOpacity key={l} onPress={() => setLot(label as any)} style={[styles.gridChip, { flex: 1, alignItems: "center", justifyContent: "center", height: 46, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }, lot === label && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary }]}>
                <Text style={{ color: lot === label ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>{l === "Bumi" ? (language === "BM" ? "Bumi Lot" : "Bumi Lot") : (language === "BM" ? "Lot Non-Bumi" : "Non-Bumi Lot")}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

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
      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Lokasi Hartanah" : "Property Location"}</Text>
      <TextInput placeholder={t("addressPlaceholder") || "Alamat penuh hartanah"} placeholderTextColor={themeColors.textMuted} value={alamat} onChangeText={setAlamat} multiline numberOfLines={3} onFocus={handleInputFocus} style={[styles.input, styles.multilineInput, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />

      <TouchableOpacity onPress={handlePinLocation} disabled={isFetchingLocation} style={[styles.gpsBtn, { borderColor: themeColors.maroonBorder, backgroundColor: themeColors.maroonLight }]}>
        {isFetchingLocation ? <ActivityIndicator color={themeColors.maroonPrimary} /> : <>
          <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={themeColors.maroonPrimary} />
          <Text style={{ color: themeColors.maroonPrimary, fontWeight: "700", fontSize: 15 }}>{location ? (language === "BM" ? "Kemaskini Lokasi GPS" : "Update GPS Location") : (language === "BM" ? "Pin Lokasi GPS Terkini" : "Pin Current GPS Location")}</Text>
        </>}
      </TouchableOpacity>
      {location && <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 4, marginBottom: 12 }}>GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}</Text>}

      <TextInput placeholder={language === "BM" ? "Pautan Google Maps / Waze (Pilihan)" : "Google Maps / Waze Link (Optional)"} placeholderTextColor={themeColors.textMuted} value={navLink} onChangeText={setNavLink} onFocus={handleInputFocus} style={[styles.input, { marginTop: 8, color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />

      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Status Listing" : "Listing Status"}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
        {([{ value: "Aktif", label: language === "BM" ? "Aktif" : "Active", icon: "check-circle", color: "#10B981" }, { value: "Booking", label: "Booking", icon: "clock-outline", color: "#F59E0B" }, { value: "Sold", label: language === "BM" ? "Terjual" : "Sold", icon: "home-check", color: "#3B82F6" }, { value: "Draft", label: "Draft", icon: "pencil-outline", color: "#6B7280" }] as const).map((opt) => {
          const isActive = listingStatus === opt.value;
          return (
            <TouchableOpacity key={opt.value} onPress={() => setListingStatus(opt.value)} style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 10, borderWidth: 2, flex: 1, minWidth: "45%", justifyContent: "center", borderColor: isActive ? opt.color : themeColors.borderColor, backgroundColor: isActive ? `${opt.color}18` : themeColors.cardBackground }]}>
              <MaterialCommunityIcons name={opt.icon as any} size={18} color={isActive ? opt.color : themeColors.textMuted} />
              <Text style={{ fontWeight: "700", fontSize: 14, color: isActive ? opt.color : themeColors.textSecondary }}>{opt.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("ownerDetails")}</Text>
      <TextInput placeholder={t("ownerNamePlaceholder") || "Nama Ejen"} placeholderTextColor={themeColors.textMuted} value={namaOwner} onChangeText={setNamaOwner} onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />
      <TextInput placeholder={t("ownerPhonePlaceholder") || "No. Telefon Ejen"} placeholderTextColor={themeColors.textMuted} value={telOwner} onChangeText={setTelOwner} keyboardType="phone-pad" onFocus={handleInputFocus} style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]} />
    </Animated.View>
  );

  const renderStep3 = () => (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Media & Dokumen" : "Media & Documents"}</Text>

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
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace("/(tabs)/listings")} style={{ padding: 6, borderRadius: 20, backgroundColor: themeColors.surfaceContainer, marginRight: 12 }}>
          <MaterialCommunityIcons name="arrow-left" size={22} color={themeColors.textPrimary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary, flex: 1 }]}>{isEditMode ? t("editListing") : t("addListing")}</Text>
      </View>

      {/* Animated Step Indicator */}
      <View style={[styles.progressContainer, { backgroundColor: themeColors.borderColor }]}>
        <Animated.View style={[styles.progressBar, { backgroundColor: themeColors.maroonPrimary }, progressStyle]} />
      </View>

      <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" automaticallyAdjustKeyboardInsets={true} contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}>
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
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: SPACING.lg, paddingBottom: 12, borderBottomWidth: 1 },
  headerTitle: { fontSize: 22, fontWeight: "700" },
  progressContainer: { height: 4, width: "100%", overflow: "hidden" },
  progressBar: { height: "100%" },
  stepContainer: { width: "100%" },
  sectionTitle: { fontSize: 15, fontWeight: "700", marginTop: 20, marginBottom: 10, textTransform: "uppercase" },
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
  submitBtn: { height: 52, borderRadius: 10, alignItems: "center", justifyContent: "center", marginTop: 24 },
  submitBtnText: { color: "#FFF", fontWeight: "700", fontSize: 16 },
  navRow: { flexDirection: "row", justifyContent: "space-between", marginTop: 24 },
  navBtn: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 10, borderWidth: 1, borderColor: 'transparent' }
});
