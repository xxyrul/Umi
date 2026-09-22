import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_toast.dart';
import '../auth/auth_service.dart';
import 'widgets/feedback_modal_sheet.dart';

class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  final _feedbackTitleController = TextEditingController();
  final _feedbackDescController = TextEditingController();
  String _feedbackType = 'BUG';
  bool _isSubmitting = false;

  final List<Map<String, String>> _faqsBM = [
    {
      'question': 'Bagaimana cara menjana & berkongsi kod jemputan ejen?',
      'answer': 'Pentadbir agensi boleh pergi ke Profil > Pusat Pentadbir > Kod Jemputan. Anda boleh menjana kod pantas dan kongsikan terus melalui WhatsApp dengan satu klik.',
    },
    {
      'question': 'Bagaimana formula DSR & kelayakan pinjaman dikira?',
      'answer': 'Kalkulator DSR Artha mematuhi garis panduan Bank Negara Malaysia (BNM). Ia mengira Nisbah Khidmat Hutang berdasarkan pendapatan bersih bulanan dan komitmen semasa mengikut had ambang bank (sehingga 70-85%).',
    },
    {
      'question': 'Bolehkah saya menggunakan aplikasi semasa tiada internet (Offline)?',
      'answer': 'Ya! Artha dilengkapi cache tempatan Firestore. Listing dan kes yang telah dimuat sebelum ini boleh dibuka dan disemak walaupun anda berada di tapak projek tanpa liputan internet.',
    },
    {
      'question': 'Bagaimana keselamatan maklumat klien & transaksi dilindungi?',
      'answer': 'Semua maklumat klien, no telefon dan dokumen disimpan dalam Firebase Firestore dengan peraturan keselamatan berasaskan token ejen dan pentadbir yang disahkan.',
    },
    {
      'question': 'Berapa lama masa diambil untuk permohonan akses ejen disahkan?',
      'answer': 'Pentadbir agensi menerima notifikasi dalam senarai menunggu (Kelulusan). Pengesahan biasanya selesai dalam masa beberapa jam oleh admin agensi.',
    },
    {
      'question': 'Bagaimana cara berkongsi sebut harga pinjaman ke WhatsApp klien?',
      'answer': 'Buka Kalkulator > Tab Bank Loan, tekan butang SALIN SEBUT HARGA KE WHATSAPP. Ringkasan lengkap bersama kos guaman akan disalin automatik ke papan keratan.',
    },
  ];

  final List<Map<String, String>> _faqsEN = [
    {
      'question': 'How do I generate and share agent invite codes?',
      'answer': 'Agency admins can navigate to Profile > Admin Hub > Invite Codes. You can generate batch invite codes and share them instantly via WhatsApp with one tap.',
    },
    {
      'question': 'How is the DSR and loan eligibility calculated?',
      'answer': 'The Artha DSR calculator follows Bank Negara Malaysia (BNM) guidelines. It calculates Debt Service Ratio based on net monthly income and existing commitments against bank thresholds (typically 70-85%).',
    },
    {
      'question': 'Can I use the app without an internet connection (Offline)?',
      'answer': 'Yes! Artha includes Firestore offline persistence. Previously cached property listings and active cases remain accessible even when inspecting project sites with low connectivity.',
    },
    {
      'question': 'How is client information and transaction data protected?',
      'answer': 'All client details, phone numbers, and documents are securely stored in Firebase Firestore protected by token-authenticated agent access rules.',
    },
    {
      'question': 'How long does agent access approval usually take?',
      'answer': 'Agency administrators receive instant notifications in their pending approval queue. Verifications are typically completed within a few hours by agency admins.',
    },
    {
      'question': 'How do I share loan quotes directly to clients on WhatsApp?',
      'answer': 'Go to Calculator > Bank Loan tab, and tap COPY QUOTE TO WHATSAPP. The breakdown including estimated legal and stamp duty fees is copied directly to your clipboard.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _feedbackTitleController.dispose();
    _feedbackDescController.dispose();
    super.dispose();
  }

  void _contactWhatsAppSupport(bool isBM) {
    final msgText = isBM
        ? 'Salam Artha Support, saya memerlukan bantuan teknikal...'
        : 'Hello Artha Support, I require technical assistance...';
    final msg = Uri.encodeComponent(msgText);
    launchUrl(Uri.parse('https://wa.me/601110000000?text=$msg'), mode: LaunchMode.externalApplication);
  }

  Future<void> _submitFeedback(bool isBM) async {
    if (_feedbackTitleController.text.trim().isEmpty || _feedbackDescController.text.trim().isEmpty) {
      AppToast.error(
        context,
        isBM ? 'Sila masukkan tajuk dan penerangan maklum balas.' : 'Please enter a feedback title and description.',
      );
      return;
    }

    final user = ref.read(authStateProvider).value;
    setState(() => _isSubmitting = true);

    try {
      await FirebaseFirestore.instance.collection('feedback').add({
        'title': _feedbackTitleController.text.trim(),
        'description': _feedbackDescController.text.trim(),
        'type': _feedbackType,
        'userId': user?.uid ?? '',
        'userEmail': user?.email ?? '',
        'status': 'NEW',
        'createdAt': FieldValue.serverTimestamp(),
      });

      _feedbackTitleController.clear();
      _feedbackDescController.clear();
      if (mounted) {
        AppToast.success(
          context,
          isBM ? 'Maklum balas anda telah dihantar kepada pasukan pembangun!' : 'Your feedback has been submitted to the engineering team!',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat menghantar maklum balas: $e' : 'Error submitting feedback: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final faqs = isBM ? _faqsBM : _faqsEN;

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Bantuan & Maklum Balas' : 'Help & Feedback',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.bug_report_outlined),
            tooltip: isBM ? 'Lapor Isu / Ralat' : 'Report Issue / Bug',
            onPressed: () => FeedbackModalSheet.show(context, isBM),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: colors.maroonPrimary,
          labelColor: colors.maroonPrimary,
          unselectedLabelColor: colors.textMuted,
          tabs: [
            Tab(text: isBM ? 'Soalan Lazim (FAQ)' : 'FAQ'),
            Tab(text: isBM ? 'Hantar Maklum Balas' : 'Submit Feedback'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // FAQ Tab
          ListView(
            padding: const EdgeInsets.all(16),
            children: [
              // WhatsApp Support Action Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: const Color(0xFF10B981).withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.chat_bubble_outline_rounded, color: Color(0xFF10B981), size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isBM ? 'Bantuan Terus WhatsApp' : 'Direct WhatsApp Support',
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isBM ? 'Hubungi sokongan teknikal agensi Artha' : 'Contact Artha agency technical team',
                            style: TextStyle(color: colors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => _contactWhatsAppSupport(isBM),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF10B981),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      child: Text(
                        isBM ? 'Hubungi' : 'Contact',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Detailed Bug Report / Diagnostics Action Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
                ),
                child: Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(10),
                      decoration: BoxDecoration(
                        color: colors.maroonPrimary.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Icon(Icons.bug_report_rounded, color: colors.maroonPrimary, size: 24),
                    ),
                    const SizedBox(width: 14),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            isBM ? 'Laporan Ralat & Diagnostik' : 'Bug Report & Diagnostics',
                            style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            isBM ? 'Hantar log peranti automatik & langkah isu' : 'Auto attach device specs & steps',
                            style: TextStyle(color: colors.textMuted, fontSize: 11),
                          ),
                        ],
                      ),
                    ),
                    ElevatedButton(
                      onPressed: () => FeedbackModalSheet.show(context, isBM),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.maroonPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                      ),
                      child: Text(
                        isBM ? 'Buka Borang' : 'Open Form',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),

              Text(
                isBM ? 'SOALAN LAZIM EJEN' : 'AGENT FREQUENTLY ASKED QUESTIONS',
                style: TextStyle(color: colors.maroonPrimary, fontSize: 11, fontWeight: FontWeight.bold, letterSpacing: 0.5),
              ),
              const SizedBox(height: 10),

              ...faqs.map((faq) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  decoration: BoxDecoration(
                    color: colors.card,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: colors.border),
                  ),
                  child: ExpansionTile(
                    shape: const Border(),
                    collapsedShape: const Border(),
                    iconColor: colors.maroonPrimary,
                    collapsedIconColor: colors.textMuted,
                    title: Text(
                      faq['question']!,
                      style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w700),
                    ),
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(left: 16, right: 16, bottom: 14),
                        child: Text(
                          faq['answer']!,
                          style: TextStyle(color: colors.textSecondary, fontSize: 12.5, height: 1.45),
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ],
          ),

          // Feedback Tab
          SingleChildScrollView(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  isBM ? 'Laporkan Masalah atau Cadangan' : 'Report an Issue or Suggestion',
                  style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 4),
                Text(
                  isBM
                      ? 'Maklum balas anda membantu kami memperkemaskan Artha untuk kelancaran kerja harian ejen.'
                      : 'Your feedback helps us refine Artha for seamless daily agent workflows.',
                  style: TextStyle(color: colors.textMuted, fontSize: 12),
                ),
                const SizedBox(height: 12),

                InkWell(
                  onTap: () => FeedbackModalSheet.show(context, isBM),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: colors.maroonPrimary.withValues(alpha: 0.1),
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.build_circle_outlined, color: colors.maroonPrimary, size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            isBM
                                ? 'Buka Borang Lanjutan (Diagnostik & WhatsApp)'
                                : 'Open Advanced Form (Diagnostics & WhatsApp)',
                            style: TextStyle(
                              color: colors.maroonPrimary,
                              fontSize: 12,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ),
                        Icon(Icons.chevron_right, color: colors.maroonPrimary, size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),

                DropdownButtonFormField<String>(
                  value: _feedbackType,
                  dropdownColor: colors.surface,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: isBM ? 'Jenis Maklum Balas' : 'Feedback Type',
                    filled: true,
                    fillColor: colors.surface,
                    labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                  ),
                  items: [
                    DropdownMenuItem(value: 'BUG', child: Text(isBM ? 'Laporan Ralat (Bug Report)' : 'Bug Report')),
                    DropdownMenuItem(value: 'FEATURE_REQUEST', child: Text(isBM ? 'Cadangan Fungsi Baru' : 'Feature Request')),
                    DropdownMenuItem(value: 'GENERAL', child: Text(isBM ? 'Maklum Balas Umum' : 'General Feedback')),
                  ],
                  onChanged: (val) {
                    if (val != null) setState(() => _feedbackType = val);
                  },
                ),
                const SizedBox(height: 14),

                TextField(
                  controller: _feedbackTitleController,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: isBM ? 'Tajuk Ringkas' : 'Brief Title',
                    hintText: isBM ? 'Contoh: Masalah simpan nombor telefon vendor' : 'E.g.: Issue saving vendor phone number',
                    filled: true,
                    fillColor: colors.surface,
                    labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                    hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                  ),
                ),
                const SizedBox(height: 14),

                TextField(
                  controller: _feedbackDescController,
                  maxLines: 5,
                  style: TextStyle(color: colors.textPrimary),
                  decoration: InputDecoration(
                    labelText: isBM ? 'Penerangan Terperinci' : 'Detailed Description',
                    hintText: isBM
                        ? 'Terangkan langkah yang berlaku sebelum masalah timbul...'
                        : 'Explain what happened and steps to reproduce...',
                    filled: true,
                    fillColor: colors.surface,
                    labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                    hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
                  ),
                ),
                const SizedBox(height: 24),

                ElevatedButton(
                  onPressed: _isSubmitting ? null : () => _submitFeedback(isBM),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                      : Text(
                          isBM ? 'HANTAR MAKLUM BALAS' : 'SUBMIT FEEDBACK',
                          style: const TextStyle(fontWeight: FontWeight.bold),
                        ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
