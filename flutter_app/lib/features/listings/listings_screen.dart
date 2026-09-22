import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:go_router/go_router.dart';
import 'package:share_plus/share_plus.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/currency_formatter.dart';
import '../../core/widgets/interactive_bounce_fab.dart';
import '../auth/auth_service.dart';
import 'listing_model.dart';
import 'listing_repository.dart';
import 'widgets/listing_map_view_widget.dart';

final listingsToolbarResetProvider = StateProvider<int>((ref) => 0);

class ListingsScreen extends ConsumerStatefulWidget {
  const ListingsScreen({super.key});

  @override
  ConsumerState<ListingsScreen> createState() => _ListingsScreenState();
}

class _ListingsScreenState extends ConsumerState<ListingsScreen> {
  final TextEditingController _searchController = TextEditingController();
  Timer? _searchDebounce;
  String _selectedSegment = 'all'; // 'all' or 'mine'
  String _selectedPropertyType = 'All';
  String _selectedState = 'All';
  String _viewMode = 'grid'; // 'grid', 'list', 'map'

  @override
  void initState() {
    super.initState();
    ref.listenManual<int>(listingsToolbarResetProvider, (previous, next) {
      if (previous != next && mounted) {
        setState(() => _viewMode = 'grid');
      }
    });
  }

  static const List<String> propertyTypes = [
    'All',
    'Residential / Terrace',
    'Condominium / Apartment',
    'Bungalow / Semi-D',
    'Commercial / Shoplot',
    'Factory / Warehouse',
    'Agricultural Land',
  ];

