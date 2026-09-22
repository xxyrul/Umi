import 'package:flutter/foundation.dart';
import 'package:url_launcher/url_launcher.dart';

class CalendarIntentService {
  /// Opens the device native calendar (Samsung/Google/Apple Calendar)
  /// using an Android Intent with zero permissions required.
  static Future<bool> addEventToCalendar({
    required String title,
    required DateTime startTime,
    DateTime? endTime,
    String? location,
    String? description,
  }) async {
    final end = endTime ?? startTime.add(const Duration(hours: 1));
    final startMs = startTime.millisecondsSinceEpoch;
    final endMs = end.millisecondsSinceEpoch;

    // 1. Primary Android system Intent URL (supported natively by Android package manager)
    final encodedTitle = Uri.encodeComponent(title);
    final encodedLoc = Uri.encodeComponent(location ?? '');
    final encodedDesc = Uri.encodeComponent(description ?? 'Artha Real Estate Management');

    final androidIntentUri = Uri.parse(
      '#Intent;action=android.intent.action.INSERT;'
      'type=vnd.android.cursor.dir/event;'
      'S.title=$encodedTitle;'
      'S.eventLocation=$encodedLoc;'
      'S.description=$encodedDesc;'
      'l.beginTime=$startMs;'
      'l.endTime=$endMs;end',
    );

    try {
      final launched = await launchUrl(
        androidIntentUri,
        mode: LaunchMode.externalApplication,
      );
      if (launched) return true;
    } catch (e) {
      debugPrint('[CalendarIntent] Android intent URI failed: $e');
    }

    // 2. Secondary standard Google Calendar Web template fallback
    try {
      final startIso = '${startTime.toUtc().toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.').first}Z';
      final endIso = '${end.toUtc().toIso8601String().replaceAll(RegExp(r'[-:]'), '').split('.').first}Z';
      final webUri = Uri.parse(
        'https://calendar.google.com/calendar/render?action=TEMPLATE'
        '&text=$encodedTitle'
        '&dates=$startIso/$endIso'
        '&details=$encodedDesc'
        '&location=$encodedLoc',
      );
      return await launchUrl(webUri, mode: LaunchMode.externalApplication);
    } catch (e) {
      debugPrint('[CalendarIntent] Web fallback failed: $e');
      return false;
    }
  }
}
