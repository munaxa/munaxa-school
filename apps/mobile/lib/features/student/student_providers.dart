import 'package:flutter_riverpod/flutter_riverpod.dart';

// Only GradeReport: academics_api also defines a HomeworkItem that would clash with student_api's.
import '../../data/academics/academics_api.dart' show GradeReport;
import '../../data/student/student_api.dart';
import '../academics/academics_providers.dart';
import '../auth/auth_providers.dart';

final studentApiProvider = Provider<StudentApi>((ref) => StudentApi(ref.watch(dioProvider)));

/// The student dashboard (attendance, homework, grades, gamification rollup).
final studentDashboardProvider = FutureProvider<StudentDashboard>((ref) async {
  return ref.watch(studentApiProvider).dashboard();
});

/// The signed-in student's own grade report (studentId resolved from the dashboard).
final studentGradeReportProvider = FutureProvider<GradeReport>((ref) async {
  final dash = await ref.watch(studentDashboardProvider.future);
  return ref.watch(academicsApiProvider).gradeReport(dash.studentId);
});

final studentHomeworkProvider = FutureProvider<List<HomeworkItem>>((ref) async {
  return ref.watch(studentApiProvider).homework();
});

final studentAttendanceProvider = FutureProvider<List<AttendanceEntry>>((ref) async {
  return ref.watch(studentApiProvider).attendance();
});

final studentTimetableProvider = FutureProvider<List<TimetableEntry>>((ref) async {
  return ref.watch(studentApiProvider).timetable();
});

final studentResourcesProvider = FutureProvider<List<LearningResource>>((ref) async {
  return ref.watch(studentApiProvider).resources();
});

final studentGamificationProvider = FutureProvider<GamificationSummary>((ref) async {
  return ref.watch(studentApiProvider).gamification();
});

final studentAchievementsProvider = FutureProvider<List<EarnedAchievement>>((ref) async {
  return ref.watch(studentApiProvider).achievements();
});
