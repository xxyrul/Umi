import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:cached_network_image/cached_network_image.dart';

import '../../core/theme/app_colors.dart';
import '../../core/l10n/language_provider.dart';
import '../auth/auth_service.dart';
import '../cases/case_model.dart';
import '../cases/case_repository.dart';
import '../cases/widgets/case_card_widget.dart';
import '../listings/listing_repository.dart';
import '../notifications/notification_state_provider.dart';

class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final userProfileAsync = ref.watch(currentUserProfileProvider);
    final user = ref.watch(authStateProvider).value;
    final casesAsync = ref.watch(casesStreamProvider);
    final activeListingsCountAsync = ref.watch(activeListingsCountProvider);
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    final displayName = userProfileAsync.value?.displayName ?? user?.displayName ?? 'Agent';
    final firstName = displayName.split(' ').first;
    final photoUrl = userProfileAsync.value?.photoUrl ?? user?.photoURL ?? '';

    // Greeting by time of day
    final hour = DateTime.now().hour;
    String greeting;
    String greetingIcon;
    if (hour < 12) {
      greeting = isBM ? 'Selamat Pagi' : 'Good Morning';
      greetingIcon = '🌅';
    } else if (hour < 17) {
      greeting = isBM ? 'Selamat Tengah Hari' : 'Good Afternoon';
      greetingIcon = '☀️';
    } else {
      greeting = isBM ? 'Selamat Petang' : 'Good Evening';
      greetingIcon = '🌙';
    }

    final isCasesLoading = casesAsync.isLoading && !casesAsync.hasValue;
    final isListingsLoading = activeListingsCountAsync.isLoading && !activeListingsCountAsync.hasValue;

    final cases = casesAsync.value ?? [];

    // Pipeline counts
    final activeCount = cases.where((c) => c.status != 'Completed' && c.status != 'Cancelled').length;
    final bookingCount = cases.where((c) => c.status == 'Booking Paid').length;
    final loanCount = cases.where((c) => c.status == 'Loan Approved').length;
    final spaCount = cases.where((c) => c.status == 'SPA Signed').length;
    final completedCount = cases.where((c) => c.status == 'Completed').length;
    final cancelledCount = cases.where((c) => c.status == 'Cancelled').length;
    final activeListingsCount = activeListingsCountAsync.value ?? 0;

    // Today's Follow-up Action Items
    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final todayActionCases = cases.where((c) {
      if (c.reminderDate.isEmpty) return false;
      final remDate = c.reminderDate.split('T').first;
      return remDate.compareTo(todayStr) <= 0 && c.status != 'Completed' && c.status != 'Cancelled';
    }).toList();

    // True unread announcements count
    final unreadAnnouncementsCount = ref.watch(unreadNotificationsCountProvider);

    final bottomInset = MediaQuery.of(context).padding.bottom;
    final floatingBarBottom = bottomInset > 0 ? bottomInset + 8.0 : 20.0;
    final scrollBottom = floatingBarBottom + 58.0 + 32.0;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        title: Text(
          'artha',
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w900,
            color: colors.maroonPrimary,
            letterSpacing: -0.5,
          ),
        ),
        actions: [
          // Bell Notification Icon with Material 3 Badge
          IconButton(
            icon: Badge.count(
              count: unreadAnnouncementsCount,
              isLabelVisible: unreadAnnouncementsCount > 0,
              backgroundColor: AppColors.maroonPrimary,
              textColor: Colors.white,
              textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.bold),
              child: Icon(Icons.notifications_outlined, color: colors.textPrimary),
            ),
            tooltip: isBM ? 'Pemberitahuan' : 'Announcements',
            onPressed: () => context.push('/notifications'),
          ),
          // Gear / Settings icon
          IconButton(
            icon: Icon(Icons.settings_outlined, color: colors.textPrimary),
            tooltip: isBM ? 'Tetapan' : 'Settings',
            onPressed: () => context.go('/profile'),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: AppColors.maroonPrimary,
        onRefresh: () async {
          ref.invalidate(casesStreamProvider);
          ref.invalidate(listingsStreamProvider);
        },
        child: SingleChildScrollView(
          padding: EdgeInsets.only(left: 16, right: 16, top: 16, bottom: scrollBottom),
          physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Welcome Section
              Row(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '$greeting, $firstName $greetingIcon',
                          style: TextStyle(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: colors.textPrimary,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isCasesLoading
                              ? (isBM ? 'Mengemas kini status kes...' : 'Updating active cases...')
                              : '$activeCount ${isBM ? "kes aktif sedang berjalan" : (activeCount == 1 ? "active case in progress" : "active cases in progress")}',
                          style: TextStyle(fontSize: 13, color: colors.textMuted),
                        ),
                      ],
                    ),
                  ),
                  GestureDetector(
                    onTap: () => context.go('/profile'),
                    child: Container(
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.border, width: 1.5),
                        color: colors.card,
                      ),
                      clipBehavior: Clip.antiAlias,
                      child: photoUrl.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: photoUrl,
                              fit: BoxFit.cover,
                              memCacheWidth: 132,
                              memCacheHeight: 132,
                              errorWidget: (_, __, ___) => Center(
                                child: Text(
                                  firstName.isNotEmpty ? firstName[0].toUpperCase() : 'A',
                                  style: TextStyle(fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                                ),
                              ),
                            )
                          : Center(
                              child: Text(
                                firstName.isNotEmpty ? firstName[0].toUpperCase() : 'A',
                                style: TextStyle(fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                              ),
                            ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 18),

              // 📌 TODAY'S ACTION ITEMS CARD
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(Icons.calendar_month_outlined, size: 18, color: colors.maroonPrimary),
                      const SizedBox(width: 6),
                      Text(
                        isBM ? 'Tindakan Hari Ini' : "Today's Actions",
                        style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
                      ),
                    ],
                  ),
                  if (todayActionCases.isNotEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                      decoration: BoxDecoration(
                        color: const Color(0xFFEF4444).withValues(alpha: 0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '${todayActionCases.length} ${isBM ? "perlu tindakan" : "need action"}',
                        style: const TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: Color(0xFFEF4444)),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              if (todayActionCases.isEmpty)
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle_outline, color: Color(0xFF10B981), size: 20),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          isBM
                              ? 'Semua tindakan susulan selesai untuk hari ini.'
                              : 'All follow-up actions completed for today.',
                          style: TextStyle(fontSize: 13, color: colors.textMuted),
                        ),
                      ),
                    ],
                  ),
                )
              else
                ...todayActionCases.take(3).map((item) => _buildTodayActionCard(context, item, isBM: isBM, colors: colors)),

              const SizedBox(height: 20),

              // 💼 6-STAGE DEAL PROGRESS (2x3 Grid)
              Text(
                isBM ? 'Status Kes & Transaksi' : 'Deal & Case Progress',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Aktif' : 'Active',
                      count: activeCount,
                      dotColor: const Color(0xFF10B981),
                      onTap: () => context.go('/cases?status=Active'),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Bayaran Booking' : 'Booking Paid',
                      count: bookingCount,
                      dotColor: const Color(0xFF3B82F6),
                      onTap: () => context.go('/cases?status=Booking%20Paid'),
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Pinjaman Bank' : 'Bank Loan',
                      count: loanCount,
                      dotColor: const Color(0xFF9333EA),
                      onTap: () => context.go('/cases?status=Loan%20Approved'),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Peringkat SPA' : 'Under SPA',
                      count: spaCount,
                      dotColor: const Color(0xFFF97316),
                      onTap: () => context.go('/cases?status=SPA%20Signed'),
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Selesai (Sold)' : 'Completed (Sold)',
                      count: completedCount,
                      dotColor: const Color(0xFF10B981),
                      onTap: () => context.go('/cases?status=Completed'),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildPipelineCapsule(
                      label: isBM ? 'Dibatalkan' : 'Cancelled',
                      count: cancelledCount,
                      dotColor: const Color(0xFF64748B),
                      onTap: () => context.go('/cases?status=Cancelled'),
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // ⚡ AKSES PANTAS (3 Quick Utilities)
              Text(
                isBM ? 'Akses Pantas' : 'Quick Access',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildQuickActionItem(
                      icon: Icons.note_add_outlined,
                      label: isBM ? 'Tambah Kes' : 'Add Case',
                      color: colors.maroonPrimary,
                      onTap: () => context.push('/case/form'),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildQuickActionItem(
                      icon: Icons.add_home_work_outlined,
                      label: isBM ? 'Tambah Listing' : 'Add Listing',
                      color: const Color(0xFF10B981),
                      onTap: () => context.push('/listing/form'),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _buildQuickActionItem(
                      icon: Icons.calculate_outlined,
                      label: isBM ? 'Kalkulator' : 'Calculator',
                      color: const Color(0xFF3B82F6),
                      onTap: () => context.push('/calculator'),
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              // Overview Metrics Cards
              _buildSectionTitle(isBM ? 'RINGKASAN STATUS KES' : 'DEAL & CASE SUMMARY', colors),
              Row(
                children: [
                  Expanded(
                    child: _buildMetricCard(
                      label: isBM ? 'Kes Aktif' : 'Active Cases',
                      value: isCasesLoading ? '—' : '$activeCount',
                      subtitle: isCasesLoading
                          ? (isBM ? 'Memuatkan...' : 'Loading...')
                          : '${isBM ? "Daripada" : "Out of"} ${cases.length} ${isBM ? "keseluruhan" : "total"}',
                      icon: Icons.folder,
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildMetricCard(
                      label: isBM ? 'Listing Aktif' : 'Active Listings',
                      value: isListingsLoading ? '—' : '$activeListingsCount',
                      subtitle: isListingsLoading
                          ? (isBM ? 'Memuatkan...' : 'Loading...')
                          : (isBM ? 'Dalam agensi' : 'In agency'),
                      icon: Icons.home_work,
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Recent Transactions List with CaseCardWidget
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionTitle(isBM ? 'KES TRANSAKSI TERKINI' : 'RECENT TRANSACTIONS', colors),
                  TextButton(
                    onPressed: () => context.go('/cases'),
                    child: Text(
                      isBM ? 'Lihat Semua' : 'View All',
                      style: TextStyle(color: colors.maroonPrimary, fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
              if (cases.isEmpty)
                Container(
                  padding: const EdgeInsets.all(24),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(16),
                    border: Border.all(color: colors.border),
                  ),
                  child: Center(
                    child: Text(
                      isBM ? 'Tiada kes transaksi aktif buat masa ini.' : 'No active transaction cases at this time.',
                      style: TextStyle(color: colors.textMuted, fontSize: 13),
                    ),
                  ),
                )
              else
                ...cases.take(3).map(
                  (c) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: CaseCardWidget(
                      caseItem: c,
                      onTap: () {
                        context.push('/case/${c.id}', extra: c);
                      },
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTodayActionCard(BuildContext context, CaseModel caseItem, {bool isBM = true, required AppThemeColors colors}) {
    final contactPhone = caseItem.buyerPhone.isNotEmpty ? caseItem.buyerPhone : caseItem.vendorPhone;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Expanded(
                child: Text(
                  caseItem.caseName,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: colors.maroonLight,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  CaseCardWidget.getMilestoneDisplay(caseItem.status, isBM),
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            caseItem.reminderNote.isNotEmpty
                ? caseItem.reminderNote
                : (isBM ? 'Semak status milestone seterusnya' : 'Check next milestone status'),
            style: TextStyle(fontSize: 12, color: colors.textMuted),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              if (contactPhone.isNotEmpty) ...[
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      var clean = contactPhone.replaceAll(RegExp(r'[^0-9]'), '');
                      if (clean.startsWith('0')) clean = '60${clean.substring(1)}';
                      launchUrl(Uri.parse('https://wa.me/$clean'), mode: LaunchMode.externalApplication);
                    },
                    icon: const Icon(Icons.chat, size: 16, color: Colors.white),
                    label: const Text('WhatsApp', style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Colors.white)),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF25D366),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () {
                    context.push('/case/${caseItem.id}', extra: caseItem);
                  },
                  icon: Icon(Icons.folder_open_outlined, size: 16, color: colors.textPrimary),
                  label: Text(
                    isBM ? 'Lihat Kes' : 'View Case',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.textPrimary),
                  ),
                  style: OutlinedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    side: BorderSide(color: colors.border),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildPipelineCapsule({
    required String label,
    required int count,
    required Color dotColor,
    required VoidCallback onTap,
    required AppThemeColors colors,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.border),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: BoxDecoration(color: dotColor, shape: BoxShape.circle),
                ),
                const SizedBox(width: 8),
                Text(
                  label,
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: colors.textPrimary),
                ),
              ],
            ),
            Text(
              '$count',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w900, color: colors.textPrimary),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildQuickActionItem({
    required IconData icon,
    required String label,
    required Color color,
    required VoidCallback onTap,
    required AppThemeColors colors,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          children: [
            Icon(icon, color: color, size: 22),
            const SizedBox(height: 6),
            Text(
              label,
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.textPrimary),
              textAlign: TextAlign.center,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCard({
    required String label,
    required String value,
    required String subtitle,
    required IconData icon,
    required AppThemeColors colors,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(label, style: TextStyle(color: colors.textMuted, fontSize: 12)),
              Icon(icon, color: colors.maroonPrimary, size: 18),
            ],
          ),
          const SizedBox(height: 8),
          Text(value, style: TextStyle(color: colors.textPrimary, fontSize: 26, fontWeight: FontWeight.bold)),
          const SizedBox(height: 2),
          Text(subtitle, style: TextStyle(color: colors.textSecondary, fontSize: 11, fontWeight: FontWeight.w500)),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          color: colors.textMuted,
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 0.8,
        ),
      ),
    );
  }
}
