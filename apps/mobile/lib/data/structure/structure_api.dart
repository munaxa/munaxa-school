import 'package:dio/dio.dart';

/// A class section (e.g. "Grade 5 — A") as listed for roster pickers.
class SectionSummary {
  const SectionSummary({required this.id, required this.name, this.gradeId});

  final String id;
  final String name;
  final String? gradeId;

  factory SectionSummary.fromJson(Map<String, dynamic> json) => SectionSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        gradeId: json['gradeId'] as String?,
      );
}

/// Read access to school structure for mobile clients (section pickers).
/// Listing requires section:manage OR attendance:create (teachers).
class StructureApi {
  StructureApi(this._dio);

  final Dio _dio;

  Future<List<SectionSummary>> sections() async {
    final res = await _dio.get<List<dynamic>>('/sections');
    return (res.data ?? []).cast<Map<String, dynamic>>().map(SectionSummary.fromJson).toList();
  }
}
