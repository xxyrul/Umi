import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:go_router/go_router.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/router/app_router.dart';
import '../../core/theme/app_colors.dart';

class OnboardingScreen extends ConsumerStatefulWidget {
  const OnboardingScreen({super.key});

  @override
  ConsumerState<OnboardingScreen> createState() => _OnboardingScreenState();
}

class _OnboardingScreenState extends ConsumerState<OnboardingScreen> {
  final _nameController = TextEditingController();
  int _step = 0;

  @override
  void dispose() {
    _nameController.dispose();
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
      } catch (_) {
        // Permission can be granted later from app settings.
      }
    }
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool('@artha_onboarding_completed', true);
    if (mounted) {
      ref.read(onboardingCompletedProvider.notifier).state = true;
      context.go('/login');
    }
  }

  void _next(bool isBM) {
    if (_step == 1 && _nameController.text.trim().isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isBM ? 'Sila masukkan nama penuh anda.' : 'Please enter your full name.')),
      );
      return;
    }
    if (_step < 2) {
      setState(() => _step++);
    } else {
      _showPermissionGuide(isBM);
    }
  }

  void _showPermissionGuide(bool isBM) {
    showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: context.colors.surface,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(24))),
      builder: (sheetContext) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 24, 24, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Icon(Icons.verified_user_outlined, size: 42, color: context.colors.maroonPrimary),
              const SizedBox(height: 12),
              Text(
                isBM ? 'Kebenaran & Privasi' : 'Permissions & Privacy',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: context.colors.textPrimary),
              ),
              const SizedBox(height: 10),
              Text(
                isBM
                    ? 'Artha hanya meminta kebenaran yang diperlukan untuk lokasi listing. Anda boleh benarkan kemudian dalam Tetapan.'
                    : 'Artha only requests permissions needed for listing location. You can allow them later in Settings.',
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 13, height: 1.45, color: context.colors.textMuted),
              ),
              const SizedBox(height: 20),
              FilledButton(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  _complete(requestNotifications: true);
                },
                style: FilledButton.styleFrom(backgroundColor: AppColors.maroonPrimary, padding: const EdgeInsets.symmetric(vertical: 14)),
                child: Text(isBM ? 'Teruskan ke Log Masuk' : 'Continue to Login'),
              ),
              TextButton(
                onPressed: () {
                  Navigator.pop(sheetContext);
                  _complete();
                },
                child: Text(isBM ? 'Langkau' : 'Skip'),
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
    final titles = [
      isBM ? 'Selamat Datang ke Artha' : 'Welcome to Artha',
      isBM ? 'Kenali Ejen Anda' : 'Tell Us About You',
      isBM ? 'Sedia Untuk Bermula?' : 'Ready to Get Started?',
    ];
    final descriptions = [
      isBM ? 'CRM hartanah untuk urus listing, kes transaksi dan dokumen dengan lebih teratur.' : 'A real estate CRM for listings, transaction cases and secure documents.',
      isBM ? 'Masukkan nama anda untuk pengalaman yang lebih peribadi.' : 'Enter your name for a more personal experience.',
      isBM ? 'Urus kerja ejen anda dengan lebih mudah dan selamat.' : 'Manage your agency work with more clarity and security.',
    ];
    final icons = [Icons.domain_rounded, Icons.badge_outlined, Icons.rocket_launch_outlined];

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 16, 24, 24),
          child: Column(
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('ARTHA', style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.w900, letterSpacing: 1.5)),
                  Row(
                    children: [
                      SegmentedButton<String>(
                        segments: const [
                          ButtonSegment(value: 'BM', label: Text('BM')),
                          ButtonSegment(value: 'EN', label: Text('EN')),
                        ],
                        selected: {isBM ? 'BM' : 'EN'},
                        onSelectionChanged: (selection) {
                          ref.read(languageProvider.notifier).setLanguage(selection.first);
                        },
                        style: ButtonStyle(
                          visualDensity: VisualDensity.compact,
                          textStyle: const WidgetStatePropertyAll(TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
                          padding: const WidgetStatePropertyAll(EdgeInsets.symmetric(horizontal: 4)),
                        ),
                      ),
                      const SizedBox(width: 6),
                      TextButton(onPressed: _complete, child: Text(isBM ? 'Langkau' : 'Skip')),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 24),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: List.generate(3, (index) => AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  margin: const EdgeInsets.symmetric(horizontal: 4),
                  width: index == _step ? 26 : 8,
                  height: 8,
                  decoration: BoxDecoration(color: index == _step ? colors.maroonPrimary : colors.border, borderRadius: BorderRadius.circular(8)),
                )),
              ),
              Expanded(
                child: SingleChildScrollView(
                  keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(height: 48),
                      Container(
                        width: 112,
                        height: 112,
                        decoration: BoxDecoration(color: colors.maroonLight, shape: BoxShape.circle),
                        child: Icon(icons[_step], size: 56, color: colors.maroonPrimary),
                      ),
                      const SizedBox(height: 28),
                      Text(titles[_step], textAlign: TextAlign.center, style: TextStyle(fontSize: 28, fontWeight: FontWeight.w800, color: colors.textPrimary)),
                      const SizedBox(height: 12),
                      Text(descriptions[_step], textAlign: TextAlign.center, style: TextStyle(fontSize: 15, height: 1.5, color: colors.textMuted)),
                      if (_step == 0) ...[
                        const SizedBox(height: 28),
                        _feature(Icons.home_work_outlined, isBM ? 'Listing & Peti Besi Dokumen' : 'Listings & Document Vault', colors),
                        _feature(Icons.calculate_outlined, isBM ? 'Kalkulator DSR & Kelayakan' : 'DSR & Eligibility Calculator', colors),
                        _feature(Icons.track_changes_outlined, isBM ? 'Penjejakan Kes Transaksi' : 'Transaction Case Tracking', colors),
                      ],
                      if (_step == 1) ...[
                        const SizedBox(height: 28),
                        TextField(controller: _nameController, textCapitalization: TextCapitalization.words, decoration: InputDecoration(labelText: isBM ? 'Nama penuh' : 'Full name', hintText: isBM ? 'Contoh: Ahmad bin Ali' : 'Example: Alex Tan', prefixIcon: const Icon(Icons.person_outline))),
                      ],
                    ],
                  ),
                ),
              ),
              FilledButton(
                onPressed: () => _next(isBM),
                style: FilledButton.styleFrom(minimumSize: const Size.fromHeight(54), backgroundColor: AppColors.maroonPrimary),
                child: Text(_step == 2 ? (isBM ? 'Mula Menggunakan Artha' : 'Start Using Artha') : (isBM ? 'Seterusnya' : 'Next')),
              ),
              const SizedBox(height: 8),
              TextButton(onPressed: () => ref.read(languageProvider.notifier).setLanguage(isBM ? 'EN' : 'BM'), child: Text(isBM ? 'English' : 'Bahasa Melayu')),
            ],
          ),
        ),
      ),
    );
  }

  Widget _feature(IconData icon, String text, AppThemeColors colors) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(color: colors.surface, borderRadius: BorderRadius.circular(12), border: Border.all(color: colors.border)),
      child: Row(children: [Icon(icon, color: colors.maroonPrimary, size: 22), const SizedBox(width: 12), Expanded(child: Text(text, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600))) ]),
    );
  }
}
