import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../l10n/strings.dart';
import '../shell/dashboard_widgets.dart';
import 'student_providers.dart';

/// Learning resources: links and downloadable files that open externally.
class StudentResourcesTab extends ConsumerWidget {
  const StudentResourcesTab({super.key});

  IconData _iconFor(String type) {
    switch (type) {
      case 'VIDEO':
        return Icons.play_circle_outline;
      case 'LINK':
        return Icons.link;
      case 'FILE':
      case 'DOCUMENT':
        return Icons.description_outlined;
      default:
        return Icons.school_outlined;
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final resAsync = ref.watch(studentResourcesProvider);
    return RefreshIndicator(
      onRefresh: () async => ref.invalidate(studentResourcesProvider),
      child: resAsync.when(
        loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
        error: (e, _) => AsyncSection(
          loading: false,
          error: e,
          onRetry: () => ref.invalidate(studentResourcesProvider),
          child: const SizedBox(),
        ),
        data: (resources) {
          if (resources.isEmpty) {
            return ListView(
              children: [
                Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(ref.read(stringsProvider).t('empty.noResources'))),
              ],
            );
          }
          return ListView.builder(
            padding: const EdgeInsets.all(8),
            itemCount: resources.length,
            itemBuilder: (context, i) {
              final r = resources[i];
              final url = r.openUrl;
              return Card(
                child: ListTile(
                  leading: Icon(_iconFor(r.type)),
                  title: Text(r.title),
                  subtitle: Text(
                    r.subject ?? r.type,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  trailing: url == null ? null : const Icon(Icons.open_in_new, size: 18),
                  onTap: url == null
                      ? null
                      : () async {
                          final messenger = ScaffoldMessenger.of(context);
                          final ok = await launchUrl(
                            Uri.parse(url),
                            mode: LaunchMode.externalApplication,
                          );
                          if (!ok) {
                            messenger.showSnackBar(
                              SnackBar(
                                  content: Text(ref.read(stringsProvider).t('resources.openFailed'))),
                            );
                          }
                        },
                ),
              );
            },
          );
        },
      ),
    );
  }
}
