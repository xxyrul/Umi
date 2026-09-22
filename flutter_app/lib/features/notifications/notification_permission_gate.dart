import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'dart:async';
import 'package:android_intent_plus/android_intent.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';

class NotificationPermissionGate extends ConsumerStatefulWidget {
  final Widget child;

  const NotificationPermissionGate({super.key, required this.child});

  @override
  ConsumerState<NotificationPermissionGate> createState() => _NotificationPermissionGateState();
}

class _NotificationPermissionGateState extends ConsumerState<NotificationPermissionGate>
    with WidgetsBindingObserver {
  bool _dialogVisible = false;
  bool _checkingPermission = false;
  bool _needsPermission = false;
  StreamSubscription<User?>? _authSubscription;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _authSubscription = FirebaseAuth.instance.authStateChanges().listen((_) {
      _enforcePermission();
    });
    WidgetsBinding.instance.addPostFrameCallback((_) => _enforcePermission());
    Future<void>.delayed(const Duration(seconds: 2), _enforcePermission);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _authSubscription?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _enforcePermission();
    }
  }

  Future<void> _enforcePermission() async {
    if (!mounted || _dialogVisible || _checkingPermission || FirebaseAuth.instance.currentUser == null) return;
    _checkingPermission = true;

    try {
      final current = await FirebaseMessaging.instance.getNotificationSettings();
      final allowed = current.authorizationStatus == AuthorizationStatus.authorized ||
          current.authorizationStatus == AuthorizationStatus.provisional;
      if (allowed || !mounted) {
        if (mounted) setState(() => _needsPermission = false);
        return;
      }

      if (current.authorizationStatus == AuthorizationStatus.notDetermined) {
        final requested = await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );
        final granted = requested.authorizationStatus == AuthorizationStatus.authorized ||
            requested.authorizationStatus == AuthorizationStatus.provisional;
        if (granted || !mounted) {
          if (mounted) setState(() => _needsPermission = false);
          return;
        }
      }

      if (mounted) setState(() => _needsPermission = true);
    } catch (error) {
      debugPrint('[NotificationPermission] check failed: $error');
    } finally {
      _checkingPermission = false;
    }
    if (mounted) _enforcePermission();
  }

  Future<void> _openNotificationSettings() async {
    const packageName = 'com.umi.caseflow';
    final intent = AndroidIntent(
      action: 'android.settings.APP_NOTIFICATION_SETTINGS',
      arguments: <String, dynamic>{
        'android.provider.extra.APP_PACKAGE': packageName,
      },
    );
    await intent.launch();
  }

  @override
  Widget build(BuildContext context) {
    if (!_needsPermission) return widget.child;

    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    return Stack(
      children: [
        widget.child,
        Positioned.fill(
          child: ColoredBox(
            color: colors.canvas.withValues(alpha: 0.98),
            child: Center(
              child: Padding(
                padding: const EdgeInsets.all(28),
                child: Material(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(20),
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.notifications_active_outlined, size: 48, color: colors.maroonPrimary),
                        const SizedBox(height: 16),
                        Text(
                          isBM ? 'Notifikasi Diperlukan' : 'Notifications Required',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textPrimary, fontSize: 20, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 10),
                        Text(
                          isBM
                              ? 'Benarkan notifikasi Artha untuk menerima amaran kes, pengumuman agensi dan kemas kini penting.'
                              : 'Allow Artha notifications to receive case alerts, agency announcements and important updates.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textSecondary, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        SizedBox(
                          width: double.infinity,
                          child: FilledButton(
                            style: FilledButton.styleFrom(backgroundColor: AppColors.maroonPrimary),
                            onPressed: () async {
                              await _openNotificationSettings();
                              if (mounted) _enforcePermission();
                            },
                            child: Text(isBM ? 'Buka Tetapan Notifikasi' : 'Open Notification Settings'),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
