import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';

export const runtime = 'nodejs';

/** Returns the current access session (org + admin flag) or 401. */
export async function GET() {
  const session = await getServerSession();
  if (!session) return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  return NextResponse.json({
    organizationName: session.org,
    username: session.username,
    admin: session.admin,
    role: session.role,
    expiresAt: new Date(session.exp * 1000).toISOString(),
  });
}
