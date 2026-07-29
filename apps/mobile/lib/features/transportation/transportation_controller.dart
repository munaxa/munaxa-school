import 'dart:async';

import '../../data/transportation/transportation_api.dart';
import '../../data/transportation/transportation_queue.dart';

/// Orchestrates the offline-first bus workflow. Primary flow: the attendant selects a route and
/// taps student NFC cards; each tap enqueues a BusAttendanceEvent locally and syncs when online.
/// No student phone is required and the whole flow works with no connectivity.
class TransportationController {
  TransportationController(this._queue, this._api);

  final TransportationQueue _queue;
  final TransportationApi _api;

  Future<String> capture(PendingBusEvent event) async {
    await _queue.enqueue(event);
    unawaited(sync());
    return event.clientRef;
  }

  Future<int> sync() async {
    final pending = await _queue.pending();
    final synced = <String>{};
    for (final e in pending) {
      try {
        if (await _api.sync(e)) synced.add(e.clientRef);
      } catch (_) {
        break;
      }
    }
    if (synced.isNotEmpty) await _queue.removeByRefs(synced);
    return synced.length;
  }

  Future<int> pendingCount() => _queue.count();
}