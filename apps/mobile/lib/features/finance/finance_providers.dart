import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../data/finance/finance_api.dart';
import '../auth/auth_providers.dart';

final financeApiProvider = Provider<FinanceApi>((ref) => FinanceApi(ref.watch(dioProvider)));

/// A child's account totals for the Parent app finance summary.
final statementTotalsProvider =
    FutureProvider.family<AccountTotals, String>((ref, studentId) async {
  return ref.watch(financeApiProvider).statementTotals(studentId);
});

/// A child's full hierarchical statement (Account → Charges → Installments).
final statementProvider = FutureProvider.family<Statement, String>((ref, studentId) async {
  return ref.watch(financeApiProvider).statement(studentId);
});
