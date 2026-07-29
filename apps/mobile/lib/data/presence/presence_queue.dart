import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A campus-presence event captured (possibly offline) on the device.
/// `clientRef` is the idempotency key — the server de-duplicates replays on (tenant, clientRef).
class PendingPresenceEvent {
  const PendingPresenceEvent({
    required this.clientRef,
    required this.studentId,
    required this.eventType, // GATE_IN | GATE_OUT | RECEPTION_CHECKIN | RECEPTION_CHECKOUT
    required this.occurredAt, // ISO-8601
    this.method = 'MANUAL', // NFC | RFID | QR | MANUAL | FACE | BUS
    this.deviceId,
  });

  final String clientRef;
  final String studentId;
  final String eventType;
  final String occurredAt;
  final String method;
  final String? deviceId;

  Map<String, dynamic> toJson() => {
        'clientRef': clientRef,
        'studentId': studentId,
        'eventType': eventType,
        'occurredAt': occurredAt,
        'method': method,
        if (deviceId != null) 'deviceId': deviceId,
      };

  factory PendingPresenceEvent.fromJson(Map<String, dynamic> json) => PendingPresenceEvent(
        clientRef: json['clientRef'] as String,
        studentId: json['studentId'] as String,
        eventType: json['eventType'] as String,
        occurredAt: json['occurredAt'] as String,
        method: json['method'] as String? ?? 'MANUAL',
        deviceId: json['deviceId'] as String?,
      );
}

/// Durable, write-ahead queue of presence events. Persisted to secure storage as a JSON list so
/// it survives app restarts; drained by the sync service when connectivity returns. Mirrors
/// `AttendanceQueue`. Offline-first: enqueue never requires the network.
class PresenceQueue {
  PresenceQueue([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'munaxa.presence.queue';

  Future<List<PendingPresenceEvent>> pending() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List<dynamic>).cast<Map<String, dynamic>>();
    return list.map(PendingPresenceEvent.fromJson).toList();
  }

  Future<void> enqueue(PendingPresenceEvent event) async {
    final events = await pending();
    // Local de-dupe on the idempotency key.
    events.removeWhere((e) => e.clientRef == event.clientRef);
    events.add(event);
    await _write(events);
  }

  Future<void> removeByRefs(Set<String> clientRefs) async {
    final events = await pending();
    events.removeWhere((e) => clientRefs.contains(e.clientRef));
    await _write(events);
  }

  Future<int> count() async => (await pending()).length;

  Future<void> _write(List<PendingPresenceEvent> events) async {
    await _storage.write(key: _key, value: jsonEncode(events.map((e) => e.toJson()).toList()));
  }
}
