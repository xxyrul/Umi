import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'auth_service.dart';
import 'widgets/google_activation_sheet.dart';
import 'widgets/forgot_password_sheet.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final _formKey = GlobalKey<FormState>();

  bool _isSigningUp = false;
  bool _isLoading = false;
  bool _obscurePassword = true;
  String? _errorMessage;

  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _inviteCodeController = TextEditingController();

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _inviteCodeController.dispose();
    super.dispose();
  }

  void _toggleMode() {
    setState(() {
      _isSigningUp = !_isSigningUp;
      _errorMessage = null;
      // Clear sign-up only fields when switching back to sign-in
      if (!_isSigningUp) {
        _nameController.clear();
        _inviteCodeController.clear();
      }
    });
  }

  Future<void> _handleEmailSubmit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = ref.read(authServiceProvider);
    try {
      if (_isSigningUp) {
        await auth.register(
          email: _emailController.text.trim(),
          password: _passwordController.text,
          displayName: _nameController.text.trim().isNotEmpty
              ? _nameController.text.trim()
              : 'Agent',
          inviteCode: _inviteCodeController.text.trim(),
        );
      } else {
        await auth.signIn(
          _emailController.text.trim(),
          _passwordController.text,
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = e.toString().replaceAll('Exception:', '').trim());
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  int _googleFlowToken = 0;

  Future<void> _handleGoogleSignIn() async {
    final busy = ref.read(googleAuthBusyProvider.notifier);
    final token = ++_googleFlowToken;
    busy.state = true;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final auth = ref.read(authServiceProvider);
    try {
      final cred = await auth.signInWithGoogle();
      if (cred == null || cred.user == null) {
        // User cancelled Google picker
        if (mounted) setState(() => _isLoading = false);
        return;
      }
      final user = cred.user!;
      final isReady = await auth.handlePostGoogleSignIn(user);

      if (!isReady && mounted) {
        // Brand-new Google user — needs invite code activation or access approval
        final prefilledCode = _inviteCodeController.text.trim();
        if (prefilledCode.isNotEmpty) {
          try {
            await auth.completeGoogleRegistration(
              uid: user.uid,
              email: user.email ?? '',
              displayName: user.displayName ?? 'Agent',
              inviteCode: prefilledCode,
            );
            return;
          } catch (e) {
            if (mounted) {
              await _showGoogleActivationModal(user, initialCode: prefilledCode, initialError: e.toString().replaceAll('Exception:', '').trim());
            }
            return;
          }
        }
        await _showGoogleActivationModal(user);
      }
      // isReady == true: router automatically handles navigation based on user profile status
    } catch (e) {
      if (mounted) {
        setState(() => _errorMessage = e.toString().replaceAll('Exception:', '').trim());
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
      // Let any sheet close animation finish before the router may navigate.
      Future.delayed(const Duration(milliseconds: 350), () {
        if (token == _googleFlowToken) busy.state = false;
      });
    }
  }

  Future<void> _showGoogleActivationModal(User user, {String initialCode = '', String? initialError}) async {
    final authService = ref.read(authServiceProvider);
    bool switching = false;

    final completed = await GoogleActivationSheet.show(
      context: context,
      user: user,
      initialCode: initialCode,
      initialError: initialError,
      onSwitchAccount: () {
        switching = true;
        () async {
          await authService.signOut();
          if (mounted) _handleGoogleSignIn();
        }();
      },
    );

    // User tapped "Switch": a fresh sign-in is already running, don't touch auth.
    if (switching) return;
    if (completed == true) return;

    final existingProfile = ref.read(currentUserProfileProvider).value;
    if (existingProfile != null) return;

    await authService.signOut();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
        content: Text(
          ref.read(languageProvider) == 'BM'
              ? 'Log masuk dibatalkan. Cuba semula atau gunakan akaun Google lain.'
              : 'Sign-in cancelled. Try again or use a different Google account.',
        ),
        duration: const Duration(seconds: 4),
        behavior: SnackBarBehavior.floating,
      ));
    }
  }

  void _showForgotPasswordModal() {
    ForgotPasswordSheet.show(
      context: context,
      initialEmail: _emailController.text.trim(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Stack(
          children: [
            // Language toggle
            Positioned(
              top: 12,
              right: 16,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'BM', label: Text('BM')),
                  ButtonSegment(value: 'EN', label: Text('EN')),
                ],
                selected: {isBM ? 'BM' : 'EN'},
                onSelectionChanged: (s) =>
                    ref.read(languageProvider.notifier).setLanguage(s.first),
                style: const ButtonStyle(visualDensity: VisualDensity.compact),
              ),
            ),

            LayoutBuilder(
              builder: (context, constraints) {
                return SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 40),
                  child: ConstrainedBox(
                    constraints: BoxConstraints(minHeight: constraints.maxHeight),
                    child: Form(
                      key: _formKey,
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Logo
                      Center(
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: colors.maroonPrimary,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: colors.maroonPrimary.withValues(alpha: 0.35),
                                blurRadius: 16,
                                offset: const Offset(0, 6),
                              ),
                            ],
                          ),
                          child: Center(
                            child: SvgPicture.asset(
                              'assets/artha_logo.svg',
                              width: 58,
                              height: 58,
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        'artha',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 30,
                          fontWeight: FontWeight.w800,
                          color: colors.textPrimary,
                          letterSpacing: -0.8,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Master Listing CRM',
                        textAlign: TextAlign.center,
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: colors.maroonSecondary,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'We build trust, you build future',
                        textAlign: TextAlign.center,
                        style: TextStyle(fontSize: 12, color: colors.textMuted),
                      ),
                      const SizedBox(height: 28),

                      // Mode label chip
                      Center(
                        child: AnimatedSwitcher(
                          duration: const Duration(milliseconds: 180),
                          child: Container(
                            key: ValueKey(_isSigningUp),
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 5),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(20),
                              border: Border.all(color: colors.border),
                            ),
                            child: Text(
                              _isSigningUp
                                  ? (isBM ? 'Pendaftaran Akaun Baru' : 'New Account Registration')
                                  : (isBM ? 'Log Masuk Akaun' : 'Sign In to Your Account'),
                              style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w600,
                                color: colors.textSecondary,
                              ),
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),

                      // Error message
                      if (_errorMessage != null) ...[
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.errorLight,
                            borderRadius: BorderRadius.circular(12),
                            border: Border.all(color: AppColors.error),
                          ),
                          child: Text(
                            _errorMessage!,
                            style: const TextStyle(color: AppColors.error, fontSize: 13),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Full Name (sign-up only)
                      if (_isSigningUp) ...[
                        _FieldLabel(isBM ? 'Nama Penuh' : 'Full Name', colors),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _nameController,
                          style: TextStyle(color: colors.textPrimary),
                          textCapitalization: TextCapitalization.words,
                          decoration: InputDecoration(
                            hintText: isBM ? 'Cth: Ahmad Razak' : 'e.g. John Doe',
                            prefixIcon: Icon(Icons.person_outline, color: colors.textDim),
                          ),
                          validator: (v) => _isSigningUp && (v == null || v.trim().isEmpty)
                              ? (isBM ? 'Sila masukkan nama penuh' : 'Please enter full name')
                              : null,
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Email
                      _FieldLabel(isBM ? 'Alamat E-mel' : 'Email Address', colors),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: InputDecoration(
                          hintText: isBM ? 'ejen@email.com' : 'agent@email.com',
                          prefixIcon: Icon(Icons.email_outlined, color: colors.textDim),
                        ),
                        validator: (v) => (v == null || !v.contains('@'))
                            ? (isBM ? 'Sila masukkan e-mel yang sah' : 'Please enter a valid email')
                            : null,
                      ),
                      const SizedBox(height: 14),

                      // Password
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _FieldLabel(isBM ? 'Kata Laluan' : 'Password', colors),
                          if (!_isSigningUp)
                            GestureDetector(
                              onTap: _showForgotPasswordModal,
                              child: Text(
                                isBM ? 'Lupa kata laluan?' : 'Forgot password?',
                                style: TextStyle(
                                  fontSize: 12,
                                  color: colors.maroonPrimary,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          prefixIcon: Icon(Icons.lock_outline, color: colors.textDim),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: colors.textDim,
                            ),
                            onPressed: () =>
                                setState(() => _obscurePassword = !_obscurePassword),
                          ),
                        ),
                        validator: (v) => (v == null || v.length < 6)
                            ? (isBM
                                ? 'Kata laluan sekurang-kurangnya 6 aksara'
                                : 'Password must be at least 6 characters')
                            : null,
                      ),
                      const SizedBox(height: 14),

                      // Invite Code (sign-up only)
                      if (_isSigningUp) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            _FieldLabel(isBM ? 'Kod Jemputan Agensi' : 'Agency Invite Code', colors),
                            Text(
                              isBM ? '(Pilihan)' : '(Optional)',
                              style: TextStyle(fontSize: 11, color: colors.textDim),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isBM
                              ? 'Masukkan kod untuk akses segera. Tanpa kod, permohonan dihantar untuk kelulusan admin.'
                              : 'Enter code for instant access. Without code, a request is submitted for admin approval.',
                          style: TextStyle(fontSize: 11, color: colors.textDim, height: 1.4),
                        ),
                        const SizedBox(height: 8),
                        TextFormField(
                          controller: _inviteCodeController,
                          textCapitalization: TextCapitalization.characters,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                          decoration: InputDecoration(
                            hintText: isBM ? 'Contoh: 7K9X-482A' : 'e.g. 7K9X-482A',
                            prefixIcon: Icon(Icons.key_outlined, color: colors.maroonPrimary),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Primary action button
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleEmailSubmit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: colors.maroonPrimary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 14),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20, height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2, color: Colors.white,
                                ),
                              )
                            : Text(
                                _isSigningUp
                                    ? (isBM ? 'Daftar Akaun' : 'Register Account')
                                    : (isBM ? 'Log Masuk' : 'Sign In'),
                                style: const TextStyle(
                                  fontSize: 15, fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                      const SizedBox(height: 18),

                      // OR divider
                      Row(
                        children: [
                          Expanded(child: Divider(color: colors.border)),
                          Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 14),
                            child: Text(
                              isBM ? 'ATAU' : 'OR',
                              style: TextStyle(
                                color: colors.textDim,
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                letterSpacing: 1,
                              ),
                            ),
                          ),
                          Expanded(child: Divider(color: colors.border)),
                        ],
                      ),
                      const SizedBox(height: 18),

                      // Google button — label changes per mode
                      OutlinedButton(
                        onPressed: _isLoading ? null : _handleGoogleSignIn,
                        style: OutlinedButton.styleFrom(
                          backgroundColor: colors.surface,
                          foregroundColor: colors.textPrimary,
                          side: BorderSide(color: colors.border),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            SizedBox(
                              width: 22, height: 22,
                              child: SvgPicture.asset('assets/google_g.svg'),
                            ),
                            const SizedBox(width: 12),
                            Text(
                              _isSigningUp
                                  ? (isBM ? 'Daftar dengan Google' : 'Register with Google')
                                  : (isBM ? 'Log Masuk dengan Google' : 'Sign In with Google'),
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.w700,
                                color: colors.textPrimary,
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Toggle sign-in / sign-up
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _isSigningUp
                                ? (isBM ? 'Sudah ada akaun?' : 'Already have an account?')
                                : (isBM ? 'Belum ada akaun?' : "Don't have an account?"),
                            style: TextStyle(color: colors.textMuted, fontSize: 13),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: _toggleMode,
                            child: Text(
                              _isSigningUp
                                  ? (isBM ? 'Log Masuk' : 'Sign In')
                                  : (isBM ? 'Daftar Sekarang' : 'Register Now'),
                              style: TextStyle(
                                color: colors.maroonPrimary,
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ),
            );
          },
        ),
          ],
        ),
      ),
    );
  }
}

class _FieldLabel extends StatelessWidget {
  final String text;
  final AppThemeColors colors;
  const _FieldLabel(this.text, this.colors);

  @override
  Widget build(BuildContext context) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 13,
        fontWeight: FontWeight.w600,
        color: colors.textMuted,
      ),
    );
  }
}
