import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:munaxa_mobile/app.dart';
import 'package:munaxa_mobile/core/config/flavor.dart';
import 'package:munaxa_mobile/data/auth/token_storage.dart';
import 'package:munaxa_mobile/features/auth/auth_providers.dart';
import 'package:munaxa_mobile/features/settings/locale_controller.dart';

/// No persisted session → the app boots to the login screen.
class _EmptyTokenStorage implements TokenStorage {
  @override
  Future<String?> readAccess() async => null;
  @override
  Future<String?> readRefresh() async => null;
  @override
  Future<void> save({required String access, required String refresh}) async {}
  @override
  Future<void> clear() async {}
}

/// Pins the locale to Arabic without touching secure storage.
class _ArabicLocaleController extends LocaleController {
  @override
  Locale build() => const Locale('ar');
}

void main() {
  testWidgets('Arabic locale renders the app right-to-left', (tester) async {
    AppConfig.init(
      const AppConfig(
        flavor: Flavor.parent,
        appName: 'Munaxa Parent',
        apiBaseUrl: 'http://localhost:4000/api/v1',
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          tokenStorageProvider.overrideWithValue(_EmptyTokenStorage()),
          localeProvider.overrideWith(_ArabicLocaleController.new),
        ],
        child: const MunaxaApp(),
      ),
    );
    await tester.pumpAndSettle();

    // The login screen is shown, and the ambient direction is RTL (locale-independent check).
    final context = tester.element(find.byType(Scaffold).first);
    expect(Directionality.of(context), TextDirection.rtl);
  });
}
