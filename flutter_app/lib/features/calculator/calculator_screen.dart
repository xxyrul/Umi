import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/currency_formatter.dart';

class CalculatorScreen extends ConsumerStatefulWidget {
  final int? initialPrice;

  const CalculatorScreen({super.key, this.initialPrice});

  @override
  ConsumerState<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends ConsumerState<CalculatorScreen> with SingleTickerProviderStateMixin {
  AppThemeColors get colors => context.colors;

  late TabController _tabController;

  // Tab 1: Mortgage State
  final _priceController = TextEditingController(text: '500000');
  double _downPaymentPercent = 10.0;
  double _interestRate = 4.2;
  int _tenureYears = 30;
  bool _isFirstHomeBuyer = true;

  // Tab 2: DSR State
  final _salaryController = TextEditingController(text: '5500');
  final _commitmentsController = TextEditingController(text: '1200');
  double _maxDsrPercent = 70.0;

  // Tab 3: LPPSA State
  final _lppsaBasicSalaryController = TextEditingController(text: '4500');
  final _lppsaAllowanceController = TextEditingController(text: '1150');
  final _lppsaDeductionsController = TextEditingController(text: '800');
  String _lppsaScheme = 'Skim 1 (Pertama)';

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    if (widget.initialPrice != null && widget.initialPrice! > 0) {
      _priceController.text = widget.initialPrice.toString();
    }
  }

  @override
  void dispose() {
    _tabController.dispose();
    _priceController.dispose();
    _salaryController.dispose();
    _commitmentsController.dispose();
    _lppsaBasicSalaryController.dispose();
    _lppsaAllowanceController.dispose();
    _lppsaDeductionsController.dispose();
    super.dispose();
  }

  int _parseAmount(TextEditingController ctrl) {
    final clean = ctrl.text.replaceAll(RegExp(r'[^0-9]'), '');
    return int.tryParse(clean) ?? 0;
  }

  // Monthly Installment formula: M = P * [r(1+r)^n] / [(1+r)^n - 1]
  int _calculateMonthly(int principal, double annualRate, int years) {
    if (principal <= 0 || years <= 0 || annualRate <= 0) return 0;
    final r = (annualRate / 100) / 12;
    final n = years * 12;
    final powVal = pow(1 + r, n).toDouble();
    final monthly = principal * (r * powVal) / (powVal - 1);
    return monthly.round();
  }

  // Malaysian MOT Stamp Duty:
  // First 100k: 1%
  // 100k - 500k: 2%
  // 500k - 1m: 3%
  // > 1m: 4%
  int _calculateMot(int price, bool firstHome) {
    if (firstHome && price <= 500000) return 0; // 100% exemption for first home <= 500k

    int stampDuty = 0;
    if (price > 1000000) {
      stampDuty += ((price - 1000000) * 0.04).round();
      stampDuty += (500000 * 0.03).round();
      stampDuty += (400000 * 0.02).round();
      stampDuty += (100000 * 0.01).round();
    } else if (price > 500000) {
      stampDuty += ((price - 500000) * 0.03).round();
      stampDuty += (400000 * 0.02).round();
      stampDuty += (100000 * 0.01).round();
    } else if (price > 100000) {
      stampDuty += ((price - 100000) * 0.02).round();
      stampDuty += (100000 * 0.01).round();
    } else {
      stampDuty += (price * 0.01).round();
    }
    return stampDuty;
  }

  // Legal fee scale under Solicitors' Remuneration Order (SRO)
  int _calculateLegalFees(int price) {
    if (price <= 500000) {
      return max(500, (price * 0.0125).round());
    } else if (price <= 1000000) {
      return (500000 * 0.0125 + (price - 500000) * 0.01).round();
    } else {
      return (500000 * 0.0125 + 500000 * 0.01 + (price - 1000000) * 0.0075).round();
    }
  }

