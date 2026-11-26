import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_web_auth_2/flutter_web_auth_2.dart';

import '../../core/config/flavor.dart';
import '../../data/auth/auth_api.dart';
import '../../data/auth/token_storage.dart';
import 'auth_controller.dart';

/// Secure token storage.
final tokenStorageProvider = Provider<TokenStorage>((ref) => TokenStorage());

/// Configured Dio client: attaches the bearer token and transparently refreshes it on a 401
/// (rotating refresh tokens, single-flight). On refresh failure the session is cleared and the
/// app returns to the sign-in screen.
final dioProvider = Provider<Dio>((ref) {
  final storage = ref.watch(tokenStorageProvider);
  final dio = Dio(
    BaseOptions(
      baseUrl: AppConfig.instance.apiBaseUrl,
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 20),
      headers: {'Content-Type': 'application/json'},
    ),
  );

  // A bare client (no interceptors) used only for the refresh call, to avoid recursion.
  final refresher = Dio(BaseOptions(baseUrl: AppConfig.instance.apiBaseUrl));

  dio.interceptors.add(
    QueuedInterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await storage.readAccess();
        if (token != null) options.headers['Authorization'] = 'Bearer $token';
        handler.next(options);
      },
      onError: (error, handler) async {
        final isAuthCall = error.requestOptions.path.startsWith('/auth/');
        if (error.response?.statusCode != 401 || isAuthCall) {
          return handler.next(error);
        }
        final refresh = await storage.readRefresh();
        if (refresh == null) {
          ref.read(authControllerProvider.notifier).forceUnauthenticated();
          return handler.next(error);
        }
        try {
          final res = await refresher.post<Map<String, dynamic>>(
            '/auth/refresh',
            data: {'refreshToken': refresh},
          );
          final pair = TokenPair.fromJson(res.data!);
          await storage.save(access: pair.accessToken, refresh: pair.refreshToken);
          // Retry the original request once with the fresh token.
          final opts = error.requestOptions;
          opts.headers['Authorization'] = 'Bearer ${pair.accessToken}';
          final retried = await dio.fetch<dynamic>(opts);
          return handler.resolve(retried);
        } catch (_) {
          await storage.clear();
          ref.read(authControllerProvider.notifier).forceUnauthenticated();
          return handler.next(error);
        }
      },
    ),
  );
  return dio;
});

final authApiProvider = Provider<AuthApi>((ref) => AuthApi(ref.watch(dioProvider)));

/// Opens [start] in the system browser (ASWebAuthenticationSession on iOS, Custom Tabs on
/// Android) and completes with the address the browser was sent back to at [returnTo].
typedef BrowserSignIn = Future<String> Function(Uri start, Uri returnTo);

final browserSignInProvider = Provider<BrowserSignIn>((ref) {
  return (start, returnTo) {
    final https = returnTo.scheme == 'https';
    return FlutterWebAuth2.authenticate(
      url: start.toString(),
      callbackUrlScheme: returnTo.scheme,
      options: https
          ? FlutterWebAuth2Options(httpsHost: returnTo.host, httpsPath: returnTo.path)
          : const FlutterWebAuth2Options(),
    );
  };
});
