import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/phone_intent_helper.dart';
import '../admin_service.dart';

class AdminApprovalsTab extends ConsumerStatefulWidget {
  const AdminApprovalsTab({super.key});

  @override
  ConsumerState<AdminApprovalsTab> createState() => _AdminApprovalsTabState();
}

class _AdminApprovalsTabState extends ConsumerState<AdminApprovalsTab> {
  AppThemeColors get colors => context.colors;
  final TextEditingController _agentSearchController = TextEditingController();
  Timer? _agentSearchDebounce;

  @override
  void dispose() {
    _agentSearchDebounce?.cancel();
    _agentSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final pendingAsync = ref.watch(pendingAgentsStreamProvider);
    final rejectedAsync = ref.watch(rejectedAgentsStreamProvider);
    final allAgentsAsync = ref.watch(allAgentsStreamProvider);

    return ListView(
      padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
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
          loading: () => Center(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: CircularProgressIndicator(color: colors.maroonPrimary),
            ),
          ),
          error: (e, __) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: Text(
              isBM ? 'Ralat memuatkan permohonan: $e' : 'Error loading pending: $e',
              style: const TextStyle(color: Colors.redAccent, fontSize: 12),
            ),
          ),
        ),

        // SECTION B: PERMOHONAN DITOLAK
        rejectedAsync.when(
          data: (rejectedList) {
            if (rejectedList.isEmpty) return const SizedBox.shrink();
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: Colors.redAccent.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: const Icon(Icons.cancel_outlined, color: Colors.redAccent, size: 16),
                    ),
                    const SizedBox(width: 8),
                    Text(
                      isBM ? 'Permohonan Ditolak (${rejectedList.length})' : 'Rejected Applications (${rejectedList.length})',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: Colors.redAccent),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                ...rejectedList.map((agent) => _buildRejectedAgentCard(agent, isBM)),
                const SizedBox(height: 16),
                Divider(color: colors.border, height: 1),
                const SizedBox(height: 16),
              ],
            );
          },
          loading: () => const SizedBox.shrink(),
          error: (_, __) => const SizedBox.shrink(),
        ),

        // SECTION C: DIREKTORI SEMUA EJEN
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
          loading: () => Center(
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: CircularProgressIndicator(color: colors.maroonPrimary),
            ),
          ),
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
                    Text(
                      agent.email.isNotEmpty
                          ? agent.email
                          : (isBM
                              ? 'Tiada e-mel (${agent.uid.length >= 8 ? agent.uid.substring(0, 8) : agent.uid})'
                              : 'No email (${agent.uid.length >= 8 ? agent.uid.substring(0, 8) : agent.uid})'),
                      style: TextStyle(
                        color: agent.email.isNotEmpty ? colors.textSecondary : colors.textMuted,
                        fontSize: 12,
                        fontStyle: agent.email.isNotEmpty ? FontStyle.normal : FontStyle.italic,
                      ),
                    ),
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

  Widget _buildRejectedAgentCard(AdminAgentModel agent, bool isBM) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.redAccent.withValues(alpha: 0.35)),
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
                  style: const TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(agent.displayName, style: TextStyle(fontWeight: FontWeight.bold, color: colors.textPrimary, fontSize: 14)),
                    Text(
                      agent.email.isNotEmpty
                          ? agent.email
                          : (isBM
                              ? 'Tiada e-mel (${agent.uid.length >= 8 ? agent.uid.substring(0, 8) : agent.uid})'
                              : 'No email (${agent.uid.length >= 8 ? agent.uid.substring(0, 8) : agent.uid})'),
                      style: TextStyle(
                        color: agent.email.isNotEmpty ? colors.textSecondary : colors.textMuted,
                        fontSize: 12,
                        fontStyle: agent.email.isNotEmpty ? FontStyle.normal : FontStyle.italic,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                tooltip: isBM ? 'Padam Rekod Ditolak' : 'Delete Record',
                onPressed: () => _confirmDeleteAgent(agent, isBM),
              ),
            ],
          ),
          if (agent.rejectionReason.isNotEmpty) ...[
            const SizedBox(height: 8),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: colors.border),
              ),
              child: Text(
                '${isBM ? "Sebab" : "Reason"}: ${agent.rejectionReason}',
                style: TextStyle(color: colors.textMuted, fontSize: 11, fontStyle: FontStyle.italic),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () async {
                    await ref.read(adminServiceProvider).resetAgentPending(agent.uid);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(isBM ? 'Permohonan ${agent.displayName} dipindahkan ke Menunggu.' : 'Application moved to pending.')),
                      );
                    }
                  },
                  style: OutlinedButton.styleFrom(
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: Text(isBM ? 'Set Semula Menunggu' : 'Move to Pending', style: TextStyle(color: colors.textPrimary, fontSize: 12)),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: ElevatedButton(
                  onPressed: () async {
                    await ref.read(adminServiceProvider).approveAgent(agent.uid);
                    if (mounted) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        SnackBar(content: Text(isBM ? 'Ejen ${agent.displayName} diluluskan semula! 🎉' : 'Agent ${agent.displayName} re-approved! 🎉')),
                      );
                    }
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.success,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                  ),
                  child: Text(isBM ? 'Luluskan Semula' : 'Re-Approve', style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold)),
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
                        if (agent.isBetaTester) ...[
                          const SizedBox(width: 5),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                            decoration: BoxDecoration(
                              color: Colors.amber.withValues(alpha: 0.18),
                              borderRadius: BorderRadius.circular(4),
                              border: Border.all(color: Colors.amber.withValues(alpha: 0.45), width: 0.8),
                            ),
                            child: const Text(
                              'BETA 🧪',
                              style: TextStyle(
                                color: Colors.amber,
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    Text(
                      agent.email.isNotEmpty
                          ? agent.email
                          : (isBM ? 'Tiada e-mel direkodkan' : 'No email recorded'),
                      style: TextStyle(
                        color: colors.textMuted,
                        fontSize: 12,
                        fontStyle: agent.email.isNotEmpty ? FontStyle.normal : FontStyle.italic,
                      ),
                    ),
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
                  onTap: () => PhoneIntentHelper.launchDialer(
                    context: context,
                    phone: agent.phoneNumber,
                    isBM: isBM,
                  ),
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
                  onTap: () => PhoneIntentHelper.launchWhatsApp(
                    context: context,
                    phone: agent.phoneNumber,
                    message: isBM ? 'Hai ${agent.displayName}, daripada Admin Artha.' : 'Hi ${agent.displayName}, from Artha Admin.',
                    isBM: isBM,
                  ),
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

  void _showRejectDialog(AdminAgentModel agent, bool isBM) async {
    final reasonController = TextEditingController();
    try {
      await showDialog(
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
                final reason = reasonController.text.trim();
                Navigator.pop(ctx);
                await ref.read(adminServiceProvider).rejectAgent(agent.uid, reason: reason);
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
    } finally {
      reasonController.dispose();
    }
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
}
