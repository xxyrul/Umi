import 'dart:io';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';

class ReleaseManifest {
  final String versionName;
  final int versionCode;
  final String downloadUrl;
  final int fileSizeBytes;
  final List<String> releaseNotes;
  final String releaseDate;
  final bool forceUpdate;
  final int minimumVersionCode;
  final String minimumVersionName;

  ReleaseManifest({
    required this.versionName,
    required this.versionCode,
    required this.downloadUrl,
    required this.fileSizeBytes,
    required this.releaseNotes,
    this.releaseDate = '',
    this.forceUpdate = false,
    this.minimumVersionCode = 0,
    this.minimumVersionName = '',
  });

  factory ReleaseManifest.fromJson(Map<String, dynamic> json) {
    final List<String> notes = (json['releaseNotes'] is List)
        ? (json['releaseNotes'] as List).map((e) => e.toString()).toList()
        : (json['releaseNotes'] != null ? [json['releaseNotes'].toString()] : const <String>[]);

    return ReleaseManifest(
      versionName: json['versionName'] ?? '1.0.0',
      versionCode: json['versionCode'] ?? 1,
      downloadUrl: json['downloadUrl'] ?? '',
      fileSizeBytes: json['fileSizeBytes'] ?? 0,
      releaseNotes: notes,
      releaseDate: json['releaseDate'] ?? json['date'] ?? '',
      forceUpdate: json['forceUpdate'] == true || json['requiredUpdate'] == true,
      minimumVersionCode: (json['minimumVersionCode'] is int)
          ? json['minimumVersionCode'] as int
          : 0,
      minimumVersionName: json['minimumVersionName']?.toString() ?? '',
    );
  }

  bool get hasDownloadUrl => downloadUrl.trim().isNotEmpty;

  bool get isInstallable {
    if (!hasDownloadUrl) return false;
    final uri = Uri.tryParse(downloadUrl);
    if (uri == null || uri.scheme != 'https') return false;
    if (!ApkUpdaterService.trustedHosts.contains(uri.host)) return false;
    if (!uri.path.toLowerCase().endsWith('.apk')) return false;
    return fileSizeBytes > 0;
  }
}

