import React from "react";
import {
  View,
  Text,
  Modal,
  StatusBar,
  TouchableOpacity,
  FlatList,
  Platform,
  Dimensions,
} from "react-native";
import { Image as ExpoImage } from "expo-image";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

interface FullscreenGalleryProps {
  visible: boolean;
  onClose: () => void;
  images: string[];
  activeImageIndex: number;
  setActiveImageIndex: (idx: number) => void;
  fullScreenGalleryRef: React.RefObject<FlatList | null>;
  onSyncHeroIndex?: (idx: number) => void;
}

export function FullscreenGallery({
  visible,
  onClose,
  images,
  activeImageIndex,
  setActiveImageIndex,
  fullScreenGalleryRef,
  onSyncHeroIndex,
}: FullscreenGalleryProps) {
  const insets = useSafeAreaInsets();

  if (!visible || images.length === 0) return null;

  return (
    <Modal
      visible={visible}
      transparent={false}
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
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
              {activeImageIndex + 1} / {images.length}
            </Text>
          </View>

          <TouchableOpacity
            onPress={onClose}
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

        {/* High Performance Virtualized Fullscreen Swiper */}
        <FlatList
          ref={fullScreenGalleryRef as any}
          data={images}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={Math.min(activeImageIndex, images.length - 1)}
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
            if (onSyncHeroIndex) {
              onSyncHeroIndex(idx);
            }
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
  );
}
