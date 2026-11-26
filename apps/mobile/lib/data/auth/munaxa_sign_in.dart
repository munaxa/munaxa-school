import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';

/// "Sign in with Munaxa" for the teacher app (RFC 8252: the system browser, never a web view).
///
/// The app makes a PKCE verifier, opens School's
/// `/auth/identity/start?school=<code>&app=<challenge>` in the system browser, and Munaxa Identity
/// signs the person in there. School then sends the browser back to the app's return address with
/// a sealed hand-off, which only this app can redeem, because only it holds the verifier
/// (`POST /auth/identity/app-session`). The person never types a School password.
class MunaxaSignIn {
  MunaxaSignIn({required this.apiBaseUrl, required this.returnAddress});

  /// School's API base, e.g. `https://school.test.munaxa.com/api/v1`.
  final String apiBaseUrl;

  /// Where School sends the browser back: its `IDENTITY_APP_REDIRECT_URI`.
  final Uri returnAddress;

  /// A fresh RFC 7636 verifier: 32 random bytes, base64url without padding (43 characters).
  static String newVerifier([Random? random]) {
    final source = random ?? Random.secure();
    final bytes = List<int>.generate(32, (_) => source.nextInt(256));
    return base64Url.encode(bytes).replaceAll('=', '');
  }

  /// The S256 challenge for [verifier].
  static String challengeFor(String verifier) =>
      base64Url.encode(sha256.convert(ascii.encode(verifier)).bytes).replaceAll('=', '');

  /// The page the system browser opens.
  Uri startAddress({required String school, required String verifier}) {
    final base = Uri.parse(apiBaseUrl.endsWith('/') ? apiBaseUrl : '$apiBaseUrl/');
    return base
        .resolve('auth/identity/start')
        .replace(
          queryParameters: {'school': school.trim().toLowerCase(), 'app': challengeFor(verifier)},
        );
  }

  /// What School sent back to the app: a hand-off to redeem, or why the sign-in stopped.
  MunaxaReturn readReturn(String address) {
    final uri = Uri.parse(address);
    if (uri.scheme != returnAddress.scheme ||
        uri.host != returnAddress.host ||
        uri.path != returnAddress.path) {
      return const MunaxaReturn.failed('failed');
    }
    // School answers in the fragment, which never reaches a server.
    final answer = uri.fragment.isEmpty
        ? const <String, String>{}
        : Uri.splitQueryString(uri.fragment);
    final handoff = answer['handoff'];
    if (handoff != null && handoff.isNotEmpty) return MunaxaReturn.handoff(handoff);
    return MunaxaReturn.failed(answer['error'] ?? 'failed');
  }
}

/// School's answer at the return address.
class MunaxaReturn {
  const MunaxaReturn.handoff(String this.handoff) : error = null;
  const MunaxaReturn.failed(String this.error) : handoff = null;

  final String? handoff;

  /// `failed`, `unavailable`, `no-account`, `blocked` or `mfa-required` (School's outcomes).
  final String? error;
}

/// A sign-in with Munaxa that did not end in a session; [code] is School's outcome.
class MunaxaSignInException implements Exception {
  const MunaxaSignInException(this.code);

  final String code;

  @override
  String toString() => 'MunaxaSignInException($code)';
}
