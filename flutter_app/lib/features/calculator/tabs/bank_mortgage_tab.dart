import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../domain/calculator_engine.dart';
import '../domain/calculator_models.dart';

class BankMortgageTab extends StatefulWidget {
  final bool isBM;

  const BankMortgageTab({super.key, required this.isBM});

  @override
  State<BankMortgageTab> createState() => _BankMortgageTabState();
}

class _BankMortgageTabState extends State<BankMortgageTab> {
  // Controllers
  final _priceController = TextEditingController(text: '500,000');
  final _discountController = TextEditingController(text: '0');
  final _rateController = TextEditingController(text: '4.20');
  final _tenureController = TextEditingController(text: '30');

  PropertyCategory _category = PropertyCategory.subsale;
  double _propertyPrice = 500000;
  double _downPaymentPercent = 10;
  double _developerDiscountPercent = 0;
  double _interestRate = 4.20;
  int _tenureYears = 30;
  bool _isFirstHomeBuyer = false;
  final bool _freeSpaLegal = false;
  final bool _freeSpaMot = false;
  final bool _freeLoanLegal = false;
  final bool _freeLoanStampDuty = false;
  bool _includeMrtt = true;
  final bool _financeMrtt = true;
  final bool _includeFireInsurance = true;

  @override
  void initState() {
    super.initState();
    _priceController.addListener(_onPriceChanged);
    _discountController.addListener(_onDiscountChanged);
    _rateController.addListener(_onRateChanged);
    _tenureController.addListener(_onTenureChanged);
  }

  void _onPriceChanged() {
    final clean = _priceController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final val = double.tryParse(clean) ?? 0;
    if (val != _propertyPrice) {
      setState(() => _propertyPrice = val);
    }
  }

  void _onDiscountChanged() {
    final clean = _discountController.text.replaceAll(RegExp(r'[^0-9.]'), '');
    final val = double.tryParse(clean) ?? 0;
    if (val != _developerDiscountPercent) {
      setState(() => _developerDiscountPercent = val);
    }
  }

  void _onRateChanged() {
    final clean = _rateController.text.replaceAll(RegExp(r'[^0-9.]'), '');
    final val = double.tryParse(clean) ?? 0;
    if (val != _interestRate) {
      setState(() => _interestRate = val);
    }
  }

  void _onTenureChanged() {
    final clean = _tenureController.text.replaceAll(RegExp(r'[^0-9]'), '');
    final val = int.tryParse(clean) ?? 30;
    if (val != _tenureYears) {
      setState(() => _tenureYears = val);
    }
  }

  @override
  void dispose() {
    _priceController.dispose();
    _discountController.dispose();
    _rateController.dispose();
    _tenureController.dispose();
    super.dispose();
  }

  MortgageResult get _result => CalculatorEngine.calculateMortgage(
        propertyPrice: _propertyPrice,
        category: _category,
        downPaymentPercent: _downPaymentPercent,
        developerDiscountPercent: _developerDiscountPercent,
        interestRateAnnual: _interestRate,
        tenureYears: _tenureYears,
        isFirstHomeBuyer: _isFirstHomeBuyer,
        freeSpaLegal: _freeSpaLegal,
        freeSpaMot: _freeSpaMot,
        freeLoanLegal: _freeLoanLegal,
        freeLoanStampDuty: _freeLoanStampDuty,
        includeMrtt: _includeMrtt,
        financeMrtt: _financeMrtt,
        includeFireInsurance: _includeFireInsurance,
      );

