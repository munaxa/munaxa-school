import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../shell/dashboard_widgets.dart';
import '../../data/student/student_api.dart';
import 'student_providers.dart';

/// Weekly timetable grouped by day (Sun–Thu first), ordered by period.
class StudentTimetableTab extends ConsumerWidget {
  const StudentTimetableTab({super.key});

  static const _dayOrder = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'SATURDAY'];

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final ttAsync = ref.watch(studentTimetableProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(studentTimetableProvider),
      child: ttAsync.when(
        loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
        error: (e, _) => AsyncSection(
          loading: false,
          error: e,
          onRetry: () => ref.invalidate(studentTimetableProvider),
          child: const SizedBox(),
        ),
        data: (entries) {
          if (entries.isEmpty) {
            return ListView(
              children: [
                Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(ref.read(stringsProvider).t('empty.noTimetable'))),
              ],
            );
          }
          final byDay = <String, List<TimetableEntry>>{};
          for (final e in entries) {
            byDay.putIfAbsent(e.dayOfWeek.toUpperCase(), () => <TimetableEntry>[]).add(e);
          }
          final days = byDay.keys.toList()
            ..sort((a, b) {
              final ia = _dayOrder.indexOf(a);
              final ib = _dayOrder.indexOf(b);
              return (ia == -1 ? 99 : ia).compareTo(ib == -1 ? 99 : ib);
            });
          return ListView(
            padding: const EdgeInsets.all(12),
            children: [
              for (final day in days) ...[
                Padding(
                  padding: const EdgeInsets.fromLTRB(4, 12, 4, 4),
                  child: Text(_titleCase(day), style: Theme.of(context).textTheme.titleMedium),
                ),
                for (final e in (byDay[day]!
                  ..sort((a, b) => a.classNumber.compareTo(b.classNumber))))
                  Card(
                    child: ListTile(
                      dense: true,
                      leading: CircleAvatar(child: Text('${e.classNumber}')),
                      title: Text(e.subject),
                      subtitle: Text('${e.startTime} – ${e.endTime}'),
                    ),
                  ),
              ],
            ],
          );
        },
      ),
    );
  }

  static String _titleCase(String s) =>
      s.isEmpty ? s : s[0].toUpperCase() + s.substring(1).toLowerCase();
}
