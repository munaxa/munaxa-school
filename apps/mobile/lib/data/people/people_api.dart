import 'package:dio/dio.dart';

/// A student as returned by the Munaxa API. Used by the Teacher app (rosters,
/// attendance) and surfaced to Parents via their linked children (Phase 11).
class StudentSummary {
  const StudentSummary({
    required this.id,
    required this.firstNameEn,
    required this.lastNameEn,
    required this.firstNameAr,
    required this.lastNameAr,
    required this.qrCode,
    required this.status,
    this.sectionId,
  });

  final String id;
  final String firstNameEn;
  final String lastNameEn;
  final String firstNameAr;
  final String lastNameAr;
  final String qrCode;
  final String status;
  final String? sectionId;

  String get fullNameEn => '$firstNameEn $lastNameEn';
  String get fullNameAr => '$firstNameAr $lastNameAr';

  factory StudentSummary.fromJson(Map<String, dynamic> json) {
    return StudentSummary(
      id: json['id'] as String,
      firstNameEn: json['firstNameEn'] as String,
      lastNameEn: json['lastNameEn'] as String,
      firstNameAr: json['firstNameAr'] as String,
      lastNameAr: json['lastNameAr'] as String,
      qrCode: json['qrCode'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      sectionId: json['sectionId'] as String?,
    );
  }
}

/// Read access to the People API for mobile clients.
class PeopleApi {
  PeopleApi(this._dio);

  final Dio _dio;

  Future<List<StudentSummary>> students({String? sectionId}) async {
    final res = await _dio.get<List<dynamic>>(
      '/students',
      queryParameters: {if (sectionId != null) 'sectionId': sectionId},
    );
    return (res.data ?? [])
        .cast<Map<String, dynamic>>()
        .map(StudentSummary.fromJson)
        .toList();
  }

  Future<String> studentQr(String studentId) async {
    final res = await _dio.get<Map<String, dynamic>>('/students/$studentId/qr');
    return res.data!['qrCode'] as String;
  }
}
