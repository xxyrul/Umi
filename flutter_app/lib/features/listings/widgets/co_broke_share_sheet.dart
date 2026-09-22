import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../../core/widgets/app_toast.dart';
import '../listing_model.dart';

class CoBrokeShareSheet extends StatefulWidget {
  final ListingModel listing;
  final bool isBM;

  const CoBrokeShareSheet({
    super.key,
    required this.listing,
    required this.isBM,
  });

  static void show(BuildContext context, ListingModel listing, bool isBM) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => CoBrokeShareSheet(listing: listing, isBM: isBM),
    );
  }

  @override
  State<CoBrokeShareSheet> createState() => _CoBrokeShareSheetState();
}

class _CoBrokeShareSheetState extends State<CoBrokeShareSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  String _generateText(int index) {
    final l = widget.listing;
    final priceStr = CurrencyFormatter.format(l.price);
    final locationStr = l.address.isNotEmpty ? '${l.address}, ${l.state}' : l.state;
    final specStr = '${l.bedrooms} Bilik / Beds | ${l.bathrooms} Bilik Air / Baths | ${l.size}';
    final tenureStr = '${l.tenure} (${l.lotStatus})';

    switch (index) {
      case 0: // Direct Client Format
        final buf = StringBuffer();
        buf.writeln('🏠 *${l.title}*');
        buf.writeln('💰 *Harga:* $priceStr');
        buf.writeln('📍 *Lokasi:* $locationStr');
        buf.writeln('📐 *Spesifikasi:* $specStr');
        buf.writeln('📜 *Pegangan:* $tenureStr');
        if (l.description.isNotEmpty) {
          buf.writeln('');
          buf.writeln('📝 *Keterangan:*');
          buf.writeln(l.description);
        }
        buf.writeln('');
        buf.writeln('📞 *Hubungi Ejen Berdaftar:*');
        buf.writeln('${l.agentName} - ${l.agentPhone}');
        buf.writeln('_Artha Real Estate Solutions_');
        return buf.toString();

      case 1: // Clean Co-Broke Format (No agent info)
        final buf = StringBuffer();
        buf.writeln('🏠 *[UNTUK DIJUAL / FOR SALE] ${l.title}*');
        buf.writeln('===================================');
        buf.writeln('💰 *Harga Tawaran:* $priceStr');
        buf.writeln('📍 *Kawasan:* $locationStr');
        buf.writeln('📐 *Saiz & Susun Atur:* $specStr');
        buf.writeln('📜 *Status Pemilikan:* $tenureStr');
        if (l.description.isNotEmpty) {
          buf.writeln('');
          buf.writeln(l.description);
        }
        buf.writeln('');
        buf.writeln('🤝 _Co-broke dialu-alukan. Sila hubungi saya untuk viewing._');
        return buf.toString();

      case 2: // Social / Headline Format
      default:
        return '🔥 *${l.title}*\n'
            '💰 $priceStr | 📍 ${l.state}\n'
            '✨ $specStr | $tenureStr\n'
            '📲 DM / WhatsApp untuk maklumat penuh!';
    }
  }

  void _copyToClipboard(int index) {
    final text = _generateText(index);
    Clipboard.setData(ClipboardData(text: text));
    HapticFeedback.mediumImpact();
    AppToast.success(
      context,
      widget.isBM ? 'Teks berjaya disalin ke papan klip!' : 'Text copied to clipboard!',
    );
    Navigator.pop(context);
  }

  void _share(int index) {
    final text = _generateText(index);
    HapticFeedback.lightImpact();
    SharePlus.instance.share(ShareParams(text: text));
    Navigator.pop(context);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;

    return Container(
      height: MediaQuery.of(context).size.height * 0.72,
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
                Icon(Icons.share_outlined, color: colors.maroonPrimary, size: 22),
                const SizedBox(width: 10),
                Text(
                  isBM ? 'Pusat Perkongsian Co-Broke' : 'Co-Broke Share Center',
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

          // Tabs
          Container(
            margin: const EdgeInsets.symmetric(horizontal: 16),
            decoration: BoxDecoration(
              color: colors.surface,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: TabBar(
              controller: _tabController,
              indicator: BoxDecoration(
                color: colors.maroonPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: colors.textMuted,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 11),
              unselectedLabelStyle: const TextStyle(fontSize: 11),
              indicatorSize: TabBarIndicatorSize.tab,
              dividerColor: Colors.transparent,
              tabs: [
                Tab(text: isBM ? 'Format Klien' : 'Client Format'),
                Tab(text: isBM ? 'Co-Broke Bersih' : 'Clean Co-Broke'),
                Tab(text: isBM ? 'Ringkas / Status' : 'Headline / Status'),
              ],
            ),
          ),

          const SizedBox(height: 12),

          // Tab Preview Views
          Expanded(
            child: TabBarView(
              controller: _tabController,
              children: [
                _buildPreviewTab(0, colors, isBM),
                _buildPreviewTab(1, colors, isBM),
                _buildPreviewTab(2, colors, isBM),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPreviewTab(int index, AppThemeColors colors, bool isBM) {
    final text = _generateText(index);

    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 4, 16, 16),
      child: Column(
        children: [
          // Subtitle Explanation
          Align(
            alignment: Alignment.centerLeft,
            child: Text(
              index == 0
                  ? (isBM ? 'Termasuk nama & nombor telefon anda untuk klien.' : 'Includes your name and phone number for buyers.')
                  : index == 1
                      ? (isBM ? 'Format bersih tanpa maklumat ejen untuk rakan co-broke.' : 'Clean format without agent info for partner agents.')
                      : (isBM ? 'Format ringkas untuk status WhatsApp atau media sosial.' : 'Short 3-line format for social media stories.'),
              style: TextStyle(fontSize: 12, color: colors.textMuted),
            ),
          ),
          const SizedBox(height: 10),

          // Preview Container
          Expanded(
            child: Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: colors.canvas,
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: colors.border),
              ),
              child: SingleChildScrollView(
                child: SelectableText(
                  text,
                  style: TextStyle(
                    fontSize: 13,
                    height: 1.5,
                    color: colors.textPrimary,
                    fontFamily: 'monospace',
                  ),
                ),
              ),
            ),
          ),

          const SizedBox(height: 14),

          // Action Buttons
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => _copyToClipboard(index),
                  icon: const Icon(Icons.copy_rounded, size: 18),
                  label: Text(isBM ? 'Salin Teks' : 'Copy Text'),
                  style: OutlinedButton.styleFrom(
                    foregroundColor: colors.textPrimary,
                    side: BorderSide(color: colors.border),
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: ElevatedButton.icon(
                  onPressed: () => _share(index),
                  icon: const Icon(Icons.send_rounded, size: 18),
                  label: Text(isBM ? 'Kongsi Sekarang' : 'Share Now'),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: colors.maroonPrimary,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
