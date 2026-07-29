import 'package:dio/dio.dart';

/// A bus with its last known GPS location (live bus tracking).
class BusInfo {
  const BusInfo({
    required this.id,
    required this.plateNumber,
    this.label,
    this.routeId,
    this.lastLat,
    this.lastLng,
    this.lastSeenAt,
  });

  final String id;
  final String plateNumber;
  final String? label;
  final String? routeId;
  final double? lastLat;
  final double? lastLng;
  final String? lastSeenAt;

  bool get hasLocation => lastLat != null && lastLng != null;

  factory BusInfo.fromJson(Map<String, dynamic> json) => BusInfo(
        id: json['id'] as String,
        plateNumber: json['plateNumber'] as String,
        label: json['label'] as String?,
        routeId: json['routeId'] as String?,
        lastLat: (json['lastLat'] as num?)?.toDouble(),
        lastLng: (json['lastLng'] as num?)?.toDouble(),
        lastSeenAt: json['lastSeenAt'] as String?,
      );
}

class BusRouteInfo {
  const BusRouteInfo({required this.id, required this.name, this.description});

  final String id;
  final String name;
  final String? description;

  factory BusRouteInfo.fromJson(Map<String, dynamic> json) => BusRouteInfo(
        id: json['id'] as String,
        name: json['name'] as String,
        description: json['description'] as String?,
      );
}

class LibraryBookInfo {
  const LibraryBookInfo({
    required this.id,
    required this.title,
    required this.copiesAvailable,
    required this.copiesTotal,
    this.author,
    this.category,
  });

  final String id;
  final String title;
  final int copiesAvailable;
  final int copiesTotal;
  final String? author;
  final String? category;

  bool get isAvailable => copiesAvailable > 0;

  factory LibraryBookInfo.fromJson(Map<String, dynamic> json) => LibraryBookInfo(
        id: json['id'] as String,
        title: json['title'] as String,
        copiesAvailable: json['copiesAvailable'] as int,
        copiesTotal: json['copiesTotal'] as int,
        author: json['author'] as String?,
        category: json['category'] as String?,
      );
}

/// Client for the feature-flagged advanced modules (Phase 14). Endpoints return 403 when the
/// module is disabled for the tenant — callers surface that as "not available".
class AdvancedApi {
  AdvancedApi(this._dio);

  final Dio _dio;

  // --- Bus tracking ---------------------------------------------------------
  Future<List<BusRouteInfo>> busRoutes() async {
    final res = await _dio.get<List<dynamic>>('/bus/routes');
    return (res.data ?? []).map((e) => BusRouteInfo.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<BusInfo>> buses() async {
    final res = await _dio.get<List<dynamic>>('/bus/vehicles');
    return (res.data ?? []).map((e) => BusInfo.fromJson(e as Map<String, dynamic>)).toList();
  }

  // --- Library --------------------------------------------------------------
  Future<List<LibraryBookInfo>> libraryBooks() async {
    final res = await _dio.get<List<dynamic>>('/library/books');
    return (res.data ?? [])
        .map((e) => LibraryBookInfo.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
