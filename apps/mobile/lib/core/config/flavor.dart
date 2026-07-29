/// Build flavor for the Munaxa mobile apps. One codebase, three audiences.
enum Flavor { parent, student, teacher }

class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.appName,
    required this.apiBaseUrl,
  });

  final Flavor flavor;
  final String appName;
  final String apiBaseUrl;

  static AppConfig? _instance;

  static AppConfig get instance {
    final value = _instance;
    if (value == null) {
      throw StateError('AppConfig has not been initialized. Call AppConfig.init().');
    }
    return value;
  }

  static void init(AppConfig config) => _instance = config;
}