  void _copyMortgageQuotation({
    required int price,
    required int downpayment,
    required int loanAmount,
    required int monthly,
    required int mot,
    required int legalFee,
    required int loanLegal,
    required int loanStamp,
    required bool isBM,
  }) {
    final text = StringBuffer();
    if (isBM) {
      text.writeln('📑 *ANGGARAN PINJAMAN RUMAH (MORTGAGE QUOTATION)*');
      text.writeln('===============================================');
      text.writeln('🏠 *Harga Hartanah:* ${CurrencyFormatter.format(price)}');
      text.writeln('💵 *Wang Pendahuluan (${_downPaymentPercent.toInt()}%):* ${CurrencyFormatter.format(downpayment)}');
      text.writeln('🏦 *Jumlah Pinjaman (${(100 - _downPaymentPercent).toInt()}%):* ${CurrencyFormatter.format(loanAmount)}');
      text.writeln('📅 *Tempoh:* $_tenureYears Tahun @ $_interestRate% p.a.');
      text.writeln('💳 *Ansuran Bulanan:* ${CurrencyFormatter.format(monthly)} / bulan');
      text.writeln('');
      text.writeln('⚖️ *Anggaran Kos Guaman & Duti Setem:*');
      text.writeln('• Duti Setem MOT: ${mot == 0 ? "RM 0 (Pengecualian 100%)" : CurrencyFormatter.format(mot)}');
      text.writeln('• Yuran Guaman SPA: ${CurrencyFormatter.format(legalFee)}');
      text.writeln('• Yuran Guaman Pinjaman: ${CurrencyFormatter.format(loanLegal)}');
      text.writeln('• Duti Setem Pinjaman (0.5%): ${CurrencyFormatter.format(loanStamp)}');
      text.writeln('===============================================');
      text.writeln('_Disediakan oleh Aplikasi Hartanah Artha_');
    } else {
      text.writeln('📑 *PROPERTY MORTGAGE QUOTATION*');
      text.writeln('===============================================');
      text.writeln('🏠 *Property Price:* ${CurrencyFormatter.format(price)}');
      text.writeln('💵 *Downpayment (${_downPaymentPercent.toInt()}%):* ${CurrencyFormatter.format(downpayment)}');
      text.writeln('🏦 *Loan Amount (${(100 - _downPaymentPercent).toInt()}%):* ${CurrencyFormatter.format(loanAmount)}');
      text.writeln('📅 *Tenure:* $_tenureYears Years @ $_interestRate% p.a.');
      text.writeln('💳 *Monthly Installment:* ${CurrencyFormatter.format(monthly)} / month');
      text.writeln('');
      text.writeln('⚖️ *Estimated Legal Fees & Stamp Duty:*');
      text.writeln('• MOT Stamp Duty: ${mot == 0 ? "RM 0 (100% Exemption)" : CurrencyFormatter.format(mot)}');
      text.writeln('• SPA Legal Fee: ${CurrencyFormatter.format(legalFee)}');
      text.writeln('• Loan Legal Fee: ${CurrencyFormatter.format(loanLegal)}');
      text.writeln('• Loan Stamp Duty (0.5%): ${CurrencyFormatter.format(loanStamp)}');
      text.writeln('===============================================');
      text.writeln('_Generated via Artha Property App_');
    }

    Clipboard.setData(ClipboardData(text: text.toString()));
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(
          isBM
              ? '📋 Sebut harga telah disalin ke papan keratan! Boleh tampal ke WhatsApp.'
              : '📋 Quotation copied to clipboard! Ready to paste into WhatsApp.',
        ),
      ),
    );
  }

  Widget _buildMortgageTab(bool isBM) {
    final price = _parseAmount(_priceController);
    final downpayment = (price * (_downPaymentPercent / 100)).round();
    final loanAmount = max(0, price - downpayment);
    final monthly = _calculateMonthly(loanAmount, _interestRate, _tenureYears);
    final mot = _calculateMot(price, _isFirstHomeBuyer);
    final spaLegal = _calculateLegalFees(price);
    final loanLegal = _calculateLegalFees(loanAmount);
    final loanStamp = (loanAmount * 0.005).round();
    final totalEntryCost = downpayment + mot + spaLegal + loanLegal + loanStamp;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Monthly Hero Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: colors.isDark ? const [Color(0xFF1E2022), Color(0xFF141517)] : [colors.maroonLight, colors.card],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: colors.maroonPrimary.withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Text(
                  isBM ? 'Anggaran Ansuran Bulanan' : 'Estimated Monthly Installment',
                  style: TextStyle(color: colors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  '${CurrencyFormatter.format(monthly)} ${isBM ? '/ bulan' : '/ month'}',
                  style: TextStyle(fontSize: 28, fontWeight: FontWeight.w900, color: colors.maroonPrimary),
                ),
                const SizedBox(height: 10),
                Text(
                  isBM
                      ? 'Pinjaman: ${CurrencyFormatter.format(loanAmount)} (${(100 - _downPaymentPercent).toInt()}%) • $_tenureYears Tahun @ $_interestRate%'
                      : 'Loan: ${CurrencyFormatter.format(loanAmount)} (${(100 - _downPaymentPercent).toInt()}%) • $_tenureYears Years @ $_interestRate%',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Inputs
          _buildInputTitle(isBM ? 'Harga Hartanah (RM)' : 'Property Price (RM)'),
          TextField(
            controller: _priceController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(prefixText: 'RM '),
          ),
          const SizedBox(height: 14),

          // Sliders: Downpayment %
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildInputTitle(isBM ? 'Wang Pendahuluan / Deposit:' : 'Downpayment / Deposit:'),
              Text(
                '${_downPaymentPercent.toInt()}% (${CurrencyFormatter.format(downpayment)})',
                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          Slider(
            value: _downPaymentPercent,
            min: 0,
            max: 30,
            divisions: 6,
            activeColor: colors.maroonPrimary,
            inactiveColor: colors.border,
            onChanged: (val) => setState(() => _downPaymentPercent = val),
          ),

          // Sliders: Interest Rate
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildInputTitle(isBM ? 'Kadar Faedah Pinjaman:' : 'Loan Interest Rate:'),
              Text(
                '${_interestRate.toStringAsFixed(1)}%',
                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          Slider(
            value: _interestRate,
            min: 3.0,
            max: 6.0,
            divisions: 30,
            activeColor: colors.maroonPrimary,
            inactiveColor: colors.border,
            onChanged: (val) => setState(() => _interestRate = double.parse(val.toStringAsFixed(1))),
          ),

          // Sliders: Tenure
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildInputTitle(isBM ? 'Tempoh Pinjaman:' : 'Loan Tenure:'),
              Text(
                '$_tenureYears ${isBM ? 'Tahun' : 'Years'}',
                style: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold, fontSize: 13),
              ),
            ],
          ),
          Slider(
            value: _tenureYears.toDouble(),
            min: 10,
            max: 35,
            divisions: 25,
            activeColor: colors.maroonPrimary,
            inactiveColor: colors.border,
            onChanged: (val) => setState(() => _tenureYears = val.toInt()),
          ),
          const SizedBox(height: 6),

          // First home buyer switch
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      isBM ? 'Pembeli Rumah Pertama' : 'First-time Homebuyer',
                      style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      isBM ? 'Pengecualian duti setem MOT (<=RM500k)' : 'MOT stamp duty exemption (<=RM500k)',
                      style: TextStyle(color: colors.textSecondary, fontSize: 11),
                    ),
                  ],
                ),
                Switch(
                  value: _isFirstHomeBuyer,
                  activeColor: colors.maroonPrimary,
                  onChanged: (val) => setState(() => _isFirstHomeBuyer = val),
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Entry Cost & Legal Fees Breakdown
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isBM ? 'ANGGARAN KOS GUAMAN & ENTRY COST' : 'ESTIMATED LEGAL FEES & ENTRY COST',
                  style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: colors.maroonPrimary),
                ),
                const SizedBox(height: 10),
                _buildFeeRow(isBM ? 'Wang Pendahuluan (%)' : 'Downpayment (%)', CurrencyFormatter.format(downpayment)),
                _buildFeeRow(
                  isBM ? 'Duti Setem MOT' : 'MOT Stamp Duty',
                  mot == 0 ? (isBM ? 'RM 0 (Pengecualian 100%)' : 'RM 0 (100% Exemption)') : CurrencyFormatter.format(mot),
                  isHighlight: mot == 0,
                ),
                _buildFeeRow(isBM ? 'Yuran Guaman SPA' : 'SPA Legal Fees', CurrencyFormatter.format(spaLegal)),
                _buildFeeRow(isBM ? 'Yuran Guaman Pinjaman' : 'Loan Legal Fees', CurrencyFormatter.format(loanLegal)),
                _buildFeeRow(isBM ? 'Duti Setem Pinjaman (0.5%)' : 'Loan Stamp Duty (0.5%)', CurrencyFormatter.format(loanStamp)),
                Divider(color: colors.border, height: 16),
                _buildFeeRow(
                  isBM ? 'Anggaran Modal Permulaan (Total Entry)' : 'Estimated Total Entry Cost',
                  CurrencyFormatter.format(totalEntryCost),
                  isBold: true,
                ),
              ],
            ),
          ),
          const SizedBox(height: 18),

          // Copy Quotation Button
          ElevatedButton.icon(
            onPressed: () => _copyMortgageQuotation(
              price: price,
              downpayment: downpayment,
              loanAmount: loanAmount,
              monthly: monthly,
              mot: mot,
              legalFee: spaLegal,
              loanLegal: loanLegal,
              loanStamp: loanStamp,
              isBM: isBM,
            ),
            icon: const Icon(Icons.copy_outlined, size: 18),
            label: Text(
              isBM ? 'SALIN SEBUT HARGA KE WHATSAPP' : 'COPY QUOTATION TO WHATSAPP',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: colors.maroonPrimary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
          ),
          const SizedBox(height: 30),
        ],
      ),
    );
  }

  Widget _buildDsrTab(bool isBM) {
    final netSalary = _parseAmount(_salaryController);
    final commitments = _parseAmount(_commitmentsController);

    // Max Allowable Installment = (Salary * DSR) - Commitments
    final maxAllowedMonthly = max(0, ((netSalary * (_maxDsrPercent / 100)) - commitments).round());

    // Estimate max loan principal based on 30 years @ 4.2%
    // monthly = P * 0.00489 -> P = monthly / 0.00489
    final estimatedMaxLoan = (maxAllowedMonthly * 204.4).round();
    final estimatedMaxPropertyPrice = (estimatedMaxLoan / 0.9).round();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // DSR Result Card
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: colors.isDark ? const [Color(0xFF1E2022), Color(0xFF141517)] : const [Color(0xFFEFF6FF), Colors.white],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF3B82F6).withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Text(
                  isBM ? 'Kelayakan Maksimum Ansuran Bulanan' : 'Maximum Allowable Monthly Installment',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  'RM ${NumberFormat('#,###').format(maxAllowedMonthly)} ${isBM ? '/ bulan' : '/ month'}',
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF2563EB)),
                ),
                const SizedBox(height: 10),
                Text(
                  isBM
                      ? 'Harga Rumah Maksimum Layak: RM ${NumberFormat('#,###').format(estimatedMaxPropertyPrice)}'
                      : 'Max Eligible Property Price: RM ${NumberFormat('#,###').format(estimatedMaxPropertyPrice)}',
                  style: const TextStyle(color: Color(0xFF10B981), fontSize: 13, fontWeight: FontWeight.bold),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          _buildInputTitle(isBM ? 'Pendapatan Bersih Bulanan (RM)' : 'Net Monthly Income (RM)'),
          TextField(
            controller: _salaryController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(
              prefixText: 'RM ',
              hint: isBM ? 'Gaji bersih selepas KWSP & SOCSO' : 'Net salary after EPF & SOCSO',
            ),
          ),
          const SizedBox(height: 14),

          _buildInputTitle(isBM ? 'Komitmen Bulanan Semasa (RM)' : 'Current Monthly Commitments (RM)'),
          TextField(
            controller: _commitmentsController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(
              prefixText: 'RM ',
              hint: isBM ? 'Pinjaman kereta, personal loan, kad kredit...' : 'Car loan, personal loan, credit cards...',
            ),
          ),
          const SizedBox(height: 14),

          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _buildInputTitle(isBM ? 'Had Maksimum DSR Bank:' : 'Bank Max DSR Limit:'),
              Text(
                '${_maxDsrPercent.toInt()}%',
                style: TextStyle(
                  color: colors.isDark ? const Color(0xFF60A5FA) : const Color(0xFF2563EB),
                  fontWeight: FontWeight.bold,
                  fontSize: 13,
                ),
              ),
            ],
          ),
          Slider(
            value: _maxDsrPercent,
            min: 50,
            max: 85,
            divisions: 7,
            activeColor: const Color(0xFF3B82F6),
            inactiveColor: colors.border,
            onChanged: (val) => setState(() => _maxDsrPercent = val),
          ),
          const SizedBox(height: 16),

          Container(
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  isBM ? 'Panduan DSR Bank Malaysia:' : 'Malaysian Bank DSR Guidelines:',
                  style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 13),
                ),
                const SizedBox(height: 6),
                Text(
                  isBM
                      ? '• Gaji < RM3,000: Kebanyakan bank hadkan DSR kepada 60%.'
                      : '• Salary < RM3,000: Most banks cap DSR at 60%.',
                  style: TextStyle(color: colors.textMuted, fontSize: 11.5),
                ),
                const SizedBox(height: 4),
                Text(
                  isBM
                      ? '• Gaji RM3,000 - RM5,000: Had DSR standard adalah 70%.'
                      : '• Salary RM3,000 - RM5,000: Standard DSR limit is 70%.',
                  style: TextStyle(color: colors.textMuted, fontSize: 11.5),
                ),
                const SizedBox(height: 4),
                Text(
                  isBM
                      ? '• Gaji > RM5,000: Had DSR boleh mencapai 80% hingga 85%.'
                      : '• Salary > RM5,000: DSR limit can reach up to 80% - 85%.',
                  style: TextStyle(color: colors.textMuted, fontSize: 11.5),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLppsaTab(bool isBM) {
    final basic = _parseAmount(_lppsaBasicSalaryController);
    final allowance = _parseAmount(_lppsaAllowanceController);
    final deductions = _parseAmount(_lppsaDeductionsController);

    final totalIncome = basic + allowance;
    // LPPSA rule: Ansuran bulanan tidak boleh melebihi 60% daripada (Gaji Pokok + Elaun) - Potongan Slip Gaji
    final maxLppsaInstallment = max(0, ((totalIncome * 0.6) - deductions).round());
    // LPPSA financing amount estimate @ 4.0% p.a. for 30 years
    final maxFinancing = (maxLppsaInstallment * 209.5).round();
    final maxDeduction = maxLppsaInstallment;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: colors.isDark ? const [Color(0xFF1E2022), Color(0xFF141517)] : const [Color(0xFFECFDF5), Colors.white],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF10B981).withValues(alpha: 0.3)),
            ),
            child: Column(
              children: [
                Text(
                  isBM ? 'Kelayakan Maksimum Pembiayaan LPPSA' : 'Maximum LPPSA Financing Eligibility',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                ),
                const SizedBox(height: 6),
                Text(
                  CurrencyFormatter.format(maxFinancing),
                  style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w900, color: Color(0xFF10B981)),
                ),
                const SizedBox(height: 10),
                Text(
                  isBM
                      ? 'Potongan Maksimum: ${CurrencyFormatter.format(maxDeduction)} / bulan @ 4.0%'
                      : 'Maximum Deduction: ${CurrencyFormatter.format(maxDeduction)} / month @ 4.0%',
                  style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w500),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          DropdownButtonFormField<String>(
            value: _lppsaScheme,
            dropdownColor: colors.surface,
            style: TextStyle(color: colors.textPrimary),
            decoration: _inputDecor(prefixText: '', hint: isBM ? 'Skim LPPSA' : 'LPPSA Scheme'),
            items: [
              {'val': 'Skim 1 (Pertama)', 'en': 'Scheme 1 (First Housing)', 'bm': 'Skim 1 (Pertama)'},
              {'val': 'Skim 2 (Kedua)', 'en': 'Scheme 2 (Second Housing)', 'bm': 'Skim 2 (Kedua)'},
            ].map((s) => DropdownMenuItem(
              value: s['val'],
              child: Text(isBM ? s['bm']! : s['en']!),
            )).toList(),
            onChanged: (v) {
              if (v != null) setState(() => _lppsaScheme = v);
            },
          ),
          const SizedBox(height: 14),

          _buildInputTitle(isBM ? 'Gaji Pokok Hakiki (RM)' : 'Basic Salary (RM)'),
          TextField(
            controller: _lppsaBasicSalaryController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(prefixText: 'RM '),
          ),
          const SizedBox(height: 14),

          _buildInputTitle(isBM ? 'Elaun Tetap Perkhidmatan (RM)' : 'Fixed Allowances (RM)'),
          TextField(
            controller: _lppsaAllowanceController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(
              prefixText: 'RM ',
              hint: isBM ? 'ITP + BSH + Elaun Memangku' : 'Housing + COLA + Acting Allowance',
            ),
          ),
          const SizedBox(height: 14),

          _buildInputTitle(isBM ? 'Jumlah Potongan Dalam Slip Gaji (RM)' : 'Total Payslip Deductions (RM)'),
          TextField(
            controller: _lppsaDeductionsController,
            keyboardType: TextInputType.number,
            style: TextStyle(color: colors.textPrimary, fontSize: 15, fontWeight: FontWeight.bold),
            onChanged: (_) => setState(() {}),
            decoration: _inputDecor(
              prefixText: 'RM ',
              hint: isBM ? 'Potongan koperasi, pinjaman kenderaan dll' : 'Cooperative, car loans, etc.',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputTitle(String title) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 6),
      child: Text(title, style: TextStyle(color: colors.textSecondary, fontSize: 12, fontWeight: FontWeight.w600)),
    );
  }

  InputDecoration _inputDecor({String? prefixText, String? hint}) {
    return InputDecoration(
      prefixText: prefixText,
      prefixStyle: TextStyle(color: colors.maroonPrimary, fontWeight: FontWeight.bold),
      hintText: hint,
      filled: true,
      fillColor: colors.surface,
      hintStyle: TextStyle(color: colors.textMuted, fontSize: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.maroonPrimary, width: 1.5)),
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
    );
  }

  Widget _buildFeeRow(String label, String value, {bool isHighlight = false, bool isBold = false}) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: TextStyle(
              color: isBold ? colors.textPrimary : colors.textSecondary,
              fontSize: isBold ? 13 : 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.normal,
            ),
          ),
          Text(
            value,
            style: TextStyle(
              color: isHighlight ? const Color(0xFF10B981) : (isBold ? colors.maroonPrimary : colors.textPrimary),
              fontSize: isBold ? 14 : 12,
              fontWeight: isBold ? FontWeight.bold : FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isBM ? 'Kalkulator Kewangan' : 'Financial Calculator',
          style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: colors.textPrimary),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
        bottom: TabBar(
          controller: _tabController,
          indicatorColor: colors.maroonPrimary,
          labelColor: colors.maroonPrimary,
          unselectedLabelColor: colors.textMuted,
          labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
          tabs: [
            Tab(text: isBM ? 'Pinjaman Bank' : 'Bank Loan'),
            Tab(text: isBM ? 'DSR Bank' : 'Bank DSR'),
            const Tab(text: 'LPPSA'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildMortgageTab(isBM),
          _buildDsrTab(isBM),
          _buildLppsaTab(isBM),
        ],
      ),
    );
  }
}
