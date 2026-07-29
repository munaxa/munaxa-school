import 'package:flutter/foundation.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';

import '../../data/communication/notifications_api.dart';

/// Background isolate handler. Must be a top-level, entry-point function.
@pragma('vm:entry-point')
Future<void> firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  // No-op: the OS displays the notification. Tapping routes via onMessageOpenedApp.
}

/// FCM lifecycle: initialize Firebase, register the device token with the API (so the backend
/// can target this device), and route notification taps to in-app destinations.
///
/// No-op safe: if Firebase isn't configured for the build (no google-services.json /
/// GoogleService-Info.plist), initialization fails gracefully and every method becomes a no-op,
/// so the app still runs in dev/CI without push credentials.
class PushService {
  PushService._();
  static final PushService instance = PushService._();

  bool _ready = false;

  /// Called when a notification is tapped and carries a `route` in its data payload.
  void Function(String route)? onOpenRoute;

  /// Initialize Firebase + the background handler. Safe to call once at startup.
  Future<void> initFirebase() async {
    try {
      await Firebase.initializeApp();
      FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
      _ready = true;
    } catch (_) {
      _ready = false;
    }
  }

  /// Request notification permission and register this device's token for the signed-in user.
  /// Best-effort: failures (no Firebase, denied permission, offline) are swallowed.
  Future<void> registerForUser(NotificationsApi api) async {
    if (!_ready) return;
    try {
      final messaging = FirebaseMessaging.instance;
      await messaging.requestPermission();
      final token = await messaging.getToken();
      if (token != null) await _register(api, token);
      messaging.onTokenRefresh.listen((t) => _register(api, t));
    } catch (_) {
      // best-effort
    }
  }

  /// Wire notification-tap deep links (background + terminated launch).
  void wireDeepLinks() {
    if (!_ready) return;
    FirebaseMessaging.onMessageOpenedApp.listen(_handle);
    FirebaseMessaging.instance.getInitialMessage().then((m) {
      if (m != null) _handle(m);
    });
  }

  Future<void> _register(NotificationsApi api, String token) async {
    try {
      await api.registerDevice(token, _platform());
    } catch (_) {
      // best-effort
    }
  }

  void _handle(RemoteMessage message) {
    final route = message.data['route'];
    if (route is String && route.isNotEmpty) onOpenRoute?.call(route);
  }

  String _platform() => defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android';
}
