import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import 'tabs/bank_mortgage_tab.dart';
import 'tabs/dsr_calculator_tab.dart';
import 'tabs/lppsa_tab.dart';
import 'tabs/legal_fees_tab.dart';

class CalculatorScreen extends ConsumerStatefulWidget {
  const CalculatorScreen({super.key});

  @override
  ConsumerState<CalculatorScreen> createState() => _CalculatorScreenState();
}

class _CalculatorScreenState extends ConsumerState<CalculatorScreen>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 4, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.colors;
    final isBM = ref.watch(languageProvider) == 'BM';

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.surface,
        elevation: 0,
        centerTitle: false,
        leading: Padding(
          padding: const EdgeInsets.only(left: 6),
          child: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            color: colors.textPrimary,
            tooltip: isBM ? 'Kembali' : 'Back',
            onPressed: () => Navigator.maybePop(context),
          ),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isBM ? 'Kalkulator Hartanah' : 'Property Calculator',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                letterSpacing: -0.3,
                color: colors.textPrimary,
              ),
            ),
            const SizedBox(height: 2),
            Text(
              isBM ? 'Pinjaman bank, DSR, LPPSA & yuran guaman' : 'Bank loan, DSR, LPPSA & legal fees',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w500,
                color: colors.textMuted,
              ),
            ),
          ],
        ),
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(54),
          child: Container(
            padding: const EdgeInsets.symmetric(vertical: 8),
            decoration: BoxDecoration(
              color: colors.surface,
              border: Border(bottom: BorderSide(color: colors.border)),
            ),
            child: TabBar(
              controller: _tabController,
              isScrollable: true,
              tabAlignment: TabAlignment.start,
              padding: const EdgeInsets.symmetric(horizontal: 14),
              labelPadding: const EdgeInsets.symmetric(horizontal: 4),
              indicatorSize: TabBarIndicatorSize.tab,
              indicator: BoxDecoration(
                color: colors.maroonPrimary,
                borderRadius: BorderRadius.circular(10),
              ),
              labelColor: Colors.white,
              unselectedLabelColor: colors.textSecondary,
              labelStyle: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              unselectedLabelStyle: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13),
              dividerColor: Colors.transparent,
              tabs: [
                _buildPillTab(
                  icon: Icons.account_balance_outlined,
                  label: isBM ? 'Pinjaman Bank' : 'Bank Mortgage',
                ),
                _buildPillTab(
                  icon: Icons.speed_outlined,
                  label: isBM ? 'Kelayakan DSR' : 'DSR Eligibility',
                ),
                _buildPillTab(
                  icon: Icons.account_balance_wallet_outlined,
                  label: isBM ? 'LPPSA (Kerajaan)' : 'LPPSA (Gov)',
                ),
                _buildPillTab(
                  icon: Icons.gavel_outlined,
                  label: isBM ? 'Kos Guaman & MOT' : 'Legal & MOT',
                ),
              ],
            ),
          ),
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        physics: const ClampingScrollPhysics(),
        children: [
          BankMortgageTab(isBM: isBM),
          DsrCalculatorTab(isBM: isBM),
          LppsaTab(isBM: isBM),
          LegalFeesTab(isBM: isBM),
        ],
      ),
    );
  }

  Widget _buildPillTab({required IconData icon, required String label}) {
    return Tab(
      height: 38,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15),
            const SizedBox(width: 7),
            Text(label),
          ],
        ),
      ),
    );
  }
}
