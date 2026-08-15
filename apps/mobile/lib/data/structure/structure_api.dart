import 'package:dio/dio.dart';

/// The parent grade of a classroom, included by the sections endpoint so a picker can label it.
class SectionGrade {
  const SectionGrade({required this.nameEn, required this.nameAr});

  final String nameEn;
  final String nameAr;

  factory SectionGrade.fromJson(Map<String, dynamic> json) => SectionGrade(
        nameEn: json['nameEn'] as String? ?? '',
        nameAr: json['nameAr'] as String? ?? '',
      );
}

/// A classroom — a grade plus a section letter, e.g. "Grade 5 · A". Students stay in it and the
/// teacher comes to them, so this is what a roster, a timetable and an attendance sheet are keyed
/// on. Mirrors `classroomLabel()` in `@school/domain`.
class SectionSummary {
  const SectionSummary({required this.id, required this.name, this.gradeId, this.grade});

  final String id;
  final String name;
  final String? gradeId;
  final SectionGrade? grade;

  /// Display name for the given language code — "Grade 5 · A", or the bare section letter when
  /// the grade was not returned.
  String label(String lang) {
    final gradeName = lang == 'ar' ? grade?.nameAr : grade?.nameEn;
    if (gradeName == null || gradeName.isEmpty) return name;
    return '$gradeName · $name';
  }

  factory SectionSummary.fromJson(Map<String, dynamic> json) => SectionSummary(
        id: json['id'] as String,
        name: json['name'] as String,
        gradeId: json['gradeId'] as String?,
        grade: json['grade'] is Map<String, dynamic>
            ? SectionGrade.fromJson(json['grade'] as Map<String, dynamic>)
            : null,
      );
}

/// Read access to school structure for mobile clients (classroom pickers).
/// Listing requires section:manage OR attendance:create (teachers).
class StructureApi {
  StructureApi(this._dio);

  final Dio _dio;

  Future<List<SectionSummary>> sections() async {
    final res = await _dio.get<List<dynamic>>('/sections');
    return (res.data ?? []).cast<Map<String, dynamic>>().map(SectionSummary.fromJson).toList();
  }
}
