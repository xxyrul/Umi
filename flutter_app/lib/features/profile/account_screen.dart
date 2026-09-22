import 'dart:io';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:flutter/material.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_toast.dart';
import '../auth/auth_service.dart';

class AccountScreen extends ConsumerStatefulWidget {
  const AccountScreen({super.key});

  @override
  ConsumerState<AccountScreen> createState() => _AccountScreenState();
}

class _AccountScreenState extends ConsumerState<AccountScreen> {
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _renController = TextEditingController();
  final _companyController = TextEditingController();
  bool _isLoading = false;
  bool _isUploadingPhoto = false;

  @override
  void initState() {
    super.initState();
    final profile = ref.read(currentUserProfileProvider).value;
    if (profile != null) {
      _nameController.text = profile.displayName;
      _phoneController.text = profile.phoneNumber;
    }
    _loadExtraDetails();
  }

  Future<void> _loadExtraDetails() async {
    final user = ref.read(authStateProvider).value;
    if (user == null) return;
    try {
      final doc = await FirebaseFirestore.instance.collection('users').doc(user.uid).get();
      if (doc.exists && mounted) {
        final d = doc.data() ?? {};
        if (_nameController.text.isEmpty) _nameController.text = d['displayName'] ?? '';
        if (_phoneController.text.isEmpty) _phoneController.text = d['phoneNumber'] ?? d['phone'] ?? '';
        _renController.text = d['renNo'] ?? d['renNumber'] ?? '';
        _companyController.text = d['company'] ?? d['agency'] ?? '';
      }
    } catch (e) {
      debugPrint('Error loading account extra: $e');
    }
  }

  @override
  void dispose() {
    _nameController.dispose();
    _phoneController.dispose();
    _renController.dispose();
    _companyController.dispose();
    super.dispose();
  }

  Future<void> _pickAndUploadPhoto(ImageSource source) async {
    final isBM = ref.read(languageProvider) == 'BM';
    final user = FirebaseAuth.instance.currentUser;
    if (user == null) return;

    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: source,
        maxWidth: 800,
        maxHeight: 800,
        imageQuality: 85,
      );

      if (picked == null) return;

      setState(() => _isUploadingPhoto = true);

      final file = File(picked.path);
      final refStorage = FirebaseStorage.instance
          .ref()
          .child('profile_photos')
          .child('${user.uid}.jpg');

      final uploadTask = await refStorage.putFile(
        file,
        SettableMetadata(contentType: 'image/jpeg'),
      );

      final downloadUrl = await uploadTask.ref.getDownloadURL();

      // Update Firebase Auth profile
      await user.updatePhotoURL(downloadUrl);

      // Update Firestore user document
      await FirebaseFirestore.instance.collection('users').doc(user.uid).set({
        'photoUrl': downloadUrl,
        'photoURL': downloadUrl,
        'updatedAt': FieldValue.serverTimestamp(),
      }, SetOptions(merge: true));

      // Invalidate providers
      ref.invalidate(currentUserProfileProvider);
      ref.invalidate(authStateProvider);

