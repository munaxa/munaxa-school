import 'package:dio/dio.dart';

class HomeworkItem {
  const HomeworkItem({
    required this.id,
    required this.subject,
    required this.title,
    required this.dueDate,
  });

  final String id;
  final String subject;
  final String title;
  final String dueDate;

  factory HomeworkItem.fromJson(Map<String, dynamic> json) => HomeworkItem(
        id: json['id'] as String,
        subject: json['subject'] as String,
        title: json['title'] as String,
        dueDate: json['dueDate'] as String,
      );
}

class SubjectReport {
  const SubjectReport({required this.subject, required this.averagePercent, required this.count});
  final String subject;
  final double averagePercent;
  final int count;

  factory SubjectReport.fromJson(Map<String, dynamic> json) => SubjectReport(
        subject: json['subject'] as String,
        averagePercent: (json['averagePercent'] as num).toDouble(),
        count: (json['count'] as num).toInt(),
      );
}

class GradeReport {
  const GradeReport({required this.overallPercent, required this.subjects});
  final double overallPercent;
  final List<SubjectReport> subjects;

  factory GradeReport.fromJson(Map<String, dynamic> json) => GradeReport(
        overallPercent: (json['overallPercent'] as num).toDouble(),
        subjects: ((json['subjects'] as List<dynamic>?) ?? [])
            .cast<Map<String, dynamic>>()
            .map(SubjectReport.fromJson)
            .toList(),
      );
}

/// Academic reads for the Student/Parent apps (homework list + grade report).
class AcademicsApi {
  AcademicsApi(this._dio);

  final Dio _dio;

  Future<List<HomeworkItem>> homework(String sectionId) async {
    final res = await _dio.get<List<dynamic>>(
      '/homework',
      queryParameters: {'sectionId': sectionId},
    );
    return (res.data ?? []).cast<Map<String, dynamic>>().map(HomeworkItem.fromJson).toList();
  }

  Future<GradeReport> gradeReport(String studentId, {String? semesterId}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/grade-records/students/$studentId/report',
      queryParameters: {if (semesterId != null) 'semesterId': semesterId},
    );
    return GradeReport.fromJson(res.data!);
  }
}
