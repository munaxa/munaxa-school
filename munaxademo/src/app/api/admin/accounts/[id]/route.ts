import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { deleteAccount, getAccount, updateAccount } from '@/lib/auth/accounts';
import { assertSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

async function requireAdmin() {
  const session = await getServerSession();
  return session && session.admin ? session : null;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  let body: { status?: 'ACTIVE' | 'DISABLED'; expiresInDays?: number | null };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const patch: { status?: 'ACTIVE' | 'DISABLED'; expiresAt?: string | null } = {};
  if (body.status === 'ACTIVE' || body.status === 'DISABLED') patch.status = body.status;
  if (body.expiresInDays !== undefined) {
    patch.expiresAt =
      body.expiresInDays === null
        ? null
        : new Date(Date.now() + Number(body.expiresInDays) * 86_400_000).toISOString();
  }

  const acct = await updateAccount(id, patch);
  if (!acct) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const { passwordHash: _h, seedPassword: _seed, ...rest } = acct;
  void _h;
  void _seed;
  return NextResponse.json({ account: rest });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  if (!(await requireAdmin())) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;
  const acct = await getAccount(id);
  if (!acct) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const ok = await deleteAccount(id);
  if (!ok) return NextResponse.json({ error: 'This account cannot be deleted' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
