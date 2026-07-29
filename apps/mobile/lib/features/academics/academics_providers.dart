import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/academics/academics_api.dart';
import '../auth/auth_providers.dart';

final academicsApiProvider =
    Provider<AcademicsApi>((ref) => AcademicsApi(ref.watch(dioProvider)));

/// Homework for a section (Student app).
final homeworkProvider =
    FutureProvider.family<List<HomeworkItem>, String>((ref, sectionId) async {
  return ref.watch(academicsApiProvider).homework(sectionId);
});

/// Grade report for a student (Student/Parent academic view).
final gradeReportProvider =
    FutureProvider.family<GradeReport, String>((ref, studentId) async {
  return ref.watch(academicsApiProvider).gradeReport(studentId);
});
