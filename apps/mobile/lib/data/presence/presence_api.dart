import 'package:dio/dio.dart';

import 'presence_queue.dart';

/// HTTP access to /presence/events. The endpoint is idempotent on clientRef, so replaying a
/// previously-synced event is safe (the server returns the same row with created=false).
class PresenceApi {
  PresenceApi(this._dio);

  final Dio _dio;

  /// Push one queued event. Returns true if the server accepted it (created or duplicate).
  Future<bool> sync(PendingPresenceEvent e) async {
    final res = await _dio.post<Map<String, dynamic>>('/presence/events', data: e.toJson());
    return res.statusCode != null && res.statusCode! >= 200 && res.statusCode! < 300;
  }
}
