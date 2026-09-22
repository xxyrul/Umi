import 'dart:io';
import 'package:flutter/material.dart';
import 'package:file_picker/file_picker.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/widgets/app_toast.dart';
import '../listing_model.dart';

class DocumentVaultSheet extends StatefulWidget {
  final ListingModel listing;
  final bool isOwner;
  final bool isBM;

  const DocumentVaultSheet({
    super.key,
    required this.listing,
    required this.isOwner,
    required this.isBM,
  });

  static void show(BuildContext context, ListingModel listing, bool isOwner, bool isBM) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => DocumentVaultSheet(listing: listing, isOwner: isOwner, isBM: isBM),
    );
  }

  @override
  State<DocumentVaultSheet> createState() => _DocumentVaultSheetState();
}

class _DocumentVaultSheetState extends State<DocumentVaultSheet> {
  late Map<String, String> _documents;
  String? _uploadingSlot;

  static const List<Map<String, dynamic>> docSlots = [
    {
      'key': 'geran',
      'titleEN': 'Land Title / Geran',
      'titleBM': 'Salinan Geran Tanah',
      'icon': Icons.description_outlined,
      'descEN': 'Individual / strata title copy',
      'descBM': 'Geran individu atau hakmilik strata',
    },
    {
      'key': 'ic',
      'titleEN': 'Owner MyKad / IC Copy',
      'titleBM': 'Salinan MyKad Pemilik',
      'icon': Icons.badge_outlined,
      'descEN': 'Watermarked owner identification',
      'descBM': 'Kad pengenalan pemilik berpalang',
    },
    {
      'key': 'spa',
      'titleEN': 'Sales & Purchase Agreement',
      'titleBM': 'Perjanjian Jual Beli (SPA)',
      'icon': Icons.history_edu_outlined,
      'descEN': 'Previous SPA or booking form',
      'descBM': 'Salinan SPA terdahulu atau resit booking',
    },
    {
      'key': 'lantikan',
      'titleEN': 'Exclusive Authority to Sell',
      'titleBM': 'Borang Lantikan Ejen (Exclusive)',
      'icon': Icons.assignment_turned_in_outlined,
      'descEN': 'Agency engagement contract',
      'descBM': 'Surat lantikan eksklusif agensi',
    },
  ];

  @override
  void initState() {
    super.initState();
    _documents = Map<String, String>.from(widget.listing.documents);
  }

  Future<void> _pickAndUpload(String slotKey) async {
    if (!widget.isOwner) return;

    try {
      final files = await FilePicker.pickFiles(
        type: FileType.custom,
        allowedExtensions: ['pdf', 'jpg', 'jpeg', 'png'],
      );

      if (files.isEmpty || files.first.path == null) return;

      setState(() => _uploadingSlot = slotKey);

      final filePath = files.first.path!;
      final file = File(filePath);
      final ext = files.first.extension ?? 'pdf';
      final fileName = '${slotKey}_${DateTime.now().millisecondsSinceEpoch}.$ext';

      final storageRef = FirebaseStorage.instance
          .ref()
          .child('listings')
          .child(widget.listing.id)
          .child('docs')
          .child(fileName);

      final uploadTask = await storageRef.putFile(file);
      final downloadUrl = await uploadTask.ref.getDownloadURL();

      final updatedDocs = Map<String, String>.from(_documents);
      updatedDocs[slotKey] = downloadUrl;

      // Update Firestore document
      await FirebaseFirestore.instance.collection('listings').doc(widget.listing.id).update({
        'documents': updatedDocs,
        'updatedAt': FieldValue.serverTimestamp(),
      });

      if (mounted) {
        setState(() {
          _documents = updatedDocs;
          _uploadingSlot = null;
        });
        AppToast.success(
          context,
          widget.isBM ? 'Dokumen berjaya dimuat naik ke peti rahsia.' : 'Document uploaded to private vault.',
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _uploadingSlot = null);
        AppToast.error(
          context,
          widget.isBM ? 'Gagal memuat naik dokumen: $e' : 'Failed to upload document: $e',
        );
      }
    }
  }

