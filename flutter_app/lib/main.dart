import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'core/theme/theme_mode_provider.dart';
import 'features/security/app_lock_gate.dart';
import 'features/security/security_service.dart';
import 'features/notifications/notification_permission_gate.dart';

void main() async {
  final widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);
  await initializeDateFormatting();

  // Enable true edge-to-edge support for Android gesture & 3-button navigation
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: Brightness.light,
      systemNavigationBarContrastEnforced: false,
    ),
  );

  try {
    await Firebase.initializeApp();
    await FirebaseAuth.instance.authStateChanges().first;
  } catch (e) {
    debugPrint('[ArthaApp] Firebase initialize error: $e');
  }

  // Pre-load PIN lock state before frame 1 to eliminate double-splash flash
  bool initialPinLocked = false;
  bool onboardingCompleted = FirebaseAuth.instance.currentUser != null;
  try {
    final prefs = await SharedPreferences.getInstance();
    onboardingCompleted = prefs.getBool('@artha_onboarding_completed') ?? onboardingCompleted;
    final pinEnabled = prefs.getBool('@artha_app_lock_enabled') ?? false;
    final hasHash = (prefs.getString('@artha_app_lock_pin_hash') ?? '').isNotEmpty;
    final hasLegacyPin = (prefs.getString('@artha_app_lock_pin') ?? '').length == 4;
    initialPinLocked = pinEnabled && (hasHash || hasLegacyPin);

    // Enforce FLAG_SECURE if screenshot protection is enabled
    if (prefs.getBool('@artha_screenshot_protection') ?? false) {
      await SecurityService().applyInitialScreenshotProtection();
    }
  } catch (e) {
    debugPrint('[ArthaApp] SharedPreferences init error: $e');
  }

  FlutterNativeSplash.remove();

  runApp(
    UncontrolledProviderScope(
      container: ProviderContainer(
        overrides: [onboardingCompletedProvider.overrideWith((ref) => onboardingCompleted)],
      ),
      child: ArthaApp(initialPinLocked: initialPinLocked),
    ),
  );
}

class ArthaApp extends ConsumerWidget {
  final bool initialPinLocked;
  const ArthaApp({super.key, this.initialPinLocked = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final router = ref.watch(routerProvider);
    final themeMode = ref.watch(themeModeProvider);

    final isDark = themeMode == ThemeMode.dark ||
        (themeMode == ThemeMode.system &&
            WidgetsBinding.instance.platformDispatcher.platformBrightness == Brightness.dark);

    final overlayStyle = SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      systemNavigationBarColor: Colors.transparent,
      systemNavigationBarDividerColor: Colors.transparent,
      systemNavigationBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      systemNavigationBarContrastEnforced: false,
    );

    return AnnotatedRegion<SystemUiOverlayStyle>(
      value: overlayStyle,
      child: MaterialApp.router(
        title: 'Artha',
        debugShowCheckedModeBanner: false,
        theme: AppTheme.lightTheme,
        darkTheme: AppTheme.darkTheme,
        themeMode: themeMode,
        routerConfig: router,
        builder: (context, child) {
          return NotificationPermissionGate(
            child: AppLockGate(
              initialLocked: initialPinLocked,
              child: child ?? const SizedBox(),
            ),
          );
        },
      ),
    );
  }
}
