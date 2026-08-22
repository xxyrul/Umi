import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  StyleSheet,
} from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import Animated, {
  SlideInRight,
  SlideOutLeft,
  FadeInDown,
} from "react-native-reanimated";
import { useAppSettings } from "@/context/AppSettingsContext";
import { SPACING } from "@/constants/theme";

interface MediaDocsStepProps {
  gambar: string[];
  handlePickImages: () => void;
  handleSetCoverImage: (idx: number) => void;
  handleRemoveImage: (idx: number) => void;
  handleMoveImage: (idx: number, dir: "left" | "right") => void;
  handlePickDocument: (type: "geran" | "spa" | "icOwner") => void;
  geran: string | null;
  geranName: string | null;
  spa: string | null;
  spaName: string | null;
  icOwner: string | null;
  icOwnerName: string | null;
  tajuk: string;
  harga: string;
  negeri: string;
  handleSubmitListing: () => void;
  isSubmitting: boolean;
  isEditMode: boolean;
}

export function MediaDocsStep({
  gambar,
  handlePickImages,
  handleSetCoverImage,
  handleRemoveImage,
  handleMoveImage,
  handlePickDocument,
  geran,
  geranName,
  spa,
  spaName,
  icOwner,
  icOwnerName,
  tajuk,
  harga,
  negeri,
  handleSubmitListing,
  isSubmitting,
  isEditMode,
}: MediaDocsStepProps) {
  const { themeColors, language, t } = useAppSettings();

  return (
    <Animated.View entering={SlideInRight} exiting={SlideOutLeft} style={styles.stepContainer}>
      <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>
        {language === "BM" ? "Media & Dokumen" : "Media & Documents"}
      </Text>

      {/* Image Grid with Reordering and Cover Badge */}
      <View style={styles.imageGrid}>
        {gambar.map((uri, idx) => (
          <Animated.View entering={FadeInDown} key={idx} style={styles.imageWrapper}>
            <Image source={{ uri }} style={styles.gridImage} resizeMode="cover" />
            {idx === 0 ? (
              <View style={styles.coverBadge}>
                <MaterialCommunityIcons name="star" size={9} color="#FFF" />
                <Text style={styles.coverBadgeText} numberOfLines={1}>
                  Cover
                </Text>
              </View>
            ) : (
              <TouchableOpacity
                onPress={() => handleSetCoverImage(idx)}
                style={styles.setCoverBtn}
                hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
              >
                <Text style={styles.setCoverBtnText} numberOfLines={1}>
                  Cover
                </Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              onPress={() => handleRemoveImage(idx)}
              style={styles.removeGridBtn}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons name="close" size={12} color="#FFF" />
            </TouchableOpacity>
            {gambar.length > 1 && (
              <View style={styles.reorderControls}>
                {idx > 0 && (
                  <TouchableOpacity
                    onPress={() => handleMoveImage(idx, "left")}
                    style={styles.reorderBtn}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons name="chevron-left" size={13} color="#FFF" />
                  </TouchableOpacity>
                )}
                {idx < gambar.length - 1 && (
                  <TouchableOpacity
                    onPress={() => handleMoveImage(idx, "right")}
                    style={[styles.reorderBtn, { marginLeft: "auto" }]}
                    hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                  >
                    <MaterialCommunityIcons name="chevron-right" size={13} color="#FFF" />
                  </TouchableOpacity>
                )}
              </View>
            )}
          </Animated.View>
        ))}
        <TouchableOpacity
          onPress={handlePickImages}
          style={[
            styles.imageWrapper,
            styles.uploadGridBtn,
            { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
          ]}
          activeOpacity={0.7}
        >
          <MaterialCommunityIcons name="camera-plus-outline" size={24} color={themeColors.textMuted} />
          <Text style={{ fontSize: 11, fontWeight: "600", color: themeColors.textMuted, marginTop: 4 }}>
            + Foto
          </Text>
        </TouchableOpacity>
      </View>

      {/* Private Confidential Documents Vault */}
      <View style={{ gap: SPACING.sm, marginTop: 10 }}>
        <TouchableOpacity
          onPress={() => handlePickDocument("geran")}
          style={[
            styles.docBtn,
            { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
          ]}
        >
          <MaterialCommunityIcons
            name="file-document-outline"
            size={22}
            color={geran ? themeColors.maroonPrimary : themeColors.textMuted}
          />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {geranName ? `${t("geranCopy")}: ${geranName}` : t("geranCopy")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handlePickDocument("spa")}
          style={[
            styles.docBtn,
            { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
          ]}
        >
          <MaterialCommunityIcons
            name="file-sign"
            size={22}
            color={spa ? themeColors.maroonPrimary : themeColors.textMuted}
          />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {spaName ? `${t("spaCopy")}: ${spaName}` : t("spaCopy")}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => handlePickDocument("icOwner")}
          style={[
            styles.docBtn,
            { borderColor: themeColors.borderColor, backgroundColor: themeColors.cardBackground },
          ]}
        >
          <MaterialCommunityIcons
            name="card-account-details-outline"
            size={22}
            color={icOwner ? themeColors.maroonPrimary : themeColors.textMuted}
          />
          <Text style={[styles.docBtnText, { color: themeColors.textPrimary }]} numberOfLines={1}>
            {icOwnerName ? `${t("ownerIcCopyFull")}: ${icOwnerName}` : t("ownerIcCopyFull")}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Review Summary */}
      <View
        style={[
          styles.reviewContainer,
          {
            backgroundColor: themeColors.cardBackground,
            borderColor: themeColors.borderColor,
            marginTop: SPACING.lg,
          },
        ]}
      >
        <Text style={{ fontWeight: "700", color: themeColors.textPrimary, marginBottom: 8 }}>
          {language === "BM" ? "Ringkasan Listing" : "Review Listing"}
        </Text>
        <Text style={{ color: themeColors.textSecondary }} numberOfLines={2}>
          Title: {tajuk || "-"}
        </Text>
        <Text style={{ color: themeColors.textSecondary }}>
          Price: RM{harga ? Number(harga).toLocaleString() : "-"}
        </Text>
        <Text style={{ color: themeColors.textSecondary }}>State: {negeri}</Text>
        <Text style={{ color: themeColors.textSecondary }}>Images: {gambar.length}</Text>
        <Text style={{ color: themeColors.textSecondary }}>
          Documents: {[geran, spa, icOwner].filter(Boolean).length}
        </Text>
      </View>

      {/* Submit CTA */}
      <TouchableOpacity
        onPress={handleSubmitListing}
        disabled={isSubmitting}
        style={[styles.submitBtn, { backgroundColor: themeColors.maroonPrimary }]}
      >
        {isSubmitting ? (
          <ActivityIndicator color="#FFF" />
        ) : (
          <Text style={[styles.submitBtnText, { color: "#FFFFFF" }]}>
            {isEditMode
              ? language === "BM"
                ? "Simpan Perubahan"
                : "Save Changes"
              : language === "BM"
              ? "Tambah Listing"
              : "Create Listing"}
          </Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stepContainer: {
    width: "100%",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    marginBottom: 8,
    marginTop: 6,
  },
  imageGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: SPACING.md,
  },
  imageWrapper: {
    width: 96,
    height: 96,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  gridImage: {
    width: "100%",
    height: "100%",
  },
  uploadGridBtn: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    justifyContent: "center",
    alignItems: "center",
  },
  coverBadge: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "#D97706",
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  coverBadgeText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  setCoverBtn: {
    position: "absolute",
    top: 4,
    left: 4,
    backgroundColor: "rgba(0, 0, 0, 0.55)",
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  setCoverBtnText: {
    color: "#FFF",
    fontSize: 8,
    fontWeight: "700",
  },
  removeGridBtn: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 10,
    width: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  reorderControls: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    flexDirection: "row",
    justifyContent: "space-between",
  },
  reorderBtn: {
    backgroundColor: "rgba(0, 0, 0, 0.6)",
    borderRadius: 8,
    width: 20,
    height: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  docBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
  },
  docBtnText: {
    fontSize: 14,
    fontWeight: "600",
    flex: 1,
  },
  reviewContainer: {
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    gap: 6,
  },
  submitBtn: {
    marginTop: SPACING.lg,
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnText: {
    fontSize: 16,
    fontWeight: "800",
  },
});
