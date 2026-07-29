import 'bootstrap.dart';
import 'core/config/flavor.dart';

/// Entry point for the Teacher app. Run with:
///   flutter run -t lib/main_teacher.dart
Future<void> main() async {
  await bootstrap(
    const AppConfig(
      flavor: Flavor.teacher,
      appName: 'Munaxa Teacher',
      apiBaseUrl: String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000/api/v1'),
    ),
  );
}
