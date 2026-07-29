import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../config/flavor.dart';
import '../widgets/munaxa_logo.dart';
import '../../features/auth/auth_controller.dart';
import '../../features/auth/login_screen.dart';
import '../../features/auth/change_password_screen.dart';
import '../../features/parent_portal/parent_shell.dart';
import '../../features/student/student_shell.dart';
import '../../features/teacher/teacher_shell.dart';

/// The app's router, auth-guarded by [authControllerProvider]:
///   AuthUnknown          → /splash (session restore in flight)
///   AuthUnauthenticated  → /login
///   must change password → /change-password
///   AuthAuthenticated    → / (the flavor home)
final routerProvider = Provider<GoRouter>((ref) {
  // Bridge the Riverpod auth state to a Listenable so GoRouter re-evaluates redirect on change.
  final refresh = _AuthRefreshNotifier(ref);
  ref.onDispose(refresh.dispose);

  return GoRouter(
    initialLocation: '/splash',
    refreshListenable: refresh,
    redirect: (context, state) {
      final status = ref.read(authControllerProvider);
      final loc = state.matchedLocation;

      if (status is AuthUnknown) {
        return loc == '/splash' ? null : '/splash';
      }
      if (status is AuthUnauthenticated) {
        return loc == '/login' ? null : '/login';
      }
      if (status is AuthAuthenticated) {
        if (status.mustChangePassword) {
          return loc == '/change-password' ? null : '/change-password';
        }
        // Authenticated: bounce away from auth/splash routes.
        if (loc == '/login' || loc == '/splash' || loc == '/change-password') return '/';
      }
      return null;
    },
    routes: [
      GoRoute(path: '/splash', builder: (_, __) => const _SplashScreen()),
      GoRoute(path: '/login', builder: (_, __) => const LoginScreen()),
      GoRoute(path: '/change-password', builder: (_, __) => const ChangePasswordScreen()),
      GoRoute(path: '/', builder: (_, __) => const _FlavorHome()),
    ],
  );
});

/// Picks the home screen for the active build flavor.
class _FlavorHome extends StatelessWidget {
  const _FlavorHome();

  @override
  Widget build(BuildContext context) {
    switch (AppConfig.instance.flavor) {
      case Flavor.parent:
        return const ParentShell();
      case Flavor.student:
        return const StudentShell();
      case Flavor.teacher:
        return const TeacherShell();
    }
  }
}

class _SplashScreen extends StatelessWidget {
  const _SplashScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            MunaxaLogo(height: 120),
            SizedBox(height: 28),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}

/// Fires [notifyListeners] whenever the auth status changes.
class _AuthRefreshNotifier extends ChangeNotifier {
  _AuthRefreshNotifier(Ref ref) {
    _sub = ref.listen<AuthStatus>(
      authControllerProvider,
      (_, __) => notifyListeners(),
      fireImmediately: false,
    );
  }

  late final ProviderSubscription<AuthStatus> _sub;

  @override
  void dispose() {
    _sub.close();
    super.dispose();
  }
}
