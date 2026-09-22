import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:intl/intl.dart';

import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/app_toast.dart';
import '../case_model.dart';

class CaseCardWidget extends ConsumerWidget {
  final CaseModel caseItem;
  final VoidCallback? onTap;
  final Function(String status)? onStatusTap;
  final VoidCallback? onReminderTap;

  const CaseCardWidget({
    super.key,
    required this.caseItem,
    this.onTap,
    this.onStatusTap,
    this.onReminderTap,
  });

  static const List<String> stages = [
    'Viewing',
    'Booking Paid',
    'Loan Approved',
    'SPA Signed',
    'Completed',
  ];

  static String getMilestoneDisplay(String status, bool isBM) {
    final s = status.trim();
    if (isBM) {
      switch (s) {
        case 'Viewing':
          return 'LAWATAN';
        case 'Booking Paid':
          return 'TEMPAHAN DIBAYAR';
        case 'Loan Approved':
          return 'PINJAMAN DILULUSKAN';
        case 'SPA Signed':
          return 'SPA DITANDATANGANI';
        case 'Completed':
          return 'SELESAI';
        case 'Cancelled':
          return 'DIBATALKAN';
        default:
          return s.toUpperCase();
      }
    } else {
      switch (s) {
        case 'Lawatan':
        case 'Viewing':
          return 'VIEWING';
        case 'Tempahan Dibayar':
        case 'Booking Paid':
          return 'BOOKING PAID';
        case 'Pinjaman Diluluskan':
        case 'Loan Approved':
          return 'LOAN APPROVED';
        case 'SPA Ditandatangani':
        case 'SPA Signed':
          return 'SPA SIGNED';
        case 'Selesai':
        case 'Completed':
          return 'COMPLETED';
        case 'Dibatalkan':
        case 'Cancelled':
          return 'CANCELLED';
        default:
          return s.toUpperCase();
      }
    }
  }

  void _call(BuildContext context, String phone) {
    if (phone.isEmpty) {
      AppToast.error(context, 'Nombor telefon tidak tersedia.');
      return;
    }
    final clean = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    launchUrl(Uri.parse('tel:$clean'), mode: LaunchMode.externalApplication);
  }

