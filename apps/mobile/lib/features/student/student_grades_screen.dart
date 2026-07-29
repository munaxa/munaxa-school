import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../academics/grade_report_view.dart';
import 'student_providers.dart';

/// The student's own grade report.
class StudentGradesTab extends ConsumerWidget {
  const StudentGradesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return GradeReportView(
      report: ref.watch(studentGradeReportProvider),
      onRetry: () => ref.invalidate(studentGradeReportProvider),
    );
  }
}
