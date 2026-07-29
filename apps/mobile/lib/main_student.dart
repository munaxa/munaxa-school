import 'bootstrap.dart';
import 'core/config/flavor.dart';

/// Entry point for the Student app. Run with:
///   flutter run -t lib/main_student.dart
Future<void> main() async {
  await bootstrap(
    const AppConfig(
      flavor: Flavor.student,
      appName: 'Munaxa Student',
      apiBaseUrl: String.fromEnvironment('API_URL', defaultValue: 'http://localhost:4000/api/v1'),
    ),
  );
}
