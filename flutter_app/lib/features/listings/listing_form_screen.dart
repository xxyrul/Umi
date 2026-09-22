import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_storage/firebase_storage.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/malaysian_location_detector.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/interactive_back_button.dart';
import '../../core/widgets/permission_rationale_sheet.dart';
import 'package:geolocator/geolocator.dart';
import '../auth/auth_service.dart';
import 'listing_model.dart';
import 'listing_repository.dart';

class ListingFormScreen extends ConsumerStatefulWidget {
  final String? editListingId;

  const ListingFormScreen({super.key, this.editListingId});

  @override
  ConsumerState<ListingFormScreen> createState() => _ListingFormScreenState();
}

class _ListingFormScreenState extends ConsumerState<ListingFormScreen> {
  int _currentStep = 0; // 0: Basic Info, 1: Location & Specs, 2: Media & Description

  // Form Controllers
  final _titleController = TextEditingController();
  final _priceController = TextEditingController();
  final _addressController = TextEditingController();
  final _sizeController = TextEditingController();
  final _descriptionController = TextEditingController();

  String _propertyType = 'Residential / Terrace';
  String _tenure = 'Freehold';
  String _lotStatus = 'Non-Bumi Lot';
  String _state = 'Selangor';
  String _status = 'Aktif';
  int _bedrooms = 3;
  int _bathrooms = 2;
  double? _latitude;
  double? _longitude;
  String _locationAccuracy = 'unknown';

  final List<String> _existingPhotoUrls = [];
  final List<XFile> _newPhotoFiles = [];
  bool _isLoading = false;
  bool _isInitLoading = false;
  bool _isLocatingGps = false;
  ListingModel? _existingListing;

