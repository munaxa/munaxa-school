import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';
import '../communication/notifications_providers.dart';
import '../shell/dashboard_widgets.dart';

/// Teacher notifications tab: unread metric + the notification feed.
/// (Attendance capture is the offline-first flow in the attendance feature.)
class TeacherNotificationsTab extends ConsumerWidget {
  const TeacherNotificationsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final unread = ref.watch(unreadCountProvider);
    final feed = ref.watch(myNotificationsProvider);
    final s = ref.watch(stringsProvider);

    return RefreshIndicator(
      onRefresh: () async {
        ref.invalidate(unreadCountProvider);
        ref.invalidate(myNotificationsProvider);
      },
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          MetricCard(
            label: s.t('metric.unreadNotifications'),
            value: unread.maybeWhen(data: (n) => '$n', orElse: () => '—'),
            icon: Icons.notifications,
          ),
          const SizedBox(height: 16),
          Text(s.t('teacher.tab.notifications'), style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          feed.when(
            loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
            error: (e, _) => AsyncSection(
              loading: false,
              error: e,
              onRetry: () => ref.invalidate(myNotificationsProvider),
              child: const SizedBox(),
            ),
            data: (items) {
              if (items.isEmpty) {
                return Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(s.t('empty.noNotifications')),
                );
              }
              return Column(
                children: [
                  for (final n in items)
                    Card(
                      child: ListTile(
                        leading: Icon(
                          n.read ? Icons.mark_email_read : Icons.mark_email_unread,
                          color: n.read
                              ? Theme.of(context).colorScheme.onSurfaceVariant
                              : Theme.of(context).colorScheme.primary,
                        ),
                        title: Text(n.title),
                        subtitle: Text(n.body, maxLines: 2, overflow: TextOverflow.ellipsis),
                      ),
                    ),
                ],
              );
            },
          ),
        ],
      ),
    );
  }
}
