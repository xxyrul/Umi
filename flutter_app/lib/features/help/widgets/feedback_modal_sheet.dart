import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_toast.dart';

class FeedbackModalSheet extends StatefulWidget {
  final bool isBM;

  const FeedbackModalSheet({super.key, required this.isBM});

  static void show(BuildContext context, bool isBM) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => FeedbackModalSheet(isBM: isBM),
    );
  }

  @override
  State<FeedbackModalSheet> createState() => _FeedbackModalSheetState();
}

class _FeedbackModalSheetState extends State<FeedbackModalSheet> {
  String _category = 'Masalah';
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _notesController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback() async {
    final title = _titleController.text.trim();
    final desc = _descController.text.trim();

    if (title.isEmpty || desc.isEmpty) {
      AppToast.error(
        context,
        widget.isBM ? 'Sila isi tajuk dan penerangan maklum balas.' : 'Please enter a title and description.',
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final user = FirebaseAuth.instance.currentUser;

    try {
      final docRef = FirebaseFirestore.instance.collection('feedback').doc();
      final type = _category == 'Masalah'
          ? 'BUG'
          : (_category == 'Cadangan' ? 'FEATURE_REQUEST' : 'GENERAL');
      final feedbackData = {
        'id': docRef.id,
        'type': type,
        'category': _category,
        'title': title,
        'description': desc,
        'notes': _notesController.text.trim(),
        'userId': user?.uid ?? '',
        'userName': user?.displayName ?? 'Ejen',
        'userEmail': user?.email ?? '',
        'status': 'pending',
        'adminResponse': '',
        'createdAt': FieldValue.serverTimestamp(),
      };

      await docRef.set(feedbackData);

      // Dispatch alert to Admins via FCM topic admin_alerts
      try {
        final dio = Dio();
        await dio.post(
          'https://sendbroadcastpush-qmzvmlyqza-uc.a.run.app',
          data: {
            'topic': 'admin_alerts',
            'kind': 'feedback-submitted',
            'titleEN': 'New Feedback Ticket 💬',
            'titleBM': 'Maklum Balas Baharu 💬',
            'messageEN': '${user?.displayName ?? 'Agent'}: "$title"',
            'messageBM': '${user?.displayName ?? 'Ejen'}: "$title"',
            'type': 'FEEDBACK',
          },
          options: Options(headers: {'Content-Type': 'application/json'}),
        );
      } catch (_) {}

      if (mounted) {
        Navigator.pop(context);
        AppToast.success(
          context,
          widget.isBM
              ? 'Maklum balas berjaya dihantar ke Meja Bantuan pentadbir!'
              : 'Feedback submitted successfully to the admin desk!',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context,
          widget.isBM ? 'Gagal menghantar maklum balas: $e' : 'Failed to submit feedback: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.sizeOf(context).height * 0.88,
      ),
      padding: EdgeInsets.only(bottom: bottomInset + context.safeBottomPadding(12.0)),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.textDim.withValues(alpha: 0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.rate_review_outlined, color: colors.maroonPrimary, size: 22),
                const SizedBox(width: 10),
                Text(
                  isBM ? 'Borang Maklum Balas Agensi' : 'Agency Feedback Form',
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: colors.textPrimary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(Icons.close, color: colors.textMuted, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          Flexible(
            child: SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Category Segmented Chips
                  Text(
                    isBM ? 'KATEGORI MAKLUM BALAS' : 'FEEDBACK CATEGORY',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colors.textMuted, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildCatChip('Masalah', isBM ? '⚠️ Masalah' : '⚠️ Issue', colors),
                      const SizedBox(width: 8),
                      _buildCatChip('Cadangan', isBM ? '💡 Cadangan' : '💡 Suggestion', colors),
                      const SizedBox(width: 8),
                      _buildCatChip('Pertanyaan', isBM ? '💬 Pertanyaan' : '💬 Inquiry', colors),
                    ],
                  ),

                  const SizedBox(height: 18),

                  // Title Input
                  TextField(
                    controller: _titleController,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Tajuk / Perkara' : 'Subject',
                      hintText: isBM ? 'Contoh: Masalah simpan gambar listing' : 'E.g.: Issue saving listing photos',
                      filled: true,
                      fillColor: colors.surface,
                      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                      hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Description Input
                  TextField(
                    controller: _descController,
                    maxLines: 4,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Penerangan Terperinci' : 'Detailed Description',
                      hintText: isBM
                          ? 'Terangkan apa yang berlaku atau cadangan anda...'
                          : 'Describe what happened or your suggestion...',
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: colors.surface,
                      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                      hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Additional Notes
                  TextField(
                    controller: _notesController,
                    maxLines: 2,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Maklumat Tambahan (Pilihan)' : 'Additional Notes (Optional)',
                      hintText: isBM ? 'Sebarang butiran lain yang berkaitan...' : 'Any other relevant details...',
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: colors.surface,
                      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                      hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    ),
                  ),

                  const SizedBox(height: 22),

                  // Submit Button
                  ElevatedButton(
                    onPressed: _isSubmitting ? null : _submitFeedback,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.maroonPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    child: _isSubmitting
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                          )
                        : Text(
                            isBM ? 'HANTAR MAKLUM BALAS' : 'SUBMIT FEEDBACK',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                          ),
                  ),
                  const SizedBox(height: 12),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCatChip(String cat, String label, AppThemeColors colors) {
    final isSelected = _category == cat;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _category = cat),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? colors.maroonPrimary : colors.surface,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
          ),
          child: Center(
            child: Text(
              label,
              style: TextStyle(
                color: isSelected ? Colors.white : colors.textSecondary,
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
