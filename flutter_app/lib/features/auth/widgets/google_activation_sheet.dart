import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../auth_service.dart';

class GoogleActivationSheet extends ConsumerStatefulWidget {
  final User user;
  final String initialCode;
  final String? initialError;
  final VoidCallback onSwitchAccount;

  const GoogleActivationSheet({
    super.key,
    required this.user,
    this.initialCode = '',
    this.initialError,
    required this.onSwitchAccount,
  });

  static Future<bool?> show({
    required BuildContext context,
    required User user,
    String initialCode = '',
    String? initialError,
    required VoidCallback onSwitchAccount,
  }) async {
    final colors = context.colors;
    return showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      useSafeArea: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => GoogleActivationSheet(
        user: user,
        initialCode: initialCode,
        initialError: initialError,
        onSwitchAccount: onSwitchAccount,
      ),
    );
  }

  @override
  ConsumerState<GoogleActivationSheet> createState() => _GoogleActivationSheetState();
}

class _GoogleActivationSheetState extends ConsumerState<GoogleActivationSheet> {
  late final TextEditingController _codeController;
  bool _isSubmitting = false;
  String? _requestError;

  @override
  void initState() {
    super.initState();
    _codeController = TextEditingController(text: widget.initialCode);
    _requestError = widget.initialError;
  }

  @override
  void dispose() {
    _codeController.dispose();
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
          // Handle bar
          Center(
            child: Container(
              width: 36,
              height: 4,
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
                onPressed: () => Navigator.pop(context, false),
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
                  backgroundImage: (widget.user.photoURL?.isNotEmpty == true)
                      ? NetworkImage(widget.user.photoURL!)
                      : null,
                  child: (widget.user.photoURL == null || widget.user.photoURL!.isEmpty)
                      ? Text(
                          widget.user.displayName?.isNotEmpty == true
                              ? widget.user.displayName![0].toUpperCase()
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
                        widget.user.displayName ?? (isBM ? 'Pengguna Google' : 'Google User'),
                        style: TextStyle(
                          color: colors.textPrimary,
                          fontWeight: FontWeight.bold,
                          fontSize: 13,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        widget.user.email ?? '',
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
                  onPressed: _isSubmitting
                      ? null
                      : () async {
                          Navigator.pop(context, false);
                          await authService.signOut();
                          widget.onSwitchAccount();
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
            controller: _codeController,
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

          // Error display
          if (_requestError != null) ...[
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: colors.errorLight,
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: colors.error.withValues(alpha: 0.4)),
              ),
              child: Text(
                _requestError!,
                style: TextStyle(color: colors.error, fontSize: 12, height: 1.35),
              ),
            ),
            const SizedBox(height: 12),
          ],

          // Activate with code
          ElevatedButton(
            onPressed: _isSubmitting
                ? null
                : () async {
                    final code = _codeController.text.trim();
                    if (code.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(SnackBar(
                        content: Text(isBM
                            ? 'Masukkan kod atau tekan Mohon Kelulusan.'
                            : 'Enter a code or tap Request Access.'),
                      ));
                      return;
                    }
                    setState(() => _isSubmitting = true);
                    FocusScope.of(context).unfocus();
                    try {
                      await authService.completeGoogleRegistration(
                        uid: widget.user.uid,
                        email: widget.user.email ?? '',
                        displayName: widget.user.displayName ?? 'Agent',
                        inviteCode: code,
                      );
                      if (context.mounted) {
                        Navigator.of(context, rootNavigator: true).pop(true);
                      }
                    } catch (err) {
                      if (mounted) {
                        setState(() {
                          _isSubmitting = false;
                          _requestError = err.toString().replaceAll('Exception:', '').trim();
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
            child: _isSubmitting
                ? const SizedBox(
                    width: 18,
                    height: 18,
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
            onPressed: _isSubmitting
                ? null
                : () async {
                    setState(() {
                      _isSubmitting = true;
                      _requestError = null;
                    });
                    try {
                      await authService.requestAgentAccessGoogle(
                        uid: widget.user.uid,
                        email: widget.user.email ?? '',
                        displayName: widget.user.displayName ?? 'Agent',
                      );
                      if (context.mounted) {
                        Navigator.of(context, rootNavigator: true).pop(true);
                      }
                    } catch (err) {
                      if (mounted) {
                        setState(() {
                          _isSubmitting = false;
                          _requestError = err is FirebaseException
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
  }
}
