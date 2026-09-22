import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_toast.dart';
import '../auth/auth_service.dart';
import 'notification_state_provider.dart';

class NotificationItem {
  final String id;
  final String title;
  final String message;
  final String type;
  final bool pinned;
  final DateTime? createdAt;

  NotificationItem({
    required this.id,
    required this.title,
    required this.message,
    this.type = 'GENERAL',
    this.pinned = false,
    this.createdAt,
  });

  factory NotificationItem.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};
    DateTime? dt;
    if (d['createdAt'] is Timestamp) {
      dt = (d['createdAt'] as Timestamp).toDate();
    } else if (d['createdAt'] is String) {
      dt = DateTime.tryParse(d['createdAt']);
    }

    return NotificationItem(
      id: doc.id,
      title: d['titleBM'] ?? d['titleEN'] ?? d['title'] ?? 'Pengumuman Sistem',
      message: d['messageBM'] ?? d['messageEN'] ?? d['message'] ?? '',
      type: (d['type'] ?? 'GENERAL').toString().toUpperCase(),
      pinned: d['pinned'] == true,
      createdAt: dt,
    );
  }
}

final announcementsStreamProvider = StreamProvider<List<NotificationItem>>((ref) {
  final firestore = ref.watch(firestoreProvider);
  return firestore.collection('announcements').snapshots().map((snap) {
    final list = snap.docs.map((d) => NotificationItem.fromFirestore(d)).toList();
    list.sort((a, b) {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      final aDate = a.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      final bDate = b.createdAt ?? DateTime.fromMillisecondsSinceEpoch(0);
      return bDate.compareTo(aDate);
    });
    return list;
  });
});

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() => _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  final Set<String> _expandedIds = {};

  @override
  Widget build(BuildContext context) {
    final announcementsAsync = ref.watch(announcementsStreamProvider);
    final notifState = ref.watch(notificationStateProvider);
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Pemberitahuan & Siaran' : 'Notifications & Announcements',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          TextButton.icon(
            onPressed: () {
              final all = announcementsAsync.value ?? [];
              final allIds = all.map((a) => a.id).toList();
              ref.read(notificationStateProvider.notifier).markAllAsRead(allIds);
              AppToast.success(
                context,
                isBM ? 'Semua notifikasi ditandakan sebagai dibaca.' : 'All notifications marked as read.',
              );
            },
            icon: Icon(Icons.done_all, color: colors.maroonPrimary, size: 16),
            label: Text(
              isBM ? 'Tanda Semua' : 'Mark All Read',
              style: TextStyle(color: colors.maroonPrimary, fontSize: 12, fontWeight: FontWeight.bold),
            ),
          ),
          const SizedBox(width: 4),
        ],
      ),
      body: RefreshIndicator(
        color: colors.maroonPrimary,
        onRefresh: () async => ref.invalidate(announcementsStreamProvider),
        child: announcementsAsync.when(
          loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
          error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
          data: (items) {
            if (items.isEmpty) {
              return ListView(
                children: [
                  const SizedBox(height: 140),
                  Center(
                    child: Column(
                      children: [
                        Icon(Icons.notifications_off_outlined, size: 56, color: colors.textDim),
                        const SizedBox(height: 12),
                        Text(
                          isBM ? 'Tiada Pengumuman Terkini' : 'No Recent Announcements',
                          style: TextStyle(color: colors.textSecondary, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isBM
                              ? 'Sebarang siaran agensi atau kemas kini akan dipaparkan di sini.'
                              : 'Agency broadcasts and updates will appear here.',
                          style: TextStyle(color: colors.textMuted, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: const EdgeInsets.all(16),
              itemCount: items.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = items[index];
                final isRead = notifState.isRead(item);
                final isExpanded = _expandedIds.contains(item.id);
                final isUrgent = item.type == 'URGENT';

                return InkWell(
                  onTap: () {
                    ref.read(notificationStateProvider.notifier).markAsRead(item.id);
                    setState(() {
                      if (isExpanded) {
                        _expandedIds.remove(item.id);
                      } else {
                        _expandedIds.add(item.id);
                      }
                    });
                  },
                  borderRadius: BorderRadius.circular(14),
                  child: Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: isUrgent
                          ? const Color(0x18DC2626)
                          : (isRead ? colors.card : (colors.isDark ? colors.surface : colors.maroonLight.withValues(alpha: 0.35))),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isUrgent
                            ? const Color(0x66EF4444)
                            : (isRead ? colors.border : (colors.isDark ? const Color(0x55FFB2B8) : colors.maroonSecondary.withValues(alpha: 0.4))),
                        width: isRead ? 1 : 1.5,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 32,
                              height: 32,
                              decoration: BoxDecoration(
                                color: isUrgent
                                    ? const Color(0x33EF4444)
                                    : (colors.isDark ? const Color(0x29FFB2B8) : colors.maroonLight),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(
                                isUrgent ? Icons.warning_amber_rounded : Icons.campaign_rounded,
                                size: 18,
                                color: isUrgent
                                    ? const Color(0xFFEF4444)
                                    : (colors.isDark ? const Color(0xFFFFB2B8) : colors.maroonPrimary),
                              ),
                            ),
                            const SizedBox(width: 10),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    item.title,
                                    style: TextStyle(
                                      color: colors.textPrimary,
                                      fontWeight: isRead ? FontWeight.w600 : FontWeight.w800,
                                      fontSize: 14,
                                    ),
                                  ),
                                  if (item.createdAt != null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      DateFormat('d MMM yyyy, h:mm a').format(item.createdAt!),
                                      style: TextStyle(color: colors.textMuted, fontSize: 11),
                                    ),
                                  ],
                                ],
                              ),
                            ),
                            if (!isRead)
                              Container(
                                width: 8,
                                height: 8,
                                decoration: BoxDecoration(color: colors.maroonPrimary, shape: BoxShape.circle),
                              ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          item.message,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
                          maxLines: isExpanded ? 50 : 2,
                          overflow: TextOverflow.ellipsis,
                        ),
                      ],
                    ),
                  ),
                );
              },
            );
          },
        ),
      ),
    );
  }
}
