import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/utils/currency_formatter.dart';
import '../cases/case_model.dart';

class CommissionChartWidget extends ConsumerStatefulWidget {
  final List<CaseModel> cases;

  const CommissionChartWidget({super.key, required this.cases});

  @override
  ConsumerState<CommissionChartWidget> createState() => _CommissionChartWidgetState();
}

class _CommissionChartWidgetState extends ConsumerState<CommissionChartWidget> {
  int _selectedYear = DateTime.now().year;

  final List<String> _monthsBm = [
    'Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun',
    'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'
  ];

  final List<String> _monthsEn = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
  ];

  @override
  Widget build(BuildContext context) {
    final isBM = ref.watch(languageProvider) == 'BM';
    final months = isBM ? _monthsBm : _monthsEn;
    final colors = context.colors;

    // Aggregate monthly closed case volume / commission
    final monthlyData = List<int>.filled(12, 0);

    for (final c in widget.cases) {
      if (c.createdAt != null && c.createdAt!.year == _selectedYear) {
        final monthIndex = c.createdAt!.month - 1;
        if (monthIndex >= 0 && monthIndex < 12) {
          // 2% commission
          monthlyData[monthIndex] += (c.price * 0.02).round();
        }
      }
    }

    final maxVal = max(1000, monthlyData.reduce(max));
    final totalAnnualCommission = monthlyData.fold<int>(0, (sum, v) => sum + v);

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isBM ? 'Prestasi Komisen Tahunan' : 'Annual Commission Performance',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    CurrencyFormatter.format(totalAnnualCommission),
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 18),
                  ),
                ],
              ),
              DropdownButton<int>(
                value: _selectedYear,
                dropdownColor: colors.card,
                underline: const SizedBox(),
                style: TextStyle(color: colors.maroonSecondary, fontWeight: FontWeight.bold, fontSize: 13),
                items: [2024, 2025, 2026, 2027].map((y) => DropdownMenuItem(value: y, child: Text('$y'))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _selectedYear = val);
                },
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Custom Bar Chart
          SizedBox(
            height: 120,
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: List.generate(12, (index) {
                final amount = monthlyData[index];
                final heightFactor = (amount / maxVal).clamp(0.08, 1.0);
                final isCurrentMonth = index == (DateTime.now().month - 1) && _selectedYear == DateTime.now().year;

                return Expanded(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.end,
                    children: [
                      Container(
                        height: 90 * heightFactor,
                        margin: const EdgeInsets.symmetric(horizontal: 2.5),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: isCurrentMonth
                                ? [colors.maroonPrimary, colors.maroonSecondary]
                                : [colors.cardHover, colors.card],
                            begin: Alignment.bottomCenter,
                            end: Alignment.topCenter,
                          ),
                          borderRadius: BorderRadius.circular(4),
                        ),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        months[index],
                        style: TextStyle(
                          color: isCurrentMonth ? colors.maroonSecondary : colors.textDim,
                          fontSize: 9,
                          fontWeight: isCurrentMonth ? FontWeight.bold : FontWeight.normal,
                        ),
                      ),
                    ],
                  ),
                );
              }),
            ),
          ),
        ],
      ),
    );
  }
}
