/// Build flavor for the Munaxa mobile apps. One codebase, three audiences.
enum Flavor { parent, student, teacher }

class AppConfig {
  const AppConfig({
    required this.flavor,
    required this.appName,
    required this.apiBaseUrl,
    this.munaxaSignInReturn,
  });

  final Flavor flavor;
  final String appName;
  final String apiBaseUrl;

  /// Where School returns a "Sign in with Munaxa" to this app (School's
  /// `IDENTITY_APP_REDIRECT_URI`). Null: this app signs in with a password only.
  final String? munaxaSignInReturn;

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
