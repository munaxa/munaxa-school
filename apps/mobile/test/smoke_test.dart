import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:munaxa_mobile/app.dart';
import 'package:munaxa_mobile/core/config/flavor.dart';
import 'package:munaxa_mobile/data/auth/token_storage.dart';
import 'package:munaxa_mobile/features/auth/auth_providers.dart';

/// A token store with no persisted session, so the app boots to the login screen
/// without touching platform secure storage or the network.
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

void main() {
  testWidgets('Boots to the sign-in screen when there is no session', (tester) async {
    AppConfig.init(
      const AppConfig(
        flavor: Flavor.parent,
        appName: 'Munaxa Parent',
        apiBaseUrl: 'http://localhost:4000/api/v1',
      ),
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [tokenStorageProvider.overrideWithValue(_EmptyTokenStorage())],
        child: const MunaxaApp(),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sign in'), findsOneWidget);
    expect(find.text('Email or username'), findsOneWidget);
  });
}
