import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/academics/academics_api.dart';
import '../../l10n/formats.dart';
import '../../l10n/strings.dart';
import '../shell/dashboard_widgets.dart';

/// Renders a [GradeReport] (overall % + per-subject averages). Shared by the student and
/// parent academic tabs. [onRetry] re-fetches the underlying provider.
class GradeReportView extends ConsumerWidget {
  const GradeReportView({super.key, required this.report, required this.onRetry});

  final AsyncValue<GradeReport> report;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final s = ref.watch(stringsProvider);
    final f = ref.watch(formatsProvider);
    return RefreshIndicator(
      onRefresh: () async => onRetry(),
      child: report.when(
        loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
        error: (e, _) => AsyncSection(
          loading: false,
          error: e,
          onRetry: onRetry,
          child: const SizedBox(),
        ),
        data: (r) {
          if (r.subjects.isEmpty) {
            return ListView(
              children: [Padding(padding: const EdgeInsets.all(24), child: Text(s.t('grades.empty')))],
            );
          }
          return ListView(
            padding: const EdgeInsets.all(16),
            children: [
              MetricCard(
                label: s.t('grades.overall'),
                value: '${f.decimal1(r.overallPercent)}%',
                icon: Icons.grade,
              ),
              const SizedBox(height: 16),
              Text(s.t('grades.subjects'), style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              for (final subject in r.subjects)
                Card(
                  child: ListTile(
                    title: Text(subject.subject),
                    subtitle: Text('${f.number(subject.count)} ${s.t('grades.assessments')}'),
                    trailing: Text(
                      '${f.decimal1(subject.averagePercent)}%',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ),
            ],
          );
        },
      ),
    );
  }
}
