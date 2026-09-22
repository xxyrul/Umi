import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../theme/app_colors.dart';
import 'app_toast.dart';

enum AppPermissionType {
  location,
  camera,
  notifications,
  biometrics,
}

class PermissionRationaleSheet extends StatelessWidget {
  final AppPermissionType type;
  final bool isBM;

  const PermissionRationaleSheet({
    super.key,
    required this.type,
    required this.isBM,
  });

  static Future<bool> requestLocationPermission(BuildContext context, bool isBM) async {
    bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
    if (!serviceEnabled) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Sila aktifkan perkhidmatan GPS peranti anda.' : 'Please enable GPS location services on your device.',
        );
      }
      return false;
    }

    LocationPermission permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
      return true;
    }

    if (permission == LocationPermission.deniedForever) {
      if (context.mounted) {
        _showSettingsPrompt(context, isBM);
      }
      return false;
    }

    // Show rationale sheet first before triggering system prompt
    if (!context.mounted) return false;
    final proceed = await showModalBottomSheet<bool>(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => PermissionRationaleSheet(type: AppPermissionType.location, isBM: isBM),
    );

    if (proceed != true) return false;

    permission = await Geolocator.requestPermission();
    if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
      return true;
    }

    if (permission == LocationPermission.deniedForever && context.mounted) {
      _showSettingsPrompt(context, isBM);
    }
    return false;
  }

  static void _showSettingsPrompt(BuildContext context, bool isBM) {
    showDialog(
      context: context,
      useRootNavigator: true,
      builder: (ctx) => AlertDialog(
        title: Text(isBM ? 'Kebenaran GPS Diperlukan' : 'GPS Permission Required'),
        content: Text(
          isBM
              ? 'Kebenaran lokasi telah dinyahdayakan secara kekal. Sila benarkan akses lokasi dalam Tetapan Aplikasi untuk menggunakan fungsi GPS.'
              : 'Location permission is permanently denied. Please enable location access in App Settings to use GPS features.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              Geolocator.openAppSettings();
            },
            child: Text(isBM ? 'Buka Tetapan' : 'Open Settings'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final bottomPadding = MediaQuery.of(context).padding.bottom;
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;

    return Container(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + bottomPadding + bottomInset),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.textDim.withOpacity(0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 20),

          // Icon Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.maroonPrimary.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  _getIcon(),
                  color: colors.maroonPrimary,
                  size: 28,
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _getTitle(),
                      style: TextStyle(
                        fontSize: 17,
                        fontWeight: FontWeight.w800,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isBM ? 'Penjelasan & Privasi Pengguna' : 'Purpose & Privacy Rationale',
                      style: TextStyle(fontSize: 12, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),

          const SizedBox(height: 20),

          // Explanation Body
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isBM ? 'MENGAPA ARTHA MEMERLUKAN KEBENARAN INI?' : 'WHY DOES ARTHA NEED THIS PERMISSION?',
                  style: TextStyle(
                    fontSize: 10.5,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 0.5,
                    color: colors.maroonPrimary,
                  ),
                ),
                const SizedBox(height: 10),
                ..._getRationalePoints().map((point) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('• ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 14)),
                        Expanded(
                          child: Text(
                            point,
                            style: TextStyle(fontSize: 12.5, color: colors.textSecondary, height: 1.4),
                          ),
                        ),
                      ],
                    ),
                  );
                }),
              ],
            ),
          ),

          const SizedBox(height: 16),

          // Privacy Guarantee Notice
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.security_rounded, color: Color(0xFF10B981), size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isBM
                        ? 'Privasi Dijamin: Lokasi anda hanya dibaca semasa aplikasi aktif dan tidak pernah dijejak di latar belakang (background).'
                        : 'Privacy Guaranteed: Your location is only read while using the app and is never tracked in the background.',
                    style: TextStyle(fontSize: 11, color: colors.textSecondary, height: 1.35),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 24),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => Navigator.pop(context, false),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textMuted,
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(isBM ? 'Batal' : 'Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                flex: 2,
                child: ElevatedButton(
                  onPressed: () => Navigator.pop(context, true),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    isBM ? 'BENARKAN AKSES' : 'ALLOW ACCESS',
                    style: const TextStyle(fontWeight: FontWeight.bold),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
        ],
      ),
    );
  }

  IconData _getIcon() {
    switch (type) {
      case AppPermissionType.location:
        return Icons.location_on_rounded;
      case AppPermissionType.camera:
        return Icons.camera_alt_rounded;
      case AppPermissionType.notifications:
        return Icons.notifications_active_rounded;
      case AppPermissionType.biometrics:
        return Icons.fingerprint_rounded;
    }
  }

  String _getTitle() {
    switch (type) {
      case AppPermissionType.location:
        return isBM ? 'Kebenaran Lokasi & GPS' : 'Location & GPS Permission';
      case AppPermissionType.camera:
        return isBM ? 'Kebenaran Kamera & Galeri' : 'Camera & Gallery Permission';
      case AppPermissionType.notifications:
        return isBM ? 'Kebenaran Notifikasi' : 'Notification Permission';
      case AppPermissionType.biometrics:
        return isBM ? 'Kebenaran Biometrik' : 'Biometrics Permission';
    }
  }

  List<String> _getRationalePoints() {
    switch (type) {
      case AppPermissionType.location:
        return isBM
            ? [
                'Mengesan kedudukan semasa anda di peta semasa pemeriksaan tapak (site viewing).',
                'Menyusun listing hartanah yang paling hampir dengan lokasi semasa anda.',
                'Mengisi koordinat GPS (latitud & longitud) secara automatik semasa menambah listing baharu tanpa perlu taip manual.',
              ]
            : [
                'Center the interactive map on your exact position during site viewings.',
                'Sort and discover nearby property listings in your inspection radius.',
                'Automatically capture GPS coordinates when creating a new listing without manual typing.',
              ];
      case AppPermissionType.camera:
        return isBM
            ? [
                'Merakam gambar hartanah beresolusi tinggi terus dari kamera.',
                'Memuat naik salinan geran tanah & dokumen perjanjian SPA ke Peti Dokumen.',
              ]
            : [
                'Capture high-resolution property photos directly on site.',
                'Upload title deeds and SPA contracts to the Confidential Document Vault.',
              ];
      case AppPermissionType.notifications:
        return isBM
            ? [
                'Menerima makluman serta-merta apabila status pinjaman bank klien berubah.',
                'Peringatan tindakan susulan (follow-up) dan temujanji viewing harian.',
              ]
            : [
                'Instant alerts when client bank loan or valuation statuses update.',
                'Reminders for scheduled follow-ups and daily client viewing appointments.',
              ];
      case AppPermissionType.biometrics:
        return isBM
            ? [
                'Melindungi data kewangan & maklumat peribadi klien mengikut akta PDPA.',
                'Membuka kunci aplikasi dengan pantas & selamat tanpa menaip PIN.',
              ]
            : [
                'Protect confidential client documents and commission data under PDPA.',
                'Quick and secure app access without entering 6-digit PIN manually.',
              ];
    }
  }
}
