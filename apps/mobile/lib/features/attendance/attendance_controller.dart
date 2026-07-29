import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/attendance/attendance_api.dart';
import '../../data/attendance/attendance_queue.dart';
import '../auth/auth_providers.dart';

final attendanceQueueProvider = Provider<AttendanceQueue>((ref) => AttendanceQueue());
final attendanceApiProvider = Provider<AttendanceApi>((ref) => AttendanceApi(ref.watch(dioProvider)));

/// Offline-first attendance controller.
///
/// Marking writes to the local write-ahead queue first (instant, works offline), then attempts
/// a sync. A connectivity listener drains the queue automatically when the network returns.
/// The server's bulk endpoint is idempotent, so replays never duplicate.
class AttendanceController extends Notifier<int> {
  StreamSubscription<List<ConnectivityResult>>? _sub;

  @override
  int build() {
    final connectivity = Connectivity();
    _sub = connectivity.onConnectivityChanged.listen((results) {
      final online = results.any((r) => r != ConnectivityResult.none);
      if (online) unawaited(sync());
    });
    ref.onDispose(() => _sub?.cancel());
    unawaited(_refreshCount());
    return 0; // pending count
  }

  AttendanceQueue get _queue => ref.read(attendanceQueueProvider);
  AttendanceApi get _api => ref.read(attendanceApiProvider);

  /// Record a mark locally (optimistic) and try to sync immediately.
  Future<void> mark({
    required String sectionId,
    required String date,
    required int classNumber,
    required String studentId,
    required String status,
  }) async {
    await _queue.enqueue(
      PendingMark(
        clientRef: '$sectionId:$date:$classNumber:$studentId',
        sectionId: sectionId,
        date: date,
        classNumber: classNumber,
        studentId: studentId,
        status: status,
      ),
    );
    await _refreshCount();
    await sync();
  }

  /// Record a whole roster locally (one queue write per student), then sync once.
  /// Used by the class screen's "Save" so a 30-student roster is a single batch POST.
  Future<void> markMany({
    required String sectionId,
    required String date,
    required int classNumber,
    required Map<String, String> statusByStudentId,
  }) async {
    for (final entry in statusByStudentId.entries) {
      await _queue.enqueue(
        PendingMark(
          clientRef: '$sectionId:$date:$classNumber:${entry.key}',
          sectionId: sectionId,
          date: date,
          classNumber: classNumber,
          studentId: entry.key,
          status: entry.value,
        ),
      );
    }
    await _refreshCount();
    await sync();
  }

  /// Drain the queue: group by (section, date, period) and POST each batch idempotently.
  Future<void> sync() async {
    final pending = await _queue.pending();
    if (pending.isEmpty) return;

    final batches = <String, List<PendingMark>>{};
    for (final mark in pending) {
      batches.putIfAbsent('${mark.sectionId}|${mark.date}|${mark.classNumber}', () => []).add(mark);
    }

    for (final marks in batches.values) {
      final first = marks.first;
      try {
        await _api.syncBatch(
          sectionId: first.sectionId,
          date: first.date,
          classNumber: first.classNumber,
          marks: marks,
        );
        await _queue.removeByRefs(marks.map((m) => m.clientRef).toSet());
      } catch (_) {
        // Stay queued; the next connectivity change or manual sync retries.
      }
    }
    await _refreshCount();
  }

  Future<void> _refreshCount() async {
    state = await _queue.count();
  }
}

/// Exposes the pending (unsynced) attendance mark count.
final attendanceControllerProvider =
    NotifierProvider<AttendanceController, int>(AttendanceController.new);
