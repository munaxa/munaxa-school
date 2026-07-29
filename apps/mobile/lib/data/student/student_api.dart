import 'package:dio/dio.dart';

/// The signed-in student's dashboard rollup.
class StudentDashboard {
  const StudentDashboard({
    required this.studentId,
    required this.attendanceLast30Days,
    required this.upcomingHomework,
    required this.totalPoints,
    required this.level,
    required this.currentStreak,
    required this.longestStreak,
    required this.achievementCount,
    required this.unreadNotifications,
  });

  final String studentId;
  final Map<String, int> attendanceLast30Days;
  final int upcomingHomework;
  final int totalPoints;
  final int level;
  final int currentStreak;
  final int longestStreak;
  final int achievementCount;
  final int unreadNotifications;

  factory StudentDashboard.fromJson(Map<String, dynamic> json) {
    final g = json['gamification'] as Map<String, dynamic>;
    return StudentDashboard(
      studentId: (json['student'] as Map<String, dynamic>)['id'] as String,
      attendanceLast30Days: (json['attendanceLast30Days'] as Map<String, dynamic>)
          .map((k, v) => MapEntry(k, v as int)),
      upcomingHomework: json['upcomingHomework'] as int,
      totalPoints: g['totalPoints'] as int,
      level: g['level'] as int,
      currentStreak: g['currentStreak'] as int,
      longestStreak: g['longestStreak'] as int,
      achievementCount: g['achievementCount'] as int,
      unreadNotifications: json['unreadNotifications'] as int,
    );
  }
}

class HomeworkItem {
  const HomeworkItem({
    required this.id,
    required this.subject,
    required this.title,
    required this.dueDate,
    this.description,
  });

  final String id;
  final String subject;
  final String title;
  final String dueDate;
  final String? description;

  factory HomeworkItem.fromJson(Map<String, dynamic> json) => HomeworkItem(
        id: json['id'] as String,
        subject: json['subject'] as String,
        title: json['title'] as String,
        dueDate: json['dueDate'] as String,
        description: json['description'] as String?,
      );
}

class AttendanceEntry {
  const AttendanceEntry({
    required this.id,
    required this.date,
    required this.status,
    required this.classNumber,
  });

  final String id;
  final String date;
  final String status;
  final int classNumber;

  factory AttendanceEntry.fromJson(Map<String, dynamic> json) => AttendanceEntry(
        id: json['id'] as String,
        date: json['date'] as String,
        status: json['status'] as String,
        classNumber: json['classNumber'] as int,
      );
}

class TimetableEntry {
  const TimetableEntry({
    required this.id,
    required this.dayOfWeek,
    required this.classNumber,
    required this.startTime,
    required this.endTime,
    required this.subject,
    this.teacherName,
  });

  final String id;
  final String dayOfWeek;
  final int classNumber;
  final String startTime;
  final String endTime;
  final String subject;
  final String? teacherName;

  factory TimetableEntry.fromJson(Map<String, dynamic> json) => TimetableEntry(
        id: json['id'] as String? ?? '',
        dayOfWeek: json['dayOfWeek'] as String,
        classNumber: (json['classNumber'] as num).toInt(),
        startTime: json['startTime'] as String,
        endTime: json['endTime'] as String,
        // The scheduling engine names the field `subjectName`.
        subject: (json['subjectName'] ?? json['subject']) as String,
        teacherName: json['teacherName'] as String?,
      );
}

class LearningResource {
  const LearningResource({
    required this.id,
    required this.title,
    required this.type,
    this.description,
    this.url,
    this.subject,
    this.downloadUrl,
  });

  final String id;
  final String title;
  final String type; // LINK | FILE | VIDEO | DOCUMENT
  final String? description;
  final String? url;
  final String? subject;
  final String? downloadUrl;

  /// The address to open: a deep-link (LINK/VIDEO) or a pre-signed download (FILE/DOCUMENT).
  String? get openUrl => url ?? downloadUrl;

