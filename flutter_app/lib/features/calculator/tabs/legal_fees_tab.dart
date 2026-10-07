import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../domain/calculator_engine.dart';
import '../domain/calculator_models.dart';

class LegalFeesTab extends StatefulWidget {
  final bool isBM;

  const LegalFeesTab({super.key, required this.isBM});

  @override
  State<LegalFeesTab> createState() => _LegalFeesTabState();
}

class _LegalFeesTabState extends State<LegalFeesTab> {
  final _priceController = TextEditingController(text: '500,000');
  final _loanController = TextEditingController(text: '450,000');

  double _price = 500000;
  double _loan = 450000;
  bool _isFirstHomeBuyer = false;

  @override
  void initState() {
    super.initState();
    _priceController.addListener(() {
      final clean = _priceController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final val = double.tryParse(clean) ?? 0;
      if (val != _price) {
        setState(() {
          _price = val;
          _loan = val * 0.90;
          _loanController.text = CurrencyFormatter.formatNoSymbol(_loan.round());
        });
      }
    });

    _loanController.addListener(() {
      final clean = _loanController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final val = double.tryParse(clean) ?? 0;
      if (val != _loan) {
        setState(() => _loan = val);
      }
    });
  }

  @override
  void dispose() {
    _priceController.dispose();
    _loanController.dispose();
    super.dispose();
  }

  LegalFeesResult get _result => CalculatorEngine.calculateLegalFees(
        propertyPrice: _price,
        loanAmount: _loan,
        isFirstHomeBuyer: _isFirstHomeBuyer,
      );

