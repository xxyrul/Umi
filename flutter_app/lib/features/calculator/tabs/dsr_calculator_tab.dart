import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../domain/calculator_engine.dart';
import '../domain/calculator_models.dart';

class DsrCalculatorTab extends StatefulWidget {
  final bool isBM;

  const DsrCalculatorTab({super.key, required this.isBM});

  @override
  State<DsrCalculatorTab> createState() => _DsrCalculatorTabState();
}

class _DsrCalculatorTabState extends State<DsrCalculatorTab> {
  // Input Controllers
  final _incomeController = TextEditingController(text: '6,000');
  final _carController = TextEditingController(text: '600');
  final _housingController = TextEditingController(text: '0');
  final _creditCardController = TextEditingController(text: '150');
  final _personalLoanController = TextEditingController(text: '0');
  final _ptptnController = TextEditingController(text: '150');

  double _income = 6000;
  double _car = 600;
  double _housing = 0;
  double _creditCard = 150;
  double _personal = 0;
  double _ptptn = 150;

  double _dsrLimitPercent = 70.0;
  final double _interestRate = 4.20;
  final int _tenureYears = 30;

  @override
  void initState() {
    super.initState();
    _incomeController.addListener(() => _updateNum(_incomeController, (v) => _income = v));
    _carController.addListener(() => _updateNum(_carController, (v) => _car = v));
    _housingController.addListener(() => _updateNum(_housingController, (v) => _housing = v));
    _creditCardController.addListener(() => _updateNum(_creditCardController, (v) => _creditCard = v));
    _personalLoanController.addListener(() => _updateNum(_personalLoanController, (v) => _personal = v));
    _ptptnController.addListener(() => _updateNum(_ptptnController, (v) => _ptptn = v));
  }

  void _updateNum(TextEditingController ctrl, void Function(double) setter) {
    final clean = ctrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    final val = double.tryParse(clean) ?? 0;
    setState(() => setter(val));
  }

  @override
  void dispose() {
    _incomeController.dispose();
    _carController.dispose();
    _housingController.dispose();
    _creditCardController.dispose();
    _personalLoanController.dispose();
    _ptptnController.dispose();
    super.dispose();
  }

  DsrResult get _result => CalculatorEngine.calculateDsr(
        netIncome: _income,
        dsrLimitPercent: _dsrLimitPercent,
        carLoan: _car,
        housingLoan: _housing,
        creditCard: _creditCard,
        personalLoan: _personal,
        ptptnOther: _ptptn,
        interestRate: _interestRate,
        tenureYears: _tenureYears,
      );

