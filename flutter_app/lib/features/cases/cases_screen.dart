import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/interactive_bounce_fab.dart';
import '../../core/widgets/app_toast.dart';
import 'case_model.dart';
import 'case_repository.dart';
import 'widgets/case_card_widget.dart';

class CasesScreen extends ConsumerStatefulWidget {
  final String? initialStatus;
  const CasesScreen({super.key, this.initialStatus});

  @override
  ConsumerState<CasesScreen> createState() => _CasesScreenState();
}

class _CasesScreenState extends ConsumerState<CasesScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;
  final ScrollController _filterScrollController = ScrollController();
  String _selectedStatus = 'All';

  final List<String> _statusFilters = [
    'All',
    'Active',
    'Viewing',
    'Booking Paid',
    'Loan Approved',
    'SPA Signed',
    'Completed',
    'Cancelled',
  ];

  final List<GlobalKey> _filterKeys = [];

  @override
  void initState() {
    super.initState();
    if (widget.initialStatus != null && widget.initialStatus!.isNotEmpty) {
      _selectedStatus = widget.initialStatus!;
    }
    for (int i = 0; i < _statusFilters.length; i++) {
      _filterKeys.add(GlobalKey());
    }
  }

  @override
  void didUpdateWidget(covariant CasesScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.initialStatus != null && widget.initialStatus != oldWidget.initialStatus) {
      setState(() => _selectedStatus = widget.initialStatus!);
      final idx = _statusFilters.indexWhere((s) => s.toLowerCase() == widget.initialStatus!.toLowerCase());
      if (idx != -1) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _scrollToFilter(idx));
      }
    }
  }

  @override
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    _filterScrollController.dispose();
    super.dispose();
  }

  void _scrollToFilter(int index) {
    if (index < 0 || index >= _filterKeys.length) return;
    final context = _filterKeys[index].currentContext;
    if (context != null) {
      Scrollable.ensureVisible(
        context,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeInOut,
        alignment: 0.5,
      );
    }
  }

  Future<void> _scheduleReminder(BuildContext context, CaseModel caseItem, bool isBM) async {
    final selectedDate = await showDatePicker(
      context: context,
      firstDate: DateTime.now(),
      lastDate: DateTime.now().add(const Duration(days: 3650)),
      initialDate: DateTime.now().add(const Duration(days: 3)),
      helpText: isBM ? 'Pilih tarikh susulan' : 'Choose follow-up date',
    );
    if (selectedDate == null || !mounted) return;

    final noteController = TextEditingController(text: caseItem.reminderNote);
    final note = await showDialog<String>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(isBM ? 'Tetapkan Susulan' : 'Schedule Follow-up'),
        content: TextField(
          controller: noteController,
          autofocus: true,
          maxLines: 3,
          decoration: InputDecoration(
            labelText: isBM ? 'Nota (pilihan)' : 'Note (optional)',
            hintText: isBM ? 'Contoh: Semak status pinjaman' : 'Example: Check loan status',
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dialogContext), child: Text(isBM ? 'Batal' : 'Cancel')),
          FilledButton(onPressed: () => Navigator.pop(dialogContext, noteController.text.trim()), child: Text(isBM ? 'Simpan' : 'Save')),
        ],
      ),
    );
    noteController.dispose();
    if (note == null || !mounted) return;

    final dateValue = selectedDate.toIso8601String().split('T').first;
    final finalNote = note.isEmpty
        ? (isBM ? 'Semak susulan kes ${caseItem.caseName}' : 'Follow up ${caseItem.caseName}')
        : note;
    try {
      await ref.read(caseRepositoryProvider).updateReminder(caseItem.id, dateValue, finalNote);
      ref.invalidate(casesStreamProvider);
      if (mounted) {
        AppToast.success(context, isBM ? 'Susulan berjaya ditetapkan' : 'Follow-up scheduled');
      }
    } catch (_) {
      if (mounted) {
        AppToast.error(context, isBM ? 'Gagal menetapkan susulan' : 'Failed to schedule follow-up');
      }
    }
  }

  List<CaseModel> _filterCases(List<CaseModel> cases) {
    return cases.where((c) {
      // 1. Status Filter
      if (_selectedStatus != 'All') {
        if (_selectedStatus == 'Active') {
          if (c.status == 'Completed' || c.status == 'Cancelled') return false;
        } else if (c.status.toLowerCase() != _selectedStatus.toLowerCase()) {
          return false;
        }
      }

      // 2. Search Query Filter
      final query = _searchController.text.trim().toLowerCase();
      if (query.isNotEmpty) {
        final matchesName = c.caseName.toLowerCase().contains(query);
        final matchesVendor = c.vendorName.toLowerCase().contains(query);
        final matchesBuyer = c.buyerName.toLowerCase().contains(query);
        final matchesPhone = c.vendorPhone.contains(query) || c.buyerPhone.contains(query);
        if (!matchesName && !matchesVendor && !matchesBuyer && !matchesPhone) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final casesAsync = ref.watch(casesStreamProvider);
    final allCases = casesAsync.value ?? [];
    final filtered = _filterCases(allCases);
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    final bottomInset = MediaQuery.of(context).padding.bottom;
    final floatingBarBottom = bottomInset > 0 ? bottomInset + 8.0 : 20.0;
    final fabBottom = floatingBarBottom + 58.0 + 12.0;
    final scrollBottom = floatingBarBottom + 58.0 + 44.0;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Header Bar: Cases Management
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 16, top: 14, bottom: 8),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isBM ? 'Pengurusan Kes' : 'Case Management',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.w800,
                      color: colors.textPrimary,
                    ),
                  ),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.maroonLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Text(
                      '${filtered.length} ${isBM ? "Kes" : "Cases"}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w800,
                        color: colors.maroonPrimary,
                      ),
                    ),
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              child: Container(
                height: 44,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) {
                    _searchDebounce?.cancel();
                    _searchDebounce = Timer(const Duration(milliseconds: 220), () {
                      if (mounted) setState(() {});
                    });
                  },
                  style: TextStyle(color: colors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: isBM ? 'Cari kes, vendor, pembeli, telefon...' : 'Search case, vendor, buyer, phone...',
                    hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                    prefixIcon: Icon(Icons.search, size: 20, color: colors.textMuted),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(Icons.close, size: 16, color: colors.textMuted),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 11),
                  ),
                ),
              ),
            ),

            // Horizontal Status Filter Pills
            SizedBox(
              height: 40,
              child: ListView.separated(
                controller: _filterScrollController,
                scrollDirection: Axis.horizontal,
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
                itemCount: _statusFilters.length,
                separatorBuilder: (_, __) => const SizedBox(width: 8),
                itemBuilder: (context, index) {
                  final status = _statusFilters[index];
                  final isSelected = _selectedStatus == status;

                  String displayLabel = status;
                  if (isBM) {
                    if (status == 'All') {
                      displayLabel = 'Semua';
                    } else if (status == 'Active') {
                      displayLabel = 'Aktif';
                    } else if (status == 'Viewing') {
                      displayLabel = 'Viewing';
                    } else if (status == 'Booking Paid') {
                      displayLabel = 'Bayaran Booking';
                    } else if (status == 'Loan Approved') {
                      displayLabel = 'Pinjaman Diluluskan';
                    } else if (status == 'SPA Signed') {
                      displayLabel = 'Peringkat SPA';
                    } else if (status == 'Completed') {
                      displayLabel = 'Selesai (Sold)';
                    } else if (status == 'Cancelled') {
                      displayLabel = 'Dibatalkan';
                    }
                  }

                  return InkWell(
                    key: _filterKeys[index],
                    onTap: () {
                      HapticFeedback.selectionClick();
                      setState(() => _selectedStatus = status);
                      _scrollToFilter(index);
                    },
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: isSelected ? colors.maroonPrimary : colors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isSelected ? colors.maroonPrimary : colors.border,
                        ),
                      ),
                      child: Text(
                        displayLabel,
                        style: TextStyle(
                          fontSize: 12,
                          fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                          color: isSelected ? Colors.white : colors.textMuted,
                        ),
                      ),
                    ),
                  );
                },
              ),
            ),
            const SizedBox(height: 8),

            // Cases List View
            Expanded(
              child: RefreshIndicator(
                color: AppColors.maroonPrimary,
                onRefresh: () async => ref.invalidate(casesStreamProvider),
                child: casesAsync.when(
                  loading: () => const Center(child: CircularProgressIndicator(color: AppColors.maroonPrimary)),
                  error: (e, st) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
                  data: (_) {
                    if (filtered.isEmpty) {
                      return ListView(
                        children: [
                          const SizedBox(height: 100),
                          Center(
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.folder_open_outlined, size: 56, color: colors.textDim),
                                const SizedBox(height: 12),
                                Text(
                                  isBM ? 'Tiada rekod transaksi dijumpai' : 'No transaction records found',
                                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w600, color: colors.textSecondary),
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  isBM
                                      ? 'Tekan butang + di bawah untuk mula daftar kes baru.'
                                      : "Press the '+' button below to start registering a new case.",
                                  style: TextStyle(fontSize: 12, color: colors.textMuted),
                                ),
                              ],
                            ),
                          ),
                        ],
                      );
                    }

                    return ListView.builder(
                      physics: const BouncingScrollPhysics(),
                      padding: EdgeInsets.only(left: 16, right: 16, top: 4, bottom: scrollBottom),
                      itemCount: filtered.length,
                      itemBuilder: (context, index) {
                        final caseItem = filtered[index];
                        return RepaintBoundary(
                          child: CaseCardWidget(
                            caseItem: caseItem,
                            onTap: () {
                              context.push('/case/${caseItem.id}', extra: caseItem);
                            },
                            onReminderTap: () => _scheduleReminder(context, caseItem, isBM),
                          ),
                        );
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
      floatingActionButton: Padding(
        padding: EdgeInsets.only(bottom: fabBottom),
        child: Transform.translate(
          offset: const Offset(0, 64),
          child: InteractiveBounceFab(
            onPressed: () => context.push('/case/form'),
            backgroundColor: colors.maroonPrimary,
            icon: const Icon(Icons.add, size: 28),
          ),
        ),
      ),
    );
  }
}
