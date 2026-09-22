import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';

class PermissionsGuideScreen extends ConsumerWidget {
  const PermissionsGuideScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.colors;
    final isBM = ref.watch(languageProvider) == 'BM';

    final permissions = [
      {
        'titleBM': 'Lokasi & GPS Tepat',
        'titleEN': 'Location & Precise GPS',
        'icon': Icons.location_on_rounded,
        'color': Colors.blue,
        'technical': 'ACCESS_FINE_LOCATION, ACCESS_COARSE_LOCATION',
        'purposeBM': 'Mengesan kedudukan semasa ejen semasa tinjauan tapak (site viewing), memaparkan listing berhampiran, dan mengisi koordinat GPS latitud/longitud unit secara automatik.',
        'purposeEN': 'Detects agent coordinates during on-site inspections, shows nearby property listings, and automatically fills latitude/longitude without manual typing.',
        'privacyBM': 'Hanya dibaca atas permintaan semasa aplikasi aktif. Sifar penjejakan latar belakang (zero background tracking).',
        'privacyEN': 'Read on-demand only while the app is active. Zero background location tracking.',
      },
      {
        'titleBM': 'Kamera & Foto Galeri',
        'titleEN': 'Camera & Media Gallery',
        'icon': Icons.camera_alt_rounded,
        'color': Colors.purple,
        'technical': 'CAMERA, READ_MEDIA_IMAGES',
        'purposeBM': 'Merakam gambar unit rumah berkualiti tinggi terus di tapak projek dan memilih gambar dari galeri untuk brochure WhatsApp & katalog hartanah.',
        'purposeEN': 'Captures high-resolution property photos on-site and allows selecting listing photos for WhatsApp marketing brochures.',
        'privacyBM': 'Hanya mengakses foto dan dokumen yang dipilih secara khusus oleh ejen.',
        'privacyEN': 'Strictly restricted to photos and documents explicitly selected by the agent.',
      },
      {
        'titleBM': 'Peti Dokumen Sulit (PDPA Vault)',
        'titleEN': 'Confidential Document Vault (PDPA)',
        'icon': Icons.shield_rounded,
        'color': colors.maroonPrimary,
        'technical': 'Firebase Encrypted Cloud Storage',
        'purposeBM': 'Menyimpan salinan Geran Tanah, MyKad Pemilik, Perjanjian SPA, dan Borang Lantikan Agensi dengan selamat.',
        'purposeEN': 'Securely stores Land Title deeds, Owner MyKad copies, SPA contracts, and Exclusive Agency agreements.',
        'privacyBM': 'PRIVASI SULIT: Butang dan fail peti dokumen ini HANYA dipaparkan kepada ejen pemilik listing berdaftar. Ejen co-broke dan pihak luar tidak dapat melihat atau mengakses dokumen ini.',
        'privacyEN': 'STRICT PRIVACY: The vault is strictly visible only to the verified listing owner. Co-broke agents cannot view or download confidential documents.',
      },
      {
        'titleBM': 'Notifikasi & Makluman Segera',
        'titleEN': 'Push Notifications & Alerts',
        'icon': Icons.notifications_active_rounded,
        'color': Colors.orange,
        'technical': 'POST_NOTIFICATIONS, Firebase Cloud Messaging',
        'purposeBM': 'Memberi makluman pantas apabila status permohonan pinjaman bank berubah, booking kes diterima, atau tindakan susulan klien diperlukan.',
        'purposeEN': 'Instant alerts when bank loan milestones update, booking deposits are confirmed, or client follow-ups are due.',
        'privacyBM': 'Tiada notifikasi iklan pihak ketiga; semata-mata transaksi agensi anda.',
        'privacyEN': 'Strictly limited to your agency transactions; zero third-party advertising.',
      },
      {
        'titleBM': 'Biometrik & Kunci Keselamatan PIN',
        'titleEN': 'Biometric & PIN Security',
        'icon': Icons.fingerprint_rounded,
        'color': const Color(0xFF10B981),
        'technical': 'USE_BIOMETRIC, Salted SHA-256 Crypto',
        'purposeBM': 'Membolehkan pengesahan Cap Jari atau Face ID pantas bagi mengunci data komisen dan maklumat kewangan klien.',
        'purposeEN': 'Enables fast Fingerprint or Face ID unlock to protect confidential commission and client financial records.',
        'privacyBM': 'Data biometrik kekal di dalam modul keselamatan peranti tempatan dan tidak pernah dihantar ke mana-mana pelayan internet.',
        'privacyEN': 'Biometric templates remain strictly inside the local device secure enclave and are never transmitted over the internet.',
      },
      {
        'titleBM': 'Kalendar Temujanji Telefon',
        'titleEN': 'Native Phone Calendar Intent',
        'icon': Icons.calendar_today_rounded,
        'color': Colors.teal,
        'technical': 'Android ACTION_INSERT Intent',
        'purposeBM': 'Menyegerakkan temujanji viewing unit dengan kalendar telefon (Google / Samsung Calendar) secara automatik.',
        'purposeEN': 'Directly synchronizes client viewing appointments into your native phone calendar without manual scheduling.',
        'privacyBM': 'Menggunakan sistem intent tanpa kebenaran baca kalendar peribadi (Zero-Permission Architecture).',
        'privacyEN': 'Uses intent delegation with zero read access to your personal calendar events.',
      },
    ];

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Panduan Privasi & Kebenaran' : 'Privacy & Permissions Guide',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // PDPA Top Shield Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: colors.maroonPrimary.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(Icons.verified_user_rounded, color: colors.maroonPrimary, size: 24),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBM ? 'Komitmen Perlindungan Data (PDPA)' : 'Data Protection Commitment (PDPA)',
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        isBM
                            ? 'Aplikasi Artha mematuhi Akta Perlindungan Data Peribadi 2010 (Akta 709). Kami hanya memohon kebenaran sistem yang benar-benar penting untuk kelancaran tugas ejen hartanah berdaftar.'
                            : 'Artha complies with the Malaysian Personal Data Protection Act 2010 (Act 709). We only request system permissions essential for registered real estate agent operations.',
                        style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          Text(
            isBM ? 'SENARAI KEBENARAN APLIKASI' : 'APPLICATION PERMISSIONS DIRECTORY',
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              letterSpacing: 0.5,
              color: colors.maroonPrimary,
            ),
          ),
          const SizedBox(height: 12),

          ...permissions.map((perm) {
            final title = isBM ? perm['titleBM'] as String : perm['titleEN'] as String;
            final purpose = isBM ? perm['purposeBM'] as String : perm['purposeEN'] as String;
            final privacy = isBM ? perm['privacyBM'] as String : perm['privacyEN'] as String;
            final technical = perm['technical'] as String;
            final icon = perm['icon'] as IconData;
            final iconColor = perm['color'] as Color;

            return Container(
              margin: const EdgeInsets.only(bottom: 12),
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: iconColor.withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Icon(icon, color: iconColor, size: 20),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                            Text(
                              technical,
                              style: TextStyle(color: colors.textMuted, fontSize: 10, fontFamily: 'monospace'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    purpose,
                    style: TextStyle(color: colors.textSecondary, fontSize: 12.5, height: 1.4),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(8),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.shield_outlined, size: 14, color: colors.maroonPrimary),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            privacy,
                            style: TextStyle(fontSize: 11, color: colors.textMuted, height: 1.3),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        ],
      ),
    );
  }
}
