import 'package:dio/dio.dart';

/// A Munaxa token pair plus the first-login flag.
class TokenPair {
  const TokenPair({
    required this.accessToken,
    required this.refreshToken,
    required this.expiresIn,
    this.mustChangePassword = false,
  });

  final String accessToken;
  final String refreshToken;
  final int expiresIn;
  final bool mustChangePassword;

  factory TokenPair.fromJson(Map<String, dynamic> json) {
    return TokenPair(
      accessToken: json['accessToken'] as String,
      refreshToken: json['refreshToken'] as String,
      expiresIn: (json['expiresIn'] as num?)?.toInt() ?? 0,
      mustChangePassword: json['mustChangePassword'] as bool? ?? false,
    );
  }
}

/// The authenticated principal returned by GET /auth/me.
class Principal {
  const Principal({
    required this.userId,
    required this.tenantId,
    required this.isPlatform,
    required this.roles,
    required this.permissions,
  });

  final String userId;
  final String tenantId;
  final bool isPlatform;
  final List<String> roles;
  final List<String> permissions;

  factory Principal.fromJson(Map<String, dynamic> json) {
    return Principal(
      userId: json['userId'] as String,
      tenantId: json['tenantId'] as String,
      isPlatform: json['isPlatform'] as bool? ?? false,
      roles: (json['roles'] as List<dynamic>? ?? []).cast<String>(),
      permissions: (json['permissions'] as List<dynamic>? ?? []).cast<String>(),
    );
  }
}

/// Thin HTTP wrapper over the Munaxa auth endpoints.
class AuthApi {
  AuthApi(this._dio);

  final Dio _dio;

  Future<TokenPair> login({
    required String identifier,
    required String password,
    String? tenantSlug,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>('/auth/login', data: {
      // The API accepts email or username via `identifier` (falls back to `email`).
      'identifier': identifier,
      'password': password,
      if (tenantSlug != null && tenantSlug.isNotEmpty) 'tenantSlug': tenantSlug,
    });
    return TokenPair.fromJson(res.data!);
  }

  Future<TokenPair> refresh(String refreshToken) async {
    final res = await _dio.post<Map<String, dynamic>>(
      '/auth/refresh',
      data: {'refreshToken': refreshToken},
    );
    return TokenPair.fromJson(res.data!);
  }

  Future<void> logout(String refreshToken) async {
    await _dio.post<void>('/auth/logout', data: {'refreshToken': refreshToken});
  }

  Future<Principal> me() async {
    final res = await _dio.get<Map<String, dynamic>>('/auth/me');
    return Principal.fromJson(res.data!);
  }

  Future<void> changePassword({
    required String currentPassword,
    required String newPassword,
  }) async {
    await _dio.post<void>('/auth/password/change', data: {
      'currentPassword': currentPassword,
      'newPassword': newPassword,
    });
  }
}
