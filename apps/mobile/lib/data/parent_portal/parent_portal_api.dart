import 'dart:typed_data';

import 'package:dio/dio.dart';

/// A child linked to the signed-in parent (the multi-child switcher).
class ChildSummary {
  const ChildSummary({
    required this.studentId,
    required this.relation,
    required this.isPrimary,
    required this.firstNameEn,
    required this.lastNameEn,
    required this.firstNameAr,
    required this.lastNameAr,
    required this.sectionId,
    required this.status,
  });

  final String studentId;
  final String relation;
  final bool isPrimary;
  final String firstNameEn;
  final String lastNameEn;
  final String firstNameAr;
  final String lastNameAr;
  final String? sectionId;
  final String status;

  String get fullNameEn => '$firstNameEn $lastNameEn';
  String get fullNameAr => '$firstNameAr $lastNameAr';

  factory ChildSummary.fromJson(Map<String, dynamic> json) => ChildSummary(
        studentId: json['studentId'] as String,
        relation: json['relation'] as String,
        isPrimary: json['isPrimary'] as bool,
        firstNameEn: json['firstNameEn'] as String,
        lastNameEn: json['lastNameEn'] as String,
        firstNameAr: json['firstNameAr'] as String,
        lastNameAr: json['lastNameAr'] as String,
        sectionId: json['sectionId'] as String?,
        status: json['status'] as String,
      );
}

/// Aggregated dashboard for a single child.
class ChildDashboard {
  const ChildDashboard({
    required this.studentId,
    required this.attendanceLast30Days,
    required this.upcomingHomework,
    required this.outstandingBalance,
    required this.pendingLeaveRequests,
    required this.upcomingPtmBookings,
    required this.documentCount,
    required this.unreadNotifications,
  });

  final String studentId;
  final Map<String, int> attendanceLast30Days;
  final int upcomingHomework;
  final String outstandingBalance;
  final int pendingLeaveRequests;
  final int upcomingPtmBookings;
  final int documentCount;
  final int unreadNotifications;

  factory ChildDashboard.fromJson(Map<String, dynamic> json) {
    final att = (json['attendanceLast30Days'] as Map<String, dynamic>)
        .map((k, v) => MapEntry(k, v as int));
    return ChildDashboard(
      studentId: (json['student'] as Map<String, dynamic>)['id'] as String,
      attendanceLast30Days: att,
      upcomingHomework: json['upcomingHomework'] as int,
      outstandingBalance: json['outstandingBalance'] as String,
      pendingLeaveRequests: json['pendingLeaveRequests'] as int,
      upcomingPtmBookings: json['upcomingPtmBookings'] as int,
      documentCount: json['documentCount'] as int,
      unreadNotifications: json['unreadNotifications'] as int,
    );
  }
}

class LeaveRequest {
  const LeaveRequest({
    required this.id,
    required this.studentId,
    required this.type,
    required this.status,
    required this.startDate,
    required this.endDate,
    required this.reason,
  });

  final String id;
  final String studentId;
  final String type; // LEAVE | ABSENCE
  final String status; // PENDING | APPROVED | REJECTED | CANCELLED
  final String startDate;
  final String endDate;
  final String reason;

  factory LeaveRequest.fromJson(Map<String, dynamic> json) => LeaveRequest(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        type: json['type'] as String,
        status: json['status'] as String,
        startDate: json['startDate'] as String,
        endDate: json['endDate'] as String,
        reason: json['reason'] as String,
      );
}

class PtmSlot {
  const PtmSlot({
    required this.id,
    required this.teacherId,
    required this.startsAt,
    required this.endsAt,
    required this.status,
    this.location,
  });

  final String id;
  final String teacherId;
  final String startsAt;
  final String endsAt;
  final String status;
  final String? location;

  factory PtmSlot.fromJson(Map<String, dynamic> json) => PtmSlot(
        id: json['id'] as String,
        teacherId: json['teacherId'] as String,
        startsAt: json['startsAt'] as String,
        endsAt: json['endsAt'] as String,
        status: json['status'] as String,
        location: json['location'] as String?,
      );
}

class PtmBooking {
  const PtmBooking({
    required this.id,
    required this.slotId,
    required this.studentId,
    required this.status,
  });

  final String id;
  final String slotId;
  final String studentId;
  final String status;

  factory PtmBooking.fromJson(Map<String, dynamic> json) => PtmBooking(
        id: json['id'] as String,
        slotId: json['slotId'] as String,
        studentId: json['studentId'] as String,
        status: json['status'] as String,
      );
}

class VaultDocument {
  const VaultDocument({
    required this.id,
    required this.studentId,
    required this.title,
    required this.category,
    required this.fileName,
    required this.downloadUrl,
  });

