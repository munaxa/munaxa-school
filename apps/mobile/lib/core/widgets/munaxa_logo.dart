import 'package:flutter/material.dart';

/// The Munaxa wordmark logo, sized by [height]. Aspect ratio is preserved. Theme-aware: the
/// black-bordered light logo in light mode, the white-bordered dark logo in dark mode.
class MunaxaLogo extends StatelessWidget {
  const MunaxaLogo({super.key, this.height = 96});

  final double height;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return Image.asset(
      isDark ? 'assets/munaxa-logo-dark.png' : 'assets/munaxa-logo-light.png',
      height: height,
      fit: BoxFit.contain,
      filterQuality: FilterQuality.medium,
    );
  }
}
