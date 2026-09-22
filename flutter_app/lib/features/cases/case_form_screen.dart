import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';
import '../../core/widgets/app_toast.dart';
import '../../core/widgets/interactive_back_button.dart';
import '../auth/auth_service.dart';
import 'case_model.dart';
import 'case_repository.dart';

class CaseFormScreen extends ConsumerStatefulWidget {
  final String? editCaseId;

  const CaseFormScreen({super.key, this.editCaseId});

  @override
  ConsumerState<CaseFormScreen> createState() => _CaseFormScreenState();
}

class _CaseFormScreenState extends ConsumerState<CaseFormScreen> {
  final _formKey = GlobalKey<FormState>();

  final _namaCaseController = TextEditingController();
  final _propertyAddressController = TextEditingController();
  final _vendorNameController = TextEditingController();
  final _vendorPhoneController = TextEditingController();
  final _vendorICController = TextEditingController();
  final _buyerNameController = TextEditingController();
  final _buyerPhoneController = TextEditingController();
  final _buyerICController = TextEditingController();
  final _priceController = TextEditingController();
  final _bankerController = TextEditingController();
  final _lawyerController = TextEditingController();
  final _notesController = TextEditingController();

  DateTime _selectedDate = DateTime.now();
  String _financeType = 'Bank Loan';
  String _status = 'Viewing';
  bool _isLoading = false;
  bool _isInitLoading = false;
  CaseModel? _existingCase;

  final List<String> _financeOptions = [
    'Bank Loan',
    'LPPSA',
    'Cash',
    'Developer Loan',
    'Other',
  ];

  static const List<Map<String, String>> _statusStages = [
    {'status': 'Viewing', 'titleBM': 'Rundingan Viewing', 'titleEN': 'Viewing Stage', 'descBM': 'Klien melawat hartanah & rundingan awal.', 'descEN': 'Property viewing and preliminary negotiation.'},
    {'status': 'Booking Paid', 'titleBM': 'Deposit / Booking', 'titleEN': 'Booking Fee Paid', 'descBM': 'Commitment fee dibayar kepada agensi.', 'descEN': 'Earnest deposit / commitment fee paid.'},
    {'status': 'Loan Approved', 'titleBM': 'Kelulusan Pinjaman', 'titleEN': 'Loan Approved', 'descBM': 'Pinjaman bank / pembiayaan perumahan diluluskan.', 'descEN': 'Bank mortgage or financing approved.'},
    {'status': 'SPA Signed', 'titleBM': 'Tandatangan SPA', 'titleEN': 'SPA Signed', 'descBM': 'Perjanjian Jual Beli rasmi ditandatangani.', 'descEN': 'Sale & Purchase Agreement officially executed.'},
    {'status': 'Completed', 'titleBM': 'Selesai (Sold)', 'titleEN': 'Completed (Sold)', 'descBM': 'Disbursement baki bayaran & serah kunci selesai.', 'descEN': 'Full disbursement and vacant possession.'},
    {'status': 'Cancelled', 'titleBM': 'Dibatalkan', 'titleEN': 'Cancelled', 'descBM': 'Transaksi tidak dapat diteruskan / batal.', 'descEN': 'Transaction cancelled / aborted.'},
  ];

  @override
  void initState() {
    super.initState();
    if (widget.editCaseId != null && widget.editCaseId!.isNotEmpty) {
      _loadExistingCase(widget.editCaseId!);
    }
  }

  Future<void> _loadExistingCase(String id) async {
    setState(() => _isInitLoading = true);
    try {
      final item = await ref.read(caseRepositoryProvider).getCaseById(id);
      if (item != null && mounted) {
        _existingCase = item;
        _namaCaseController.text = item.caseName;
        _propertyAddressController.text = item.propertyAddress;
        _vendorNameController.text = item.vendorName;
        _vendorPhoneController.text = item.vendorPhone;
        _vendorICController.text = item.vendorIC;
        _buyerNameController.text = item.buyerName;
        _buyerPhoneController.text = item.buyerPhone;
        _buyerICController.text = item.buyerIC;
        _priceController.text = item.price > 0 ? item.price.toString() : '';
        _bankerController.text = item.bankerName;
        _lawyerController.text = item.lawyerName;
        _notesController.text = item.notes;
        _financeType = item.financeType;
        _status = item.status;
        if (item.tarikh.isNotEmpty) {
          final p = DateTime.tryParse(item.tarikh);
          if (p != null) _selectedDate = p;
        }
      }
    } catch (e) {
      debugPrint('Error loading case: $e');
    } finally {
      if (mounted) setState(() => _isInitLoading = false);
    }
  }

