import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../l10n/formats.dart';
import '../../l10n/strings.dart';
import '../shell/dashboard_widgets.dart';
import 'parent_portal_providers.dart';
import '../../data/parent_portal/parent_portal_api.dart';

/// Leave / absence requests for the parent's children: list, submit, and cancel.
class ParentRequestsTab extends ConsumerWidget {
  const ParentRequestsTab({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final requestsAsync = ref.watch(leaveRequestsProvider);
    final s = ref.watch(stringsProvider);
    return Scaffold(
      body: RefreshIndicator(
        onRefresh: () async => ref.invalidate(leaveRequestsProvider),
        child: requestsAsync.when(
          loading: () => const AsyncSection(loading: true, error: null, child: SizedBox()),
          error: (e, _) => AsyncSection(
            loading: false,
            error: e,
            onRetry: () => ref.invalidate(leaveRequestsProvider),
            child: const SizedBox(),
          ),
          data: (requests) {
            if (requests.isEmpty) {
              return ListView(
                children: [
                  Padding(
                    padding: const EdgeInsets.all(24),
                    child: Text(s.t('empty.noRequests')),
                  ),
                ],
              );
            }
            return ListView.builder(
              padding: const EdgeInsets.all(8),
              itemCount: requests.length,
              itemBuilder: (context, i) => _RequestTile(request: requests[i]),
            );
          },
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => _openCreateSheet(context, ref),
        icon: const Icon(Icons.add),
        label: Text(s.t('requests.new')),
      ),
    );
  }

  Future<void> _openCreateSheet(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      builder: (_) => const _NewRequestSheet(),
    );
  }
}

class _RequestTile extends ConsumerWidget {
  const _RequestTile({required this.request});

  final LeaveRequest request;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final scheme = Theme.of(context).colorScheme;
    final f = ref.watch(formatsProvider);
    final color = switch (request.status) {
      'APPROVED' => scheme.tertiary,
      'REJECTED' => scheme.error,
      'CANCELLED' => scheme.onSurfaceVariant,
      _ => scheme.secondary,
    };
    return Card(
      child: ListTile(
        title: Text('${request.type} · ${f.isoDate(request.startDate)} → ${f.isoDate(request.endDate)}'),
        subtitle: Text(request.reason, maxLines: 2, overflow: TextOverflow.ellipsis),
        trailing: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            Chip(
              label: Text(request.status, style: TextStyle(color: color, fontSize: 11)),
              visualDensity: VisualDensity.compact,
            ),
            if (request.status == 'PENDING')
              TextButton(
                onPressed: () async {
                  await ref.read(parentPortalApiProvider).cancelLeaveRequest(request.id);
                  ref.invalidate(leaveRequestsProvider);
                },
                child: Text(ref.read(stringsProvider).t('common.cancel')),
              ),
          ],
        ),
      ),
    );
  }
}

class _NewRequestSheet extends ConsumerStatefulWidget {
  const _NewRequestSheet();

  @override
  ConsumerState<_NewRequestSheet> createState() => _NewRequestSheetState();
}

class _NewRequestSheetState extends ConsumerState<_NewRequestSheet> {
  final _reason = TextEditingController();
  String _type = 'LEAVE';
  DateTime? _start;
  DateTime? _end;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  String _fmt(DateTime d) => d.toIso8601String().substring(0, 10);

  Future<void> _pickDate({required bool isStart}) async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: isStart ? (_start ?? now) : (_end ?? _start ?? now),
      firstDate: now.subtract(const Duration(days: 30)),
      lastDate: now.add(const Duration(days: 365)),
    );
    if (picked != null) {
      setState(() {
        if (isStart) {
          _start = picked;
          if (_end != null && _end!.isBefore(picked)) _end = picked;
        } else {
          _end = picked;
        }
      });
    }
  }

  Future<void> _submit() async {
    final strings = ref.read(stringsProvider);
    final childId = ref.read(selectedChildIdProvider);
    if (childId == null) {
      setState(() => _error = strings.t('requests.selectChildFirst'));
      return;
    }
    if (_start == null || _end == null || _reason.text.trim().isEmpty) {
      setState(() => _error = strings.t('requests.pickDatesReason'));
      return;
    }
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await ref.read(parentPortalApiProvider).submitLeaveRequest(
            studentId: childId,
            type: _type,
            startDate: _fmt(_start!),
            endDate: _fmt(_end!),
            reason: _reason.text.trim(),
          );
      ref.invalidate(leaveRequestsProvider);
      if (mounted) Navigator.of(context).pop();
    } catch (_) {
      setState(() => _error = strings.t('requests.submitFailed'));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final s = ref.watch(stringsProvider);
    final f = ref.watch(formatsProvider);
    final bottomInset = MediaQuery.of(context).viewInsets.bottom;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(s.t('requests.new'), style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 16),
          SegmentedButton<String>(
            segments: [
              ButtonSegment(value: 'LEAVE', label: Text(s.t('requests.leave'))),
              ButtonSegment(value: 'ABSENCE', label: Text(s.t('requests.absence'))),
            ],
            selected: {_type},
            onSelectionChanged: (sel) => setState(() => _type = sel.first),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickDate(isStart: true),
                  child: Text(_start == null ? s.t('requests.startDate') : f.date(_start!)),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: OutlinedButton(
                  onPressed: () => _pickDate(isStart: false),
                  child: Text(_end == null ? s.t('requests.endDate') : f.date(_end!)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reason,
            decoration:
                InputDecoration(labelText: s.t('requests.reason'), border: const OutlineInputBorder()),
            maxLines: 3,
          ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            Text(_error!, style: TextStyle(color: Theme.of(context).colorScheme.error)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _saving ? null : _submit,
            child: Text(_saving ? s.t('requests.submitting') : s.t('requests.submit')),
          ),
        ],
      ),
    );
  }
}
