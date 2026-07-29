import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/strings.dart';

/// A compact metric tile used across the parent/student/teacher dashboards.
class MetricCard extends StatelessWidget {
  const MetricCard({
    super.key,
    required this.label,
    required this.value,
    this.icon,
    this.tone,
  });

  final String label;
  final String value;
  final IconData? icon;
  final Color? tone;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisSize: MainAxisSize.min,
          children: [
            Row(
              children: [
                if (icon != null) ...[
                  Icon(icon, size: 18, color: tone ?? scheme.primary),
                  const SizedBox(width: 6),
                ],
                Expanded(
                  child: Text(
                    label.toUpperCase(),
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: scheme.onSurfaceVariant,
                          letterSpacing: 0.5,
                        ),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              value,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: tone,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A loading/error/empty-aware wrapper for an async section body.
class AsyncSection extends ConsumerWidget {
  const AsyncSection({
    super.key,
    required this.loading,
    required this.error,
    required this.child,
    this.onRetry,
  });

  final bool loading;
  final Object? error;
  final Widget child;
  final VoidCallback? onRetry;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (loading) {
      return const Padding(
        padding: EdgeInsets.all(32),
        child: Center(child: CircularProgressIndicator()),
      );
    }
    if (error != null) {
      final s = ref.watch(stringsProvider);
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Text(
              s.t('common.loadError'),
              style: TextStyle(color: Theme.of(context).colorScheme.error),
            ),
            if (onRetry != null) ...[
              const SizedBox(height: 8),
              OutlinedButton(onPressed: onRetry, child: Text(s.t('common.retry'))),
            ],
          ],
        ),
      );
    }
    return child;
  }
}

/// Computes an attendance "present rate" percentage from a status→count map.
int? attendanceRate(Map<String, int> counts) {
  final total = counts.values.fold<int>(0, (a, b) => a + b);
  if (total == 0) return null;
  final present = (counts['PRESENT'] ?? 0) + (counts['LATE'] ?? 0);
  return ((present / total) * 100).round();
}
