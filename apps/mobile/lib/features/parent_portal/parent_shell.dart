import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../auth/auth_controller.dart';
import '../settings/locale_toggle.dart';
import 'parent_grades_screen.dart';
import 'parent_portal_providers.dart';
import 'parent_home_screen.dart';
import 'parent_requests_screen.dart';
import 'parent_meetings_screen.dart';
import 'parent_documents_screen.dart';

/// The parent app frame: a shared app bar (child switcher + sign-out) and a bottom
/// navigation bar over the dashboard / requests / meetings / documents tabs.
class ParentShell extends ConsumerStatefulWidget {
  const ParentShell({super.key});

  @override
  ConsumerState<ParentShell> createState() => _ParentShellState();
}

class _ParentShellState extends ConsumerState<ParentShell> {
  int _index = 0;

  static const _titleKeys = [
    'parent.tab.home',
    'parent.tab.grades',
    'parent.tab.requests',
    'parent.tab.meetings',
    'parent.tab.documents',
  ];

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    return Scaffold(
      appBar: AppBar(
        title: Text(s.t(_titleKeys[_index])),
        actions: [
          const _ChildSwitcherAction(),
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
          ParentDashboardTab(),
          ParentGradesTab(),
          ParentRequestsTab(),
          ParentMeetingsTab(),
          ParentDocumentsTab(),
        ],
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _index,
        onDestinationSelected: (i) => setState(() => _index = i),
        destinations: [
          NavigationDestination(
              icon: const Icon(Icons.dashboard_outlined), label: s.t('parent.tab.home')),
          NavigationDestination(
              icon: const Icon(Icons.grade_outlined), label: s.t('parent.tab.grades')),
          NavigationDestination(
              icon: const Icon(Icons.beach_access_outlined), label: s.t('parent.tab.requests')),
          NavigationDestination(
              icon: const Icon(Icons.groups_outlined), label: s.t('parent.tab.meetings')),
          NavigationDestination(
              icon: const Icon(Icons.folder_outlined), label: s.t('parent.tab.documents')),
        ],
      ),
    );
  }
}

/// App-bar control to switch the active child; hidden when there is only one (or none).
class _ChildSwitcherAction extends ConsumerWidget {
  const _ChildSwitcherAction();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final childrenAsync = ref.watch(childrenProvider);
    final selectedId = ref.watch(selectedChildIdProvider);
    return childrenAsync.maybeWhen(
      data: (children) {
        if (children.length < 2) return const SizedBox.shrink();
        final current = children.where((c) => c.studentId == selectedId);
        final label = current.isEmpty ? 'Child' : current.first.firstNameEn;
        return PopupMenuButton<String>(
          onSelected: (id) => ref.read(selectedChildIdProvider.notifier).state = id,
          itemBuilder: (_) => [
            for (final c in children)
              PopupMenuItem(value: c.studentId, child: Text(c.fullNameEn)),
          ],
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 8),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(label),
                const Icon(Icons.arrow_drop_down),
              ],
            ),
          ),
        );
      },
      orElse: () => const SizedBox.shrink(),
    );
  }
}
