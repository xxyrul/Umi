import 'package:cloud_firestore/cloud_firestore.dart';

class CaseModel {
  final String id;
  final String caseName;
  final String status; // 'Viewing', 'Booking Paid', 'Loan Approved', 'SPA Signed', 'Completed', 'Cancelled'
  final String tarikh; // Deal date string e.g. "2026-08-14" or ISO string
  final String propertyAddress;
  final String vendorName;
  final String vendorPhone;
  final String vendorIC;
  final String buyerName;
  final String buyerPhone;
  final String buyerIC;
  final int price;
  final String financeType; // 'Bank Loan', 'LPPSA', 'Cash', 'Developer Loan', 'Other'
  final String financeNotes;
  final String bankerName;
  final String bankerPhone;
  final String lawyerName;
  final String lawyerPhone;
  final String notes;
  final String reminderDate;
  final String reminderNote;
  final List<String> statusHistory;
  final String userId;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  CaseModel({
    required this.id,
    required this.caseName,
    this.status = 'Viewing',
    this.tarikh = '',
    this.propertyAddress = '',
    this.vendorName = '',
    this.vendorPhone = '',
    this.vendorIC = '',
    this.buyerName = '',
    this.buyerPhone = '',
    this.buyerIC = '',
    this.price = 0,
    this.financeType = 'Bank Loan',
    this.financeNotes = '',
    this.bankerName = '',
    this.bankerPhone = '',
    this.lawyerName = '',
    this.lawyerPhone = '',
    this.notes = '',
    this.reminderDate = '',
    this.reminderNote = '',
    this.statusHistory = const [],
    required this.userId,
    this.createdAt,
    this.updatedAt,
  });

  static DateTime? parseFlexibleDate(dynamic val) {
    if (val == null) return null;
    if (val is Timestamp) return val.toDate();
    if (val is String && val.trim().isNotEmpty) {
      return DateTime.tryParse(val.trim());
    }
    return null;
  }

  factory CaseModel.fromFirestore(DocumentSnapshot<Map<String, dynamic>> doc) {
    final d = doc.data() ?? {};

    final rawHistory = d['statusHistory'] ?? [];
    final List<String> parsedHistory = (rawHistory is List)
        ? rawHistory.map((e) => e.toString()).toList()
        : [];

    return CaseModel(
      id: doc.id,
      caseName: d['namaCase'] ?? d['caseName'] ?? 'Kes Tanpa Tajuk',
      status: d['status'] ?? 'Viewing',
      tarikh: d['tarikh'] ?? d['date'] ?? '',
      propertyAddress: d['propertyAddress'] ?? d['alamat'] ?? d['address'] ?? '',
      vendorName: d['vendorName'] ?? d['vendor'] ?? d['clientName'] ?? '',
      vendorPhone: d['vendorPhone'] ?? d['vendorTel'] ?? '',
      vendorIC: d['vendorIC'] ?? '',
      buyerName: d['buyerName'] ?? d['buyer'] ?? '',
      buyerPhone: d['buyerPhone'] ?? d['buyerTel'] ?? '',
      buyerIC: d['buyerIC'] ?? '',
      price: (d['harga'] ?? d['price'] ?? 0) is int
          ? (d['harga'] ?? d['price'] ?? 0)
          : int.tryParse((d['harga'] ?? d['price'] ?? 0).toString().replaceAll(RegExp(r'[^0-9]'), '')) ?? 0,
      financeType: d['finance'] ?? d['financeType'] ?? 'Bank Loan',
      financeNotes: d['financeNotes'] ?? '',
      bankerName: d['bankerName'] ?? '',
      bankerPhone: d['bankerPhone'] ?? d['bankerTel'] ?? '',
      lawyerName: d['lawyerName'] ?? '',
      lawyerPhone: d['lawyerPhone'] ?? d['lawyerTel'] ?? '',
      notes: d['catatan'] ?? d['notes'] ?? '',
      reminderDate: d['reminderDate'] ?? '',
      reminderNote: d['reminderNote'] ?? '',
      statusHistory: parsedHistory,
      userId: d['userId'] ?? '',
      createdAt: parseFlexibleDate(d['createdAt']),
      updatedAt: parseFlexibleDate(d['updatedAt']),
    );
  }

  Map<String, dynamic> toMap() {
    final nowIso = DateTime.now().toIso8601String();
    return {
      'namaCase': caseName,
      'status': status,
      'tarikh': tarikh.isNotEmpty ? tarikh : nowIso,
      'propertyAddress': propertyAddress,
      'vendorName': vendorName,
      'vendorPhone': vendorPhone,
      'vendorIC': vendorIC,
      'buyerName': buyerName,
      'buyerPhone': buyerPhone,
      'buyerIC': buyerIC,
      'harga': price,
      'finance': financeType,
      'financeNotes': financeNotes,
      'bankerName': bankerName,
      'bankerPhone': bankerPhone,
      'lawyerName': lawyerName,
      'lawyerPhone': lawyerPhone,
      'catatan': notes,
      'reminderDate': reminderDate,
      'reminderNote': reminderNote,
      'statusHistory': statusHistory,
      'userId': userId,
      'createdAt': createdAt != null ? createdAt!.toIso8601String() : nowIso,
      'updatedAt': nowIso,
    };
  }

  CaseModel copyWith({
    String? caseName,
    String? status,
    String? tarikh,
    String? propertyAddress,
    String? vendorName,
    String? vendorPhone,
    String? vendorIC,
    String? buyerName,
    String? buyerPhone,
    String? buyerIC,
    int? price,
    String? financeType,
    String? financeNotes,
    String? bankerName,
    String? bankerPhone,
    String? lawyerName,
    String? lawyerPhone,
    String? notes,
    String? reminderDate,
    String? reminderNote,
    List<String>? statusHistory,
  }) {
    return CaseModel(
      id: id,
      caseName: caseName ?? this.caseName,
      status: status ?? this.status,
      tarikh: tarikh ?? this.tarikh,
      propertyAddress: propertyAddress ?? this.propertyAddress,
      vendorName: vendorName ?? this.vendorName,
      vendorPhone: vendorPhone ?? this.vendorPhone,
      vendorIC: vendorIC ?? this.vendorIC,
      buyerName: buyerName ?? this.buyerName,
      buyerPhone: buyerPhone ?? this.buyerPhone,
      buyerIC: buyerIC ?? this.buyerIC,
      price: price ?? this.price,
      financeType: financeType ?? this.financeType,
      financeNotes: financeNotes ?? this.financeNotes,
      bankerName: bankerName ?? this.bankerName,
      bankerPhone: bankerPhone ?? this.bankerPhone,
      lawyerName: lawyerName ?? this.lawyerName,
      lawyerPhone: lawyerPhone ?? this.lawyerPhone,
      notes: notes ?? this.notes,
      reminderDate: reminderDate ?? this.reminderDate,
      reminderNote: reminderNote ?? this.reminderNote,
      statusHistory: statusHistory ?? this.statusHistory,
      userId: userId,
      createdAt: createdAt,
      updatedAt: DateTime.now(),
    );
  }
}
