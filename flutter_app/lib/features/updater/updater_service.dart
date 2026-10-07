import 'dart:io';
import 'package:android_intent_plus/android_intent.dart';
import 'package:android_intent_plus/flag.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:open_filex/open_filex.dart';
import 'package:path_provider/path_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:url_launcher/url_launcher.dart';

enum UpdateChannel {
  stable,
  beta,
}

const String _kUpdateChannelKey = '@update_channel_preference';

class UpdateChannelNotifier extends StateNotifier<UpdateChannel> {
  UpdateChannelNotifier() : super(UpdateChannel.stable) {
    _load();
  }

  Future<void> _load() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final saved = prefs.getString(_kUpdateChannelKey);
      if (saved == 'beta') {
        state = UpdateChannel.beta;
        FirebaseMessaging.instance.subscribeToTopic('beta_testers').catchError((_) {});
      } else {
        state = UpdateChannel.stable;
        FirebaseMessaging.instance.unsubscribeFromTopic('beta_testers').catchError((_) {});
      }
    } catch (_) {}
  }

  Future<void> setChannel(UpdateChannel channel) async {
    state = channel;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_kUpdateChannelKey, channel == UpdateChannel.beta ? 'beta' : 'stable');

      // Sync FCM topic subscription for beta-exclusive notifications
      if (channel == UpdateChannel.beta) {
        await FirebaseMessaging.instance.subscribeToTopic('beta_testers');
      } else {
        await FirebaseMessaging.instance.unsubscribeFromTopic('beta_testers');
      }

      // Sync user profile in Firestore for Admin Hub & Web Admin visibility
      final currentUser = FirebaseAuth.instance.currentUser;
      if (currentUser != null) {
        await FirebaseFirestore.instance.collection('users').doc(currentUser.uid).set({
          'updateChannel': channel == UpdateChannel.beta ? 'BETA' : 'STABLE',
          'channel': channel == UpdateChannel.beta ? 'BETA' : 'STABLE',
          'channelUpdatedAt': FieldValue.serverTimestamp(),
        }, SetOptions(merge: true)).catchError((_) {});
      }
    } catch (_) {}
  }
}

