import React from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useAppSettings } from "@/context/AppSettingsContext";

interface PermissionExplanationModalProps {
  isVisible: boolean;
  permissionType: "calendar" | "notifications" | "location" | "mediaLibrary";
  onClose: () => void;
  onConfirm: () => void;
}

export function PermissionExplanationModal({
  isVisible,
  permissionType,
  onClose,
  onConfirm,
}: PermissionExplanationModalProps) {
  const { themeColors, language } = useAppSettings();
  const isBM = language === "BM";

  const getDetails = () => {
    switch (permissionType) {
      case "calendar":
        return {
          icon: "calendar-month",
          color: "#4F46E5",
          title: isBM ? "Akses Kalendar Diperlukan" : "Calendar Access Required",
          body: isBM
            ? "artha memerlukan akses Kalendar untuk menyelaraskan janji temu harta tanah pelanggan anda dan menghantar peringatan tepat pada masanya terus ke kalendar peranti anda."
            : "artha needs Calendar access to sync your client property viewings and send you timely reminders directly to your device calendar.",
        };
      case "notifications":
        return {
          icon: "bell-ring-outline",
          color: "#10B981",
          title: isBM ? "Akses Notifikasi Diperlukan" : "Notification Access Required",
          body: isBM
            ? "artha memerlukan akses Notifikasi untuk menghantar makluman segera mengenai janji temu harta tanah yang akan datang dan tarikh akhir tugasan kes."
            : "artha needs Notification access to send you instant alerts for upcoming property viewings and case milestone deadlines.",
        };
      case "location":
        return {
          icon: "map-marker-radius",
          color: "#EF4444",
          title: isBM ? "Akses Lokasi Diperlukan" : "Location Access Required",
          body: isBM
            ? "artha memerlukan akses Lokasi untuk mengepin lokasi hartanah secara automatik pada peta dan mendapatkan alamat geokod secara langsung semasa menambah listing."
            : "artha needs Location access to automatically pin property locations on the map and calculate address information during creation.",
        };
      case "mediaLibrary":
        return {
          icon: "image-multiple-outline",
          color: "#F59E0B",
          title: isBM ? "Akses Galeri & Media Diperlukan" : "Gallery & Media Access Required",
          body: isBM
            ? "artha memerlukan akses Galeri untuk membolehkan anda memuat naik gambar hartanah dan dokumen penting ke dalam peti besi dokumen (Document Vault) transaksi kes."
            : "artha needs Media Library access to let you upload property listings photos and store case transaction documents inside the Document Vault.",
        };
    }
  };

  const details = getDetails();

  return (
    <Modal
      visible={isVisible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <View style={[styles.card, { backgroundColor: themeColors.cardBackground }]}>
          {/* Header Icon */}
          <View style={[styles.iconContainer, { backgroundColor: `${details.color}15` }]}>
            <MaterialCommunityIcons name={details.icon as any} size={48} color={details.color} />
          </View>

          {/* Title */}
          <Text style={[styles.title, { color: themeColors.textPrimary }]}>
            {details.title}
          </Text>

          {/* Description */}
          <Text style={[styles.body, { color: themeColors.textSecondary }]}>
            {details.body}
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onClose}
              style={[styles.btnCancel, { backgroundColor: themeColors.surfaceContainer }]}
            >
              <Text style={[styles.btnTextCancel, { color: themeColors.textSecondary }]}>
                {isBM ? "Nanti Dahulu" : "Later"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              activeOpacity={0.8}
              onPress={onConfirm}
              style={[styles.btnConfirm, { backgroundColor: themeColors.maroonPrimary }]}
            >
              <Text style={styles.btnTextConfirm}>
                {isBM ? "Teruskan" : "Grant Permissions"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    borderRadius: 24,
    padding: 24,
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 6,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 12,
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 24,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
    width: "100%",
  },
  btnCancel: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnConfirm: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnTextCancel: {
    fontSize: 14,
    fontWeight: "700",
  },
  btnTextConfirm: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFFFFF",
  },
});
