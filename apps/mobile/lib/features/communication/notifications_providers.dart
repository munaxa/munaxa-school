import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/communication/notifications_api.dart';
import '../auth/auth_providers.dart';

final notificationsApiProvider =
    Provider<NotificationsApi>((ref) => NotificationsApi(ref.watch(dioProvider)));

/// The current user's notification center feed.
final myNotificationsProvider = FutureProvider<List<AppNotification>>((ref) async {
  return ref.watch(notificationsApiProvider).myNotifications();
});

/// Unread badge count.
final unreadCountProvider = FutureProvider<int>((ref) async {
  return ref.watch(notificationsApiProvider).unreadCount();
});
