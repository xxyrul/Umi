import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'admin_service.dart';
import 'tabs/admin_approvals_tab.dart';
import 'tabs/admin_broadcast_tab.dart';
import 'tabs/admin_codes_tab.dart';
import 'tabs/admin_feedback_tab.dart';
import 'tabs/admin_listings_tab.dart';

class AdminHubScreen extends ConsumerStatefulWidget {
  const AdminHubScreen({super.key});

  @override
  ConsumerState<AdminHubScreen> createState() => _AdminHubScreenState();
}

class _AdminHubScreenState extends ConsumerState<AdminHubScreen>
    with SingleTickerProviderStateMixin {
  AppThemeColors get colors => context.colors;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final pendingAgentsAsync = ref.watch(pendingAgentsStreamProvider);
    final pendingCount = pendingAgentsAsync.value?.length ?? 0;
    final isBM = ref.watch(languageProvider) == 'BM';

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Admin Hub (Pengurusan Agensi)' : 'Admin Hub (Agency Management)',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 17, color: colors.textPrimary),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          isScrollable: true,
          tabAlignment: TabAlignment.start,
          indicatorColor: colors.maroonPrimary,
          indicatorWeight: 3,
          labelColor: colors.textPrimary,
          unselectedLabelColor: colors.textMuted,
          labelStyle: const TextStyle(fontSize: 13, fontWeight: FontWeight.bold),
          unselectedLabelStyle: const TextStyle(fontSize: 13),
          tabs: [
            // 1. Approvals & Agents
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.people_outline, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Kelulusan & Ejen' : 'Approvals & Agents'),
                  if (pendingCount > 0) ...[
                    const SizedBox(width: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: Colors.amberAccent.shade700,
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: Text(
                        '$pendingCount',
                        style: const TextStyle(color: Colors.black, fontSize: 10, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // 2. Invite Codes
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.vpn_key_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Kod Jemputan' : 'Invite Codes'),
                ],
              ),
            ),
            // 3. Broadcast Notifications
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.campaign_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Siaran Notis' : 'Broadcast Push'),
                ],
              ),
            ),
            // 4. Listings Moderation
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.apartment_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Moderasi Listing' : 'Listings Moderation'),
                ],
              ),
            ),
            // 5. Feedback Desk
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.feedback_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Meja Maklum Balas' : 'Feedback Desk'),
                ],
              ),
            ),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: const [
          AdminApprovalsTab(),
          AdminCodesTab(),
          AdminBroadcastTab(),
          AdminListingsTab(),
          AdminFeedbackTab(),
        ],
      ),
    );
  }
}
