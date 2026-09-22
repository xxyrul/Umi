import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:intl/intl.dart';

import '../../core/theme/app_colors.dart';
import '../../core/theme/theme_mode_provider.dart';
import '../../core/l10n/language_provider.dart';
import '../auth/auth_service.dart';
import '../admin/admin_service.dart';
import '../cases/case_repository.dart';
import '../listings/listing_model.dart';
import '../export/csv_export_service.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  void _confirmLogout() {
    final lang = ref.read(languageProvider);
    final isBM = lang == 'BM';
    final colors = context.colors;

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: colors.border)),
        title: Text(isBM ? 'Log Keluar' : 'Sign Out', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Text(
          isBM ? 'Adakah anda pasti mahu log keluar daripada akaun ini?' : 'Are you sure you want to sign out from this account?',
          style: TextStyle(color: colors.textSecondary, fontSize: 14),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.maroonPrimary,
              foregroundColor: Colors.white,
            ),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(authServiceProvider).signOut();
              if (mounted) context.go('/login');
            },
            child: Text(isBM ? 'Log Keluar' : 'Sign Out'),
          ),
        ],
      ),
    );
  }

  Future<void> _handleExportReport() async {
    final isBM = ref.read(languageProvider) == 'BM';
    final user = ref.read(authStateProvider).value;
    final colors = context.colors;
    if (user == null) return;

    try {
      final cases = await ref.read(casesStreamProvider.future);
      final activeCases = cases.where((c) => c.status != 'Completed' && c.status != 'Cancelled').length;

      final listingsSnap = await FirebaseFirestore.instance.collection('publicListings').where('agentId', isEqualTo: user.uid).get();
      final listings = listingsSnap.docs.map((d) => ListingModel.fromFirestore(d)).toList();

      final totalValue = listings.fold<int>(0, (prev, l) => prev + l.price);
      final commission = (totalValue * 0.02).round();

      final formatPrice = NumberFormat('#,###');

      if (!mounted) return;
      showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: colors.surface,
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: colors.border)),
          title: Text(isBM ? '📊 Laporan Kes Hartanah' : '📊 Property Cases Report', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
          content: Text(
            isBM
                ? 'Ringkasan Kes Artha v2.0.0:\n\n• Kes Aktif: $activeCases Hartanah\n• Nilai Portfolio: RM ${formatPrice.format(totalValue)}\n• Anggaran Komisen: RM ${formatPrice.format(commission)}\n\nSedia untuk dieksport ke format CSV?'
                : 'Artha Summary v2.0.0:\n\n• Active Cases: $activeCases Properties\n• Portfolio Value: RM ${formatPrice.format(totalValue)}\n• Estimated Commission: RM ${formatPrice.format(commission)}\n\nReady to export as CSV?',
            style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.5),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(ctx), child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted))),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: AppColors.maroonPrimary, foregroundColor: Colors.white),
              onPressed: () async {
                Navigator.pop(ctx);
                await ref.read(csvExportServiceProvider).exportCasesCsv(cases);
              },
              child: Text(isBM ? 'Kongsi / Simpan CSV' : 'Share / Save CSV'),
            ),
          ],
        ),
      );
    } catch (e) {
      debugPrint('Export error: $e');
    }
  }

  String _getUserInitials(String name) {
    if (name.isEmpty) return 'A';
    final parts = name.trim().split(RegExp(r'\s+'));
    if (parts.length >= 2) {
      return '${parts[0][0]}${parts[1][0]}'.toUpperCase();
    }
    return name[0].toUpperCase();
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';
    final userProfileAsync = ref.watch(currentUserProfileProvider);
    final user = ref.watch(authStateProvider).value;
    final isAdmin = (userProfileAsync.value?.isAdmin == true) ||
        (userProfileAsync.value?.role.toUpperCase() == 'ADMIN');
    final pendingCount = ref.watch(pendingAgentsStreamProvider).value?.length ?? 0;
    final colors = context.colors;

    final displayName = userProfileAsync.value?.displayName ?? user?.displayName ?? 'Ejen Artha';
    final email = userProfileAsync.value?.email ?? user?.email ?? '';
    final phone = userProfileAsync.value?.phoneNumber ?? '';
    final photoUrl = (userProfileAsync.value?.photoUrl.isNotEmpty == true)
        ? userProfileAsync.value!.photoUrl
        : (FirebaseAuth.instance.currentUser?.photoURL ?? '');

    final bottomInset = MediaQuery.of(context).padding.bottom;
    final floatingBarBottom = bottomInset > 0 ? bottomInset + 8.0 : 20.0;
    final scrollBottom = floatingBarBottom + 58.0 + 32.0;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        title: Text(
          isBM ? 'Profil & Tetapan' : 'Profile & Settings',
          style: TextStyle(
            fontSize: 18,
            fontWeight: FontWeight.w700,
            color: colors.textPrimary,
          ),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.logout_rounded, color: Colors.redAccent),
            tooltip: isBM ? 'Log Keluar' : 'Sign Out',
            onPressed: _confirmLogout,
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: ListView(
        padding: EdgeInsets.only(left: 20, right: 20, top: 16, bottom: scrollBottom),
        children: [
          // Centered Profile Header (Clean borderless/neutral circle, zero camera badge)
          Center(
            child: Column(
              children: [
                GestureDetector(
                  onTap: () => context.push('/account'),
                  child: Container(
                    width: 84,
                    height: 84,
                    decoration: BoxDecoration(
                      color: colors.card,
                      shape: BoxShape.circle,
                      border: Border.all(color: colors.border.withValues(alpha: 0.8), width: 1.5),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.1),
                          blurRadius: 8,
                          offset: const Offset(0, 3),
                        ),
                      ],
                    ),
                    clipBehavior: Clip.antiAlias,
                    alignment: Alignment.center,
                    child: photoUrl.isNotEmpty
                        ? CachedNetworkImage(
                            imageUrl: photoUrl,
                            width: 84,
                            height: 84,
                            fit: BoxFit.cover,
                            placeholder: (context, url) => Center(
                              child: Text(
                                _getUserInitials(displayName),
                                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                              ),
                            ),
                            errorWidget: (context, url, error) => Center(
                              child: Text(
                                _getUserInitials(displayName),
                                style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                              ),
                            ),
                          )
                        : Text(
                            _getUserInitials(displayName),
                            style: TextStyle(fontSize: 28, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                          ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  displayName,
                  style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: colors.textPrimary),
                ),
                const SizedBox(height: 4),
                Text(
                  email,
                  style: TextStyle(fontSize: 13, color: colors.textMuted),
                ),
                if (phone.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text(
                    phone,
                    style: TextStyle(fontSize: 12, color: colors.textDim),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 24),

          // Group 1: Akaun & Identiti
          _buildSectionHeader(isBM ? 'AKAUN & IDENTITI' : 'ACCOUNT & IDENTITY', colors),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                _buildOptionTile(
                  icon: Icons.person_outline_rounded,
                  iconColor: const Color(0xFF3B82F6),
                  title: isBM ? 'Tetapan Akaun' : 'Account Settings',
                  subtitle: isBM ? 'Urus gambar, nama & telefon ejen' : 'Manage picture, name and phone',
                  onTap: () => context.push('/account'),
                  colors: colors,
                ),
                if (isAdmin) ...[
                  Divider(color: colors.border, height: 1),
                  _buildOptionTile(
                    icon: Icons.shield_outlined,
                    iconColor: const Color(0xFFF59E0B),
                    title: isBM ? 'Pusat Pentadbir (Admin Hub)' : 'Admin Hub',
                    subtitle: isBM ? 'Pengesahan ejen, kod jemputan & siaran' : 'Agent approvals, invite codes & broadcasts',
                    badge: pendingCount > 0
                        ? Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.redAccent,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              '$pendingCount ${isBM ? "Baru" : "New"}',
                              style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                            ),
                          )
                        : null,
                    onTap: () => context.push('/admin'),
                    colors: colors,
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Group 2: Tetapan Aplikasi
          _buildSectionHeader(isBM ? 'TETAPAN APLIKASI' : 'APP SETTINGS', colors),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                // LANGUAGE SEGMENTED SWITCH
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF8B5CF6).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.translate_rounded, color: Color(0xFFA78BFA), size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isBM ? 'Bahasa (Language)' : 'Language',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              isBM ? 'Bahasa Melayu (BM)' : 'English (EN)',
                              style: TextStyle(fontSize: 12, color: colors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      // Segmented Button [BM | EN]
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => ref.read(languageProvider.notifier).setLanguage('BM'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: isBM ? AppColors.maroonPrimary : Colors.transparent,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: Text(
                                  'BM',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isBM ? Colors.white : colors.textMuted,
                                  ),
                                ),
                              ),
                            ),
                            GestureDetector(
                              behavior: HitTestBehavior.opaque,
                              onTap: () => ref.read(languageProvider.notifier).setLanguage('EN'),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                decoration: BoxDecoration(
                                  color: !isBM ? AppColors.maroonPrimary : Colors.transparent,
                                  borderRadius: BorderRadius.circular(7),
                                ),
                                child: Text(
                                  'EN',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: !isBM ? Colors.white : colors.textMuted,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Divider(color: colors.border, height: 1),

                // THEME MODE SWITCHER (Light, Dark, System)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                  child: Row(
                    children: [
                      Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFFF59E0B).withValues(alpha: 0.18),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.brightness_6_rounded, color: Color(0xFFFBBF24), size: 18),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              isBM ? 'Mod Tema' : 'Theme Mode',
                              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w600, color: colors.textPrimary),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              ref.watch(themeModeProvider) == ThemeMode.light
                                  ? (isBM ? 'Cerah (Light)' : 'Light Mode')
                                  : (ref.watch(themeModeProvider) == ThemeMode.dark
                                      ? (isBM ? 'Gelap (Dark)' : 'Dark Mode')
                                      : (isBM ? 'Ikut Sistem' : 'System Default')),
                              style: TextStyle(fontSize: 12, color: colors.textMuted),
                            ),
                          ],
                        ),
                      ),
                      // Segmented Button [Auto | Light | Dark]
                      Container(
                        padding: const EdgeInsets.all(3),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            _buildThemeSegmentButton(
                              label: 'Auto',
                              mode: ThemeMode.system,
                              current: ref.watch(themeModeProvider),
                              onTap: () => ref.read(themeModeProvider.notifier).setThemeMode(ThemeMode.system),
                              colors: colors,
                            ),
                            _buildThemeSegmentButton(
                              icon: Icons.light_mode_rounded,
                              mode: ThemeMode.light,
                              current: ref.watch(themeModeProvider),
                              onTap: () => ref.read(themeModeProvider.notifier).setThemeMode(ThemeMode.light),
                              colors: colors,
                            ),
                            _buildThemeSegmentButton(
                              icon: Icons.dark_mode_rounded,
                              mode: ThemeMode.dark,
                              current: ref.watch(themeModeProvider),
                              onTap: () => ref.read(themeModeProvider.notifier).setThemeMode(ThemeMode.dark),
                              colors: colors,
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                Divider(color: colors.border, height: 1),

                // Privacy & Security
                _buildOptionTile(
                  icon: Icons.shield_outlined,
                  iconColor: const Color(0xFF10B981),
                  title: isBM ? 'Privasi & Keselamatan' : 'Privacy & Security',
                  subtitle: isBM ? 'Kunci aplikasi PIN 4-digit & biometrik' : '4-digit PIN lock & biometrics',
                  onTap: () => context.push('/security'),
                  colors: colors,
                ),
                Divider(color: colors.border, height: 1),

                // Notifications Settings
                _buildOptionTile(
                  icon: Icons.notifications_none_rounded,
                  iconColor: Colors.redAccent,
                  title: isBM ? 'Notifikasi' : 'Notifications',
                  subtitle: isBM ? 'Pemberitahuan status kes & ringkasan' : 'Case status updates & daily briefing',
                  onTap: () => context.push('/notification-settings'),
                  colors: colors,
                ),
                Divider(color: colors.border, height: 1),

                // Export CSV Report
                _buildOptionTile(
                  icon: Icons.table_chart_outlined,
                  iconColor: const Color(0xFF06B6D4),
                  title: isBM ? 'Eksport Laporan' : 'Export Report',
                  subtitle: isBM ? 'Format Excel / CSV laporan kes' : 'Excel / CSV case reports',
                  onTap: _handleExportReport,
                  colors: colors,
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Group 3: Sokongan & Maklumat
          _buildSectionHeader(isBM ? 'SOKONGAN & VERSI' : 'SUPPORT & VERSION', colors),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                _buildOptionTile(
                  icon: Icons.info_outline_rounded,
                  iconColor: const Color(0xFF64748B),
                  title: isBM ? 'Versi Aplikasi' : 'App Version',
                  subtitle: isBM ? 'v2.0.0 · Semak kemas kini & log' : 'v2.0.0 · Check updates & changelog',
                  onTap: () => context.push('/updates'),
                  colors: colors,
                ),
                Divider(color: colors.border, height: 1),
                _buildOptionTile(
                  icon: Icons.help_outline_rounded,
                  iconColor: const Color(0xFF6366F1),
                  title: isBM ? 'Bantuan & Maklum Balas' : 'Help & Feedback',
                  subtitle: isBM ? 'Hubungi sokongan & soalan lazim' : 'Support & FAQ',
                  onTap: () => context.push('/help'),
                  colors: colors,
                ),
              ],
            ),
          ),
          const SizedBox(height: 120),
        ],
      ),
    );
  }

  Widget _buildOptionTile({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    VoidCallback? onTap,
    Widget? badge,
    required AppThemeColors colors,
  }) {
    return ListTile(
      leading: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.18),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, color: iconColor, size: 18),
      ),
      title: Text(title, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14)),
      subtitle: Text(subtitle, style: TextStyle(color: colors.textMuted, fontSize: 12)),
      trailing: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (badge != null) ...[
            badge,
            const SizedBox(width: 6),
          ],
          Icon(Icons.chevron_right, color: colors.textMuted, size: 18),
        ],
      ),
      onTap: onTap,
    );
  }

  Widget _buildThemeSegmentButton({
    String? label,
    IconData? icon,
    required ThemeMode mode,
    required ThemeMode current,
    required VoidCallback onTap,
    required AppThemeColors colors,
  }) {
    final isSelected = mode == current;
    return GestureDetector(
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.maroonPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(7),
        ),
        child: icon != null
            ? Icon(
                icon,
                size: 14,
                color: isSelected ? Colors.white : colors.textMuted,
              )
            : Text(
                label ?? '',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isSelected ? Colors.white : colors.textMuted,
                ),
              ),
      ),
    );
  }

  Widget _buildSectionHeader(String title, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 1,
          color: colors.textMuted,
        ),
      ),
    );
  }
}
