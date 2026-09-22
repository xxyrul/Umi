import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'notifications_screen.dart';

const String _kReadIdsKey = '@read_notification_ids';
const String _kLastSeenKey = '@last_seen_notifications_at';

class NotificationState {
  final Set<String> readIds;
  final DateTime? lastSeenAt;

  const NotificationState({
    this.readIds = const {},
    this.lastSeenAt,
  });

  bool isRead(NotificationItem item) {
    if (readIds.contains(item.id)) return true;
    if (lastSeenAt != null && item.createdAt != null) {
      return !item.createdAt!.isAfter(lastSeenAt!);
    }
    return false;
  }

  NotificationState copyWith({
    Set<String>? readIds,
    DateTime? lastSeenAt,
  }) {
    return NotificationState(
      readIds: readIds ?? this.readIds,
      lastSeenAt: lastSeenAt ?? this.lastSeenAt,
    );
  }
}

class NotificationStateNotifier extends StateNotifier<NotificationState> {
  NotificationStateNotifier() : super(const NotificationState()) {
    _loadAndSync();
  }

  Future<void> _loadAndSync() async {
    final prefs = await SharedPreferences.getInstance();
    final localList = prefs.getStringList(_kReadIdsKey) ?? [];
    final localLastSeenStr = prefs.getString(_kLastSeenKey);
    DateTime? localLastSeen = localLastSeenStr != null ? DateTime.tryParse(localLastSeenStr) : null;

    final readSet = localList.toSet();
    state = NotificationState(readIds: readSet, lastSeenAt: localLastSeen);

    // Sync with Firestore user document
    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid == null) return;

    try {
      final doc = await FirebaseFirestore.instance.collection('users').doc(uid).get();
      if (doc.exists) {
        final data = doc.data() ?? {};
        final cloudList = (data['readNotificationIds'] is List)
            ? (data['readNotificationIds'] as List).map((e) => e.toString()).toList()
            : <String>[];
        final cloudLastSeenStr = data['lastSeenNotificationsAt'] as String?;
        final cloudLastSeen = cloudLastSeenStr != null ? DateTime.tryParse(cloudLastSeenStr) : null;

        final mergedRead = Set<String>.from(readSet)..addAll(cloudList);
        DateTime? latestLastSeen = localLastSeen;
        if (cloudLastSeen != null) {
          if (latestLastSeen == null || cloudLastSeen.isAfter(latestLastSeen)) {
            latestLastSeen = cloudLastSeen;
          }
        }

        state = NotificationState(readIds: mergedRead, lastSeenAt: latestLastSeen);

        // Update local prefs
        await prefs.setStringList(_kReadIdsKey, mergedRead.toList());
        if (latestLastSeen != null) {
          await prefs.setString(_kLastSeenKey, latestLastSeen.toIso8601String());
        }
      }
    } catch (e) {
      // Offline fallback
    }
  }

  Future<void> markAsRead(String id) async {
    if (state.readIds.contains(id)) return;
    final updated = Set<String>.from(state.readIds)..add(id);
    state = state.copyWith(readIds: updated);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kReadIdsKey, updated.toList());

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      FirebaseFirestore.instance.collection('users').doc(uid).set({
        'readNotificationIds': FieldValue.arrayUnion([id]),
      }, SetOptions(merge: true)).catchError((_) {});
    }
  }

  Future<void> markAllAsRead(List<String> ids) async {
    final now = DateTime.now();
    final nowIso = now.toIso8601String();
    final updated = Set<String>.from(state.readIds)..addAll(ids);

    // Update state immediately for zero-lag UI response
    state = NotificationState(readIds: updated, lastSeenAt: now);

    final prefs = await SharedPreferences.getInstance();
    await prefs.setStringList(_kReadIdsKey, updated.toList());
    await prefs.setString(_kLastSeenKey, nowIso);

    final uid = FirebaseAuth.instance.currentUser?.uid;
    if (uid != null) {
      FirebaseFirestore.instance.collection('users').doc(uid).set({
        'readNotificationIds': FieldValue.arrayUnion(ids),
        'lastSeenNotificationsAt': nowIso,
      }, SetOptions(merge: true)).catchError((_) {});
    }
  }
}

final notificationStateProvider =
    StateNotifierProvider<NotificationStateNotifier, NotificationState>((ref) {
  return NotificationStateNotifier();
});

/// Computes the number of unread announcements in real-time
final unreadNotificationsCountProvider = Provider<int>((ref) {
  final announcementsAsync = ref.watch(announcementsStreamProvider);
  final notifState = ref.watch(notificationStateProvider);
  final list = announcementsAsync.value ?? [];
  return list.where((item) => !notifState.isRead(item)).length;
});
