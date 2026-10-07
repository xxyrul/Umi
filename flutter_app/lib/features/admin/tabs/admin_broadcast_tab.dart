import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../admin_service.dart';
import '../../notifications/notifications_screen.dart';

class AdminBroadcastTab extends ConsumerStatefulWidget {
  const AdminBroadcastTab({super.key});

  @override
  ConsumerState<AdminBroadcastTab> createState() => _AdminBroadcastTabState();
}

class _AdminBroadcastTabState extends ConsumerState<AdminBroadcastTab> {
  AppThemeColors get colors => context.colors;
  final TextEditingController _broadcastTitleController = TextEditingController();
  final TextEditingController _broadcastMessageController = TextEditingController();
  String _broadcastType = 'GENERAL';
  String _targetAudience = 'ALL'; // 'ALL' or 'BETA'
  bool _broadcastPinned = false;
  bool _isSendingBroadcast = false;

  @override
  void dispose() {
    _broadcastTitleController.dispose();
    _broadcastMessageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final announcementsAsync = ref.watch(announcementsStreamProvider);

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
      children: [
        // Composer Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.campaign, color: colors.maroonPrimary, size: 22),
                  const SizedBox(width: 8),
                  Text(
                    isBM ? 'Cipta Siaran Baru' : 'Create Broadcast',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Target Audience Selector
              Row(
                children: [
                  Text(
                    isBM ? 'Sasaran:' : 'Audience:',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(width: 10),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => setState(() => _targetAudience = 'ALL'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _targetAudience == 'ALL' ? colors.maroonPrimary : colors.card,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _targetAudience == 'ALL' ? colors.maroonPrimary : colors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.public, size: 14, color: _targetAudience == 'ALL' ? Colors.white : colors.textMuted),
                          const SizedBox(width: 5),
                          Text(
                            isBM ? 'Semua Ejen 🌐' : 'All Agents 🌐',
                            style: TextStyle(
                              color: _targetAudience == 'ALL' ? Colors.white : colors.textSecondary,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    borderRadius: BorderRadius.circular(8),
                    onTap: () => setState(() => _targetAudience = 'BETA'),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                      decoration: BoxDecoration(
                        color: _targetAudience == 'BETA' ? Colors.amber.shade800 : colors.card,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: _targetAudience == 'BETA' ? Colors.amber : colors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(Icons.science_outlined, size: 14, color: _targetAudience == 'BETA' ? Colors.white : Colors.amber),
                          const SizedBox(width: 5),
                          Text(
                            isBM ? 'Penguji Beta Sahaja 🧪' : 'Beta Testers Only 🧪',
                            style: TextStyle(
                              color: _targetAudience == 'BETA' ? Colors.white : Colors.amber,
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ),
              if (_targetAudience == 'BETA') ...[
                const SizedBox(height: 10),
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.amber.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: Colors.amber.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, size: 15, color: Colors.amber),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          isBM
                              ? 'Hanya pengguna Saluran Beta (FCM: beta_testers) akan menerima notifikasi ini. Ejen versi stabil tidak akan terganggu.'
                              : 'Only users on Beta Channel (FCM: beta_testers) will receive this push notification. Stable agents will not be disturbed.',
                          style: const TextStyle(fontSize: 11, color: Colors.amber, height: 1.3),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
              const SizedBox(height: 14),

              TextField(
                controller: _broadcastTitleController,
                style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  labelText: isBM ? 'Tajuk Siaran' : 'Broadcast Title',
                  hintText: isBM ? 'e.g. Ujian Ciri Baru / Taklimat Agensi' : 'e.g. Feature Test / Agency Briefing',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _broadcastMessageController,
                maxLines: 3,
                style: TextStyle(color: colors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  labelText: isBM ? 'Kandungan Mesej Notis' : 'Notification Message',
                  hintText: isBM ? 'Tulis pengumuman terperinci di sini...' : 'Write notice details here...',
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text(isBM ? 'Kategori:' : 'Category:', style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                  const SizedBox(width: 8),
                  for (final type in ['GENERAL', 'URGENT', 'LISTING', 'COMMISSION']) ...[
                    InkWell(
                      onTap: () => setState(() => _broadcastType = type),
                      child: Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _broadcastType == type ? colors.maroonPrimary : colors.card,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          type,
                          style: TextStyle(
                            color: _broadcastType == type ? Colors.white : colors.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(
                  isBM ? 'Sematkan di Bahagian Atas (Pinned)' : 'Pin Announcement at Top',
                  style: TextStyle(color: colors.textPrimary, fontSize: 13),
                ),
                value: _broadcastPinned,
                activeColor: colors.maroonPrimary,
                onChanged: (val) => setState(() => _broadcastPinned = val),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _isSendingBroadcast
                    ? null
                    : () async {
                        final title = _broadcastTitleController.text.trim();
                        final msg = _broadcastMessageController.text.trim();
                        if (title.isEmpty || msg.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(isBM ? 'Sila isi tajuk dan mesej siaran.' : 'Please enter title and message.')),
                          );
                          return;
                        }

                        setState(() => _isSendingBroadcast = true);
                        try {
                          await ref.read(adminServiceProvider).createBroadcastAnnouncement(
                            titleBM: title,
                            titleEN: title,
                            messageBM: msg,
                            messageEN: msg,
                            type: _broadcastType,
                            pinned: _broadcastPinned,
                            targetChannel: _targetAudience,
                          );
                          _broadcastTitleController.clear();
                          _broadcastMessageController.clear();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  _targetAudience == 'BETA'
                                      ? (isBM ? 'Siaran dihantar khusus ke Penguji Beta! 🧪' : 'Broadcast sent to Beta Testers! 🧪')
                                      : (isBM ? 'Siaran berjaya dihantar ke semua ejen!' : 'Broadcast dispatched to all agents!'),
                                ),
                              ),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _isSendingBroadcast = false);
                        }
                      },
                icon: _isSendingBroadcast
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : Icon(_targetAudience == 'BETA' ? Icons.science_outlined : Icons.send, size: 16),
                label: Text(
                  _targetAudience == 'BETA'
                      ? (isBM ? 'Hantar ke Saluran Beta Sahaja 🧪' : 'Send to Beta Testers Only 🧪')
                      : (isBM ? 'Hantar Siaran ke Semua Ejen' : 'Send Broadcast to All Agents'),
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: _targetAudience == 'BETA' ? Colors.amber.shade800 : colors.maroonPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Sent History
        Text(
          isBM ? 'Sejarah Siaran Notis' : 'Broadcast History',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
        ),
        const SizedBox(height: 12),
        announcementsAsync.when(
          data: (list) {
            if (list.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(isBM ? 'Tiada siaran direkodkan.' : 'No broadcasts found.', style: TextStyle(color: colors.textMuted)),
                ),
              );
            }

            return Column(
              children: list.map((item) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: item.pinned ? Colors.amber.withValues(alpha: 0.4) : colors.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        item.pinned ? Icons.push_pin : Icons.notifications_active_outlined,
                        color: item.pinned ? Colors.amberAccent : colors.maroonPrimary,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: colors.card,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(item.type, style: TextStyle(color: colors.textMuted, fontSize: 9, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(item.message, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                            if (item.createdAt != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                DateFormat('dd MMM yyyy, hh:mm a').format(item.createdAt!),
                                style: TextStyle(color: colors.textMuted, fontSize: 10),
                              ),
                            ],
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                        onPressed: () async {
                          await ref.read(adminServiceProvider).deleteAnnouncement(item.id);
                        },
                      ),
                    ],
                  ),
                );
              }).toList(),
            );
          },
          loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
          error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
        ),
      ],
    );
  }
}
