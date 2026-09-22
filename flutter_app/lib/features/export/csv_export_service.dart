import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:path_provider/path_provider.dart';
import 'package:share_plus/share_plus.dart';
import '../cases/case_model.dart';
import '../listings/listing_model.dart';

class CsvExportService {
  Future<void> exportCasesCsv(List<CaseModel> cases) async {
    final buffer = StringBuffer();
    // CSV Header
    buffer.writeln('ID,Nama Kes,Status,Harga (RM),Pembeli,Penjual,Pembiayaan,Peguam,Banker,Catatan,Tarikh');

    for (final c in cases) {
      final dateStr = c.createdAt != null ? c.createdAt!.toIso8601String().split('T')[0] : '';
      buffer.writeln(
        '"${c.id}","${c.caseName}","${c.status}",${c.price},"${c.buyerName}","${c.vendorName}","${c.financeType}","${c.lawyerName}","${c.bankerName}","${c.notes.replaceAll('"', '""')}","$dateStr"',
      );
    }

    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/artha_cases_export_${DateTime.now().millisecondsSinceEpoch}.csv');
    await file.writeAsString(buffer.toString());

    await SharePlus.instance.share(
      ShareParams(
        text: 'Eksport Data Kes Artha CRM (${cases.length} rekod)',
        files: [XFile(file.path)],
      ),
    );
  }

  Future<void> exportListingsCsv(List<ListingModel> listings) async {
    final buffer = StringBuffer();
    // CSV Header
    buffer.writeln('ID,Tajuk,Harga (RM),Alamat,Negeri,Jenis,Bilik,Bilik Air,Keluasan,Pegangan,Status,Ejen,Telefon');

    for (final l in listings) {
      buffer.writeln(
        '"${l.id}","${l.title}",${l.price},"${l.address}","${l.state}","${l.propertyType}",${l.bedrooms},${l.bathrooms},"${l.size}","${l.tenure}","${l.status}","${l.agentName}","${l.agentPhone}"',
      );
    }

    final tempDir = await getTemporaryDirectory();
    final file = File('${tempDir.path}/artha_listings_export_${DateTime.now().millisecondsSinceEpoch}.csv');
    await file.writeAsString(buffer.toString());

    await SharePlus.instance.share(
      ShareParams(
        text: 'Eksport Katalog Hartanah Artha (${listings.length} rekod)',
        files: [XFile(file.path)],
      ),
    );
  }
}

final csvExportServiceProvider = Provider<CsvExportService>((ref) => CsvExportService());
