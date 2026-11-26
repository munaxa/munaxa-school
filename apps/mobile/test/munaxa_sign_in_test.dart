import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:munaxa_mobile/core/config/flavor.dart';
import 'package:munaxa_mobile/data/auth/auth_api.dart';
import 'package:munaxa_mobile/data/auth/munaxa_sign_in.dart';
import 'package:munaxa_mobile/data/auth/token_storage.dart';
import 'package:munaxa_mobile/features/auth/auth_controller.dart';
import 'package:munaxa_mobile/features/auth/auth_providers.dart';

class _MemoryTokenStorage implements TokenStorage {
  String? access;
  String? refresh;
  @override
  Future<String?> readAccess() async => access;
  @override
  Future<String?> readRefresh() async => refresh;
  @override
  Future<void> save({required String access, required String refresh}) async {
    this.access = access;
    this.refresh = refresh;
  }

  @override
  Future<void> clear() async {
    access = null;
    refresh = null;
  }
}

/// Stands in for School's API: records what the app sent.
class _FakeAuthApi extends AuthApi {
  _FakeAuthApi() : super(Dio());
  String? redeemedHandoff;
  String? redeemedVerifier;

  @override
  Future<TokenPair> appSession({required String handoff, required String verifier}) async {
    redeemedHandoff = handoff;
    redeemedVerifier = verifier;
    return const TokenPair(accessToken: 'access', refreshToken: 'refresh', expiresIn: 900);
  }

  @override
  Future<Principal> me() async => const Principal(
    userId: 'u1',
    tenantId: 't1',
    isPlatform: false,
    roles: ['Teacher'],
    permissions: [],
  );
}

void main() {
  final signIn = MunaxaSignIn(
    apiBaseUrl: 'https://school.test.munaxa.com/api/v1',
    returnAddress: Uri.parse('com.munaxa.teacher://signed-in'),
  );

  test('makes an RFC 7636 verifier and its S256 challenge', () {
    final verifier = MunaxaSignIn.newVerifier();
    expect(verifier, matches(RegExp(r'^[A-Za-z0-9_-]{43}$')));
    final expected = base64Url
        .encode(sha256.convert(ascii.encode(verifier)).bytes)
        .replaceAll('=', '');
    expect(MunaxaSignIn.challengeFor(verifier), expected);
    expect(MunaxaSignIn.newVerifier(), isNot(verifier));
  });

  test('starts at School with the school code and the challenge, never the verifier', () {
    const verifier = 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';
    final start = signIn.startAddress(school: ' Al-Noor ', verifier: verifier);
    expect(
      start.toString(),
      startsWith('https://school.test.munaxa.com/api/v1/auth/identity/start?'),
    );
    expect(start.queryParameters['school'], 'al-noor');
    expect(start.queryParameters['app'], 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
    expect(start.toString(), isNot(contains(verifier)));
  });

  test('reads the hand-off or the outcome only from its own return address', () {
    expect(signIn.readReturn('com.munaxa.teacher://signed-in?handoff=abc').handoff, 'abc');
    expect(
      signIn.readReturn('com.munaxa.teacher://signed-in?error=mfa-required').error,
      'mfa-required',
    );
    expect(signIn.readReturn('com.evil.app://signed-in?handoff=abc').handoff, isNull);
  });

  test('signs in with the hand-off and the verifier it started with', () async {
    AppConfig.init(
      const AppConfig(
        flavor: Flavor.teacher,
        appName: 'Munaxa Teacher',
        apiBaseUrl: 'https://school.test.munaxa.com/api/v1',
        munaxaSignInReturn: 'com.munaxa.teacher://signed-in',
      ),
    );
    final api = _FakeAuthApi();
    final storage = _MemoryTokenStorage();
    Uri? opened;
    final container = ProviderContainer(
      overrides: [
        authApiProvider.overrideWithValue(api),
        tokenStorageProvider.overrideWithValue(storage),
        browserSignInProvider.overrideWithValue((start, returnTo) async {
          opened = start;
          return '$returnTo?handoff=sealed';
        }),
      ],
    );
    addTearDown(container.dispose);

    await container.read(authControllerProvider.notifier).signInWithMunaxa(school: 'al-noor');

    expect(api.redeemedHandoff, 'sealed');
    expect(MunaxaSignIn.challengeFor(api.redeemedVerifier!), opened!.queryParameters['app']);
    expect(storage.refresh, 'refresh');
    expect(container.read(authControllerProvider), isA<AuthAuthenticated>());
  });

  test('reports School\'s outcome when the sign-in is refused', () async {
    final container = ProviderContainer(
      overrides: [
        authApiProvider.overrideWithValue(_FakeAuthApi()),
        tokenStorageProvider.overrideWithValue(_MemoryTokenStorage()),
        browserSignInProvider.overrideWithValue(
          (start, returnTo) async => '$returnTo?error=no-account',
        ),
      ],
    );
    addTearDown(container.dispose);
    await expectLater(
      container.read(authControllerProvider.notifier).signInWithMunaxa(school: 'al-noor'),
      throwsA(isA<MunaxaSignInException>().having((e) => e.code, 'code', 'no-account')),
    );
  });
}
