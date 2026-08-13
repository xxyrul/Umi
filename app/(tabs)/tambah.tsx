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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import * as DocumentPicker from "expo-document-picker";
import { useRouter, useLocalSearchParams } from "expo-router";
import { firestore, auth } from "@/services/firebase";

import type { PeganganType, LotStatusType, PropertyLocation, PropertyListing } from "@/types/listing";
import { createPropertyListing, updatePropertyListing } from "@/services/storage";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

const NEGERI_LIST = [
  "Selangor",
  "Kuala Lumpur",
  "Johor",
  "Penang",
  "Perak",
  "Kedah",
  "Pahang",
  "Negeri Sembilan",
  "Melaka",
  "Kelantan",
  "Terengganu",
  "Sabah",
  "Sarawak",
  "Perlis",
  "Putrajaya",
];

const JENIS_LIST = [
  "Residential / Teres",
  "Condominium / Apartment",
  "Bungalow / Semi-D",
  "Commercial / Shoplot",
  "Factory / Warehouse",
  "Agricultural Land",
];

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
        140, // offset above keyboard
        true
      );
    }
  };

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  useEffect(() => {
    const showSub = Keyboard.addListener("keyboardDidShow", () => setKeyboardVisible(true));
    const hideSub = Keyboard.addListener("keyboardDidHide", () => setKeyboardVisible(false));
    return () => {
      showSub.remove();
      hideSub.remove();
    };
  }, []);

  // Listing Form States
  const [isFetchingLocation, setIsFetchingLocation] = useState(false);
  const [tajuk, setTajuk] = useState("");
  const [harga, setHarga] = useState("");
  const [alamat, setAlamat] = useState("");
  const [negeri, setNegeri] = useState("Selangor");
  const [jenis, setJenis] = useState("Residential / Teres");
  const [pegangan, setPegangan] = useState<PeganganType>("Freehold");
  const [lot, setLot] = useState<LotStatusType>("Bumi Lot");
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

  // Steppers
  const incrementBilikTidur = () => {
    const val = parseInt(bilikTidur) || 0;
    setBilikTidur(String(val + 1));
  };
  const decrementBilikTidur = () => {
    const val = parseInt(bilikTidur) || 0;
    if (val > 0) {
      setBilikTidur(String(val - 1));
    }
  };
  const incrementBilikAir = () => {
    const val = parseInt(bilikAir) || 0;
    setBilikAir(String(val + 1));
  };
  const decrementBilikAir = () => {
    const val = parseInt(bilikAir) || 0;
    if (val > 0) {
      setBilikAir(String(val - 1));
    }
  };

  // State selection auto-snap coordinates
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

  useEffect(() => {
    const timer = setTimeout(() => {
      const layout = stateLayouts.current[negeri];
      if (layout && stateScrollViewRef.current && stateContainerWidth > 0) {
        const targetX = layout.x - stateContainerWidth / 2 + layout.width / 2;
        stateScrollViewRef.current.scrollTo({
          x: Math.max(0, targetX),
          animated: true,
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [negeri, stateContainerWidth]);

  // Property Type selection auto-snap coordinates
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
    const timer = setTimeout(() => {
      const layout = propertyTypeLayouts.current[jenis];
      if (layout && propertyTypeScrollViewRef.current && stateContainerWidth > 0) {
        const targetX = layout.x - stateContainerWidth / 2 + layout.width / 2;
        propertyTypeScrollViewRef.current.scrollTo({
          x: Math.max(0, targetX),
          animated: true,
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [jenis, stateContainerWidth]);

  // Load Listing data if editing
  useEffect(() => {
    if (!editId) return;
    const loadListingForEdit = async () => {
      try {
        const doc = await firestore().collection("listings").doc(editId).get();
        if (doc.exists) {
          const data = doc.data() as PropertyListing;
          if (data.tajuk) setTajuk(data.tajuk);
          if (data.harga) setHarga(String(data.harga));
          if (data.alamat) setAlamat(data.alamat);
          if (data.negeri) setNegeri(data.negeri);
          if (data.jenis) setJenis(data.jenis);
          if (data.pegangan) setPegangan(data.pegangan as PeganganType);
          if (data.lot) setLot(data.lot as LotStatusType);
          if (data.bilikTidur) setBilikTidur(String(data.bilikTidur));
          if (data.bilikAir) setBilikAir(String(data.bilikAir));
          if (data.keluasan) setKeluasan(String(data.keluasan));
          if (data.namaOwner) setNamaOwner(data.namaOwner);
          if (data.telOwner) setTelOwner(data.telOwner);
          if (data.location) setLocation(data.location);
          const loadedImages: string[] = [];
          if (data.imageUrl && typeof data.imageUrl === "string") {
            loadedImages.push(data.imageUrl);
          }
          if (Array.isArray(data.images)) {
            data.images.forEach((img) => {
              if (img && typeof img === "string" && !loadedImages.includes(img)) {
                loadedImages.push(img);
              }
            });
          }
          if (Array.isArray(data.gambar)) {
            data.gambar.forEach((img) => {
              if (img && typeof img === "string" && !loadedImages.includes(img)) {
                loadedImages.push(img);
              }
            });
          }
          if (loadedImages.length > 0) {
            setGambar(loadedImages);
          }
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

  // Reverse Geocoding Helper
  const autoDetectAddressAndState = async (lat: number, lng: number) => {
    try {
      const addressList = await Location.reverseGeocodeAsync({
        latitude: lat,
        longitude: lng,
      });

      if (addressList && addressList.length > 0) {
        const place = addressList[0];
        const parts = [
          place.name || place.streetNumber,
          place.street,
          place.district || place.subregion,
          place.city,
        ].filter(Boolean);

        const detectedAddress = parts.join(", ");
        if (detectedAddress && !alamat.trim()) {
          setAlamat(detectedAddress);
        }

        if (place.region) {
          const matchedState = NEGERI_LIST.find(
            (s) => s.toLowerCase() === place.region?.toLowerCase()
          );
          if (matchedState) setNegeri(matchedState);
        }
      }
    } catch (err) {
      console.error("Reverse geocoding error:", err);
    }
  };

  // GPS Pinning
  const handlePinLocation = async () => {
    try {
      setIsFetchingLocation(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("locationPermission") || "Permission Denied", t("locationPermissionMsg") || "Please grant location access");
        setIsFetchingLocation(false);
        return;
      }

      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setLocation(coords);
      await autoDetectAddressAndState(coords.latitude, coords.longitude);
    } catch (err: any) {
      console.error("Location Pinning Error:", err);
      Alert.alert("Location Error", err?.message || "Failed to pin current GPS location.");
    } finally {
      setIsFetchingLocation(false);
    }
  };

  // Pick Images
  const handlePickImages = async () => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Permission Denied", "Library access permission is required to choose photos.");
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

  // Pick Document File
  const handlePickDocument = async (docType: "geran" | "spa" | "icOwner") => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "image/*"],
        copyToCacheDirectory: true,
      });

      if (!res.canceled && res.assets && res.assets.length > 0) {
        const file = res.assets[0];
        if (docType === "geran") {
          setGeran(file.uri);
          setGeranName(file.name);
        } else if (docType === "spa") {
          setSpa(file.uri);
          setSpaName(file.name);
        } else if (docType === "icOwner") {
          setIcOwner(file.uri);
          setIcOwnerName(file.name);
        }
      }
    } catch (error) {
      console.error("Document picking error:", error);
    }
  };

  // Clear Form State
  const resetForm = () => {
    setTajuk("");
    setHarga("");
    setAlamat("");
    setNegeri("Selangor");
    setJenis("Residential / Teres");
    setPegangan("Freehold");
    setLot("Bumi Lot");
    setBilikTidur("3");
    setBilikAir("2");
    setKeluasan("");
    setNamaOwner("");
    setTelOwner("");
    setLocation(null);
    setGambar([]);
    setGeran(null);
    setGeranName(null);
    setSpa(null);
    setSpaName(null);
    setIcOwner(null);
    setIcOwnerName(null);
    setNavLink("");
  };

  // Submit Listing
  const handleSubmitListing = async () => {
    if (!tajuk.trim()) {
      Alert.alert(t("incompleteInfo") || "Incomplete", t("enterTitle") || "Please enter title");
      return;
    }
    if (!harga.trim()) {
      Alert.alert(t("incompleteInfo") || "Incomplete", t("enterPrice") || "Please enter price");
      return;
    }

    try {
      setIsSubmitting(true);
      const listingData = {
        tajuk: tajuk.trim(),
        harga: harga.trim(),
        alamat: alamat.trim(),
        negeri,
        jenis,
        pegangan,
        lot,
        bilikTidur: parseInt(bilikTidur) || 0,
        bilikAir: parseInt(bilikAir) || 0,
        keluasan: keluasan.trim(),
        location,
        namaOwner: namaOwner.trim(),
        telOwner: telOwner.trim(),
        navLink: navLink.trim(),
        status: "Aktif" as const,
      };

      const files = {
        gambar: isEditMode ? (hasEditedImages ? gambar : undefined) : gambar,
        geran,
        spa,
        icOwner,
      };

      if (isEditMode && editId) {
        await updatePropertyListing(editId, listingData, files);

        Alert.alert(t("listingUpdated") || "Updated", `"${tajuk}"`, [
          {
            text: t("goToListing") || "OK",
            onPress: () => {
              resetForm();
              router.replace("/(tabs)/listings");
            },
          },
        ]);
      } else {
        await createPropertyListing(listingData, files);
        Alert.alert(t("listingSaved") || "Saved", `"${tajuk}"`, [
          {
            text: t("goToListing") || "OK",
            onPress: () => {
              resetForm();
              router.replace("/(tabs)/listings");
            },
          },
        ]);
      }
    } catch (error: any) {
      console.error("Submission Error:", error);
      Alert.alert(t("saveFailed") || "Failed", error?.message || t("errorTitle"));
    } finally {
      setIsSubmitting(false);
    }
  };

  const headerPaddingTop =
    Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6;

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: themeColors.canvasBackground }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={[styles.header, { paddingTop: headerPaddingTop, borderBottomColor: themeColors.borderColor }]}>
        <Text style={[styles.headerTitle, { color: themeColors.maroonPrimary }]}>
          {isEditMode ? t("editListing") : t("addListing")}
        </Text>
      </View>

      <ScrollView
        ref={scrollRef}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={true}
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 80 }}
      >
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("basicInfo")}</Text>

        <TextInput
          placeholder={t("titlePlaceholder")}
          placeholderTextColor={themeColors.textMuted}
          value={tajuk}
          onChangeText={setTajuk}
          onFocus={handleInputFocus}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder={t("pricePlaceholder")}
          placeholderTextColor={themeColors.textMuted}
          value={harga}
          onChangeText={setHarga}
          keyboardType="numeric"
          onFocus={handleInputFocus}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* State Selector */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Negeri" : "State"}</Text>
        <View onLayout={(e) => setStateContainerWidth(e.nativeEvent.layout.width)}>
          <ScrollView
            ref={stateScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {NEGERI_LIST.map((state) => {
              const active = negeri === state;
              return (
                <TouchableOpacity
                  key={state}
                  onLayout={(e) => {
                    stateLayouts.current[state] = {
                      x: e.nativeEvent.layout.x,
                      width: e.nativeEvent.layout.width,
                    };
                  }}
                  onPress={() => handleStateSelect(state)}
                  style={[
                    styles.gridChip,
                    { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                    active && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary },
                  ]}
                >
                  <Text style={{ color: active ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700" }}>
                    {state}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Property Types */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("propertyType") || "Jenis Hartanah"}</Text>
        <View>
          <ScrollView
            ref={propertyTypeScrollViewRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingBottom: 4 }}
          >
            {JENIS_LIST.map((type) => {
              const active = jenis === type;
              return (
                <TouchableOpacity
                  key={type}
                  onLayout={(e) => {
                    propertyTypeLayouts.current[type] = {
                      x: e.nativeEvent.layout.x,
                      width: e.nativeEvent.layout.width,
                    };
                  }}
                  onPress={() => handlePropertyTypeSelect(type)}
                  style={[
                    styles.gridChip,
                    { backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                    active && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary },
                  ]}
                >
                  <Text style={{ color: active ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700" }}>
                    {type}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* Tenure & Lot Status */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("specsTitle")}</Text>
        <View style={{ marginBottom: SPACING.md }}>
          <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("tenure")}</Text>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {["Freehold", "Leasehold"].map((ten) => (
              <TouchableOpacity
                key={ten}
                onPress={() => setPegangan(ten as any)}
                style={[
                  styles.gridChip,
                  { flex: 1, alignItems: "center", justifyContent: "center", height: 46, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                  pegangan === ten && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary },
                ]}
              >
                <Text style={{ color: pegangan === ten ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>
                  {ten}
                </Text>
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
                <TouchableOpacity
                  key={l}
                  onPress={() => setLot(label as any)}
                  style={[
                    styles.gridChip,
                    { flex: 1, alignItems: "center", justifyContent: "center", height: 46, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor },
                    lot === label && { borderColor: themeColors.maroonPrimary, backgroundColor: themeColors.maroonPrimary },
                  ]}
                >
                  <Text style={{ color: lot === label ? themeColors.canvasBackground : themeColors.textPrimary, fontWeight: "700", fontSize: 14 }}>
                    {l === "Bumi" ? (language === "BM" ? "Bumi Lot" : "Bumi Lot") : (language === "BM" ? "Lot Non-Bumi" : "Non-Bumi Lot")}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Bedrooms & Bathrooms Counter Steppers */}
        <View style={{ flexDirection: "row", gap: 12, marginBottom: SPACING.md }}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("bedrooms")}</Text>
            <View style={[styles.stepperContainer, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
              <TouchableOpacity onPress={decrementBilikTidur} style={styles.stepperBtn}>
                <MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: themeColors.textPrimary }]}>{bilikTidur}</Text>
              <TouchableOpacity onPress={incrementBilikTidur} style={styles.stepperBtn}>
                <MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flex: 1 }}>
            <Text style={[styles.subLabel, { color: themeColors.textSecondary, marginBottom: 8 }]}>{t("bathrooms")}</Text>
            <View style={[styles.stepperContainer, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
              <TouchableOpacity onPress={decrementBilikAir} style={styles.stepperBtn}>
                <MaterialCommunityIcons name="minus" size={24} color={themeColors.textPrimary} />
              </TouchableOpacity>
              <Text style={[styles.stepperValue, { color: themeColors.textPrimary }]}>{bilikAir}</Text>
              <TouchableOpacity onPress={incrementBilikAir} style={styles.stepperBtn}>
                <MaterialCommunityIcons name="plus" size={24} color={themeColors.textPrimary} />
              </TouchableOpacity>
            </View>
          </View>
        </View>

        <TextInput
          placeholder={language === "BM" ? "Keluasan (sqft)" : "Size (sqft)"}
          placeholderTextColor={themeColors.textMuted}
          value={keluasan}
          onChangeText={setKeluasan}
          keyboardType="default"
          onFocus={handleInputFocus}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Location & GPS */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Lokasi Hartanah" : "Property Location"}</Text>
        <TextInput
          placeholder={t("addressPlaceholder") || "Alamat penuh hartanah"}
          placeholderTextColor={themeColors.textMuted}
          value={alamat}
          onChangeText={setAlamat}
          multiline
          numberOfLines={3}
          onFocus={handleInputFocus}
          style={[styles.input, styles.multilineInput, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TouchableOpacity
          onPress={handlePinLocation}
          disabled={isFetchingLocation}
          style={[
            styles.gpsBtn,
            { borderColor: themeColors.maroonBorder, backgroundColor: themeColors.maroonLight },
          ]}
        >
          {isFetchingLocation ? (
            <ActivityIndicator color={themeColors.maroonPrimary} />
          ) : (
            <>
              <MaterialCommunityIcons name="map-marker-radius-outline" size={22} color={themeColors.maroonPrimary} />
              <Text style={{ color: themeColors.maroonPrimary, fontWeight: "700", fontSize: 15 }}>
                {location
                  ? (language === "BM" ? "Kemaskini Lokasi GPS" : "Update GPS Location")
                  : (language === "BM" ? "Pin Lokasi GPS Terkini" : "Pin Current GPS Location")}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {location && (
          <Text style={{ fontSize: 13, color: themeColors.textMuted, marginTop: 4, marginBottom: 12 }}>
            GPS: {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </Text>
        )}

        <TextInput
          placeholder={language === "BM" ? "Pautan Google Maps / Waze (Pilihan)" : "Google Maps / Waze Link (Optional)"}
          placeholderTextColor={themeColors.textMuted}
          value={navLink}
          onChangeText={setNavLink}
          onFocus={handleInputFocus}
          style={[styles.input, { marginTop: 8, color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Owner Details */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{t("ownerDetails")}</Text>
        <TextInput
          placeholder={t("ownerNamePlaceholder") || "Nama Owner"}
          placeholderTextColor={themeColors.textMuted}
          value={namaOwner}
          onChangeText={setNamaOwner}
          onFocus={handleInputFocus}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        <TextInput
          placeholder={t("ownerPhonePlaceholder") || "No. Telefon Owner"}
          placeholderTextColor={themeColors.textMuted}
          value={telOwner}
          onChangeText={setTelOwner}
          keyboardType="phone-pad"
          onFocus={handleInputFocus}
          style={[styles.input, { color: themeColors.textPrimary, backgroundColor: themeColors.cardBackground, borderColor: themeColors.borderColor }]}
        />

        {/* Images & Docs */}
        <Text style={[styles.sectionTitle, { color: themeColors.maroonPrimary }]}>{language === "BM" ? "Media & Dokumen" : "Media & Documents"}</Text>

        <TouchableOpacity onPress={handlePickImages} style={[styles.uploadBtn, { borderColor: themeColors.borderColor }]}>
          <MaterialCommunityIcons name="camera-plus-outline" size={26} color={themeColors.textMuted} />
          <Text style={[styles.uploadBtnText, { color: themeColors.textMuted }]}>
            {language === "BM" ? "Pilih Gambar Hartanah" : "Choose Property Images"}
          </Text>
        </TouchableOpacity>

        {/* Thumbnail Preview list */}
        {gambar.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, marginVertical: SPACING.md }}>
            {gambar.map((uri, idx) => (
              <View key={idx} style={{ position: "relative" }}>
                <Image source={{ uri }} style={styles.thumbnail} />
                <TouchableOpacity onPress={() => handleRemoveImage(idx)} style={styles.removeThumbnailBtn}>
                  <MaterialCommunityIcons name="close" size={16} color="#FFF" />
                </TouchableOpacity>
              </View>
            ))}
          </ScrollView>
        )}

        {/* Private Vault Docs */}
        <View style={{ gap: SPACING.sm, marginTop: 10 }}>
          {/* Geran */}
          <TouchableOpacity onPress={() => handlePickDocument("geran")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
            <MaterialCommunityIcons name="file-document-outline" size={22} color={geran ? themeColors.maroonPrimary : themeColors.textMuted} />
            <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {geranName ? `${t("geranCopy")}: ${geranName}` : t("geranCopy")}
            </Text>
          </TouchableOpacity>

          {/* SPA */}
          <TouchableOpacity onPress={() => handlePickDocument("spa")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
            <MaterialCommunityIcons name="file-sign" size={22} color={spa ? themeColors.maroonPrimary : themeColors.textMuted} />
            <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {spaName ? `${t("spaCopy")}: ${spaName}` : t("spaCopy")}
            </Text>
          </TouchableOpacity>

          {/* IC Owner */}
          <TouchableOpacity onPress={() => handlePickDocument("icOwner")} style={[styles.docBtn, { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground }]}>
            <MaterialCommunityIcons name="card-account-details-outline" size={22} color={icOwner ? themeColors.maroonPrimary : themeColors.textMuted} />
            <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
              {icOwnerName ? `${t("ownerIcCopyFull")}: ${icOwnerName}` : t("ownerIcCopyFull")}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Submit Button */}
        <TouchableOpacity
          onPress={handleSubmitListing}
          disabled={isSubmitting}
          style={[styles.submitBtn, { backgroundColor: themeColors.maroonPrimary }]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={[styles.submitBtnText, { color: themeColors.canvasBackground }]}>
              {isEditMode ? (language === "BM" ? "Simpan Perubahan" : "Save Changes") : (language === "BM" ? "Tambah Listing" : "Create Listing")}
            </Text>
          )}
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: SPACING.lg,
    paddingBottom: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  subLabel: {
    fontSize: 14,
    marginBottom: 4,
  },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
    height: 52,
    fontSize: 15,
    marginBottom: SPACING.sm,
  },
  multilineInput: {
    height: 100,
    paddingTop: 12,
    textAlignVertical: "top",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: SPACING.sm,
  },
  gridChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: 10,
    height: 52,
  },
  stepperBtn: {
    width: 52,
    height: 52,
    alignItems: "center",
    justifyContent: "center",
  },
  stepperValue: {
    fontSize: 20,
    fontWeight: "700",
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 52,
    borderRadius: 10,
    borderWidth: 1,
    marginTop: 4,
    marginBottom: 8,
  },
  uploadBtn: {
    height: 100,
    borderWidth: 1,
    borderStyle: "dashed",
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginBottom: SPACING.sm,
  },
  uploadBtnText: {
    fontSize: 15,
    fontWeight: "600",
  },
  thumbnail: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  removeThumbnailBtn: {
    position: "absolute",
    top: -4,
    right: -4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    height: 52,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: SPACING.md,
  },
  docBtnText: {
    flex: 1,
    fontSize: 15,
    fontWeight: "600",
  },
  submitBtn: {
    height: 52,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
  },
  submitBtnText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },
});
