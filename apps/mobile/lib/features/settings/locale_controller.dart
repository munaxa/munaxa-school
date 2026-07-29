import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Holds the active app locale (en/ar), persisted across launches. Switching to Arabic flips the
/// whole app to RTL via MaterialApp's localization + directionality.
class LocaleController extends Notifier<Locale> {
  static const _key = 'munaxa.locale';
  static const FlutterSecureStorage _storage = FlutterSecureStorage();

  @override
  Locale build() {
    _restore();
    return const Locale('en');
  }

  Future<void> _restore() async {
    try {
      final code = await _storage.read(key: _key);
      if (code == 'ar' || code == 'en') state = Locale(code!);
    } catch (_) {
      // No persisted preference (or storage unavailable in tests) — keep the default.
    }
  }

  /// Flip between English and Arabic and persist the choice.
  Future<void> toggle() async {
    final next = state.languageCode == 'ar' ? 'en' : 'ar';
    state = Locale(next);
    try {
      await _storage.write(key: _key, value: next);
    } catch (_) {
      // Persistence is best-effort.
    }
  }
}

final localeProvider = NotifierProvider<LocaleController, Locale>(LocaleController.new);
