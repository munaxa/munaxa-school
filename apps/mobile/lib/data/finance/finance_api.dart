import 'dart:typed_data';

import 'package:dio/dio.dart';

/// Account-level totals for a child's Student Financial Account (Finance Domain Spec v1.0).
class AccountTotals {
  const AccountTotals({
    required this.charged,
    required this.paid,
    required this.outstanding,
    required this.creditBalance,
  });
  final String charged;
  final String paid;
  final String outstanding;
  final String creditBalance;

  factory AccountTotals.fromJson(Map<String, dynamic> json) => AccountTotals(
        charged: json['charged'] as String? ?? '0.000',
        paid: json['paid'] as String? ?? '0.000',
        outstanding: json['outstanding'] as String? ?? '0.000',
        creditBalance: json['creditBalance'] as String? ?? '0.000',
      );
}

/// A scheduled installment inside a charge's payment plan.
class Installment {
  const Installment({
    required this.id,
    required this.seq,
    required this.dueDate,
    required this.amount,
    required this.paid,
    required this.balance,
    required this.status,
    required this.overdue,
  });
  final String id;
  final int seq;
  final String? dueDate;
  final String amount;
  final String paid;
  final String balance;
  final String status;
  final bool overdue;

  factory Installment.fromJson(Map<String, dynamic> json) => Installment(
        id: json['id'] as String,
        seq: json['seq'] as int,
        dueDate: json['dueDate'] as String?,
        amount: json['amount'] as String,
        paid: json['paid'] as String,
        balance: json['balance'] as String,
        status: json['status'] as String,
        overdue: json['overdue'] as bool? ?? false,
      );
}

/// A charge (obligation) with its plan's installments and derived balances.
class Charge {
  const Charge({
    required this.id,
    required this.description,
    required this.status,
    required this.net,
    required this.balance,
    required this.installments,
  });
  final String id;
  final String description;
  final String status;
  final String net;
  final String balance;
  final List<Installment> installments;

  factory Charge.fromJson(Map<String, dynamic> json) {
    final charge = json['charge'] as Map<String, dynamic>;
    final rows = (json['installments'] as List<dynamic>? ?? const [])
        .map((e) => Installment.fromJson(e as Map<String, dynamic>))
        .toList();
    return Charge(
      id: charge['id'] as String,
      description: charge['description'] as String,
      status: charge['status'] as String,
      net: json['net'] as String,
      balance: json['balance'] as String,
      installments: rows,
    );
  }
}

/// The hierarchical statement: Account totals → Charges → Installments.
class Statement {
  const Statement({required this.totals, required this.charges});
  final AccountTotals totals;
  final List<Charge> charges;

  factory Statement.fromJson(Map<String, dynamic> json) => Statement(
        totals: AccountTotals.fromJson(json['totals'] as Map<String, dynamic>),
        charges: (json['charges'] as List<dynamic>? ?? const [])
            .map((e) => Charge.fromJson(e as Map<String, dynamic>))
            .toList(),
      );

  /// The next unpaid installment (earliest due, positive balance) — what the parent pays next.
  Installment? get nextDueInstallment {
    Installment? best;
    for (final charge in charges) {
      for (final inst in charge.installments) {
        if (double.parse(inst.balance) <= 0 || inst.dueDate == null) continue;
        if (best == null ||
            DateTime.parse(inst.dueDate!).isBefore(DateTime.parse(best.dueDate!))) {
          best = inst;
        }
      }
    }
    return best;
  }
}

/// Parent-app finance access: view a child's hierarchical statement and upload a CliQ/e-wallet
/// receipt (recorded as a PENDING Payment; a finance officer verifies it, which allocates it to
/// the account's installments FIFO).
class FinanceApi {
  FinanceApi(this._dio);

  final Dio _dio;

  Future<Statement> statement(String studentId) async {
    final res = await _dio.get<Map<String, dynamic>>('/finance/students/$studentId/statement');
    return Statement.fromJson(res.data!);
  }

  Future<AccountTotals> statementTotals(String studentId) async {
    final res = await _dio.get<Map<String, dynamic>>('/finance/students/$studentId/statement');
    return AccountTotals.fromJson(res.data!['totals'] as Map<String, dynamic>);
  }

  /// Full receipt flow: presign → PUT bytes to S3 → record a PENDING payment.
  Future<void> uploadReceiptAndPay({
    required String studentId,
    required double amount,
    required String method, // CLIQ | EWALLET
    required String fileName,
    required String contentType,
    required Uint8List bytes,
    String? reference,
  }) async {
    final presign = await _dio.post<Map<String, dynamic>>(
      '/finance/payments/receipt/presign',
      data: {'fileName': fileName, 'contentType': contentType, 'size': bytes.length},
    );
    final uploadUrl = presign.data!['uploadUrl'] as String;
    final fileKey = presign.data!['fileKey'] as String;

    // Upload the file bytes directly to S3 with the pre-signed URL (no auth header).
    await Dio().put<void>(
      uploadUrl,
      data: Stream.fromIterable([bytes]),
      options: Options(headers: {'Content-Type': contentType}),
    );

    await _dio.post<Map<String, dynamic>>('/finance/payments', data: {
      'studentId': studentId,
      'amount': amount,
      'method': method,
      'receiptKey': fileKey,
      if (reference != null) 'reference': reference,
    });
  }
}