  static const List<String> statesList = [
    'All',
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
  void dispose() {
    _searchDebounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _shareListing(ListingModel listing) {
    final text = StringBuffer();
    text.writeln('🏠 *${listing.title}*');
    text.writeln('💰 *Harga / Price:* ${CurrencyFormatter.format(listing.price)}');
    text.writeln('📍 *Lokasi / Location:* ${listing.address.isNotEmpty ? "${listing.address}, " : ""}${listing.state}');
    text.writeln('📐 *Spesifikasi / Specs:* ${listing.bedrooms} Bilik/Beds | ${listing.bathrooms} Bilik Air/Baths | ${listing.size}');
    text.writeln('📜 *Pegangan / Tenure:* ${listing.tenure} (${listing.lotStatus})');
    text.writeln('');
    if (listing.description.isNotEmpty) {
      text.writeln(listing.description);
      text.writeln('');
    }
    text.writeln('📞 *Hubungi Ejen / Contact Agent:* ${listing.agentName} (${listing.agentPhone})');
    text.writeln('_Artha Real Estate Solutions_');

    SharePlus.instance.share(ShareParams(text: text.toString()));
  }

  void _showFilterSheet() {
    final isBM = ref.read(languageProvider) == 'BM';
    final colors = context.colors;

    var tempPropertyType = _selectedPropertyType;
    var tempState = _selectedState;

    showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      isScrollControlled: true,
      backgroundColor: colors.surface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            final activeFilterCount = (tempPropertyType != 'All' ? 1 : 0) + (tempState != 'All' ? 1 : 0);

            return Container(
              constraints: BoxConstraints(
                maxHeight: MediaQuery.of(ctx).size.height * 0.82,
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  // Top Drag Handle
                  const SizedBox(height: 12),
                  Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: colors.border,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Header
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 20),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Text(
                              isBM ? 'Tapis Listing' : 'Filter Listings',
                              style: TextStyle(
                                fontSize: 18,
                                fontWeight: FontWeight.w800,
                                color: colors.textPrimary,
                              ),
                            ),
                            if (activeFilterCount > 0) ...[
                              const SizedBox(width: 8),
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: colors.maroonLight,
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Text(
                                  '$activeFilterCount',
                                  style: TextStyle(
                                    fontSize: 11,
                                    fontWeight: FontWeight.bold,
                                    color: colors.maroonPrimary,
                                  ),
                                ),
                              ),
                            ],
                          ],
                        ),
                        Row(
                          children: [
                            if (tempPropertyType != 'All' || tempState != 'All')
                              TextButton(
                                onPressed: () {
                                  setSheetState(() {
                                    tempPropertyType = 'All';
                                    tempState = 'All';
                                  });
                                },
                                style: TextButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 8),
                                  minimumSize: Size.zero,
                                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                ),
                                child: Text(
                                  isBM ? 'Reset Semua' : 'Reset All',
                                  style: TextStyle(color: colors.maroonPrimary, fontSize: 13, fontWeight: FontWeight.bold),
                                ),
                              ),
                            IconButton(
                              icon: Icon(Icons.close, color: colors.textSecondary, size: 22),
                              onPressed: () => Navigator.pop(ctx),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Divider(color: colors.border, height: 1),

                  // Scrollable Body
                  Flexible(
                    child: SingleChildScrollView(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          // 1. Property Type Section
                          Text(
                            isBM ? 'JENIS HARTANAH' : 'PROPERTY TYPE',
                            style: TextStyle(
                              color: colors.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: propertyTypes.map((type) {
                              final isSel = tempPropertyType == type;
                              return ChoiceChip(
                                label: Text(
                                  type,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? Colors.white : colors.textPrimary,
                                  ),
                                ),
                                selected: isSel,
                                selectedColor: colors.maroonPrimary,
                                backgroundColor: colors.card,
                                side: BorderSide(
                                  color: isSel ? colors.maroonPrimary : colors.border,
                                  width: isSel ? 1.5 : 1.0,
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                showCheckmark: false,
                                onSelected: (val) {
                                  if (val) {
                                    setSheetState(() => tempPropertyType = type);
                                  }
                                },
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 22),

                          // 2. State / Region Section
                          Text(
                            isBM ? 'NEGERI / WILAYAH' : 'STATE / REGION',
                            style: TextStyle(
                              color: colors.textMuted,
                              fontSize: 11,
                              fontWeight: FontWeight.w800,
                              letterSpacing: 0.8,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: statesList.map((st) {
                              final isSel = tempState == st;
                              return ChoiceChip(
                                label: Text(
                                  st,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? Colors.white : colors.textPrimary,
                                  ),
                                ),
                                selected: isSel,
                                selectedColor: colors.maroonPrimary,
                                backgroundColor: colors.card,
                                side: BorderSide(
                                  color: isSel ? colors.maroonPrimary : colors.border,
                                  width: isSel ? 1.5 : 1.0,
                                ),
                                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                showCheckmark: false,
                                onSelected: (val) {
                                  if (val) {
                                    setSheetState(() => tempState = st);
                                  }
                                },
                              );
                            }).toList(),
                          ),
                          const SizedBox(height: 16),
                        ],
                      ),
                    ),
                  ),

                  // Fixed Bottom Action Bar (Clear of Android Navigation Gestures and 3-Button Bar)
                  Container(
                    padding: EdgeInsets.only(
                      left: 20,
                      right: 20,
                      top: 14,
                      bottom: math.max(MediaQuery.of(ctx).padding.bottom, MediaQuery.of(ctx).viewPadding.bottom) + 14,
                    ),
                    decoration: BoxDecoration(
                      color: colors.card,
                      border: Border(top: BorderSide(color: colors.border)),
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: () {
                              setSheetState(() {
                                tempPropertyType = 'All';
                                tempState = 'All';
                              });
                            },
                            style: OutlinedButton.styleFrom(
                              side: BorderSide(color: colors.border),
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            ),
                            child: Text(
                              isBM ? 'Set Semula' : 'Reset',
                              style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                            ),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton(
                            style: ElevatedButton.styleFrom(
                              backgroundColor: colors.maroonPrimary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                              elevation: 0,
                            ),
                            onPressed: () {
                              setState(() {
                                _selectedPropertyType = tempPropertyType;
                                _selectedState = tempState;
                              });
                              Navigator.pop(ctx);
                            },
                            child: Text(
                              isBM ? 'Gunakan Tapisan' : 'Apply Filters',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }

  List<ListingModel> _filterListings(List<ListingModel> all, String currentUserId) {
    final query = _searchController.text.trim().toLowerCase();

    return all.where((l) {
      // 1. Segment filter: all vs mine
      if (_selectedSegment == 'mine') {
        if (!l.isOwnedByUser(currentUserId)) return false;
      } else {
        // Public marketplace shows active & booking
        if (l.isDraft || l.isSold) return false;
      }

      // 2. Property Type filter
      if (_selectedPropertyType != 'All') {
        final selected = _selectedPropertyType.toLowerCase();
        final actual = l.propertyType.toLowerCase();
        final isMatch = actual.contains(selected) ||
            (selected.contains('teres') && actual.contains('terrace')) ||
            (selected.contains('terrace') && actual.contains('teres'));
        if (!isMatch) {
          return false;
        }
      }

      // 3. State filter
      if (_selectedState != 'All') {
        if (l.state.toLowerCase() != _selectedState.toLowerCase()) {
          return false;
        }
      }

      // 4. Search query
      if (query.isNotEmpty) {
        final matchesTitle = l.title.toLowerCase().contains(query);
        final matchesAddress = l.address.toLowerCase().contains(query);
        final matchesState = l.state.toLowerCase().contains(query);
        final matchesPrice = l.price.toString().contains(query);
        if (!matchesTitle && !matchesAddress && !matchesState && !matchesPrice) {
          return false;
        }
      }

      return true;
    }).toList();
  }

  Widget _buildGridCard(ListingModel listing, AppThemeColors colors, bool isBM) {
    final hasPhoto = listing.photos.isNotEmpty;

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border),
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(14),
        child: InkWell(
          onTap: () {
            context.push('/listing/${listing.id}', extra: listing);
          },
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Photo Thumbnail with Badges
              Stack(
                children: [
                  AspectRatio(
                    aspectRatio: 1.35,
                    child: hasPhoto
                        ? CachedNetworkImage(
                            imageUrl: listing.photos.first,
                            fit: BoxFit.cover,
                            memCacheWidth: 450,
                            memCacheHeight: 330,
                            placeholder: (_, __) => Container(color: colors.cardHover),
                            errorWidget: (_, __, ___) => Container(
                              color: colors.cardHover,
                              child: Icon(Icons.home_work_outlined, color: colors.textMuted, size: 30),
                            ),
                          )
                        : Container(
                            color: colors.cardHover,
                            child: Center(
                              child: Icon(Icons.home_work_outlined, color: colors.textMuted, size: 32),
                            ),
                          ),
                  ),
                  // Price Tag Overlay
                  Positioned(
                    bottom: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.5)),
                      ),
                      child: Text(
                        CurrencyFormatter.format(listing.price),
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 12,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                    ),
                  ),
                  // Status Badge
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: colors.maroonPrimary,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        listing.getDisplayStatus(isBM),
                        style: const TextStyle(color: Colors.white, fontSize: 9, fontWeight: FontWeight.bold),
                      ),
                    ),
                  ),
                  // Photo Count Badge
                  if (listing.photos.length > 1)
                    Positioned(
                      top: 8,
                      left: 8,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                        decoration: BoxDecoration(
                          color: Colors.black54,
                          borderRadius: BorderRadius.circular(6),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.camera_alt, size: 10, color: Colors.white),
                            const SizedBox(width: 3),
                            Text('${listing.photos.length}', style: const TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold)),
                          ],
                        ),
                      ),
                    ),
                ],
              ),

              // Body
              Padding(
                padding: const EdgeInsets.all(10),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      listing.title,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.textPrimary),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        Icon(Icons.location_on_outlined, size: 12, color: colors.textMuted),
                        const SizedBox(width: 2),
                        Expanded(
                          child: Text(
                            listing.state,
                            style: TextStyle(fontSize: 11, color: colors.textMuted),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 6),
                    Text(
                      '🛏️ ${listing.bedrooms}  🚿 ${listing.bathrooms}  📐 ${listing.size.isNotEmpty ? listing.size : "-"}',
                      style: TextStyle(fontSize: 11, color: colors.textMuted),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildListCard(ListingModel listing, AppThemeColors colors, bool isBM) {
    final hasPhoto = listing.photos.isNotEmpty;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: colors.border),
      ),
      child: InkWell(
        onTap: () {
          context.push('/listing/${listing.id}', extra: listing);
        },
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              ClipRRect(
                borderRadius: BorderRadius.circular(10),
                child: SizedBox(
                  width: 90,
                  height: 90,
                  child: hasPhoto
                      ? CachedNetworkImage(
                          imageUrl: listing.photos.first,
                          fit: BoxFit.cover,
                          memCacheWidth: 270,
                          memCacheHeight: 270,
                          placeholder: (_, __) => Container(color: colors.cardHover),
                          errorWidget: (_, __, ___) => Container(
                            color: colors.cardHover,
                            child: Icon(Icons.home_work_outlined, color: colors.textMuted),
                          ),
                        )
                      : Container(
                          color: colors.cardHover,
                          child: Icon(Icons.home_work_outlined, color: colors.textMuted),
                        ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      CurrencyFormatter.format(listing.price),
                      style: TextStyle(fontSize: 16, fontWeight: FontWeight.w800, color: colors.maroonPrimary),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      listing.title,
                      style: TextStyle(fontSize: 13, fontWeight: FontWeight.w700, color: colors.textPrimary),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Text(
                      '${listing.propertyType} • ${listing.state}',
                      style: TextStyle(fontSize: 11, color: colors.textMuted),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      isBM
                          ? '🛏️ ${listing.bedrooms} Bilik  🚿 ${listing.bathrooms} Bilik Air'
                          : '🛏️ ${listing.bedrooms} Beds  🚿 ${listing.bathrooms} Baths',
                      style: TextStyle(fontSize: 11, color: colors.textMuted),
                    ),
                  ],
                ),
              ),
              IconButton(
                icon: Icon(Icons.share_outlined, size: 18, color: colors.maroonPrimary),
                onPressed: () => _shareListing(listing),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final user = ref.watch(authStateProvider).value;
    final listingsAsync = ref.watch(listingsStreamProvider);
    final all = listingsAsync.value ?? [];
    final filtered = _filterListings(all, user?.uid ?? '');
    final isBM = ref.watch(languageProvider) == 'BM';

    final bottomInset = MediaQuery.of(context).padding.bottom;
    final floatingBarBottom = bottomInset > 0 ? bottomInset + 8.0 : 20.0;
    final fabBottom = floatingBarBottom + 58.0 + 12.0;
    final scrollBottom = floatingBarBottom + 58.0 + 44.0;

    return Scaffold(
      backgroundColor: colors.canvas,
      body: SafeArea(
        child: Column(
          children: [
            // Top Bar: Katalog Hartanah + Switchers
            Padding(
              padding: const EdgeInsets.only(left: 16, right: 8, top: 12, bottom: 6),
              child: Row(
                children: [
                  Text(
                    isBM ? 'Katalog Hartanah' : 'Property Catalog',
                    style: TextStyle(fontSize: 22, fontWeight: FontWeight.w800, color: colors.textPrimary),
                  ),
                  const Spacer(),
                  // 1-Tap Direct View Mode Selector: Grid | List | Map
                  Container(
                    height: 36,
                    padding: const EdgeInsets.all(3),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        _buildViewModeOption('grid', Icons.grid_view_rounded, isBM ? 'Grid' : 'Grid', colors),
                        _buildViewModeOption('list', Icons.view_list_rounded, isBM ? 'Senarai' : 'List', colors),
                        _buildViewModeOption('map', Icons.map_rounded, isBM ? 'Peta' : 'Map', colors),
                      ],
                    ),
                  ),
                  const SizedBox(width: 4),
                  IconButton(
                    icon: Icon(Icons.tune_rounded, color: colors.textPrimary),
                    tooltip: isBM ? 'Tapis' : 'Filter',
                    onPressed: _showFilterSheet,
                  ),
                ],
              ),
            ),

            // Search Bar
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
              child: Container(
                height: 42,
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: colors.border),
                ),
                child: TextField(
                  controller: _searchController,
                  onChanged: (_) {
                    _searchDebounce?.cancel();
                    _searchDebounce = Timer(const Duration(milliseconds: 220), () {
                      if (mounted) setState(() {});
                    });
                  },
                  style: TextStyle(color: colors.textPrimary, fontSize: 13),
                  decoration: InputDecoration(
                    hintText: isBM ? 'Cari tajuk, lokasi atau saiz...' : 'Search title, location or size...',
                    hintStyle: TextStyle(color: colors.textMuted, fontSize: 13),
                    prefixIcon: Icon(Icons.search, size: 18, color: colors.textMuted),
                    suffixIcon: _searchController.text.isNotEmpty
                        ? IconButton(
                            icon: Icon(Icons.close, size: 16, color: colors.textMuted),
                            onPressed: () {
                              _searchController.clear();
                              setState(() {});
                            },
                          )
                        : null,
                    border: InputBorder.none,
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ),

            // Segmented Switcher: [✓ Semua] | [Milik Saya]
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  InkWell(
                    onTap: () => setState(() => _selectedSegment = 'all'),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _selectedSegment == 'all' ? colors.maroonPrimary : colors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _selectedSegment == 'all' ? colors.maroonPrimary : colors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          if (_selectedSegment == 'all')
                            const Padding(
                              padding: EdgeInsets.only(right: 6),
                              child: Icon(Icons.check, size: 14, color: Colors.white),
                            ),
                          Text(
                            isBM ? 'Semua' : 'All',
                            style: TextStyle(
                              color: _selectedSegment == 'all' ? Colors.white : colors.textSecondary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  InkWell(
                    onTap: () => setState(() => _selectedSegment = 'mine'),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: _selectedSegment == 'mine' ? colors.maroonPrimary : colors.card,
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: _selectedSegment == 'mine' ? colors.maroonPrimary : colors.border,
                        ),
                      ),
                      child: Row(
                        children: [
                          if (_selectedSegment == 'mine')
                            const Padding(
                              padding: EdgeInsets.only(right: 6),
                              child: Icon(Icons.check, size: 14, color: Colors.white),
                            ),
                          Text(
                            isBM ? 'Milik Saya' : 'My Listings',
                            style: TextStyle(
                              color: _selectedSegment == 'mine' ? Colors.white : colors.textSecondary,
                              fontWeight: FontWeight.bold,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const Spacer(),
                  Text(
                    '${filtered.length} ${isBM ? "Listing" : "Listings"}',
                    style: TextStyle(color: colors.textMuted, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),

            // Content List / Grid / Map
            Expanded(
              child: _viewMode == 'map'
                  ? ListingMapViewWidget(listings: filtered, isBM: isBM)
                  : RefreshIndicator(
                      color: colors.maroonPrimary,
                      onRefresh: () async => ref.invalidate(listingsStreamProvider),
                      child: listingsAsync.when(
                        loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
                        error: (e, st) => Center(child: Text(isBM ? 'Ralat: $e' : 'Error: $e', style: const TextStyle(color: Colors.redAccent))),
                        data: (_) {
                          if (filtered.isEmpty) {
                            return ListView(
                              physics: const AlwaysScrollableScrollPhysics(parent: BouncingScrollPhysics()),
                              children: [
                                const SizedBox(height: 120),
                                Center(
                                  child: Column(
                                    children: [
                                      Icon(Icons.home_work_outlined, size: 56, color: colors.textMuted.withValues(alpha: 0.35)),
                                      const SizedBox(height: 12),
                                      Text(
                                        isBM ? 'Tiada listing dijumpai' : 'No listings found',
                                        style: TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: colors.textPrimary),
                                      ),
                                      const SizedBox(height: 4),
                                      Text(
                                        isBM
                                            ? 'Sila semak semula tapisan atau tambah listing baru.'
                                            : 'Please check your filters or add a new listing.',
                                        style: TextStyle(fontSize: 12, color: colors.textMuted),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            );
                          }

                          if (_viewMode == 'grid') {
                            return GridView.builder(
                              physics: const BouncingScrollPhysics(),
                              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                                crossAxisCount: 2,
                                childAspectRatio: 0.68,
                                crossAxisSpacing: 10,
                                mainAxisSpacing: 10,
                              ),
                              padding: EdgeInsets.only(left: 16, right: 16, top: 4, bottom: scrollBottom),
                              itemCount: filtered.length,
                              itemBuilder: (context, index) => RepaintBoundary(
                                child: _buildGridCard(filtered[index], colors, isBM),
                              ),
                            );
                          }

                          return ListView.builder(
                            physics: const BouncingScrollPhysics(),
                            padding: EdgeInsets.only(left: 16, right: 16, top: 4, bottom: scrollBottom),
                            itemCount: filtered.length,
                            itemBuilder: (context, index) => RepaintBoundary(
                              child: _buildListCard(filtered[index], colors, isBM),
                            ),
                          );
                        },
                      ),
                    ),
            ),
          ],
        ),
      ),
      floatingActionButton: _viewMode == 'map'
          ? null
          : Padding(
              padding: EdgeInsets.only(bottom: fabBottom),
                child: Transform.translate(
                  offset: const Offset(0, 64),
                  child: InteractiveBounceFab(
                    onPressed: () => context.push('/listing/form'),
                    backgroundColor: colors.maroonPrimary,
                    icon: const Icon(Icons.add, size: 28),
                  ),
              ),
            ),
    );
  }

  Widget _buildViewModeOption(String mode, IconData icon, String tooltip, AppThemeColors colors) {
    final isSelected = _viewMode == mode;
    return Tooltip(
      message: tooltip,
      child: InkWell(
        onTap: () => setState(() => _viewMode = mode),
        borderRadius: BorderRadius.circular(7),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 150),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            color: isSelected ? colors.maroonPrimary : Colors.transparent,
            borderRadius: BorderRadius.circular(7),
          ),
          child: Icon(
            icon,
            size: 17,
            color: isSelected ? Colors.white : colors.textMuted,
          ),
        ),
      ),
    );
  }
}
