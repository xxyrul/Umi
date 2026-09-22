import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/widgets/app_toast.dart';
import '../auth/auth_service.dart';
import '../calculator/loan_calculator.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'widgets/co_broke_share_sheet.dart';
import 'widgets/document_vault_sheet.dart';
import 'widgets/fullscreen_gallery_screen.dart';

class ListingDetailScreen extends ConsumerStatefulWidget {
  final ListingModel? listing;
  final String? listingId;

  const ListingDetailScreen({super.key, this.listing, this.listingId});

  @override
  ConsumerState<ListingDetailScreen> createState() => _ListingDetailScreenState();
}

class _ListingDetailScreenState extends ConsumerState<ListingDetailScreen> {
  ListingModel? _listing;
  bool _isLoading = false;
  int _currentPhotoIndex = 0;

  @override
  void initState() {
    super.initState();
    if (widget.listing != null) {
      _listing = widget.listing;
    } else if (widget.listingId != null) {
      _fetchListing();
    }
  }

  Future<void> _fetchListing() async {
    setState(() => _isLoading = true);
    final repo = ref.read(listingRepositoryProvider);
    final fetched = await repo.getListingById(widget.listingId!);
    if (mounted) {
      setState(() {
        _listing = fetched;
        _isLoading = false;
      });
    }
  }

  void _shareCoBroke() {
    final l = _listing;
    if (l == null) return;
    final isBM = ref.read(languageProvider) == 'BM';
    CoBrokeShareSheet.show(context, l, isBM);
  }

  void _openGoogleMaps() {
    final l = _listing;
    if (l == null) return;
    final query = Uri.encodeComponent('${l.title} ${l.address} ${l.state}');
    launchUrl(Uri.parse('https://www.google.com/maps/search/?api=1&query=$query'), mode: LaunchMode.externalApplication);
  }

  void _launchDialer(String phone) {
    if (phone.isEmpty) return;
    final clean = phone.replaceAll(RegExp(r'[^0-9+]'), '');
    launchUrl(Uri.parse('tel:$clean'), mode: LaunchMode.externalApplication);
  }

