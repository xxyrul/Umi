import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'auth_service.dart';

class PendingApprovalScreen extends ConsumerStatefulWidget {
  const PendingApprovalScreen({super.key});

  @override
  ConsumerState<PendingApprovalScreen> createState() => _PendingApprovalScreenState();
}

class _PendingApprovalScreenState extends ConsumerState<PendingApprovalScreen> {
  bool _isChecking = false;

  Future<void> _checkStatus() async {
    // Don't manually redirect — transient null is possible; router handles nav declaratively.
    final user = ref.read(authStateProvider).value;
    if (user == null) return;

    setState(() => _isChecking = true);

    try {
      final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      final status = (doc.data()?['status'] ?? 'PENDING_APPROVAL').toString().toUpperCase();
      final lang = ref.read(languageProvider);
      final isBM = lang == 'BM';

      if (status == 'ACTIVE') {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: const Color(0xFF10B981),
              content: Text(
                isBM
                    ? 'Tahniah! Akaun anda telah disahkan oleh pentadbir. 🎉'
                    : 'Congratulations! Your account has been approved by admin. 🎉',
              ),
            ),
          );
          // Router auto-redirects to '/' once currentUserProfileProvider sees ACTIVE status
        }
      } else if (status == 'SUSPENDED') {
        await ref.read(authServiceProvider).signOut();
        // signOut() → authStateProvider emits null → router redirects to /login automatically
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.redAccent,
              content: Text(
                isBM ? 'Akaun anda telah digantung oleh pentadbir.' : 'Your account has been suspended by admin.',
              ),
            ),
          );
        }
      } else if (status == 'REJECTED') {
        if (mounted) {
          final reason = doc.data()?['rejectionReason']?.toString() ?? '';
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.redAccent,
              content: Text(
                isBM
                    ? 'Permohonan tidak diluluskan${reason.isNotEmpty ? ": $reason" : "."}'
                    : 'Application not approved${reason.isNotEmpty ? ": $reason" : "."}',
              ),
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                isBM
                    ? 'Permohonan masih dalam semakan pentadbir agensi.'
                    : 'Application is still under review by agency admin.',
              ),
            ),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Ralat: $e')));
      }
    } finally {
      if (mounted) {
        setState(() => _isChecking = false);
      }
    }
  }

  void _showEnterInviteCodeDialog() async {
    final codeCtrl = TextEditingController();
    final isBM = ref.read(languageProvider) == 'BM';
    final colors = context.colors;
    bool isClaiming = false;
    String? claimError;

    try {
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        backgroundColor: Colors.transparent,
        barrierColor: Colors.black.withOpacity(0.6),
        builder: (ctx) {
          return Padding(
            padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
            child: RepaintBoundary(
              child: Container(
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
                  border: Border.all(color: colors.border.withOpacity(0.5)),
                ),
                padding: EdgeInsets.fromLTRB(24, 16, 24, ctx.safeBottomPadding(16.0)),
                child: StatefulBuilder(
                  builder: (context, setModalState) {
                    return Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Center(
                          child: Container(
                            width: 36,
                            height: 4,
                            margin: const EdgeInsets.only(bottom: 14),
                            decoration: BoxDecoration(
                              color: colors.textDim.withOpacity(0.35),
                              borderRadius: BorderRadius.circular(2),
                            ),
                          ),
                        ),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              isBM ? 'Aktivasi Kod Jemputan' : 'Activate Invite Code',
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
                              ? 'Jika anda telah menerima kod jemputan daripada agensi, masukkan di sini untuk mengaktifkan akaun serta-merta.'
                              : 'If you have received an invite code from the agency, enter it here for instant account activation.',
                          style: TextStyle(fontSize: 13, color: colors.textMuted, height: 1.4),
                        ),
                        const SizedBox(height: 18),
                        TextField(
                      controller: codeCtrl,
                      textCapitalization: TextCapitalization.characters,
                      style: TextStyle(
                        color: colors.textPrimary,
                        fontWeight: FontWeight.bold,
                        letterSpacing: 1.5,
                      ),
                      decoration: InputDecoration(
                        labelText: isBM ? 'Kod Jemputan Agensi' : 'Agency Invite Code',
                        hintText: 'CTH: 7K9X-482A',
                        prefixIcon: Icon(Icons.vpn_key_rounded, color: colors.maroonPrimary),
                        filled: true,
                        fillColor: colors.surface,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                    const SizedBox(height: 14),
                    if (claimError != null) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: colors.errorLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: colors.error.withValues(alpha: 0.45)),
                        ),
                        child: Text(
                          claimError!,
                          style: TextStyle(color: colors.error, fontSize: 12, height: 1.35),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    ElevatedButton(
                      onPressed: isClaiming
                          ? null
                          : () async {
                              final code = codeCtrl.text.trim();
                              if (code.isEmpty) {
                                setModalState(() {
                                  claimError = isBM
                                      ? 'Sila masukkan kod jemputan terlebih dahulu.'
                                      : 'Please enter an invite code first.';
                                });
                                return;
                              }
                              setModalState(() {
                                isClaiming = true;
                                claimError = null;
                              });
                              FocusScope.of(context).unfocus();
                              try {
                                await ref.read(authServiceProvider).claimInviteCode(code);
                                if (ctx.mounted) {
                                  Navigator.pop(ctx);
                                }
                              } catch (err) {
                                setModalState(() {
                                  isClaiming = false;
                                  claimError = err
                                      .toString()
                                      .replaceAll('Exception:', '')
                                      .trim();
                                });
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.maroonPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: isClaiming
                          ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              isBM ? 'Aktifkan Akaun Sekarang' : 'Activate Account Now',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                    ),
                  ],
                );
              },
            ),
          ),
        ),
      );
        },
      );
    } finally {
      codeCtrl.dispose();
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';
    final user = ref.watch(authStateProvider).value;
    final userProfile = ref.watch(currentUserProfileProvider).value;
    final isRejected = userProfile?.isRejected == true;
    final rejectionReason = userProfile?.rejectionReason ?? '';
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: SingleChildScrollView(
          physics: const ClampingScrollPhysics(),
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 24),

              // Glowing Icon
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: isRejected ? Colors.redAccent.withValues(alpha: 0.15) : colors.maroonLight,
                    borderRadius: BorderRadius.circular(45),
                    border: Border.all(
                      color: isRejected
                          ? Colors.redAccent.withValues(alpha: 0.4)
                          : colors.maroonPrimary.withValues(alpha: 0.35),
                      width: 1.5,
                    ),
                  ),
                  child: Icon(
                    isRejected ? Icons.cancel_outlined : Icons.hourglass_top_rounded,
                    size: 44,
                    color: isRejected ? Colors.redAccent : colors.maroonPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Title
              Text(
                isRejected
                    ? (isBM ? 'Permohonan Tidak Diluluskan' : 'Application Not Approved')
                    : (isBM ? 'Permohonan Sedang Disemak' : 'Application Under Review'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: isRejected ? Colors.redAccent : colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),

              // Description
              Text(
                isRejected
                    ? (isBM
                        ? 'Permohonan pendaftaran akaun ejen anda tidak diluluskan oleh pihak pentadbir agensi. Anda boleh mengemukakan permohonan semula atau mengaktifkan akaun menggunakan kod jemputan.'
                        : 'Your agent account application was not approved by the agency administrator. You may submit a new request or activate with an invite code.')
                    : (isBM
                        ? 'Pendaftaran akaun ejen anda telah dihantar dan sedang menunggu semakan serta kelulusan daripada pentadbir agensi.'
                        : 'Your agent account registration has been submitted and is currently awaiting approval from agency administrators.'),
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: colors.textMuted,
                  height: 1.5,
                ),
              ),

              if (isRejected && rejectionReason.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.redAccent.withValues(alpha: 0.3)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.info_outline, color: Colors.redAccent, size: 18),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          '${isBM ? "Sebab: " : "Reason: "}$rejectionReason',
                          style: const TextStyle(color: Colors.redAccent, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ),
              ],

              const SizedBox(height: 28),

              // Agent info card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          isBM ? 'Nama Ejen' : 'Agent Name',
                          style: TextStyle(fontSize: 13, color: colors.textMuted),
                        ),
                        Text(
                          user?.displayName ?? 'Agent',
                          style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
                        ),
                      ],
                    ),
                    Divider(color: colors.border, height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'E-mel',
                          style: TextStyle(fontSize: 13, color: colors.textMuted),
                        ),
                        Text(
                          user?.email ?? '',
                          style: TextStyle(fontSize: 13, color: colors.textSecondary),
                        ),
                      ],
                    ),
                    Divider(color: colors.border, height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          'Status',
                          style: TextStyle(fontSize: 13, color: colors.textMuted),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: isRejected
                                ? Colors.redAccent.withValues(alpha: 0.15)
                                : Colors.amber.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isRejected
                                ? (isBM ? 'DITOLAK' : 'REJECTED')
                                : (isBM ? 'MENUNGGU KELULUSAN' : 'PENDING APPROVAL'),
                            style: TextStyle(
                              color: isRejected
                                  ? Colors.redAccent
                                  : (colors.isDark ? Colors.amberAccent : Colors.amber.shade800),
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),

              // Action Buttons
              if (isRejected) ...[
                ElevatedButton.icon(
                  onPressed: () async {
                    try {
                      await ref.read(authServiceProvider).reapplyAccess();
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            backgroundColor: const Color(0xFF10B981),
                            content: Text(
                              isBM
                                  ? 'Permohonan baru telah dihantar kepada pentadbir! 🎉'
                                  : 'New application submitted to admin! 🎉',
                            ),
                          ),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Ralat: $e')),
                        );
                      }
                    }
                  },
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: Text(
                    isBM ? 'Hantar Semula Permohonan' : 'Re-Apply for Access',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    elevation: 2,
                  ),
                ),
                const SizedBox(height: 10),
              ],

              // Primary 1: Enter Invite Code (Instant Activation)
              ElevatedButton.icon(
                onPressed: _showEnterInviteCodeDialog,
                icon: const Icon(Icons.vpn_key_rounded, size: 18),
                label: Text(
                  isBM ? 'Masukkan Kod Jemputan' : 'Enter Invite Code',
                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: isRejected ? colors.card : colors.maroonPrimary,
                  foregroundColor: isRejected ? colors.textPrimary : Colors.white,
                  side: isRejected ? BorderSide(color: colors.border) : null,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: isRejected ? 0 : 2,
                ),
              ),
              const SizedBox(height: 10),

              // Primary 2: Check Approval Status
              OutlinedButton.icon(
                onPressed: _isChecking ? null : _checkStatus,
                icon: _isChecking
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.refresh_rounded, size: 18),
                label: Text(
                  isBM ? 'Semak Status Kelulusan' : 'Check Approval Status',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: colors.border),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),

              const SizedBox(height: 12),

              // Primary 3: Cancel / Withdraw Application (Breaks pending loop)
              OutlinedButton.icon(
                onPressed: () => _confirmCancelApplication(isBM),
                icon: const Icon(Icons.delete_outline, size: 18, color: Colors.redAccent),
                label: Text(
                  isBM ? 'Batal Permohonan & Mula Semula' : 'Cancel Request & Start Over',
                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.5)),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),

              TextButton.icon(
                onPressed: () async {
                  // signOut() → authStateProvider emits null → router auto-redirects to /login
                  await ref.read(authServiceProvider).signOut();
                },
                icon: Icon(Icons.logout, size: 16, color: colors.textMuted),
                label: Text(
                  isBM ? 'Log Keluar / Tukar Akaun' : 'Sign Out / Switch Account',
                  style: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  void _confirmCancelApplication(bool isBM) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          isBM ? 'Batal Permohonan?' : 'Cancel Application?',
          style: TextStyle(color: context.colors.textPrimary, fontWeight: FontWeight.bold),
        ),
        content: Text(
          isBM
              ? 'Adakah anda pasti ingin membatalkan permohonan pendaftaran akaun ejen ini? Rekod permohonan anda akan dipadam dan anda boleh memulakan pendaftaran baru semula.'
              : 'Are you sure you want to cancel this agent registration? Your request will be removed and you can start a fresh registration.',
          style: TextStyle(color: context.colors.textMuted, fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Kembali' : 'Back', style: TextStyle(color: context.colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(ctx);
              final user = ref.read(authStateProvider).value;
              if (user != null) {
                await FirebaseFirestore.instance.collection('users').doc(user.uid).delete().catchError((_) {});
              }
              await ref.read(authServiceProvider).signOut();
            },
            child: Text(isBM ? 'Ya, Batal Permohonan' : 'Yes, Cancel Request'),
          ),
        ],
      ),
    );
  }
}
