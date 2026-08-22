import React from "react";
import {
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Platform,
  StatusBar,
  StyleSheet,
  Dimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth } = Dimensions.get("window");

interface HeroCarouselProps {
  hasImages: boolean;
  allImages: string[];
  activeImageIndex: number;
  heroGalleryRef: React.RefObject<FlatList | null>;
  themeColors: any;
  isCreator: boolean;
  t: (key: any) => string;
  onGoToImage: (index: number) => void;
  onOpenGallery: () => void;
  onBack: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare: () => void;
  onMomentumScrollEnd: (e: any) => void;
}

export function HeroCarousel({
  hasImages,
  allImages,
  activeImageIndex,
  heroGalleryRef,
  themeColors,
  isCreator,
  t,
  onGoToImage,
  onOpenGallery,
  onBack,
  onEdit,
  onDelete,
  onShare,
  onMomentumScrollEnd,
}: HeroCarouselProps) {
  const insets = useSafeAreaInsets();
  const topInset = Math.max(insets.top, Platform.OS === "android" ? (StatusBar.currentHeight || 24) : 16) + 6;

  return (
    <View style={[styles.heroContainer, { backgroundColor: themeColors.maroonLight }]}>
      {hasImages ? (
        <>
          <FlatList
            ref={heroGalleryRef as any}
            data={allImages}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            getItemLayout={(_, index) => ({
              length: screenWidth,
              offset: screenWidth * index,
              index,
            })}
            keyExtractor={(_, idx) => `hero-${idx}`}
            initialNumToRender={2}
            maxToRenderPerBatch={2}
            windowSize={3}
            removeClippedSubviews={Platform.OS === "android"}
            onMomentumScrollEnd={onMomentumScrollEnd}
            renderItem={({ item: imgUri }) => (
              <TouchableOpacity
                activeOpacity={0.9}
                onPress={onOpenGallery}
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
              <Text style={styles.slideHintText}>
                {activeImageIndex + 1} / {allImages.length}
              </Text>
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
        style={[styles.floatingBackButton, { top: topInset }]}
        onPress={onBack}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Kembali / Back"
      >
        <MaterialCommunityIcons name="arrow-left" size={22} color="#FFFFFF" />
      </TouchableOpacity>

      {/* Floating Delete Button */}
      {isCreator && onDelete && (
        <TouchableOpacity
          style={[styles.floatingShareButton, { right: 112, top: topInset }]}
          onPress={onDelete}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Padam Listing / Delete Listing"
        >
          <MaterialCommunityIcons name="delete-outline" size={20} color="#FF6B6B" />
        </TouchableOpacity>
      )}

      {/* Floating Edit Button */}
      {isCreator && onEdit && (
        <TouchableOpacity
          style={[styles.floatingShareButton, { right: 64, top: topInset }]}
          onPress={onEdit}
          accessible={true}
          accessibilityRole="button"
          accessibilityLabel="Kemaskini Listing / Edit Listing"
        >
          <MaterialCommunityIcons name="pencil-outline" size={20} color="#FFFFFF" />
        </TouchableOpacity>
      )}

      {/* Floating Share Button */}
      <TouchableOpacity
        style={[styles.floatingShareButton, { top: topInset }]}
        onPress={onShare}
        accessible={true}
        accessibilityRole="button"
        accessibilityLabel="Kongsi Listing / Share Listing"
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
              onPress={() => onGoToImage(idx)}
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
  );
}

const styles = StyleSheet.create({
  heroContainer: {
    position: "relative",
    width: "100%",
    height: 240,
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
  },
  heroPlaceholderText: {
    marginTop: 8,
    fontSize: 13,
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
  galleryThumb: {
    width: "100%",
    height: "100%",
  },
});
