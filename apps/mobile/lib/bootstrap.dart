import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/date_symbol_data_local.dart';

import 'app.dart';
import 'core/config/flavor.dart';
import 'core/push/push_service.dart';

/// Shared bootstrap for all flavors. Initializes config + Riverpod scope, locale date
/// formatting (en/ar), and best-effort Firebase/FCM (a no-op when Firebase isn't configured).
Future<void> bootstrap(AppConfig config) async {
  WidgetsFlutterBinding.ensureInitialized();
  AppConfig.init(config);
  await initializeDateFormatting();
  await PushService.instance.initFirebase();

  runApp(
    const ProviderScope(
      child: MunaxaApp(),
    ),
  );
}
