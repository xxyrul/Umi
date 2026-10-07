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
  final user = ref.watch(authStateProvider).value;
  if (user == null) return Stream.value([]);

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
          IconButton(
            tooltip: isBM ? 'Tanda Semua Dibaca' : 'Mark All Read',
            icon: Icon(Icons.done_all, color: colors.maroonPrimary, size: 20),
            onPressed: () {
              final all = announcementsAsync.value ?? [];
              final allIds = all.map((a) => a.id).toList();
              ref.read(notificationStateProvider.notifier).markAllAsRead(allIds);
              AppToast.success(
                context,
                isBM ? 'Semua notifikasi ditandakan sebagai dibaca.' : 'All notifications marked as read.',
              );
            },
          ),
          PopupMenuButton<String>(
            icon: Icon(Icons.more_vert, color: colors.textPrimary, size: 20),
            color: colors.card,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: colors.border)),
            onSelected: (val) async {
              final all = announcementsAsync.value ?? [];
              if (val == 'read_all') {
                final allIds = all.map((a) => a.id).toList();
                ref.read(notificationStateProvider.notifier).markAllAsRead(allIds);
                AppToast.success(
                  context,
                  isBM ? 'Semua notifikasi ditandakan sebagai dibaca.' : 'All notifications marked as read.',
                );
              } else if (val == 'clear_all') {
                final confirmed = await showDialog<bool>(
                  context: context,
                  builder: (ctx) => AlertDialog(
                    backgroundColor: colors.card,
                    title: Text(
                      isBM ? 'Kosongkan Notifikasi?' : 'Clear All Notifications?',
                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
                    ),
                    content: Text(
                      isBM
                          ? 'Semua notifikasi akan dipadamkan dari pandangan anda. Anda boleh memulihkannya semula pada bila-bila masa.'
                          : 'All notifications will be cleared from your view. You can restore them anytime.',
                      style: TextStyle(color: colors.textSecondary, fontSize: 13),
                    ),
                    actions: [
                      TextButton(
                        onPressed: () => Navigator.pop(ctx, false),
                        child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
                      ),
                      ElevatedButton(
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
                        onPressed: () => Navigator.pop(ctx, true),
                        child: Text(isBM ? 'Kosongkan' : 'Clear All'),
                      ),
                    ],
                  ),
                );
                if (confirmed == true) {
                  final allIds = all.map((a) => a.id).toList();
                  ref.read(notificationStateProvider.notifier).clearAllNotifications(allIds);
                  if (context.mounted) {
                    AppToast.show(
                      context,
                      message: isBM ? 'Semua notifikasi telah dikosongkan.' : 'All notifications cleared.',
                      icon: Icons.delete_sweep_outlined,
                    );
                  }
                }
              } else if (val == 'restore_all') {
                ref.read(notificationStateProvider.notifier).resetDismissed();
                AppToast.success(
                  context,
                  isBM ? 'Notifikasi telah dipulihkan.' : 'Notifications restored.',
                );
              }
            },
            itemBuilder: (ctx) => [
              PopupMenuItem(
                value: 'read_all',
                child: Row(
                  children: [
                    Icon(Icons.done_all, size: 16, color: colors.maroonPrimary),
                    const SizedBox(width: 10),
                    Text(isBM ? 'Tanda Semua Dibaca' : 'Mark All as Read', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
                  ],
                ),
              ),
              PopupMenuItem(
                value: 'clear_all',
                child: Row(
                  children: [
                    const Icon(Icons.delete_sweep_outlined, size: 16, color: Colors.redAccent),
                    const SizedBox(width: 10),
                    Text(isBM ? 'Kosongkan Semua' : 'Clear All Notifications', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
                  ],
                ),
              ),
              if (notifState.dismissedIds.isNotEmpty)
                PopupMenuItem(
                  value: 'restore_all',
                  child: Row(
                    children: [
                      Icon(Icons.restore, size: 16, color: colors.textSecondary),
                      const SizedBox(width: 10),
                      Text(isBM ? 'Pulihkan Semula (${notifState.dismissedIds.length})' : 'Restore Cleared (${notifState.dismissedIds.length})', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
                    ],
                  ),
                ),
            ],
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
            final activeItems = items.where((i) => !notifState.isDismissed(i)).toList();

            if (activeItems.isEmpty) {
              final hadDismissed = items.isNotEmpty && notifState.dismissedIds.isNotEmpty;
              return ListView(
                children: [
                  const SizedBox(height: 140),
                  Center(
                    child: Column(
                      children: [
                        Icon(
                          hadDismissed ? Icons.mark_email_read_outlined : Icons.notifications_off_outlined,
                          size: 56,
                          color: colors.textDim,
                        ),
                        const SizedBox(height: 12),
                        Text(
                          hadDismissed
                              ? (isBM ? 'Peti Masuk Dikosongkan' : 'All Caught Up')
                              : (isBM ? 'Tiada Pengumuman Terkini' : 'No Recent Announcements'),
                          style: TextStyle(color: colors.textSecondary, fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          hadDismissed
                              ? (isBM ? 'Semua notifikasi telah dipadamkan dari pandangan anda.' : 'All notifications have been cleared from your inbox.')
                              : (isBM ? 'Sebarang siaran agensi atau kemas kini akan dipaparkan di sini.' : 'Agency broadcasts and updates will appear here.'),
                          style: TextStyle(color: colors.textMuted, fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                        if (hadDismissed) ...[
                          const SizedBox(height: 16),
                          OutlinedButton.icon(
                            onPressed: () => ref.read(notificationStateProvider.notifier).resetDismissed(),
                            icon: const Icon(Icons.restore, size: 16),
                            label: Text(isBM ? 'Pulihkan Notifikasi' : 'Restore Notifications'),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: colors.maroonPrimary,
                              side: BorderSide(color: colors.maroonPrimary.withValues(alpha: 0.5)),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              );
            }

            return ListView.separated(
              padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
              itemCount: activeItems.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final item = activeItems[index];
                final isRead = notifState.isRead(item);
                final isExpanded = _expandedIds.contains(item.id);
                final isUrgent = item.type == 'URGENT';

                return Dismissible(
                  key: Key('notif_${item.id}'),
                  direction: DismissDirection.endToStart,
                  background: Container(
                    alignment: Alignment.centerRight,
                    padding: const EdgeInsets.only(right: 20),
                    decoration: BoxDecoration(
                      color: Colors.redAccent.withValues(alpha: 0.85),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.end,
                      children: [
                        Icon(Icons.delete_outline, color: Colors.white, size: 22),
                        SizedBox(width: 6),
                        Text(
                          'Padam',
                          style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 12),
                        ),
                      ],
                    ),
                  ),
                  onDismissed: (_) {
                    ref.read(notificationStateProvider.notifier).dismissNotification(item.id);
                    ScaffoldMessenger.of(context).clearSnackBars();
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        behavior: SnackBarBehavior.floating,
                        backgroundColor: colors.card,
                        margin: EdgeInsets.only(bottom: context.safeBottomPadding(16.0), left: 16, right: 16),
                        content: Text(
                          isBM ? 'Notifikasi dipadam.' : 'Notification dismissed.',
                          style: TextStyle(color: colors.textPrimary),
                        ),
                        action: SnackBarAction(
                          label: isBM ? 'BUAT SEMULA' : 'UNDO',
                          textColor: colors.maroonPrimary,
                          onPressed: () => ref.read(notificationStateProvider.notifier).undoDismissNotification(item.id),
                        ),
                      ),
                    );
                  },
                  child: InkWell(
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
