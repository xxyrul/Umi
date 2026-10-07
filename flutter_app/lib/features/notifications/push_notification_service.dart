import 'dart:io';
import 'dart:math' as math;
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/router/app_router.dart';

@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // Android system displays notifications automatically via the matching channel_id.
}

final pushNotificationServiceProvider = Provider<PushNotificationService>((ref) {
  return PushNotificationService.instance;
});

class PushNotificationService {
  PushNotificationService._();
  static final PushNotificationService instance = PushNotificationService._();

  bool _initialized = false;

  Future<void> initialize() async {
    if (_initialized || kIsWeb || !Platform.isAndroid) return;
    _initialized = true;

    try {
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

      // Handle notification clicks when app was in background
      FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
        _handleMessageTap(message);
      });

      // Handle notification click if app was launched from terminated state
      final initialMessage = await FirebaseMessaging.instance.getInitialMessage();
      if (initialMessage != null) {
        _handleMessageTap(initialMessage);
      }

      // Auto re-sync when FCM token rotates
      FirebaseMessaging.instance.onTokenRefresh.listen((newToken) {
        syncDeviceToken();
      });
    } catch (e) {
      debugPrint('[PushNotificationService] Initialization error: $e');
    }
  }

  void _handleMessageTap(RemoteMessage message) {
    final kind = message.data['kind'] ?? '';
    if (kind == 'native-app-update' || kind == 'update-nudge') {
      rootNavigatorKey.currentState?.pushNamed('/updates');
    } else {
      rootNavigatorKey.currentState?.pushNamed('/notifications');
    }
  }

  Future<void> syncDeviceToken({String? uid, String? language}) async {
    if (kIsWeb || !Platform.isAndroid) return;
    final effectiveUid = uid ?? FirebaseAuth.instance.currentUser?.uid;
    if (effectiveUid == null) return;

    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token == null || token.isEmpty) return;

      final prefs = await SharedPreferences.getInstance();
      var deviceId = prefs.getString('@artha_device_id') ?? '';
      if (deviceId.isEmpty) {
        final random = math.Random().nextInt(999999).toString().padLeft(6, '0');
        deviceId = 'and_${DateTime.now().millisecondsSinceEpoch}_$random';
        await prefs.setString('@artha_device_id', deviceId);
      }

      final lang = language ?? (prefs.getString('artha_app_language') ?? 'BM');

      await FirebaseFirestore.instance
          .collection('users')
          .doc(effectiveUid)
          .collection('devices')
          .doc(deviceId)
          .set({
        'token': token,
        'enabled': true,
        'platform': 'android',
        'language': lang == 'BM' ? 'BM' : 'EN',
        'buildVersion': 60,
        'appVersionCode': 60,
        'versionName': '2.0.0',
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      debugPrint('[PushNotificationService] Registered FCM device $deviceId');
    } catch (e) {
      debugPrint('[PushNotificationService] Failed to sync device token: $e');
    }
  }

  Future<void> unpairDeviceToken({String? uid}) async {
    if (kIsWeb || !Platform.isAndroid) return;
    final effectiveUid = uid ?? FirebaseAuth.instance.currentUser?.uid;
    if (effectiveUid == null) return;

    try {
      final prefs = await SharedPreferences.getInstance();
      final deviceId = prefs.getString('@artha_device_id') ?? '';
      if (deviceId.isNotEmpty) {
        await FirebaseFirestore.instance
            .collection('users')
            .doc(effectiveUid)
            .collection('devices')
            .doc(deviceId)
            .update({'enabled': false}).catchError((_) {});
      }
    } catch (_) {}
  }
}