class ApkUpdaterService {
  static const String manifestUrl = 'https://artharen.web.app/releases/latest.json';
  static const String historyUrl = 'https://artharen.web.app/releases/history.json';
  static const List<String> trustedHosts = ['artharen.web.app', 'umiren-d6a66.web.app'];
  static const int currentBuildCode = 60; // Flutter v2.0.0 build code
  static const String currentVersionName = '2.0.0';

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Cache-Control': 'no-cache'},
  ));
  CancelToken? _cancelToken;

  int _versionStringToCode(String version) {
    final cleaned = version.replaceAll(RegExp(r'[^0-9.]'), '');
    final parts = cleaned.split('.').where((p) => p.isNotEmpty).map(int.parse).toList();
    if (parts.isEmpty) return 0;

    var code = 0;
    for (var i = 0; i < parts.length; i++) {
      code = (code * 1000) + parts[i];
    }
    return code;
  }

  bool _isNewerRelease(ReleaseManifest manifest) {
    final minRequired = manifest.minimumVersionCode > 0
        ? manifest.minimumVersionCode
        : currentBuildCode;

    if (manifest.versionCode > currentBuildCode) return true;
    if (manifest.minimumVersionCode > 0 && currentBuildCode < minRequired) return true;

    final currentVersionCode = _versionStringToCode(currentVersionName);
    final candidateVersionCode = _versionStringToCode(manifest.versionName);
    if (candidateVersionCode > currentVersionCode) return true;

    return false;
  }

  Future<ReleaseManifest?> checkForUpdate() async {
    if (kIsWeb || !Platform.isAndroid) return null;

    try {
      final response = await _dio.get(manifestUrl);

      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final manifest = ReleaseManifest.fromJson(response.data);

        if (!manifest.isInstallable) {
          debugPrint('[ApkUpdater] Invalid manifest payload or unsafe download URL');
          return null;
        }

        if (_isNewerRelease(manifest)) {
          return manifest;
        }
      }
    } catch (e) {
      debugPrint('[ApkUpdater] Check update error: $e');
    }
    return null;
  }

  Future<List<ReleaseManifest>> fetchReleaseHistory() async {
    try {
      final response = await _dio.get(
        historyUrl,
        options: Options(headers: {'Cache-Control': 'no-cache'}),
      );
      if (response.statusCode == 200 && response.data is List) {
        return (response.data as List)
            .map((item) => ReleaseManifest.fromJson(item as Map<String, dynamic>))
            .toList();
      }
    } catch (e) {
      debugPrint('[ApkUpdater] Fetch history error: $e');
    }
    // Fallback release history
    return [
      ReleaseManifest(
        versionName: '2.0.0',
        versionCode: 60,
        downloadUrl: '',
        fileSizeBytes: 0,
        releaseDate: 'Sep 2026',
        releaseNotes: [
          'Migrasi penuh ke Flutter dengan prestasi ultra pantas',
          'Enjin tema dwi-mod Cerah & Gelap dengan kontras lembut',
          'Penyegerakan gambar profil Google Account',
          'Pusat Admin 5-tab penuh & pengurusan ejen',
        ],
      ),
      ReleaseManifest(
        versionName: '1.9.5',
        versionCode: 58,
        downloadUrl: '',
        fileSizeBytes: 0,
        releaseDate: 'Aug 2026',
        releaseNotes: [
          'Sistem tapisan status kes diperkemaskan',
          'Bilik kebal dokumen muat naik pantas',
        ],
      ),
    ];
  }

  Future<double> getCacheSizeMb() async {
    try {
      final tempDir = await getTemporaryDirectory();
      int totalBytes = 0;
      final files = tempDir.listSync(followLinks: false);
      for (final f in files) {
        if (f is File && f.path.endsWith('.apk')) {
          totalBytes += f.lengthSync();
        }
      }
      return totalBytes / (1024 * 1024);
    } catch (_) {
      return 0.0;
    }
  }

  Future<void> clearCache() async {
    try {
      final tempDir = await getTemporaryDirectory();
      final files = tempDir.listSync(followLinks: false);
      for (final f in files) {
        if (f is File && f.path.endsWith('.apk')) {
          f.deleteSync();
        }
      }
    } catch (e) {
      debugPrint('[ApkUpdater] Clear cache error: $e');
    }
  }

  void cancelDownload() {
    _cancelToken?.cancel('User cancelled download');
    _cancelToken = null;
  }

  Future<void> downloadAndInstall({
    required ReleaseManifest release,
    required void Function(double progress, int received, int total) onProgress,
  }) async {
    if (!release.isInstallable) {
      throw StateError('This release is not installable. Invalid or unsafe APK URL.');
    }

    final tempDir = await getTemporaryDirectory();
    final safeVersion = release.versionName.replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
    final savePath = '${tempDir.path}/artha_${safeVersion}_${release.versionCode}.apk';
    final outputFile = File(savePath);

    if (await outputFile.exists()) {
      await outputFile.delete();
    }

    _cancelToken = CancelToken();

    await _dio.download(
      release.downloadUrl,
      savePath,
      cancelToken: _cancelToken,
      onReceiveProgress: (received, total) {
        if (total > 0) {
          final progress = received / total;
          if (progress < 0.0 || progress > 1.0) return;
          onProgress(progress, received, total);
        }
      },
    );

    final downloadedFile = File(savePath);
    if (!await downloadedFile.exists() || (await downloadedFile.length()) <= 0) {
      throw StateError('APK download did not complete successfully.');
    }

    await OpenFilex.open(savePath, type: 'application/vnd.android.package-archive');
  }
}

final updaterServiceProvider = Provider<ApkUpdaterService>((ref) => ApkUpdaterService());
