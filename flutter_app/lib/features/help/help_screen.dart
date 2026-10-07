import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'feedback_service.dart';
import 'tabs/faq_tab.dart';
import 'tabs/feedback_form_tab.dart';
import 'tabs/ticket_history_tab.dart';
import 'widgets/feedback_modal_sheet.dart';

class HelpScreen extends ConsumerStatefulWidget {
  const HelpScreen({super.key});

  @override
  ConsumerState<HelpScreen> createState() => _HelpScreenState();
}

class _HelpScreenState extends ConsumerState<HelpScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
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
          // TAB 0: FAQ
          FaqTab(
            onGoToSubmit: () => _tabController.animateTo(1),
            onGoToHistory: () => _tabController.animateTo(2),
          ),

          // TAB 1: SUBMIT FEEDBACK
          FeedbackFormTab(
            onSuccessSubmitted: () => _tabController.animateTo(2),
          ),

          // TAB 2: FEEDBACK HISTORY & DEV RESPONSES
          TicketHistoryTab(
            onGoToSubmit: () => _tabController.animateTo(1),
          ),
        ],
      ),
    );
  }
}
