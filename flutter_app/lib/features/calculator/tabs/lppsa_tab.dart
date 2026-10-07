import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../loan_calculator.dart';

class LppsaTab extends StatefulWidget {
  final bool isBM;

  const LppsaTab({super.key, required this.isBM});

  @override
  State<LppsaTab> createState() => _LppsaTabState();
}

class _LppsaTabState extends State<LppsaTab> {
  final _basicSalaryController = TextEditingController(text: '4,500');
  final _allowanceController = TextEditingController(text: '800');
  final _deductionsController = TextEditingController(text: '1,200');
  final _propertyPriceController = TextEditingController(text: '400,000');
  final _ageController = TextEditingController(text: '32');

  int _basicSalary = 4500;
  int _fixedAllowances = 800;
  int _currentPayslipDeductions = 1200;
  int _propertyPrice = 400000;
  int _borrowerAge = 32;
  String _selectedScheme = 'skim1'; // 'skim1' (60%) or 'skim2' (50%)

  @override
  void initState() {
    super.initState();
    _basicSalaryController.addListener(() => _updateInt(_basicSalaryController, (v) => _basicSalary = v));
    _allowanceController.addListener(() => _updateInt(_allowanceController, (v) => _fixedAllowances = v));
    _deductionsController.addListener(() => _updateInt(_deductionsController, (v) => _currentPayslipDeductions = v));
    _propertyPriceController.addListener(() => _updateInt(_propertyPriceController, (v) => _propertyPrice = v));
    _ageController.addListener(() => _updateInt(_ageController, (v) => _borrowerAge = v));
  }

  void _updateInt(TextEditingController ctrl, void Function(int) setter) {
    final clean = ctrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    final val = int.tryParse(clean) ?? 0;
    setState(() => setter(val));
  }

  @override
  void dispose() {
    _basicSalaryController.dispose();
    _allowanceController.dispose();
    _deductionsController.dispose();
    _propertyPriceController.dispose();
    _ageController.dispose();
    super.dispose();
  }

  LPPSACalculationResult get _result => LoanCalculator.calculateLPPSA(
        basicSalary: _basicSalary,
        fixedAllowances: _fixedAllowances,
        currentPayslipDeductions: _currentPayslipDeductions,
        propertyPrice: _propertyPrice,
        borrowerAge: _borrowerAge,
        scheme: _selectedScheme,
      );

