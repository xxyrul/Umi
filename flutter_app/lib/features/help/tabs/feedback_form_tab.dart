import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_select_field.dart';
import '../../../core/widgets/app_toast.dart';
import '../../auth/auth_service.dart';
import '../feedback_service.dart';

class FeedbackFormTab extends ConsumerStatefulWidget {
  final VoidCallback onSuccessSubmitted;

  const FeedbackFormTab({
    super.key,
    required this.onSuccessSubmitted,
  });

  @override
  ConsumerState<FeedbackFormTab> createState() => _FeedbackFormTabState();
}

class _FeedbackFormTabState extends ConsumerState<FeedbackFormTab> {
  final _feedbackTitleController = TextEditingController();
  final _feedbackDescController = TextEditingController();
  final _feedbackNotesController = TextEditingController();
  String _feedbackType = 'BUG';
  bool _isSubmitting = false;

  @override
  void dispose() {
    _feedbackTitleController.dispose();
    _feedbackDescController.dispose();
    _feedbackNotesController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback(bool isBM) async {
    final title = _feedbackTitleController.text.trim();
    final desc = _feedbackDescController.text.trim();
    final notes = _feedbackNotesController.text.trim();

    if (title.isEmpty || desc.isEmpty) {
      AppToast.error(
        context,
        isBM
            ? 'Sila masukkan tajuk dan penerangan maklum balas.'
            : 'Please enter a feedback subject and description.',
      );
      return;
    }

    final user = ref.read(authStateProvider).value;
    setState(() => _isSubmitting = true);

    try {
      await ref.read(feedbackServiceProvider).submitFeedback(
        title: title,
        description: desc,
        notes: notes,
        type: _feedbackType,
        userId: user?.uid ?? '',
        userName: user?.displayName ?? 'Ejen',
        userEmail: user?.email ?? '',
      );

      _feedbackTitleController.clear();
      _feedbackDescController.clear();
      _feedbackNotesController.clear();

      if (mounted) {
        AppToast.success(
          context,
          isBM
              ? 'Maklum balas berjaya dihantar ke Meja Bantuan pentadbir!'
              : 'Feedback submitted successfully to admin desk!',
        );
        widget.onSuccessSubmitted();
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat menghantar maklum balas: $e' : 'Error submitting feedback: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    return SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: colors.maroonPrimary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    isBM
                        ? 'Sebarang maklum balas yang dihantar akan disalurkan terus kepada pentadbir. Anda boleh menyemak status dan jawapan di tab "Rekod & Status".'
                        : 'Submitted feedback goes directly to admins. You can review updates and dev answers in the "History & Status" tab.',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          AppSelectField<String>(
            label: isBM ? 'Kategori Maklum Balas' : 'Feedback Category',
            value: _feedbackType,
            colors: colors,
            items: [
              AppSelectItem(
                value: 'BUG',
                label: isBM ? 'Masalah Aplikasi' : 'App Issue / Glitch',
                subtitle: isBM
                    ? 'Paparan terhenti, butang tidak berfungsi atau ralat sistem'
                    : 'Unresponsive button, glitch, or app error',
                icon: Icons.warning_amber_rounded,
                iconColor: colors.error,
              ),
              AppSelectItem(
                value: 'FEATURE_REQUEST',
                label: isBM ? 'Cadangan Penambahbaikan' : 'Feature Suggestion',
                subtitle: isBM
                    ? 'Idea fungsi baharu untuk memudahkan urusan harian ejen'
                    : 'Ideas for new features to assist agent workflows',
                icon: Icons.lightbulb_outline,
                iconColor: colors.warning,
              ),
              AppSelectItem(
                value: 'GENERAL',
                label: isBM ? 'Pertanyaan / Am' : 'General / Inquiry',
                subtitle: isBM
                    ? 'Sebarang pertanyaan atau perkongsian maklum balas agensi'
                    : 'General questions or comments for agency support',
                icon: Icons.chat_bubble_outline,
                iconColor: colors.info,
              ),
            ],
            onChanged: (val) {
              setState(() => _feedbackType = val);
            },
          ),
          const SizedBox(height: 14),

          TextField(
            controller: _feedbackTitleController,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: isBM ? 'Tajuk / Perkara' : 'Subject',
              hintText: isBM
                  ? 'Contoh: Masalah simpan nombor telefon klien'
                  : 'E.g.: Issue saving client phone number',
              filled: true,
              fillColor: colors.surface,
              labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
              hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
          ),
          const SizedBox(height: 14),

          TextField(
            controller: _feedbackDescController,
            maxLines: 5,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: isBM ? 'Penerangan Terperinci' : 'Detailed Description',
              hintText: isBM
                  ? 'Terangkan apa yang berlaku atau cadangan anda secara terperinci...'
                  : 'Describe what happened or your suggestion in detail...',
              alignLabelWithHint: true,
              filled: true,
              fillColor: colors.surface,
              labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
              hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
          ),
          const SizedBox(height: 14),

          TextField(
            controller: _feedbackNotesController,
            maxLines: 2,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: isBM ? 'Catatan Tambahan (Pilihan)' : 'Additional Notes (Optional)',
              hintText: isBM
                  ? 'Model peranti, versi Android atau butiran lain...'
                  : 'Device model, Android version or other notes...',
              alignLabelWithHint: true,
              filled: true,
              fillColor: colors.surface,
              labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
              hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
          ),
          const SizedBox(height: 24),

          ElevatedButton(
            onPressed: _isSubmitting ? null : () => _submitFeedback(isBM),
            style: ElevatedButton.styleFrom(
              backgroundColor: colors.maroonPrimary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                  )
                : Text(
                    isBM ? 'HANTAR MAKLUM BALAS' : 'SUBMIT FEEDBACK',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
          ),
        ],
      ),
    );
  }
}
