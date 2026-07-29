import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';

import '../features/settings/locale_controller.dart';

/// Locale-aware display formatting (dates + numerals). In Arabic, dates render with Arabic
/// month names and Eastern Arabic-Indic digits (CLDR `ar`); English uses Western digits.
/// API payloads always stay ISO/Western — these helpers are for DISPLAY ONLY.
class AppFormats {
  const AppFormats(this.lang);

  final String lang;

  /// e.g. "Jun 11, 2026" / "١١ يونيو ٢٠٢٦".
  String date(DateTime d) => DateFormat.yMMMd(lang).format(d);

  /// Formats an ISO `YYYY-MM-DD` (or full ISO timestamp) string; falls back to the raw value.
  String isoDate(String iso) {
    final parsed = DateTime.tryParse(iso);
    return parsed == null ? iso : date(parsed);
  }

  /// Locale numerals for integers/decimals, e.g. 1250 → "١٬٢٥٠" in Arabic.
  String number(num n) => NumberFormat.decimalPattern(lang).format(n);

  /// One-decimal number in locale digits, e.g. 92.5 → "٩٢٫٥" in Arabic.
  String decimal1(num n) => NumberFormat('0.0', lang).format(n);
}

/// Active formats for the current locale.
final formatsProvider = Provider<AppFormats>((ref) {
  return AppFormats(ref.watch(localeProvider).languageCode);
});
