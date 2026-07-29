import 'package:flutter/material.dart';

/// Munaxa design-system colors (mirrors packages/config-tailwind preset).
abstract class MunaxaColors {
  static const violet = Color(0xFF7A3FFF);
  static const violetLight = Color(0xFFB97BFF);
  static const coral = Color(0xFFFF8E6E);
  static const aqua = Color(0xFF4DF4E1);
  static const ink900 = Color(0xFF0B0518);
  static const ink800 = Color(0xFF140A2E);
}

abstract class AppTheme {
  static ThemeData get dark {
    final scheme = ColorScheme.fromSeed(
      seedColor: MunaxaColors.violet,
      brightness: Brightness.dark,
    ).copyWith(
      primary: MunaxaColors.violetLight,
      secondary: MunaxaColors.coral,
      tertiary: MunaxaColors.aqua,
      surface: MunaxaColors.ink800,
    );
    return ThemeData(
      useMaterial3: true,
      colorScheme: scheme,
      scaffoldBackgroundColor: MunaxaColors.ink900,
    );
  }

  static ThemeData get light {
    final scheme = ColorScheme.fromSeed(
      seedColor: MunaxaColors.violet,
      brightness: Brightness.light,
    );
    return ThemeData(useMaterial3: true, colorScheme: scheme);
  }
}
