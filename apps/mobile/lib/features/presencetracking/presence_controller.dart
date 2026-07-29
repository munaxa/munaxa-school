import 'dart:async';

import '../../data/presence/presence_api.dart';
import '../../data/presence/presence_queue.dart';

/// Orchestrates offline-first campus presence capture: enqueue locally (optimistic), then drain
/// to the server when online. Replay is safe (server idempotent on clientRef). Mirrors the
/// attendance controller's queue→sync flow.
class PresenceController {
  PresenceController(this._queue, this._api);

  final PresenceQueue _queue;
  final PresenceApi _api;

  /// Capture an event — never blocks on the network; returns the queued event's clientRef.
  Future<String> capture(PendingPresenceEvent event) async {
    await _queue.enqueue(event);
    // Best-effort immediate sync; failures stay queued for the next connectivity-triggered drain.
    unawaited(sync());
    return event.clientRef;
  }

  /// Drain the queue. Each accepted event is removed; the rest remain for the next attempt.
  Future<int> sync() async {
    final pending = await _queue.pending();
    final synced = <String>{};
    for (final e in pending) {
      try {
        if (await _api.sync(e)) synced.add(e.clientRef);
      } catch (_) {
        break; // offline / transient — stop; retry on next drain
      }
    }
    if (synced.isNotEmpty) await _queue.removeByRefs(synced);
    return synced.length;
  }

  Future<int> pendingCount() => _queue.count();
}