import { NextResponse } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { listRequests } from '@/lib/requests';

export const runtime = 'nodejs';

export async function GET() {
  const session = await getServerSession();
  if (!session || !session.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  return NextResponse.json({ requests: listRequests() });
}
