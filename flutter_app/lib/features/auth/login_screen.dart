import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'auth_service.dart';

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
    final codeController = TextEditingController(text: initialCode);
    final authService = ref.read(authServiceProvider);
    final isBM = ref.read(languageProvider) == 'BM';
    bool isSubmitting = false;
    bool actionCompleted = false;
    bool switching = false;
    String? requestError = initialError;
    final colors = context.colors;

    final bool? completed;
    try {
      completed = await showModalBottomSheet<bool>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: colors.card,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (ctx) => StatefulBuilder(
        builder: (_, setModalState) {
          return SingleChildScrollView(
            physics: const ClampingScrollPhysics(),
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            padding: EdgeInsets.only(
              left: 24, right: 24, top: 24,
              bottom: MediaQuery.viewInsetsOf(ctx).bottom + ctx.safeBottomPadding(16.0),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Handle
                Center(
                  child: Container(
                    width: 36, height: 4,
                    margin: const EdgeInsets.only(bottom: 16),
                    decoration: BoxDecoration(
                      color: colors.textDim.withValues(alpha: 0.3),
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),

                // Header
                Row(
                  children: [
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isBM ? 'Akaun Baru Dikesan' : 'New Account Detected',
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: colors.textPrimary,
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isBM
                                ? 'Akaun Google ini belum berdaftar dengan Artha.'
                                : 'This Google account is not yet registered with Artha.',
                            style: TextStyle(fontSize: 12, color: colors.textMuted),
                          ),
                        ],
                      ),
                    ),
                    IconButton(
                      icon: Icon(Icons.close, color: colors.textMuted),
                      onPressed: () => Navigator.pop(ctx, false),
                    ),
                  ],
                ),
                const SizedBox(height: 16),

                // Google account card
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.border),
                  ),
                  child: Row(
                    children: [
                      CircleAvatar(
                        radius: 18,
                        backgroundColor: colors.maroonPrimary.withValues(alpha: 0.2),
                        backgroundImage: (user.photoURL?.isNotEmpty == true)
                            ? NetworkImage(user.photoURL!)
                            : null,
                        child: (user.photoURL == null || user.photoURL!.isEmpty)
                            ? Text(
                                user.displayName?.isNotEmpty == true
                                    ? user.displayName![0].toUpperCase()
                                    : 'G',
                                style: TextStyle(
                                  color: colors.maroonPrimary,
                                  fontWeight: FontWeight.bold,
                                ),
                              )
                            : null,
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              user.displayName ?? (isBM ? 'Pengguna Google' : 'Google User'),
                              style: TextStyle(
                                color: colors.textPrimary,
                                fontWeight: FontWeight.bold,
                                fontSize: 13,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            Text(
                              user.email ?? '',
                              style: TextStyle(color: colors.textMuted, fontSize: 11),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                      TextButton(
                        style: TextButton.styleFrom(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          minimumSize: Size.zero,
                          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                        ),
                        onPressed: isSubmitting
                            ? null
                            : () async {
                                switching = true;
                                Navigator.pop(ctx, false);
                                await authService.signOut();
                                if (mounted) _handleGoogleSignIn();
                              },
                        child: Text(
                          isBM ? 'Tukar' : 'Switch',
                          style: TextStyle(
                            color: colors.maroonPrimary,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 20),

                // Invite code field
                TextField(
                  controller: codeController,
                  textCapitalization: TextCapitalization.characters,
                  style: TextStyle(
                    color: colors.textPrimary,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 1.5,
                  ),
                  decoration: InputDecoration(
                    labelText: isBM
                        ? 'Kod Jemputan Agensi (Jika ada)'
                        : 'Agency Invite Code (If available)',
                    hintText: 'CTH: 7K9X-482A',
                    prefixIcon: Icon(Icons.vpn_key_outlined, color: colors.maroonPrimary),
                  ),
                ),
                const SizedBox(height: 16),

                // Error
                if (requestError != null) ...[
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: colors.errorLight,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: colors.error.withValues(alpha: 0.4)),
                    ),
                    child: Text(
                      requestError!,
                      style: TextStyle(color: colors.error, fontSize: 12, height: 1.35),
                    ),
                  ),
                  const SizedBox(height: 12),
                ],

                // Activate with code
                ElevatedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          final code = codeController.text.trim();
                          if (code.isEmpty) {
                            ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                              content: Text(isBM
                                  ? 'Masukkan kod atau tekan Mohon Kelulusan.'
                                  : 'Enter a code or tap Request Access.'),
                            ));
                            return;
                          }
                          setModalState(() => isSubmitting = true);
                          FocusScope.of(ctx).unfocus();
                          try {
                            actionCompleted = true;
                            await authService.completeGoogleRegistration(
                              uid: user.uid,
                              email: user.email ?? '',
                              displayName: user.displayName ?? 'Agent',
                              inviteCode: code,
                            );
                            if (ctx.mounted) Navigator.of(ctx, rootNavigator: true).pop(true);
                          } catch (err) {
                            actionCompleted = false;
                            if (ctx.mounted) {
                              setModalState(() {
                                isSubmitting = false;
                                requestError = err.toString().replaceAll('Exception:', '').trim();
                              });
                            }
                          }
                        },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: isSubmitting
                      ? const SizedBox(
                          width: 18, height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : Text(
                          isBM ? 'Aktifkan dengan Kod' : 'Activate with Code',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
                const SizedBox(height: 10),

                // Divider
                Row(
                  children: [
                    Expanded(child: Divider(color: colors.border)),
                    Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 12),
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
                const SizedBox(height: 10),

                // Request access without code
                OutlinedButton(
                  onPressed: isSubmitting
                      ? null
                      : () async {
                          setModalState(() {
                            isSubmitting = true;
                            requestError = null;
                          });
                          try {
                            actionCompleted = true;
                            await authService.requestAgentAccessGoogle(
                              uid: user.uid,
                              email: user.email ?? '',
                              displayName: user.displayName ?? 'Agent',
                            );
                            if (ctx.mounted) Navigator.of(ctx, rootNavigator: true).pop(true);
                          } catch (err) {
                            actionCompleted = false;
                            if (ctx.mounted) {
                              setModalState(() {
                                isSubmitting = false;
                                requestError = err is FirebaseException
                                    ? (isBM
                                        ? 'Permohonan gagal (${err.code}).'
                                        : 'Request failed (${err.code}).')
                                    : err.toString().replaceAll('Exception:', '').trim();
                              });
                            }
                          }
                        },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: Text(
                    isBM ? 'Mohon Kelulusan Tanpa Kod' : 'Request Access Without Code',
                    style: TextStyle(color: colors.textSecondary),
                  ),
                ),
                const SizedBox(height: 8),

                // Info note
                Text(
                  isBM
                      ? '* Permohonan tanpa kod memerlukan kelulusan manual daripada pentadbir agensi.'
                      : '* Requests without a code require manual approval from your agency admin.',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: colors.textDim, height: 1.4),
                ),
              ],
            ),
          );
        },
      ),
    );
    } finally {
      codeController.dispose();
    }

    // User tapped "Switch": a fresh sign-in is already running — don't touch auth.
    if (switching) return;

    // If user submitted successfully, router handles transition automatically
    if (actionCompleted || completed == true) {
      return;
    }

    // Check if user profile was actually created before considering it a cancellation
    final existingProfile = ref.read(currentUserProfileProvider).value;
    if (existingProfile != null) {
      // Profile exists, user did not cancel
      return;
    }

    // Truly dismissed without completing — sign out and inform user
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

  void _showForgotPasswordModal() async {
    final emailCtrl = TextEditingController(text: _emailController.text.trim());
    final authService = ref.read(authServiceProvider);
    final isBM = ref.read(languageProvider) == 'BM';
    bool isSending = false;
    final colors = context.colors;

    try {
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: colors.card,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
        ),
        builder: (ctx) => StatefulBuilder(
          builder: (_, setModalState) {
            return SingleChildScrollView(
              physics: const ClampingScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: EdgeInsets.only(
                left: 24, right: 24, top: 24,
                bottom: MediaQuery.viewInsetsOf(ctx).bottom + ctx.safeBottomPadding(16.0),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Lupa Kata Laluan' : 'Forgot Password',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: colors.textMuted),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isBM
                        ? 'Masukkan e-mel anda dan kami akan hantarkan pautan untuk tetapkan semula kata laluan.'
                        : 'Enter your email and we\'ll send you a password reset link.',
                    style: TextStyle(fontSize: 13, color: colors.textMuted, height: 1.45),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      hintText: isBM ? 'nama@email.com' : 'your@email.com',
                      prefixIcon: Icon(Icons.email_outlined, color: colors.textDim),
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: isSending
                        ? null
                        : () async {
                            final email = emailCtrl.text.trim();
                            if (email.isEmpty || !email.contains('@')) {
                              ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                                content: Text(isBM
                                    ? 'Sila masukkan e-mel yang sah.'
                                    : 'Please enter a valid email.'),
                              ));
                              return;
                            }
                            setModalState(() => isSending = true);
                            try {
                              await authService.sendPasswordReset(email);
                              if (ctx.mounted) {
                                Navigator.pop(ctx);
                              }
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                                  backgroundColor: const Color(0xFF10B981),
                                  content: Text(
                                    isBM
                                        ? 'Pautan tetapan semula dihantar ke $email!'
                                        : 'Reset link sent to $email!',
                                  ),
                                ));
                              }
                            } catch (err) {
                              if (ctx.mounted) {
                                setModalState(() => isSending = false);
                                ScaffoldMessenger.of(ctx).showSnackBar(SnackBar(
                                  content: Text(
                                    err.toString().replaceAll('Exception:', '').trim(),
                                  ),
                                ));
                              }
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.maroonPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: isSending
                        ? const SizedBox(
                            width: 18, height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                          )
                        : Text(
                            isBM ? 'Hantar Pautan Reset' : 'Send Reset Link',
                            style: const TextStyle(fontWeight: FontWeight.bold),
                          ),
                  ),
                ],
              ),
            );
          },
        ),
      );
    } finally {
      emailCtrl.dispose();
    }
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
