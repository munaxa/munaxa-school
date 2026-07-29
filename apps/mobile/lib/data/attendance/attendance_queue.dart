import 'dart:convert';

import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// A single attendance mark captured (possibly offline) on the device.
class PendingMark {
  const PendingMark({
    required this.clientRef,
    required this.sectionId,
    required this.date, // YYYY-MM-DD
    required this.classNumber,
    required this.studentId,
    required this.status,
    this.method = 'MANUAL',
  });

  final String clientRef;
  final String sectionId;
  final String date;
  final int classNumber;
  final String studentId;
  final String status;
  final String method;

  Map<String, dynamic> toJson() => {
        'clientRef': clientRef,
        'sectionId': sectionId,
        'date': date,
        'classNumber': classNumber,
        'studentId': studentId,
        'status': status,
        'method': method,
      };

  factory PendingMark.fromJson(Map<String, dynamic> json) => PendingMark(
        clientRef: json['clientRef'] as String,
        sectionId: json['sectionId'] as String,
        date: json['date'] as String,
        classNumber: (json['classNumber'] as num).toInt(),
        studentId: json['studentId'] as String,
        status: json['status'] as String,
        method: json['method'] as String? ?? 'MANUAL',
      );
}

/// A durable, write-ahead queue of attendance marks. Marks are persisted locally first
/// (optimistic UI) and drained by the sync service when connectivity is available. Backed
/// by secure storage as a JSON list so it survives app restarts without a codegen DB.
class AttendanceQueue {
  AttendanceQueue([FlutterSecureStorage? storage])
      : _storage = storage ?? const FlutterSecureStorage();

  final FlutterSecureStorage _storage;
  static const _key = 'munaxa.attendance.queue';

  Future<List<PendingMark>> pending() async {
    final raw = await _storage.read(key: _key);
    if (raw == null || raw.isEmpty) return [];
    final list = (jsonDecode(raw) as List<dynamic>).cast<Map<String, dynamic>>();
    return list.map(PendingMark.fromJson).toList();
  }

  Future<void> enqueue(PendingMark mark) async {
    final marks = await pending();
    // De-dupe locally on the idempotency key (section/date/period/student).
    marks.removeWhere((m) =>
        m.sectionId == mark.sectionId &&
        m.date == mark.date &&
        m.classNumber == mark.classNumber &&
        m.studentId == mark.studentId);
    marks.add(mark);
    await _write(marks);
  }

  Future<void> removeByRefs(Set<String> clientRefs) async {
    final marks = await pending();
    marks.removeWhere((m) => clientRefs.contains(m.clientRef));
    await _write(marks);
  }

  Future<int> count() async => (await pending()).length;

  Future<void> _write(List<PendingMark> marks) async {
    await _storage.write(key: _key, value: jsonEncode(marks.map((m) => m.toJson()).toList()));
  }
}
