import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../settings/locale_toggle.dart';
import 'teacher_class_screen.dart';
import 'teacher_home_screen.dart';
import 'teacher_account_screen.dart';

/// The teacher app frame: class (offline-first attendance capture) · notifications · account.
class TeacherShell extends ConsumerStatefulWidget {
  const TeacherShell({super.key});

  @override
  ConsumerState<TeacherShell> createState() => _TeacherShellState();
}

class _TeacherShellState extends ConsumerState<TeacherShell> {
  int _index = 0;

  static const _titleKeys = [
    'teacher.tab.class',
    'teacher.tab.notifications',
    'teacher.tab.account',
  ];

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t(_titleKeys[_index])),
        actions: const [LocaleToggleButton()],
      ),
      body: IndexedStack(
        index: _index,
        children: const [
          TeacherClassTab(),
          TeacherNotificationsTab(),
          TeacherAccountTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.fact_check_outlined), label: s.t('teacher.tab.class')),
          NavigationDestination(
              icon: const Icon(Icons.notifications_outlined),
              label: s.t('teacher.tab.notifications')),
          NavigationDestination(
              icon: const Icon(Icons.person_outline), label: s.t('teacher.tab.account')),
        ],
      ),
    );
  }
}
