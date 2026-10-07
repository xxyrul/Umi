import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_toast.dart';
import '../feedback_service.dart';

class TicketHistoryTab extends ConsumerStatefulWidget {
  final VoidCallback onGoToSubmit;

  const TicketHistoryTab({
    super.key,
    required this.onGoToSubmit,
  });

  @override
  ConsumerState<TicketHistoryTab> createState() => _TicketHistoryTabState();
}

class _TicketHistoryTabState extends ConsumerState<TicketHistoryTab> {
  String _historyFilter = 'ALL';

  Future<void> _deleteUserFeedback(String feedbackId, bool isBM) async {
    final colors = context.colors;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          isBM ? 'Padam Rekod Maklum Balas?' : 'Delete Feedback Record?',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
        ),
        content: Text(
          isBM
              ? 'Adakah anda pasti ingin memadam rekod maklum balas ini dari senarai anda?'
              : 'Are you sure you want to delete this feedback entry from your history?',
          style: TextStyle(color: colors.textMuted, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isBM ? 'Ya, Padam' : 'Yes, Delete', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await ref.read(feedbackServiceProvider).deleteFeedback(feedbackId);
        if (mounted) {
          AppToast.success(
            context,
            isBM ? 'Rekod maklum balas telah dipadam.' : 'Feedback record deleted.',
          );
        }
      } catch (e) {
        if (mounted) {
          AppToast.error(
            context,
            isBM ? 'Ralat memadam maklum balas: $e' : 'Error deleting feedback: $e',
          );
        }
      }
    }
  }

  Widget _buildFilterChip(String key, String label, AppThemeColors colors) {
    final isSelected = _historyFilter == key;
    return InkWell(
      onTap: () => setState(() => _historyFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final feedbackAsync = ref.watch(userFeedbackStreamProvider);

    return Column(
      children: [
        // Filter pills bar
        Container(
          color: colors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildFilterChip('ALL', isBM ? 'Semua' : 'All', colors),
              const SizedBox(width: 8),
              _buildFilterChip('pending', isBM ? 'Menunggu' : 'Pending', colors),
              const SizedBox(width: 8),
              _buildFilterChip('in-progress', isBM ? 'Tindakan' : 'In Progress', colors),
              const SizedBox(width: 8),
              _buildFilterChip('resolved', isBM ? 'Selesai' : 'Resolved', colors),
            ],
          ),
        ),

        Expanded(
          child: feedbackAsync.when(
            data: (tickets) {
              final filtered = tickets.where((t) {
                if (_historyFilter == 'ALL') return true;
                return t.status.toLowerCase() == _historyFilter.toLowerCase();
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: colors.card,
                            shape: BoxShape.circle,
                            border: Border.all(color: colors.border),
                          ),
                          child: Icon(Icons.mark_chat_unread_outlined, size: 44, color: colors.textMuted),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          isBM ? 'Tiada Rekod Maklum Balas' : 'No Feedback Records',
                          style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBM
                              ? 'Sebarang laporan masalah atau cadangan yang anda hantar akan dipaparkan di sini berserta status dan maklum balas daripada pembangun.'
                              : 'Any issue reports or suggestions you submit will appear here along with live status updates and developer replies.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          onPressed: widget.onGoToSubmit,
                          icon: const Icon(Icons.add, size: 16),
                          label: Text(
                            isBM ? 'Hantar Maklum Balas Pertama' : 'Submit First Feedback',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.maroonPrimary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              final dateFormat = DateFormat('d MMM yyyy, h:mm a');

              return ListView.builder(
                padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final ticket = filtered[index];
                  final isBug = ticket.type == 'BUG' || ticket.type == 'MASALAH';
                  final isFeature = ticket.type == 'FEATURE_REQUEST' || ticket.type == 'CADANGAN';
                  final hasResponse = ticket.adminResponse.isNotEmpty;

                  Color typeColor = Colors.blueAccent;
                  String typeLabel = isBM ? 'Pertanyaan' : 'General';
                  IconData typeIcon = Icons.chat_bubble_outline;

                  if (isBug) {
                    typeColor = Colors.redAccent;
                    typeLabel = isBM ? 'Masalah' : 'Issue';
                    typeIcon = Icons.warning_amber_rounded;
                  } else if (isFeature) {
                    typeColor = Colors.purpleAccent;
                    typeLabel = isBM ? 'Cadangan' : 'Suggestion';
                    typeIcon = Icons.lightbulb_outline;
                  }

                  Color statusColor = Colors.amber;
                  String statusLabel = isBM ? 'MENUNGGU SEMAKAN' : 'PENDING REVIEW';
                  IconData statusIcon = Icons.schedule_rounded;

                  if (ticket.status == 'in-progress') {
                    statusColor = Colors.orangeAccent;
                    statusLabel = isBM ? 'DALAM TINDAKAN' : 'IN PROGRESS';
                    statusIcon = Icons.build_circle_outlined;
                  } else if (ticket.status == 'resolved') {
                    statusColor = const Color(0xFF10B981);
                    statusLabel = isBM ? 'SELESAI' : 'RESOLVED';
                    statusIcon = Icons.check_circle_outline_rounded;
                  }

                  final createdText = ticket.createdAt != null ? dateFormat.format(ticket.createdAt!) : '';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: hasResponse
                            ? colors.maroonPrimary.withValues(alpha: 0.5)
                            : (isBug ? Colors.redAccent.withValues(alpha: 0.25) : colors.border),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Row: Type Chip + Status Pill + Delete Action
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: typeColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(typeIcon, size: 12, color: typeColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    typeLabel,
                                    style: TextStyle(color: typeColor, fontSize: 10.5, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(statusIcon, size: 12, color: statusColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    statusLabel,
                                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                            const Spacer(),
                            if (createdText.isNotEmpty)
                              Text(
                                createdText,
                                style: TextStyle(color: colors.textDim, fontSize: 10.5),
                              ),
                            const SizedBox(width: 4),
                            InkWell(
                              onTap: () => _deleteUserFeedback(ticket.id, isBM),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(4),
                                child: Icon(Icons.delete_outline_rounded, size: 16, color: colors.textDim),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Title
                        Text(
                          ticket.title,
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 6),

                        // Description
                        Text(
                          ticket.description,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.45),
                        ),

                        // Optional Notes
                        if (ticket.notes.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.border.withValues(alpha: 0.5)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.notes_rounded, size: 14, color: colors.textMuted),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    ticket.notes,
                                    style: TextStyle(color: colors.textMuted, fontSize: 11.5, fontStyle: FontStyle.italic),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // DEVELOPER / ADMIN RESPONSE BOX
                        const SizedBox(height: 14),
                        if (hasResponse)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: colors.maroonPrimary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.support_agent_rounded, size: 16, color: colors.maroonPrimary),
                                    const SizedBox(width: 6),
                                    Text(
                                      isBM ? 'Maklum Balas Pentadbir / Pembangun' : 'Admin & Developer Response',
                                      style: TextStyle(
                                        color: colors.maroonPrimary,
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Spacer(),
                                    if (ticket.status == 'resolved')
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          isBM ? 'SELESAI' : 'RESOLVED',
                                          style: const TextStyle(
                                            color: Color(0xFF10B981),
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  ticket.adminResponse,
                                  style: TextStyle(color: colors.textPrimary, fontSize: 12.5, height: 1.45),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  ticket.status == 'in-progress'
                                      ? Icons.build_circle_outlined
                                      : Icons.hourglass_top_rounded,
                                  size: 14,
                                  color: colors.textMuted,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    ticket.status == 'in-progress'
                                        ? (isBM
                                            ? 'Pasukan pembangun sedang meneliti laporan ini.'
                                            : 'Technical team is currently working on this report.')
                                        : (isBM
                                            ? 'Sedang menunggu semakan daripada pihak pentadbir agensi.'
                                            : 'Awaiting review from agency administration.'),
                                    style: TextStyle(color: colors.textMuted, fontSize: 11),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(
              child: CircularProgressIndicator(color: colors.maroonPrimary),
            ),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent)),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
