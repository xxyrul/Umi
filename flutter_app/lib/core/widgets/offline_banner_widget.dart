import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../l10n/language_provider.dart';

final connectivityStatusProvider = StreamProvider<bool>((ref) async* {
  bool? lastStatus;

  // Emit initial check
  bool isOnline = await _checkInternet();
  yield isOnline;
  lastStatus = isOnline;

  // Poll every 8 seconds
  final timer = Stream.periodic(const Duration(seconds: 8));
  await for (final _ in timer) {
    final current = await _checkInternet();
    if (current != lastStatus) {
      lastStatus = current;
      yield current;
    }
  }
});

Future<bool> _checkInternet() async {
  try {
    final result = await InternetAddress.lookup('dns.google').timeout(const Duration(seconds: 3));
    return result.isNotEmpty && result[0].rawAddress.isNotEmpty;
  } catch (_) {
    return false;
  }
}

class OfflineBannerWidget extends ConsumerStatefulWidget {
  final Widget child;

  const OfflineBannerWidget({super.key, required this.child});

  @override
  ConsumerState<OfflineBannerWidget> createState() => _OfflineBannerWidgetState();
}

class _OfflineBannerWidgetState extends ConsumerState<OfflineBannerWidget> {
  bool _wasOffline = false;
  bool _showRestored = false;
  Timer? _restoredDismissTimer;

  @override
  void dispose() {
    _restoredDismissTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final connAsync = ref.watch(connectivityStatusProvider);
    final isBM = ref.watch(languageProvider) == 'BM';

    final isOnline = connAsync.value ?? true;

    if (!isOnline && !_wasOffline) {
      _wasOffline = true;
      _showRestored = false;
    } else if (isOnline && _wasOffline) {
      _wasOffline = false;
      _showRestored = true;
      _restoredDismissTimer?.cancel();
      _restoredDismissTimer = Timer(const Duration(seconds: 3), () {
        if (mounted) setState(() => _showRestored = false);
      });
    }

    final isOffline = !isOnline;
    final showBanner = isOffline || _showRestored;

    return Stack(
      children: [
        widget.child,

        // Animated Top Banner
        AnimatedPositioned(
          duration: const Duration(milliseconds: 350),
          curve: Curves.easeOutCubic,
          top: showBanner ? MediaQuery.of(context).padding.top + 4 : -60,
          left: 16,
          right: 16,
          child: IgnorePointer(
            child: Material(
              elevation: 4,
              borderRadius: BorderRadius.circular(12),
              color: isOffline ? const Color(0xFFD97706) : const Color(0xFF059669),
              child: Padding(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      isOffline ? Icons.wifi_off_rounded : Icons.wifi_rounded,
                      color: Colors.white,
                      size: 16,
                    ),
                    const SizedBox(width: 8),
                    Flexible(
                      child: Text(
                        isOffline
                            ? (isBM
                                ? 'Mod Luar Talian • Data disimpan secara setempat'
                                : 'Offline Mode • Changes saved locally')
                            : (isBM ? 'Sambungan Dipulihkan' : 'Connection Restored'),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                        ),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