  factory LearningResource.fromJson(Map<String, dynamic> json) => LearningResource(
        id: json['id'] as String,
        title: json['title'] as String,
        type: json['type'] as String,
        description: json['description'] as String?,
        url: json['url'] as String?,
        subject: json['subject'] as String?,
        downloadUrl: json['downloadUrl'] as String?,
      );
}

class EarnedAchievement {
  const EarnedAchievement({
    required this.id,
    required this.earnedAt,
    required this.nameEn,
    required this.nameAr,
    required this.points,
    this.icon,
  });

  final String id;
  final String earnedAt;
  final String nameEn;
  final String nameAr;
  final int points;
  final String? icon;

  factory EarnedAchievement.fromJson(Map<String, dynamic> json) {
    final a = json['achievement'] as Map<String, dynamic>;
    return EarnedAchievement(
      id: json['id'] as String,
      earnedAt: json['earnedAt'] as String,
      nameEn: a['nameEn'] as String,
      nameAr: a['nameAr'] as String,
      points: a['points'] as int,
      icon: a['icon'] as String?,
    );
  }
}

class GamificationSummary {
  const GamificationSummary({
    required this.totalPoints,
    required this.level,
    required this.currentStreak,
    required this.longestStreak,
    required this.totalPresentDays,
    required this.achievements,
  });

  final int totalPoints;
  final int level;
  final int currentStreak;
  final int longestStreak;
  final int totalPresentDays;
  final List<EarnedAchievement> achievements;

  factory GamificationSummary.fromJson(Map<String, dynamic> json) => GamificationSummary(
        totalPoints: json['totalPoints'] as int,
        level: json['level'] as int,
        currentStreak: json['currentStreak'] as int,
        longestStreak: json['longestStreak'] as int,
        totalPresentDays: json['totalPresentDays'] as int,
        achievements: (json['achievements'] as List<dynamic>)
            .map((e) => EarnedAchievement.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Student-app access to the self-scoped `/me/*` surface. Every call returns only the
/// signed-in student's own data (server resolves it from `Student.userId`).
class StudentApi {
  StudentApi(this._dio);

  final Dio _dio;

  Future<StudentDashboard> dashboard() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/dashboard');
    return StudentDashboard.fromJson(res.data!);
  }

  Future<List<HomeworkItem>> homework() async {
    final res = await _dio.get<List<dynamic>>('/me/homework');
    return (res.data ?? []).map((e) => HomeworkItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<AttendanceEntry>> attendance() async {
    final res = await _dio.get<List<dynamic>>('/me/attendance');
    return (res.data ?? [])
        .map((e) => AttendanceEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// The inherited weekly timetable, returned grouped by day `[{dayOfWeek, classes:[...]}]`
  /// by the scheduling engine; flattened here into per-class entries.
  Future<List<TimetableEntry>> timetable() async {
    final res = await _dio.get<List<dynamic>>('/me/timetable');
    final entries = <TimetableEntry>[];
    for (final group in res.data ?? []) {
      final classes = (group as Map<String, dynamic>)['classes'] as List<dynamic>? ?? [];
      for (final c in classes) {
        entries.add(TimetableEntry.fromJson(c as Map<String, dynamic>));
      }
    }
    return entries;
  }

  Future<List<LearningResource>> resources() async {
    final res = await _dio.get<List<dynamic>>('/me/resources');
    return (res.data ?? [])
        .map((e) => LearningResource.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<GamificationSummary> gamification() async {
    final res = await _dio.get<Map<String, dynamic>>('/me/gamification');
    return GamificationSummary.fromJson(res.data!);
  }

  Future<List<EarnedAchievement>> achievements() async {
    final res = await _dio.get<List<dynamic>>('/me/achievements');
    return (res.data ?? [])
        .map((e) => EarnedAchievement.fromJson(e as Map<String, dynamic>))
        .toList();
  }
}
