import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'security_service.dart';

class SecurityScreen extends ConsumerStatefulWidget {
  const SecurityScreen({super.key});

  @override
  ConsumerState<SecurityScreen> createState() => _SecurityScreenState();
}

class _SecurityScreenState extends ConsumerState<SecurityScreen> {
  bool _pinEnabled = false;
  bool _biometricsEnabled = false;
  bool _screenshotProtection = false;
  int _timeoutMs = 0;
  bool _biometricSupported = false;
  bool _isLoading = true;

  AppThemeColors get colors => context.colors;

  @override
  void initState() {
    super.initState();
    _loadSettings();
  }

  Future<void> _loadSettings() async {
    final security = ref.read(securityServiceProvider);
    final pin = await security.isPinLockEnabled();
    final bio = await security.isBiometricsEnabled();
    final bioAvail = await security.isBiometricAvailable();
    final timeout = await security.getLockTimeoutMs();
    final screenshot = await security.isScreenshotProtectionEnabled();

    if (mounted) {
      setState(() {
        _pinEnabled = pin;
        _biometricsEnabled = bio;
        _biometricSupported = bioAvail;
        _timeoutMs = timeout;
        _screenshotProtection = screenshot;
        _isLoading = false;
      });
    }
  }

  void _showSetPinDialog({bool isChanging = false}) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => _SetPinBottomSheet(
        isChanging: isChanging,
        onSuccess: () => _loadSettings(),
      ),
    );
  }

  void _showDisablePinDialog() {
    final isBM = ref.read(languageProvider) == 'BM';

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(isBM ? 'Nyahaktifkan App Lock?' : 'Disable App Lock?', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Text(
          isBM
              ? 'Aplikasi tidak lagi memerlukan PIN atau cap jari untuk dibuka.'
              : 'The app will no longer require a PIN or fingerprint to open.',
          style: TextStyle(color: colors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted))),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(securityServiceProvider).removePinLock();
              await _loadSettings();
            },
            child: Text(isBM ? 'Nyahaktifkan' : 'Disable'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: colors.textPrimary),
            onPressed: () => Navigator.pop(context),
          ),
          title: Text(
            isBM ? 'Privasi & Keselamatan' : 'Privacy & Security',
            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
          ),
          backgroundColor: colors.surface,
          elevation: 0,
        ),
        body: Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
      );
    }

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Privasi & Keselamatan' : 'Privacy & Security',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.textPrimary),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Unified App Lock & Biometrics Section
          _buildSectionHeader(isBM ? 'KUNCI APLIKASI (APP LOCK)' : 'APP LOCK'),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                // Master PIN Lock Switch
                SwitchListTile(
                  activeColor: colors.maroonPrimary,
                  secondary: Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      color: colors.maroonLight,
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Icon(Icons.pin, color: colors.maroonPrimary, size: 20),
                  ),
                  title: Text(
                    isBM ? 'Kunci PIN 4-Digit' : '4-Digit PIN Lock',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isBM ? 'Minta PIN 4-digit semasa buka aplikasi' : 'Require 4-digit PIN when opening app',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  value: _pinEnabled,
                  onChanged: (val) {
                    if (val) {
                      _showSetPinDialog();
                    } else {
                      _showDisablePinDialog();
                    }
                  },
                ),

                // Nested sub-options: Fingerprint & Change PIN (Only visible/active when PIN is enabled)
                if (_pinEnabled) ...[
                  Divider(color: colors.border, height: 1),
                  Padding(
                    padding: const EdgeInsets.only(left: 12),
                    child: SwitchListTile(
                      activeColor: const Color(0xFF10B981),
                      secondary: Container(
                        width: 32,
                        height: 32,
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withValues(alpha: 0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Icon(Icons.fingerprint, color: Color(0xFF10B981), size: 20),
                      ),
                      title: Text(
                        isBM ? 'Buka dengan Cap Jari' : 'Unlock with Fingerprint',
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 13),
                      ),
                      subtitle: Text(
                        _biometricSupported
                            ? (isBM ? 'Buka kunci pantas tanpa perlu taip PIN' : 'Quick unlock without typing PIN')
                            : (isBM ? 'Sensor cap jari tidak dikesan' : 'Fingerprint sensor not detected'),
                        style: TextStyle(color: colors.textMuted, fontSize: 11),
                      ),
                      value: _biometricsEnabled && _biometricSupported,
                      onChanged: _biometricSupported
                          ? (val) async {
                              await ref.read(securityServiceProvider).setBiometricsEnabled(val);
                              _loadSettings();
                            }
                          : null,
                    ),
                  ),
                  Divider(color: colors.border, height: 1),
                  ListTile(
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                    leading: SizedBox(width: 34, child: Icon(Icons.edit_outlined, color: colors.textMuted, size: 20)),
                    title: Text(
                      isBM ? 'Tukar Kod PIN' : 'Change PIN Code',
                      style: TextStyle(color: colors.textPrimary, fontSize: 14),
                    ),
                    trailing: Icon(Icons.chevron_right, color: colors.textMuted),
                    onTap: () => _showSetPinDialog(isChanging: true),
                  ),
                ] else ...[
                  // Helpful note when PIN is disabled
                  Divider(color: colors.border, height: 1),
                  Padding(
                    padding: const EdgeInsets.all(14),
                    child: Row(
                      children: [
                        Icon(Icons.info_outline, size: 16, color: colors.textMuted),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            isBM
                                ? 'Aktifkan PIN dahulu untuk menggunakan cap jari & kunci automatik.'
                                : 'Enable PIN lock first to use fingerprint and auto-lock.',
                            style: TextStyle(color: colors.textMuted, fontSize: 11),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 20),

          // Auto-Lock Timeout Section (Only relevant when PIN enabled)
          if (_pinEnabled) ...[
            _buildSectionHeader(isBM ? 'KUNCI SEMULA AUTOMATIK' : 'AUTO-LOCK TIMEOUT'),
            Container(
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                children: [
                  _buildTimeoutOption(0, isBM ? 'Serta-merta' : 'Immediately'),
                  Divider(color: colors.border, height: 1),
                  _buildTimeoutOption(60000, isBM ? 'Selepas 1 Minit' : 'After 1 Minute'),
                  Divider(color: colors.border, height: 1),
                  _buildTimeoutOption(300000, isBM ? 'Selepas 5 Minit' : 'After 5 Minutes'),
                  Divider(color: colors.border, height: 1),
                  _buildTimeoutOption(900000, isBM ? 'Selepas 15 Minit' : 'After 15 Minutes'),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // Permissions & Privacy Guide
          _buildSectionHeader(isBM ? 'PANDUAN KEBENARAN' : 'PERMISSIONS GUIDE'),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: ListTile(
              contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              leading: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: const Color(0xFF6366F1).withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.verified_user_outlined, color: Color(0xFF6366F1), size: 20),
              ),
              title: Text(
                isBM ? 'Panduan Kebenaran & PDPA' : 'Permissions & PDPA Guide',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
              ),
              subtitle: Text(
                isBM ? 'Penjelasan akses GPS, kamera & privasi' : 'Why GPS, camera & storage are used',
                style: TextStyle(color: colors.textMuted, fontSize: 12),
              ),
              trailing: Icon(Icons.chevron_right, color: colors.textMuted),
              onTap: () => context.push('/permissions-guide'),
            ),
          ),
          const SizedBox(height: 20),

          // Screenshot Blocker Section (Direct & Plain Terminology)
          _buildSectionHeader(isBM ? 'SEKAT SCREENSHOT' : 'SCREENSHOT BLOCKER'),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: SwitchListTile(
              activeColor: colors.maroonPrimary,
              secondary: Container(
                width: 34,
                height: 34,
                decoration: BoxDecoration(
                  color: Colors.blueAccent.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Icon(Icons.no_photography_outlined, color: Colors.blueAccent, size: 20),
              ),
              title: Text(
                isBM ? 'Sekat Screenshot & Rakaman' : 'Block Screenshots & Recordings',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
              ),
              subtitle: Text(
                isBM
                    ? 'Halang pengguna daripada tangkap layar dokumen dalam app'
                    : 'Prevent taking screenshots or recording screens in app',
                style: TextStyle(color: colors.textMuted, fontSize: 12),
              ),
              value: _screenshotProtection,
              onChanged: (val) async {
                await ref.read(securityServiceProvider).setScreenshotProtection(val);
                _loadSettings();
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTimeoutOption(int ms, String label) {
    final isSelected = _timeoutMs == ms;
    return ListTile(
      title: Text(
        label,
        style: TextStyle(
          color: isSelected ? colors.maroonPrimary : colors.textPrimary,
          fontSize: 14,
          fontWeight: isSelected ? FontWeight.w700 : FontWeight.normal,
        ),
      ),
      trailing: isSelected ? Icon(Icons.check, color: colors.maroonPrimary, size: 20) : null,
      onTap: () async {
        await ref.read(securityServiceProvider).setLockTimeoutMs(ms);
        _loadSettings();
      },
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 1,
          color: colors.textMuted,
        ),
      ),
    );
  }
}

class _SetPinBottomSheet extends ConsumerStatefulWidget {
  final bool isChanging;
  final VoidCallback onSuccess;

  const _SetPinBottomSheet({
    required this.isChanging,
    required this.onSuccess,
  });

  @override
  ConsumerState<_SetPinBottomSheet> createState() => _SetPinBottomSheetState();
}

class _SetPinBottomSheetState extends ConsumerState<_SetPinBottomSheet> {
  int _step = 1; // 1 = Enter PIN, 2 = Confirm PIN
  String _firstPin = '';
  String _confirmPin = '';
  String _errorMessage = '';
  bool _isSuccess = false;

  void _handleDigit(String digit) async {
    if (_isSuccess) return;
    HapticFeedback.lightImpact();

    if (_step == 1) {
      if (_firstPin.length < 4) {
        final next = _firstPin + digit;
        setState(() {
          _firstPin = next;
          _errorMessage = '';
        });

        if (next.length == 4) {
          await Future.delayed(const Duration(milliseconds: 220));
          if (mounted) {
            setState(() {
              _step = 2;
              _confirmPin = '';
            });
          }
        }
      }
    } else {
      if (_confirmPin.length < 4) {
        final next = _confirmPin + digit;
        setState(() {
          _confirmPin = next;
          _errorMessage = '';
        });

        if (next.length == 4) {
          final isBM = ref.read(languageProvider) == 'BM';
          if (next == _firstPin) {
            // Success match
            HapticFeedback.mediumImpact();
            setState(() {
              _isSuccess = true;
            });
            await ref.read(securityServiceProvider).setPinLock(_firstPin);
            widget.onSuccess();
            await Future.delayed(const Duration(milliseconds: 350));
            if (mounted) {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  backgroundColor: const Color(0xFF10B981),
                  content: Row(
                    children: [
                      const Icon(Icons.check_circle_outline, color: Colors.white, size: 20),
                      const SizedBox(width: 8),
                      Text(
                        isBM ? 'PIN keselamatan berjaya ditetapkan! 🔒' : 'Security PIN successfully configured! 🔒',
                        style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                      ),
                    ],
                  ),
                ),
              );
            }
          } else {
            // Mismatch
            HapticFeedback.heavyImpact();
            setState(() {
              _errorMessage = isBM ? 'PIN tidak sepadan! Sila cuba semula.' : 'PINs do not match! Please try again.';
            });
            await Future.delayed(const Duration(milliseconds: 900));
            if (mounted) {
              setState(() {
                _step = 1;
                _firstPin = '';
                _confirmPin = '';
                _errorMessage = '';
              });
            }
          }
        }
      }
    }
  }

  void _handleBackspace() {
    HapticFeedback.selectionClick();
    setState(() {
      if (_step == 1) {
        if (_firstPin.isNotEmpty) {
          _firstPin = _firstPin.substring(0, _firstPin.length - 1);
        }
      } else {
        if (_confirmPin.isNotEmpty) {
          _confirmPin = _confirmPin.substring(0, _confirmPin.length - 1);
        } else {
          _step = 1;
        }
      }
      _errorMessage = '';
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = ref.watch(languageProvider) == 'BM';
    final currentPin = _step == 1 ? _firstPin : _confirmPin;

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(28)),
      ),
      padding: EdgeInsets.only(
        top: 12,
        bottom: MediaQuery.of(context).padding.bottom + 20,
        left: 24,
        right: 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag Handle
          Container(
            width: 40,
            height: 4,
            decoration: BoxDecoration(
              color: colors.border,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
          const SizedBox(height: 16),

          // Header Row with Step indicator & Close Button
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: colors.maroonLight,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  _step == 1
                      ? (isBM ? 'LANGKAH 1 DARI 2' : 'STEP 1 OF 2')
                      : (isBM ? 'LANGKAH 2 DARI 2' : 'STEP 2 OF 2'),
                  style: TextStyle(
                    color: colors.maroonPrimary,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
              IconButton(
                icon: Icon(Icons.close, color: colors.textSecondary, size: 22),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Icon
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: _isSuccess
                  ? const Color(0xFF10B981).withValues(alpha: 0.15)
                  : colors.maroonLight,
              shape: BoxShape.circle,
            ),
            child: Icon(
              _isSuccess ? Icons.check_circle : (_step == 1 ? Icons.lock_outline : Icons.pin_outlined),
              color: _isSuccess ? const Color(0xFF10B981) : colors.maroonPrimary,
              size: 28,
            ),
          ),
          const SizedBox(height: 14),

          // Title
          Text(
            _isSuccess
                ? (isBM ? 'PIN Ditetapkan!' : 'PIN Configured!')
                : (_step == 1
                    ? (widget.isChanging
                        ? (isBM ? 'Tukar PIN Keselamatan' : 'Change Security PIN')
                        : (isBM ? 'Cipta PIN 4-Digit' : 'Create 4-Digit PIN'))
                    : (isBM ? 'Sahkan PIN 4-Digit' : 'Confirm 4-Digit PIN')),
            style: TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
            ),
          ),
          const SizedBox(height: 6),

          // Subtitle
          Text(
            _isSuccess
                ? (isBM ? 'Aplikasi anda kini dilindungi dengan selamat.' : 'Your app is now securely protected.')
                : (_step == 1
                    ? (isBM
                        ? 'Pilih 4 angka rahsia untuk mengunci aplikasi'
                        : 'Choose 4 secret digits to secure your app')
                    : (isBM
                        ? 'Masukkan semula 4 angka tadi untuk memastikan ia betul'
                        : 'Re-enter your 4 digits to confirm they match')),
            style: TextStyle(fontSize: 13, color: colors.textSecondary),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 24),

          // 4 Dots Indicator
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(4, (index) {
              final isFilled = index < currentPin.length;
              final isError = _errorMessage.isNotEmpty;
              final dotColor = _isSuccess
                  ? const Color(0xFF10B981)
                  : (isError
                      ? Colors.redAccent
                      : (isFilled ? colors.maroonPrimary : Colors.transparent));
              final borderColor = _isSuccess
                  ? const Color(0xFF10B981)
                  : (isError ? Colors.redAccent : (isFilled ? colors.maroonPrimary : colors.border));

              return AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                margin: const EdgeInsets.symmetric(horizontal: 10),
                width: 18,
                height: 18,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: dotColor,
                  border: Border.all(color: borderColor, width: 2),
                ),
              );
            }),
          ),
          const SizedBox(height: 14),

          // Error Message or Placeholder
          SizedBox(
            height: 22,
            child: _errorMessage.isNotEmpty
                ? Text(
                    _errorMessage,
                    style: const TextStyle(
                      color: Colors.redAccent,
                      fontSize: 12.5,
                      fontWeight: FontWeight.w600,
                    ),
                  )
                : null,
          ),
          const SizedBox(height: 12),

          // Numeric Keypad
          Column(
            children: [
              for (var row = 0; row < 3; row++)
                Padding(
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      for (var col = 1; col <= 3; col++)
                        _buildKeypadButton('${row * 3 + col}', colors),
                    ],
                  ),
                ),
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 6),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    // Left: Back to Step 1 button (if in step 2)
                    SizedBox(
                      width: 68,
                      height: 68,
                      child: _step == 2
                          ? IconButton(
                              icon: Icon(Icons.arrow_back_rounded, color: colors.textSecondary, size: 24),
                              onPressed: () {
                                HapticFeedback.selectionClick();
                                setState(() {
                                  _step = 1;
                                  _confirmPin = '';
                                  _errorMessage = '';
                                });
                              },
                            )
                          : const SizedBox.shrink(),
                    ),
                    _buildKeypadButton('0', colors),
                    // Right: Backspace
                    SizedBox(
                      width: 68,
                      height: 68,
                      child: IconButton(
                        icon: Icon(Icons.backspace_outlined, color: colors.textSecondary, size: 24),
                        onPressed: _handleBackspace,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildKeypadButton(String digit, AppThemeColors colors) {
    return InkWell(
      onTap: () => _handleDigit(digit),
      borderRadius: BorderRadius.circular(34),
      child: Container(
        width: 68,
        height: 68,
        decoration: BoxDecoration(
          color: colors.surface,
          shape: BoxShape.circle,
          border: Border.all(color: colors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          digit,
          style: TextStyle(
            fontSize: 22,
            fontWeight: FontWeight.w700,
            color: colors.textPrimary,
          ),
        ),
      ),
    );
  }
}

