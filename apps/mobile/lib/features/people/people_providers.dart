import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/people/people_api.dart';
import '../auth/auth_providers.dart';

/// People API client (shares the authenticated Dio instance with bearer interceptor).
final peopleApiProvider = Provider<PeopleApi>((ref) => PeopleApi(ref.watch(dioProvider)));

/// Students for a section (e.g. a teacher's class roster). Pass the sectionId as the family arg.
final sectionStudentsProvider =
    FutureProvider.family<List<StudentSummary>, String>((ref, sectionId) async {
  final api = ref.watch(peopleApiProvider);
  return api.students(sectionId: sectionId);
});