  void _launchWhatsApp(String phone, String name) {
    if (phone.isEmpty) return;
    var clean = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.startsWith('0')) {
      clean = '60${clean.substring(1)}';
    } else if (!clean.startsWith('60')) {
      clean = '60$clean';
    }
    final title = _listing?.title ?? 'hartanah';
    final price = _listing != null ? CurrencyFormatter.format(_listing!.price) : '';
    final msg = Uri.encodeComponent('Salam / Hai $name, saya berminat dengan listing "$title" ($price). Bolehkah saya dapatkan maklumat lanjut?');
    launchUrl(Uri.parse('https://wa.me/$clean?text=$msg'), mode: LaunchMode.externalApplication);
  }

  void _scheduleViewingWhatsApp(String phone, String name) {
    if (phone.isEmpty) {
      final isBM = ref.read(languageProvider) == 'BM';
      AppToast.show(context, message: isBM ? 'Nombor telefon pemilik tidak dijumpai' : 'Owner phone not available');
      return;
    }
    var clean = phone.replaceAll(RegExp(r'[^0-9]'), '');
    if (clean.startsWith('0')) {
      clean = '60${clean.substring(1)}';
    } else if (!clean.startsWith('60')) {
      clean = '60$clean';
    }
    final title = _listing?.title ?? 'hartanah';
    final msg = Uri.encodeComponent(
      'Salam / Hai $name, saya ingin jadualkan temujanji viewing untuk unit "$title". Boleh saya tahu bila masa yang sesuai untuk viewing? Terima kasih.',
    );
    launchUrl(Uri.parse('https://wa.me/$clean?text=$msg'), mode: LaunchMode.externalApplication);
  }

  void _confirmDelete() {
    final colors = context.colors;
    final isBM = ref.read(languageProvider) == 'BM';
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: colors.card,
        title: Text(
          isBM ? 'Padam Listing' : 'Delete Listing',
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
        ),
        content: Text(
          isBM
              ? 'Adakah anda pasti mahu memadam listing "${_listing?.title ?? ""}"?'
              : 'Are you sure you want to delete listing "${_listing?.title ?? ""}"?',
          style: TextStyle(color: colors.textSecondary),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: Text(isBM ? 'Batal' : 'Cancel', style: TextStyle(color: colors.textMuted)),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent, foregroundColor: Colors.white),
            onPressed: () async {
              Navigator.pop(ctx);
              final targetId = _listing?.id ?? widget.listingId;
              if (targetId != null && targetId.isNotEmpty) {
                await ref.read(listingRepositoryProvider).deleteListing(targetId);
                if (mounted) {
                  AppToast.success(context, isBM ? 'Listing berjaya dipadam' : 'Listing deleted successfully');
                  context.pop();
                }
              }
            },
            child: Text(isBM ? 'Padam' : 'Delete'),
          ),
        ],
      ),
    );
  }

  void _showMortgageModal() {
    final l = _listing;
    if (l == null) return;
    final isBM = ref.read(languageProvider) == 'BM';

    int tenure = 30;
    double interest = 4.2;
    int downpayment = (l.price * 0.1).round();

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: const Color(0xFF181A1C),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setModalState) {
            final loanAmount = l.price - downpayment;
            final monthly = LoanCalculator.calculateMonthlyInstallment(
              loanAmount: loanAmount,
              interestRate: interest,
              tenureYears: tenure,
            );
            final colors = context.colors;

            return Padding(
              padding: const EdgeInsets.all(20),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Kalkulator Pinjaman Bank' : 'Bank Loan Calculator',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
                      ),
                      IconButton(icon: Icon(Icons.close, color: colors.textMuted), onPressed: () => Navigator.pop(ctx)),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: colors.canvas,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        Text(
                          isBM ? 'Anggaran Ansuran Bulanan' : 'Estimated Monthly Installment',
                          style: TextStyle(color: colors.textMuted, fontSize: 12),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          '${CurrencyFormatter.format(monthly)} ${isBM ? '/ bulan' : '/ month'}',
                          style: TextStyle(fontSize: 22, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Deposit (10%):' : 'Downpayment (10%):',
                        style: TextStyle(color: colors.textMuted, fontSize: 13),
                      ),
                      Text(CurrencyFormatter.format(downpayment), style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Kadar Faedah (%):' : 'Interest Rate (%):',
                        style: TextStyle(color: colors.textMuted, fontSize: 13),
                      ),
                      Text('${interest.toStringAsFixed(1)}%', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        isBM ? 'Tempoh Pinjaman (Tahun):' : 'Loan Tenure (Years):',
                        style: TextStyle(color: colors.textMuted, fontSize: 13),
                      ),
                      Text('$tenure ${isBM ? "Tahun" : "Years"}', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold)),
                    ],
                  ),
                  const SizedBox(height: 20),
                ],
              ),
            );
          },
        );
      },
    );
  }

  Widget _buildSpecRow(IconData icon, String label, String value, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Icon(icon, size: 18, color: colors.maroonPrimary),
          const SizedBox(width: 10),
          Text(label, style: TextStyle(fontSize: 13, color: colors.textMuted)),
          const Spacer(),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.textPrimary)),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = ref.watch(languageProvider) == 'BM';

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
      );
    }
    if (_listing == null) {
      return Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(
          backgroundColor: colors.surface,
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: colors.textPrimary),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Center(child: Text(isBM ? 'Listing tidak dijumpai' : 'Listing not found', style: TextStyle(color: colors.textMuted))),
      );
    }
    final listing = _listing!;
    final user = ref.watch(authStateProvider).value;
    final isOwner = listing.isOwnedByUser(user?.uid ?? '');
    final photos = listing.photos.where((p) => p.isNotEmpty).toList();

    final loanAmount = (listing.price * 0.9).round();
    final estimatedMonthly = LoanCalculator.calculateMonthlyInstallment(
      loanAmount: loanAmount,
      interestRate: 4.2,
      tenureYears: 30,
    );

    return Scaffold(
      backgroundColor: colors.canvas,
      body: CustomScrollView(
        slivers: [
          // Collapsible Image Header
          SliverAppBar(
            expandedHeight: 280,
            pinned: true,
            backgroundColor: colors.surface,
            leading: Container(
              margin: const EdgeInsets.all(8),
              decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
              child: IconButton(
                icon: const Icon(Icons.arrow_back, color: Colors.white, size: 20),
                onPressed: () => Navigator.pop(context),
              ),
            ),
            actions: [
              if (isOwner)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                  child: IconButton(
                    icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 20),
                    tooltip: isBM ? 'Kemaskini Listing' : 'Edit Listing',
                    onPressed: () async {
                      await context.push('/listing/form?id=${listing.id}');
                      final refreshed = await ref.read(listingRepositoryProvider).getListingById(listing.id);
                      if (refreshed != null && mounted) {
                        setState(() => _listing = refreshed);
                      }
                    },
                  ),
                ),
              if (isOwner)
                Container(
                  margin: const EdgeInsets.only(right: 6),
                  decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                  child: IconButton(
                    icon: const Icon(Icons.delete_outline, color: Colors.redAccent, size: 20),
                    tooltip: isBM ? 'Padam' : 'Delete',
                    onPressed: _confirmDelete,
                  ),
                ),
              Container(
                margin: const EdgeInsets.only(right: 8),
                decoration: const BoxDecoration(color: Colors.black45, shape: BoxShape.circle),
                child: IconButton(
                  icon: const Icon(Icons.share_outlined, color: Colors.white, size: 20),
                  tooltip: isBM ? 'Kongsi Co-Broke' : 'Share Co-Broke',
                  onPressed: _shareCoBroke,
                ),
              ),
            ],
            flexibleSpace: FlexibleSpaceBar(
              background: photos.isNotEmpty
                  ? Stack(
                      children: [
                        PageView.builder(
                          itemCount: photos.length,
                          onPageChanged: (idx) => setState(() => _currentPhotoIndex = idx),
                          itemBuilder: (context, index) {
                            final photo = photos[index];
                            Widget imageWidget;
                            if (photo.startsWith('http://') || photo.startsWith('https://')) {
                              imageWidget = CachedNetworkImage(
                                imageUrl: photo,
                                fit: BoxFit.cover,
                                width: double.infinity,
                                memCacheWidth: 1080,
                                placeholder: (_, __) => Container(color: colors.card),
                                errorWidget: (_, __, ___) => Container(
                                  color: colors.card,
                                  child: Icon(Icons.home_work_outlined, size: 64, color: colors.textDim),
                                ),
                              );
                            } else if (photo.startsWith('/') || photo.startsWith('file://')) {
                              final filePath = photo.replaceFirst('file://', '');
                              imageWidget = Image.file(
                                File(filePath),
                                fit: BoxFit.cover,
                                width: double.infinity,
                                errorBuilder: (_, __, ___) => Container(
                                  color: colors.card,
                                  child: Icon(Icons.home_work_outlined, size: 64, color: colors.textDim),
                                ),
                              );
                            } else {
                              imageWidget = Container(
                                color: colors.card,
                                child: Icon(Icons.home_work_outlined, size: 64, color: colors.textDim),
                              );
                            }

                            return GestureDetector(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(
                                    builder: (_) => FullscreenGalleryScreen(
                                      photos: photos,
                                      initialIndex: index,
                                      title: listing.title,
                                    ),
                                  ),
                                );
                              },
                              child: imageWidget,
                            );
                          },
                        ),
                        if (photos.length > 1)
                          Positioned(
                            bottom: 16,
                            right: 16,
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                              decoration: BoxDecoration(
                                color: Colors.black54,
                                borderRadius: BorderRadius.circular(12),
                              ),
                              child: Text(
                                '${_currentPhotoIndex + 1} / ${photos.length}',
                                style: const TextStyle(color: Colors.white, fontSize: 12, fontWeight: FontWeight.bold),
                              ),
                            ),
                          ),
                      ],
                    )
                  : Container(
                      color: colors.card,
                      child: Center(child: Icon(Icons.home_work_outlined, size: 64, color: colors.textDim)),
                    ),
            ),
          ),

          // Content
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Status + Property Type Badges
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: colors.maroonPrimary,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Text(
                          listing.getDisplayStatus(isBM),
                          style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
                        decoration: BoxDecoration(
                          color: colors.cardHover,
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: colors.border),
                        ),
                        child: Text(
                          listing.propertyType,
                          style: TextStyle(color: colors.textSecondary, fontSize: 10, fontWeight: FontWeight.w600),
                        ),
                      ),
                      const Spacer(),
                      Text(
                        listing.tenure,
                        style: TextStyle(color: colors.textMuted, fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),

                  // Title
                  Text(
                    listing.title,
                    style: TextStyle(fontSize: 20, fontWeight: FontWeight.w800, color: colors.textPrimary),
                  ),
                  const SizedBox(height: 6),

                  // Price
                  Text(
                    CurrencyFormatter.format(listing.price),
                    style: TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w900,
                      color: colors.maroonPrimary,
                    ),
                  ),
                  const SizedBox(height: 6),

                  // Location
                  InkWell(
                    onTap: _openGoogleMaps,
                    child: Row(
                      children: [
                        Icon(Icons.location_on_outlined, size: 16, color: colors.maroonPrimary),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            listing.address.isNotEmpty ? '${listing.address}, ${listing.state}' : listing.state,
                            style: TextStyle(fontSize: 13, color: colors.textSecondary),
                          ),
                        ),
                        Icon(Icons.arrow_forward_ios, size: 12, color: colors.textDim),
                      ],
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Icon(
                        listing.hasExactLocation ? Icons.gps_fixed : Icons.location_searching,
                        size: 14,
                        color: listing.hasExactLocation ? colors.success : colors.warning,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        listing.hasExactLocation
                            ? (isBM ? 'Lokasi GPS tepat' : 'Exact GPS location')
                            : (isBM ? 'Lokasi kawasan anggaran' : 'Approximate area location'),
                        style: TextStyle(
                          fontSize: 11,
                          color: listing.hasExactLocation ? colors.success : colors.warning,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // 3 Key Metrics
                  Container(
                    padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 12),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildMetricCol(
                          Icons.bed_outlined,
                          listing.bedrooms > 0 ? '${listing.bedrooms}' : '-',
                          isBM ? 'Bilik Tidur' : 'Bedrooms',
                          colors,
                        ),
                        _buildDivider(colors),
                        _buildMetricCol(
                          Icons.shower_outlined,
                          listing.bathrooms > 0 ? '${listing.bathrooms}' : '-',
                          isBM ? 'Bilik Air' : 'Bathrooms',
                          colors,
                        ),
                        _buildDivider(colors),
                        _buildMetricCol(
                          Icons.square_foot_outlined,
                          listing.size.isNotEmpty ? listing.size : '-',
                          isBM ? 'Keluasan' : 'Built-up',
                          colors,
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Quick Mortgage Calculator Banner
                  InkWell(
                    onTap: _showMortgageModal,
                    borderRadius: BorderRadius.circular(14),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: colors.border),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: colors.maroonLight,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(Icons.calculate_outlined, color: colors.maroonPrimary, size: 22),
                          ),
                          const SizedBox(width: 14),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isBM ? 'Anggaran Ansuran Bulanan' : 'Estimated Monthly Installment',
                                  style: TextStyle(color: colors.textMuted, fontSize: 11),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${CurrencyFormatter.format(estimatedMonthly)} ${isBM ? '/ bulan' : '/ month'}',
                                  style: TextStyle(color: colors.textPrimary, fontSize: 16, fontWeight: FontWeight.bold),
                                ),
                              ],
                            ),
                          ),
                          Icon(Icons.arrow_forward_ios, size: 14, color: colors.textMuted),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Specifications Table
                  Text(
                    isBM ? 'SPESIFIKASI HARTANAH' : 'PROPERTY SPECIFICATIONS',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Column(
                      children: [
                        _buildSpecRow(Icons.home_outlined, isBM ? 'Jenis Hartanah' : 'Property Type', listing.propertyType, colors),
                        Divider(color: colors.border, height: 1),
                        _buildSpecRow(Icons.description_outlined, isBM ? 'Pegangan Hakmilik' : 'Tenure', listing.tenure, colors),
                        Divider(color: colors.border, height: 1),
                        _buildSpecRow(Icons.verified_outlined, isBM ? 'Status Lot' : 'Lot Status', listing.lotStatus, colors),
                        Divider(color: colors.border, height: 1),
                        _buildSpecRow(Icons.map_outlined, isBM ? 'Negeri' : 'State', listing.state, colors),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Description
                  if (listing.description.isNotEmpty) ...[
                    Text(
                      isBM ? 'KETERANGAN UNIT' : 'UNIT DESCRIPTION',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                    ),
                    const SizedBox(height: 8),
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: colors.card,
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: colors.border),
                      ),
                      child: Text(
                        listing.description,
                        style: TextStyle(color: colors.textPrimary, fontSize: 13, height: 1.5),
                      ),
                    ),
                    const SizedBox(height: 16),
                  ],

                  // Quick Action Tiles: Document Vault & Viewing Appointment
                  Row(
                    children: [
                      // Document Vault Button (STRICTLY OWNER-ONLY FOR PDPA COMPLIANCE)
                      if (isOwner) ...[
                        Expanded(
                          child: InkWell(
                            onTap: () {
                              DocumentVaultSheet.show(context, listing, isOwner, isBM);
                            },
                            borderRadius: BorderRadius.circular(14),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                              decoration: BoxDecoration(
                                color: colors.card,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: colors.border),
                              ),
                              child: Row(
                                children: [
                                  Container(
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: colors.maroonPrimary.withValues(alpha: 0.18),
                                      shape: BoxShape.circle,
                                    ),
                                    child: Icon(Icons.shield_outlined, color: colors.maroonPrimary, size: 18),
                                  ),
                                  const SizedBox(width: 8),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          isBM ? 'Peti Dokumen' : 'Doc Vault',
                                          style: TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: colors.textPrimary,
                                          ),
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        Text(
                                          isBM ? 'Geran & SPA (Owner)' : 'Title & SPA (Owner)',
                                          style: TextStyle(fontSize: 10, color: colors.textMuted),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                      ],
                      // Book Viewing via WhatsApp Button
                      Expanded(
                        child: InkWell(
                          onTap: () => _scheduleViewingWhatsApp(listing.ownerPhone, listing.ownerName),
                          borderRadius: BorderRadius.circular(14),
                          child: Container(
                            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            decoration: BoxDecoration(
                              color: colors.card,
                              borderRadius: BorderRadius.circular(14),
                              border: Border.all(color: colors.border),
                            ),
                            child: Row(
                              children: [
                                Container(
                                  padding: const EdgeInsets.all(8),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                    shape: BoxShape.circle,
                                  ),
                                  child: const Icon(Icons.event_available_rounded, color: Color(0xFF10B981), size: 18),
                                ),
                                const SizedBox(width: 8),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        isBM ? 'Temujanji Viewing' : 'Book Viewing',
                                        style: TextStyle(
                                          fontSize: 12,
                                          fontWeight: FontWeight.bold,
                                          color: colors.textPrimary,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      Text(
                                        isBM ? 'WhatsApp Pemilik' : 'WhatsApp Owner',
                                        style: const TextStyle(fontSize: 10, color: Color(0xFF10B981), fontWeight: FontWeight.w600),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Agent & Owner Contact Card
                  Text(
                    isBM ? 'MAKLUMAT PEMILIK / EJEN' : 'OWNER / AGENT INFO',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 24,
                          backgroundColor: colors.maroonLight,
                          child: Icon(Icons.person_rounded, color: colors.maroonPrimary, size: 26),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                listing.ownerName.isNotEmpty ? listing.ownerName : (isBM ? 'Pemilik Listing' : 'Listing Owner'),
                                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 15),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                listing.ownerPhone.isNotEmpty
                                    ? listing.ownerPhone
                                    : (isBM ? 'Tiada nombor telefon disimpan' : 'No phone number on record'),
                                style: TextStyle(
                                  color: listing.ownerPhone.isNotEmpty ? colors.textSecondary : colors.textMuted,
                                  fontSize: 12,
                                  fontWeight: listing.ownerPhone.isNotEmpty ? FontWeight.w600 : FontWeight.normal,
                                ),
                              ),
                            ],
                          ),
                        ),
                        if (listing.ownerPhone.isNotEmpty) ...[
                          IconButton(
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: colors.maroonLight,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(Icons.phone_outlined, size: 18, color: colors.maroonPrimary),
                            ),
                            tooltip: isBM ? 'Panggil' : 'Call',
                            onPressed: () => _launchDialer(listing.ownerPhone),
                          ),
                          IconButton(
                            icon: Container(
                              padding: const EdgeInsets.all(8),
                              decoration: BoxDecoration(
                                color: const Color(0x2E10B981),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Icon(Icons.chat_bubble_outline_rounded, size: 18, color: Color(0xFF10B981)),
                            ),
                            tooltip: 'WhatsApp',
                            onPressed: () => _launchWhatsApp(listing.ownerPhone, listing.ownerName),
                          ),
                        ],
                      ],
                    ),
                  ),
                  const SizedBox(height: 40),
                ],
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: Container(
        padding: EdgeInsets.fromLTRB(
          16,
          10,
          16,
          10 + MediaQuery.of(context).padding.bottom,
        ),
        decoration: BoxDecoration(
          color: colors.surface,
          border: Border(top: BorderSide(color: colors.border)),
        ),
        child: Row(
          children: [
            // Share Brochure Button
            OutlinedButton(
              onPressed: _shareCoBroke,
              style: OutlinedButton.styleFrom(
                foregroundColor: colors.textPrimary,
                side: BorderSide(color: colors.border),
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: const Icon(Icons.share_outlined, size: 20),
            ),
            if (listing.ownerPhone.isNotEmpty) ...[
              const SizedBox(width: 8),
              // Direct Phone Call Button
              OutlinedButton(
                onPressed: () => _launchDialer(listing.ownerPhone),
                style: OutlinedButton.styleFrom(
                  foregroundColor: colors.maroonPrimary,
                  side: BorderSide(color: colors.border),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Icon(Icons.phone_outlined, size: 20),
              ),
            ],
            const SizedBox(width: 10),
            // Main Contact / WhatsApp Action Button
            Expanded(
              child: ElevatedButton.icon(
                onPressed: listing.ownerPhone.isNotEmpty
                    ? () => _launchWhatsApp(listing.ownerPhone, listing.ownerName)
                    : _shareCoBroke,
                icon: Icon(
                  listing.ownerPhone.isNotEmpty ? Icons.chat_rounded : Icons.share_outlined,
                  size: 18,
                ),
                label: Text(
                  listing.ownerPhone.isNotEmpty
                      ? (isBM ? 'WHATSAPP PEMILIK' : 'WHATSAPP OWNER')
                      : (isBM ? 'KONGSI BROCHURE' : 'SHARE BROCHURE'),
                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                ),
                style: ElevatedButton.styleFrom(
                  backgroundColor: listing.ownerPhone.isNotEmpty ? const Color(0xFF10B981) : colors.maroonPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 2,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricCol(IconData icon, String val, String label, AppThemeColors colors) {
    return Column(
      children: [
        Icon(icon, size: 20, color: colors.maroonPrimary),
        const SizedBox(height: 4),
        Text(val, style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14)),
        const SizedBox(height: 2),
        Text(label, style: TextStyle(color: colors.textMuted, fontSize: 10)),
      ],
    );
  }

  Widget _buildDivider(AppThemeColors colors) {
    return Container(width: 1, height: 32, color: colors.border);
  }
}

