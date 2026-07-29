import 'package:dio/dio.dart';

class AppNotification {
  const AppNotification({
    required this.id,
    required this.title,
    required this.body,
    required this.read,
    this.category,
  });

  final String id;
  final String title;
  final String body;
  final bool read;
  final String? category;

  factory AppNotification.fromJson(Map<String, dynamic> json) => AppNotification(
        id: json['id'] as String,
        title: json['title'] as String,
        body: json['body'] as String,
        read: json['readAt'] != null,
        category: json['category'] as String?,
      );
}

/// The in-app notification center + FCM device registration for mobile clients.
class NotificationsApi {
  NotificationsApi(this._dio);

  final Dio _dio;

  Future<List<AppNotification>> myNotifications() async {
    final res = await _dio.get<List<dynamic>>('/notifications/me');
    return (res.data ?? []).cast<Map<String, dynamic>>().map(AppNotification.fromJson).toList();
  }

  Future<int> unreadCount() async {
    final res = await _dio.get<Map<String, dynamic>>('/notifications/me/unread-count');
    return (res.data?['count'] as num?)?.toInt() ?? 0;
  }

  Future<void> markRead(String id) async {
    await _dio.post<Map<String, dynamic>>('/notifications/$id/read');
  }

  Future<void> registerDevice(String token, String platform) async {
    await _dio.post<Map<String, dynamic>>(
      '/notifications/devices',
      data: {'token': token, 'platform': platform},
    );
  }
}
