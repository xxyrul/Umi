import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../updater_service.dart';

class OptOutBetaSheet extends ConsumerStatefulWidget {
  final ReleaseManifest stableRelease;
  final String? initialPath;
  final VoidCallback onChannelSwitched;

  const OptOutBetaSheet({
    super.key,
    required this.stableRelease,
    this.initialPath,
    required this.onChannelSwitched,
  });

  @override
  ConsumerState<OptOutBetaSheet> createState() => _OptOutBetaSheetState();
}

class _OptOutBetaSheetState extends ConsumerState<OptOutBetaSheet> {
  double _downloadProgress = 0.0;
  String _downloadedMb = '0';
  String _totalMb = '0';
  bool _isDownloading = false;
  late bool _isDownloaded;
  String? _downloadError;
  String? _downloadedFilePath;

  @override
  void initState() {
    super.initState();
    _isDownloaded = widget.initialPath != null;
    _downloadedFilePath = widget.initialPath;
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = ref.watch(languageProvider) == 'BM';
    final updater = ref.read(updaterServiceProvider);

    return Container(
      constraints: BoxConstraints(
        maxHeight: MediaQuery.of(context).size.height * 0.90,
      ),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 12,
        bottom: context.safeBottomPadding(16),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              margin: const EdgeInsets.only(bottom: 16),
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: Colors.amber.withValues(alpha: 0.15),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Icon(Icons.swap_horizontal_circle_outlined, color: Colors.amber, size: 22),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isBM ? 'Keluar Saluran Beta' : 'Leave Beta Channel',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: colors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isBM ? 'Pilih salah satu cara di bawah:' : 'Choose an option below:',
                      style: TextStyle(fontSize: 12, color: colors.textSecondary),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.close, color: colors.textMuted, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Cloud Data Safety Banner
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF10B981).withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(10),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.25)),
            ),
            child: Row(
              children: [
                const Icon(Icons.cloud_done_rounded, color: Color(0xFF10B981), size: 18),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isBM
                        ? 'Data Selamat: Semua data anda disimpan selamat dalam Cloud Firestore.'
                        : 'Cloud Protected: All your cases & data are safely synced in Cloud Firestore.',
                    style: TextStyle(fontSize: 11, color: colors.textPrimary, fontWeight: FontWeight.w500),
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),

          // 2 Clean Choices (Scrollable)
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Card 1: Instant Switch (Recommended)
                  Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.6), width: 1.5),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.verified_rounded, color: Color(0xFF10B981), size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                isBM ? 'Tukar Saluran Sahaja' : 'Switch Channel Only',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: const Color(0xFF10B981).withValues(alpha: 0.18),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isBM ? 'DISYORKAN' : 'RECOMMENDED',
                                style: const TextStyle(
                                  fontSize: 9,
                                  fontWeight: FontWeight.bold,
                                  color: Color(0xFF10B981),
                                ),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBM
                              ? 'Kekal guna versi semasa. Notis beta dihentikan, dan kemas kini stabil seterusnya akan tiba secara automatik.'
                              : 'Stay on your current build. Beta test alerts stop, and the next stable build will update automatically.',
                          style: TextStyle(fontSize: 11, color: colors.textSecondary, height: 1.35),
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              await ref.read(updateChannelProvider.notifier).setChannel(UpdateChannel.stable);
                              if (context.mounted) Navigator.pop(context);
                              widget.onChannelSwitched();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(
                                    content: Text(
                                      isBM
                                          ? 'Saluran berjaya ditukar ke Stabil rasmi.'
                                          : 'Switched to official Stable channel!',
                                    ),
                                  ),
                                );
                              }
                            },
                            icon: const Icon(Icons.check_circle_outline_rounded, size: 16, color: Colors.white),
                            label: Text(
                              isBM ? 'Tukar ke Stabil (1-Ketik)' : 'Switch to Stable (1-Tap)',
                              style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                            ),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              padding: const EdgeInsets.symmetric(vertical: 10),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),

                  // Card 2: Fresh Reinstall Stable
                  Container(
                    margin: const EdgeInsets.only(bottom: 6),
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            const Icon(Icons.download_for_offline_rounded, color: Colors.amber, size: 18),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                isBM ? 'Pasang Semula Versi Stabil' : 'Fresh Reinstall Stable',
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.bold,
                                  color: colors.textPrimary,
                                ),
                              ),
                            ),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 2),
                              decoration: BoxDecoration(
                                color: Colors.amber.withValues(alpha: 0.15),
                                borderRadius: BorderRadius.circular(6),
                              ),
                              child: Text(
                                isBM ? 'DOWNLOADS' : 'APK DOWNLOAD',
                                style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Colors.amber),
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 6),
                        Text(
                          isBM
                              ? 'Muat turun APK rasmi ke folder Downloads untuk memasang semula versi stabil sekarang.'
                              : 'Download official APK to your Downloads folder to reinstall stable version right now.',
                          style: TextStyle(fontSize: 11, color: colors.textSecondary, height: 1.35),
                        ),
                        const SizedBox(height: 10),

                        if (_isDownloading) ...[
                          ClipRRect(
                            borderRadius: BorderRadius.circular(4),
                            child: LinearProgressIndicator(
                              value: _downloadProgress > 0 ? _downloadProgress : null,
                              backgroundColor: colors.surface,
                              color: Colors.amber,
                              minHeight: 6,
                            ),
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                '$_downloadedMb MB / $_totalMb MB',
                                style: TextStyle(fontSize: 10, color: colors.textMuted),
                              ),
                              Text(
                                '${(_downloadProgress * 100).toInt()}%',
                                style: const TextStyle(fontSize: 10, color: Colors.amber, fontWeight: FontWeight.bold),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Align(
                            alignment: Alignment.centerRight,
                            child: TextButton(
                              onPressed: () {
                                updater.cancelDownload();
                                setState(() {
                                  _isDownloading = false;
                                  _downloadError = isBM ? 'Muat turun dibatalkan.' : 'Download cancelled.';
                                });
                              },
                              child: Text(
                                isBM ? 'Batal' : 'Cancel',
                                style: TextStyle(fontSize: 11, color: colors.textMuted),
                              ),
                            ),
                          ),
                        ] else if (_isDownloaded) ...[
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                            decoration: BoxDecoration(
                              color: const Color(0xFF10B981).withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(8),
                            ),
                            child: Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 16),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Text(
                                    isBM ? 'Fail APK sedia ada di folder Downloads!' : 'APK is ready in Downloads folder!',
                                    style: TextStyle(fontSize: 11, color: colors.textPrimary, fontWeight: FontWeight.w600),
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: () async {
                                    await updater.openDownloadsFolder(fallbackFilePath: _downloadedFilePath);
                                  },
                                  icon: const Icon(Icons.folder_open_rounded, size: 15, color: Colors.white),
                                  label: Text(
                                    isBM ? 'Buka Downloads' : 'Open Downloads',
                                    style: const TextStyle(color: Colors.white, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: Colors.amber.shade800,
                                    padding: const EdgeInsets.symmetric(vertical: 9),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: OutlinedButton.icon(
                                  onPressed: () async {
                                    await updater.openAppSettings();
                                  },
                                  icon: const Icon(Icons.delete_outline_rounded, size: 15, color: Colors.redAccent),
                                  label: Text(
                                    isBM ? 'Nyahpasang Beta' : 'Uninstall Beta',
                                    style: const TextStyle(color: Colors.redAccent, fontSize: 11, fontWeight: FontWeight.bold),
                                  ),
                                  style: OutlinedButton.styleFrom(
                                    side: BorderSide(color: Colors.redAccent.withValues(alpha: 0.5)),
                                    padding: const EdgeInsets.symmetric(vertical: 9),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 6),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              TextButton(
                                onPressed: () {
                                  setState(() {
                                    _isDownloaded = false;
                                  });
                                },
                                child: Text(
                                  isBM ? 'Muat turun semula' : 'Re-download APK',
                                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                                ),
                              ),
                              TextButton(
                                onPressed: () async {
                                  if (_downloadedFilePath != null) {
                                    await OpenFilex.open(_downloadedFilePath!, type: 'application/vnd.android.package-archive');
                                  }
                                },
                                child: Text(
                                  isBM ? 'Pasang APK terus' : 'Install APK directly',
                                  style: TextStyle(fontSize: 11, color: colors.maroonPrimary, fontWeight: FontWeight.bold),
                                ),
                              ),
                            ],
                          ),
                        ] else ...[
                          if (_downloadError != null) ...[
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: Colors.redAccent.withValues(alpha: 0.1),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.error_outline_rounded, color: Colors.redAccent, size: 16),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      _downloadError!,
                                      style: const TextStyle(color: Colors.redAccent, fontSize: 11),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            const SizedBox(height: 8),
                          ],
                          SizedBox(
                            width: double.infinity,
                            child: OutlinedButton.icon(
                              onPressed: () async {
                                setState(() {
                                  _isDownloading = true;
                                  _downloadError = null;
                                });
                                try {
                                  final path = await updater.downloadApkFile(
                                    release: widget.stableRelease,
                                    onProgress: (p, rec, tot) {
                                      if (mounted) {
                                        setState(() {
                                          _downloadProgress = p;
                                          _downloadedMb = (rec / (1024 * 1024)).toStringAsFixed(1);
                                          _totalMb = (tot / (1024 * 1024)).toStringAsFixed(1);
                                        });
                                      }
                                    },
                                  );
                                  if (mounted) {
                                    setState(() {
                                      _isDownloading = false;
                                      _isDownloaded = true;
                                      _downloadedFilePath = path;
                                    });
                                  }
                                } catch (e) {
                                  if (mounted) {
                                    setState(() {
                                      _isDownloading = false;
                                      _downloadError = e.toString().replaceAll('Exception: ', '').replaceAll('StateError: ', '');
                                    });
                                  }
                                }
                              },
                              icon: const Icon(Icons.download_rounded, size: 16, color: Colors.amber),
                              label: Text(
                                isBM ? 'Muat Turun APK Stabil' : 'Download Stable APK',
                                style: const TextStyle(color: Colors.amber, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                              style: OutlinedButton.styleFrom(
                                side: BorderSide(color: Colors.amber.withValues(alpha: 0.5)),
                                padding: const EdgeInsets.symmetric(vertical: 10),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
