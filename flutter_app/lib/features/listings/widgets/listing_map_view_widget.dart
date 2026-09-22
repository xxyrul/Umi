import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:geolocator/geolocator.dart';
import 'package:go_router/go_router.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/utils/malaysian_location_detector.dart';
import '../../../core/widgets/permission_rationale_sheet.dart';
import '../listing_model.dart';

const _darkMapStyle = '''[
  {"elementType":"geometry","stylers":[{"color":"#242f3e"}]},
  {"elementType":"labels.text.fill","stylers":[{"color":"#d6d6d6"}]},
  {"elementType":"labels.text.stroke","stylers":[{"color":"#242f3e"}]},
  {"featureType":"administrative.locality","elementType":"labels.text.fill","stylers":[{"color":"#f3b6bd"}]},
  {"featureType":"poi","elementType":"geometry","stylers":[{"color":"#283646"}]},
  {"featureType":"poi.park","elementType":"geometry","stylers":[{"color":"#263c3a"}]},
  {"featureType":"road","elementType":"geometry","stylers":[{"color":"#38414e"}]},
  {"featureType":"road","elementType":"geometry.stroke","stylers":[{"color":"#212a35"}]},
  {"featureType":"road.highway","elementType":"geometry","stylers":[{"color":"#746855"}]},
  {"featureType":"transit","elementType":"geometry","stylers":[{"color":"#2f3948"}]},
  {"featureType":"water","elementType":"geometry","stylers":[{"color":"#17263c"}]}
]''';

class ListingMapViewWidget extends StatefulWidget {
  final List<ListingModel> listings;
  final bool isBM;

  const ListingMapViewWidget({
    super.key,
    required this.listings,
    required this.isBM,
  });

  @override
  State<ListingMapViewWidget> createState() => _ListingMapViewWidgetState();
}

class _ListingMapViewWidgetState extends State<ListingMapViewWidget> {
  GoogleMapController? _mapController;
  ListingModel? _selectedListing;

  bool _hasLocationPermission = false;
  bool _isLocating = false;
  MapType _currentMapType = MapType.normal;

  // Custom Airbnb Marker Cache: priceKey -> BitmapDescriptor
  final Map<String, BitmapDescriptor> _markerBitmapCache = {};
  final Map<String, LatLng> _coordsMap = {};
  final Set<String> _exactLocationIds = {};
  Set<Marker> _markers = {};
  bool _initializedMarkers = false;

