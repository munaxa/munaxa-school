import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A transportation (bus) event captured (possibly offline). `clientRef` is the idempotency key.
class PendingBusEvent {
  const PendingBusEvent({
    required this.clientRef,
    required this.studentId,
    required this.busId,
    required this.eventType, // BOARD_AM | ARRIVE_SCHOOL | BOARD_PM | ARRIVE_HOME
    required this.occurredAt, // ISO-8601
    this.method = 'NFC', // NFC | RFID | QR | MANUAL
  });

  final String clientRef;
  final String studentId;
  final String busId;
  final String eventType;
  final String occurredAt;
  final String method;

  Map<String, dynamic> toJson() => {
        'clientRef': clientRef,
        'studentId': studentId,
        'busId': busId,
        'eventType': eventType,
        'occurredAt': occurredAt,
        'method': method,
      };

  factory PendingBusEvent.fromJson(Map<String, dynamic> json) => PendingBusEvent(
        clientRef: json['clientRef'] as String,
        studentId: json['studentId'] as String,
        busId: json['busId'] as String,
        eventType: json['eventType'] as String,
        occurredAt: json['occurredAt'] as String,
        method: json['method'] as String? ?? 'NFC',
      );
}

/// Durable, write-ahead queue of bus events — the primary NFC bus workflow runs entirely offline
/// (attendant taps student NFC cards; events queue locally and sync when connectivity returns).
/// Mirrors `AttendanceQueue`; survives restarts via secure storage.
class TransportationQueue {
  TransportationQueue([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'munaxa.transportation.queue';

  Future<List<PendingBusEvent>> pending() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List<dynamic>).cast<Map<String, dynamic>>();
    return list.map(PendingBusEvent.fromJson).toList();
  }

  Future<void> enqueue(PendingBusEvent event) async {
    final events = await pending();
    events.removeWhere((e) => e.clientRef == event.clientRef); // local de-dupe
    events.add(event);
    await _write(events);
  }

  Future<void> removeByRefs(Set<String> clientRefs) async {
    final events = await pending();
    events.removeWhere((e) => clientRefs.contains(e.clientRef));
    await _write(events);
  }

  Future<int> count() async => (await pending()).length;

  Future<void> _write(List<PendingBusEvent> events) async {
    await _storage.write(key: _key, value: jsonEncode(events.map((e) => e.toJson()).toList()));
  }
}