  @override
  void dispose() {
    _namaCaseController.dispose();
    _propertyAddressController.dispose();
    _vendorNameController.dispose();
    _vendorPhoneController.dispose();
    _vendorICController.dispose();
    _buyerNameController.dispose();
    _buyerPhoneController.dispose();
    _buyerICController.dispose();
    _priceController.dispose();
    _bankerController.dispose();
    _lawyerController.dispose();
    _notesController.dispose();
    super.dispose();
  }

  Future<void> _selectDate() async {
    final colors = context.colors;
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2020),
      lastDate: DateTime(2030),
      builder: (context, child) {
        return Theme(
          data: ThemeData(
            colorScheme: ColorScheme.dark(
              primary: AppColors.maroonPrimary,
              surface: colors.surface,
              onSurface: colors.textPrimary,
            ),
          ),
          child: child!,
        );
      },
    );
    if (picked != null) {
      setState(() => _selectedDate = picked);
    }
  }

  Future<void> _submitForm() async {
    final isBM = ref.read(languageProvider) == 'BM';

    if (!_formKey.currentState!.validate()) return;

    final user = ref.read(authStateProvider).value;
    if (user == null) {
      AppToast.error(context, isBM ? 'Sila log masuk semula.' : 'Please sign in again.');
      return;
    }

    setState(() => _isLoading = true);
    HapticFeedback.mediumImpact();
    try {
      final rawPrice = _priceController.text.replaceAll(RegExp(r'[^0-9]'), '');
      final price = int.tryParse(rawPrice) ?? 0;

      if (widget.editCaseId != null && _existingCase != null) {
        final updated = _existingCase!.copyWith(
          caseName: _namaCaseController.text.trim(),
          propertyAddress: _propertyAddressController.text.trim(),
          tarikh: DateFormat('yyyy-MM-dd').format(_selectedDate),
          vendorName: _vendorNameController.text.trim(),
          vendorPhone: _vendorPhoneController.text.trim(),
          vendorIC: _vendorICController.text.trim(),
          buyerName: _buyerNameController.text.trim(),
          buyerPhone: _buyerPhoneController.text.trim(),
          buyerIC: _buyerICController.text.trim(),
          price: price,
          financeType: _financeType,
          bankerName: _bankerController.text.trim(),
          lawyerName: _lawyerController.text.trim(),
          notes: _notesController.text.trim(),
          status: _status,
        );
        await ref.read(caseRepositoryProvider).updateCase(updated);
        if (mounted) {
          AppToast.success(context, isBM ? 'Kes berjaya dikemaskini!' : 'Case updated successfully!');
          Navigator.pop(context);
        }
      } else {
        final newCase = CaseModel(
          id: '',
          caseName: _namaCaseController.text.trim(),
          propertyAddress: _propertyAddressController.text.trim(),
          tarikh: DateFormat('yyyy-MM-dd').format(_selectedDate),
          vendorName: _vendorNameController.text.trim(),
          vendorPhone: _vendorPhoneController.text.trim(),
          vendorIC: _vendorICController.text.trim(),
          buyerName: _buyerNameController.text.trim(),
          buyerPhone: _buyerPhoneController.text.trim(),
          buyerIC: _buyerICController.text.trim(),
          price: price,
          financeType: _financeType,
          bankerName: _bankerController.text.trim(),
          lawyerName: _lawyerController.text.trim(),
          notes: _notesController.text.trim(),
          status: _status,
          userId: user.uid,
          createdAt: DateTime.now(),
        );
        await ref.read(caseRepositoryProvider).createCase(newCase);
        if (mounted) {
          AppToast.success(context, isBM ? 'Kes transaksi berjaya didaftarkan!' : 'Property transaction case created!');
          Navigator.pop(context);
        }
      }
    } catch (e) {
      if (mounted) {
        AppToast.error(context, isBM ? 'Ralat menyimpan kes: $e' : 'Error saving case: $e');
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Widget _buildSectionTitle(String title, IconData icon, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.only(top: 20, bottom: 10),
      child: Row(
        children: [
          Icon(icon, size: 18, color: colors.maroonPrimary),
          const SizedBox(width: 8),
          Text(
            title,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w700,
              color: colors.maroonPrimary,
              letterSpacing: 0.5,
            ),
          ),
        ],
      ),
    );
  }

  InputDecoration _inputDecor({
    required String label,
    String? hint,
    Widget? prefix,
    required AppThemeColors colors,
  }) {
    return InputDecoration(
      labelText: label,
      labelStyle: TextStyle(color: colors.textMuted, fontSize: 13),
      hintText: hint,
      hintStyle: TextStyle(color: colors.textDim, fontSize: 12),
      prefixIcon: prefix,
      filled: true,
      fillColor: colors.surface,
      contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: colors.border)),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide(color: colors.maroonPrimary, width: 1.5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isEdit = widget.editCaseId != null;
    final isBM = ref.watch(languageProvider) == 'BM';
    final colors = context.colors;

    if (_isInitLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        body: const Center(child: CircularProgressIndicator(color: AppColors.maroonPrimary)),
      );
    }

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        backgroundColor: colors.card,
        elevation: 0,
        leading: InteractiveBackButton(
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          isEdit ? (isBM ? 'Kemaskini Kes' : 'Update Case') : (isBM ? 'Buka Kes Baru' : 'Open New Case'),
          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 18, color: colors.textPrimary),
        ),
      ),
      body: SingleChildScrollView(
        physics: const BouncingScrollPhysics(),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Case & Property Details
              _buildSectionTitle(isBM ? 'MAKLUMAT KES & HARTANAH' : 'CASE & PROPERTY DETAILS', Icons.apartment_rounded, colors),
              TextFormField(
                controller: _namaCaseController,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(
                  label: isBM ? 'Nama Kes / Hartanah *' : 'Case / Property Name *',
                  hint: isBM ? 'Contoh: Semi-D Taman Melawati / Kes No 12' : 'E.g.: Semi-D Taman Melawati / Case #12',
                  colors: colors,
                ),
                validator: (val) => val == null || val.trim().isEmpty
                    ? (isBM ? 'Sila masukkan nama kes.' : 'Please enter case name.')
                    : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _propertyAddressController,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(
                  label: isBM ? 'Alamat Hartanah' : 'Property Address',
                  hint: isBM ? 'Contoh: No 12, Jalan Melawati 3, 53100 KL' : 'E.g.: No 12, Jalan Melawati 3, 53100 KL',
                  colors: colors,
                ),
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: InkWell(
                      onTap: _selectDate,
                      child: Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
                        decoration: BoxDecoration(
                          color: colors.surface,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: colors.border),
                        ),
                        child: Row(
                          children: [
                            Icon(Icons.calendar_today, size: 16, color: colors.maroonPrimary),
                            const SizedBox(width: 8),
                            Text(
                              DateFormat('d MMM yyyy').format(_selectedDate),
                              style: TextStyle(color: colors.textPrimary, fontSize: 13),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _priceController,
                      keyboardType: TextInputType.number,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'Harga Jualan (RM)' : 'Agreed Price (RM)',
                        hint: isBM ? 'Contoh: 450000' : 'E.g.: 450000',
                        colors: colors,
                      ),
                    ),
                  ),
                ],
              ),

              // Vendor Details
              _buildSectionTitle(isBM ? 'MAKLUMAT PENJUAL (VENDOR)' : 'VENDOR DETAILS', Icons.person_pin_circle_outlined, colors),
              TextFormField(
                controller: _vendorNameController,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(
                  label: isBM ? 'Nama Penjual (Vendor)' : 'Vendor Name',
                  hint: isBM ? 'Nama penuh pemilik hartanah' : 'Full property owner name',
                  colors: colors,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _vendorPhoneController,
                      keyboardType: TextInputType.phone,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'No Telefon Vendor' : 'Vendor Phone',
                        hint: '0123456789',
                        colors: colors,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _vendorICController,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'No IC Vendor' : 'Vendor IC / Passport',
                        hint: 'XXXXXX-XX-XXXX',
                        colors: colors,
                      ),
                    ),
                  ),
                ],
              ),

              // Buyer Details
              _buildSectionTitle(isBM ? 'MAKLUMAT PEMBELI (BUYER)' : 'BUYER DETAILS', Icons.account_circle_outlined, colors),
              TextFormField(
                controller: _buyerNameController,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(
                  label: isBM ? 'Nama Pembeli (Buyer)' : 'Buyer Name',
                  hint: isBM ? 'Nama penuh pembeli' : 'Full buyer name',
                  colors: colors,
                ),
              ),
              const SizedBox(height: 10),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _buyerPhoneController,
                      keyboardType: TextInputType.phone,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'No Telefon Buyer' : 'Buyer Phone',
                        hint: '0198765432',
                        colors: colors,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _buyerICController,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'No IC Buyer' : 'Buyer IC / Passport',
                        hint: 'XXXXXX-XX-XXXX',
                        colors: colors,
                      ),
                    ),
                  ),
                ],
              ),

              // Financing & Case Stage
              _buildSectionTitle(isBM ? 'KAEDAH PEMBIAYAAN & PERINGKAT KES' : 'FINANCING & CASE STAGE', Icons.account_balance_outlined, colors),
              DropdownButtonFormField<String>(
                value: _financeType,
                dropdownColor: colors.surface,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(label: isBM ? 'Jenis Pembiayaan' : 'Financing Type', colors: colors),
                items: _financeOptions.map((f) => DropdownMenuItem(value: f, child: Text(f))).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _financeType = val);
                },
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                value: _status,
                dropdownColor: colors.surface,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(label: isBM ? 'Peringkat Kes (Status)' : 'Case Stage (Status)', colors: colors),
                items: _statusStages.map((s) {
                  final title = isBM ? s['titleBM']! : s['titleEN']!;
                  return DropdownMenuItem(
                    value: s['status'],
                    child: Text('${s['status']} ($title)'),
                  );
                }).toList(),
                onChanged: (val) {
                  if (val != null) setState(() => _status = val);
                },
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _bankerController,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'Pegawai Bank (Opsional)' : 'Banker (Optional)',
                        hint: isBM ? 'Nama & Bank' : 'Name & Bank',
                        colors: colors,
                      ),
                    ),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: TextFormField(
                      controller: _lawyerController,
                      style: TextStyle(color: colors.textPrimary),
                      decoration: _inputDecor(
                        label: isBM ? 'Peguam SPA (Opsional)' : 'SPA Lawyer (Optional)',
                        hint: isBM ? 'Nama Firma Peguam' : 'Law Firm Name',
                        colors: colors,
                      ),
                    ),
                  ),
                ],
              ),

              // Notes
              _buildSectionTitle(isBM ? 'CATATAN PERKEMBANGAN' : 'TRANSACTION NOTES', Icons.edit_note_rounded, colors),
              TextFormField(
                controller: _notesController,
                maxLines: 3,
                style: TextStyle(color: colors.textPrimary),
                decoration: _inputDecor(
                  label: isBM ? 'Catatan Kes' : 'Case Remarks',
                  hint: isBM
                      ? 'Status CCRIS, tarikh perjumpaan penilai, atau sebarang nota penting...'
                      : 'CCRIS status, valuer inspection date, or other key remarks...',
                  colors: colors,
                ),
              ),
              const SizedBox(height: 28),

              // Submit Button
              ElevatedButton(
                onPressed: _isLoading ? null : _submitForm,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.maroonPrimary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 4,
                ),
                child: _isLoading
                    ? const SizedBox(
                        height: 20,
                        width: 20,
                        child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                      )
                    : Text(
                        isEdit
                            ? (isBM ? 'SIMPAN PERUBAHAN' : 'UPDATE CASE')
                            : (isBM ? 'DAFTAR KES SEKARANG' : 'SUBMIT CASE NOW'),
                        style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 14, letterSpacing: 0.5),
                      ),
              ),
              SizedBox(height: 36 + MediaQuery.of(context).padding.bottom),
            ],
          ),
        ),
      ),
    );
  }
}
