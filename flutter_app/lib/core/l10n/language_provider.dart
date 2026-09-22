import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'translations.dart';

const _kLangKey = 'umi_app_language';

class LanguageNotifier extends StateNotifier<String> {
  LanguageNotifier() : super('BM') {
    _load();
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final saved = prefs.getString(_kLangKey) ?? 'BM';
    if (saved == 'BM' || saved == 'EN') {
      state = saved;
    }
  }

  Future<void> setLanguage(String lang) async {
    if (lang != 'BM' && lang != 'EN') return;
    state = lang;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_kLangKey, lang);
  }

  void toggle() => setLanguage(state == 'BM' ? 'EN' : 'BM');

  /// Translate a key using the current language.
  String t(String key) => AppTranslations.translate(key, state);
}

/// Global language provider — watch this for language state.
final languageProvider = StateNotifierProvider<LanguageNotifier, String>((ref) {
  return LanguageNotifier();
});

/// Convenience: call ref.watch(tProvider)('key') to translate.
final tProvider = Provider<String Function(String)>((ref) {
  final lang = ref.watch(languageProvider);
  return (String key) => AppTranslations.translate(key, lang);
});