  Future<void> _captureCurrentGpsLocation(bool isBM) async {
    final hasPerm = await PermissionRationaleSheet.requestLocationPermission(context, isBM);
    if (!hasPerm) return;

    setState(() => _isLocatingGps = true);
    try {
      final pos = await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(accuracy: LocationAccuracy.high, timeLimit: Duration(seconds: 10)),
      );
      setState(() {
        _latitude = pos.latitude;
        _longitude = pos.longitude;
        _locationAccuracy = 'exact';
      });
      if (mounted) {
        AppToast.success(
          context,
          isBM
              ? 'GPS tepat diperoleh: ${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}'
              : 'Precise GPS captured: ${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}',
        );
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, isBM ? 'Gagal membaca GPS: $e' : 'Failed to read GPS: $e');
      }
    } finally {
      if (mounted) setState(() => _isLocatingGps = false);
    }
  }

  Timer? _debounceLocationTimer;

  void _onAddressChanged(String text) {
    _debounceLocationTimer?.cancel();
    _debounceLocationTimer = Timer(const Duration(milliseconds: 600), () {
      if (!mounted) return;
      _detectLocationFromText(text, showToast: false);
    });
  }

  void _detectLocationFromText(String text, {bool showToast = true}) {
    if (text.trim().isEmpty) return;
    final result = MalaysianLocationDetector.analyze(text);
    final isBM = ref.read(languageProvider) == 'BM';

    if (result.state != null && malaysianStates.contains(result.state)) {
      setState(() {
        _state = result.state!;
        if (result.hasCoordinates) {
          _latitude = result.latitude;
          _longitude = result.longitude;
          _locationAccuracy = 'exact';
        } else {
          _locationAccuracy = 'approximate';
        }
      });
      if (showToast && mounted) {
        AppToast.success(
          context,
          isBM
              ? 'Lokasi dikesan: $_state ${result.hasCoordinates ? "(${result.latitude!.toStringAsFixed(4)}, ${result.longitude!.toStringAsFixed(4)})" : ""}'
              : 'Location detected: $_state ${result.hasCoordinates ? "(${result.latitude!.toStringAsFixed(4)}, ${result.longitude!.toStringAsFixed(4)})" : ""}',
        );
      }
    } else if (result.hasCoordinates) {
      setState(() {
        _latitude = result.latitude;
        _longitude = result.longitude;
        _locationAccuracy = 'exact';
      });
      if (showToast && mounted) {
        AppToast.success(
          context,
          'Koordinat GPS dikesan: ${result.latitude!.toStringAsFixed(4)}, ${result.longitude!.toStringAsFixed(4)}',
        );
      }
    }
  }

  static const List<Map<String, String>> propertyTypesMap = [
    {'val': 'Residential / Terrace', 'en': 'Residential / Terrace', 'bm': 'Kediaman / Teres'},
    {'val': 'Condominium / Apartment', 'en': 'Condo / Apartment', 'bm': 'Kondominium / Pangsapuri'},
    {'val': 'Bungalow / Semi-D', 'en': 'Bungalow / Semi-D', 'bm': 'Banglo / Semi-D'},
    {'val': 'Commercial / Shoplot', 'en': 'Commercial / Shoplot', 'bm': 'Komersial / Rumah Kedai'},
    {'val': 'Factory / Warehouse', 'en': 'Factory / Warehouse', 'bm': 'Kilang / Gudang'},
    {'val': 'Agricultural Land', 'en': 'Agricultural Land', 'bm': 'Tanah Pertanian'},
  ];

  static const List<String> malaysianStates = [
    'Selangor',
    'Kuala Lumpur',
    'Putrajaya',
    'Johor',
    'Penang',
    'Perak',
    'Kedah',
    'Negeri Sembilan',
    'Melaka',
    'Pahang',
    'Kelantan',
    'Terengganu',
    'Perlis',
    'Sabah',
    'Sarawak',
  ];

  @override
  void initState() {
    super.initState();
    if (widget.editListingId != null && widget.editListingId!.isNotEmpty) {
      _loadListing(widget.editListingId!);
    }
  }

  Future<void> _loadListing(String id) async {
    setState(() => _isInitLoading = true);
    try {
      final item = await ref.read(listingRepositoryProvider).getListingById(id);
      if (item != null && mounted) {
        _existingListing = item;
        _titleController.text = item.title;
        _priceController.text = item.price > 0 ? item.price.toString() : '';
        _addressController.text = item.address;
        _sizeController.text = item.size;
        _descriptionController.text = item.description;
        _propertyType = item.propertyType;
        _tenure = item.tenure;
        _lotStatus = item.lotStatus;
        _state = item.state;
        _status = item.status;
        _bedrooms = item.bedrooms;
        _bathrooms = item.bathrooms;
        _latitude = item.latitude;
        _longitude = item.longitude;
        _locationAccuracy = item.locationAccuracy;
        _existingPhotoUrls.addAll(item.photos);
      }
    } catch (e) {
      debugPrint('Error loading listing: $e');
    } finally {
      if (mounted) setState(() => _isInitLoading = false);
    }
  }

  @override
  void dispose() {
    _debounceLocationTimer?.cancel();
    _titleController.dispose();
    _priceController.dispose();
    _addressController.dispose();
    _sizeController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  Future<void> _pickPhotos() async {
    final picker = ImagePicker();
    final picked = await picker.pickMultiImage(imageQuality: 80);
    if (picked.isNotEmpty) {
      setState(() {
        _newPhotoFiles.addAll(picked);
      });
    }
  }

  Future<void> _submitForm() async {
    final isBM = ref.read(languageProvider) == 'BM';

    if (_titleController.text.trim().isEmpty || _priceController.text.trim().isEmpty) {
      AppToast.error(
        context,
        isBM ? 'Sila masukkan tajuk dan harga hartanah.' : 'Please enter property title and price.',
      );
      return;
    }

    final user = ref.read(authStateProvider).value;
    final userProfile = ref.read(currentUserProfileProvider).value;
    if (user == null) {
      AppToast.error(
        context,
        isBM ? 'Sila log masuk semula.' : 'Please sign in again.',
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final rawPrice = _priceController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final price = int.tryParse(rawPrice) ?? 0;

      final listingId = widget.editListingId ?? FirebaseFirestore.instance.collection('listings').doc().id;

      await FirebaseFirestore.instance.collection('listings').doc(listingId).set({
        'userId': user.uid,
        'agentId': user.uid,
        'status': _status,
        'createdAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      final uploadedUrls = <String>[..._existingPhotoUrls];
      for (int i = 0; i < _newPhotoFiles.length; i++) {
        final file = _newPhotoFiles[i];
        try {
          final ext = file.path.split('.').last.toLowerCase();
          final fileName = 'gambar_${i}_${DateTime.now().millisecondsSinceEpoch}.$ext';
          final refStorage = FirebaseStorage.instance.ref().child('listings').child(listingId).child(fileName);
          final uploadTask = await refStorage.putFile(File(file.path));
          final url = await uploadTask.ref.getDownloadURL();
          uploadedUrls.add(url);
        } catch (e) {
          debugPrint('Upload photo error: $e');
        }
      }

      final listingData = ListingModel(
        id: listingId,
        title: _titleController.text.trim(),
        price: price,
        address: _addressController.text.trim(),
        state: _state,
        propertyType: _propertyType,
        bedrooms: _bedrooms,
        bathrooms: _bathrooms,
        size: _sizeController.text.trim(),
        tenure: _tenure,
        lotStatus: _lotStatus,
        status: _status,
        photos: uploadedUrls,
        description: _descriptionController.text.trim(),
        agentId: user.uid,
        userId: user.uid,
        agentName: userProfile?.displayName ?? user.displayName ?? 'Agent',
        agentPhone: userProfile?.phoneNumber ?? '',
        createdAt: _existingListing?.createdAt ?? DateTime.now(),
        updatedAt: DateTime.now(),
        latitude: _latitude,
        longitude: _longitude,
        locationAccuracy: _locationAccuracy,
        documents: _existingListing?.documents ?? const {},
      );

      if (widget.editListingId != null) {
        await ref.read(listingRepositoryProvider).updateListing(
          listingId,
          listingData.toMap(),
        );
        if (mounted) {
          AppToast.success(
            context,
            isBM ? 'Listing berjaya dikemaskini!' : 'Listing updated successfully!',
          );
          Navigator.pop(context);
        }
      } else {
        await ref.read(listingRepositoryProvider).createListing(listingData);
        if (mounted) {
          AppToast.success(
            context,
            isBM ? 'Listing hartanah berjaya didaftarkan!' : 'Property listing created successfully!',
          );
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat mendaftar listing: $e' : 'Error saving listing: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  InputDecoration _inputDecor({
    required String label,
    String? hint,
    required AppThemeColors colors,
  }) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: colors.surface,
      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
      hintStyle: TextStyle(color: colors.textDim, fontSize: 13),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: AppColors.maroonPrimary, width: 1.5),
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  Widget _buildStep1BasicInfo(bool isBM, AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _titleController,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(
            label: isBM ? 'Tajuk Hartanah *' : 'Property Title *',
            hint: isBM ? 'Contoh: Teres 2 Tingkat Seksyen 7 Shah Alam' : 'E.g.: 2-Storey Terrace Seksyen 7 Shah Alam',
            colors: colors,
          ),
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _priceController,
          keyboardType: TextInputType.number,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(
            label: isBM ? 'Harga Jualan (RM) *' : 'Selling Price (RM) *',
            hint: isBM ? 'Contoh: 580000' : 'E.g.: 580000',
            colors: colors,
          ),
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          value: propertyTypesMap.any((m) => m['val'] == _propertyType) ? _propertyType : propertyTypesMap.first['val'],
          dropdownColor: colors.surface,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(label: isBM ? 'Jenis Hartanah' : 'Property Type', colors: colors),
          items: propertyTypesMap.map((t) => DropdownMenuItem(
            value: t['val'],
            child: Text(isBM ? t['bm']! : t['en']!),
          )).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _propertyType = val);
          },
        ),
        const SizedBox(height: 14),
        Row(
          children: [
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _tenure,
                dropdownColor: colors.surface,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(label: isBM ? 'Pegangan' : 'Tenure', colors: colors),
                items: ['Freehold', 'Leasehold'].map((t) => DropdownMenuItem(
                  value: t,
                  child: Text(t),
                )).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _tenure = val);
                },
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: DropdownButtonFormField<String>(
                value: _lotStatus,
                dropdownColor: colors.surface,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(label: isBM ? 'Status Lot' : 'Lot Status', colors: colors),
                items: [
                  {'val': 'Bumi Lot', 'label': 'Bumi Lot'},
                  {'val': 'Non-Bumi Lot', 'label': 'Non-Bumi Lot'},
                  {'val': 'Malay Reserved', 'label': isBM ? 'Rizab Melayu' : 'Malay Reserved'},
                ].map((l) => DropdownMenuItem(
                  value: l['val'],
                  child: Text(l['label']!),
                )).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _lotStatus = val);
                },
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        DropdownButtonFormField<String>(
          value: _status,
          dropdownColor: colors.surface,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(label: isBM ? 'Status Listing' : 'Listing Status', colors: colors),
          items: [
            {'val': 'Aktif', 'label': isBM ? 'Aktif' : 'Active'},
            {'val': 'Booking', 'label': 'Booking'},
            {'val': 'Draft', 'label': 'Draft'},
          ].map((s) => DropdownMenuItem(
            value: s['val'],
            child: Text(s['label']!),
          )).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _status = val);
          },
        ),
      ],
    );
  }

  Widget _buildStep2LocationSpecs(bool isBM, AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DropdownButtonFormField<String>(
          value: _state,
          dropdownColor: colors.surface,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(label: isBM ? 'Negeri / Wilayah *' : 'State / Territory *', colors: colors),
          items: malaysianStates.map((s) => DropdownMenuItem(value: s, child: Text(s))).toList(),
          onChanged: (val) {
            if (val != null) setState(() => _state = val);
          },
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _addressController,
          maxLines: 2,
          style: TextStyle(color: colors.textPrimary),
          onChanged: _onAddressChanged,
          decoration: InputDecoration(
            labelText: isBM ? 'Alamat / Lokasi Lengkap' : 'Full Address / Location',
            hintText: isBM ? 'No. Jalan, Taman / Kawasan Kejiranan' : 'Street name, Area / Neighborhood',
            filled: true,
            fillColor: colors.surface,
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
            suffixIcon: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(
                  icon: _isLocatingGps
                      ? SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: colors.maroonPrimary),
                        )
                      : Icon(Icons.my_location, color: colors.maroonPrimary, size: 20),
                  tooltip: isBM ? 'Kesan GPS Semasa (Tinjauan Tapak)' : 'Capture Current GPS (On Site)',
                  onPressed: _isLocatingGps ? null : () => _captureCurrentGpsLocation(isBM),
                ),
                IconButton(
                  icon: Icon(Icons.paste_rounded, color: colors.maroonPrimary, size: 20),
                  tooltip: isBM ? 'Tampal Pautan Maps / Waze' : 'Paste Maps / Waze Link',
                  onPressed: () async {
                    final data = await Clipboard.getData(Clipboard.kTextPlain);
                    if (data != null && data.text != null && data.text!.isNotEmpty) {
                      _addressController.text = data.text!;
                      _detectLocationFromText(data.text!, showToast: true);
                    }
                  },
                ),
              ],
            ),
          ),
        ),
        if (_latitude == null) ...[
          const SizedBox(height: 6),
          Align(
            alignment: Alignment.centerLeft,
            child: InkWell(
              onTap: _isLocatingGps ? null : () => _captureCurrentGpsLocation(isBM),
              borderRadius: BorderRadius.circular(8),
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 4, horizontal: 2),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.gps_fixed_rounded, size: 14, color: colors.maroonPrimary),
                    const SizedBox(width: 4),
                    Text(
                      isBM ? 'Kesan GPS semasa di tapak projek' : 'Detect on-site GPS coordinates',
                      style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.maroonPrimary),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
        if (_latitude != null && _longitude != null) ...[
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: colors.maroonPrimary.withValues(alpha: 0.15),
              borderRadius: BorderRadius.circular(8),
              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.4)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.pin_drop_rounded, size: 14, color: colors.maroonPrimary),
                const SizedBox(width: 6),
                Text(
                  'GPS: ${_latitude!.toStringAsFixed(4)}, ${_longitude!.toStringAsFixed(4)} ($_state)',
                  style: TextStyle(fontSize: 11, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                ),
              ],
            ),
          ),
        ],
        const SizedBox(height: 16),
        // Bedroom & Bathroom Steppers
        Row(
          children: [
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(isBM ? 'Bilik Tidur' : 'Bedrooms', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: Icon(Icons.remove_circle_outline, color: colors.maroonPrimary, size: 22),
                          onPressed: () {
                            if (_bedrooms > 0) setState(() => _bedrooms--);
                          },
                        ),
                        Text('$_bedrooms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary)),
                        IconButton(
                          icon: Icon(Icons.add_circle_outline, color: colors.maroonPrimary, size: 22),
                          onPressed: () => setState(() => _bedrooms++),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                decoration: BoxDecoration(
                  color: colors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(isBM ? 'Bilik Air' : 'Bathrooms', style: TextStyle(color: colors.textMuted, fontSize: 12)),
                    const SizedBox(height: 6),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        IconButton(
                          icon: Icon(Icons.remove_circle_outline, color: colors.maroonPrimary, size: 22),
                          onPressed: () {
                            if (_bathrooms > 0) setState(() => _bathrooms--);
                          },
                        ),
                        Text('$_bathrooms', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: colors.textPrimary)),
                        IconButton(
                          icon: Icon(Icons.add_circle_outline, color: colors.maroonPrimary, size: 22),
                          onPressed: () => setState(() => _bathrooms++),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
        const SizedBox(height: 14),
        TextField(
          controller: _sizeController,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(
            label: isBM ? 'Keluasan (sqft / saiz tanah)' : 'Size (sqft / land area)',
            hint: isBM ? 'Contoh: 1400 sqft / 20x70' : 'E.g.: 1400 sqft / 20x70',
            colors: colors,
          ),
        ),
      ],
    );
  }

  Widget _buildStep3MediaDesc(bool isBM, AppThemeColors colors) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              isBM ? 'Foto Hartanah' : 'Property Photos',
              style: TextStyle(fontSize: 14, fontWeight: FontWeight.w700, color: colors.textPrimary),
            ),
            TextButton.icon(
              onPressed: _pickPhotos,
              icon: Icon(Icons.add_photo_alternate_outlined, size: 18, color: colors.maroonPrimary),
              label: Text(
                isBM ? 'Tambah Foto' : 'Add Photos',
                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (_existingPhotoUrls.isNotEmpty || _newPhotoFiles.isNotEmpty)
          SizedBox(
            height: 100,
            child: ListView(
              scrollDirection: Axis.horizontal,
              children: [
                ..._existingPhotoUrls.map((url) {
                  return Stack(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          image: DecorationImage(image: NetworkImage(url), fit: BoxFit.cover),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 12,
                        child: InkWell(
                          onTap: () => setState(() => _existingPhotoUrls.remove(url)),
                          child: const CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.black54,
                            child: Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
                ..._newPhotoFiles.map((file) {
                  return Stack(
                    children: [
                      Container(
                        width: 100,
                        height: 100,
                        margin: const EdgeInsets.only(right: 8),
                        decoration: BoxDecoration(
                          borderRadius: BorderRadius.circular(10),
                          image: DecorationImage(image: FileImage(File(file.path)), fit: BoxFit.cover),
                        ),
                      ),
                      Positioned(
                        top: 4,
                        right: 12,
                        child: InkWell(
                          onTap: () => setState(() => _newPhotoFiles.remove(file)),
                          child: const CircleAvatar(
                            radius: 12,
                            backgroundColor: Colors.black54,
                            child: Icon(Icons.close, size: 14, color: Colors.white),
                          ),
                        ),
                      ),
                    ],
                  );
                }),
              ],
            ),
          )
        else
          InkWell(
            onTap: _pickPhotos,
            borderRadius: BorderRadius.circular(12),
            child: Container(
              height: 110,
              decoration: BoxDecoration(
                color: colors.surface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: colors.border),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Icon(Icons.cloud_upload_outlined, size: 36, color: colors.textDim),
                  const SizedBox(height: 6),
                  Text(
                    isBM ? 'Tekan untuk muat naik gambar hartanah' : 'Tap to upload property photos',
                    style: TextStyle(color: colors.textMuted, fontSize: 13),
                  ),
                ],
              ),
            ),
          ),
        const SizedBox(height: 18),

        TextField(
          controller: _descriptionController,
          maxLines: 5,
          style: TextStyle(color: colors.textPrimary),
          decoration: _inputDecor(
            label: isBM ? 'Keterangan / Deskripsi Unit' : 'Unit Description / Remarks',
            hint: isBM
                ? 'Nyatakan kelebihan unit, kemudahan berdekatan, akses lebuh raya, renovasi terkini...'
                : 'Highlight unit features, nearby amenities, highway access, recent renovations...',
            colors: colors,
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.editListingId != null;
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;
    final isKeyboardOpen = MediaQuery.of(context).viewInsets.bottom > 80;

    if (_isInitLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const Center(child: CircularProgressIndicator(color: AppColors.maroonPrimary)),
      );
    }

    return Scaffold(
      backgroundColor: colors.canvas,
      resizeToAvoidBottomInset: true,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        leading: InteractiveBackButton(
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isEdit
              ? (isBM ? 'Kemaskini Listing' : 'Update Listing')
              : (isBM ? 'Tambah Listing Baru' : 'Add New Listing'),
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: colors.textPrimary),
        ),
      ),
      body: Column(
        children: [
          // 3-Step Wizard Indicator
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            color: colors.card,
            child: Row(
              children: [
                _buildStepHeader(0, isBM ? '1. Asas' : '1. Basic', colors),
                _buildStepDivider(0),
                _buildStepHeader(1, isBM ? '2. Spesifikasi' : '2. Specs', colors),
                _buildStepDivider(1),
                _buildStepHeader(2, isBM ? '3. Media & Nota' : '3. Media', colors),
              ],
            ),
          ),

          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              physics: const BouncingScrollPhysics(),
              child: _currentStep == 0
                  ? _buildStep1BasicInfo(isBM, colors)
                  : _currentStep == 1
                      ? _buildStep2LocationSpecs(isBM, colors)
                      : _buildStep3MediaDesc(isBM, colors),
            ),
          ),
        ],
      ),
      bottomNavigationBar: isKeyboardOpen
          ? null
          : Container(
              padding: EdgeInsets.fromLTRB(
                16,
                12,
                16,
                12 + MediaQuery.of(context).padding.bottom,
              ),
              decoration: BoxDecoration(
                color: colors.card,
                border: Border(top: BorderSide(color: colors.border)),
              ),
              child: Row(
                children: [
                  if (_currentStep > 0)
                    Expanded(
                      child: OutlinedButton(
                        onPressed: () => setState(() => _currentStep--),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: colors.textPrimary,
                          side: BorderSide(color: colors.border),
                          padding: const EdgeInsets.symmetric(vertical: 13),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                        ),
                        child: Text(isBM ? 'KEMBALI' : 'BACK'),
                      ),
                    ),
                  if (_currentStep > 0) const SizedBox(width: 10),
                  Expanded(
                    flex: 2,
                    child: ElevatedButton(
                      onPressed: _isLoading
                          ? null
                          : () {
                              if (_currentStep < 2) {
                                setState(() => _currentStep++);
                              } else {
                                _submitForm();
                              }
                            },
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppColors.maroonPrimary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 13),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                      ),
                      child: _isLoading
                          ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                          : Text(
                              _currentStep < 2
                                  ? (isBM ? 'SETERUSNYA ➔' : 'CONTINUE ➔')
                                  : (isEdit
                                      ? (isBM ? 'SIMPAN LISTING' : 'UPDATE LISTING')
                                      : (isBM ? 'SIARKAN LISTING' : 'PUBLISH LISTING')),
                              style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStepHeader(int step, String label, AppThemeColors colors) {
    final isActive = _currentStep == step;
    final isDone = _currentStep > step;

    return Row(
      children: [
        CircleAvatar(
          radius: 10,
          backgroundColor: isDone
              ? const Color(0xFF10B981)
              : isActive
                  ? colors.maroonPrimary
                  : colors.surface,
          child: isDone
              ? const Icon(Icons.check, size: 12, color: Colors.white)
              : Text(
                  '${step + 1}',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.bold,
                    color: isActive ? Colors.white : colors.textMuted,
                  ),
                ),
        ),
        const SizedBox(width: 6),
        Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
            color: isActive ? colors.textPrimary : colors.textMuted,
          ),
        ),
      ],
    );
  }

  Widget _buildStepDivider(int step) {
    return Expanded(
      child: Container(
        height: 1,
        color: _currentStep > step ? const Color(0xFF10B981) : const Color(0xFF2E3134),
        margin: const EdgeInsets.symmetric(horizontal: 6),
      ),
    );
  }
}
