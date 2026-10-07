import 'dart:async';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/l10n/language_provider.dart';
import '../../../core/theme/app_colors.dart';
import '../../listings/listing_model.dart';
import '../../listings/listing_repository.dart';
import '../admin_service.dart';

class AdminListingsTab extends ConsumerStatefulWidget {
  const AdminListingsTab({super.key});

  @override
  ConsumerState<AdminListingsTab> createState() => _AdminListingsTabState();
}

class _AdminListingsTabState extends ConsumerState<AdminListingsTab> {
  AppThemeColors get colors => context.colors;
  String _listingStatusFilter = 'ALL';
  final TextEditingController _listingSearchController = TextEditingController();
  Timer? _listingSearchDebounce;

  @override
  void dispose() {
    _listingSearchDebounce?.cancel();
    _listingSearchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final listingsAsync = ref.watch(listingsStreamProvider);

    return Column(
      children: [
        // Filter and Search Header
        Container(
          color: colors.surface,
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Column(
            children: [
              SingleChildScrollView(
                scrollDirection: Axis.horizontal,
                child: Row(
                  children: [
                    _buildListingFilterChip('ALL', isBM ? 'SEMUA' : 'ALL'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Active', isBM ? 'AKTIF' : 'ACTIVE'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Sold', isBM ? 'DIJUAL' : 'SOLD'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Reserved', isBM ? 'DIKHAS' : 'RESERVED'),
                    const SizedBox(width: 6),
                    _buildListingFilterChip('Draft', isBM ? 'DRAF' : 'DRAFT'),
                  ],
                ),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: _listingSearchController,
                style: TextStyle(color: colors.textPrimary, fontSize: 13),
                decoration: InputDecoration(
                  hintText: isBM ? 'Cari listing mengikut tajuk, lokasi...' : 'Search listings...',
                  prefixIcon: Icon(Icons.search, color: colors.textMuted, size: 18),
                  filled: true,
                  fillColor: colors.card,
                  contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                ),
                onChanged: (_) {
                  _listingSearchDebounce?.cancel();
                  _listingSearchDebounce = Timer(const Duration(milliseconds: 220), () {
                    if (mounted) setState(() {});
                  });
                },
              ),
            ],
          ),
        ),
        // Listings List
        Expanded(
          child: listingsAsync.when(
            data: (listings) {
              final query = _listingSearchController.text.trim().toLowerCase();
              final filtered = listings.where((l) {
                final matchesFilter = _listingStatusFilter == 'ALL' ||
                    l.status.toLowerCase() == _listingStatusFilter.toLowerCase();
                final matchesQuery = query.isEmpty ||
                    l.title.toLowerCase().contains(query) ||
                    l.address.toLowerCase().contains(query) ||
                    l.state.toLowerCase().contains(query) ||
                    l.agentName.toLowerCase().contains(query);
                return matchesFilter && matchesQuery;
              }).toList();

              if (filtered.isEmpty) {
                return Center(
                  child: Text(isBM ? 'Tiada listing dijumpai.' : 'No listings found.', style: TextStyle(color: colors.textMuted)),
                );
              }

              return ListView.builder(
                padding: EdgeInsets.fromLTRB(16, 16, 16, context.safeBottomPadding(16.0)),
                itemCount: filtered.length,
                itemBuilder: (context, index) {
                  final listing = filtered[index];
                  final priceFmt = NumberFormat.currency(locale: 'ms_MY', symbol: 'RM ', decimalDigits: 0).format(listing.price);

                  return Container(
                    margin: const EdgeInsets.only(bottom: 12),
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: colors.surface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: colors.border),
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Thumbnail
                        Container(
                          width: 72,
                          height: 72,
                          decoration: BoxDecoration(
                            color: colors.card,
                            borderRadius: BorderRadius.circular(10),
                          ),
                          clipBehavior: Clip.antiAlias,
                          child: listing.photos.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: listing.photos.first,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) => Icon(Icons.apartment, color: colors.textMuted),
                                )
                              : Icon(Icons.apartment, color: colors.textMuted),
                        ),
                        const SizedBox(width: 12),
                        // Details
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                listing.title,
                                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 2),
                              Text(
                                priceFmt,
                                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '${listing.propertyType} • ${listing.state}',
                                style: TextStyle(color: colors.textSecondary, fontSize: 11),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 4),
                              Text(
                                '${isBM ? "Ejen:" : "Agent:"} ${listing.agentName.isNotEmpty ? listing.agentName : listing.agentPhone}',
                                style: TextStyle(color: colors.textMuted, fontSize: 10),
                              ),
                            ],
                          ),
                        ),
                        // Status & Action
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            () {
                              final isAktif = listing.isAktif;
                              final isSold = listing.isSold;
                              final statusColor = isAktif
                                  ? colors.success
                                  : (isSold ? Colors.redAccent : Colors.orangeAccent);
                              return Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                decoration: BoxDecoration(
                                  color: statusColor.withValues(alpha: 0.15),
                                  borderRadius: BorderRadius.circular(6),
                                ),
                                child: Text(
                                  listing.getDisplayStatus(isBM),
                                  style: TextStyle(
                                    color: statusColor,
                                    fontSize: 10,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                              );
                            }(),
                            const SizedBox(height: 8),
                            InkWell(
                              onTap: () => _showChangeListingStatusDialog(listing, isBM),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: colors.card,
                                  borderRadius: BorderRadius.circular(6),
                                  border: Border.all(color: colors.border),
                                ),
                                child: Text(isBM ? 'Tukar Status' : 'Change', style: TextStyle(color: colors.textPrimary, fontSize: 11)),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                  );
                },
              );
            },
            loading: () => Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
            error: (e, _) => Center(child: Text('Ralat: $e', style: const TextStyle(color: Colors.redAccent))),
          ),
        ),
      ],
    );
  }

  Widget _buildListingFilterChip(String key, String label) {
    final isSelected = _listingStatusFilter == key;
    return InkWell(
      onTap: () => setState(() => _listingStatusFilter = key),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 5),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : colors.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  void _showChangeListingStatusDialog(ListingModel listing, bool isBM) {
    showModalBottomSheet(
      context: context,
      useSafeArea: true,
      backgroundColor: colors.card,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (ctx) => Padding(
        padding: EdgeInsets.fromLTRB(20, 20, 20, ctx.safeBottomPadding(16.0)),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              isBM ? 'Ubah Status Listing' : 'Update Listing Status',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
            ),
            const SizedBox(height: 6),
            Text(listing.title, style: TextStyle(color: colors.textMuted, fontSize: 12)),
            const SizedBox(height: 16),
            for (final status in ['Active', 'Sold', 'Reserved', 'Draft']) ...[
              ListTile(
                title: Text(status, style: TextStyle(color: colors.textPrimary, fontSize: 14)),
                trailing: listing.status.toLowerCase() == status.toLowerCase()
                    ? Icon(Icons.check, color: colors.maroonPrimary)
                    : null,
                onTap: () async {
                  Navigator.pop(ctx);
                  await ref.read(adminServiceProvider).updateListingStatus(listing.id, status);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text(isBM ? 'Status dikemaskini ke $status' : 'Status updated to $status')),
                    );
                  }
                },
              ),
            ],
          ],
        ),
      ),
    );
  }
}