  void _whatsapp(BuildContext context, String phone, String name, bool isBM) {
    if (phone.isEmpty) {
      AppToast.error(context, isBM ? 'Nombor telefon tidak tersedia.' : 'Phone number not available.');
      return;
    }
    var clean = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.startsWith('0')) {
      clean = '60${clean.substring(1)}';
    } else if (!clean.startsWith('60')) {
      clean = '60$clean';
    }
    final msg = Uri.encodeComponent(
      isBM
          ? 'Salam / Hai $name, saya berkenaan transaksi hartanah "${caseItem.caseName}".'
          : 'Hello $name, I am following up regarding property transaction "${caseItem.caseName}".',
    );
    launchUrl(Uri.parse('https://wa.me/$clean?text=$msg'), mode: LaunchMode.externalApplication);
  }

  Widget _buildPartyCard({
    required BuildContext context,
    required String label,
    required Color accentColor,
    required String name,
    required String phone,
    required AppThemeColors colors,
    required bool isBM,
  }) {
    final displayName = name.isNotEmpty ? name : '—';
    final hasPhone = phone.trim().isNotEmpty;

    return Expanded(
      child: Container(
        padding: const EdgeInsets.all(10),
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(10),
          border: Border(
            left: BorderSide(color: accentColor, width: 4),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              label,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: accentColor,
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 3),
            Text(
              displayName,
              style: TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.w700,
                color: colors.textPrimary,
              ),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            if (hasPhone) ...[
              const SizedBox(height: 2),
              Text(
                phone,
                style: TextStyle(
                  fontSize: 11,
                  color: colors.textMuted,
                ),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ],
            const SizedBox(height: 8),
            Row(
              children: [
                InkWell(
                  onTap: hasPhone ? () => _call(context, phone) : null,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 34,
                    height: 30,
                    decoration: BoxDecoration(
                      color: hasPhone ? colors.maroonLight : colors.border,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.phone_outlined,
                      size: 15,
                      color: hasPhone ? colors.maroonPrimary : colors.textDim,
                    ),
                  ),
                ),
                const SizedBox(width: 6),
                InkWell(
                  onTap: hasPhone ? () => _whatsapp(context, phone, displayName, isBM) : null,
                  borderRadius: BorderRadius.circular(8),
                  child: Container(
                    width: 34,
                    height: 30,
                    decoration: BoxDecoration(
                      color: hasPhone ? const Color(0x2E10B981) : colors.border,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(
                      Icons.chat_bubble_outline_rounded,
                      size: 15,
                      color: hasPhone ? const Color(0xFF10B981) : colors.textDim,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final currentStageIndex = stages.indexOf(caseItem.status);
    final colors = context.colors;
    final createdDate = caseItem.createdAt ?? CaseModel.parseFlexibleDate(caseItem.tarikh);
    final createdLabel = createdDate == null
      ? ''
      : DateFormat(isBM ? 'd MMM yyyy' : 'MMM d, yyyy', isBM ? 'ms_MY' : 'en_US').format(createdDate);

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.06),
            offset: const Offset(0, 3),
            blurRadius: 8,
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(16),
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // 4px maroon accent top bar
                Container(
                  height: 4,
                  color: colors.maroonPrimary,
                ),
                Padding(
                  padding: const EdgeInsets.all(14),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Header: Icon Box + Case Name + Date + Status Badge
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            width: 42,
                            height: 42,
                            decoration: BoxDecoration(
                              color: colors.maroonLight,
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Center(
                              child: Icon(
                                Icons.home_work_rounded,
                                size: 24,
                                color: colors.maroonPrimary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  caseItem.caseName,
                                  style: TextStyle(
                                    fontSize: 16,
                                    fontWeight: FontWeight.w700,
                                    color: colors.textPrimary,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                if (createdLabel.isNotEmpty)
                                  Text(
                                    isBM ? 'Dicipta $createdLabel' : 'Created $createdLabel',
                                    style: TextStyle(fontSize: 10, color: colors.textDim),
                                  ),
                                const SizedBox(height: 2),
                                Text(
                                  caseItem.propertyAddress.isNotEmpty
                                      ? caseItem.propertyAddress
                                      : (isBM ? 'Alamat belum diisi' : 'Address not set'),
                                  style: TextStyle(
                                    fontSize: 12,
                                    color: colors.textMuted,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),

                          // Milestone Status Pill
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: colors.maroonLight,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                            ),
                            child: Text(
                              getMilestoneDisplay(caseItem.status, isBM),
                              style: TextStyle(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: colors.maroonPrimary,
                                letterSpacing: 0.5,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 14),

                      // Financial Overview (Price & Commission)
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isBM ? 'Harga Hartanah' : 'Property Price',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.textSecondary),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  caseItem.price > 0
                                      ? CurrencyFormatter.format(caseItem.price)
                                      : (isBM ? 'Belum diisi' : 'Not set'),
                                  style: TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: colors.textPrimary,
                                  ),
                                ),
                              ],
                            ),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.end,
                              children: [
                                Text(
                                  isBM ? 'Est. Komisen (2%)' : 'Est. Commission (2%)',
                                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.textSecondary),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  caseItem.price > 0
                                      ? CurrencyFormatter.format((caseItem.price * 0.02).round())
                                      : 'RM 0',
                                  style: const TextStyle(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Color(0xFF10B981),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Vendor & Buyer Info Cards
                      if (caseItem.vendorName.isNotEmpty || caseItem.buyerName.isNotEmpty) ...[
                        Row(
                          children: [
                            _buildPartyCard(
                              context: context,
                              label: isBM ? 'PENJUAL' : 'VENDOR',
                              accentColor: colors.maroonPrimary,
                              name: caseItem.vendorName,
                              phone: caseItem.vendorPhone,
                              colors: colors,
                              isBM: isBM,
                            ),
                            const SizedBox(width: 8),
                            _buildPartyCard(
                              context: context,
                              label: isBM ? 'PEMBELI' : 'BUYER',
                              accentColor: const Color(0xFF3B82F6),
                              name: caseItem.buyerName,
                              phone: caseItem.buyerPhone,
                              colors: colors,
                              isBM: isBM,
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),
                      ],

                      // Current Stage Indicator
                      if (currentStageIndex != -1) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isBM ? 'Peringkat Semasa' : 'Current Stage',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, color: colors.textSecondary),
                            ),
                            Text(
                              '${currentStageIndex + 1}/${stages.length}',
                              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w900, color: colors.maroonPrimary),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Row(
                          children: List.generate(stages.length, (i) {
                            final isDone = i <= currentStageIndex;
                            return Expanded(
                              child: Container(
                                height: 5,
                                margin: EdgeInsets.only(right: i < stages.length - 1 ? 4 : 0),
                                decoration: BoxDecoration(
                                  color: isDone ? colors.maroonPrimary : colors.border,
                                  borderRadius: BorderRadius.circular(3),
                                ),
                              ),
                            );
                          }),
                        ),
                      ],

                      // Follow-up Reminder Banner
                      const SizedBox(height: 12),
                      InkWell(
                        onTap: onReminderTap,
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
                          decoration: BoxDecoration(
                            color: caseItem.reminderDate.isNotEmpty
                                ? const Color(0x2910B981)
                                : colors.surface,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: caseItem.reminderDate.isNotEmpty ? const Color(0x6610B981) : colors.border),
                          ),
                          child: Row(
                            children: [
                              Icon(
                                caseItem.reminderDate.isNotEmpty
                                    ? Icons.alarm_on_rounded
                                    : Icons.calendar_today_outlined,
                                size: 14,
                                color: caseItem.reminderDate.isNotEmpty
                                    ? const Color(0xFF10B981)
                                    : colors.textMuted,
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  caseItem.reminderDate.isNotEmpty
                                      ? (isBM ? 'SUSULAN: ${caseItem.reminderDate}' : 'FOLLOW-UP: ${caseItem.reminderDate}')
                                      : (isBM ? 'SUSULAN: Tiada susulan dijadualkan' : 'FOLLOW-UP: No follow-up scheduled'),
                                  style: TextStyle(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w600,
                                    color: caseItem.reminderDate.isNotEmpty
                                        ? const Color(0xFF10B981)
                                        : colors.textSecondary,
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
