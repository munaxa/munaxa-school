import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/parent_portal/parent_portal_api.dart';
import '../auth/auth_providers.dart';

final parentPortalApiProvider =
    Provider<ParentPortalApi>((ref) => ParentPortalApi(ref.watch(dioProvider)));

/// The parent's linked children (multi-child switcher source).
final childrenProvider = FutureProvider<List<ChildSummary>>((ref) async {
  return ref.watch(parentPortalApiProvider).children();
});

/// The currently selected child id for the multi-child switcher. Defaults to the
/// first (primary) child once [childrenProvider] resolves; the UI can override it.
final selectedChildIdProvider = StateProvider<String?>((ref) {
  final children = ref.watch(childrenProvider).valueOrNull;
  if (children == null || children.isEmpty) return null;
  return children.first.studentId;
});

/// Dashboard for the selected child.
final childDashboardProvider = FutureProvider<ChildDashboard?>((ref) async {
  final studentId = ref.watch(selectedChildIdProvider);
  if (studentId == null) return null;
  return ref.watch(parentPortalApiProvider).dashboard(studentId);
});

/// Leave/absence requests for the parent's children.
final leaveRequestsProvider = FutureProvider<List<LeaveRequest>>((ref) async {
  return ref.watch(parentPortalApiProvider).leaveRequests();
});

/// Open PTM slots available to book.
final openPtmSlotsProvider = FutureProvider<List<PtmSlot>>((ref) async {
  return ref.watch(parentPortalApiProvider).openSlots();
});

/// The parent's PTM bookings.
final ptmBookingsProvider = FutureProvider<List<PtmBooking>>((ref) async {
  return ref.watch(parentPortalApiProvider).myBookings();
});

/// Vault documents for the selected child.
final childDocumentsProvider = FutureProvider<List<VaultDocument>>((ref) async {
  final studentId = ref.watch(selectedChildIdProvider);
  if (studentId == null) return const [];
  return ref.watch(parentPortalApiProvider).documents(studentId);
});
