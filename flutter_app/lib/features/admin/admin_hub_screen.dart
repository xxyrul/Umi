import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:share_plus/share_plus.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../listings/listing_model.dart';
import '../listings/listing_repository.dart';
import '../notifications/notifications_screen.dart';
import 'admin_service.dart';

class AdminHubScreen extends ConsumerStatefulWidget {
  const AdminHubScreen({super.key});

  @override
  ConsumerState<AdminHubScreen> createState() => _AdminHubScreenState();
}

class _AdminHubScreenState extends ConsumerState<AdminHubScreen>
    with SingleTickerProviderStateMixin {
  AppThemeColors get colors => context.colors;
  late TabController _tabController;

  // Tab 1 state
  final TextEditingController _agentSearchController = TextEditingController();
  Timer? _agentSearchDebounce;

  // Tab 2 state
  String _codeFilter = 'ALL'; // ALL, ACTIVE, USED, REVOKED
  bool _isSelectionMode = false;
  final Set<String> _selectedCodes = {};

  // Tab 3 state (Broadcast)
  final TextEditingController _broadcastTitleController = TextEditingController();
  final TextEditingController _broadcastMessageController = TextEditingController();
  String _broadcastType = 'GENERAL';
  bool _broadcastPinned = false;
  bool _isSendingBroadcast = false;

  // Tab 4 state (Listings)
  String _listingStatusFilter = 'ALL';
  final TextEditingController _listingSearchController = TextEditingController();
  Timer? _listingSearchDebounce;

  // Tab 5 state (Feedback)
  String _feedbackStatusFilter = 'ALL';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 5, vsync: this);
  }

  @override
  void dispose() {
    _agentSearchDebounce?.cancel();
    _listingSearchDebounce?.cancel();
    _tabController.dispose();
    _agentSearchController.dispose();
    _broadcastTitleController.dispose();
    _broadcastMessageController.dispose();
    _listingSearchController.dispose();
    super.dispose();
  }

  // ==========================================
  // TAB BAR & HEADER
  // ==========================================
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
            // 1. Kelulusan & Direktori
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
            // 2. Kod Jemputan
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.vpn_key_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Kod Jemputan' : 'Invite Codes'),
                ],
              ),
            ),
            // 3. Siaran Notis
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.campaign_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Siaran Notis' : 'Broadcast Push'),
                ],
              ),
            ),
            // 4. Moderasi Listing
            Tab(
              child: Row(
                children: [
                  const Icon(Icons.apartment_outlined, size: 18),
                  const SizedBox(width: 6),
                  Text(isBM ? 'Moderasi Listing' : 'Listings Moderation'),
                ],
              ),
            ),
            // 5. Meja Maklum Balas
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
        children: [
          _buildApprovalsAndAgentsTab(),
          _buildInviteCodesTab(),
          _buildBroadcastTab(),
          _buildListingsModerationTab(),
          _buildFeedbackDeskTab(),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 1: KELULUSAN & DIREKTORI EJEN
  // ==========================================
  Widget _buildApprovalsAndAgentsTab() {
    final isBM = ref.watch(languageProvider) == 'BM';
    final pendingAsync = ref.watch(pendingAgentsStreamProvider);
    final allAgentsAsync = ref.watch(allAgentsStreamProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // SECTION A: PERMOHONAN MENUNGGU KELULUSAN
        pendingAsync.when(
          data: (pendingList) {
            if (pendingList.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.amber.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.hourglass_top, color: Colors.amberAccent, size: 16),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isBM ? 'Permohonan Pendaftaran Menunggu (${pendingList.length})' : 'Pending Registrations (${pendingList.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.amberAccent),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ...pendingList.map((agent) => _buildPendingAgentCard(agent, isBM)),
                const SizedBox(height: 16),
                Divider(color: colors.border, height: 1),
                const SizedBox(height: 16),
              ],
            );
          },
          loading: () => Center(child: Padding(
            padding: const EdgeInsets.all(16),
            child: CircularProgressIndicator(color: colors.maroonPrimary),
          )),
          error: (_, __) => const SizedBox.shrink(),
        ),

        // SECTION B: DIREKTORI SEMUA EJEN
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              isBM ? 'Direktori Pasukan Ejen' : 'Agent Team Directory',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
            ),
            allAgentsAsync.when(
              data: (list) => Text('${list.length} ${isBM ? "ejen" : "agents"}', style: TextStyle(color: colors.textMuted, fontSize: 13)),
              loading: () => const SizedBox.shrink(),
              error: (_, __) => const SizedBox.shrink(),
            ),
          ],
        ),
        const SizedBox(height: 12),
        TextField(
          controller: _agentSearchController,
          style: TextStyle(color: colors.textPrimary, fontSize: 13),
          decoration: InputDecoration(
            hintText: isBM ? 'Cari mengikut nama atau e-mel...' : 'Search by name or email...',
            prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 18),
            filled: true,
            fillColor: colors.surface,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          ),
          onChanged: (_) {
            _agentSearchDebounce?.cancel();
            _agentSearchDebounce = Timer(const Duration(milliseconds: 220), () {
              if (mounted) setState(() {});
            });
          },
        ),
        const SizedBox(height: 12),
        allAgentsAsync.when(
          data: (agents) {
            final query = _agentSearchController.text.trim().toLowerCase();
            final filtered = agents.where((a) {
              return query.isEmpty ||
                  a.displayName.toLowerCase().contains(query) ||
                  a.email.toLowerCase().contains(query);
            }).toList();

            if (filtered.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: Center(
                  child: Text(
                    isBM ? 'Tiada ejen dijumpai.' : 'No agents found.',
                    style: TextStyle(color: colors.textMuted),
                  ),
                ),
              );
            }

            return Column(
              children: filtered.map((agent) => _buildAgentDirectoryCard(agent, isBM)).toList(),
            );
          },
          loading: () => Center(child: Padding(
            padding: const EdgeInsets.all(24),
            child: CircularProgressIndicator(color: colors.maroonPrimary),
          )),
          error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
        ),
      ],
    );
  }

  Widget _buildPendingAgentCard(AdminAgentModel agent, bool isBM) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.amber.withValues(alpha: 0.4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: colors.card,
                child: Text(
                  agent.displayName.isNotEmpty ? agent.displayName[0].toUpperCase() : 'A',
                  style: const TextStyle(color: Colors.amberAccent, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(agent.displayName, style: TextStyle(fontWeight: FontWeight.bold, color: colors.textPrimary, fontSize: 14)),
                    Text(agent.email, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                tooltip: isBM ? 'Padam Permohonan' : 'Delete Application',
                onPressed: () => _confirmDeleteAgent(agent, isBM),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _showRejectDialog(agent, isBM),
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.6)),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: Text(isBM ? 'Tolak' : 'Reject', style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    await ref.read(adminServiceProvider).approveAgent(agent.uid);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(isBM ? 'Ejen ${agent.displayName} diluluskan!' : 'Agent ${agent.displayName} approved!')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.success,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: Text(isBM ? 'Luluskan Segera' : 'Approve Now', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildAgentDirectoryCard(AdminAgentModel agent, bool isBM) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: agent.isSuspended ? Colors.redAccent.withValues(alpha: 0.3) : colors.border,
        ),
      ),
      child: Column(
        children: [
          Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundColor: agent.isAdmin ? colors.maroonPrimary.withValues(alpha: 0.3) : colors.card,
                child: Text(
                  agent.displayName.isNotEmpty ? agent.displayName[0].toUpperCase() : 'A',
                  style: TextStyle(
                    color: agent.isAdmin ? colors.maroonPrimary : colors.textPrimary,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(
                            agent.displayName,
                            style: TextStyle(fontWeight: FontWeight.bold, color: colors.textPrimary, fontSize: 14),
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        const SizedBox(width: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: agent.isAdmin
                                ? colors.maroonPrimary.withValues(alpha: 0.15)
                                : (agent.isSuspended ? Colors.redAccent.withValues(alpha: 0.15) : colors.success.withValues(alpha: 0.15)),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            agent.isAdmin ? 'ADMIN' : (agent.isSuspended ? (isBM ? 'DIGANTUNG' : 'SUSPENDED') : (isBM ? 'EJEN' : 'AGENT')),
                            style: TextStyle(
                              color: agent.isAdmin ? colors.maroonPrimary : (agent.isSuspended ? Colors.redAccent : colors.success),
                              fontSize: 9,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                      ],
                    ),
                    Text(agent.email, style: TextStyle(color: colors.textMuted, fontSize: 12)),
                  ],
                ),
              ),
              PopupMenuButton<String>(
                icon: Icon(Icons.more_vert, color: colors.textSecondary, size: 20),
                color: colors.card,
                onSelected: (action) async {
                  if (action == 'role') {
                    final newRole = agent.isAdmin ? 'agent' : 'admin';
                    await ref.read(adminServiceProvider).updateAgentRole(agent.uid, newRole);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(isBM ? 'Peranan ${agent.displayName} dikemaskini.' : 'Role updated.')),
                      );
                    }
                  } else if (action == 'suspend') {
                    if (agent.isSuspended) {
                      await ref.read(adminServiceProvider).activateAgent(agent.uid);
                    } else {
                      await ref.read(adminServiceProvider).suspendAgent(agent.uid);
                    }
                  } else if (action == 'delete') {
                    _confirmDeleteAgent(agent, isBM);
                  }
                },
                itemBuilder: (ctx) => [
                  PopupMenuItem(
                    value: 'role',
                    child: Row(
                      children: [
                        Icon(agent.isAdmin ? Icons.person : Icons.admin_panel_settings, size: 16, color: Colors.amberAccent),
                        const SizedBox(width: 8),
                        Text(agent.isAdmin ? (isBM ? 'Tukar ke Ejen' : 'Demote to Agent') : (isBM ? 'Jadikan Admin' : 'Promote to Admin')),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'suspend',
                    child: Row(
                      children: [
                        Icon(agent.isSuspended ? Icons.play_arrow : Icons.pause, size: 16, color: Colors.orangeAccent),
                        const SizedBox(width: 8),
                        Text(agent.isSuspended ? (isBM ? 'Aktifkan Semula' : 'Activate') : (isBM ? 'Gantung Akaun' : 'Suspend')),
                      ],
                    ),
                  ),
                  PopupMenuItem(
                    value: 'delete',
                    child: Row(
                      children: [
                        const Icon(Icons.delete_outline, size: 16, color: Colors.redAccent),
                        const SizedBox(width: 8),
                        Text(isBM ? 'Padam Rekod' : 'Delete', style: const TextStyle(color: Colors.redAccent)),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),
          if (agent.phoneNumber.isNotEmpty) ...[
            const SizedBox(height: 8),
            Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                InkWell(
                  onTap: () => launchUrl(Uri.parse('tel:${agent.phoneNumber}')),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.phone, size: 13, color: colors.success),
                        const SizedBox(width: 4),
                        Text(agent.phoneNumber, style: TextStyle(color: colors.textSecondary, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                InkWell(
                  onTap: () {
                    final phone = agent.phoneNumber.replaceAll(RegExp(r'[^0-9]'), '');
                    launchUrl(Uri.parse('https://wa.me/$phone'));
                  },
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: Colors.green.withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(6),
                      border: Border.all(color: Colors.green.withValues(alpha: 0.3)),
                    ),
                    child: const Row(
                      children: [
                        Icon(Icons.chat, size: 13, color: Colors.greenAccent),
                        SizedBox(width: 4),
                        Text('WhatsApp', style: TextStyle(color: Colors.greenAccent, fontSize: 11)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  void _showRejectDialog(AdminAgentModel agent, bool isBM) {
    final reasonController = TextEditingController();
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(isBM ? 'Tolak Permohonan' : 'Reject Application', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isBM
                  ? 'Masukkan sebab penolakan permohonan untuk ${agent.displayName}:'
                  : 'Enter rejection reason for ${agent.displayName}:',
              style: TextStyle(color: colors.textSecondary, fontSize: 13),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: reasonController,
              style: TextStyle(color: colors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: isBM ? 'e.g. Maklumat tidak lengkap' : 'e.g. Incomplete details',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(adminServiceProvider).rejectAgent(agent.uid, reason: reasonController.text.trim());
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(isBM ? 'Permohonan ditolak.' : 'Application rejected.')),
                );
              }
            },
            child: Text(isBM ? 'Tolak Ejen' : 'Reject Agent'),
          ),
        ],
      ),
    );
  }

  void _confirmDeleteAgent(AdminAgentModel agent, bool isBM) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(isBM ? 'Padam Rekod Ejen' : 'Delete Agent Record', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Text(
          isBM
              ? 'Adakah anda pasti mahu memadam rekod "${agent.displayName}"? Tindakan ini kekal dan tidak boleh diundur.'
              : 'Are you sure you want to permanently delete "${agent.displayName}"?',
          style: TextStyle(color: colors.textSecondary, fontSize: 13),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(adminServiceProvider).deleteAgent(agent.uid);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(isBM ? 'Rekod ejen dipadam.' : 'Agent deleted.')),
                );
              }
            },
            child: Text(isBM ? 'Padam Kekal' : 'Delete Permanently'),
          ),
        ],
      ),
    );
  }

  // ==========================================
  // TAB 2: KOD JEMPUTAN (BATCH GENERATOR & MULTI-SELECT)
  // ==========================================
  Widget _buildInviteCodesTab() {
    final isBM = ref.watch(languageProvider) == 'BM';
    final codesAsync = ref.watch(inviteCodesStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () => _showBatchGenerateCodeDialog(isBM),
        backgroundColor: colors.maroonPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(isBM ? 'Jana Kod' : 'Generate Codes', style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
      body: Column(
        children: [
          // Filter Chips & Selection Bar
          Container(
            color: colors.surface,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
            child: Column(
              children: [
                Row(
                  children: [
                    _buildCodeFilterChip('ALL', isBM ? 'SEMUA' : 'ALL'),
                    const SizedBox(width: 6),
                    _buildCodeFilterChip('ACTIVE', isBM ? 'AKTIF' : 'ACTIVE'),
                    const SizedBox(width: 6),
                    _buildCodeFilterChip('USED', isBM ? 'DIGUNAKAN' : 'USED'),
                    const SizedBox(width: 6),
                    _buildCodeFilterChip('REVOKED', isBM ? 'BATAL' : 'REVOKED'),
                  ],
                ),
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    InkWell(
                      onTap: () {
                        setState(() {
                          _isSelectionMode = !_isSelectionMode;
                          if (!_isSelectionMode) _selectedCodes.clear();
                        });
                      },
                      child: Row(
                        children: [
                          Icon(
                            _isSelectionMode ? Icons.check_box : Icons.check_box_outline_blank,
                            size: 18,
                            color: _isSelectionMode ? colors.maroonPrimary : colors.textMuted,
                          ),
                          const SizedBox(width: 6),
                          Text(
                            isBM ? 'Mod Pilihan Batch' : 'Batch Selection Mode',
                            style: TextStyle(
                              fontSize: 12,
                              color: _isSelectionMode ? colors.textPrimary : colors.textMuted,
                              fontWeight: _isSelectionMode ? FontWeight.bold : FontWeight.normal,
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (_isSelectionMode && _selectedCodes.isNotEmpty)
                      Row(
                        children: [
                          TextButton(
                            onPressed: () async {
                              await ref.read(adminServiceProvider).batchRevokeInviteCodes(_selectedCodes.toList());
                              setState(() => _selectedCodes.clear());
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(isBM ? 'Kod pilihan telah dibatalkan.' : 'Selected codes revoked.')),
                                );
                              }
                            },
                            child: Text(isBM ? 'Batal (${_selectedCodes.length})' : 'Revoke (${_selectedCodes.length})', style: const TextStyle(color: Colors.orangeAccent, fontSize: 11)),
                          ),
                          TextButton(
                            onPressed: () async {
                              await ref.read(adminServiceProvider).batchDeleteInviteCodes(_selectedCodes.toList());
                              setState(() => _selectedCodes.clear());
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(isBM ? 'Kod pilihan telah dipadam.' : 'Selected codes deleted.')),
                                );
                              }
                            },
                            child: Text(isBM ? 'Padam (${_selectedCodes.length})' : 'Delete (${_selectedCodes.length})', style: const TextStyle(color: Colors.redAccent, fontSize: 11)),
                          ),
                        ],
                      ),
                  ],
                ),
              ],
            ),
          ),
          // Code list
          Expanded(
            child: codesAsync.when(
              data: (codes) {
                final filtered = codes.where((c) {
                  if (_codeFilter == 'ACTIVE') return c.isActive;
                  if (_codeFilter == 'USED') return c.isUsed;
                  if (_codeFilter == 'REVOKED') return c.isRevoked;
                  return true;
                }).toList();

                if (filtered.isEmpty) {
                  return Center(
                    child: Text(isBM ? 'Tiada kod mengikut tapisan ini.' : 'No codes for this filter.', style: TextStyle(color: colors.textMuted)),
                  );
                }

                return ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 96),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final code = filtered[index];
                    final isSelected = _selectedCodes.contains(code.code);

                    return Container(
                      margin: const EdgeInsets.only(bottom: 10),
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: colors.surface,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(
                          color: isSelected ? colors.maroonPrimary : colors.border,
                          width: isSelected ? 1.5 : 1.0,
                        ),
                      ),
                      child: Row(
                        children: [
                          if (_isSelectionMode) ...[
                            Checkbox(
                              value: isSelected,
                              activeColor: colors.maroonPrimary,
                              onChanged: (val) {
                                setState(() {
                                  if (val == true) {
                                    _selectedCodes.add(code.code);
                                  } else {
                                    _selectedCodes.remove(code.code);
                                  }
                                });
                              },
                            ),
                          ],
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    Text(
                                      code.code,
                                      style: TextStyle(
                                        color: colors.textPrimary,
                                        fontWeight: FontWeight.w900,
                                        fontSize: 15,
                                        letterSpacing: 1.1,
                                      ),
                                    ),
                                    const SizedBox(width: 8),
                                    if (code.isMaster)
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                        decoration: BoxDecoration(
                                          color: Colors.purple.withValues(alpha: 0.2),
                                          borderRadius: BorderRadius.circular(4),
                                        ),
                                        child: const Text('MASTER', style: TextStyle(color: Colors.purpleAccent, fontSize: 9, fontWeight: FontWeight.bold)),
                                      ),
                                    const SizedBox(width: 4),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: code.isActive
                                            ? Colors.green.withValues(alpha: 0.2)
                                            : (code.isRevoked ? Colors.red.withValues(alpha: 0.2) : Colors.blueGrey.withValues(alpha: 0.2)),
                                        borderRadius: BorderRadius.circular(4),
                                      ),
                                      child: Text(
                                        code.status,
                                        style: TextStyle(
                                          color: code.isActive ? Colors.greenAccent : (code.isRevoked ? Colors.redAccent : Colors.blueGrey),
                                          fontSize: 9,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  '${code.notes.isNotEmpty ? "${code.notes} • " : ""}Digunakan: ${code.usedCount} / ${code.isMaster ? "∞" : code.maxUses}',
                                  style: TextStyle(color: colors.textMuted, fontSize: 11),
                                ),
                              ],
                            ),
                          ),
                          IconButton(
                            icon: Icon(Icons.copy, size: 18, color: colors.textSecondary),
                            tooltip: 'Salin',
                            onPressed: () {
                              Clipboard.setData(ClipboardData(text: code.code));
                              ScaffoldMessenger.of(context).showSnackBar(
                                SnackBar(content: Text('Kod ${code.code} disalin!')),
                              );
                            },
                          ),
                          IconButton(
                            icon: const Icon(Icons.share, size: 18, color: Colors.greenAccent),
                            tooltip: 'Kongsi ke WhatsApp',
                            onPressed: () {
                              final msg = 'Sila gunakan Kod Jemputan ini untuk mendaftar di Aplikasi Artha: ${code.code}';
                              Share.share(msg);
                            },
                          ),
                          PopupMenuButton<String>(
                            icon: Icon(Icons.more_vert, size: 18, color: colors.textMuted),
                            color: colors.card,
                            onSelected: (val) async {
                              if (val == 'toggle') {
                                if (code.isRevoked) {
                                  await ref.read(adminServiceProvider).restoreInviteCode(code.code);
                                } else {
                                  await ref.read(adminServiceProvider).revokeInviteCode(code.code);
                                }
                              } else if (val == 'delete') {
                                await ref.read(adminServiceProvider).deleteInviteCode(code.code);
                              }
                            },
                            itemBuilder: (ctx) => [
                              PopupMenuItem(
                                value: 'toggle',
                                child: Text(code.isRevoked ? (isBM ? 'Aktifkan Semula' : 'Reactivate') : (isBM ? 'Batalkan Kod' : 'Revoke')),
                              ),
                              PopupMenuItem(
                                value: 'delete',
                                child: Text(isBM ? 'Padam' : 'Delete', style: const TextStyle(color: Colors.redAccent)),
                              ),
                            ],
                          ),
                        ],
                      ),
                    );
                  },
                );
              },
              loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
              error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCodeFilterChip(String key, String label) {
    final isSelected = _codeFilter == key;
    return InkWell(
      onTap: () => setState(() => _codeFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  void _showBatchGenerateCodeDialog(bool isBM) {
    final prefixController = TextEditingController(text: 'ART');
    final notesController = TextEditingController();
    int count = 5;
    bool isMaster = false;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            return Padding(
              padding: EdgeInsets.only(
                left: 20,
                right: 20,
                top: 20,
                bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Jana Kod Jemputan Ejen' : 'Generate Invite Codes',
                        style: TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: colors.textPrimary),
                      ),
                      IconButton(
                        icon: Icon(Icons.close, color: colors.textMuted),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  TextField(
                    controller: prefixController,
                    textCapitalization: TextCapitalization.characters,
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Awalan Kod (Prefix)' : 'Code Prefix',
                      hintText: 'e.g. ART, KL, JB',
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextField(
                    controller: notesController,
                    style: TextStyle(color: colors.textPrimary),
                    decoration: InputDecoration(
                      labelText: isBM ? 'Nota / Rujukan' : 'Notes / Reference',
                      hintText: 'e.g. Pengambilan Ejen Baru',
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    children: [
                      Text(isBM ? 'Bilangan Kod:' : 'Number of Codes:', style: TextStyle(color: colors.textSecondary, fontSize: 13)),
                      const Spacer(),
                      for (final c in [1, 5, 10, 20]) ...[
                        InkWell(
                          onTap: () => setModalState(() => count = c),
                          child: Container(
                            margin: const EdgeInsets.only(left: 6),
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                            decoration: BoxDecoration(
                              color: count == c ? colors.maroonPrimary : colors.card,
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Text(
                              '$c',
                              style: TextStyle(
                                color: count == c ? Colors.white : colors.textSecondary,
                                fontWeight: FontWeight.bold,
                                fontSize: 12,
                              ),
                            ),
                          ),
                        ),
                      ],
                    ],
                  ),
                  const SizedBox(height: 14),
                  SwitchListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(
                      isBM ? 'Master Code (Penggunaan Tanpa Had)' : 'Master Code (Unlimited Uses)',
                      style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                    ),
                    subtitle: Text(
                      isBM ? 'Boleh digunakan berulang kali oleh pelbagai ejen' : 'Can be used repeatedly',
                      style: TextStyle(color: colors.textMuted, fontSize: 11),
                    ),
                    value: isMaster,
                    activeColor: colors.maroonPrimary,
                    onChanged: (val) => setModalState(() => isMaster = val),
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    onPressed: () async {
                      Navigator.pop(ctx);
                      final codes = await ref.read(adminServiceProvider).generateBatchInviteCodes(
                        count: count,
                        prefix: prefixController.text.trim(),
                        notes: notesController.text.trim(),
                        isMaster: isMaster,
                      );
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(isBM ? '${codes.length} kod jemputan berjaya dijana!' : '${codes.length} codes generated!')),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: colors.maroonPrimary,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                    ),
                    child: Text(
                      isBM ? 'Jana & Simpan ($count Kod)' : 'Generate ($count Codes)',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  // ==========================================
  // TAB 3: SIARAN NOTIS (BROADCAST NOTIFICATIONS)
  // ==========================================
  Widget _buildBroadcastTab() {
    final isBM = ref.watch(languageProvider) == 'BM';
    final announcementsAsync = ref.watch(announcementsStreamProvider);

    return ListView(
      padding: const EdgeInsets.all(16),
      children: [
        // Composer Card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: colors.surface,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Icon(Icons.campaign, color: colors.maroonPrimary, size: 22),
                  const SizedBox(width: 8),
                  Text(
                    isBM ? 'Cipta Siaran Baru ke Semua Ejen' : 'Broadcast to All Agents',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              TextField(
                controller: _broadcastTitleController,
                style: TextStyle(color: colors.textPrimary, fontSize: 14, fontWeight: FontWeight.bold),
                decoration: InputDecoration(
                  labelText: isBM ? 'Tajuk Siaran' : 'Broadcast Title',
                  hintText: isBM ? 'e.g. Taklimat Projek Baru Petang Ini' : 'e.g. Project Briefing Today',
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _broadcastMessageController,
                maxLines: 3,
                style: TextStyle(color: colors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  labelText: isBM ? 'Kandungan Mesej Notis' : 'Notification Message',
                  hintText: isBM ? 'Tulis pengumuman terperinci di sini...' : 'Write notice details here...',
                ),
              ),
              const SizedBox(height: 14),
              Row(
                children: [
                  Text(isBM ? 'Kategori:' : 'Category:', style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                  const SizedBox(width: 8),
                  for (final type in ['GENERAL', 'URGENT', 'LISTING', 'COMMISSION']) ...[
                    InkWell(
                      onTap: () => setState(() => _broadcastType = type),
                      child: Container(
                        margin: const EdgeInsets.only(right: 6),
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _broadcastType == type ? colors.maroonPrimary : colors.card,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          type,
                          style: TextStyle(
                            color: _broadcastType == type ? Colors.white : colors.textMuted,
                            fontSize: 10,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 10),
              SwitchListTile(
                contentPadding: EdgeInsets.zero,
                title: Text(isBM ? 'Sematkan di Bahagian Atas (Pinned)' : 'Pin Announcement at Top', style: TextStyle(color: colors.textPrimary, fontSize: 13)),
                value: _broadcastPinned,
                activeColor: colors.maroonPrimary,
                onChanged: (val) => setState(() => _broadcastPinned = val),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: _isSendingBroadcast
                    ? null
                    : () async {
                        final title = _broadcastTitleController.text.trim();
                        final msg = _broadcastMessageController.text.trim();
                        if (title.isEmpty || msg.isEmpty) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text(isBM ? 'Sila isi tajuk dan mesej siaran.' : 'Please enter title and message.')),
                          );
                          return;
                        }

                        setState(() => _isSendingBroadcast = true);
                        try {
                          await ref.read(adminServiceProvider).createBroadcastAnnouncement(
                            titleBM: title,
                            titleEN: title,
                            messageBM: msg,
                            messageEN: msg,
                            type: _broadcastType,
                            pinned: _broadcastPinned,
                          );
                          _broadcastTitleController.clear();
                          _broadcastMessageController.clear();
                          if (mounted) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(content: Text(isBM ? 'Siaran berjaya dihantar ke papan notis & push notification!' : 'Broadcast dispatched!')),
                            );
                          }
                        } finally {
                          if (mounted) setState(() => _isSendingBroadcast = false);
                        }
                      },
                icon: _isSendingBroadcast
                    ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Icon(Icons.send, size: 16),
                label: Text(isBM ? 'Hantar Siaran ke Semua Ejen' : 'Send Broadcast to All Agents'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: colors.maroonPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Sent History
        Text(
          isBM ? 'Sejarah Siaran Notis' : 'Broadcast History',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
        ),
        const SizedBox(height: 12),
        announcementsAsync.when(
          data: (list) {
            if (list.isEmpty) {
              return Padding(
                padding: const EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(isBM ? 'Tiada siaran direkodkan.' : 'No broadcasts found.', style: TextStyle(color: colors.textMuted)),
                ),
              );
            }

            return Column(
              children: list.map((item) {
                return Container(
                  margin: const EdgeInsets.only(bottom: 10),
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(color: item.pinned ? Colors.amber.withValues(alpha: 0.4) : colors.border),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(
                        item.pinned ? Icons.push_pin : Icons.notifications_active_outlined,
                        color: item.pinned ? Colors.amberAccent : colors.maroonPrimary,
                        size: 20,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Expanded(
                                  child: Text(
                                    item.title,
                                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                  decoration: BoxDecoration(
                                    color: colors.card,
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(item.type, style: TextStyle(color: colors.textMuted, fontSize: 9, fontWeight: FontWeight.bold)),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(item.message, style: TextStyle(color: colors.textSecondary, fontSize: 12)),
                            if (item.createdAt != null) ...[
                              const SizedBox(height: 6),
                              Text(
                                DateFormat('dd MMM yyyy, hh:mm a').format(item.createdAt!),
                                style: TextStyle(color: colors.textMuted, fontSize: 10),
                              ),
                            ],
                          ],
                        ),
                      ),
                      IconButton(
                        icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 18),
                        onPressed: () async {
                          await ref.read(adminServiceProvider).deleteAnnouncement(item.id);
                        },
                      ),
                    ],
                  ),
                );
              }).toList(),
            );
          },
          loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
          error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
        ),
      ],
    );
  }

  // ==========================================
  // TAB 4: MODERASI LISTING AGENT
  // ==========================================
  Widget _buildListingsModerationTab() {
    final isBM = ref.watch(languageProvider) == 'BM';
    final listingsAsync = ref.watch(listingsStreamProvider);

    return Column(
      children: [
        // Filter and Search Header
        Container(
          color: colors.surface,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildListingFilterChip('ALL', isBM ? 'SEMUA' : 'ALL'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Active', isBM ? 'AKTIF' : 'ACTIVE'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Sold', isBM ? 'DIJUAL' : 'SOLD'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Reserved', isBM ? 'DIKHAS' : 'RESERVED'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Draft', isBM ? 'DRAF' : 'DRAFT'),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _listingSearchController,
                style: TextStyle(color: colors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: isBM ? 'Cari listing mengikut tajuk, lokasi...' : 'Search listings...',
                  prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 18),
                  filled: true,
                  fillColor: colors.card,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                    onChanged: (_) {
                      _listingSearchDebounce?.cancel();
                      _listingSearchDebounce = Timer(const Duration(milliseconds: 220), () {
                        if (mounted) setState(() {});
                      });
                    },
              ),
            ],
          ),
        ),
        // Listings List
        Expanded(
          child: listingsAsync.when(
            data: (listings) {
              final query = _listingSearchController.text.trim().toLowerCase();
              final filtered = listings.where((l) {
                final matchesFilter = _listingStatusFilter == 'ALL' ||
                    l.status.toLowerCase() == _listingStatusFilter.toLowerCase();
                final matchesQuery = query.isEmpty ||
                    l.title.toLowerCase().contains(query) ||
                    l.address.toLowerCase().contains(query) ||
                    l.state.toLowerCase().contains(query) ||
                    l.agentName.toLowerCase().contains(query);
                return matchesFilter && matchesQuery;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text(isBM ? 'Tiada listing dijumpai.' : 'No listings found.', style: TextStyle(color: colors.textMuted)),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final listing = filtered[index];
                  final priceFmt = NumberFormat.currency(locale: 'ms_MY', symbol: 'RM ', decimalDigits: 0).format(listing.price);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Thumbnail
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: listing.photos.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: listing.photos.first,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Icon(Icons.apartment, color: colors.textMuted),
                                )
                              : Icon(Icons.apartment, color: colors.textMuted),
                        ),
                        const SizedBox(width: 12),
                        // Details
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                listing.title,
                                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                priceFmt,
                                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${listing.propertyType} • ${listing.state}',
                                style: TextStyle(color: colors.textSecondary, fontSize: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${isBM ? "Ejen:" : "Agent:"} ${listing.agentName.isNotEmpty ? listing.agentName : listing.agentPhone}',
                                style: TextStyle(color: colors.textMuted, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                        // Status & Action
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            () {
                              final isAktif = listing.isAktif;
                              final isSold = listing.isSold;
                              final statusColor = isAktif
                                  ? colors.success
                                  : (isSold ? Colors.redAccent : Colors.orangeAccent);
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  listing.getDisplayStatus(isBM),
                                  style: TextStyle(
                                    color: statusColor,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              );
                            }(),
                            const SizedBox(height: 8),
                            InkWell(
                              onTap: () => _showChangeListingStatusDialog(listing, isBM),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: colors.card,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Text(isBM ? 'Tukar Status' : 'Change', style: TextStyle(color: colors.textPrimary, fontSize: 11)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
            error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
          ),
        ),
      ],
    );
  }

  Widget _buildListingFilterChip(String key, String label) {
    final isSelected = _listingStatusFilter == key;
    return InkWell(
      onTap: () => setState(() => _listingStatusFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  void _showChangeListingStatusDialog(ListingModel listing, bool isBM) {
    showModalBottomSheet(
      context: context,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              isBM ? 'Ubah Status Listing' : 'Update Listing Status',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(listing.title, style: TextStyle(color: colors.textMuted, fontSize: 12)),
            const SizedBox(height: 16),
            for (final status in ['Active', 'Sold', 'Reserved', 'Draft']) ...[
              ListTile(
                title: Text(status, style: TextStyle(color: colors.textPrimary, fontSize: 14)),
                trailing: listing.status.toLowerCase() == status.toLowerCase()
                    ? Icon(Icons.check, color: colors.maroonPrimary)
                    : null,
                onTap: () async {
                  Navigator.pop(ctx);
                  await ref.read(adminServiceProvider).updateListingStatus(listing.id, status);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(isBM ? 'Status dikemaskini ke $status' : 'Status updated to $status')),
                    );
                  }
                },
              ),
            ],
          ],
        ),
      ),
    );
  }

  // ==========================================
  // TAB 5: MEJA MAKLUM BALAS (FEEDBACK & BUG DESK)
  // ==========================================
  Widget _buildFeedbackDeskTab() {
    final isBM = ref.watch(languageProvider) == 'BM';
    final feedbackAsync = ref.watch(adminFeedbackStreamProvider);

    return Column(
      children: [
        // Filter Bar
        Container(
          color: colors.surface,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Row(
            children: [
              _buildFeedbackFilterChip('ALL', isBM ? 'SEMUA' : 'ALL'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('pending', isBM ? 'BARU' : 'PENDING'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('in-progress', isBM ? 'TINDAKAN' : 'IN PROGRESS'),
              const SizedBox(width: 6),
              _buildFeedbackFilterChip('resolved', isBM ? 'SELESAI' : 'RESOLVED'),
            ],
          ),
        ),
        // Tickets List
        Expanded(
          child: feedbackAsync.when(
            data: (tickets) {
              final filtered = tickets.where((t) {
                if (_feedbackStatusFilter == 'ALL') return true;
                return t.status.toLowerCase() == _feedbackStatusFilter.toLowerCase();
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text(isBM ? 'Tiada maklum balas direkodkan.' : 'No feedback tickets.', style: TextStyle(color: colors.textMuted)),
                );
              }

              return ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final ticket = filtered[index];
                  final isBug = ticket.type.toLowerCase() == 'bug';

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(
                        color: isBug ? Colors.redAccent.withValues(alpha: 0.3) : colors.border,
                      ),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Tag Header
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: isBug ? Colors.redAccent.withValues(alpha: 0.2) : Colors.blue.withValues(alpha: 0.2),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                ticket.type.toUpperCase(),
                                style: TextStyle(
                                  color: isBug ? Colors.redAccent : Colors.blueAccent,
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                ticket.userName,
                                style: TextStyle(color: colors.textSecondary, fontSize: 12),
                                overflow: TextOverflow.ellipsis,
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                              decoration: BoxDecoration(
                                color: ticket.status == 'resolved'
                                    ? Colors.green.withValues(alpha: 0.2)
                                    : (ticket.status == 'in-progress' ? Colors.orange.withValues(alpha: 0.2) : Colors.amber.withValues(alpha: 0.2)),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                ticket.status.toUpperCase(),
                                style: TextStyle(
                                  color: ticket.status == 'resolved'
                                      ? Colors.greenAccent
                                      : (ticket.status == 'in-progress' ? Colors.orangeAccent : Colors.amberAccent),
                                  fontSize: 10,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        Text(
                          ticket.title,
                          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          ticket.description,
                          style: TextStyle(color: colors.textSecondary, fontSize: 13, height: 1.4),
                        ),
                        if (ticket.deviceModel.isNotEmpty || ticket.appVersion.isNotEmpty) ...[
                          const SizedBox(height: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              '${ticket.deviceModel.isNotEmpty ? "${ticket.deviceModel} • " : ""}v${ticket.appVersion}',
                              style: TextStyle(color: colors.textMuted, fontSize: 10),
                            ),
                          ),
                        ],
                        // Screenshot preview
                        if (ticket.screenshotUrl.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          InkWell(
                            onTap: () => _viewFullScreenshot(ticket.screenshotUrl),
                            child: Container(
                              height: 100,
                              width: 140,
                              decoration: BoxDecoration(
                                color: colors.card,
                                borderRadius: BorderRadius.circular(8),
                                border: Border.all(color: colors.border),
                              ),
                              clipBehavior: Clip.antiAlias,
                              child: CachedNetworkImage(
                                imageUrl: ticket.screenshotUrl,
                                fit: BoxFit.cover,
                                errorWidget: (_, __, ___) => Center(child: Icon(Icons.broken_image, color: colors.textMuted)),
                              ),
                            ),
                          ),
                        ],
                        // Admin Response Section
                        if (ticket.adminResponse.isNotEmpty) ...[
                          const SizedBox(height: 10),
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
                            ),
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Icon(Icons.reply, size: 16, color: colors.maroonPrimary),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(isBM ? 'Balasan Pentadbir:' : 'Admin Response:', style: TextStyle(color: colors.maroonPrimary, fontSize: 11, fontWeight: FontWeight.bold)),
                                      const SizedBox(height: 2),
                                      Text(ticket.adminResponse, style: TextStyle(color: colors.textPrimary, fontSize: 12)),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        const SizedBox(height: 12),
                        Divider(color: colors.border, height: 1),
                        const SizedBox(height: 10),
                        // Action row: Change Status & Reply
                        Row(
                          mainAxisAlignment: MainAxisAlignment.end,
                          children: [
                            OutlinedButton.icon(
                              icon: const Icon(Icons.comment, size: 14),
                              label: Text(isBM ? 'Balas' : 'Reply', style: const TextStyle(fontSize: 12)),
                              onPressed: () => _showFeedbackReplyDialog(ticket, isBM),
                              style: OutlinedButton.styleFrom(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                side: BorderSide(color: colors.border),
                              ),
                            ),
                            const SizedBox(width: 8),
                            PopupMenuButton<String>(
                              onSelected: (newStatus) async {
                                await ref.read(adminServiceProvider).updateFeedbackStatus(ticket.id, newStatus);
                              },
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                decoration: BoxDecoration(
                                  color: colors.maroonPrimary,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Row(
                                  children: [
                                    Text(isBM ? 'Tukar Status' : 'Status', style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold)),
                                    const Icon(Icons.arrow_drop_down, color: Colors.white, size: 16),
                                  ],
                                ),
                              ),
                              itemBuilder: (ctx) => [
                                const PopupMenuItem(value: 'pending', child: Text('Pending (Baru)')),
                                const PopupMenuItem(value: 'in-progress', child: Text('In Progress (Tindakan)')),
                                const PopupMenuItem(value: 'resolved', child: Text('Resolved (Selesai)')),
                              ],
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
            error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
          ),
        ),
      ],
    );
  }

  Widget _buildFeedbackFilterChip(String key, String label) {
    final isSelected = _feedbackStatusFilter == key;
    return InkWell(
      onTap: () => setState(() => _feedbackStatusFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  void _showFeedbackReplyDialog(AdminFeedbackModel ticket, bool isBM) {
    final replyController = TextEditingController(text: ticket.adminResponse);
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(isBM ? 'Balas Maklum Balas' : 'Reply to Feedback', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(ticket.title, style: TextStyle(color: colors.textMuted, fontSize: 12)),
            const SizedBox(height: 12),
            TextField(
              controller: replyController,
              maxLines: 4,
              style: TextStyle(color: colors.textPrimary, fontSize: 13),
              decoration: InputDecoration(
                hintText: isBM ? 'Tulis nota atau tindakan pembetulan di sini...' : 'Write notes here...',
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: colors.maroonPrimary),
            onPressed: () async {
              Navigator.pop(ctx);
              await ref.read(adminServiceProvider).updateFeedbackStatus(
                ticket.id,
                ticket.status,
                adminResponse: replyController.text.trim(),
              );
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(content: Text(isBM ? 'Balasan berjaya disimpan.' : 'Reply saved.')),
                );
              }
            },
            child: Text(isBM ? 'Simpan Balasan' : 'Save Reply'),
          ),
        ],
      ),
    );
  }

  void _viewFullScreenshot(String imageUrl) {
    showDialog(
      context: context,
      builder: (ctx) => Dialog(
        backgroundColor: Colors.black,
        insetPadding: const EdgeInsets.all(12),
        child: Stack(
          alignment: Alignment.topRight,
          children: [
            InteractiveViewer(
              child: CachedNetworkImage(
                imageUrl: imageUrl,
                fit: BoxFit.contain,
              ),
            ),
            IconButton(
              icon: const Icon(Icons.close, color: Colors.white, size: 28),
              onPressed: () => Navigator.pop(ctx),
            ),
          ],
        ),
      ),
    );
  }
}
