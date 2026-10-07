import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../data/faq_data.dart';

class FaqTab extends ConsumerWidget {
  final VoidCallback onGoToSubmit;
  final VoidCallback onGoToHistory;

  const FaqTab({
    super.key,
    required this.onGoToSubmit,
    required this.onGoToHistory,
  });

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final faqs = isBM ? kFaqsBM : kFaqsEN;

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
      children: [
        // Feedback Desk Action Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: colors.maroonPrimary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.support_agent_rounded, color: colors.maroonPrimary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isBM ? 'Pusat Maklum Balas Agensi' : 'Agency Feedback Desk',
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isBM
                              ? 'Hantar sebarang isu atau cadangan terus ke meja pentadbir & semak jawapan pembangun'
                              : 'Submit issues or suggestions directly to admin desk & check dev replies',
                          style: TextStyle(color: colors.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: onGoToSubmit,
                      icon: const Icon(Icons.edit_note_rounded, size: 16),
                      label: Text(
                        isBM ? 'Hantar Maklum Balas' : 'Submit Feedback',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.maroonPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: onGoToHistory,
                      icon: const Icon(Icons.history_rounded, size: 16),
                      label: Text(
                        isBM ? 'Rekod & Status' : 'Ticket History',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colors.textPrimary),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: colors.border),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        Text(
          isBM ? 'SOALAN LAZIM (FAQ)' : 'FREQUENTLY ASKED QUESTIONS',
          style: TextStyle(color: colors.maroonPrimary, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
        ),
        const SizedBox(height: 10),

        ...faqs.map((faq) {
          return Container(
            margin: const EdgeInsets.only(bottom: 10),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: ExpansionTile(
              shape: const Border(),
              collapsedShape: const Border(),
              iconColor: colors.maroonPrimary,
              collapsedIconColor: colors.textMuted,
              title: Text(
                faq.question,
                style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
              ),
              children: [
                Padding(
                  padding: const EdgeInsets.only(left: 16, right: 16, bottom: 14),
                  child: Text(
                    faq.answer,
                    style: TextStyle(color: colors.textSecondary, fontSize: 12.5, height: 1.45),
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}