  void _shareDsr() async {
    final res = _result;
    final isBM = widget.isBM;
    final text = StringBuffer();

    text.writeln(isBM ? '📊 *ANALISIS KELAYAKAN DSR PEMBELI*' : '📊 *BUYER DSR ELIGIBILITY ANALYSIS*');
    text.writeln('-----------------------------------');
    text.writeln('${isBM ? 'Pendapatan Bersih' : 'Net Monthly Income'}: ${CurrencyFormatter.format(_income.round())}');
    text.writeln('${isBM ? 'Jumlah Komitmen Semasa' : 'Total Commitments'}: ${CurrencyFormatter.format(res.totalExistingCommitments.round())}');
    text.writeln('• ${isBM ? 'Kereta' : 'Car Loan'}: ${CurrencyFormatter.format(_car.round())}');
    if (_housing > 0) text.writeln('• ${isBM ? 'Rumah Sedia Ada' : 'Housing'}: ${CurrencyFormatter.format(_housing.round())}');
    if (_creditCard > 0) text.writeln('• ${isBM ? 'Kad Kredit' : 'Credit Card'}: ${CurrencyFormatter.format(_creditCard.round())}');
    if (_personal > 0) text.writeln('• ${isBM ? 'Pinjaman Peribadi' : 'Personal Loan'}: ${CurrencyFormatter.format(_personal.round())}');
    if (_ptptn > 0) text.writeln('• ${isBM ? 'PTPTN/Lain-lain' : 'PTPTN/Others'}: ${CurrencyFormatter.format(_ptptn.round())}');
    text.writeln('-----------------------------------');
    text.writeln('${isBM ? 'Nisbah DSR Semasa' : 'Current DSR'}: ${res.currentDsrPercent.toStringAsFixed(1)}% (Had Bank: ${_dsrLimitPercent.toInt()}%)');
    text.writeln('${isBM ? 'Status Kelayakan' : 'Status'}: ${res.localizedStatusLabel(isBM)}');
    text.writeln('-----------------------------------');
    text.writeln('💰 *${isBM ? 'Baki Had Ansuran Rumah' : 'Max Housing Installment'}*: ${CurrencyFormatter.format(res.maxAllowableHousingInstallment.round())} / ${isBM ? 'bulan' : 'month'}');
    text.writeln('🏡 *${isBM ? 'Harga Rumah Mampu Milik' : 'Max Affordable Property'}*: ${CurrencyFormatter.format(res.maxEligiblePropertyPrice.round())}');
    text.writeln(isBM ? '\n_Dianalisis melalui aplikasi Umi Property Suite_' : '\n_Analyzed via Umi Property Suite_');

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

    Color statusColor;
    if (res.status == DsrStatus.eligible) {
      statusColor = const Color(0xFF10B981); // Green
    } else if (res.status == DsrStatus.moderate) {
      statusColor = const Color(0xFFF59E0B); // Amber
    } else {
      statusColor = const Color(0xFFEF4444); // Red
    }

    return ListView(
      physics: const ClampingScrollPhysics(),
      keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
      padding: EdgeInsets.fromLTRB(16, 16, 16, 32 + MediaQuery.paddingOf(context).bottom),
      children: [
        // Income & Commitments Card
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
                isBM ? 'Pendapatan & Komitmen Bulanan' : 'Income & Monthly Commitments',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 14),

              // Net Income
              _buildTextInput(
                label: isBM ? 'Pendapatan Bersih Bulanan (Gaji Bersih)' : 'Net Monthly Income (After EPF/SOCSO)',
                controller: _incomeController,
                prefix: 'RM ',
                keyboardType: TextInputType.number,
                colors: colors,
              ),
              const SizedBox(height: 14),

              Text(
                isBM ? 'Senarai Komitmen Dalam CCRIS / CTOS' : 'Existing Commitments (CCRIS/CTOS)',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSecondary),
              ),
              const SizedBox(height: 8),

              // Commitments 2-column grid
              Row(
                children: [
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Ansuran Kereta' : 'Car Loan',
                      controller: _carController,
                      prefix: 'RM ',
                      keyboardType: TextInputType.number,
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Pinjaman Rumah Sedia Ada' : 'Housing Loan',
                      controller: _housingController,
                      prefix: 'RM ',
                      keyboardType: TextInputType.number,
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Kad Kredit (Min 5%)' : 'Credit Card (5%)',
                      controller: _creditCardController,
                      prefix: 'RM ',
                      keyboardType: TextInputType.number,
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Pinjaman Peribadi' : 'Personal Loan',
                      controller: _personalLoanController,
                      prefix: 'RM ',
                      keyboardType: TextInputType.number,
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              _buildTextInput(
                label: isBM ? 'PTPTN / Komitmen Lain' : 'PTPTN / Other Financing',
                controller: _ptptnController,
                prefix: 'RM ',
                keyboardType: TextInputType.number,
                colors: colors,
              ),
              const SizedBox(height: 16),

              // DSR Limit Selector
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    isBM ? 'Had Kelayakan DSR Bank' : 'Bank DSR Threshold',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.textSecondary),
                  ),
                  Text(
                    '${_dsrLimitPercent.toInt()}%',
                    style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: [
                  _buildDsrLimitPill(60, isBM ? '60% (Ketat)' : '60% (Strict)', colors),
                  const SizedBox(width: 8),
                  _buildDsrLimitPill(70, isBM ? '70% (Standard)' : '70% (Normal)', colors),
                  const SizedBox(width: 8),
                  _buildDsrLimitPill(85, isBM ? '85% (Tinggi)' : '85% (High Inc)', colors),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Results Card (RepaintBoundary for 120Hz smooth scrolling)
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
                    ? statusColor.withOpacity(0.5)
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
                      isBM ? 'KEPUTUSAN KELAYAKAN DSR' : 'DSR ELIGIBILITY STATUS',
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
                        color: statusColor.withOpacity(0.2),
                        border: Border.all(color: statusColor.withOpacity(0.6), width: 1.2),
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Text(
                        res.localizedStatusLabel(isBM),
                        style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.w800),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // DSR percentage meter
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Text(
                      '${res.currentDsrPercent.toStringAsFixed(1)}%',
                      style: const TextStyle(fontSize: 34, fontWeight: FontWeight.w900, color: Colors.white, letterSpacing: -0.5),
                    ),
                    Text(
                      '${isBM ? "Maksimum had" : "Max limit"}: ${_dsrLimitPercent.toInt()}%',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: colors.isDark ? const Color(0xFFCBD5E1) : Colors.white70),
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                ClipRRect(
                  borderRadius: BorderRadius.circular(6),
                  child: LinearProgressIndicator(
                    value: (res.currentDsrPercent / 100).clamp(0.0, 1.0),
                    backgroundColor: colors.isDark ? const Color(0xFF334155) : Colors.white24,
                    valueColor: AlwaysStoppedAnimation<Color>(statusColor),
                    minHeight: 8,
                  ),
                ),
                const SizedBox(height: 16),
                Divider(
                  color: colors.isDark ? const Color(0xFFE11D48).withOpacity(0.25) : Colors.white24,
                  height: 1,
                ),
                const SizedBox(height: 16),

                // Max affordable property & installment
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    _buildResultMetric(
                      label: isBM ? 'Baki Ansuran Layak' : 'Max Monthly Installment',
                      value: '${CurrencyFormatter.format(res.maxAllowableHousingInstallment.round())} ${isBM ? "/bln" : "/mo"}',
                      colors: colors,
                    ),
                    _buildResultMetric(
                      label: isBM ? 'Harga Rumah Mampu Milik' : 'Max Affordable Property',
                      value: CurrencyFormatter.format(res.maxEligiblePropertyPrice.round()),
                      colors: colors,
                      valueColor: colors.isDark ? const Color(0xFF34D399) : const Color(0xFF6EE7B7),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Summary Breakdown Card
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
                isBM ? 'Ringkasan Kapasiti Kewangan' : 'Financial Capacity Summary',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 12),
              _buildBreakdownRow(
                label: isBM ? 'Gaji Bersih' : 'Net Income',
                value: CurrencyFormatter.format(_income.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Jumlah Komitmen Semasa' : 'Total Commitments',
                value: CurrencyFormatter.format(res.totalExistingCommitments.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Kapasiti Komitmen Maksimum' : 'Max Total Commitment Allowed',
                value: CurrencyFormatter.format(res.maxTotalAllowableCommitment.round()),
                colors: colors,
              ),
              _buildBreakdownRow(
                label: isBM ? 'Anggaran Pinjaman Maksimum' : 'Max Eligible Loan (90%)',
                value: CurrencyFormatter.format(res.maxEligibleLoanAmount.round()),
                colors: colors,
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Share Button
        ElevatedButton.icon(
          onPressed: _shareDsr,
          icon: const Icon(Icons.share_outlined, size: 18),
          label: Text(
            isBM ? 'KONGSI ANALISIS DSR (WHATSAPP)' : 'SHARE DSR ANALYSIS (WHATSAPP)',
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

  Widget _buildDsrLimitPill(double pct, String label, AppThemeColors colors) {
    final isSelected = _dsrLimitPercent == pct;
    return Expanded(
      child: InkWell(
        onTap: () => setState(() => _dsrLimitPercent = pct),
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
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.bold,
              color: isSelected ? Colors.white : colors.textPrimary,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTextInput({
    required String label,
    required TextEditingController controller,
    String? prefix,
    required TextInputType keyboardType,
    required AppThemeColors colors,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: TextStyle(fontSize: 11, fontWeight: FontWeight.w600, color: colors.textSecondary)),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
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
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 5),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: TextStyle(fontSize: 12, color: colors.textSecondary)),
          Text(value, style: TextStyle(fontSize: 13, fontWeight: FontWeight.bold, color: colors.textPrimary)),
        ],
      ),
    );
  }
}
