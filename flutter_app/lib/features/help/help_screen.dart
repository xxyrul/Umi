import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/app_select_field.dart';
import '../auth/auth_service.dart';
import 'feedback_service.dart';
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
  final _feedbackNotesController = TextEditingController();
  String _feedbackType = 'BUG';
  bool _isSubmitting = false;

  String _historyFilter = 'ALL';

  final List<Map<String, String>> _faqsBM = [
    {
      'question': 'Bagaimana cara menjana & berkongsi kod jemputan ejen?',
      'answer': 'Pentadbir agensi boleh pergi ke Profil > Pusat Pentadbir > Kod Jemputan. Anda boleh menjana kod pantas dan kongsikan terus kepada rakan agensi dengan satu klik.',
    },
    {
      'question': 'Bagaimana formula DSR & kelayakan pinjaman dikira?',
      'answer': 'Kalkulator DSR Artha mematuhi garis panduan Bank Negara Malaysia (BNM). Ia mengira Nisbah Khidmat Hutang berdasarkan pendapatan bersih bulanan dan komitmen semasa mengikut had ambang bank (sehingga 70-85%).',
    },
    {
      'question': 'Bolehkah saya menggunakan aplikasi semasa tiada internet (Offline)?',
      'answer': 'Ya! Semua listing dan kes yang pernah dibuka disimpan dalam peranti anda. Anda masih boleh menyemaknya walaupun tiada sambungan internet di tapak projek.',
    },
    {
      'question': 'Bagaimana keselamatan maklumat klien & transaksi dilindungi?',
      'answer': 'Privasi anda keutamaan kami. Nombor telefon klien, butiran peribadi dan dokumen sulit hanya boleh diakses oleh anda dan pihak pentadbiran agensi yang sah sahaja.',
    },
    {
      'question': 'Berapa lama masa diambil untuk permohonan akses ejen disahkan?',
      'answer': 'Admin agensi akan menyemak permohonan anda. Biasanya pengesahan akaun selesai dalam tempoh beberapa jam.',
    },
    {
      'question': 'Bagaimana cara berkongsi sebut harga pinjaman kepada klien?',
      'answer': 'Buka Kalkulator > Tab Bank Loan, tekan butang SALIN SEBUT HARGA. Butiran lengkap bersama anggaran kos guaman dan bayaran bulanan akan disalin terus untuk anda hantar kepada klien.',
    },
    {
      'question': 'Di manakah saya boleh menyemak jawapan daripada pihak pembangun?',
      'answer': 'Sebarang laporan masalah atau cadangan yang anda hantar boleh disemak status dan jawapan pentadbir di tab "Rekod & Status" di bahagian atas skrin ini.',
    },
  ];

  final List<Map<String, String>> _faqsEN = [
    {
      'question': 'How do I generate and share agent invite codes?',
      'answer': 'Agency admins can navigate to Profile > Admin Hub > Invite Codes. You can generate invite codes and share them instantly with team members.',
    },
    {
      'question': 'How is the DSR and loan eligibility calculated?',
      'answer': 'The Artha DSR calculator follows Bank Negara Malaysia (BNM) guidelines. It calculates Debt Service Ratio based on net monthly income and existing commitments against bank thresholds (typically 70-85%).',
    },
    {
      'question': 'Can I use the app without an internet connection (Offline)?',
      'answer': 'Yes! Listings and cases you have previously opened are saved on your device. You can still view and review them even at project sites without internet coverage.',
    },
    {
      'question': 'How is client information and transaction data protected?',
      'answer': 'Your client data is private and confidential. Phone numbers, transaction details, and sensitive documents can only be accessed by you and authorized agency admins.',
    },
    {
      'question': 'How long does agent access approval usually take?',
      'answer': 'Your agency admin will review your registration. Verifications are typically approved within a few hours.',
    },
    {
      'question': 'How do I share loan quotations with clients?',
      'answer': 'Go to Calculator > Bank Loan tab, and tap COPY QUOTATION. The complete breakdown including estimated legal fees and monthly installments is copied so you can send it directly to your client.',
    },
    {
      'question': 'Where can I check responses from developers or admins?',
      'answer': 'Any bug reports or suggestions you submit can be tracked along with admin responses under the "History & Status" tab at the top of this screen.',
    },
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    _feedbackTitleController.dispose();
    _feedbackDescController.dispose();
    _feedbackNotesController.dispose();
    super.dispose();
  }

  Future<void> _submitFeedback(bool isBM) async {
    final title = _feedbackTitleController.text.trim();
    final desc = _feedbackDescController.text.trim();
    final notes = _feedbackNotesController.text.trim();

    if (title.isEmpty || desc.isEmpty) {
      AppToast.error(
        context,
        isBM ? 'Sila masukkan tajuk dan penerangan maklum balas.' : 'Please enter a feedback subject and description.',
      );
      return;
    }

    final user = ref.read(authStateProvider).value;
    setState(() => _isSubmitting = true);

    try {
      final docRef = FirebaseFirestore.instance.collection('feedback').doc();
      await docRef.set({
        'id': docRef.id,
        'title': title,
        'description': desc,
        'notes': notes,
        'type': _feedbackType,
        'category': _feedbackType == 'BUG'
            ? 'Masalah'
            : (_feedbackType == 'FEATURE_REQUEST' ? 'Cadangan' : 'Pertanyaan'),
        'userId': user?.uid ?? '',
        'userName': user?.displayName ?? 'Ejen',
        'userEmail': user?.email ?? '',
        'status': 'pending',
        'adminResponse': '',
        'createdAt': FieldValue.serverTimestamp(),
      });

      _feedbackTitleController.clear();
      _feedbackDescController.clear();
      _feedbackNotesController.clear();

      if (mounted) {
        AppToast.success(
          context,
          isBM
              ? 'Maklum balas berjaya dihantar ke Meja Bantuan pentadbir!'
              : 'Feedback submitted successfully to admin desk!',
        );
        // Automatically switch to the History tab so the user sees their new ticket
        _tabController.animateTo(2);
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

  Future<void> _deleteUserFeedback(String feedbackId, bool isBM) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: context.colors.card,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: Text(
          isBM ? 'Padam Rekod Maklum Balas?' : 'Delete Feedback Record?',
          style: TextStyle(color: context.colors.textPrimary, fontWeight: FontWeight.bold),
        ),
        content: Text(
          isBM
              ? 'Adakah anda pasti ingin memadam rekod maklum balas ini dari senarai anda?'
              : 'Are you sure you want to delete this feedback entry from your history?',
          style: TextStyle(color: context.colors.textMuted, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx, false),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: context.colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () => Navigator.pop(ctx, true),
            child: Text(isBM ? 'Ya, Padam' : 'Yes, Delete', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      try {
        await FirebaseFirestore.instance.collection('feedback').doc(feedbackId).delete();
        if (mounted) {
          AppToast.success(
            context,
            isBM ? 'Rekod maklum balas telah dipadam.' : 'Feedback record deleted.',
          );
        }
      } catch (e) {
        if (mounted) {
          AppToast.error(
            context,
            isBM ? 'Ralat memadam maklum balas: $e' : 'Error deleting feedback: $e',
          );
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final faqs = isBM ? _faqsBM : _faqsEN;
    final feedbackAsync = ref.watch(userFeedbackStreamProvider);

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
            icon: const Icon(Icons.rate_review_outlined),
            tooltip: isBM ? 'Borang Ringkas' : 'Quick Form',
            onPressed: () => FeedbackModalSheet.show(context, isBM),
          ),
        ],
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: colors.maroonPrimary,
          labelColor: colors.maroonPrimary,
          unselectedLabelColor: colors.textMuted,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          tabs: [
            Tab(text: isBM ? 'Soalan Lazim (FAQ)' : 'FAQ'),
            Tab(text: isBM ? 'Hantar Maklum Balas' : 'Submit Feedback'),
            Tab(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(isBM ? 'Rekod & Status' : 'History & Status'),
                  const SizedBox(width: 6),
                  feedbackAsync.when(
                    data: (tickets) {
                      if (tickets.isEmpty) return const SizedBox.shrink();
                      final pendingCount = tickets.where((t) => t.status != 'resolved').length;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: pendingCount > 0 ? colors.maroonPrimary : colors.border,
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Text(
                          '${tickets.length}',
                          style: const TextStyle(fontSize: 10, color: Colors.white, fontWeight: FontWeight.bold),
                        ),
                      );
                    },
                    loading: () => const SizedBox.shrink(),
                    error: (_, __) => const SizedBox.shrink(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          // ── TAB 0: FAQ ──────────────────────────────────────────────
          _buildFaqTab(isBM, colors, faqs),

          // ── TAB 1: SUBMIT FEEDBACK ──────────────────────────────────
          _buildSubmitFeedbackTab(isBM, colors),

          // ── TAB 2: FEEDBACK HISTORY & DEV RESPONSES ────────────────
          _buildFeedbackHistoryTab(isBM, colors, feedbackAsync),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 0: FAQ
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildFaqTab(bool isBM, AppThemeColors colors, List<Map<String, String>> faqs) {
    return ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
      children: [
        // Feedback Desk Action Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: colors.maroonPrimary.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Icon(Icons.support_agent_rounded, color: colors.maroonPrimary, size: 24),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          isBM ? 'Pusat Maklum Balas Agensi' : 'Agency Feedback Desk',
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          isBM
                              ? 'Hantar sebarang isu atau cadangan terus ke meja pentadbir & semak jawapan pembangun'
                              : 'Submit issues or suggestions directly to admin desk & check dev replies',
                          style: TextStyle(color: colors.textMuted, fontSize: 11),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _tabController.animateTo(1),
                      icon: const Icon(Icons.edit_note_rounded, size: 16),
                      label: Text(
                        isBM ? 'Hantar Maklum Balas' : 'Submit Feedback',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.maroonPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        elevation: 0,
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: OutlinedButton.icon(
                      onPressed: () => _tabController.animateTo(2),
                      icon: const Icon(Icons.history_rounded, size: 16),
                      label: Text(
                        isBM ? 'Rekod & Status' : 'Ticket History',
                        style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: colors.textPrimary),
                      ),
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: colors.border),
                        padding: const EdgeInsets.symmetric(vertical: 10),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        Text(
          isBM ? 'SOALAN LAZIM (FAQ)' : 'FREQUENTLY ASKED QUESTIONS',
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
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 1: SUBMIT FEEDBACK
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildSubmitFeedbackTab(bool isBM, AppThemeColors colors) {
    return SingleChildScrollView(
      physics: const ClampingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              children: [
                Icon(Icons.info_outline, color: colors.maroonPrimary, size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    isBM
                        ? 'Sebarang maklum balas yang dihantar akan disalurkan terus kepada pentadbir. Anda boleh menyemak status dan jawapan di tab "Rekod & Status".'
                        : 'Submitted feedback goes directly to admins. You can review updates and dev answers in the "History & Status" tab.',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          AppSelectField<String>(
            label: isBM ? 'Kategori Maklum Balas' : 'Feedback Category',
            value: _feedbackType,
            colors: colors,
            items: [
              AppSelectItem(
                value: 'BUG',
                label: isBM ? 'Masalah Aplikasi' : 'App Issue / Glitch',
                subtitle: isBM
                    ? 'Paparan terhenti, butang tidak berfungsi atau ralat sistem'
                    : 'Unresponsive button, glitch, or app error',
                icon: Icons.warning_amber_rounded,
                iconColor: colors.error,
              ),
              AppSelectItem(
                value: 'FEATURE_REQUEST',
                label: isBM ? 'Cadangan Penambahbaikan' : 'Feature Suggestion',
                subtitle: isBM
                    ? 'Idea fungsi baharu untuk memudahkan urusan harian ejen'
                    : 'Ideas for new features to assist agent workflows',
                icon: Icons.lightbulb_outline,
                iconColor: colors.warning,
              ),
              AppSelectItem(
                value: 'GENERAL',
                label: isBM ? 'Pertanyaan / Am' : 'General / Inquiry',
                subtitle: isBM
                    ? 'Sebarang pertanyaan atau perkongsian maklum balas agensi'
                    : 'General questions or comments for agency support',
                icon: Icons.chat_bubble_outline,
                iconColor: colors.info,
              ),
            ],
            onChanged: (val) {
              setState(() => _feedbackType = val);
            },
          ),
          const SizedBox(height: 14),

          TextField(
            controller: _feedbackTitleController,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: isBM ? 'Tajuk / Perkara' : 'Subject',
              hintText: isBM ? 'Contoh: Masalah simpan nombor telefon klien' : 'E.g.: Issue saving client phone number',
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
                  ? 'Terangkan apa yang berlaku atau cadangan anda secara terperinci...'
                  : 'Describe what happened or your suggestion in detail...',
              alignLabelWithHint: true,
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
            controller: _feedbackNotesController,
            maxLines: 2,
            style: TextStyle(color: colors.textPrimary),
            decoration: InputDecoration(
              labelText: isBM ? 'Catatan Tambahan (Pilihan)' : 'Additional Notes (Optional)',
              hintText: isBM ? 'Model peranti, versi Android atau butiran lain...' : 'Device model, Android version or other notes...',
              alignLabelWithHint: true,
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
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                  ),
          ),
        ],
      ),
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  // TAB 2: FEEDBACK HISTORY & DEV RESPONSES
  // ─────────────────────────────────────────────────────────────────────────
  Widget _buildFeedbackHistoryTab(
    bool isBM,
    AppThemeColors colors,
    AsyncValue<List<UserFeedbackModel>> feedbackAsync,
  ) {
    return Column(
      children: [
        // Filter pills bar
        Container(
          color: colors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildFilterChip('ALL', isBM ? 'Semua' : 'All', colors),
              const SizedBox(width: 8),
              _buildFilterChip('pending', isBM ? 'Menunggu' : 'Pending', colors),
              const SizedBox(width: 8),
              _buildFilterChip('in-progress', isBM ? 'Tindakan' : 'In Progress', colors),
              const SizedBox(width: 8),
              _buildFilterChip('resolved', isBM ? 'Selesai' : 'Resolved', colors),
            ],
          ),
        ),

        Expanded(
          child: feedbackAsync.when(
            data: (tickets) {
              final filtered = tickets.where((t) {
                if (_historyFilter == 'ALL') return true;
                return t.status.toLowerCase() == _historyFilter.toLowerCase();
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Padding(
                    padding: const EdgeInsets.all(24),
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Container(
                          padding: const EdgeInsets.all(20),
                          decoration: BoxDecoration(
                            color: colors.card,
                            shape: BoxShape.circle,
                            border: Border.all(color: colors.border),
                          ),
                          child: Icon(Icons.mark_chat_unread_outlined, size: 44, color: colors.textMuted),
                        ),
                        const SizedBox(height: 16),
                        Text(
                          isBM ? 'Tiada Rekod Maklum Balas' : 'No Feedback Records',
                          style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBM
                              ? 'Sebarang laporan masalah atau cadangan yang anda hantar akan dipaparkan di sini berserta status dan maklum balas daripada pembangun.'
                              : 'Any issue reports or suggestions you submit will appear here along with live status updates and developer replies.',
                          textAlign: TextAlign.center,
                          style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.4),
                        ),
                        const SizedBox(height: 20),
                        ElevatedButton.icon(
                          onPressed: () => _tabController.animateTo(1),
                          icon: const Icon(Icons.add, size: 16),
                          label: Text(
                            isBM ? 'Hantar Maklum Balas Pertama' : 'Submit First Feedback',
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.maroonPrimary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      ],
                    ),
                  ),
                );
              }

              final dateFormat = DateFormat('d MMM yyyy, h:mm a');

              return ListView.builder(
                padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final ticket = filtered[index];
                  final isBug = ticket.type == 'BUG' || ticket.type == 'MASALAH';
                  final isFeature = ticket.type == 'FEATURE_REQUEST' || ticket.type == 'CADANGAN';
                  final hasResponse = ticket.adminResponse.isNotEmpty;

                  Color typeColor = Colors.blueAccent;
                  String typeLabel = isBM ? 'Pertanyaan' : 'General';
                  IconData typeIcon = Icons.chat_bubble_outline;

                  if (isBug) {
                    typeColor = Colors.redAccent;
                    typeLabel = isBM ? 'Masalah' : 'Issue';
                    typeIcon = Icons.warning_amber_rounded;
                  } else if (isFeature) {
                    typeColor = Colors.purpleAccent;
                    typeLabel = isBM ? 'Cadangan' : 'Suggestion';
                    typeIcon = Icons.lightbulb_outline;
                  }

                  Color statusColor = Colors.amber;
                  String statusLabel = isBM ? 'MENUNGGU SEMAKAN' : 'PENDING REVIEW';
                  IconData statusIcon = Icons.schedule_rounded;

                  if (ticket.status == 'in-progress') {
                    statusColor = Colors.orangeAccent;
                    statusLabel = isBM ? 'DALAM TINDAKAN' : 'IN PROGRESS';
                    statusIcon = Icons.build_circle_outlined;
                  } else if (ticket.status == 'resolved') {
                    statusColor = const Color(0xFF10B981);
                    statusLabel = isBM ? 'SELESAI' : 'RESOLVED';
                    statusIcon = Icons.check_circle_outline_rounded;
                  }

                  final createdText = ticket.createdAt != null ? dateFormat.format(ticket.createdAt!) : '';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: hasResponse
                            ? colors.maroonPrimary.withValues(alpha: 0.5)
                            : (isBug ? Colors.redAccent.withValues(alpha: 0.25) : colors.border),
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Row: Type Chip + Status Pill + Delete Action
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: typeColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(typeIcon, size: 12, color: typeColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    typeLabel,
                                    style: TextStyle(color: typeColor, fontSize: 10.5, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(width: 8),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: statusColor.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Row(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(statusIcon, size: 12, color: statusColor),
                                  const SizedBox(width: 4),
                                  Text(
                                    statusLabel,
                                    style: TextStyle(color: statusColor, fontSize: 10, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                            const Spacer(),
                            if (createdText.isNotEmpty)
                              Text(
                                createdText,
                                style: TextStyle(color: colors.textDim, fontSize: 10.5),
                              ),
                            const SizedBox(width: 4),
                            InkWell(
                              onTap: () => _deleteUserFeedback(ticket.id, isBM),
                              borderRadius: BorderRadius.circular(12),
                              child: Padding(
                                padding: const EdgeInsets.all(4),
                                child: Icon(Icons.delete_outline_rounded, size: 16, color: colors.textDim),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 12),

                        // Title
                        Text(
                          ticket.title,
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 6),

                        // Description
                        Text(
                          ticket.description,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.45),
                        ),

                        // Optional Notes
                        if (ticket.notes.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.border.withValues(alpha: 0.5)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.notes_rounded, size: 14, color: colors.textMuted),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    ticket.notes,
                                    style: TextStyle(color: colors.textMuted, fontSize: 11.5, fontStyle: FontStyle.italic),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],

                        // ── DEVELOPER / ADMIN RESPONSE BOX ────────────────
                        const SizedBox(height: 14),
                        if (hasResponse)
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: colors.maroonPrimary.withValues(alpha: 0.08),
                              borderRadius: BorderRadius.circular(10),
                              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.35)),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Icon(Icons.support_agent_rounded, size: 16, color: colors.maroonPrimary),
                                    const SizedBox(width: 6),
                                    Text(
                                      isBM ? 'Maklum Balas Pentadbir / Pembangun' : 'Admin & Developer Response',
                                      style: TextStyle(
                                        color: colors.maroonPrimary,
                                        fontSize: 11.5,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                    const Spacer(),
                                    if (ticket.status == 'resolved')
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981).withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: Text(
                                          isBM ? 'SELESAI' : 'RESOLVED',
                                          style: const TextStyle(
                                            color: Color(0xFF10B981),
                                            fontSize: 9,
                                            fontWeight: FontWeight.bold,
                                          ),
                                        ),
                                      ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  ticket.adminResponse,
                                  style: TextStyle(color: colors.textPrimary, fontSize: 12.5, height: 1.45),
                                ),
                              ],
                            ),
                          )
                        else
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: colors.surface,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                Icon(
                                  ticket.status == 'in-progress'
                                      ? Icons.build_circle_outlined
                                      : Icons.hourglass_top_rounded,
                                  size: 14,
                                  color: colors.textMuted,
                                ),
                                const SizedBox(width: 6),
                                Expanded(
                                  child: Text(
                                    ticket.status == 'in-progress'
                                        ? (isBM
                                            ? 'Pasukan pembangun sedang meneliti laporan ini.'
                                            : 'Technical team is currently working on this report.')
                                        : (isBM
                                            ? 'Sedang menunggu semakan daripada pihak pentadbir agensi.'
                                            : 'Awaiting review from agency administration.'),
                                    style: TextStyle(color: colors.textMuted, fontSize: 11),
                                  ),
                                ),
                              ],
                            ),
                          ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(
              child: CircularProgressIndicator(color: colors.maroonPrimary),
            ),
            error: (e, _) => Center(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent)),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFilterChip(String key, String label, AppThemeColors colors) {
    final isSelected = _historyFilter == key;
    return InkWell(
      onTap: () => setState(() => _historyFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w500,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }
}
