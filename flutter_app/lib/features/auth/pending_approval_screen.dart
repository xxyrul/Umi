import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
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
    final user = ref.read(authStateProvider).value;
    if (user == null) {
      context.go('/login');
      return;
    }

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
          context.go('/');
        }
      } else if (status == 'SUSPENDED') {
        await ref.read(authServiceProvider).signOut();
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              backgroundColor: Colors.redAccent,
              content: Text(
                isBM ? 'Akaun anda telah digantung oleh pentadbir.' : 'Your account has been suspended by admin.',
              ),
            ),
          );
          context.go('/login');
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

  void _contactAdmin() {
    final lang = ref.read(languageProvider);
    final user = ref.read(authStateProvider).value;
    final name = user?.displayName ?? 'Ejen';
    final email = user?.email ?? '';

    final text = Uri.encodeComponent(
      lang == 'BM'
          ? 'Salam Pentadbir Artha, saya $name ($email) telah mendaftar akaun dan memohon kelulusan akses ke Artha CRM.'
          : 'Hello Artha Admin, I am $name ($email) and have registered for agent access in Artha CRM.',
    );
    launchUrl(
      Uri.parse('https://wa.me/601110000000?text=$text'),
      mode: LaunchMode.externalApplication,
    );
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';
    final user = ref.watch(authStateProvider).value;
    final colors = context.colors;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const Spacer(),

              // Glowing Icon
              Center(
                child: Container(
                  width: 90,
                  height: 90,
                  decoration: BoxDecoration(
                    color: colors.maroonLight,
                    borderRadius: BorderRadius.circular(45),
                    border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35), width: 1.5),
                  ),
                  child: Icon(
                    Icons.hourglass_top_rounded,
                    size: 44,
                    color: colors.maroonPrimary,
                  ),
                ),
              ),
              const SizedBox(height: 24),

              // Title
              Text(
                isBM ? 'Permohonan Sedang Disemak' : 'Application Under Review',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),

              // Description
              Text(
                isBM
                    ? 'Pendaftaran akaun ejen anda telah dihantar dan sedang menunggu semakan serta kelulusan daripada pentadbir agensi.'
                    : 'Your agent account registration has been submitted and is currently awaiting approval from agency administrators.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  color: colors.textMuted,
                  height: 1.5,
                ),
              ),
              const SizedBox(height: 32),

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
                            color: Colors.amber.withValues(alpha: 0.15),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            isBM ? 'MENUNGGU KELULUSAN' : 'PENDING APPROVAL',
                            style: TextStyle(
                              color: colors.isDark ? Colors.amberAccent : Colors.amber.shade800,
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

              const Spacer(),

              // Action Buttons
              ElevatedButton.icon(
                onPressed: _isChecking ? null : _checkStatus,
                icon: _isChecking
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                      )
                    : const Icon(Icons.refresh_rounded),
                label: Text(isBM ? 'Semak Status Kelulusan' : 'Check Approval Status', style: const TextStyle(fontWeight: FontWeight.bold)),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colors.maroonPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),

              OutlinedButton.icon(
                onPressed: _contactAdmin,
                icon: const Icon(Icons.chat_outlined, color: Color(0xFF25D366)),
                label: Text(
                  isBM ? 'Hubungi Pentadbir Agensi' : 'Contact Agency Admin',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                ),
                style: OutlinedButton.styleFrom(
                  side: BorderSide(color: colors.border),
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 10),

              TextButton(
                onPressed: () async {
                  await ref.read(authServiceProvider).signOut();
                  if (context.mounted) context.go('/login');
                },
                child: Text(
                  isBM ? 'Log Keluar' : 'Sign Out',
                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
