import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';
import '../widgets/app_toast.dart';

/// Centralized utility for handling Malaysian phone numbers (+60)
/// and safely launching WhatsApp and phone dialers with fallback toasts.
class PhoneIntentHelper {
  /// Normalizes any raw phone input string to a valid Malaysian phone number format (`601XXXXXXXX`).
  /// Returns null if the phone is empty or invalid.
  static String? formatMalaysianWhatsAppNumber(String rawPhone) {
    var clean = rawPhone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.isEmpty) return null;

    if (clean.startsWith('60')) {
      // Valid length for Malaysian mobile numbers: 601XXXXXXXX (11-12 digits)
      return clean.length >= 10 ? clean : null;
    }
    if (clean.startsWith('0')) {
      final normalized = '60${clean.substring(1)}';
      return normalized.length >= 10 ? normalized : null;
    }
    if (clean.startsWith('1')) {
      final normalized = '60$clean';
      return normalized.length >= 10 ? normalized : null;
    }
    return null;
  }

  /// Safely opens WhatsApp with prefilled message.
  static Future<void> launchWhatsApp(
    BuildContext context, {
    required String phone,
    required String message,
    required bool isBM,
  }) async {
    final formatted = formatMalaysianWhatsAppNumber(phone);
    if (formatted == null) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Nombor telefon tidak sah atau belum diisi.' : 'Invalid or missing phone number.',
        );
      }
      return;
    }

    final uri = Uri.parse('https://wa.me/$formatted?text=${Uri.encodeComponent(message)}');
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Gagal membuka WhatsApp.' : 'Could not open WhatsApp.',
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Aplikasi WhatsApp tidak dijumpai pada peranti.' : 'WhatsApp app not found on device.',
        );
      }
    }
  }

  /// Safely opens the device phone dialer.
  static Future<void> launchDialer(
    BuildContext context, {
    required String phone,
    required bool isBM,
  }) async {
    final clean = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    if (clean.isEmpty) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Nombor telefon tidak sah atau belum diisi.' : 'Invalid or missing phone number.',
        );
      }
      return;
    }

    final uri = Uri.parse('tel:$clean');
    try {
      final launched = await launchUrl(uri, mode: LaunchMode.externalApplication);
      if (!launched && context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Gagal membuka aplikasi panggilan.' : 'Could not launch phone dialer.',
        );
      }
    } catch (e) {
      if (context.mounted) {
        AppToast.error(
          context,
          isBM ? 'Fungsi panggilan telefon tidak disokong.' : 'Phone calling is not supported.',
        );
      }
    }
  }
}