      if (mounted) {
        AppToast.success(
          context,
          isBM ? 'Gambar profil berjaya dikemaskini!' : 'Profile picture updated successfully!',
        );
      }
    } catch (e) {
      debugPrint('Upload photo error: $e');
      if (mounted) {
        AppToast.error(
          context,
          isBM ? 'Gagal memuat naik gambar: $e' : 'Failed to upload photo: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isUploadingPhoto = false);
    }
  }

  void _showPhotoOptions() {
    final isBM = ref.read(languageProvider) == 'BM';
    final colors = context.colors;

    showModalBottomSheet(
      context: context,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 20, horizontal: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                isBM ? 'Tukar Gambar Profil' : 'Change Profile Picture',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  color: colors.textPrimary,
                ),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3B82F6).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.photo_library_outlined, color: Color(0xFF3B82F6)),
                ),
                title: Text(
                  isBM ? 'Pilih Dari Galeri' : 'Choose from Gallery',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadPhoto(ImageSource.gallery);
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: const Icon(Icons.camera_alt_outlined, color: Color(0xFF10B981)),
                ),
                title: Text(
                  isBM ? 'Ambil Gambar Kamera' : 'Take a Photo',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600),
                ),
                onTap: () {
                  Navigator.pop(ctx);
                  _pickAndUploadPhoto(ImageSource.camera);
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _saveProfile() async {
    final isBM = ref.read(languageProvider) == 'BM';
    final user = ref.read(authStateProvider).value;
    if (user == null) return;

    setState(() => _isLoading = true);
    try {
      final updates = {
        'displayName': _nameController.text.trim(),
        'name': _nameController.text.trim(),
        'phoneNumber': _phoneController.text.trim(),
        'phone': _phoneController.text.trim(),
        'renNo': _renController.text.trim(),
        'company': _companyController.text.trim(),
        'updatedAt': FieldValue.serverTimestamp(),
      };

      await FirebaseFirestore.instance.collection('users').doc(user.uid).update(updates);
      ref.invalidate(currentUserProfileProvider);

      if (mounted) {
        AppToast.success(
          context,
          isBM ? 'Maklumat profil berjaya dikemaskini!' : 'Profile details updated successfully!',
        );
        Navigator.pop(context);
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(
          context,
          isBM ? 'Ralat mengemaskini profil: $e' : 'Error updating profile: $e',
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  InputDecoration _inputDecor({required String label, String? hint, required AppThemeColors colors}) {
    return InputDecoration(
      labelText: label,
      hintText: hint,
      filled: true,
      fillColor: colors.surface,
      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
      hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppColors.maroonPrimary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final user = ref.watch(authStateProvider).value;
    final profile = ref.watch(currentUserProfileProvider).value;
    final colors = context.colors;

    final photoUrl = (profile?.photoUrl.isNotEmpty == true)
        ? profile!.photoUrl
        : (FirebaseAuth.instance.currentUser?.photoURL ?? '');

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Tetapan Akaun & Profil' : 'Account & Profile Settings',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Avatar with Tap to Upload Functionality
            Center(
              child: GestureDetector(
                onTap: _isUploadingPhoto ? null : _showPhotoOptions,
                child: Stack(
                  children: [
                    Container(
                      width: 88,
                      height: 88,
                      decoration: BoxDecoration(
                        color: colors.card,
                        shape: BoxShape.circle,
                        border: Border.all(color: colors.border, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.08),
                            blurRadius: 8,
                            offset: const Offset(0, 2),
                          ),
                        ],
                      ),
                      clipBehavior: Clip.antiAlias,
                      alignment: Alignment.center,
                      child: _isUploadingPhoto
                          ? const Center(child: CircularProgressIndicator(color: AppColors.maroonPrimary, strokeWidth: 2.5))
                          : (photoUrl.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: photoUrl,
                                  width: 88,
                                  height: 88,
                                  fit: BoxFit.cover,
                                  placeholder: (ctx, url) => Center(
                                    child: Text(
                                      _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'A',
                                      style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                                    ),
                                  ),
                                  errorWidget: (ctx, url, err) => Center(
                                    child: Text(
                                      _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'A',
                                      style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                                    ),
                                  ),
                                )
                              : Text(
                                  _nameController.text.isNotEmpty ? _nameController.text[0].toUpperCase() : 'A',
                                  style: TextStyle(fontSize: 34, fontWeight: FontWeight.bold, color: colors.maroonSecondary),
                                )),
                    ),
                    Positioned(
                      bottom: 0,
                      right: 0,
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3B82F6),
                          shape: BoxShape.circle,
                          border: Border.all(color: colors.canvas, width: 2),
                        ),
                        child: const Icon(Icons.camera_alt, size: 14, color: Colors.white),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 10),
            Center(
              child: Text(
                isBM ? 'Ketik gambar untuk menukar foto profil' : 'Tap picture to change profile photo',
                style: TextStyle(color: colors.textMuted, fontSize: 11),
              ),
            ),
            const SizedBox(height: 6),
            Center(
              child: Text(
                user?.email ?? '',
                style: TextStyle(color: colors.textPrimary, fontSize: 13, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(height: 24),

            TextField(
              controller: _nameController,
              style: TextStyle(color: colors.textPrimary),
              decoration: _inputDecor(
                label: isBM ? 'Nama Penuh Ejen' : 'Agent Full Name',
                hint: isBM ? 'Nama seperti dalam kad pengenalan' : 'Name as in NRIC / Passport',
                colors: colors,
              ),
            ),
            const SizedBox(height: 14),

            TextField(
              controller: _phoneController,
              keyboardType: TextInputType.phone,
              style: TextStyle(color: colors.textPrimary),
              decoration: _inputDecor(
                label: isBM ? 'Nombor Telefon Rasmi' : 'Official Phone Number',
                hint: '01XXXXXXXX',
                colors: colors,
              ),
            ),
            const SizedBox(height: 14),

            TextField(
              controller: _renController,
              style: TextStyle(color: colors.textPrimary),
              decoration: _inputDecor(
                label: isBM ? 'Nombor Pendaftaran REN' : 'REN Registration Number',
                hint: isBM ? 'Contoh: REN 54321 (Opsional)' : 'E.g.: REN 54321 (Optional)',
                colors: colors,
              ),
            ),
            const SizedBox(height: 14),

            TextField(
              controller: _companyController,
              style: TextStyle(color: colors.textPrimary),
              decoration: _inputDecor(
                label: isBM ? 'Agensi / Cawangan' : 'Agency / Branch',
                hint: isBM ? 'Contoh: Nama Agensi / Cawangan' : 'E.g. Agency Name / Branch',
                colors: colors,
              ),
            ),
            const SizedBox(height: 30),

            ElevatedButton(
              onPressed: _isLoading ? null : _saveProfile,
              style: ElevatedButton.styleFrom(
                backgroundColor: colors.maroonPrimary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: _isLoading
                  ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                  : Text(
                      isBM ? 'SIMPAN MAKLUMAT' : 'SAVE PROFILE',
                      style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                    ),
            ),
          ],
        ),
      ),
    );
  }
}
