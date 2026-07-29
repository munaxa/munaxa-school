import 'package:dio/dio.dart';

/// A resolved class (published schedule with any date exception applied).
class ResolvedClass {
  const ResolvedClass({
    required this.classNumber,
    required this.startTime,
    required this.endTime,
    required this.subject,
    required this.status,
    this.teacherName,
    this.locationName,
    this.note,
  });

  final int classNumber;
  final String startTime;
  final String endTime;
  final String subject;
  final String status; // SCHEDULED | CANCELLED | SUBSTITUTED | REPLACED
  final String? teacherName;
  final String? locationName;
  final String? note;

  factory ResolvedClass.fromJson(Map<String, dynamic> json) {
    return ResolvedClass(
      classNumber: (json['classNumber'] as num).toInt(),
      startTime: json['startTime'] as String,
      endTime: json['endTime'] as String,
      subject: (json['subjectName'] ?? json['subject']) as String,
      status: json['status'] as String? ?? 'SCHEDULED',
      teacherName: json['teacherName'] as String?,
      locationName: json['locationName'] as String?,
      note: json['note'] as String?,
    );
  }
}

/// The live current-class context from the scheduling engine (never stored — always computed).
class CurrentClass {
  const CurrentClass({
    required this.state,
    this.stateLabel,
    this.current,
    this.next,
    this.remainingClasses = 0,
    this.minutesUntilCurrentEnds,
    this.minutesUntilNextStarts,
  });

  /// IN_CLASS | BEFORE_SCHOOL | MORNING_ASSEMBLY | BREAK | LUNCH_BREAK | AFTER_SCHOOL | HOLIDAY | NO_CLASSES
  final String state;
  final String? stateLabel;
  final ResolvedClass? current;
  final ResolvedClass? next;
  final int remainingClasses;
  final int? minutesUntilCurrentEnds;
  final int? minutesUntilNextStarts;

  bool get isHoliday => state == 'HOLIDAY';

  factory CurrentClass.fromJson(Map<String, dynamic> json) {
    return CurrentClass(
      state: json['state'] as String? ?? 'NO_CLASSES',
      stateLabel: json['stateLabel'] as String?,
      current: json['current'] == null
          ? null
          : ResolvedClass.fromJson(json['current'] as Map<String, dynamic>),
      next: json['next'] == null
          ? null
          : ResolvedClass.fromJson(json['next'] as Map<String, dynamic>),
      remainingClasses: (json['remainingClasses'] as num?)?.toInt() ?? 0,
      minutesUntilCurrentEnds: (json['minutesUntilCurrentEnds'] as num?)?.toInt(),
      minutesUntilNextStarts: (json['minutesUntilNextStarts'] as num?)?.toInt(),
    );
  }
}

/// Read access to the unified scheduling engine for mobile clients (Teacher/Student/Parent apps).
class TimetableApi {
  TimetableApi(this._dio);

  final Dio _dio;

  /// A section's live current/next class.
  Future<CurrentClass> currentClass(String sectionId, {DateTime? at}) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/schedule/current',
      queryParameters: {
        'sectionId': sectionId,
        if (at != null) 'at': at.toUtc().toIso8601String(),
      },
    );
    return CurrentClass.fromJson(res.data!);
  }

  /// A section resolved for a single date (exceptions applied).
  Future<List<ResolvedClass>> day(String sectionId, DateTime date) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/schedule/day',
      queryParameters: {
        'sectionId': sectionId,
        'date': date.toIso8601String().substring(0, 10),
      },
    );
    return ((res.data?['classes'] as List<dynamic>?) ?? [])
        .cast<Map<String, dynamic>>()
        .map(ResolvedClass.fromJson)
        .toList();
  }
}
