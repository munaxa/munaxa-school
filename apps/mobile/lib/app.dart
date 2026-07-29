import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'core/push/push_service.dart';
import 'core/router/app_router.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/auth_controller.dart';
import 'features/settings/locale_controller.dart';

/// Root widget shared by all flavors. Supports Arabic (RTL) and English (LTR).
/// Restores any persisted session on first build, then hands routing to the
/// auth-guarded [routerProvider].
class MunaxaApp extends ConsumerStatefulWidget {
  const MunaxaApp({super.key});

  @override
  ConsumerState<MunaxaApp> createState() => _MunaxaAppState();
}

class _MunaxaAppState extends ConsumerState<MunaxaApp> {
  @override
  void initState() {
    super.initState();
    // Restore the session after the first frame so providers are ready.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(authControllerProvider.notifier).restore();
      // Route notification taps through the app router.
      PushService.instance.onOpenRoute = (route) => ref.read(routerProvider).go(route);
      PushService.instance.wireDeepLinks();
    });
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    return MaterialApp.router(
      title: 'Munaxa',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light,
      darkTheme: AppTheme.dark,
      themeMode: ThemeMode.dark,
      locale: ref.watch(localeProvider),
      routerConfig: router,
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: const [Locale('en'), Locale('ar')],
    );
  }
}
