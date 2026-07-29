import 'bootstrap.dart';
import 'core/config/flavor.dart';

/// Entry point for the Parent app. Run with:
///   flutter run -t lib/main_parent.dart
Future<void> main() async {
  await bootstrap(
    const AppConfig(
      flavor: Flavor.parent,
      appName: 'Munaxa Parent',
      apiBaseUrl: String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000/api/v1'),
    ),
  );
}
