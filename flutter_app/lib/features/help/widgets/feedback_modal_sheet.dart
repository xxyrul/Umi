import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:url_launcher/url_launcher.dart';
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
  String _category = 'Bug';
  String _severity = 'Medium';
  final _titleController = TextEditingController();
  final _descController = TextEditingController();
  final _stepsController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _descController.dispose();
    _stepsController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback({bool dispatchWhatsApp = false}) async {
    final title = _titleController.text.trim();
    final desc = _descController.text.trim();

    if (title.isEmpty || desc.isEmpty) {
      AppToast.error(
        context,
        widget.isBM ? 'Sila isi tajuk dan penerangan isu.' : 'Please enter a title and description.',
      );
      return;
    }

    setState(() => _isSubmitting = true);

    final user = FirebaseAuth.instance.currentUser;
    final deviceModel = Platform.isAndroid ? 'Android Device' : 'iOS Device';

    try {
      final docRef = FirebaseFirestore.instance.collection('feedback').doc();
      final feedbackData = {
        'id': docRef.id,
        'category': _category,
        'severity': _severity,
        'title': title,
        'description': desc,
        'steps': _stepsController.text.trim(),
        'userId': user?.uid ?? 'anonymous',
        'userEmail': user?.email ?? '',
        'device': deviceModel,
        'osVersion': Platform.operatingSystemVersion,
        'appVersion': '1.0.0+1',
        'createdAt': FieldValue.serverTimestamp(),
      };

      await docRef.set(feedbackData);

      if (dispatchWhatsApp) {
        final waText = StringBuffer();
        waText.writeln('🚨 *[ARTHA FEEDBACK / BUG REPORT]*');
        waText.writeln('Kategori: $_category ($_severity)');
        waText.writeln('Tajuk: $title');
        waText.writeln('Penerangan: $desc');
        if (_stepsController.text.trim().isNotEmpty) {
          waText.writeln('Langkah: ${_stepsController.text.trim()}');
        }
        waText.writeln('Ejen: ${user?.email ?? "Unknown"}');
        waText.writeln('Peranti: $deviceModel (${Platform.operatingSystemVersion})');

        final encoded = Uri.encodeComponent(waText.toString());
        final waUrl = Uri.parse('https://wa.me/60123456789?text=$encoded');
        await launchUrl(waUrl, mode: LaunchMode.externalApplication);
      }

      if (mounted) {
        Navigator.pop(context);
        AppToast.success(
          context,
          widget.isBM ? 'Maklum balas berjaya dihantar! Terima kasih.' : 'Feedback submitted successfully! Thank you.',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Gagal menghantar maklum balas: $e');
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;

    return Container(
      height: MediaQuery.of(context).size.height * 0.85,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.textDim.withOpacity(0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.bug_report_outlined, color: colors.maroonPrimary, size: 24),
                const SizedBox(width: 10),
                Text(
                  isBM ? 'Laporan Isu & Maklum Balas' : 'Issue Report & Feedback',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
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

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Category Segmented Chips
                  Text(
                    isBM ? 'KATEGORI' : 'CATEGORY',
                    style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colors.textMuted, letterSpacing: 0.5),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _buildCatChip('Bug', isBM ? '🐞 Ralat (Bug)' : '🐞 Bug', colors),
                      const SizedBox(width: 8),
                      _buildCatChip('Feature', isBM ? '💡 Cadangan' : '💡 Feature', colors),
                      const SizedBox(width: 8),
                      _buildCatChip('Data', isBM ? '⚠️ Isu Data' : '⚠️ Data Issue', colors),
                    ],
                  ),

                  const SizedBox(height: 16),

                  // Severity
                  if (_category == 'Bug') ...[
                    Text(
                      isBM ? 'TAHAP KRITIKAL' : 'SEVERITY',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colors.textMuted, letterSpacing: 0.5),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        _buildSevChip('Low', Colors.blue, colors),
                        const SizedBox(width: 8),
                        _buildSevChip('Medium', Colors.orange, colors),
                        const SizedBox(width: 8),
                        _buildSevChip('High', Colors.deepOrange, colors),
                        const SizedBox(width: 8),
                        _buildSevChip('Critical', Colors.red, colors),
                      ],
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Title Input
                  TextField(
                    controller: _titleController,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Ringkasan Isu / Tajuk' : 'Issue Summary / Title',
                      filled: true,
                      fillColor: colors.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Description Input
                  TextField(
                    controller: _descController,
                    maxLines: 3,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Penerangan terperinci' : 'Detailed description',
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: colors.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),

                  const SizedBox(height: 14),

                  // Reproduction Steps
                  TextField(
                    controller: _stepsController,
                    maxLines: 2,
                    style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Langkah untuk menghasilkan isu (opsyenal)' : 'Steps to reproduce (optional)',
                      alignLabelWithHint: true,
                      filled: true,
                      fillColor: colors.surface,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),

                  const SizedBox(height: 24),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: _isSubmitting ? null : () => _submitFeedback(dispatchWhatsApp: true),
                          icon: const Icon(Icons.chat_outlined, size: 18),
                          label: Text(isBM ? 'Hantar ke WhatsApp' : 'WhatsApp Support'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: colors.textPrimary,
                            side: BorderSide(color: colors.border),
                            padding: const EdgeInsets.symmetric(vertical: 14),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _isSubmitting ? null : () => _submitFeedback(dispatchWhatsApp: false),
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
                              : Text(isBM ? 'Hantar Laporan' : 'Submit Report'),
                        ),
                      ),
                    ],
                  ),
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

  Widget _buildSevChip(String sev, Color color, AppThemeColors colors) {
    final isSelected = _severity == sev;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _severity = sev),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? color.withOpacity(0.18) : colors.surface,
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: isSelected ? color : colors.border, width: isSelected ? 1.5 : 1),
          ),
          child: Center(
            child: Text(
              sev,
              style: TextStyle(
                color: isSelected ? color : colors.textMuted,
                fontSize: 10,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
