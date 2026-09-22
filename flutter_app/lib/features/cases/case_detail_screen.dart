import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/calendar_intent_service.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/utils/phone_intent_helper.dart';
import '../../core/widgets/app_toast.dart';
import 'case_model.dart';
import 'case_repository.dart';
import 'widgets/case_card_widget.dart';

class CaseDetailScreen extends ConsumerStatefulWidget {
  final CaseModel? initialCase;
  final String? caseId;

  const CaseDetailScreen({super.key, this.initialCase, this.caseId});

  @override
  ConsumerState<CaseDetailScreen> createState() => _CaseDetailScreenState();
}

class _CaseDetailScreenState extends ConsumerState<CaseDetailScreen> {
  CaseModel? _caseData;
  CaseModel get _case => _caseData ?? widget.initialCase ?? CaseModel(id: '', caseName: '', userId: '');
  set _case(CaseModel? val) => _caseData = val;
  bool _isLoading = false;
  bool _isAuditLogExpanded = false;

  final List<String> _milestones = [
    'Viewing',
    'Booking Paid',
    'Loan Approved',
    'SPA Signed',
    'Completed',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.initialCase != null) {
      _caseData = widget.initialCase;
    } else if (widget.caseId != null) {
      _fetchCase();
    }
  }

  Future<void> _fetchCase() async {
    setState(() => _isLoading = true);
    try {
      final repo = ref.read(caseRepositoryProvider);
      final fetched = await repo.getCaseById(widget.caseId!);
      if (mounted) {
        setState(() {
          _caseData = fetched;
        });
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Ralat memuatkan kes: $e');
      }
    } finally {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  void _launchWhatsApp(String phone, String recipientName, bool isBM) {
    final msg = isBM
        ? 'Hai $recipientName, berkenaan transaksi "${_case.caseName}".'
        : 'Hi $recipientName, regarding the transaction for "${_case.caseName}".';
    PhoneIntentHelper.launchWhatsApp(context, phone: phone, message: msg, isBM: isBM);
  }

  void _launchDialer(String phone, bool isBM) {
    PhoneIntentHelper.launchDialer(context, phone: phone, isBM: isBM);
  }

  Future<void> _updateMilestone(String newStatus, bool isBM) async {
    if (_case.status == newStatus) return;

    final oldStatus = _case.status;
    final nowFormatted = DateFormat('d MMM yyyy, h:mm a').format(DateTime.now());
    final changeLog = '$oldStatus ➔ $newStatus on $nowFormatted';

    HapticFeedback.lightImpact();
    setState(() {
      _caseData = _case.copyWith(
        status: newStatus,
        statusHistory: [..._case.statusHistory, changeLog],
      );
    });

    try {
      await ref.read(caseRepositoryProvider).updateCaseStatus(
        _case.id,
        newStatus,
        changeLog: changeLog,
      );

      if (mounted) {
        AppToast.success(
          context,
          isBM ? 'Peringkat kes dikemaskini ke "$newStatus"!' : 'Case stage updated to "$newStatus"!',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, isBM ? 'Gagal mengemaskini status: $e' : 'Failed to update status: $e');
      }
    }
  }

  Future<void> _scheduleReminder(bool isBM, AppThemeColors colors) async {
    final noteController = TextEditingController(text: _case.reminderNote);
    DateTime selectedDate = DateTime.now().add(const Duration(days: 3));

    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              backgroundColor: colors.surface,
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: colors.border)),
              title: Text(
                isBM ? 'Tetapkan Peringatan' : 'Set Reminder',
                style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
              ),
              content: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    isBM ? 'Pilih Tarikh Tindakan Susulan:' : 'Select Follow-up Date:',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 6),
                  InkWell(
                    onTap: () async {
                      final p = await showDatePicker(
                        context: context,
                        initialDate: selectedDate,
                        firstDate: DateTime.now(),
                        lastDate: DateTime.now().add(const Duration(days: 365)),
                      );
                      if (p != null) setDialogState(() => selectedDate = p);
                    },
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      decoration: BoxDecoration(
                        color: colors.canvas,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.calendar_month, size: 16, color: colors.maroonPrimary),
                          const SizedBox(width: 8),
                          Text(DateFormat('d MMM yyyy').format(selectedDate), style: TextStyle(color: colors.textPrimary)),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: noteController,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Nota Peringatan' : 'Reminder Note',
                      hintText: isBM ? 'Contoh: Hubungi banker untuk semak offer letter' : 'E.g.: Call banker to check offer letter',
                      filled: true,
                      fillColor: colors.canvas,
                      labelStyle: TextStyle(color: colors.textMuted, fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8), borderSide: BorderSide(color: colors.border)),
                    ),
                  ),
                ],
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(ctx, false),
                  child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
                ),
                ElevatedButton(
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.maroonPrimary, foregroundColor: Colors.white),
                  onPressed: () => Navigator.pop(ctx, true),
                  child: Text(isBM ? 'Simpan' : 'Save'),
                ),
              ],
            );
          },
        );
      },
    );

    if (confirmed == true) {
      final dateStr = DateFormat('yyyy-MM-dd').format(selectedDate);
      final noteStr = noteController.text.trim();
      setState(() {
        _case = _case.copyWith(reminderDate: dateStr, reminderNote: noteStr);
      });
      await ref.read(caseRepositoryProvider).updateReminder(_case.id, dateStr, noteStr);
      if (mounted) {
        AppToast.success(context, isBM ? 'Peringatan susulan berjaya disimpan!' : 'Reminder saved successfully!');
        // Sync to phone calendar directly
        CalendarIntentService.addEventToCalendar(
          title: 'Follow-up: ${_case.caseName}',
          startTime: selectedDate,
          description: noteStr.isNotEmpty ? noteStr : 'Tindakan susulan kes hartanah Artha',
        );
      }
    }
  }

  void _confirmDeleteCase(bool isBM, AppThemeColors colors) {
    if (_caseData == null) return;
    final c = _case;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.surface,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide(color: colors.border)),
        title: Text(isBM ? 'Padam Kes' : 'Delete Case', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Text(
          isBM
              ? 'Adakah anda pasti mahu memadam kes "${c.caseName}"?'
              : 'Are you sure you want to permanently delete case "${c.caseName}"?',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(caseRepositoryProvider).deleteCase(c.id);
              if (mounted) {
                Navigator.pop(context);
                AppToast.success(context, isBM ? 'Kes telah dipadam.' : 'Case deleted.');
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            child: Text(isBM ? 'Padam' : 'Delete'),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionTitle(String title, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w700,
          color: colors.maroonPrimary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  Widget _buildStakeholderTile({
    required String role,
    required String name,
    required String phone,
    String? ic,
    required Color roleColor,
    required bool isBM,
    required AppThemeColors colors,
  }) {
    final displayName = name.isNotEmpty ? name : (isBM ? 'Belum ditetapkan' : 'Not assigned');
    final hasPhone = phone.trim().isNotEmpty;

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(12),
        border: Border(left: BorderSide(color: roleColor, width: 4)),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  role.toUpperCase(),
                  style: TextStyle(fontSize: 10, fontWeight: FontWeight.w800, color: roleColor, letterSpacing: 0.5),
                ),
                const SizedBox(height: 3),
                Text(
                  displayName,
                  style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
                ),
                if (hasPhone) ...[
                  const SizedBox(height: 2),
                  Text(phone, style: TextStyle(fontSize: 12, color: colors.textMuted)),
                ],
                if (ic != null && ic.isNotEmpty) ...[
                  const SizedBox(height: 2),
                  Text('IC: $ic', style: TextStyle(fontSize: 11, color: colors.textDim)),
                ],
              ],
            ),
          ),
          if (hasPhone) ...[
            InkWell(
              onTap: () => _launchDialer(phone, isBM),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(color: colors.maroonLight, shape: BoxShape.circle),
                child: Icon(Icons.phone_outlined, size: 18, color: colors.maroonPrimary),
              ),
            ),
            const SizedBox(width: 8),
            InkWell(
              onTap: () => _launchWhatsApp(phone, displayName, isBM),
              borderRadius: BorderRadius.circular(8),
              child: Container(
                width: 36,
                height: 36,
                decoration: const BoxDecoration(color: Color(0x2E10B981), shape: BoxShape.circle),
                child: const Icon(Icons.chat_bubble_outline_rounded, size: 18, color: Color(0xFF10B981)),
              ),
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
      );
    }
    if (_caseData == null && widget.caseId != null) {
      return Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(backgroundColor: colors.card),
        body: Center(child: Text(isBM ? 'Kes tidak dijumpai' : 'Case not found', style: TextStyle(color: colors.textMuted))),
      );
    }
    final currentStepIndex = _milestones.indexOf(_case.status);

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        title: Text(_case.caseName, style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.textPrimary)),
        backgroundColor: colors.card,
        elevation: 0,
        actions: [
          IconButton(
            icon: Icon(Icons.edit_outlined, color: colors.maroonPrimary),
            tooltip: isBM ? 'Kemaskini Kes' : 'Edit Case',
            onPressed: () async {
              await context.push('/case/form?id=${_case.id}');
              final refreshed = await ref.read(caseRepositoryProvider).getCaseById(_case.id);
              if (refreshed != null && mounted) {
                setState(() => _caseData = refreshed);
              }
            },
          ),
          IconButton(
            icon: const Icon(Icons.delete_outline, color: Colors.redAccent),
            tooltip: isBM ? 'Padam Kes' : 'Delete Case',
            onPressed: () => _confirmDeleteCase(isBM, colors),
          ),
        ],
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Status & Overview Card
            Container(
              padding: const EdgeInsets.all(18),
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
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                        decoration: BoxDecoration(
                          color: colors.maroonLight,
                          borderRadius: BorderRadius.circular(8),
                          border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                        ),
                        child: Text(
                          CaseCardWidget.getMilestoneDisplay(_case.status, isBM),
                          style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 11, letterSpacing: 0.8),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                        decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(8), border: Border.all(color: colors.border)),
                        child: Text(_case.financeType, style: TextStyle(color: colors.textSecondary, fontSize: 11, fontWeight: FontWeight.w600)),
                      ),
                    ],
                  ),
                  if (_case.price > 0) ...[
                    const SizedBox(height: 14),
                    Text(
                      CurrencyFormatter.format(_case.price),
                      style: TextStyle(color: colors.textPrimary, fontSize: 26, fontWeight: FontWeight.bold),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${isBM ? "Anggaran Komisen Agensi (2%):" : "Estimated Agency Commission (2%):"} ${CurrencyFormatter.format((_case.price * 0.02).round())}',
                      style: const TextStyle(color: Color(0xFF10B981), fontSize: 12, fontWeight: FontWeight.w600),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 16),

            // Milestone Stepper
            _buildSectionTitle(isBM ? 'KEMAJUAN TRANSAKSI (MILESTONES)' : 'TRANSACTION MILESTONES', colors),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                children: List.generate(_milestones.length, (index) {
                  final stepName = _milestones[index];
                  final isPassed = currentStepIndex >= index && currentStepIndex != -1;
                  final isCurrent = currentStepIndex == index;

                  return InkWell(
                    onTap: () => _updateMilestone(stepName, isBM),
                    borderRadius: BorderRadius.circular(10),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        children: [
                          Container(
                            width: 28,
                            height: 28,
                            decoration: BoxDecoration(
                              shape: BoxShape.circle,
                              color: isPassed ? colors.maroonPrimary : colors.surface,
                              border: Border.all(color: isPassed ? colors.maroonPrimary : colors.border),
                            ),
                            child: Center(
                              child: isPassed
                                  ? const Icon(Icons.check, size: 16, color: Colors.white)
                                  : Text('${index + 1}', style: TextStyle(color: colors.textMuted, fontSize: 11)),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              stepName,
                              style: TextStyle(
                                color: isCurrent
                                    ? colors.maroonPrimary
                                    : (isPassed ? colors.textPrimary : colors.textMuted),
                                fontWeight: isCurrent ? FontWeight.bold : FontWeight.normal,
                                fontSize: 13.5,
                              ),
                            ),
                          ),
                          if (isCurrent)
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(color: colors.maroonPrimary, borderRadius: BorderRadius.circular(10)),
                              child: Text(
                                isBM ? 'SEMASA' : 'CURRENT',
                                style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                }),
              ),
            ),
            const SizedBox(height: 16),

            // Stakeholders & Contacts
            _buildSectionTitle(isBM ? 'PIHAK TERLIBAT & HUBUNGAN' : 'STAKEHOLDERS & CONTACTS', colors),
            _buildStakeholderTile(
              role: isBM ? 'Vendor (Penjual)' : 'Vendor (Seller)',
              name: _case.vendorName,
              phone: _case.vendorPhone,
              ic: _case.vendorIC,
              roleColor: const Color(0xFFE11D48),
              isBM: isBM,
              colors: colors,
            ),
            const SizedBox(height: 8),
            _buildStakeholderTile(
              role: isBM ? 'Pembeli' : 'Buyer',
              name: _case.buyerName,
              phone: _case.buyerPhone,
              ic: _case.buyerIC,
              roleColor: const Color(0xFF3B82F6),
              isBM: isBM,
              colors: colors,
            ),
            const SizedBox(height: 8),
            _buildStakeholderTile(
              role: isBM ? 'Peguam SPA' : 'SPA Lawyer',
              name: _case.lawyerName,
              phone: _case.lawyerPhone,
              roleColor: const Color(0xFF8B5CF6),
              isBM: isBM,
              colors: colors,
            ),
            const SizedBox(height: 8),
            _buildStakeholderTile(
              role: isBM ? 'Pegawai Bank (Banker)' : 'Banker',
              name: _case.bankerName,
              phone: _case.bankerPhone,
              roleColor: const Color(0xFF10B981),
              isBM: isBM,
              colors: colors,
            ),
            const SizedBox(height: 16),

            // Follow-up Reminder Card
            _buildSectionTitle(isBM ? 'PERINGATAN TINDAKAN SUSULAN' : 'FOLLOW-UP REMINDER', colors),
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Icon(Icons.alarm_on_rounded, color: colors.maroonPrimary, size: 24),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          _case.reminderDate.isNotEmpty
                              ? '${isBM ? "Tarikh:" : "Date:"} ${_case.reminderDate}'
                              : (isBM ? 'Tiada peringatan aktif' : 'No active reminder'),
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                        ),
                        if (_case.reminderNote.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(_case.reminderNote, style: TextStyle(color: colors.textMuted, fontSize: 12)),
                        ],
                      ],
                    ),
                  ),
                  if (_case.reminderDate.isNotEmpty)
                    IconButton(
                      icon: Icon(Icons.calendar_month_outlined, color: colors.maroonPrimary, size: 20),
                      tooltip: isBM ? 'Simpan ke Kalendar Telefon' : 'Sync to Device Calendar',
                      onPressed: () {
                        final parsedDate = DateTime.tryParse(_case.reminderDate) ?? DateTime.now();
                        CalendarIntentService.addEventToCalendar(
                          title: 'Follow-up: ${_case.caseName}',
                          startTime: parsedDate,
                          description: _case.reminderNote.isNotEmpty ? _case.reminderNote : 'Tindakan susulan kes hartanah Artha',
                        );
                      },
                    ),
                  TextButton(
                    onPressed: () => _scheduleReminder(isBM, colors),
                    child: Text(
                      _case.reminderDate.isNotEmpty
                          ? (isBM ? 'Ubah' : 'Edit')
                          : (isBM ? 'Tetapkan' : 'Set'),
                      style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            ),

            // Notes
            if (_case.notes.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildSectionTitle(isBM ? 'CATATAN KES' : 'CASE NOTES', colors),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colors.border),
                ),
                child: Text(_case.notes, style: TextStyle(color: colors.textPrimary, fontSize: 13, height: 1.4)),
              ),
            ],

            // History Log
            if (_case.statusHistory.isNotEmpty) ...[
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  _buildSectionTitle(
                    '${isBM ? "REKOD PERUBAHAN MILESTONE" : "MILESTONE AUDIT LOG"} (${_case.statusHistory.length})',
                    colors,
                  ),
                  if (_case.statusHistory.length > 3)
                    TextButton(
                      onPressed: () => setState(() => _isAuditLogExpanded = !_isAuditLogExpanded),
                      style: TextButton.styleFrom(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 0),
                        minimumSize: Size.zero,
                        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _isAuditLogExpanded
                                ? (isBM ? 'Tunjukkan Kurang' : 'Show Less')
                                : (isBM ? 'Lihat Semua' : 'View All'),
                            style: TextStyle(
                              color: colors.maroonPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          Icon(
                            _isAuditLogExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                            size: 16,
                            color: colors.maroonPrimary,
                          ),
                        ],
                      ),
                    ),
                ],
              ),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: () {
                    final reversedLogs = _case.statusHistory.reversed.toList();
                    final displayLogs = _isAuditLogExpanded ? reversedLogs : reversedLogs.take(3).toList();
                    return displayLogs.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final log = entry.value;
                      final isLast = idx == displayLogs.length - 1;
                      return Padding(
                        padding: EdgeInsets.only(bottom: isLast ? 0 : 10),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(top: 3),
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: idx == 0 ? colors.maroonPrimary : colors.textMuted.withValues(alpha: 0.5),
                                shape: BoxShape.circle,
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Text(
                                log,
                                style: TextStyle(
                                  color: idx == 0 ? colors.textPrimary : colors.textSecondary,
                                  fontSize: 12.5,
                                  fontWeight: idx == 0 ? FontWeight.w600 : FontWeight.w400,
                                  height: 1.35,
                                ),
                              ),
                            ),
                          ],
                        ),
                      );
                    }).toList();
                  }(),
                ),
              ),
            ],
            const SizedBox(height: 40),
          ],
        ),
      ),
    );
  }
}
