import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../academics/academics_providers.dart';
import '../academics/grade_report_view.dart';
import 'parent_portal_providers.dart';

/// The selected child's grade report.
class ParentGradesTab extends ConsumerWidget {
  const ParentGradesTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childId = ref.watch(selectedChildIdProvider);
    if (childId == null) {
      final s = ref.watch(stringsProvider);
      return Center(child: Text(s.t('grades.selectChild')));
    }
    return GradeReportView(
      report: ref.watch(gradeReportProvider(childId)),
      onRetry: () => ref.invalidate(gradeReportProvider(childId)),
    );
  }
}
