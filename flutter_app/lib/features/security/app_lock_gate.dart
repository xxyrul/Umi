import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../auth/auth_service.dart';
import 'security_service.dart';

class AppLockGate extends ConsumerStatefulWidget {
  final Widget child;
  final bool initialLocked;
  const AppLockGate({
    super.key,
    required this.child,
    this.initialLocked = false,
  });

  @override
  ConsumerState<AppLockGate> createState() => _AppLockGateState();
}

class _AppLockGateState extends ConsumerState<AppLockGate> with WidgetsBindingObserver {
  late bool _isLocked;
  final bool _isLoading = false;
  String _enteredPin = '';
  String _errorMessage = '';
  DateTime? _pausedTime;
  bool _isAuthenticatingBiometric = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _isLocked = widget.initialLocked;
    if (_isLocked) {
      _tryBiometrics();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.paused) {
      _pausedTime = DateTime.now();
    } else if (state == AppLifecycleState.resumed) {
      if (_isAuthenticatingBiometric) {
        // Ignored: Biometric dialog itself triggered lifecycle change
        return;
      }

      final paused = _pausedTime;
      _pausedTime = null;

      if (paused != null) {
        final elapsed = DateTime.now().difference(paused).inMilliseconds;
        _checkLockOnResume(elapsed);
      }
    }
  }


  Future<void> _checkLockOnResume(int elapsedMs) async {
    final security = ref.read(securityServiceProvider);
    final isPinEnabled = await security.isPinLockEnabled();
    if (!isPinEnabled) return;

    final timeoutMs = await security.getLockTimeoutMs();
    if (elapsedMs >= timeoutMs && !_isLocked && mounted) {
      setState(() {
        _isLocked = true;
        _enteredPin = '';
        _errorMessage = '';
      });
      _tryBiometrics();
    }
  }

  Future<void> _tryBiometrics() async {
    final security = ref.read(securityServiceProvider);
    final bioEnabled = await security.isBiometricsEnabled();
    if (!bioEnabled || !mounted) return;

    _isAuthenticatingBiometric = true;
    try {
      final success = await security.authenticateWithBiometrics();
      if (success && mounted) {
        setState(() {
          _isLocked = false;
          _enteredPin = '';
          _errorMessage = '';
        });
      }
    } finally {
      // Delay resetting flag so resume event doesn't re-lock immediately
      Future.delayed(const Duration(milliseconds: 600), () {
        _isAuthenticatingBiometric = false;
      });
    }
  }

  Future<void> _handlePinDigit(String digit) async {
    if (_enteredPin.length >= 4) return;
    HapticFeedback.lightImpact();

    final newPin = _enteredPin + digit;
    setState(() {
      _enteredPin = newPin;
      _errorMessage = '';
    });

    if (newPin.length == 4) {
      final security = ref.read(securityServiceProvider);
      final isBM = ref.read(languageProvider) == 'BM';
      final remainingLockout = await security.getRemainingLockoutSeconds();
      if (remainingLockout > 0) {
        HapticFeedback.heavyImpact();
        setState(() {
          _enteredPin = '';
          _errorMessage = isBM
              ? 'Terlalu banyak percubaan gagal. Cuba lagi dalam ${remainingLockout}s.'
              : 'Too many failed attempts. Try again in ${remainingLockout}s.';
        });
        return;
      }

      final isValid = await security.verifyPin(newPin);
      if (isValid && mounted) {
        HapticFeedback.mediumImpact();
        setState(() {
          _isLocked = false;
          _enteredPin = '';
          _errorMessage = '';
        });
      } else if (mounted) {
        HapticFeedback.heavyImpact();
        final lockoutAfter = await security.getRemainingLockoutSeconds();
        setState(() {
          _enteredPin = '';
          _errorMessage = lockoutAfter > 0
              ? (isBM
                  ? 'Terlalu banyak percubaan gagal. Dikunci selama ${lockoutAfter}s.'
                  : 'Too many failed attempts. Locked for ${lockoutAfter}s.')
              : (isBM ? 'PIN tidak sah. Sila cuba lagi.' : 'Invalid PIN. Please try again.');
        });
      }
    }
  }

  void _handleBackspace() {
    if (_enteredPin.isNotEmpty) {
      HapticFeedback.selectionClick();
      setState(() {
        _enteredPin = _enteredPin.substring(0, _enteredPin.length - 1);
        _errorMessage = '';
      });
    }
  }

  void _showForgotPinDialog(AppThemeColors colors) {
    final isBM = ref.read(languageProvider) == 'BM';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          isBM ? 'Lupa PIN Keselamatan?' : 'Forgot Security PIN?',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
        ),
        content: Text(
          isBM
              ? 'Untuk keselamatan anda, anda boleh log keluar daripada akaun ejen dan menetapkan semula PIN setelah log masuk semula.'
              : 'For your security, you can sign out of your agent account and reset your PIN after signing back in.',
          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(securityServiceProvider).removePinLock();
              await ref.read(authServiceProvider).signOut();
              if (mounted) {
                setState(() {
                  _isLocked = false;
                  _enteredPin = '';
                  _errorMessage = '';
                });
              }
            },
            child: Text(isBM ? 'Log Keluar & Set Semula' : 'Sign Out & Reset'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const SizedBox.shrink(),
      );
    }

    if (!_isLocked) {
      return widget.child;
    }

    final isBM = ref.watch(languageProvider) == 'BM';

    return PopScope(
      canPop: false,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) {
          SystemNavigator.pop();
        }
      },
      child: Scaffold(
        backgroundColor: colors.canvas,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),
                Container(
                  width: 64,
                  height: 64,
                  decoration: BoxDecoration(
                    color: colors.maroonLight,
                    shape: BoxShape.circle,
                    border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                  ),
                  child: Center(
                    child: Icon(Icons.lock_outline, color: colors.maroonPrimary, size: 30),
                  ),
                ),
                const SizedBox(height: 20),
                Text(
                  'Artha App Lock',
                  style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: colors.textPrimary),
                ),
                const SizedBox(height: 6),
                Text(
                  isBM ? 'Masukkan 4-digit PIN keselamatan anda' : 'Enter your 4-digit security PIN',
                  style: TextStyle(fontSize: 13, color: colors.textSecondary),
                ),
                const SizedBox(height: 32),

                // 4 PIN Dots
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: List.generate(4, (index) {
                    final isFilled = index < _enteredPin.length;
                    return AnimatedContainer(
                      duration: const Duration(milliseconds: 150),
                      margin: const EdgeInsets.symmetric(horizontal: 10),
                      width: 16,
                      height: 16,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isFilled ? colors.maroonPrimary : Colors.transparent,
                        border: Border.all(
                          color: isFilled ? colors.maroonPrimary : colors.border,
                          width: 2,
                        ),
                      ),
                    );
                  }),
                ),
                if (_errorMessage.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Text(
                    _errorMessage,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 13, fontWeight: FontWeight.w600),
                  ),
                ],
                const Spacer(),

                // Numeric Keypad
                Column(
                  children: [
                    for (var row = 0; row < 3; row++)
                      Padding(
                        padding: const EdgeInsets.symmetric(vertical: 8),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            for (var col = 1; col <= 3; col++)
                              _buildKeypadButton('${row * 3 + col}', colors),
                          ],
                        ),
                      ),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                        children: [
                          IconButton(
                            onPressed: _tryBiometrics,
                            icon: const Icon(Icons.fingerprint, color: Color(0xFF10B981), size: 30),
                            padding: const EdgeInsets.all(18),
                          ),
                          _buildKeypadButton('0', colors),
                          IconButton(
                            onPressed: _handleBackspace,
                            icon: Icon(Icons.backspace_outlined, color: colors.textSecondary, size: 24),
                            padding: const EdgeInsets.all(18),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // Emergency Unlock Option
                TextButton(
                  onPressed: () => _showForgotPinDialog(colors),
                  child: Text(
                    isBM ? 'Lupa PIN? Log Keluar' : 'Forgot PIN? Sign Out',
                    style: TextStyle(color: colors.textMuted, fontSize: 13),
                  ),
                ),
                const SizedBox(height: 12),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildKeypadButton(String digit, AppThemeColors colors) {
    return InkWell(
      onTap: () => _handlePinDigit(digit),
      borderRadius: BorderRadius.circular(36),
      child: Container(
        width: 72,
        height: 72,
        decoration: BoxDecoration(
          color: colors.card,
          shape: BoxShape.circle,
          border: Border.all(color: colors.border),
        ),
        alignment: Alignment.center,
        child: Text(
          digit,
          style: TextStyle(fontSize: 24, fontWeight: FontWeight.w600, color: colors.textPrimary),
        ),
      ),
    );
  }
}