  void _openDocument(String url) async {
    try {
      await launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
    } catch (e) {
      if (mounted) {
        AppToast.error(context, 'Tidak dapat membuka dokumen.');
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;

    return Container(
      height: MediaQuery.of(context).size.height * 0.75,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(24)),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          // Drag handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.textDim.withOpacity(0.4),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),

          // Header
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Row(
              children: [
                Icon(Icons.shield_outlined, color: colors.maroonPrimary, size: 24),
                const SizedBox(width: 10),
                Text(
                  isBM ? 'Peti Dokumen Rahsia' : 'Confidential Document Vault',
                  style: TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.w800,
                    color: colors.textPrimary,
                  ),
                ),
                const Spacer(),
                IconButton(
                  icon: Icon(Icons.close, color: colors.textMuted, size: 20),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // PDPA Privacy Notice Banner
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: colors.maroonPrimary.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Icon(Icons.lock_clock_outlined, color: colors.maroonPrimary, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    isBM
                      ? 'Dokumen dalam peti ini dilindungi di bawah PDPA dan hanya boleh diakses oleh pemilik listing berdaftar.'
                      : 'Documents in this vault are PDPA protected and restricted to the verified listing owner.',
                    style: TextStyle(fontSize: 11, color: colors.textSecondary, height: 1.4),
                  ),
                ),
              ],
            ),
          ),

          const SizedBox(height: 8),

          // Slot List
          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              itemCount: docSlots.length,
              separatorBuilder: (_, __) => const SizedBox(height: 10),
              itemBuilder: (context, index) {
                final slot = docSlots[index];
                final slotKey = slot['key'] as String;
                final title = isBM ? slot['titleBM'] : slot['titleEN'];
                final desc = isBM ? slot['descBM'] : slot['descEN'];
                final icon = slot['icon'] as IconData;

                final hasDoc = _documents.containsKey(slotKey) && _documents[slotKey]!.isNotEmpty;
                final isUploading = _uploadingSlot == slotKey;

                return Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(14),
                    border: Border.all(
                      color: hasDoc ? const Color(0xFF10B981) : colors.border,
                      width: hasDoc ? 1.5 : 1.0,
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: hasDoc ? const Color(0xFF10B981).withValues(alpha: 0.12) : colors.card,
                          shape: BoxShape.circle,
                        ),
                        child: Icon(
                          hasDoc ? Icons.check_circle_rounded : icon,
                          color: hasDoc ? const Color(0xFF10B981) : colors.maroonPrimary,
                          size: 22,
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              title,
                              style: TextStyle(
                                fontSize: 14,
                                fontWeight: FontWeight.bold,
                                color: colors.textPrimary,
                              ),
                            ),
                            const SizedBox(height: 3),
                            Text(
                              desc,
                              style: TextStyle(fontSize: 11, color: colors.textMuted),
                            ),
                          ],
                        ),
                      ),

                      // Actions
                      if (isUploading)
                        const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(strokeWidth: 2.5),
                        )
                      else if (hasDoc)
                        Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            IconButton(
                              icon: const Icon(Icons.open_in_new, size: 20),
                              color: colors.maroonPrimary,
                              tooltip: 'Buka Dokumen',
                              onPressed: () => _openDocument(_documents[slotKey]!),
                            ),
                            if (widget.isOwner)
                              IconButton(
                                icon: const Icon(Icons.refresh, size: 20),
                                color: colors.textMuted,
                                tooltip: 'Ganti Dokumen',
                                onPressed: () => _pickAndUpload(slotKey),
                              ),
                          ],
                        )
                      else if (widget.isOwner)
                        ElevatedButton.icon(
                          onPressed: () => _pickAndUpload(slotKey),
                          icon: const Icon(Icons.upload_file, size: 16),
                          label: Text(isBM ? 'Muat Naik' : 'Upload'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: colors.maroonPrimary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                            textStyle: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        )
                      else
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Icon(Icons.lock_outline, size: 14, color: colors.textDim),
                              const SizedBox(width: 4),
                              Text('Kunci', style: TextStyle(fontSize: 11, color: colors.textDim)),
                            ],
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}
