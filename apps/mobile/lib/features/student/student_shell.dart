import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../auth/auth_controller.dart';
import '../settings/locale_toggle.dart';
import 'student_grades_screen.dart';
import 'student_home_screen.dart';
import 'student_timetable_screen.dart';
import 'student_homework_screen.dart';
import 'student_resources_screen.dart';

/// The student app frame: app bar (sign-out) over the dashboard / timetable /
/// homework / resources tabs.
class StudentShell extends ConsumerStatefulWidget {
  const StudentShell({super.key});

  @override
  ConsumerState<StudentShell> createState() => _StudentShellState();
}

class _StudentShellState extends ConsumerState<StudentShell> {
  int _index = 0;

  static const _titleKeys = [
    'student.tab.home',
    'student.tab.timetable',
    'student.tab.homework',
    'student.tab.resources',
    'student.tab.grades',
  ];

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t(_titleKeys[_index])),
        actions: [
          const LocaleToggleButton(),
          IconButton(
            icon: const Icon(Icons.logout),
            tooltip: s.t('common.signOut'),
            onPressed: () => ref.read(authControllerProvider.notifier).logout(),
          ),
        ],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          StudentDashboardTab(),
          StudentTimetableTab(),
          StudentHomeworkTab(),
          StudentResourcesTab(),
          StudentGradesTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined), label: s.t('student.tab.home')),
          NavigationDestination(
              icon: const Icon(Icons.calendar_today_outlined), label: s.t('student.tab.timetable')),
          NavigationDestination(
              icon: const Icon(Icons.assignment_outlined), label: s.t('student.tab.homework')),
          NavigationDestination(
              icon: const Icon(Icons.school_outlined), label: s.t('student.tab.resources')),
          NavigationDestination(
              icon: const Icon(Icons.grade_outlined), label: s.t('student.tab.grades')),
        ],
      ),
    );
  }
}
