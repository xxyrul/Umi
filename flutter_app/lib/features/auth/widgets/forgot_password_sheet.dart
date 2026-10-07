import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../auth_service.dart';

class ForgotPasswordSheet extends ConsumerStatefulWidget {
  final String initialEmail;

  const ForgotPasswordSheet({
    super.key,
    this.initialEmail = '',
  });

  static Future<void> show({
    required BuildContext context,
    String initialEmail = '',
  }) async {
    final colors = context.colors;
    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => ForgotPasswordSheet(initialEmail: initialEmail),
    );
  }

  @override
  ConsumerState<ForgotPasswordSheet> createState() => _ForgotPasswordSheetState();
}

class _ForgotPasswordSheetState extends ConsumerState<ForgotPasswordSheet> {
  late final TextEditingController _emailController;
  bool _isSending = false;

  @override
  void initState() {
    super.initState();
    _emailController = TextEditingController(text: widget.initialEmail);
  }

  @override
  void dispose() {
    _emailController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final authService = ref.read(authServiceProvider);

    return SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.only(
        left: 24,
        right: 24,
        top: 24,
        bottom: MediaQuery.viewInsetsOf(context).bottom + context.safeBottomPadding(16.0),
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
                onPressed: () => Navigator.pop(context),
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
            controller: _emailController,
            keyboardType: TextInputType.emailAddress,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              hintText: isBM ? 'nama@email.com' : 'your@email.com',
              prefixIcon: Icon(Icons.email_outlined, color: colors.textDim),
            ),
          ),
          const SizedBox(height: 20),
          ElevatedButton(
            onPressed: _isSending
                ? null
                : () async {
                    final email = _emailController.text.trim();
                    if (email.isEmpty || !email.contains('@')) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(isBM
                            ? 'Sila masukkan e-mel yang sah.'
                            : 'Please enter a valid email.'),
                      ));
                      return;
                    }
                    setState(() => _isSending = true);
                    try {
                      await authService.sendPasswordReset(email);
                      if (context.mounted) {
                        Navigator.pop(context);
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
                      if (context.mounted) {
                        setState(() => _isSending = false);
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(
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
            child: _isSending
                ? const SizedBox(
                    width: 18,
                    height: 18,
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
  }
}
