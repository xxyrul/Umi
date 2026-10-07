import 'package:flutter/material.dart';
import '../../../core/theme/app_colors.dart';
import '../../../core/utils/currency_formatter.dart';
import '../../calculator/domain/calculator_engine.dart';
import '../../calculator/domain/calculator_models.dart';

class QuickMortgageSheet extends StatefulWidget {
  final double propertyPrice;
  final bool isBM;

  const QuickMortgageSheet({
    super.key,
    required this.propertyPrice,
    required this.isBM,
  });

  static Future<void> show(BuildContext context, {required double propertyPrice, required bool isBM}) {
    return showModalBottomSheet(
      context: context,
      useRootNavigator: true,
      backgroundColor: context.colors.surface,
      isScrollControlled: true,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
      ),
      builder: (_) => QuickMortgageSheet(
        propertyPrice: propertyPrice,
        isBM: isBM,
      ),
    );
  }

  @override
  State<QuickMortgageSheet> createState() => _QuickMortgageSheetState();
}

class _QuickMortgageSheetState extends State<QuickMortgageSheet> {
  int _tenure = 30;
  final double _interest = 4.20;
  double _downpaymentPercent = 10;

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = widget.isBM;

    final result = CalculatorEngine.calculateMortgage(
      propertyPrice: widget.propertyPrice,
      downPaymentPercent: _downpaymentPercent,
      interestRateAnnual: _interest,
      tenureYears: _tenure,
      category: PropertyCategory.subsale,
    );

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 16, 20, context.safeBottomPadding(20.0)),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Drag handle
          Center(
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: colors.border,
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          const SizedBox(height: 14),

          // Header
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isBM ? 'Kalkulator Pinjaman Pantas' : 'Quick Mortgage Calculator',
                style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: colors.textPrimary),
              ),
              IconButton(
                icon: Icon(Icons.close, color: colors.textMuted),
                onPressed: () => Navigator.pop(context),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Monthly Installment Highlight Card
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: colors.isDark
                    ? [const Color(0xFF261019), const Color(0xFF16080E)]
                    : [const Color(0xFF881337), const Color(0xFF5A0820)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: colors.isDark
                    ? const Color(0xFFE11D48).withOpacity(0.35)
                    : const Color(0xFFBE123C).withOpacity(0.4),
                width: 1.5,
              ),
              boxShadow: [
                BoxShadow(
                  color: (colors.isDark ? Colors.black : const Color(0xFF881337)).withOpacity(0.3),
                  blurRadius: 14,
                  offset: const Offset(0, 6),
                ),
              ],
            ),
            child: Column(
              children: [
                Text(
                  isBM ? 'Anggaran Ansuran Bulanan' : 'Estimated Monthly Installment',
                  style: TextStyle(
                    color: colors.isDark ? const Color(0xFFFDA4AF) : const Color(0xFFFFCCD5),
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  '${CurrencyFormatter.format(result.monthlyInstallment.round())} ${isBM ? '/ bulan' : '/ month'}',
                  style: const TextStyle(
                    fontSize: 26,
                    fontWeight: FontWeight.w900,
                    color: Colors.white,
                    letterSpacing: -0.5,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  '${isBM ? "Harga" : "Price"}: ${CurrencyFormatter.format(widget.propertyPrice.round())} • ${_interest.toStringAsFixed(1)}% • ${_tenure}y',
                  style: TextStyle(
                    color: colors.isDark ? const Color(0xFFCBD5E1) : Colors.white.withOpacity(0.85),
                    fontSize: 11,
                    fontWeight: FontWeight.w500,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),

          // Downpayment Row & Chips
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isBM ? 'Deposit (Wang Pendahuluan):' : 'Downpayment:',
                style: TextStyle(color: colors.textSecondary, fontSize: 13),
              ),
              Text(
                '${_downpaymentPercent.toInt()}% (${CurrencyFormatter.format(result.downPaymentAmount.round())})',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [0.0, 10.0, 15.0, 20.0].map((pct) {
              final isSelected = _downpaymentPercent == pct;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: InkWell(
                    onTap: () => setState(() => _downpaymentPercent = pct),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? colors.maroonPrimary : colors.canvas,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '${pct.toInt()}%',
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
          const SizedBox(height: 12),

          // Loan Amount Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isBM ? 'Jumlah Pinjaman Bank:' : 'Bank Loan Amount:',
                style: TextStyle(color: colors.textSecondary, fontSize: 13),
              ),
              Text(
                CurrencyFormatter.format(result.loanAmount.round()),
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Tenure Row & Chips
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isBM ? 'Tempoh Pinjaman:' : 'Loan Tenure:',
                style: TextStyle(color: colors.textSecondary, fontSize: 13),
              ),
              Text(
                '$_tenure ${isBM ? "Tahun" : "Years"}',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [20, 25, 30, 35].map((yrs) {
              final isSelected = _tenure == yrs;
              return Expanded(
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 2),
                  child: InkWell(
                    onTap: () => setState(() => _tenure = yrs),
                    borderRadius: BorderRadius.circular(8),
                    child: Container(
                      padding: const EdgeInsets.symmetric(vertical: 6),
                      decoration: BoxDecoration(
                        color: isSelected ? colors.maroonPrimary : colors.canvas,
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: isSelected ? colors.maroonPrimary : colors.border),
                      ),
                      alignment: Alignment.center,
                      child: Text(
                        '$yrs ${isBM ? "Thn" : "Yrs"}',
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
          const SizedBox(height: 12),
          const Divider(height: 1),
          const SizedBox(height: 12),

          // Upfront Cash Row
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                isBM ? 'Anggaran Tunai Awal (Upfront):' : 'Est. Upfront Cash Needed:',
                style: TextStyle(color: colors.maroonPrimary, fontSize: 13, fontWeight: FontWeight.bold),
              ),
              Text(
                CurrencyFormatter.format(result.totalUpfront.round()),
                style: TextStyle(color: colors.maroonPrimary, fontSize: 15, fontWeight: FontWeight.bold),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
