import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/app_toast.dart';

class PhoneIntentHelper {
  /// Cleans and normalizes a phone number to Malaysian international format (e.g. "60123456789")
  static String? normalizeMalaysianPhone(String rawPhone) {
    if (rawPhone.trim().isEmpty) return null;

    var clean = rawPhone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.isEmpty) return null;

    if (clean.startsWith('0')) {
      clean = '60${clean.substring(1)}';
    } else if (!clean.startsWith('60')) {
      clean = '60$clean';
    }

    // Basic validity check: Malaysian numbers are typically between 10 and 13 digits with country code 60
    if (clean.length < 10 || clean.length > 14) {
      return null;
    }

    return clean;
  }

  /// Launches WhatsApp with optional pre-filled message
  static Future<bool> launchWhatsApp({
    required BuildContext context,
    required String phone,
    String? message,
    bool isBM = false,
  }) async {
    final cleanPhone = normalizeMalaysianPhone(phone);
    if (cleanPhone == null) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM
              ? 'Nombor telefon tidak sah untuk WhatsApp.'
              : 'Invalid phone number for WhatsApp.',
        );
      }
      return false;
    }

    final query = (message != null && message.trim().isNotEmpty)
        ? '?text=${Uri.encodeComponent(message.trim())}'
        : '';
    final url = Uri.parse('https://wa.me/$cleanPhone$query');

    try {
      final launched = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        AppToast.error(
          context,
          isBM
              ? 'Gagal membuka aplikasi WhatsApp.'
              : 'Unable to open WhatsApp application.',
        );
      }
      return launched;
    } catch (e) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat membuka WhatsApp: $e' : 'Error opening WhatsApp: $e',
        );
      }
      return false;
    }
  }

  /// Launches native phone dialer
  static Future<bool> launchDialer({
    required BuildContext context,
    required String phone,
    bool isBM = false,
  }) async {
    if (phone.trim().isEmpty) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM
              ? 'Nombor telefon tidak tersedia.'
              : 'Phone number is not available.',
        );
      }
      return false;
    }

    final cleanPhone = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    final url = Uri.parse('tel:$cleanPhone');

    try {
      final launched = await launchUrl(url, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Gagal membuka pendail telefon.' : 'Unable to open phone dialer.',
        );
      }
      return launched;
    } catch (e) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat membuka panggilan: $e' : 'Error opening call: $e',
        );
      }
      return false;
    }
  }
}