  void _shareLppsa() async {
    final res = _result;
    final isBM = widget.isBM;
    final text = StringBuffer();

    text.writeln(isBM ? '🏛️ *ANALISIS KELAYAKAN PINJAMAN KERAJAAN (LPPSA)*' : '🏛️ *GOV LOAN ELIGIBILITY ANALYSIS (LPPSA)*');
    text.writeln('-----------------------------------');
    text.writeln('${isBM ? 'Gaji Hakiki' : 'Basic Salary'}: ${CurrencyFormatter.format(_basicSalary)}');
    text.writeln('${isBM ? 'Elaun Tetap' : 'Fixed Allowance'}: ${CurrencyFormatter.format(_fixedAllowances)}');
    text.writeln('${isBM ? 'Potongan Slip Gaji' : 'Current Deductions'}: ${CurrencyFormatter.format(_currentPayslipDeductions)}');
    text.writeln('${isBM ? 'Skim Permohonan' : 'Scheme'}: ${_selectedScheme == 'skim1' ? (isBM ? 'Skim 1 (Skim Pertama - 60%)' : 'Scheme 1 (1st Home - 60%)') : (isBM ? 'Skim 2 (Skim Kedua - 50%)' : 'Scheme 2 (2nd Home - 50%)')}');
    text.writeln('-----------------------------------');
    text.writeln('💰 *${isBM ? 'Kelayakan Pinjaman Maksimum' : 'Max Loan Eligibility'}*: ${CurrencyFormatter.format(res.maxEligibleLoanAmount)}');
    text.writeln('💵 *${isBM ? 'Had Potongan Bulanan' : 'Max Allowable Deduction'}*: ${CurrencyFormatter.format(res.maxAllowableMonthlyDeduction)} / ${isBM ? 'bulan' : 'month'}');
    if (_propertyPrice > 0) {
      text.writeln('${isBM ? 'Harga Dipohon' : 'Target Price'}: ${CurrencyFormatter.format(_propertyPrice)}');
      text.writeln('${isBM ? 'Ansuran Bulanan LPPSA' : 'Monthly Installment'}: ${CurrencyFormatter.format(res.monthlyInstallment)}');
      text.writeln('${isBM ? 'Status Kelayakan' : 'Status'}: ${res.isEligible ? (isBM ? '✅ LAYAK' : '✅ ELIGIBLE') : (isBM ? '❌ MELEBIHI HAD' : '❌ EXCEEDS LIMIT')}');
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
        // Scheme Selector
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
                child: _buildSchemePill(
                  title: isBM ? 'Skim 1 (Pertama - 60%)' : 'Scheme 1 (60%)',
                  isSelected: _selectedScheme == 'skim1',
                  colors: colors,
                  onTap: () => setState(() => _selectedScheme = 'skim1'),
                ),
              ),
              Expanded(
                child: _buildSchemePill(
                  title: isBM ? 'Skim 2 (Kedua - 50%)' : 'Scheme 2 (50%)',
                  isSelected: _selectedScheme == 'skim2',
                  colors: colors,
                  onTap: () => setState(() => _selectedScheme = 'skim2'),
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
                isBM ? 'Maklumat Gaji Kakitangan Awam' : 'Civil Servant Payslip Details',
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              const SizedBox(height: 14),

              Row(
                children: [
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Gaji Hakiki (Pokok)' : 'Basic Salary',
                      controller: _basicSalaryController,
                      prefix: 'RM ',
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Elaun Tetap' : 'Fixed Allowances',
                      controller: _allowanceController,
                      prefix: 'RM ',
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
                      label: isBM ? 'Jumlah Potongan Slip' : 'Current Payslip Deductions',
                      controller: _deductionsController,
                      prefix: 'RM ',
                      colors: colors,
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: _buildTextInput(
                      label: isBM ? 'Umur Peminjam' : 'Borrower Age',
                      controller: _ageController,
                      suffix: isBM ? 'thn' : 'yrs',
                      colors: colors,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),

              _buildTextInput(
                label: isBM ? 'Harga Hartanah Sasaran' : 'Target Property Price',
                controller: _propertyPriceController,
                prefix: 'RM ',
                colors: colors,
              ),
            ],
          ),
        ),
        const SizedBox(height: 18),

        // Result Card (RepaintBoundary for 120Hz smooth scrolling)
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
                      isBM ? 'KELAYAKAN MAKSIMUM LPPSA' : 'MAX LPPSA ELIGIBILITY',
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
                        '${isBM ? "Kadar" : "Rate"} 4.0% | ${res.maxTenureYears} ${isBM ? "Thn" : "Yrs"}',
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
                  CurrencyFormatter.format(res.maxEligibleLoanAmount),
                  style: const TextStyle(
                    fontSize: 34,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  isBM ? 'Kelayakan pembiayaan maksimum kerajaan' : 'Maximum government loan eligibility',
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
                      label: isBM ? 'Had Potongan Sebulan' : 'Max Monthly Deduction',
                      value: CurrencyFormatter.format(res.maxAllowableMonthlyDeduction),
                      colors: colors,
                    ),
                    _buildResultMetric(
                      label: isBM ? 'Baki Bersih Gaji' : 'Net Take-Home Pay',
                      value: CurrencyFormatter.format(res.netTakeHomeAfterLoan),
                      colors: colors,
                    ),
                  ],
                ),
              ],
            ),
          ),
        ),
        const SizedBox(height: 18),

        // Status Card
        if (res.rejectionReason != null)
          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: Colors.redAccent.withOpacity(0.12),
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.redAccent.withOpacity(0.3)),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 20),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    res.rejectionReason!,
                    style: const TextStyle(color: Colors.redAccent, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        const SizedBox(height: 20),

        // Share Button
        ElevatedButton.icon(
          onPressed: _shareLppsa,
          icon: const Icon(Icons.share_outlined, size: 18),
          label: Text(
            isBM ? 'KONGSI KELAYAKAN LPPSA (WHATSAPP)' : 'SHARE LPPSA ELIGIBILITY (WHATSAPP)',
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

  Widget _buildSchemePill({
    required String title,
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
        alignment: Alignment.center,
        child: Text(
          title,
          style: TextStyle(
            fontSize: 11,
            fontWeight: isSelected ? FontWeight.bold : FontWeight.w600,
            color: isSelected ? Colors.white : colors.textSecondary,
          ),
        ),
      ),
    );
  }

  Widget _buildTextInput({
    required String label,
    required TextEditingController controller,
    String? prefix,
    String? suffix,
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
            suffixText: suffix,
            prefixStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
            suffixStyle: TextStyle(color: colors.textMuted, fontWeight: FontWeight.bold),
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
}
