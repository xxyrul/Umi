import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'updater_service.dart';

class UpdatesScreen extends ConsumerStatefulWidget {
  const UpdatesScreen({super.key});

  @override
  ConsumerState<UpdatesScreen> createState() => _UpdatesScreenState();
}

class _UpdatesScreenState extends ConsumerState<UpdatesScreen> {
  AppThemeColors get colors => context.colors;
  bool _isChecking = true;
  ReleaseManifest? _availableRelease;
  List<ReleaseManifest> _history = [];
  double _cacheSizeMb = 0.0;

  bool _isDownloading = false;
  bool _isForceUpdate = false;
  double _downloadProgress = 0.0;
  String _downloadedMb = '0';
  String _totalMb = '0';
  String? _errorMessage;

  final Set<String> _expandedVersions = {};

  @override
  void initState() {
    super.initState();
    _loadData();
    _checkUpdate(showToast: false);
  }

  Future<void> _loadData() async {
    final updater = ref.read(updaterServiceProvider);
    final history = await updater.fetchReleaseHistory();
    final cacheMb = await updater.getCacheSizeMb();
    if (mounted) {
      setState(() {
        _history = history;
        _cacheSizeMb = cacheMb;
      });
    }
  }

  Future<void> _checkUpdate({bool showToast = true}) async {
    final isBM = ref.read(languageProvider) == 'BM';
    setState(() {
      _isChecking = true;
      _errorMessage = null;
    });

    final updater = ref.read(updaterServiceProvider);
    try {
      final manifest = await updater.checkForUpdate();
      if (!mounted) return;
      setState(() {
        _availableRelease = manifest;
        _isForceUpdate = manifest?.forceUpdate == true;
        _isChecking = false;
      });

      if (showToast && manifest == null) {
        final viewPadding = MediaQuery.of(context).viewPadding.bottom;
        ScaffoldMessenger.of(context).hideCurrentSnackBar();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            behavior: SnackBarBehavior.floating,
            backgroundColor: colors.card,
            elevation: 6,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
              side: BorderSide(color: colors.border),
            ),
            margin: EdgeInsets.only(
              bottom: 16 + viewPadding,
              left: 20,
              right: 20,
            ),
            duration: const Duration(seconds: 3),
            content: Row(
              children: [
                const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 20),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    isBM ? 'Aplikasi anda berada pada versi terkini (v2.0.0).' : 'App is up to date (v2.0.0).',
                    style: TextStyle(
                      color: colors.textPrimary,
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isChecking = false;
          _errorMessage = e.toString();
        });
      }
    }
  }

  Future<void> _startDownload() async {
    final release = _availableRelease;
    if (release == null) return;
    final isBM = ref.read(languageProvider) == 'BM';

    setState(() {
      _isDownloading = true;
      _downloadProgress = 0.0;
      _downloadedMb = '0';
      _totalMb = '0';
      _errorMessage = null;
    });

    final updater = ref.read(updaterServiceProvider);

    try {
      await updater.downloadAndInstall(
        release: release,
        onProgress: (progress, received, total) {
          if (mounted) {
            setState(() {
              _downloadProgress = progress;
              _downloadedMb = (received / (1024 * 1024)).toStringAsFixed(1);
              _totalMb = (total / (1024 * 1024)).toStringAsFixed(1);
            });
          }
        },
      );
      if (mounted) setState(() => _isDownloading = false);
    } catch (e) {
      if (mounted) {
        setState(() {
          _isDownloading = false;
          _errorMessage = isBM
              ? 'Muat turun gagal. Sila periksa sambungan internet.'
              : 'Download failed. Please check your internet connection.';
        });
      }
    }
  }

  void _cancelDownload() {
    ref.read(updaterServiceProvider).cancelDownload();
    setState(() {
      _isDownloading = false;
      _downloadProgress = 0.0;
    });
  }

  Future<void> _clearCache() async {
    final isBM = ref.read(languageProvider) == 'BM';
    await ref.read(updaterServiceProvider).clearCache();
    await _loadData();
    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isBM ? 'Storan cache telah dikosongkan.' : 'Storage cache cleared.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
        title: Text(
          isBM ? 'Kemas Kini Aplikasi' : 'App Updates',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: colors.textPrimary),
        ),
        actions: [
          IconButton(
            icon: Icon(Icons.refresh, color: colors.textPrimary),
            tooltip: isBM ? 'Semak Kemas Kini' : 'Check for Updates',
            onPressed: () => _checkUpdate(showToast: true),
          ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // 1. Status Hero Card
          _buildHeroCard(isBM),
          const SizedBox(height: 16),

          // 2. Android Permission Tip Card
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: colors.maroonPrimary.withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(Icons.lightbulb_outline, color: colors.maroonPrimary, size: 18),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        isBM ? 'Panduan Kemas Kini Android' : 'Android Install Tip',
                        style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        isBM
                            ? 'Jika diminta oleh sistem, sila benarkan "Pasang aplikasi tidak diketahui" dalam tetapan peranti anda.'
                            : 'If prompted by the system, please enable "Install unknown apps" in your device settings.',
                        style: TextStyle(color: colors.textMuted, fontSize: 12, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          // 3. Cache cleaner bar
          if (_cacheSizeMb > 0.05) ...[
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: Row(
                children: [
                  Icon(Icons.cleaning_services_outlined, size: 20, color: colors.textMuted),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Text(
                      isBM
                          ? 'Cache fail kemas kini: ${_cacheSizeMb.toStringAsFixed(1)} MB'
                          : 'Update cache files: ${_cacheSizeMb.toStringAsFixed(1)} MB',
                      style: TextStyle(color: colors.textSecondary, fontSize: 13),
                    ),
                  ),
                  TextButton(
                    onPressed: _clearCache,
                    child: Text(
                      isBM ? 'Kosongkan' : 'Clear',
                      style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 20),
          ],

          // 4. Release History Header
          Text(
            isBM ? 'Sejarah Versi & Log Perubahan' : 'Release History & Changelogs',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: colors.textPrimary,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 10),

          // 5. Version History Cards
          ..._history.map((rel) => _buildHistoryCard(rel, isBM)),
          const SizedBox(height: 40),
        ],
      ),
    );
  }

  Widget _buildHeroCard(bool isBM) {
    if (_isChecking) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: colors.border),
        ),
        child: Column(
          children: [
            CircularProgressIndicator(color: colors.maroonPrimary),
            const SizedBox(height: 16),
            Text(
              isBM ? 'Menyemak kemas kini terkini...' : 'Checking for latest updates...',
              style: TextStyle(color: colors.textSecondary, fontSize: 14),
            ),
          ],
        ),
      );
    }

    final release = _availableRelease;

    // Update Available Card
    if (release != null) {
      final actionTitle = _isForceUpdate
          ? (isBM ? 'Kemas Kini Wajib Dijalankan' : 'Mandatory Update Required')
          : (isBM ? 'Kemas Kini Tersedia! 🚀' : 'New Update Available! 🚀');

      return Container(
        padding: const EdgeInsets.all(18),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: _isForceUpdate ? Colors.orangeAccent : colors.maroonPrimary,
            width: 1.5,
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: (_isForceUpdate ? Colors.orangeAccent : colors.maroonPrimary).withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _isForceUpdate ? Icons.warning_amber_rounded : Icons.rocket_launch,
                    color: _isForceUpdate ? Colors.orangeAccent : colors.maroonPrimary,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        actionTitle,
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'v${release.versionName} (Build ${release.versionCode})',
                        style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: _isForceUpdate ? Colors.orangeAccent : colors.maroonPrimary),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),

            // Release notes
            if (release.releaseNotes.isNotEmpty) ...[
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: release.releaseNotes.map((note) {
                    return Padding(
                      padding: const EdgeInsets.only(bottom: 4),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('• ', style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold)),
                          Expanded(
                            child: Text(
                              note,
                              style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.4),
                            ),
                          ),
                        ],
                      ),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(height: 14),
            ],

            // Download Progress Bar
            if (_isDownloading) ...[
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isBM ? 'Memuat turun fail APK...' : 'Downloading APK...',
                    style: TextStyle(color: colors.textSecondary, fontSize: 12),
                  ),
                  Text(
                    '${(_downloadProgress * 100).toInt()}%',
                    style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                ],
              ),
              const SizedBox(height: 6),
              ClipRRect(
                borderRadius: BorderRadius.circular(4),
                child: LinearProgressIndicator(
                  value: _downloadProgress > 0 ? _downloadProgress : null,
                  backgroundColor: colors.surface,
                  color: colors.maroonPrimary,
                  minHeight: 6,
                ),
              ),
              const SizedBox(height: 4),
              Align(
                alignment: Alignment.centerRight,
                child: Text(
                  '$_downloadedMb MB / $_totalMb MB',
                  style: TextStyle(color: colors.textMuted, fontSize: 11),
                ),
              ),
              const SizedBox(height: 12),
            ],

            // Error message if any
            if (_errorMessage != null) ...[
              Text(_errorMessage!, style: const TextStyle(color: Colors.redAccent, fontSize: 12)),
              const SizedBox(height: 10),
            ],

            // Buttons
            Row(
              children: [
                if (!_isDownloading)
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _startDownload,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: colors.maroonPrimary,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.download, color: Colors.white, size: 18),
                          const SizedBox(width: 8),
                          Text(
                            isBM ? 'Muat Turun & Pasang' : 'Download & Install',
                            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _cancelDownload,
                      style: OutlinedButton.styleFrom(
                        side: BorderSide(color: colors.border),
                        padding: const EdgeInsets.symmetric(vertical: 14),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textSecondary)),
                    ),
                  ),
              ],
            ),
          ],
        ),
      );
    }

    // Up To Date Card
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFF10B981).withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(Icons.verified, color: Color(0xFF10B981), size: 24),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isBM ? 'Aplikasi Versi Terkini' : 'App is Up to Date',
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Artha v${ApkUpdaterService.currentVersionName} (Build ${ApkUpdaterService.currentBuildCode})',
                      style: TextStyle(fontSize: 13, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => _checkUpdate(showToast: true),
              icon: Icon(Icons.refresh, size: 16, color: colors.textPrimary),
              label: Text(
                isBM ? 'Semak Semula' : 'Check Again',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
              ),
              style: OutlinedButton.styleFrom(
                side: BorderSide(color: colors.border),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHistoryCard(ReleaseManifest rel, bool isBM) {
    final isCurrent = rel.versionName == ApkUpdaterService.currentVersionName;
    final isExpanded = _expandedVersions.contains(rel.versionName) || isCurrent;

    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: isCurrent ? colors.maroonPrimary.withValues(alpha: 0.5) : colors.border,
        ),
      ),
      child: Column(
        children: [
          InkWell(
            onTap: () {
              setState(() {
                if (_expandedVersions.contains(rel.versionName)) {
                  _expandedVersions.remove(rel.versionName);
                } else {
                  _expandedVersions.add(rel.versionName);
                }
              });
            },
            borderRadius: BorderRadius.circular(14),
            child: Padding(
              padding: const EdgeInsets.all(14),
              child: Row(
                children: [
                  Text(
                    'v${rel.versionName}',
                    style: TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: isCurrent ? colors.maroonPrimary : colors.textPrimary,
                    ),
                  ),
                  const SizedBox(width: 8),
                  if (isCurrent)
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                      decoration: BoxDecoration(
                        color: colors.maroonPrimary.withValues(alpha: 0.2),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        'CURRENT',
                        style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                      ),
                    ),
                  const Spacer(),
                  if (rel.releaseDate.isNotEmpty)
                    Text(rel.releaseDate, style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500)),
                  const SizedBox(width: 8),
                  Icon(
                    isExpanded ? Icons.keyboard_arrow_up : Icons.keyboard_arrow_down,
                    color: colors.textMuted,
                    size: 20,
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded && rel.releaseNotes.isNotEmpty) ...[
            Divider(color: colors.border, height: 1),
            Padding(
              padding: const EdgeInsets.all(14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: rel.releaseNotes.map((n) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 4),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('• ', style: TextStyle(color: colors.maroonPrimary)),
                        Expanded(
                          child: Text(n, style: TextStyle(color: colors.textSecondary, fontSize: 12, height: 1.4)),
                        ),
                      ],
                    ),
                  );
                }).toList(),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
