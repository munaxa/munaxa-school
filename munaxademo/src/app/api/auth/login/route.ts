import { NextResponse, type NextRequest } from 'next/server';
import { getAccountByUsername, isExpired, recordLogin, checkPassword } from '@/lib/auth/accounts';
import { signSession, ttlMinutes } from '@/lib/auth/token';
import { cookieName, cookieOptions, rateLimited, clearRateLimit } from '@/lib/auth/session';
import { assertSameOrigin, clamp } from '@/lib/http';

export const runtime = 'nodejs';

function ipOf(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;

  let body: { username?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const username = clamp(body.username, 64);
  const password = clamp(body.password, 128);
  const ip = ipOf(req);

  if (!username || !password) {
    return NextResponse.json({ error: 'Username and password are required' }, { status: 400 });
  }
  if (rateLimited(`${ip}:${username.toLowerCase()}`)) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a few minutes and try again.' },
      { status: 429 },
    );
  }

  const account = await getAccountByUsername(username);
  const ok = account ? await checkPassword(account, password) : false;

  if (!account || !ok) {
    if (account) await recordLogin({ accountId: account.id, username, outcome: 'FAILED', ip });
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  if (account.status === 'DISABLED') {
    await recordLogin({ accountId: account.id, username, outcome: 'DISABLED', ip });
    return NextResponse.json({ error: 'This demo account is disabled.' }, { status: 403 });
  }
  if (isExpired(account)) {
    await recordLogin({ accountId: account.id, username, outcome: 'EXPIRED', ip });
    return NextResponse.json({ error: 'This demo account has expired.' }, { status: 403 });
  }

  clearRateLimit(`${ip}:${username.toLowerCase()}`);
  await recordLogin({ accountId: account.id, username, outcome: 'SUCCESS', ip });

  const now = Math.floor(Date.now() / 1000);
  const token = await signSession({
    sid: crypto.randomUUID(),
    aid: account.id,
    org: account.organizationName,
    username: account.username,
    admin: account.admin,
    role: account.role,
    iat: now,
    exp: now + ttlMinutes() * 60,
  });

  const res = NextResponse.json({
    ok: true,
    organizationName: account.organizationName,
    username: account.username,
    admin: account.admin,
    role: account.role,
  });
  res.cookies.set(cookieName(), token, cookieOptions(process.env.NODE_ENV === 'production'));
  return res;
}
