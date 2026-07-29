import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/advanced/advanced_api.dart';
import '../auth/auth_providers.dart';

final advancedApiProvider = Provider<AdvancedApi>((ref) => AdvancedApi(ref.watch(dioProvider)));

/// Bus routes for the tenant (when the bus_tracking module is enabled).
final busRoutesProvider = FutureProvider<List<BusRouteInfo>>((ref) async {
  return ref.watch(advancedApiProvider).busRoutes();
});

/// Buses with their last known GPS location (live bus tracking).
final busesProvider = FutureProvider<List<BusInfo>>((ref) async {
  return ref.watch(advancedApiProvider).buses();
});

/// Library catalogue (when the library_management module is enabled).
final libraryBooksProvider = FutureProvider<List<LibraryBookInfo>>((ref) async {
  return ref.watch(advancedApiProvider).libraryBooks();
});
