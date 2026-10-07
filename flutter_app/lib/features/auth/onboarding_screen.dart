import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  int _step = 0;
  final _pageController = PageController();

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _complete({bool requestNotifications = false}) async {
    if (requestNotifications) {
      try {
        await FirebaseMessaging.instance.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );
      } catch (_) {}
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('@artha_onboarding_completed', true);
    if (mounted) {
      // Update provider — router redirect fires automatically to /login
      ref.read(onboardingCompletedProvider.notifier).state = true;
    }
  }

  void _next(bool isBM) {
    if (_step < 2) {
      _pageController.nextPage(
        duration: const Duration(milliseconds: 320),
        curve: Curves.easeOutCubic,
      );
      setState(() => _step++);
    } else {
      _showPermissionSheet(isBM);
    }
  }

  void _showPermissionSheet(bool isBM) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.notifications_active_outlined,
                  size: 44, color: context.colors.maroonPrimary),
              const SizedBox(height: 12),
              Text(
                isBM ? 'Notifikasi & Privasi' : 'Notifications & Privacy',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: context.colors.textPrimary,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                isBM
                    ? 'Benarkan notifikasi untuk terima peringatan temu janji, kelulusan akaun, dan kemaskini kes. Boleh tukar kemudian dalam Tetapan.'
                    : 'Allow notifications to receive appointment reminders, account approvals, and case updates. You can change this later in Settings.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 13,
                  height: 1.5,
                  color: context.colors.textMuted,
                ),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _complete(requestNotifications: true);
                },
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.maroonPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                ),
                child: Text(isBM ? 'Benarkan & Teruskan' : 'Allow & Continue'),
              ),
              const SizedBox(height: 8),
              TextButton(
                onPressed: () {
                  Navigator.pop(ctx);
                  _complete();
                },
                child: Text(
                  isBM ? 'Langkau buat masa ini' : 'Skip for now',
                  style: TextStyle(color: context.colors.textMuted),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    final pages = [
      _OnboardingPage(
        icon: Icons.home_work_rounded,
        title: isBM ? 'Selamat Datang ke Artha' : 'Welcome to Artha',
        subtitle: isBM
            ? 'CRM hartanah untuk ejen Malaysia — urus listing, kes transaksi, dan dokumen dalam satu tempat.'
            : 'Real estate CRM for Malaysian agents — manage listings, deals, and documents all in one place.',
        features: [
          _Feature(Icons.view_list_rounded,
              isBM ? 'Listing & Peti Besi Dokumen' : 'Listings & Document Vault'),
          _Feature(Icons.folder_open_rounded,
              isBM ? 'Penjejakan Kes & Tawaran' : 'Case & Deal Tracking'),
          _Feature(Icons.calculate_rounded,
              isBM ? 'Kalkulator DSR & Kelayakan' : 'DSR & Loan Calculator'),
        ],
      ),
      _OnboardingPage(
        icon: Icons.shield_outlined,
        title: isBM ? 'Data Anda, Selamat Bersama Kami' : 'Your Data, Safe With Us',
        subtitle: isBM
            ? 'Maklumat anda dilindungi dengan selamat. Akaun anda memerlukan pengesahan pentadbir agensi sebelum boleh digunakan.'
            : 'Your data is securely protected. Your account requires agency admin verification before access is granted.',
        features: [
          _Feature(Icons.lock_outline_rounded,
              isBM ? 'Akaun dikunci dengan PIN biometrik' : 'PIN & biometric app lock'),
          _Feature(Icons.admin_panel_settings_outlined,
              isBM ? 'Pengesahan pentadbir agensi' : 'Agency admin verification'),
          _Feature(Icons.cloud_done_outlined,
              isBM ? 'Penyimpanan data yang selamat' : 'Secure data protection'),
        ],
      ),
      _OnboardingPage(
        icon: Icons.rocket_launch_rounded,
        title: isBM ? 'Sedia Untuk Bermula?' : 'Ready to Get Started?',
        subtitle: isBM
            ? 'Log masuk atau daftar akaun baru. Jika anda ejen baru, sila dapatkan kod jemputan daripada pentadbir agensi anda.'
            : 'Sign in or create a new account. New agents, please obtain an invite code from your agency admin.',
        features: [
          _Feature(Icons.vpn_key_outlined,
              isBM ? 'Gunakan kod jemputan untuk akses segera' : 'Use invite code for instant access'),
          _Feature(Icons.how_to_reg_outlined,
              isBM ? 'Atau mohon kelulusan tanpa kod' : 'Or request access without a code'),
          _Feature(Icons.account_circle_outlined,
              isBM ? 'Log masuk dengan Google disokong' : 'Google sign-in supported'),
        ],
      ),
    ];

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // Top bar
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 16, 0),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'ARTHA',
                    style: TextStyle(
                      color: colors.maroonPrimary,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 1.5,
                      fontSize: 15,
                    ),
                  ),
                  Row(
                    children: [
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'BM', label: Text('BM')),
                          ButtonSegment(value: 'EN', label: Text('EN')),
                        ],
                        selected: {isBM ? 'BM' : 'EN'},
                        onSelectionChanged: (s) =>
                            ref.read(languageProvider.notifier).setLanguage(s.first),
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          textStyle: const WidgetStatePropertyAll(
                            TextStyle(fontSize: 11, fontWeight: FontWeight.bold),
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      TextButton(
                        onPressed: _complete,
                        child: Text(
                          isBM ? 'Langkau' : 'Skip',
                          style: TextStyle(color: colors.textMuted, fontSize: 13),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // Step dots
            const SizedBox(height: 16),
            Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: List.generate(3, (i) {
                return AnimatedContainer(
                  duration: const Duration(milliseconds: 220),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: i == _step ? 28 : 8,
                  height: 8,
                  decoration: BoxDecoration(
                    color: i == _step ? colors.maroonPrimary : colors.border,
                    borderRadius: BorderRadius.circular(8),
                  ),
                );
              }),
            ),
            const SizedBox(height: 8),

            // Page content
            Expanded(
              child: PageView.builder(
                controller: _pageController,
                physics: const NeverScrollableScrollPhysics(),
                itemCount: pages.length,
                itemBuilder: (_, i) => pages[i],
              ),
            ),

            // Bottom actions
            Padding(
              padding: const EdgeInsets.fromLTRB(24, 0, 24, 20),
              child: Column(
                children: [
                  FilledButton(
                    onPressed: () => _next(isBM),
                    style: FilledButton.styleFrom(
                      minimumSize: const Size.fromHeight(54),
                      backgroundColor: AppColors.maroonPrimary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                      ),
                    ),
                    child: Text(
                      _step == 2
                          ? (isBM ? 'Mula Menggunakan Artha' : 'Start Using Artha')
                          : (isBM ? 'Seterusnya' : 'Next'),
                      style: const TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  if (_step > 0)
                    TextButton(
                      onPressed: () {
                        _pageController.previousPage(
                          duration: const Duration(milliseconds: 280),
                          curve: Curves.easeOutCubic,
                        );
                        setState(() => _step--);
                      },
                      child: Text(
                        isBM ? 'Kembali' : 'Back',
                        style: TextStyle(color: colors.textMuted),
                      ),
                    ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OnboardingPage extends StatelessWidget {
  final IconData icon;
  final String title;
  final String subtitle;
  final List<_Feature> features;

  const _OnboardingPage({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.features,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      padding: const EdgeInsets.fromLTRB(24, 12, 24, 8),
      child: Column(
        children: [
          const SizedBox(height: 24),
          Container(
            width: 108,
            height: 108,
            decoration: BoxDecoration(
              color: colors.maroonLight,
              shape: BoxShape.circle,
            ),
            child: Icon(icon, size: 54, color: colors.maroonPrimary),
          ),
          const SizedBox(height: 24),
          Text(
            title,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 26,
              fontWeight: FontWeight.w800,
              color: colors.textPrimary,
              height: 1.2,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            subtitle,
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 14,
              height: 1.55,
              color: colors.textMuted,
            ),
          ),
          const SizedBox(height: 28),
          ...features.map((f) => _FeatureTile(feature: f)),
        ],
      ),
    );
  }
}

class _Feature {
  final IconData icon;
  final String label;
  const _Feature(this.icon, this.label);
}

class _FeatureTile extends StatelessWidget {
  final _Feature feature;
  const _FeatureTile({required this.feature});

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: colors.border),
      ),
      child: Row(
        children: [
          Icon(feature.icon, color: colors.maroonPrimary, size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              feature.label,
              style: TextStyle(
                color: colors.textPrimary,
                fontWeight: FontWeight.w600,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
