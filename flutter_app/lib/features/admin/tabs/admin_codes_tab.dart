import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../admin_service.dart';

class AdminCodesTab extends ConsumerStatefulWidget {
  const AdminCodesTab({super.key});

  @override
  ConsumerState<AdminCodesTab> createState() => _AdminCodesTabState();
}

class _AdminCodesTabState extends ConsumerState<AdminCodesTab> {
  AppThemeColors get colors => context.colors;
  String _codeFilter = 'ALL'; // ALL, ACTIVE, USED, REVOKED
  bool _isSelectionMode = false;
  final Set<String> _selectedCodes = {};

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final codesAsync = ref.watch(inviteCodesStreamProvider);

    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        heroTag: null,
        onPressed: () => _showBatchGenerateCodeDialog(isBM),
        backgroundColor: colors.maroonPrimary,
        icon: const Icon(Icons.add, color: Colors.white),
        label: Text(
          isBM ? 'Jana Kod' : 'Generate Codes',
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
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
                              final codesToRevoke = _selectedCodes.toList();
                              await ref.read(adminServiceProvider).batchRevokeInviteCodes(codesToRevoke);
                              if (mounted) {
                                setState(() => _selectedCodes.clear());
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(isBM ? 'Kod pilihan telah dibatalkan.' : 'Selected codes revoked.')),
                                );
                              }
                            },
                            child: Text(
                              isBM ? 'Batal (${_selectedCodes.length})' : 'Revoke (${_selectedCodes.length})',
                              style: const TextStyle(color: Colors.orangeAccent, fontSize: 11),
                            ),
                          ),
                          TextButton(
                            onPressed: () async {
                              final codesToDelete = _selectedCodes.toList();
                              await ref.read(adminServiceProvider).batchDeleteInviteCodes(codesToDelete);
                              if (mounted) {
                                setState(() => _selectedCodes.clear());
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(isBM ? 'Kod pilihan telah dipadam.' : 'Selected codes deleted.')),
                                );
                              }
                            },
                            child: Text(
                              isBM ? 'Padam (${_selectedCodes.length})' : 'Delete (${_selectedCodes.length})',
                              style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                            ),
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
                    child: Text(
                      isBM ? 'Tiada kod mengikut tapisan ini.' : 'No codes for this filter.',
                      style: TextStyle(color: colors.textMuted),
                    ),
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

  void _showBatchGenerateCodeDialog(bool isBM) async {
    final prefixController = TextEditingController(text: 'ART');
    final notesController = TextEditingController();
    int count = 5;
    bool isMaster = false;

    try {
      await showModalBottomSheet(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
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
                  bottom: MediaQuery.of(ctx).viewInsets.bottom + ctx.safeBottomPadding(16.0),
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
                        final prefix = prefixController.text.trim();
                        final notes = notesController.text.trim();
                        Navigator.pop(ctx);
                        final codes = await ref.read(adminServiceProvider).generateBatchInviteCodes(
                          count: count,
                          prefix: prefix,
                          notes: notes,
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
    } finally {
      prefixController.dispose();
      notesController.dispose();
    }
  }
}
