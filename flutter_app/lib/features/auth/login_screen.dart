import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_svg/flutter_svg.dart';
import 'package:go_router/go_router.dart';
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

  // Form controllers
  final _nameController = TextEditingController();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _inviteCodeController = TextEditingController();

  @override
  void initState() {
    super.initState();
  }

  @override
  void dispose() {
    _nameController.dispose();
    _emailController.dispose();
    _passwordController.dispose();
    _inviteCodeController.dispose();
    super.dispose();
  }

  Future<void> _handleEmailSubmit() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = ref.read(authServiceProvider);
    final isBM = ref.read(languageProvider) == 'BM';

    try {
      if (_isSigningUp) {
        final cred = await auth.register(
          email: _emailController.text,
          password: _passwordController.text,
          displayName: _nameController.text,
          inviteCode: _inviteCodeController.text,
        );
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(cred.user!.uid)
            .get();
        final status = (doc.data()?['status'] ?? 'ACTIVE')
            .toString()
            .toUpperCase();
        if (mounted) {
          context.go(
            status == 'PENDING_APPROVAL' || status == 'PENDING'
                ? '/pending-approval'
                : '/',
          );
        }
      } else {
        final cred = await auth.signIn(
          _emailController.text,
          _passwordController.text,
        );
        final doc = await FirebaseFirestore.instance
            .collection('users')
            .doc(cred.user!.uid)
            .get();
        if (doc.exists) {
          final data = doc.data() ?? {};
          final status = (data['status'] ?? 'ACTIVE').toString().toUpperCase();
          final approved = data['approved'];
          final role = (data['role'] ?? 'AGENT').toString().toUpperCase();
          if (status == 'SUSPENDED') {
            await auth.signOut();
            throw Exception(
              isBM
                  ? 'Akaun ejen anda telah digantung oleh pentadbir.'
                  : 'Your agent account has been suspended by the administrator.',
            );
          }
          if (role != 'ADMIN' &&
              (status == 'PENDING_APPROVAL' ||
                  status == 'PENDING' ||
                  approved == false)) {
            if (mounted) context.go('/pending-approval');
            return;
          }
        }
        if (mounted) context.go('/');
      }
    } catch (e) {
      if (mounted) {
        setState(
          () =>
              _errorMessage = e.toString().replaceAll('Exception:', '').trim(),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleGoogleSignIn() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    final auth = ref.read(authServiceProvider);
    final lang = ref.read(languageProvider);
    final isBM = lang == 'BM';

    try {
      final cred = await auth.signInWithGoogle();
      if (cred == null || cred.user == null) {
        return; // User cancelled
      }

      final user = cred.user!;
      DocumentSnapshot<Map<String, dynamic>> doc = await FirebaseFirestore
          .instance
          .collection('users')
          .doc(user.uid)
          .get();

      if (!doc.exists && user.email != null && user.email!.isNotEmpty) {
        final emailQuery = await FirebaseFirestore.instance
            .collection('users')
            .where('email', isEqualTo: user.email!.trim().toLowerCase())
            .limit(1)
            .get();
        if (emailQuery.docs.isNotEmpty) {
          doc = emailQuery.docs.first;
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set(doc.data()!, SetOptions(merge: true));
        }
      }

      final isUserAdmin =
          (user.email?.toLowerCase().contains('arul') == true) ||
          (user.email?.toLowerCase().contains('admin') == true);

      if (!doc.exists) {
        if (isUserAdmin) {
          await FirebaseFirestore.instance
              .collection('users')
              .doc(user.uid)
              .set({
                'uid': user.uid,
                'email': user.email ?? '',
                'displayName': user.displayName ?? 'Admin',
                'role': 'admin',
                'status': 'ACTIVE',
                'approved': true,
                'createdAt': FieldValue.serverTimestamp(),
              }, SetOptions(merge: true));
          if (mounted) context.go('/');
          return;
        }

        // Brand new Google user — show invite code or request modal
        if (mounted) {
          if (mounted) {}
          return;
        }
      }
      final data = doc.data() ?? {};
      final status = (data['status'] ?? 'ACTIVE').toString().toUpperCase();
      final approved = data['approved'];
      final role = isUserAdmin
          ? 'ADMIN'
          : (data['role'] ?? 'AGENT').toString().toUpperCase();
      if (status == 'SUSPENDED') {
        await auth.signOut();
        throw Exception(
          isBM
              ? 'Akaun ejen anda telah digantung oleh pentadbir.'
              : 'Your agent account has been suspended by the administrator.',
        );
      }
      if (role != 'ADMIN' &&
          (status == 'PENDING_APPROVAL' ||
              status == 'PENDING' ||
              approved == false)) {
        if (mounted) context.go('/pending-approval');
        return;
      }

      if (mounted) context.go('/');
    } catch (e) {
      setState(() {
        _errorMessage = e.toString().replaceAll('Exception:', '').trim();
      });
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  void _showGoogleActivationModal(User user) {
    final codeController = TextEditingController();
    final lang = ref.read(languageProvider);
    final isBM = lang == 'BM';
    bool isSubmitting = false;
    String? requestError;

    final colors = context.colors;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 28,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Sahkan Kod Jemputan' : 'Verify Invite Code',
                        style: TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.bold,
                          color: colors.textPrimary,
                        ),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: colors.textMuted),
                        onPressed: () {
                          Navigator.pop(ctx);
                          ref.read(authServiceProvider).signOut();
                        },
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    isBM
                        ? 'Selamat datang ${user.displayName ?? ""}! Masukkan kod jemputan daripada agensi, atau mohon kelulusan jika tiada kod.'
                        : 'Welcome ${user.displayName ?? ""}! Enter your agency invite code, or request access if you have no code.',
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.textMuted,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 18),
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
                          ? 'Kod Jemputan (Jika ada)'
                          : 'Invite Code (If available)',
                      hintText: 'CTH: 7K9X-482A',
                      prefixIcon: Icon(
                        Icons.vpn_key_outlined,
                        color: colors.maroonPrimary,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  if (requestError != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colors.errorLight,
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(
                          color: colors.error.withValues(alpha: 0.45),
                        ),
                      ),
                      child: Text(
                        requestError!,
                        style: TextStyle(
                          color: colors.error,
                          fontSize: 12,
                          height: 1.35,
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                  ElevatedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            final code = codeController.text.trim();
                            if (code.isEmpty) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    isBM
                                        ? 'Sila masukkan kod, atau tekan Mohon Kelulusan.'
                                        : 'Please enter code or tap Request Access.',
                                  ),
                                ),
                              );
                              return;
                            }
                            setModalState(() => isSubmitting = true);
                            FocusScope.of(context).unfocus();
                            try {
                              await ref
                                  .read(authServiceProvider)
                                  .completeGoogleRegistration(
                                    uid: user.uid,
                                    email: user.email ?? '',
                                    displayName: user.displayName ?? 'Agent',
                                    inviteCode: code,
                                  );
                              if (context.mounted) {
                                Navigator.pop(ctx);
                                context.go('/');
                              }
                            } catch (err) {
                              setModalState(() => isSubmitting = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    err
                                        .toString()
                                        .replaceAll('Exception:', '')
                                        .trim(),
                                  ),
                                ),
                              );
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.maroonPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      isBM ? 'Aktifkan Akaun' : 'Activate Account',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                  const SizedBox(height: 10),
                  OutlinedButton(
                    onPressed: isSubmitting
                        ? null
                        : () async {
                            setModalState(() => isSubmitting = true);
                            try {
                              await ref
                                  .read(authServiceProvider)
                                  .requestAgentAccessGoogle(
                                    uid: user.uid,
                                    email: user.email ?? '',
                                    displayName: user.displayName ?? 'Agent',
                                  );
                              if (context.mounted) {
                                Navigator.pop(ctx);
                                context.go('/pending-approval');
                              }
                            } catch (err) {
                              final message = err is FirebaseException
                                  ? (isBM
                                        ? 'Permohonan gagal dihantar (${err.code}).'
                                        : 'Request failed (${err.code}).')
                                  : err
                                        .toString()
                                        .replaceAll('Exception:', '')
                                        .trim();
                              setModalState(() {
                                isSubmitting = false;
                                requestError = message;
                              });
                            }
                          },
                    style: OutlinedButton.styleFrom(
                      side: BorderSide(color: colors.border),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      isBM
                          ? 'Mohon Kelulusan Tanpa Kod'
                          : 'Request Access Without Code',
                      style: TextStyle(color: colors.textSecondary),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  void _showForgotPasswordModal() {
    final emailCtrl = TextEditingController(text: _emailController.text.trim());
    final lang = ref.read(languageProvider);
    final isBM = lang == 'BM';
    bool isSending = false;

    final colors = context.colors;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 24,
                right: 24,
                top: 24,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 28,
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
                        ? 'Masukkan e-mel anda untuk menerima pautan penetapan semula kata laluan.'
                        : 'Enter your email address to receive a password reset link.',
                    style: TextStyle(fontSize: 13, color: colors.textMuted),
                  ),
                  const SizedBox(height: 18),
                  TextField(
                    controller: emailCtrl,
                    keyboardType: TextInputType.emailAddress,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      hintText: 'nama@email.com',
                      prefixIcon: Icon(
                        Icons.email_outlined,
                        color: colors.textDim,
                      ),
                    ),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: isSending
                        ? null
                        : () async {
                            final email = emailCtrl.text.trim();
                            if (email.isEmpty || !email.contains('@')) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(
                                  content: Text(
                                    isBM
                                        ? 'Sila masukkan e-mel yang sah.'
                                        : 'Please enter a valid email.',
                                  ),
                                ),
                              );
                              return;
                            }
                            setModalState(() => isSending = true);
                            try {
                              await ref
                                  .read(authServiceProvider)
                                  .sendPasswordReset(email);
                              if (context.mounted) {
                                Navigator.pop(ctx);
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    backgroundColor: const Color(0xFF10B981),
                                    content: Text(
                                      isBM
                                          ? 'Pautan tetapan semula kata laluan dihantar ke $email! Sila semak peti masuk.'
                                          : 'Password reset link sent to $email! Please check your inbox.',
                                    ),
                                  ),
                                );
                              }
                            } catch (err) {
                              setModalState(() => isSending = false);
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Ralat: $err')),
                              );
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.maroonPrimary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    child: Text(
                      isBM ? 'Hantar Pautan Reset' : 'Send Reset Link',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildGoogleIcon() {
    return SizedBox(
      width: 28,
      height: 28,
      child: SvgPicture.asset('assets/google_g.svg'),
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Stack(
          children: [
            Positioned(
              top: 12,
              right: 16,
              child: SegmentedButton<String>(
                segments: const [
                  ButtonSegment(value: 'BM', label: Text('BM')),
                  ButtonSegment(value: 'EN', label: Text('EN')),
                ],
                selected: {isBM ? 'BM' : 'EN'},
                onSelectionChanged: (selection) => ref
                    .read(languageProvider.notifier)
                    .setLanguage(selection.first),
                style: const ButtonStyle(visualDensity: VisualDensity.compact),
              ),
            ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 32,
                ),
                child: Form(
                  key: _formKey,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Logo / Brand Icon
                      Center(
                        child: Container(
                          width: 58,
                          height: 58,
                          decoration: BoxDecoration(
                            color: colors.maroonPrimary,
                            borderRadius: BorderRadius.circular(16),
                            boxShadow: [
                              BoxShadow(
                                color: colors.maroonPrimary.withValues(
                                  alpha: 0.35,
                                ),
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

                      // Brand Title "artha"
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
                            style: const TextStyle(
                              color: AppColors.error,
                              fontSize: 13,
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],

                      // Full Name Field (Sign Up Only)
                      if (_isSigningUp) ...[
                        Text(
                          isBM ? 'Nama Penuh' : 'Full Name',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: colors.textMuted,
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _nameController,
                          style: TextStyle(color: colors.textPrimary),
                          decoration: InputDecoration(
                            hintText: isBM
                                ? 'Cth: Ahmad Razak'
                                : 'e.g. John Doe',
                            prefixIcon: Icon(
                              Icons.person_outline,
                              color: colors.textDim,
                            ),
                          ),
                          validator: (v) =>
                              _isSigningUp && (v == null || v.trim().isEmpty)
                              ? (isBM
                                    ? 'Sila masukkan nama penuh'
                                    : 'Please enter full name')
                              : null,
                        ),
                        const SizedBox(height: 14),
                      ],

                      // Email Field
                      Text(
                        isBM ? 'E-mel Ejen' : 'Agent Email',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _emailController,
                        keyboardType: TextInputType.emailAddress,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: InputDecoration(
                          hintText: isBM ? 'ejen@artha.com' : 'agent@artha.com',
                          prefixIcon: Icon(
                            Icons.email_outlined,
                            color: colors.textDim,
                          ),
                        ),
                        validator: (v) => (v == null || !v.contains('@'))
                            ? (isBM
                                  ? 'Sila masukkan e-mel yang sah'
                                  : 'Please enter a valid email')
                            : null,
                      ),
                      const SizedBox(height: 14),

                      // Password Field
                      Text(
                        isBM ? 'Kata Laluan' : 'Password',
                        style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.textMuted,
                        ),
                      ),
                      const SizedBox(height: 6),
                      TextFormField(
                        controller: _passwordController,
                        obscureText: _obscurePassword,
                        style: TextStyle(color: colors.textPrimary),
                        decoration: InputDecoration(
                          hintText: '••••••••',
                          prefixIcon: Icon(
                            Icons.lock_outline,
                            color: colors.textDim,
                          ),
                          suffixIcon: IconButton(
                            icon: Icon(
                              _obscurePassword
                                  ? Icons.visibility_off_outlined
                                  : Icons.visibility_outlined,
                              color: colors.textDim,
                            ),
                            onPressed: () => setState(
                              () => _obscurePassword = !_obscurePassword,
                            ),
                          ),
                        ),
                        validator: (v) => (v == null || v.length < 6)
                            ? (isBM
                                  ? 'Kata laluan sekurang-kurangnya 6 aksara'
                                  : 'Password must be at least 6 characters')
                            : null,
                      ),
                      const SizedBox(height: 14),

                      // Invite Code Field (Sign Up Only)
                      if (_isSigningUp) ...[
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isBM ? 'Kod Akses / Jemputan' : 'Invite Code',
                              style: TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: colors.textMuted,
                              ),
                            ),
                            Text(
                              isBM ? '(Pilihan)' : '(Optional)',
                              style: TextStyle(
                                fontSize: 11,
                                color: colors.textDim,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        TextFormField(
                          controller: _inviteCodeController,
                          textCapitalization: TextCapitalization.characters,
                          style: TextStyle(
                            color: colors.textPrimary,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1,
                          ),
                          decoration: InputDecoration(
                            hintText: isBM
                                ? 'Contoh: 7K9X-482A (Jika ada)'
                                : 'e.g. 7K9X-482A (If available)',
                            prefixIcon: Icon(
                              Icons.key_outlined,
                              color: colors.maroonPrimary,
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                      ],
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
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                _isSigningUp
                                    ? (_inviteCodeController.text
                                              .trim()
                                              .isNotEmpty
                                          ? (isBM
                                                ? 'Daftar Akaun'
                                                : 'Register Account')
                                          : (isBM
                                                ? 'Mohon Kelulusan Pendaftaran'
                                                : 'Submit Access Request'))
                                    : (isBM ? 'Log Masuk' : 'Sign In'),
                                style: const TextStyle(
                                  fontSize: 15,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                      ),
                      const SizedBox(height: 18),

                      // Divider "ATAU"
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

                      // Google Sign-In Button
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
                            _buildGoogleIcon(),
                            const SizedBox(width: 12),
                            Text(
                              isBM
                                  ? 'Log Masuk dengan Google'
                                  : 'Sign In with Google',
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

                      // Toggle between Sign In and Register Mode
                      Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Text(
                            _isSigningUp
                                ? (isBM
                                      ? 'Sudah mempunyai akaun?'
                                      : 'Already have an account?')
                                : (isBM
                                      ? 'Belum mempunyai akaun?'
                                      : "Don't have an account?"),
                            style: TextStyle(
                              color: colors.textMuted,
                              fontSize: 13,
                            ),
                          ),
                          const SizedBox(width: 6),
                          GestureDetector(
                            onTap: () {
                              setState(() {
                                _isSigningUp = !_isSigningUp;
                                _errorMessage = null;
                              });
                            },
                            child: Text(
                              _isSigningUp
                                  ? (isBM ? 'Log Masuk' : 'Sign In')
                                  : (isBM
                                        ? 'Daftar Akaun Baru'
                                        : 'Create Account'),
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
            ),
          ],
        ),
      ),
    );
  }
}
