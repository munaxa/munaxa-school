import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/timetable/timetable_api.dart';
import '../auth/auth_providers.dart';

final timetableApiProvider =
    Provider<TimetableApi>((ref) => TimetableApi(ref.watch(dioProvider)));

/// The current/next class for a section (e.g. the Teacher app "now" card).
final currentClassProvider =
    FutureProvider.family<CurrentClass, String>((ref, sectionId) async {
  final api = ref.watch(timetableApiProvider);
  return api.currentClass(sectionId);
});
