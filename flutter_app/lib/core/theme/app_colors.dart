import 'package:flutter/material.dart';

class AppColors {
  // Softened slate dark canvas & surfaces (Calibrated to eliminate eye strain)
  static const Color canvas = Color(0xFF121417);
  static const Color surface = Color(0xFF181A1D);
  static const Color card = Color(0xFF1E2126);
  static const Color cardHover = Color(0xFF262A30);

  // Brand Maroon Accents
  static const Color maroonPrimary = Color(0xFFE11D48);
  static const Color maroonDark = Color(0xFF9F1239);
  static const Color maroonLight = Color(0x26E11D48); // ~15% opacity
  static const Color maroonSecondary = Color(0xFFFFB2B8);

  // Typography
  static const Color textPrimary = Color(0xFFF1F5F9);
  static const Color textSecondary = Color(0xFFCBD5E1);
  static const Color textMuted = Color(0xFF94A3B8);
  static const Color textDim = Color(0xFF64748B);

  // Borders
  static const Color border = Color(0xFF282C32);
  static const Color borderHighlight = Color(0x59E11D48);

  // Functional Status Colors
  static const Color success = Color(0xFF10B981);
  static const Color successLight = Color(0x2610B981);
  static const Color warning = Color(0xFFF59E0B);
  static const Color warningLight = Color(0x26F59E0B);
  static const Color error = Color(0xFFEF4444);
  static const Color errorLight = Color(0x26EF4444);
  static const Color info = Color(0xFF3B82F6);
  static const Color infoLight = Color(0x263B82F6);
}

class AppColorsLight {
  static const Color canvas = Color(0xFFF8FAFC);
  static const Color surface = Color(0xFFFFFFFF);
  static const Color card = Color(0xFFFFFFFF);
  static const Color cardHover = Color(0xFFF1F5F9);

  static const Color maroonPrimary = Color(0xFF881337);
  static const Color maroonDark = Color(0xFF4C0519);
  static const Color maroonLight = Color(0xFFFFF1F2);
  static const Color maroonSecondary = Color(0xFFBE123C);

  static const Color textPrimary = Color(0xFF0F172A);
  static const Color textSecondary = Color(0xFF334155);
  static const Color textMuted = Color(0xFF64748B);
  static const Color textDim = Color(0xFF94A3B8);

  static const Color border = Color(0xFFE2E8F0);
  static const Color borderHighlight = Color(0xFFFECDD3);

  static const Color success = Color(0xFF059669);
  static const Color successLight = Color(0xFFD1FAE5);
  static const Color warning = Color(0xFFD97706);
  static const Color warningLight = Color(0xFFFEF3C7);
  static const Color error = Color(0xFFDC2626);
  static const Color errorLight = Color(0xFFFEE2E2);
  static const Color info = Color(0xFF2563EB);
  static const Color infoLight = Color(0xFFDBEAFE);
}

class AppThemeColors {
  final bool isDark;
  final Color canvas;
  final Color surface;
  final Color card;
  final Color cardHover;
  final Color maroonPrimary;
  final Color maroonDark;
  final Color maroonLight;
  final Color maroonSecondary;
  final Color textPrimary;
  final Color textSecondary;
  final Color textMuted;
  final Color textDim;
  final Color border;
  final Color borderHighlight;
  final Color success;
  final Color successLight;
  final Color warning;
  final Color warningLight;
  final Color error;
  final Color errorLight;
  final Color info;
  final Color infoLight;

  const AppThemeColors({
    required this.isDark,
    required this.canvas,
    required this.surface,
    required this.card,
    required this.cardHover,
    required this.maroonPrimary,
    required this.maroonDark,
    required this.maroonLight,
    required this.maroonSecondary,
    required this.textPrimary,
    required this.textSecondary,
    required this.textMuted,
    required this.textDim,
    required this.border,
    required this.borderHighlight,
    required this.success,
    required this.successLight,
    required this.warning,
    required this.warningLight,
    required this.error,
    required this.errorLight,
    required this.info,
    required this.infoLight,
  });

  static const dark = AppThemeColors(
    isDark: true,
    canvas: Color(0xFF121417),
    surface: Color(0xFF181A1D),
    card: Color(0xFF1E2126),
    cardHover: Color(0xFF262A30),
    maroonPrimary: Color(0xFFE11D48),
    maroonDark: Color(0xFF9F1239),
    maroonLight: Color(0x26E11D48),
    maroonSecondary: Color(0xFFFFB2B8),
    textPrimary: Color(0xFFF1F5F9),
    textSecondary: Color(0xFFCBD5E1),
    textMuted: Color(0xFF94A3B8),
    textDim: Color(0xFF64748B),
    border: Color(0xFF282C32),
    borderHighlight: Color(0x59E11D48),
    success: Color(0xFF10B981),
    successLight: Color(0x2610B981),
    warning: Color(0xFFF59E0B),
    warningLight: Color(0x26F59E0B),
    error: Color(0xFFEF4444),
    errorLight: Color(0x26EF4444),
    info: Color(0xFF3B82F6),
    infoLight: Color(0x263B82F6),
  );

  static const light = AppThemeColors(
    isDark: false,
    canvas: Color(0xFFF8FAFC),
    surface: Color(0xFFFFFFFF),
    card: Color(0xFFFFFFFF),
    cardHover: Color(0xFFF1F5F9),
    maroonPrimary: Color(0xFF881337),
    maroonDark: Color(0xFF4C0519),
    maroonLight: Color(0xFFFFF1F2),
    maroonSecondary: Color(0xFFBE123C),
    textPrimary: Color(0xFF0F172A),
    textSecondary: Color(0xFF334155),
    textMuted: Color(0xFF64748B),
    textDim: Color(0xFF94A3B8),
    border: Color(0xFFE2E8F0),
    borderHighlight: Color(0xFFFECDD3),
    success: Color(0xFF059669),
    successLight: Color(0xFFD1FAE5),
    warning: Color(0xFFD97706),
    warningLight: Color(0xFFFEF3C7),
    error: Color(0xFFDC2626),
    errorLight: Color(0xFFFEE2E2),
    info: Color(0xFF2563EB),
    infoLight: Color(0xFFDBEAFE),
  );

  static AppThemeColors of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}

extension ThemeContextExtension on BuildContext {
  AppThemeColors get colors => AppThemeColors.of(this);
}
