import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../admin_service.dart';

class AdminFeedbackTab extends ConsumerStatefulWidget {
  const AdminFeedbackTab({super.key});

  @override
  ConsumerState<AdminFeedbackTab> createState() => _AdminFeedbackTabState();
}

class _AdminFeedbackTabState extends ConsumerState<AdminFeedbackTab> {
  AppThemeColors get colors => context.colors;
  String _feedbackStatusFilter = 'ALL';

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final feedbackAsync = ref.watch(adminFeedbackStreamProvider);

    return Column(
      children: [
        // Filter Bar
        Container(
          color: colors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildFeedbackFilterChip('ALL', isBM ? 'SEMUA' : 'ALL'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('pending', isBM ? 'BARU' : 'PENDING'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('in-progress', isBM ? 'TINDAKAN' : 'IN PROGRESS'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('resolved', isBM ? 'SELESAI' : 'RESOLVED'),
            ],
          ),
        ),
        // Tickets List
        Expanded(
          child: feedbackAsync.when(
            data: (tickets) {
              final filtered = tickets.where((t) {
                if (_feedbackStatusFilter == 'ALL') return true;
                return t.status.toLowerCase() == _feedbackStatusFilter.toLowerCase();
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text(
                    isBM ? 'Tiada maklum balas direkodkan.' : 'No feedback tickets.',
                    style: TextStyle(color: colors.textMuted),
                  ),
                );
              }

              return ListView.builder(
                padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final ticket = filtered[index];
                  final isBug = ticket.type.toLowerCase() == 'bug';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isBug ? Colors.redAccent.withValues(alpha: 0.3) : colors.border,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tag Header
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isBug ? Colors.redAccent.withValues(alpha: 0.2) : Colors.blue.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                ticket.type.toUpperCase(),
                                style: TextStyle(
                                  color: isBug ? Colors.redAccent : Colors.blueAccent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                ticket.userName,
                                style: TextStyle(color: colors.textSecondary, fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: ticket.status == 'resolved'
                                    ? Colors.green.withValues(alpha: 0.2)
                                    : (ticket.status == 'in-progress' ? Colors.orange.withValues(alpha: 0.2) : Colors.amber.withValues(alpha: 0.2)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                ticket.status.toUpperCase(),
                                style: TextStyle(
                                  color: ticket.status == 'resolved'
                                      ? Colors.greenAccent
                                      : (ticket.status == 'in-progress' ? Colors.orangeAccent : Colors.amberAccent),
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          ticket.title,
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          ticket.description,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
                        ),
                        if (ticket.deviceModel.isNotEmpty || ticket.appVersion.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${ticket.deviceModel.isNotEmpty ? "${ticket.deviceModel} • " : ""}v${ticket.appVersion}',
                              style: TextStyle(color: colors.textMuted, fontSize: 10),
                            ),
                          ),
                        ],
                        // Screenshot preview
                        if (ticket.screenshotUrl.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          InkWell(
                            onTap: () => _viewFullScreenshot(ticket.screenshotUrl),
                            child: Container(
                              height: 100,
                              width: 140,
                              decoration: BoxDecoration(
                                color: colors.card,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: colors.border),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: CachedNetworkImage(
                                imageUrl: ticket.screenshotUrl,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => Center(child: Icon(Icons.broken_image, color: colors.textMuted)),
                              ),
                            ),
                          ),
                        ],
                        // Admin Response Section
                        if (ticket.adminResponse.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.reply, size: 16, color: colors.maroonPrimary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isBM ? 'Balasan Pentadbir:' : 'Admin Response:',
                                        style: TextStyle(color: colors.maroonPrimary, fontSize: 11, fontWeight: FontWeight.bold),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(ticket.adminResponse, style: TextStyle(color: colors.textPrimary, fontSize: 12)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Divider(color: colors.border, height: 1),
                        const SizedBox(height: 10),
                        // Action row: Change Status & Reply
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.comment, size: 14),
                              label: Text(isBM ? 'Balas' : 'Reply', style: const TextStyle(fontSize: 12)),
                              onPressed: () => _showFeedbackReplyDialog(ticket, isBM),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                side: BorderSide(color: colors.border),
                              ),
                            ),
                            const SizedBox(width: 8),
                            PopupMenuButton<String>(
                              onSelected: (newStatus) async {
                                await ref.read(adminServiceProvider).updateFeedbackStatus(ticket.id, newStatus);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: colors.maroonPrimary,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: [
                                    Text(
                                      isBM ? 'Tukar Status' : 'Status',
                                      style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                                    ),
                                    const Icon(Icons.arrow_drop_down, color: Colors.white, size: 16),
                                  ],
                                ),
                              ),
                              itemBuilder: (ctx) => [
                                const PopupMenuItem(value: 'pending', child: Text('Pending (Baru)')),
                                const PopupMenuItem(value: 'in-progress', child: Text('In Progress (Tindakan)')),
                                const PopupMenuItem(value: 'resolved', child: Text('Resolved (Selesai)')),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
            error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
          ),
        ),
      ],
    );
  }

  Widget _buildFeedbackFilterChip(String key, String label) {
    final isSelected = _feedbackStatusFilter == key;
    return InkWell(
      onTap: () => setState(() => _feedbackStatusFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  void _showFeedbackReplyDialog(AdminFeedbackModel ticket, bool isBM) async {
    final replyController = TextEditingController(text: ticket.adminResponse);
    try {
      await showDialog(
        context: context,
        builder: (ctx) => AlertDialog(
          backgroundColor: colors.card,
          title: Text(
            isBM ? 'Balas Maklum Balas' : 'Reply to Feedback',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(ticket.title, style: TextStyle(color: colors.textMuted, fontSize: 12)),
              const SizedBox(height: 12),
              TextField(
                controller: replyController,
                maxLines: 4,
                style: TextStyle(color: colors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: isBM ? 'Tulis nota atau tindakan pembetulan di sini...' : 'Write notes here...',
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
            ),
            ElevatedButton(
              style: ElevatedButton.styleFrom(backgroundColor: colors.maroonPrimary),
              onPressed: () async {
                final responseText = replyController.text.trim();
                Navigator.pop(ctx);
                await ref.read(adminServiceProvider).updateFeedbackStatus(
                  ticket.id,
                  ticket.status,
                  adminResponse: responseText,
                );
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(isBM ? 'Balasan berjaya disimpan.' : 'Reply saved.')),
                  );
                }
              },
              child: Text(isBM ? 'Simpan Balasan' : 'Save Reply'),
            ),
          ],
        ),
      );
    } finally {
      replyController.dispose();
    }
  }

  void _viewFullScreenshot(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.contain,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }
}
