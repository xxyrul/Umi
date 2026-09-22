import 'dart:convert';
import 'dart:math';
import 'package:crypto/crypto.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:local_auth/local_auth.dart';
import 'package:shared_preferences/shared_preferences.dart';

class SecurityService {
  static const String _legacyPinKey = '@artha_app_lock_pin';
  static const String _pinHashKey = '@artha_app_lock_pin_hash';
  static const String _pinSaltKey = '@artha_app_lock_salt';
  static const String _pinEnabledKey = '@artha_app_lock_enabled';
  static const String _biometricsEnabledKey = '@artha_biometrics_enabled';
  static const String _timeoutKey = '@artha_app_lock_timeout';
  static const String _screenshotProtectionKey = '@artha_screenshot_protection';
  static const String _failedAttemptsKey = '@artha_pin_failed_attempts';
  static const String _lockoutUntilKey = '@artha_pin_lockout_until';

  static const MethodChannel _channel = MethodChannel('com.umi.caseflow/security');
  final LocalAuthentication _localAuth = LocalAuthentication();

  Future<bool> isBiometricAvailable() async {
    try {
      final canCheck = await _localAuth.canCheckBiometrics;
      final isDeviceSupported = await _localAuth.isDeviceSupported();
      return canCheck || isDeviceSupported;
    } catch (e) {
      debugPrint('[Security] Biometric check error: $e');
      return false;
    }
  }

  Future<bool> authenticateWithBiometrics() async {
    try {
      final available = await isBiometricAvailable();
      if (!available) return false;

      return await _localAuth.authenticate(
        localizedReason: 'Sahkan cap jari atau biometrik untuk membuka Artha',
      );
    } catch (e) {
      debugPrint('[Security] Biometric auth error: $e');
      return false;
    }
  }

  Future<bool> isPinLockEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    final enabled = prefs.getBool(_pinEnabledKey) ?? false;
    final hasHash = (prefs.getString(_pinHashKey) ?? '').isNotEmpty;
    final hasLegacyPin = (prefs.getString(_legacyPinKey) ?? '').length == 4;
    return enabled && (hasHash || hasLegacyPin);
  }

  Future<bool> isBiometricsEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_biometricsEnabledKey) ?? false;
  }

  Future<int> getLockTimeoutMs() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getInt(_timeoutKey) ?? 0; // Default 0 (Immediately)
  }

  Future<void> setLockTimeoutMs(int timeoutMs) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_timeoutKey, timeoutMs);
  }

  Future<bool> isScreenshotProtectionEnabled() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(_screenshotProtectionKey) ?? false;
  }

  Future<void> setScreenshotProtection(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_screenshotProtectionKey, enabled);
    try {
      await _channel.invokeMethod('setSecureMode', {'enabled': enabled});
    } catch (e) {
      debugPrint('[Security] MethodChannel setSecureMode error: $e');
    }
  }

  Future<void> applyInitialScreenshotProtection() async {
    final enabled = await isScreenshotProtectionEnabled();
    if (enabled) {
      try {
        await _channel.invokeMethod('setSecureMode', {'enabled': true});
      } catch (e) {
        debugPrint('[Security] applyInitialScreenshotProtection error: $e');
      }
    }
  }

  // ─────────────────────────────────────────────
  // 🔒 Salted SHA-256 Cryptographic PIN Storage
  // ─────────────────────────────────────────────
  String _generateSalt() {
    final random = Random.secure();
    final values = List<int>.generate(16, (i) => random.nextInt(256));
    return base64UrlEncode(values);
  }

  String _hashPin(String pin, String salt) {
    final bytes = utf8.encode('$salt:$pin');
    return sha256.convert(bytes).toString();
  }

  Future<void> setPinLock(String pin) async {
    if (pin.length != 4) return;
    final prefs = await SharedPreferences.getInstance();
    final salt = _generateSalt();
    final hash = _hashPin(pin, salt);

    await prefs.setString(_pinSaltKey, salt);
    await prefs.setString(_pinHashKey, hash);
    await prefs.setBool(_pinEnabledKey, true);
    // Remove plaintext legacy PIN if present
    await prefs.remove(_legacyPinKey);
    await prefs.remove(_failedAttemptsKey);
    await prefs.remove(_lockoutUntilKey);
  }

  Future<void> removePinLock() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_legacyPinKey);
    await prefs.remove(_pinHashKey);
    await prefs.remove(_pinSaltKey);
    await prefs.setBool(_pinEnabledKey, false);
    await prefs.setBool(_biometricsEnabledKey, false);
    await prefs.remove(_failedAttemptsKey);
    await prefs.remove(_lockoutUntilKey);
  }

  /// Returns remaining lockout seconds if brute-force lockout is active, otherwise 0
  Future<int> getRemainingLockoutSeconds() async {
    final prefs = await SharedPreferences.getInstance();
    final lockoutUntil = prefs.getInt(_lockoutUntilKey) ?? 0;
    final now = DateTime.now().millisecondsSinceEpoch;
    if (lockoutUntil > now) {
      return ((lockoutUntil - now) / 1000).ceil();
    }
    return 0;
  }

  Future<bool> verifyPin(String pin) async {
    final lockoutSeconds = await getRemainingLockoutSeconds();
    if (lockoutSeconds > 0) return false;

    final prefs = await SharedPreferences.getInstance();
    final savedHash = prefs.getString(_pinHashKey);
    final salt = prefs.getString(_pinSaltKey);

    bool isValid = false;

    if (savedHash != null && salt != null) {
      final inputHash = _hashPin(pin, salt);
      isValid = (inputHash == savedHash);
    } else {
      // Check legacy unhashed PIN and auto-migrate
      final legacyPin = prefs.getString(_legacyPinKey);
      if (legacyPin != null && legacyPin.length == 4 && legacyPin == pin) {
        isValid = true;
        // Transparent auto-migration to salted hash
        await setPinLock(pin);
      }
    }

    if (isValid) {
      // Reset failed attempts on success
      await prefs.remove(_failedAttemptsKey);
      await prefs.remove(_lockoutUntilKey);
    } else {
      // Increment failed attempts for brute-force protection
      final attempts = (prefs.getInt(_failedAttemptsKey) ?? 0) + 1;
      await prefs.setInt(_failedAttemptsKey, attempts);
      if (attempts >= 5) {
        // Lock out for 30 seconds
        final lockoutUntil = DateTime.now().add(const Duration(seconds: 30)).millisecondsSinceEpoch;
        await prefs.setInt(_lockoutUntilKey, lockoutUntil);
      }
    }

    return isValid;
  }

  Future<void> setBiometricsEnabled(bool enabled) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(_biometricsEnabledKey, enabled);
  }
}

final securityServiceProvider = Provider<SecurityService>((ref) => SecurityService());
