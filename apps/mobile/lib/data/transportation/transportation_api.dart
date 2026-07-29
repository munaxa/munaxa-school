import 'package:dio/dio.dart';

import 'transportation_queue.dart';

/// HTTP access to /transport/events. Idempotent on clientRef — safe to replay.
class TransportationApi {
  TransportationApi(this._dio);

  final Dio _dio;

  Future<bool> sync(PendingBusEvent e) async {
    final res = await _dio.post<Map<String, dynamic>>('/transport/events', data: e.toJson());
    return res.statusCode != null && res.statusCode! >= 200 && res.statusCode! < 300;
  }
}