  void _shareLegal() async {
    final res = _result;
    final isBM = widget.isBM;
    final text = StringBuffer();

    text.writeln(isBM ? '⚖️ *SEBUTHARGA YURAN GUAMAN & DUTI SETEM (SRO 2023)*' : '⚖️ *LEGAL FEES & STAMP DUTY QUOTE (SRO 2023)*');
    text.writeln('-----------------------------------');
    text.writeln('${isBM ? 'Harga Hartanah (SPA)' : 'SPA Price'}: ${CurrencyFormatter.format(_price.round())}');
    text.writeln('${isBM ? 'Jumlah Pinjaman' : 'Loan Amount'}: ${CurrencyFormatter.format(_loan.round())}');
    text.writeln('-----------------------------------');
    text.writeln('📋 *${isBM ? 'Perjanjian Jual Beli (SPA)' : 'Sale & Purchase Agreement (SPA)'}*:');
    text.writeln('• ${isBM ? 'Duti Setem SPA (MOT)' : 'SPA Stamp Duty (MOT)'}: ${CurrencyFormatter.format(res.spaStampDuty.round())} ${res.isFirstHomeBuyer ? (isBM ? '(Pengecualian Rumah Pertama)' : '(First Home Relief)') : ''}');
    text.writeln('• ${isBM ? 'Yuran Guaman SPA' : 'SPA Legal Fees'}: ${CurrencyFormatter.format(res.spaLegalFees.round())}');
    text.writeln('-----------------------------------');
    text.writeln('📋 *${isBM ? 'Perjanjian Pinjaman Bank' : 'Loan Facility Agreement'}*:');
    text.writeln('• ${isBM ? 'Duti Setem Pinjaman (0.5%)' : 'Loan Stamp Duty (0.5%)'}: ${CurrencyFormatter.format(res.loanStampDuty.round())}');
    text.writeln('• ${isBM ? 'Yuran Guaman Pinjaman' : 'Loan Legal Fees'}: ${CurrencyFormatter.format(res.loanLegalFees.round())}');
    text.writeln('• ${isBM ? 'Anggaran Perbelanjaan Pelbagai' : 'Disbursements Est.'}: ${CurrencyFormatter.format(res.disbursementsEst.round())}');
    text.writeln('-----------------------------------');
    text.writeln('💰 *${isBM ? 'JUMLAH KOS GUAMAN & SETEM' : 'TOTAL LEGAL & STAMP DUTIES'}*: ${CurrencyFormatter.format(res.totalLegalAndDuties.round())}');
    text.writeln(isBM ? '\n_Disediakan melalui aplikasi Umi Property Suite_' : '\n_Generated via Umi Property Suite_');

    final uri = Uri.parse('whatsapp://send?text=${Uri.encodeComponent(text.toString())}');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    } else {
      Clipboard.setData(ClipboardData(text: text.toString()));
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(isBM ? 'Disalin ke papan keratan.' : 'Copied to clipboard.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;
    final res = _result;

    return ListView(
      physics: const ClampingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        // Parameters Card
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isBM ? 'Maklumat Transaksi Guaman' : 'Legal Transaction Details',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 14),

              _buildTextInput(
                label: isBM ? 'Harga Pembelian SPA' : 'Purchase Price (SPA)',
                controller: _priceController,
                prefix: 'RM ',
                colors: colors,
              ),
              const SizedBox(height: 12),

              _buildTextInput(
                label: isBM ? 'Jumlah Pinjaman Bank' : 'Bank Loan Amount',
                controller: _loanController,
                prefix: 'RM ',
                colors: colors,
              ),
              const SizedBox(height: 14),

              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _isFirstHomeBuyer,
                activeColor: colors.maroonPrimary,
                onChanged: (v) => setState(() => _isFirstHomeBuyer = v),
                title: Text(
                  isBM ? 'Pembeli Rumah Pertama' : 'First-Time Home Buyer',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textPrimary),
                ),
                subtitle: Text(
                  isBM ? 'Dikecualikan 100% MOT <= RM500k, 75% RM500k-1M' : '100% MOT exemption <= RM500k, 75% RM500k-1M',
                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Grand Total Card (RepaintBoundary for 120Hz smooth scrolling)
        RepaintBoundary(
          child: Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: colors.isDark
                    ? [const Color(0xFF261019), const Color(0xFF16080E)]
                    : [const Color(0xFF881337), const Color(0xFF5A0820)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(20),
              border: Border.all(
                color: colors.isDark
                    ? const Color(0xFFE11D48).withOpacity(0.35)
                    : const Color(0xFFBE123C).withOpacity(0.4),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: (colors.isDark ? Colors.black : const Color(0xFF881337)).withOpacity(0.35),
                  blurRadius: 18,
                  offset: const Offset(0, 8),
                ),
              ],
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isBM ? 'ANGGARAN KESELURUHAN KOS GUAMAN & SETEM' : 'TOTAL ESTIMATED LEGAL & DUTIES',
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    color: colors.isDark ? const Color(0xFFFDA4AF) : const Color(0xFFFFCCD5),
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  CurrencyFormatter.format(res.totalLegalAndDuties.round()),
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isBM ? 'Berasaskan skala Solicitors Remuneration Order (SRO 2023)' : 'Based on Solicitors Remuneration Order (SRO 2023)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: colors.isDark ? const Color(0xFFCBD5E1) : Colors.white.withOpacity(0.85),
                  ),
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Detailed Cost Breakdown
        Container(
          padding: const EdgeInsets.all(18),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(18),
            border: Border.all(color: colors.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isBM ? 'Pecahan Yuran Peguam & Lembaga Hasil' : 'Legal & LHDN Stamp Duty Breakdown',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 14),

              Text(
                isBM ? '1. Perjanjian Jual Beli (SPA)' : '1. Sale & Purchase Agreement (SPA)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
              ),
              const SizedBox(height: 8),
              _buildBreakdownRow(
                label: isBM ? 'Duti Setem SPA (MOT)' : 'SPA Stamp Duty (MOT)',
                value: CurrencyFormatter.format(res.spaStampDuty.round()),
                colors: colors,
                tag: res.isFirstHomeBuyer && res.propertyPrice <= 1000000 ? (isBM ? 'Jimat MOT' : 'Relief') : null,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Yuran Guaman SPA' : 'SPA Legal Fees',
                value: CurrencyFormatter.format(res.spaLegalFees.round()),
                colors: colors,
              ),
              const SizedBox(height: 12),
              const Divider(height: 1),
              const SizedBox(height: 12),

              Text(
                isBM ? '2. Perjanjian Pinjaman Bank' : '2. Bank Loan Agreement',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
              ),
              const SizedBox(height: 8),
              _buildBreakdownRow(
                label: isBM ? 'Duti Setem Pinjaman (0.5%)' : 'Loan Stamp Duty (0.5%)',
                value: CurrencyFormatter.format(res.loanStampDuty.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Yuran Guaman Pinjaman' : 'Loan Legal Fees',
                value: CurrencyFormatter.format(res.loanLegalFees.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Anggaran Perbelanjaan Pelbagai' : 'Disbursements Est.',
                value: CurrencyFormatter.format(res.disbursementsEst.round()),
                colors: colors,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Share Button
        ElevatedButton.icon(
          onPressed: _shareLegal,
          icon: const Icon(Icons.share_outlined, size: 18),
          label: Text(
            isBM ? 'KONGSI SEBUTHARGA GUAMAN (WHATSAPP)' : 'SHARE LEGAL QUOTE (WHATSAPP)',
            style: const TextStyle(fontWeight: FontWeight.bold, letterSpacing: 0.5),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: colors.maroonPrimary,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          ),
        ),
      ],
    );
  }

  Widget _buildTextInput({
    required String label,
    required TextEditingController controller,
    String? prefix,
    required AppThemeColors colors,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.textSecondary)),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          keyboardType: TextInputType.number,
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
          decoration: InputDecoration(
            prefixText: prefix,
            prefixStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
            filled: true,
            fillColor: colors.canvas,
            contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.maroonPrimary, width: 1.5)),
          ),
        ),
      ],
    );
  }

  Widget _buildBreakdownRow({
    required String label,
    required String value,
    required AppThemeColors colors,
    String? tag,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(label, style: TextStyle(fontSize: 12, color: colors.textSecondary)),
              if (tag != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    tag,
                    style: const TextStyle(fontSize: 9, fontWeight: FontWeight.bold, color: Color(0xFF10B981)),
                  ),
                ),
              ],
            ],
          ),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: colors.textPrimary)),
        ],
      ),
    );
  }
}
