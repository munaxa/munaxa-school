import 'dart:async';

import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../core/push/push_service.dart';
import '../../data/auth/auth_api.dart';
import '../communication/notifications_providers.dart';
import 'auth_providers.dart';

/// Authentication status for the app.
sealed class AuthStatus {
  const AuthStatus();
}

class AuthUnknown extends AuthStatus {
  const AuthUnknown();
}

class AuthUnauthenticated extends AuthStatus {
  const AuthUnauthenticated();
}

class AuthAuthenticated extends AuthStatus {
  const AuthAuthenticated(this.principal, {this.mustChangePassword = false});

  final Principal principal;
  final bool mustChangePassword;
}

/// Drives login/logout and exposes the current authentication status.
class AuthController extends Notifier<AuthStatus> {
  @override
  AuthStatus build() => const AuthUnknown();

  AuthApi get _api => ref.read(authApiProvider);

  /// Restore a session from secure storage on startup (call from a splash screen).
  Future<void> restore() async {
    final storage = ref.read(tokenStorageProvider);
    final access = await storage.readAccess();
    if (access == null) {
      state = const AuthUnauthenticated();
      return;
    }
    try {
      final principal = await _api.me();
      state = AuthAuthenticated(principal);
      _registerPush();
    } catch (_) {
      await storage.clear();
      state = const AuthUnauthenticated();
    }
  }

  Future<void> login({
    required String identifier,
    required String password,
    String? tenantSlug,
  }) async {
    final pair =
        await _api.login(identifier: identifier, password: password, tenantSlug: tenantSlug);
    await ref.read(tokenStorageProvider).save(access: pair.accessToken, refresh: pair.refreshToken);
    final principal = await _api.me();
    state = AuthAuthenticated(principal, mustChangePassword: pair.mustChangePassword);
    if (!pair.mustChangePassword) _registerPush();
  }

  /// Best-effort FCM device registration for the signed-in user.
  void _registerPush() {
    unawaited(PushService.instance.registerForUser(ref.read(notificationsApiProvider)));
  }

  /// Called after a successful first-login password change to clear the gate.
  void markPasswordChanged() {
    final current = state;
    if (current is AuthAuthenticated) {
      state = AuthAuthenticated(current.principal);
    }
  }

  /// Force the app back to the sign-in screen (e.g. when refresh fails). No network call.
  void forceUnauthenticated() {
    state = const AuthUnauthenticated();
  }

  Future<void> logout() async {
    final storage = ref.read(tokenStorageProvider);
    final refresh = await storage.readRefresh();
    if (refresh != null) {
      try {
        await _api.logout(refresh);
      } catch (_) {
        // best-effort
      }
    }
    await storage.clear();
    state = const AuthUnauthenticated();
  }
}

final authControllerProvider =
    NotifierProvider<AuthController, AuthStatus>(AuthController.new);
