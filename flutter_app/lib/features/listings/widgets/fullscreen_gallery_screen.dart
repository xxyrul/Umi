import 'dart:io';
import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:dio/dio.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/widgets/app_toast.dart';

class FullscreenGalleryScreen extends StatefulWidget {
  final List<String> photos;
  final int initialIndex;
  final String title;

  const FullscreenGalleryScreen({
    super.key,
    required this.photos,
    this.initialIndex = 0,
    required this.title,
  });

  @override
  State<FullscreenGalleryScreen> createState() => _FullscreenGalleryScreenState();
}

class _FullscreenGalleryScreenState extends State<FullscreenGalleryScreen> {
  late PageController _pageController;
  late int _currentIndex;
  bool _isDownloading = false;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.initialIndex;
    _pageController = PageController(initialPage: widget.initialIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  Future<void> _downloadCurrentImage() async {
    if (widget.photos.isEmpty || _isDownloading) return;
    final currentUrl = widget.photos[_currentIndex];
    if (!currentUrl.startsWith('http')) {
      AppToast.info(context, 'Gambar disimpan di peranti.');
      return;
    }

    setState(() => _isDownloading = true);
    try {
      final dio = Dio();
      final dir = await getApplicationDocumentsDirectory();
      final fileName = 'artha_listing_${DateTime.now().millisecondsSinceEpoch}.jpg';
      final savePath = '${dir.path}/$fileName';

      await dio.download(currentUrl, savePath);

      if (mounted) {
        AppToast.success(context, 'Gambar berjaya dimuat turun ke dokumen.');
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Gagal memuat turun gambar: $e');
      }
    } finally {
      if (mounted) setState(() => _isDownloading = false);
    }
  }

  void _shareCurrentImage() {
    if (widget.photos.isEmpty) return;
    final currentUrl = widget.photos[_currentIndex];
    SharePlus.instance.share(ShareParams(
      text: '🏠 ${widget.title}\n$currentUrl\n_Artha Real Estate Solutions_',
    ));
  }

  @override
  Widget build(BuildContext context) {
    if (widget.photos.isEmpty) {
      return Scaffold(
        backgroundColor: Colors.black,
        appBar: AppBar(backgroundColor: Colors.black),
        body: const Center(child: Text('Tiada gambar', style: TextStyle(color: Colors.white70))),
      );
    }

    return Scaffold(
      backgroundColor: Colors.black,
      body: Stack(
        children: [
          // Photo PageView with InteractiveViewer (Pinch to zoom)
          PageView.builder(
            controller: _pageController,
            itemCount: widget.photos.length,
            onPageChanged: (idx) => setState(() => _currentIndex = idx),
            itemBuilder: (context, index) {
              final photo = widget.photos[index];
              return InteractiveViewer(
                minScale: 1.0,
                maxScale: 4.5,
                clipBehavior: Clip.none,
                child: Center(
                  child: photo.startsWith('http')
                      ? CachedNetworkImage(
                          imageUrl: photo,
                          fit: BoxFit.contain,
                          width: double.infinity,
                          placeholder: (_, __) => const Center(
                            child: CircularProgressIndicator(color: Colors.white38),
                          ),
                          errorWidget: (_, __, ___) => const Icon(
                            Icons.broken_image_outlined,
                            size: 64,
                            color: Colors.white38,
                          ),
                        )
                      : Image.file(
                          File(photo.replaceFirst('file://', '')),
                          fit: BoxFit.contain,
                          width: double.infinity,
                        ),
                ),
              );
            },
          ),

          // Top Action Bar
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back, color: Colors.white),
                      onPressed: () => Navigator.pop(context),
                    ),
                  ),
                  const SizedBox(width: 12),
                  // Counter Pill
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                    decoration: BoxDecoration(
                      color: Colors.black54,
                      borderRadius: BorderRadius.circular(20),
                    ),
                    child: Text(
                      '${_currentIndex + 1} / ${widget.photos.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 13,
                      ),
                    ),
                  ),
                  const Spacer(),
                  // Share Button
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: const Icon(Icons.share_outlined, color: Colors.white),
                      tooltip: 'Kongsi Gambar',
                      onPressed: _shareCurrentImage,
                    ),
                  ),
                  const SizedBox(width: 8),
                  // Download Button
                  Container(
                    decoration: const BoxDecoration(
                      color: Colors.black54,
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: _isDownloading
                          ? const SizedBox(
                              width: 18,
                              height: 18,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Icon(Icons.download_outlined, color: Colors.white),
                      tooltip: 'Muat Turun',
                      onPressed: _downloadCurrentImage,
                    ),
                  ),
                ],
              ),
            ),
          ),

          // Bottom Caption / Property Title
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.bottomCenter,
                  end: Alignment.topCenter,
                  colors: [Colors.black87, Colors.transparent],
                ),
              ),
              child: Text(
                widget.title,
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                ),
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