  final String id;
  final String studentId;
  final String title;
  final String category;
  final String fileName;
  final String downloadUrl;

  factory VaultDocument.fromJson(Map<String, dynamic> json) => VaultDocument(
        id: json['id'] as String,
        studentId: json['studentId'] as String,
        title: json['title'] as String,
        category: json['category'] as String,
        fileName: json['fileName'] as String,
        downloadUrl: json['downloadUrl'] as String? ?? '',
      );
}

/// Parent-app access to the Parent Portal: multi-child switcher + dashboard,
/// leave/absence requests, PTM slot booking, and the document vault. Every call is
/// row-scoped server-side to the parent's own children.
class ParentPortalApi {
  ParentPortalApi(this._dio);

  final Dio _dio;

  // ----- Multi-child switcher + dashboard -----------------------------------
  Future<List<ChildSummary>> children() async {
    final res = await _dio.get<List<dynamic>>('/parent/children');
    return (res.data ?? [])
        .map((e) => ChildSummary.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<ChildDashboard> dashboard(String studentId) async {
    final res = await _dio.get<Map<String, dynamic>>(
      '/parent/dashboard',
      queryParameters: {'studentId': studentId},
    );
    return ChildDashboard.fromJson(res.data!);
  }

  // ----- Leave / absence requests -------------------------------------------
  Future<List<LeaveRequest>> leaveRequests({String? status}) async {
    final res = await _dio.get<List<dynamic>>(
      '/leave-requests',
      queryParameters: {if (status != null) 'status': status},
    );
    return (res.data ?? [])
        .map((e) => LeaveRequest.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  Future<LeaveRequest> submitLeaveRequest({
    required String studentId,
    required String type, // LEAVE | ABSENCE
    required String startDate, // YYYY-MM-DD
    required String endDate,
    required String reason,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>('/leave-requests', data: {
      'studentId': studentId,
      'type': type,
      'startDate': startDate,
      'endDate': endDate,
      'reason': reason,
    });
    return LeaveRequest.fromJson(res.data!);
  }

  Future<void> cancelLeaveRequest(String id) async {
    await _dio.delete<void>('/leave-requests/$id');
  }

  // ----- PTM booking ---------------------------------------------------------
  Future<List<PtmSlot>> openSlots({String? teacherId}) async {
    final res = await _dio.get<List<dynamic>>('/ptm/slots', queryParameters: {
      'open': 'true',
      if (teacherId != null) 'teacherId': teacherId,
    });
    return (res.data ?? []).map((e) => PtmSlot.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<List<PtmBooking>> myBookings() async {
    final res = await _dio.get<List<dynamic>>('/ptm/bookings');
    return (res.data ?? []).map((e) => PtmBooking.fromJson(e as Map<String, dynamic>)).toList();
  }

  Future<PtmBooking> bookSlot({
    required String slotId,
    required String studentId,
    String? note,
  }) async {
    final res = await _dio.post<Map<String, dynamic>>('/ptm/bookings', data: {
      'slotId': slotId,
      'studentId': studentId,
      if (note != null) 'note': note,
    });
    return PtmBooking.fromJson(res.data!);
  }

  Future<void> cancelBooking(String id) async {
    await _dio.delete<void>('/ptm/bookings/$id');
  }

  // ----- Document vault ------------------------------------------------------
  Future<List<VaultDocument>> documents(String studentId) async {
    final res = await _dio.get<List<dynamic>>(
      '/parent-portal/documents',
      queryParameters: {'studentId': studentId},
    );
    return (res.data ?? [])
        .map((e) => VaultDocument.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Full upload flow: presign → PUT bytes to S3 → confirm the vault entry.
  Future<VaultDocument> uploadDocument({
    required String studentId,
    required String title,
    required String category,
    required String fileName,
    required String contentType,
    required Uint8List bytes,
  }) async {
    final presign = await _dio.post<Map<String, dynamic>>('/parent-portal/documents/presign', data: {
      'studentId': studentId,
      'fileName': fileName,
      'contentType': contentType,
    });
    final uploadUrl = presign.data!['uploadUrl'] as String;
    final fileKey = presign.data!['fileKey'] as String;

    await Dio().put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(headers: {'Content-Type': contentType}),
    );

    final res = await _dio.post<Map<String, dynamic>>('/parent-portal/documents', data: {
      'studentId': studentId,
      'title': title,
      'category': category,
      'fileKey': fileKey,
      'fileName': fileName,
      'contentType': contentType,
      'size': bytes.length,
    });
    return VaultDocument.fromJson(res.data!);
  }

  Future<void> deleteDocument(String id) async {
    await _dio.delete<void>('/parent-portal/documents/$id');
  }
}