  void _shareSummary() async {
    final res = _result;
    final isBM = widget.isBM;
    final text = StringBuffer();

    text.writeln(isBM ? '📊 *RINGKASAN ANGGARAN PINJAMAN RUMAH*' : '📊 *HOME LOAN ESTIMATION SUMMARY*');
    text.writeln('-----------------------------------');
    text.writeln('${isBM ? 'Kategori' : 'Category'}: ${res.category == PropertyCategory.newLaunch ? (isBM ? 'Projek Baru (New Launch)' : 'New Launch Project') : (isBM ? 'Subsale (Rumah Sekunder)' : 'Subsale Property')}');
    text.writeln('${isBM ? 'Harga Hartanah' : 'Property Price'}: ${CurrencyFormatter.format(res.propertyPrice.round())}');
    if (res.category == PropertyCategory.newLaunch && res.developerDiscountAmount > 0) {
      text.writeln('${isBM ? 'Rebat Pemaju' : 'Developer Rebate'}: ${CurrencyFormatter.format(res.developerDiscountAmount.round())} (${res.developerDiscountPercent}%)');
      text.writeln('${isBM ? 'Harga Bersih' : 'Net Purchase Price'}: ${CurrencyFormatter.format(res.netPurchasePrice.round())}');
    }
    text.writeln('${isBM ? 'Jumlah Pinjaman' : 'Loan Amount'}: ${CurrencyFormatter.format(res.loanAmount.round())}');
    text.writeln('${isBM ? 'Kadar Faedah' : 'Interest Rate'}: ${_interestRate.toStringAsFixed(2)}% | ${isBM ? 'Tempoh' : 'Tenure'}: $_tenureYears ${isBM ? 'Tahun' : 'Years'}');
    text.writeln('-----------------------------------');
    text.writeln('💰 *${isBM ? 'Ansuran Bulanan' : 'Monthly Installment'}*: ${CurrencyFormatter.format(res.monthlyInstallmentWithInsurance.round())} / ${isBM ? 'bulan' : 'month'}');
    text.writeln('💵 *${isBM ? 'Jumlah Tunai Awal (Upfront)' : 'Total Upfront Cash'}*: ${CurrencyFormatter.format(res.totalUpfrontWithInsurance.round())}');
    text.writeln('-----------------------------------');
    text.writeln('📋 *${isBM ? 'Pecahan Kos Awal' : 'Upfront Breakdown'}*:');
    text.writeln('• ${isBM ? 'Deposit' : 'Downpayment'}: ${CurrencyFormatter.format(res.downPaymentAmount.round())}');
    text.writeln('• ${isBM ? 'Duti Setem SPA (MOT)' : 'SPA Stamp Duty'}: ${CurrencyFormatter.format(res.stampDuty.round())} ${res.isFirstHomeBuyer ? (isBM ? '(Pengecualian Rumah Pertama)' : '(First Home Relief)') : ''}');
    text.writeln('• ${isBM ? 'Yuran Guaman SPA' : 'SPA Legal Fees'}: ${CurrencyFormatter.format(res.legalFees.round())}');
    text.writeln('• ${isBM ? 'Duti Setem Pinjaman' : 'Loan Stamp Duty'}: ${CurrencyFormatter.format(res.loanStampDuty.round())}');
    text.writeln('• ${isBM ? 'Yuran Guaman Pinjaman' : 'Loan Legal Fees'}: ${CurrencyFormatter.format(res.loanLegalFees.round())}');
    if (res.valuationFee > 0) {
      text.writeln('• ${isBM ? 'Yuran Penilaian Bank' : 'Bank Valuation Fee'}: ${CurrencyFormatter.format(res.valuationFee.round())}');
    }
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
        // Category Selector (Subsale vs New Launch)
        Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(14),
            border: Border.all(color: colors.border),
          ),
          child: Row(
            children: [
              Expanded(
                child: _buildCategoryPill(
                  title: isBM ? 'Subsale (Sekunder)' : 'Subsale',
                  icon: Icons.home_outlined,
                  isSelected: _category == PropertyCategory.subsale,
                  colors: colors,
                  onTap: () => setState(() => _category = PropertyCategory.subsale),
                ),
              ),
              Expanded(
                child: _buildCategoryPill(
                  title: isBM ? 'Projek Baru (New Launch)' : 'New Launch',
                  icon: Icons.apartment_outlined,
                  isSelected: _category == PropertyCategory.newLaunch,
                  colors: colors,
                  onTap: () => setState(() => _category = PropertyCategory.newLaunch),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Inputs Card
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
                isBM ? 'Maklumat Pinjaman' : 'Loan Parameters',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 14),

              // Property Price Input
              _buildTextInput(
                label: isBM ? 'Harga Hartanah (SPA Price)' : 'Property Price (SPA)',
                controller: _priceController,
                prefix: 'RM ',
                keyboardType: TextInputType.number,
                colors: colors,
              ),
              const SizedBox(height: 14),

              // If New Launch: Developer Rebate
              if (_category == PropertyCategory.newLaunch) ...[
                _buildTextInput(
                  label: isBM ? 'Diskaun / Rebat Pemaju (%)' : 'Developer Rebate / Discount (%)',
                  controller: _discountController,
                  suffix: '%',
                  keyboardType: const TextInputType.numberWithOptions(decimal: true),
                  colors: colors,
                ),
                const SizedBox(height: 14),
              ],

              // Downpayment percentage selector
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isBM ? 'Deposit / Wang Pendahuluan' : 'Downpayment',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSecondary),
                  ),
                  Text(
                    '${_downPaymentPercent.toInt()}% (${CurrencyFormatter.format(res.downPaymentAmount.round())})',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [0, 5, 10, 15, 20].map((pct) {
                  final isSelected = _downPaymentPercent == pct;
                  return Expanded(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(horizontal: 2),
                      child: InkWell(
                        onTap: () => setState(() => _downPaymentPercent = pct.toDouble()),
                        borderRadius: BorderRadius.circular(8),
                        child: Container(
                          padding: const EdgeInsets.symmetric(vertical: 8),
                          decoration: BoxDecoration(
                            color: isSelected ? colors.maroonPrimary : colors.canvas,
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
                          ),
                          alignment: Alignment.center,
                          child: Text(
                            '$pct%',
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.bold,
                              color: isSelected ? Colors.white : colors.textPrimary,
                            ),
                          ),
                        ),
                      ),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),

              // Interest Rate & Tenure Row
              Row(
                children: [
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Kadar Faedah (%)' : 'Interest Rate (%)',
                      controller: _rateController,
                      suffix: '%',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Tempoh (Tahun)' : 'Tenure (Years)',
                      controller: _tenureController,
                      suffix: isBM ? 'Thn' : 'Yrs',
                      keyboardType: TextInputType.number,
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // First-time buyer switch
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
                  isBM ? 'Pengecualian 100% MOT <= RM500k, 75% RM500k-1M' : '100% MOT exemption <= RM500k, 75% RM500k-1M',
                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                ),
              ),

              // Insurance switches
              SwitchListTile.adaptive(
                contentPadding: EdgeInsets.zero,
                value: _includeMrtt,
                activeColor: colors.maroonPrimary,
                onChanged: (v) => setState(() => _includeMrtt = v),
                title: Text(
                  isBM ? 'Anggaran Takaful / MRTT' : 'MRTT / MLTT Insurance Estimate',
                  style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: colors.textPrimary),
                ),
                subtitle: Text(
                  _includeMrtt
                      ? '${CurrencyFormatter.format(res.mrttEstimate.round())} (${_financeMrtt ? (isBM ? "Dimasuk dlm pinjaman" : "Financed into loan") : (isBM ? "Bayar tunai" : "Cash upfront")})'
                      : (isBM ? 'Dikecualikan' : 'Excluded'),
                  style: TextStyle(fontSize: 11, color: colors.textMuted),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Key Result Card (RepaintBoundary for 120Hz smooth scrolling)
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
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      isBM ? 'ANGGARAN BULANAN' : 'ESTIMATED MONTHLY',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        color: colors.isDark ? const Color(0xFFFDA4AF) : const Color(0xFFFFCCD5),
                        letterSpacing: 1.2,
                      ),
                    ),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: colors.isDark ? const Color(0xFFE11D48).withOpacity(0.2) : Colors.white.withOpacity(0.18),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(
                          color: colors.isDark ? const Color(0xFFE11D48).withOpacity(0.5) : Colors.white30,
                        ),
                      ),
                      child: Text(
                        '${_interestRate.toStringAsFixed(2)}% | $_tenureYears${isBM ? "thn" : "y"}',
                        style: TextStyle(
                          color: colors.isDark ? const Color(0xFFFFE4E6) : Colors.white,
                          fontSize: 11,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                Text(
                  CurrencyFormatter.format(res.monthlyInstallmentWithInsurance.round()),
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isBM ? 'setiap bulan (termasuk faedah bank)' : 'per month (including bank interest)',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w500,
                    color: colors.isDark ? const Color(0xFFCBD5E1) : Colors.white.withOpacity(0.85),
                  ),
                ),
                const SizedBox(height: 16),
                Divider(
                  color: colors.isDark ? const Color(0xFFE11D48).withOpacity(0.25) : Colors.white24,
                  height: 1,
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildResultMetric(
                      label: isBM ? 'Tunai Awal (Upfront)' : 'Total Upfront Cash',
                      value: CurrencyFormatter.format(res.totalUpfrontWithInsurance.round()),
                      colors: colors,
                    ),
                    _buildResultMetric(
                      label: isBM ? 'Gaji Minimum (60% DSR)' : 'Min. Salary (60% DSR)',
                      value: CurrencyFormatter.format(res.recommendedIncome.round()),
                      colors: colors,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Upfront Cash Breakdown
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
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isBM ? 'Pecahan Kos Pembelian' : 'Cost Breakdown',
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
                  ),
                  Text(
                    CurrencyFormatter.format(res.totalUpfrontWithInsurance.round()),
                    style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 14),
              _buildBreakdownRow(
                label: isBM ? 'Deposit Hartanah' : 'Downpayment',
                value: CurrencyFormatter.format(res.downPaymentAmount.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Duti Setem SPA (MOT)' : 'SPA Stamp Duty (MOT)',
                value: CurrencyFormatter.format(res.stampDuty.round()),
                colors: colors,
                discountBadge: res.isFirstHomeBuyer && res.propertyPrice <= 1000000 ? (isBM ? 'Jimat MOT' : 'Relief') : null,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Yuran Guaman SPA' : 'SPA Legal Fees',
                value: CurrencyFormatter.format(res.legalFees.round()),
                colors: colors,
              ),
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
              if (res.valuationFee > 0)
                _buildBreakdownRow(
                  label: isBM ? 'Yuran Penilaian Bank' : 'Valuation Fee',
                  value: CurrencyFormatter.format(res.valuationFee.round()),
                  colors: colors,
                ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Share Button
        ElevatedButton.icon(
          onPressed: _shareSummary,
          icon: const Icon(Icons.share_outlined, size: 18),
          label: Text(
            isBM ? 'KONGSI SEBUTHARGA (WHATSAPP)' : 'SHARE QUOTE (WHATSAPP)',
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

  Widget _buildCategoryPill({
    required String title,
    required IconData icon,
    required bool isSelected,
    required AppThemeColors colors,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(10),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? colors.maroonPrimary : Colors.transparent,
          borderRadius: BorderRadius.circular(10),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 16, color: isSelected ? Colors.white : colors.textMuted),
            const SizedBox(width: 6),
            Text(
              title,
              style: TextStyle(
                fontSize: 12,
                fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
                color: isSelected ? Colors.white : colors.textSecondary,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTextInput({
    required String label,
    required TextEditingController controller,
    String? prefix,
    String? suffix,
    required TextInputType keyboardType,
    required AppThemeColors colors,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSecondary)),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 14),
          decoration: InputDecoration(
            prefixText: prefix,
            suffixText: suffix,
            prefixStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
            suffixStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
            filled: true,
            fillColor: colors.canvas,
            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            border: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.border)),
            enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.border)),
            focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(10), borderSide: BorderSide(color: colors.maroonPrimary, width: 1.5)),
          ),
        ),
      ],
    );
  }

  Widget _buildResultMetric({
    required String label,
    required String value,
    required AppThemeColors colors,
    Color? valueColor,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: colors.isDark ? const Color(0xFF94A3B8) : Colors.white70,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          value,
          style: TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w800,
            color: valueColor ?? (colors.isDark ? const Color(0xFFF1F5F9) : Colors.white),
          ),
        ),
      ],
    );
  }

  Widget _buildBreakdownRow({
    required String label,
    required String value,
    required AppThemeColors colors,
    String? discountBadge,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Text(label, style: TextStyle(fontSize: 12, color: colors.textSecondary)),
              if (discountBadge != null) ...[
                const SizedBox(width: 6),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.15),
                    borderRadius: BorderRadius.circular(4),
                  ),
                  child: Text(
                    discountBadge,
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
