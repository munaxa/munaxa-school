import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { createAccount, listAccounts, loginHistory } from '@/lib/auth/accounts';
import { updateRequest } from '@/lib/requests';
import { PERSONA_BY_ID, type PersonaId } from '@/lib/rbac';
import { assertSameOrigin, clamp } from '@/lib/http';

export const runtime = 'nodejs';

async function requireAdmin() {
  const session = await getServerSession();
  if (!session || !session.admin) return null;
  return session;
}

function publicAccount(a: Awaited<ReturnType<typeof listAccounts>>[number]) {
  // Never expose password hashes.
  const { passwordHash: _hash, seedPassword: _seed, ...rest } = a;
  void _hash;
  void _seed;
  return rest;
}

export async function GET() {
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const [accounts, history] = await Promise.all([listAccounts(), loginHistory()]);
  return NextResponse.json({ accounts: accounts.map(publicAccount), history });
}

export async function POST(req: NextRequest) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAdmin())) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  let body: {
    organizationName?: string;
    username?: string;
    password?: string;
    expiresInDays?: number | null;
    role?: string | null;
    requestId?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
  const organizationName = clamp(body.organizationName, 120);
  const username = clamp(body.username, 64);
  const password = clamp(body.password, 128);
  const expiresInDays =
    body.expiresInDays === null || body.expiresInDays === undefined
      ? null
      : Number(body.expiresInDays);
  const role = body.role && PERSONA_BY_ID[body.role as PersonaId] ? (body.role as PersonaId) : null;

  if (!organizationName || !username || !password) {
    return NextResponse.json(
      { error: 'School name, username and password are required' },
      { status: 400 },
    );
  }
  if (username.length < 3 || password.length < 6) {
    return NextResponse.json(
      { error: 'Username must be ≥ 3 chars and password ≥ 6 chars' },
      { status: 400 },
    );
  }
  try {
    const acct = await createAccount({ organizationName, username, password, expiresInDays, role });
    // If provisioned from an approved request, mark it converted and link the account.
    if (body.requestId) updateRequest(body.requestId, { status: 'CONVERTED', accountId: acct.id });
    return NextResponse.json({ account: publicAccount(acct) }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Failed' }, { status: 409 });
  }
}
