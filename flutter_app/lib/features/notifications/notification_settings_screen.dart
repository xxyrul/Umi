import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/l10n/language_provider.dart';
import '../../core/theme/app_colors.dart';

class NotificationSettingsScreen extends ConsumerStatefulWidget {
  const NotificationSettingsScreen({super.key});

  @override
  ConsumerState<NotificationSettingsScreen> createState() => _NotificationSettingsScreenState();
}

class _NotificationSettingsScreenState extends ConsumerState<NotificationSettingsScreen>
  with WidgetsBindingObserver {
  bool _pushEnabled = true;
  bool _caseAlertsEnabled = true;
  bool _dailyDigestEnabled = true;
  bool _updateAlertsEnabled = true;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _loadPrefs();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) _loadPrefs();
  }

  Future<void> _loadPrefs() async {
    final prefs = await SharedPreferences.getInstance();
    final notificationSettings = await FirebaseMessaging.instance.getNotificationSettings();
    final notificationsAllowed = notificationSettings.authorizationStatus == AuthorizationStatus.authorized ||
        notificationSettings.authorizationStatus == AuthorizationStatus.provisional;
    setState(() {
      _pushEnabled = notificationsAllowed;
      _caseAlertsEnabled = prefs.getBool('@artha_case_alerts_enabled') ?? true;
      _dailyDigestEnabled = prefs.getBool('@artha_daily_digest_enabled') ?? true;
      _updateAlertsEnabled = prefs.getBool('@artha_update_alerts_enabled') ?? true;
      _isLoading = false;
    });
  }

  Future<void> _savePref(String key, bool val) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(key, val);
  }

  Future<void> _setPushEnabled(bool enabled, bool isBM) async {
    if (!enabled) {
      setState(() => _pushEnabled = false);
      await _savePref('@artha_push_enabled', false);
      return;
    }

    final settings = await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
      provisional: false,
    );
    final granted = settings.authorizationStatus == AuthorizationStatus.authorized ||
        settings.authorizationStatus == AuthorizationStatus.provisional;
    if (!mounted) return;
    setState(() => _pushEnabled = granted);
    await _savePref('@artha_push_enabled', granted);
    if (!granted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(isBM ? 'Benarkan notifikasi dalam Tetapan telefon.' : 'Allow notifications in phone settings.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final lang = ref.watch(languageProvider);
    final isBM = lang == 'BM';
    final colors = context.colors;

    if (_isLoading) {
      return Scaffold(
        backgroundColor: colors.canvas,
        appBar: AppBar(
          title: Text(isBM ? 'Tetapan Notifikasi' : 'Notification Settings', style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.bold, fontSize: 16)),
          backgroundColor: colors.surface,
          elevation: 0,
          leading: IconButton(
            icon: Icon(Icons.arrow_back, color: colors.textPrimary),
            onPressed: () => Navigator.pop(context),
          ),
        ),
        body: Center(child: CircularProgressIndicator(color: colors.maroonPrimary)),
      );
    }

    return Scaffold(
      backgroundColor: colors.canvas,
      appBar: AppBar(
        title: Text(
          isBM ? 'Tetapan Notifikasi' : 'Notification Settings',
          style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700, color: colors.textPrimary),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.textPrimary),
          onPressed: () => Navigator.pop(context),
        ),
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildSectionHeader(isBM ? 'PEMBERITAHUAN APLIKASI' : 'APP NOTIFICATIONS', colors),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: Column(
              children: [
                SwitchListTile(
                  activeColor: colors.maroonPrimary,
                  title: Text(
                    isBM ? 'Notifikasi Tolak (Push Notifications)' : 'Push Notifications',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isBM ? 'Terima amaran langsung pada peranti' : 'Receive instant alerts on device',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  value: _pushEnabled,
                  onChanged: (val) => _setPushEnabled(val, isBM),
                ),
                Divider(color: colors.border, height: 1),
                SwitchListTile(
                  activeColor: colors.maroonPrimary,
                  title: Text(
                    isBM ? 'Kemaskini Status Kes' : 'Case Status Updates',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isBM ? 'Pemberitahuan apabila milestone kes berubah' : 'Alerts when case milestones change',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  value: _caseAlertsEnabled,
                  onChanged: (val) {
                    setState(() => _caseAlertsEnabled = val);
                    _savePref('@artha_case_alerts_enabled', val);
                  },
                ),
                Divider(color: colors.border, height: 1),
                SwitchListTile(
                  activeColor: colors.maroonPrimary,
                  title: Text(
                    isBM ? 'Ringkasan Harian (9:00 AM)' : 'Daily Briefing (9:00 AM)',
                    style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
                  ),
                  subtitle: Text(
                    isBM ? 'Senarai tindakan susulan klien setiap pagi' : 'Morning summary of daily client follow-ups',
                    style: TextStyle(color: colors.textMuted, fontSize: 12),
                  ),
                  value: _dailyDigestEnabled,
                  onChanged: (val) {
                    setState(() => _dailyDigestEnabled = val);
                    _savePref('@artha_daily_digest_enabled', val);
                  },
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),

          _buildSectionHeader(isBM ? 'PENGUMUMAN & KEMASKINI' : 'ANNOUNCEMENTS & UPDATES', colors),
          Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(14),
              border: Border.all(color: colors.border),
            ),
            child: SwitchListTile(
              activeColor: colors.maroonPrimary,
              title: Text(
                isBM ? 'Makluman Versi & Siaran Agensi' : 'Version & Agency Broadcasts',
                style: TextStyle(color: colors.textPrimary, fontWeight: FontWeight.w600, fontSize: 14),
              ),
              subtitle: Text(
                isBM ? 'Pemberitahuan kemas kini APK dan berita agensi' : 'Alerts for new APK versions and agency news',
                style: TextStyle(color: colors.textMuted, fontSize: 12),
              ),
              value: _updateAlertsEnabled,
              onChanged: (val) {
                setState(() => _updateAlertsEnabled = val);
                _savePref('@artha_update_alerts_enabled', val);
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSectionHeader(String title, AppThemeColors colors) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 8),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.bold,
          letterSpacing: 1,
          color: colors.textMuted,
        ),
      ),
    );
  }
}
