import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/calendar_intent_service.dart';
import '../../core/widgets/app_toast.dart';

class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  bool _isAddingReminder = false;

  Future<void> _addReminder() async {
    if (_isAddingReminder) return;
    setState(() => _isAddingReminder = true);

    final isBM = ref.read(languageProvider) == 'BM';
    final start = DateTime.now().add(const Duration(days: 1));
    final end = start.add(const Duration(hours: 1));

    try {
      final launched = await CalendarIntentService.addEventToCalendar(
        title: isBM ? 'Susulan Klien & Semak Status Pinjaman' : 'Client Follow-up & Loan Status Check',
        startTime: start,
        endTime: end,
        location: 'Pejabat Artha Master Listing',
        description: isBM
            ? 'Susulan status permohonan pinjaman bank pembeli.'
            : 'Follow up the buyer bank loan application status.',
      );

      if (mounted && !launched) {
        AppToast.error(context, isBM ? 'Tidak dapat membuka kalendar.' : 'Could not open the calendar.');
      }
    } catch (_) {
      if (mounted) {
        AppToast.error(context, isBM ? 'Gagal menambah peringatan.' : 'Failed to add reminder.');
      }
    } finally {
      if (mounted) setState(() => _isAddingReminder = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final bottomInset = MediaQuery.of(context).padding.bottom;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Center(
          child: Padding(
            padding: EdgeInsets.fromLTRB(24, 24, 24, bottomInset + 92),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: colors.maroonLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
                  ),
                  child: Icon(Icons.calendar_month_outlined, size: 48, color: colors.maroonPrimary),
                ),
                const SizedBox(height: 20),
                Text(
                  isBM ? 'Tugasan & Peringatan' : 'Tasks & Reminders',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.w700, color: colors.textPrimary),
                ),
                const SizedBox(height: 8),
                Text(
                  isBM
                      ? 'Tambah susulan klien terus ke kalendar peranti anda.'
                      : 'Add a client follow-up directly to your device calendar.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 14, height: 1.5, color: colors.textMuted),
                ),
                const SizedBox(height: 24),
                ElevatedButton.icon(
                  onPressed: _isAddingReminder ? null : _addReminder,
                  icon: _isAddingReminder
                      ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                      : const Icon(Icons.event_available_outlined),
                  label: Text(isBM ? 'Tambah Peringatan' : 'Add Reminder'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
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