  @override
  void initState() {
    super.initState();
    _checkInitialLocationPermission();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!_initializedMarkers) {
      _initializedMarkers = true;
      _generateAllMarkers();
    }
  }

  @override
  void didUpdateWidget(ListingMapViewWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    final oldIds = oldWidget.listings.map((listing) => listing.id).join('|');
    final newIds = widget.listings.map((listing) => listing.id).join('|');
    if (oldIds != newIds || oldWidget.isBM != widget.isBM) {
      _coordsMap.clear();
      _exactLocationIds.clear();
      _generateAllMarkers();
    }
  }

  Future<void> _checkInitialLocationPermission() async {
    final permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
      if (mounted) {
        setState(() => _hasLocationPermission = true);
      }
    }
  }

  String _formatCompactPrice(int price) {
    if (price >= 1000000) {
      final val = price / 1000000;
      return 'RM ${val.toStringAsFixed(val.truncateToDouble() == val ? 0 : 1)}M';
    } else if (price >= 1000) {
      return 'RM ${(price / 1000).round()}K';
    }
    return 'RM $price';
  }

  /// Generates Airbnb-style rounded price pill BitmapDescriptor
  Future<BitmapDescriptor> _createAirbnbPriceBadge({
    required String priceText,
    required bool isSelected,
    required Color primaryColor,
    required Color selectedColor,
  }) async {
    final cacheKey = '$priceText-${isSelected ? "sel" : "norm"}';
    if (_markerBitmapCache.containsKey(cacheKey)) {
      return _markerBitmapCache[cacheKey]!;
    }

    const double scale = 2.4; // High DPI for Samsung S24 Ultra sharp text
    final textPainter = TextPainter(
      text: TextSpan(
        text: priceText,
        style: TextStyle(
          color: Colors.white,
          fontSize: 12.0 * scale,
          fontWeight: FontWeight.w900,
          letterSpacing: -0.3,
        ),
      ),
      textDirection: TextDirection.ltr,
    );
    textPainter.layout();

    final double padH = 10.0 * scale;
    final double padV = 5.5 * scale;
    final double pillW = textPainter.width + (padH * 2);
    final double pillH = textPainter.height + (padV * 2);
    final double arrowH = 5.0 * scale;
    final double totalW = pillW + (8.0 * scale);
    final double totalH = pillH + arrowH + (6.0 * scale);

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);

    final pillRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(4.0 * scale, 2.0 * scale, pillW, pillH),
      Radius.circular(pillH / 2),
    );

    // 1. Drop Shadow
    final shadowPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.35)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3.0 * scale);
    canvas.drawRRect(pillRect.shift(Offset(0, 2.0 * scale)), shadowPaint);

    // 2. Pill Fill
    final bgPaint = Paint()
      ..color = isSelected ? selectedColor : primaryColor
      ..style = PaintingStyle.fill;
    canvas.drawRRect(pillRect, bgPaint);

    // 3. Pill Border
    final borderPaint = Paint()
      ..color = Colors.white
      ..style = PaintingStyle.stroke
      ..strokeWidth = isSelected ? 2.2 * scale : 1.4 * scale;
    canvas.drawRRect(pillRect, borderPaint);

    // 4. Pointer Triangle
    final arrowPath = Path();
    final centerX = totalW / 2;
    arrowPath.moveTo(centerX - (4.0 * scale), pillH + (2.0 * scale));
    arrowPath.lineTo(centerX + (4.0 * scale), pillH + (2.0 * scale));
    arrowPath.lineTo(centerX, pillH + arrowH + (2.0 * scale));
    arrowPath.close();
    canvas.drawPath(arrowPath, bgPaint);

    // 5. Price Text
    textPainter.paint(
      canvas,
      Offset(4.0 * scale + padH, 2.0 * scale + padV),
    );

    final picture = recorder.endRecording();
    final img = await picture.toImage(totalW.toInt(), totalH.toInt());
    final byteData = await img.toByteData(format: ui.ImageByteFormat.png);
    final bytes = byteData!.buffer.asUint8List();

    final descriptor = BitmapDescriptor.bytes(
      bytes,
      width: totalW / scale,
      height: totalH / scale,
    );
    _markerBitmapCache[cacheKey] = descriptor;
    return descriptor;
  }

  Future<void> _generateAllMarkers() async {
    if (!mounted) return;
    final colors = context.colors;

    // 1. Precalculate & cache coordinates once per listing
    for (int i = 0; i < widget.listings.length; i++) {
      final item = widget.listings[i];
      if (!_coordsMap.containsKey(item.id)) {
        final smart = MalaysianLocationDetector.getSmartListingCoordinates(
          exactLat: item.hasExactLocation ? item.latitude : null,
          exactLng: item.hasExactLocation ? item.longitude : null,
          address: item.address,
          title: item.title,
          state: item.state,
          id: item.id,
          index: i,
        );
        _coordsMap[item.id] = LatLng(smart.latitude, smart.longitude);
        if (smart.isExactGps) {
          _exactLocationIds.add(item.id);
        } else {
          _exactLocationIds.remove(item.id);
        }
      }
    }

    // 2. Build markers concurrently using Future.wait
    final markerList = await Future.wait(widget.listings.map((item) async {
      final isSelected = _selectedListing?.id == item.id;
      final priceLabel = _formatCompactPrice(item.price);

      final icon = await _createAirbnbPriceBadge(
        priceText: priceLabel,
        isSelected: isSelected,
        primaryColor: colors.maroonPrimary,
        selectedColor: const Color(0xFFFF385C), // Airbnb vibrant red/coral
      );

      final pos = _coordsMap[item.id] ?? const LatLng(4.8517, 100.7333);

      return Marker(
        markerId: MarkerId(item.id),
        position: pos,
        icon: icon,
        zIndex: isSelected ? 999.0 : 1.0,
        onTap: () => _selectListing(item),
      );
    }));

    if (mounted) {
      setState(() {
        _markers = markerList.toSet();
      });
    }
  }

  void _selectListing(ListingModel item) {
    if (_selectedListing?.id == item.id) {
      context.push('/listing/${item.id}', extra: item);
      return;
    }
    final oldListing = _selectedListing;
    setState(() {
      _selectedListing = item;
    });

    final pos = _coordsMap[item.id] ?? const LatLng(4.8517, 100.7333);
    _mapController?.animateCamera(CameraUpdate.newLatLng(pos));

    // Instant selective marker visual update
    _updateSelectedMarkerVisuals(oldId: oldListing?.id, newId: item.id);
  }

  void _deselectListing() {
    if (_selectedListing == null) return;
    final oldId = _selectedListing!.id;
    setState(() {
      _selectedListing = null;
    });
    _updateSelectedMarkerVisuals(oldId: oldId, newId: null);
  }

  Future<void> _updateSelectedMarkerVisuals({String? oldId, String? newId}) async {
    final colors = context.colors;
    final updated = Set<Marker>.of(_markers);

    if (oldId != null) {
      final oldItem = widget.listings.where((l) => l.id == oldId).firstOrNull;
      if (oldItem != null) {
        final pos = _coordsMap[oldId];
        if (pos != null) {
          final normIcon = await _createAirbnbPriceBadge(
            priceText: _formatCompactPrice(oldItem.price),
            isSelected: false,
            primaryColor: colors.maroonPrimary,
            selectedColor: const Color(0xFFFF385C),
          );
          updated.removeWhere((m) => m.markerId.value == oldId);
          updated.add(
            Marker(
              markerId: MarkerId(oldId),
              position: pos,
              icon: normIcon,
              zIndex: 1.0,
              onTap: () => _selectListing(oldItem),
            ),
          );
        }
      }
    }

    if (newId != null) {
      final newItem = widget.listings.where((l) => l.id == newId).firstOrNull;
      if (newItem != null) {
        final pos = _coordsMap[newId];
        if (pos != null) {
          final selIcon = await _createAirbnbPriceBadge(
            priceText: _formatCompactPrice(newItem.price),
            isSelected: true,
            primaryColor: colors.maroonPrimary,
            selectedColor: const Color(0xFFFF385C),
          );
          updated.removeWhere((m) => m.markerId.value == newId);
          updated.add(
            Marker(
              markerId: MarkerId(newId),
              position: pos,
              icon: selIcon,
              zIndex: 999.0,
              onTap: () => _selectListing(newItem),
            ),
          );
        }
      }
    }

    if (mounted) {
      setState(() {
        _markers = updated;
      });
    }
  }

  Future<void> _handleRecenter() async {
    try {
      final hasPermission = await PermissionRationaleSheet.requestLocationPermission(context, widget.isBM);
      if (!hasPermission) {
        _mapController?.animateCamera(
          CameraUpdate.newLatLngZoom(const LatLng(4.8517, 100.7333), 11.0),
        );
        return;
      }

      if (mounted) {
        setState(() {
          _hasLocationPermission = true;
          _isLocating = true;
        });
      }

      final position = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );

      final userLatLng = LatLng(position.latitude, position.longitude);
      if (mounted) {
        setState(() {
          _selectedListing = null;
        });
      }

      _mapController?.animateCamera(
        CameraUpdate.newCameraPosition(
          CameraPosition(target: userLatLng, zoom: 15.0, tilt: 25.0),
        ),
      );
    } catch (e) {
      debugPrint('[GoogleMaps] Error getting GPS position: $e');
      _mapController?.animateCamera(
        CameraUpdate.newLatLngZoom(const LatLng(4.8517, 100.7333), 11.0),
      );
    } finally {
      if (mounted) setState(() => _isLocating = false);
    }
  }

  void _toggleMapType() {
    setState(() {
      _currentMapType = _currentMapType == MapType.normal ? MapType.hybrid : MapType.normal;
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;

    // Count exact GPS vs town resolved
    final exactGpsCount = _exactLocationIds.length;
    final approximateCount = widget.listings.length - exactGpsCount;

    // Initial camera position centered on Taiping/Kamunting hub or first listing
    final initialTarget = widget.listings.isNotEmpty
      ? _resolvedInitialTarget(widget.listings.first, 0)
      : const LatLng(4.8517, 100.7333);

    return Stack(
      children: [
        // Official Google Maps View with Airbnb Price Badges
        GoogleMap(
          initialCameraPosition: CameraPosition(
            target: initialTarget,
            zoom: 12.5,
          ),
          mapType: _currentMapType,
          style: colors.isDark ? _darkMapStyle : null,
          markers: _markers,
          myLocationEnabled: _hasLocationPermission,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          compassEnabled: true,
          mapToolbarEnabled: false,
          buildingsEnabled: true,
          trafficEnabled: false,
          onMapCreated: (controller) {
            _mapController = controller;
          },
          onTap: (_) {
            if (_selectedListing != null) {
              _deselectListing();
            }
          },
        ),

        // Status Header: Shows all 44 listings mapped!
        Positioned(
          top: 14,
          left: 16,
          right: 120,
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: colors.card.withValues(alpha: 0.94),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.2),
                  blurRadius: 6,
                ),
              ],
            ),
            child: Row(
              children: [
                const Icon(
                  Icons.verified_outlined,
                  size: 16,
                  color: Color(0xFF10B981),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    isBM
                        ? '${widget.listings.length} listing dipetakan ($exactGpsCount GPS tepat, $approximateCount anggaran)'
                        : '${widget.listings.length} listings mapped ($exactGpsCount exact GPS, $approximateCount approximate)',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: colors.textPrimary,
                    ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          ),
        ),

        // Floating Action Controls: Layer Toggle & Recenter
        Positioned(
          top: 14,
          right: 16,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Satellite / Hybrid Layer Toggle
              FloatingActionButton.small(
                heroTag: 'map_layer_toggle',
                backgroundColor: colors.card,
                foregroundColor: _currentMapType == MapType.hybrid ? colors.maroonPrimary : colors.textPrimary,
                elevation: 4,
                onPressed: _toggleMapType,
                tooltip: _currentMapType == MapType.hybrid ? 'Normal Map' : 'Satellite Map',
                child: Icon(
                  _currentMapType == MapType.hybrid ? Icons.layers : Icons.layers_outlined,
                  size: 20,
                ),
              ),
              const SizedBox(height: 10),
              // Recenter GPS Button
              FloatingActionButton.small(
                heroTag: 'map_recenter',
                backgroundColor: colors.card,
                foregroundColor: colors.maroonPrimary,
                elevation: 4,
                onPressed: _isLocating ? null : _handleRecenter,
                tooltip: isBM ? 'Lokasi Saya' : 'My Location',
                child: _isLocating
                    ? SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2, color: colors.maroonPrimary),
                      )
                    : const Icon(Icons.my_location, size: 20),
              ),
            ],
          ),
        ),

        // Selected Listing Floating Preview Card (Positioned safely above bottom navigation bar, with Close button)
        if (_selectedListing != null)
          Positioned(
            bottom: 92,
            left: 16,
            right: 16,
            child: GestureDetector(
              onTap: () {
                context.push('/listing/${_selectedListing!.id}', extra: _selectedListing);
              },
              child: Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: colors.border),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.32),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Row(
                  children: [
                    // Thumbnail
                    ClipRRect(
                      borderRadius: BorderRadius.circular(10),
                      child: SizedBox(
                        width: 76,
                        height: 76,
                        child: _selectedListing!.photos.isNotEmpty &&
                                _selectedListing!.photos.first.startsWith('http')
                            ? CachedNetworkImage(
                                imageUrl: _selectedListing!.photos.first,
                                fit: BoxFit.cover,
                                memCacheWidth: 200,
                                memCacheHeight: 200,
                                placeholder: (_, __) => Container(color: colors.surface),
                                errorWidget: (_, __, ___) => Icon(Icons.home, color: colors.textDim),
                              )
                            : Container(
                                color: colors.surface,
                                child: Icon(Icons.home, color: colors.textDim),
                              ),
                      ),
                    ),
                    const SizedBox(width: 12),

                    // Content
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Text(
                            _selectedListing!.title,
                            style: TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.bold,
                              color: colors.textPrimary,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          const SizedBox(height: 3),
                          Text(
                            CurrencyFormatter.format(_selectedListing!.price),
                            style: TextStyle(
                              fontSize: 16,
                              fontWeight: FontWeight.w900,
                              color: colors.maroonPrimary,
                            ),
                          ),
                          const SizedBox(height: 3),
                          Row(
                            children: [
                              Icon(Icons.bed_outlined, size: 14, color: colors.textMuted),
                              const SizedBox(width: 3),
                              Text('${_selectedListing!.bedrooms}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
                              const SizedBox(width: 10),
                              Icon(Icons.shower_outlined, size: 14, color: colors.textMuted),
                              const SizedBox(width: 3),
                              Text('${_selectedListing!.bathrooms}', style: TextStyle(fontSize: 12, color: colors.textMuted)),
                              const Spacer(),
                              Text(
                                isBM ? 'Lihat ➔' : 'View ➔',
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                  color: colors.maroonPrimary,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                    // Close button
                    IconButton(
                      icon: Icon(Icons.close, size: 18, color: colors.textMuted),
                      onPressed: () {
                        setState(() => _selectedListing = null);
                        _generateAllMarkers();
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
      ],
    );
  }

  LatLng _resolvedInitialTarget(ListingModel listing, int index) {
    final smart = MalaysianLocationDetector.getSmartListingCoordinates(
      exactLat: listing.hasExactLocation ? listing.latitude : null,
      exactLng: listing.hasExactLocation ? listing.longitude : null,
      address: listing.address,
      title: listing.title,
      state: listing.state,
      id: listing.id,
      index: index,
    );
    return LatLng(smart.latitude, smart.longitude);
  }
}