final updateChannelProvider =
    StateNotifierProvider<UpdateChannelNotifier, UpdateChannel>((ref) {
  return UpdateChannelNotifier();
});

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
  final String channel; // 'stable' or 'beta'

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
    this.channel = 'stable',
  });

  factory ReleaseManifest.fromJson(Map<String, dynamic> json) {
    final List<String> notes = (json['releaseNotes'] is List)
        ? (json['releaseNotes'] as List).map((e) => e.toString()).toList()
        : (json['releaseNotes'] != null ? [json['releaseNotes'].toString()] : const <String>[]);

    final rawChannel = json['channel']?.toString().toLowerCase() ??
        (json['versionName']?.toString().toLowerCase().contains('beta') == true ? 'beta' : 'stable');

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
      channel: rawChannel,
    );
  }

  static ReleaseManifest? fromGithubRelease(Map<String, dynamic> releaseJson) {
    try {
      final tagName = (releaseJson['tag_name'] ?? '').toString();
      final cleanVersion = tagName.replaceFirst(RegExp(r'^[vV]'), '').trim();
      if (cleanVersion.isEmpty) return null;

      final isPreRelease = releaseJson['prerelease'] == true ||
          tagName.toLowerCase().contains('beta');
      final channel = isPreRelease ? 'beta' : 'stable';

      final assets = releaseJson['assets'];
      Map<String, dynamic>? apkAsset;
      if (assets is List) {
        for (final a in assets) {
          if (a is Map<String, dynamic>) {
            final name = (a['name'] ?? '').toString().toLowerCase();
            if (name.endsWith('.apk')) {
              apkAsset = a;
              break;
            }
          }
        }
      }

      if (apkAsset == null) return null;

      final downloadUrl = (apkAsset['browser_download_url'] ?? '').toString();
      final sizeBytes = (apkAsset['size'] is int) ? apkAsset['size'] as int : 0;

      final body = (releaseJson['body'] ?? '').toString();
      final List<String> notes = [];
      if (body.isNotEmpty) {
        for (final line in body.split('\n')) {
          final trimmed = line.trim();
          if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            notes.add(trimmed.substring(2).trim());
          } else if (trimmed.isNotEmpty && !trimmed.startsWith('#')) {
            notes.add(trimmed);
          }
        }
      }
      if (notes.isEmpty) {
        notes.add('Keluaran $cleanVersion di GitHub');
      }

      final publishedAt =
          (releaseJson['published_at'] ?? releaseJson['created_at'] ?? '').toString();

      return ReleaseManifest(
        versionName: cleanVersion,
        versionCode: ApkUpdaterService.versionStringToCode(cleanVersion),
        downloadUrl: downloadUrl,
        fileSizeBytes: sizeBytes,
        releaseNotes: notes,
        releaseDate: publishedAt.length >= 10 ? publishedAt.substring(0, 10) : publishedAt,
        channel: channel,
      );
    } catch (e) {
      debugPrint('[ApkUpdater] Failed to parse GitHub release: $e');
      return null;
    }
  }

  bool get isBeta => channel.toLowerCase() == 'beta' || versionName.toLowerCase().contains('beta');

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
  static const String githubRepo = 'xxyrul/Umi';
  static const String githubReleasesUrl = 'https://api.github.com/repos/xxyrul/Umi/releases';
  static const String githubLatestReleaseUrl = 'https://api.github.com/repos/xxyrul/Umi/releases/latest';

  static const String stableManifestUrl = 'https://artharen.web.app/releases/latest.json';
  static const String betaManifestUrl = 'https://artharen.web.app/releases/beta.json';
  static const String historyUrl = 'https://artharen.web.app/releases/history.json';
  static const List<String> trustedHosts = [
    'artharen.web.app',
    'umiren-d6a66.web.app',
    'github.com',
    'objects.githubusercontent.com',
    'api.github.com',
  ];
  static const int currentBuildCode = 60; // Flutter v2.0.0 build code
  static const String currentVersionName = '2.0.0';

  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 15),
    receiveTimeout: const Duration(seconds: 30),
    headers: {'Cache-Control': 'no-cache'},
  ));
  CancelToken? _cancelToken;

  String getManifestUrl(UpdateChannel channel) {
    return channel == UpdateChannel.beta ? betaManifestUrl : stableManifestUrl;
  }

  static int versionStringToCode(String version) {
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

    final currentVersionCode = versionStringToCode(currentVersionName);
    final candidateVersionCode = versionStringToCode(manifest.versionName);
    if (candidateVersionCode > currentVersionCode) return true;

    return false;
  }

  Future<ReleaseManifest?> checkForUpdate({UpdateChannel channel = UpdateChannel.stable}) async {
    if (kIsWeb || !Platform.isAndroid) return null;

    // 1. Check GitHub Releases first (LoanCalc architecture)
    try {
      final response = await _dio.get(
        githubReleasesUrl,
        options: Options(
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Umi-App',
          },
        ),
      );

      if (response.statusCode == 200 && response.data is List) {
        final releases = (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map(ReleaseManifest.fromGithubRelease)
            .whereType<ReleaseManifest>()
            .toList();

        if (releases.isNotEmpty) {
          ReleaseManifest? targetRelease;
          if (channel == UpdateChannel.stable) {
            targetRelease = releases.firstWhere(
              (r) => !r.isBeta,
              orElse: () => releases.first,
            );
          } else {
            targetRelease = releases.firstWhere(
              (r) => r.isBeta,
              orElse: () => releases.first,
            );
          }

          if (targetRelease.isInstallable && _isNewerRelease(targetRelease)) {
            return targetRelease;
          }
        }
      }
    } catch (e) {
      debugPrint('[ApkUpdater] GitHub check error: $e. Falling back to Firebase manifest.');
    }

    // 2. Fallback to Firebase Hosting manifest
    try {
      final targetUrl = getManifestUrl(channel);
      final response = await _dio.get(targetUrl);

      if (response.statusCode == 200 && response.data is Map<String, dynamic>) {
        final manifest = ReleaseManifest.fromJson(response.data);

        if (!manifest.isInstallable) {
          debugPrint('[ApkUpdater] Invalid manifest payload or unsafe download URL: $targetUrl');
          return null;
        }

        if (_isNewerRelease(manifest)) {
          return manifest;
        }
      }
    } catch (e) {
      debugPrint('[ApkUpdater] Check update error for channel $channel: $e');
    }
    return null;
  }

  Future<List<ReleaseManifest>> fetchReleaseHistory({UpdateChannel channel = UpdateChannel.stable}) async {
    // 1. Try GitHub Releases history first
    try {
      final response = await _dio.get(
        githubReleasesUrl,
        options: Options(
          headers: {
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'Umi-App',
          },
        ),
      );

      if (response.statusCode == 200 && response.data is List) {
        final gitReleases = (response.data as List)
            .whereType<Map<String, dynamic>>()
            .map(ReleaseManifest.fromGithubRelease)
            .whereType<ReleaseManifest>()
            .toList();

        if (gitReleases.isNotEmpty) {
          if (channel == UpdateChannel.stable) {
            return gitReleases.where((r) => !r.isBeta).toList();
          }
          return gitReleases;
        }
      }
    } catch (e) {
      debugPrint('[ApkUpdater] GitHub history error: $e');
    }

    // 2. Fallback to Firebase Hosting history
    try {
      final response = await _dio.get(
        historyUrl,
        options: Options(headers: {'Cache-Control': 'no-cache'}),
      );
      if (response.statusCode == 200 && response.data is List) {
        final all = (response.data as List)
            .map((item) => ReleaseManifest.fromJson(item as Map<String, dynamic>))
            .toList();
        if (channel == UpdateChannel.stable) {
          return all.where((r) => !r.isBeta).toList();
        }
        return all;
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
        releaseDate: '2026-10-07',
        channel: 'stable',
        releaseNotes: [
          'Dibina semula dari awal. Aplikasi buka lebih laju dan skrol lebih lancar.',
          'Pilih kemas kini Stabil atau Beta di halaman Kemas Kini.',
          'Kemas kini aplikasi kini dimuat turun dari GitHub, lebih boleh dipercayai.',
          'Dokumen yang dimuat naik pada listing kini peribadi. Hanya pemilik boleh buka.',
          'Pembetulan keselamatan pada kelulusan akaun dan notifikasi.',
        ],
      ),
      ReleaseManifest(
        versionName: '1.6.1',
        versionCode: 59,
        downloadUrl: '',
        fileSizeBytes: 0,
        releaseDate: '2026-09-16',
        channel: 'stable',
        releaseNotes: [
          'Papan keyboard Android tidak lagi menutup ruang deskripsi dan butang Seterusnya.',
          'Kalkulator Pinjaman LPPSA untuk penjawat awam.',
          'Kit kongsi Co-Broke melalui WhatsApp.',
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

  Future<String?> getDownloadedApkPath(ReleaseManifest release) async {
    try {
      final safeVersion = release.versionName.replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
      final fileName = 'artha_${safeVersion}_${release.channel}_${release.versionCode}.apk';

      final candidates = <String>[
        '/storage/emulated/0/Download/$fileName',
        '${(await getTemporaryDirectory()).path}/$fileName',
      ];

      for (final p in candidates) {
        final f = File(p);
        if (await f.exists() && (await f.length()) > 1000000) {
          final headerBytes = await f.openRead(0, 4).first;
          if (headerBytes.length >= 2 && headerBytes[0] == 0x50 && headerBytes[1] == 0x4B) {
            return p;
          }
        }
      }
    } catch (_) {}
    return null;
  }

  Future<String> downloadApkFile({
    required ReleaseManifest release,
    required void Function(double progress, int received, int total) onProgress,
  }) async {
    if (!release.isInstallable) {
      throw StateError('This release is not installable. Invalid or unsafe APK URL.');
    }

    String saveDir = (await getTemporaryDirectory()).path;
    try {
      final pubDownloads = Directory('/storage/emulated/0/Download');
      if (pubDownloads.existsSync()) {
        saveDir = pubDownloads.path;
      }
    } catch (_) {}

    final safeVersion = release.versionName.replaceAll(RegExp(r'[^a-zA-Z0-9_.-]'), '_');
    final savePath = '$saveDir/artha_${safeVersion}_${release.channel}_${release.versionCode}.apk';
    final outputFile = File(savePath);

    try {
      if (await outputFile.exists()) {
        await outputFile.delete();
      }
    } catch (_) {}

    final candidateUrls = <String>[
      release.downloadUrl,
      if (release.downloadUrl.contains('artharen.web.app'))
        release.downloadUrl.replaceAll('artharen.web.app', 'umiren-d6a66.web.app'),
      'https://umiren-d6a66.web.app/releases/artha.apk',
      'https://umiren-d6a66.web.app/releases/artha-latest.apk',
    ];

    String? lastError;
    for (final url in candidateUrls) {
      try {
        _cancelToken = CancelToken();
        await _dio.download(
          url,
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
        if (await downloadedFile.exists() && (await downloadedFile.length()) > 1000000) {
          // Verify zip magic bytes: PK (0x50, 0x4B)
          final headerBytes = await downloadedFile.openRead(0, 4).first;
          if (headerBytes.length >= 2 && headerBytes[0] == 0x50 && headerBytes[1] == 0x4B) {
            return savePath; // Valid APK binary found!
          }
        }
        // If not a valid APK binary, delete and try next candidate
        try {
          if (await downloadedFile.exists()) await downloadedFile.delete();
        } catch (_) {}
      } catch (e) {
        lastError = e.toString();
        try {
          final f = File(savePath);
          if (await f.exists()) await f.delete();
        } catch (_) {}
      }
    }

    throw StateError(
      lastError ?? 'The server returned an invalid file. Please use the Web Download Portal to download directly.',
    );
  }

  Future<void> downloadAndInstall({
    required ReleaseManifest release,
    required void Function(double progress, int received, int total) onProgress,
  }) async {
    final savePath = await downloadApkFile(release: release, onProgress: onProgress);
    await OpenFilex.open(savePath, type: 'application/vnd.android.package-archive');
  }

  Future<void> openWebPortal() async {
    final uri = Uri.parse('https://github.com/xxyrul/Umi/releases');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    } else {
      final fallbackUri = Uri.parse('https://artharen.web.app/');
      if (await canLaunchUrl(fallbackUri)) {
        await launchUrl(fallbackUri, mode: LaunchMode.externalApplication);
      }
    }
  }

  Future<void> openAppSettings() async {
    try {
      final intent = AndroidIntent(
        action: 'android.settings.APPLICATION_DETAILS_SETTINGS',
        data: 'package:com.umi.caseflow',
        flags: const [Flag.FLAG_ACTIVITY_NEW_TASK],
      );
      await intent.launch();
    } catch (_) {
      try {
        final fallback = AndroidIntent(
          action: 'android.intent.action.DELETE',
          data: 'package:com.umi.caseflow',
          flags: const [Flag.FLAG_ACTIVITY_NEW_TASK],
        );
        await fallback.launch();
      } catch (_) {}
    }
  }

  Future<void> openDownloadsFolder({String? fallbackFilePath}) async {
    try {
      final intent = const AndroidIntent(
        action: 'android.intent.action.VIEW_DOWNLOADS',
        flags: [Flag.FLAG_ACTIVITY_NEW_TASK],
      );
      await intent.launch();
    } catch (_) {
      try {
        final fallback = const AndroidIntent(
          action: 'android.intent.action.VIEW',
          data: 'content://downloads/my_downloads',
          flags: [Flag.FLAG_ACTIVITY_NEW_TASK],
        );
        await fallback.launch();
      } catch (_) {
        if (fallbackFilePath != null) {
          try {
            await OpenFilex.open(fallbackFilePath);
          } catch (_) {}
        }
      }
    }
  }
}

final updaterServiceProvider = Provider<ApkUpdaterService>((ref) => ApkUpdaterService());
