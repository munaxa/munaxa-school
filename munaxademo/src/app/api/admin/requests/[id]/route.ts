import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from '@/lib/auth/session';
import { REQUEST_STATUSES, updateRequest, type RequestStatus } from '@/lib/requests';
import { assertSameOrigin } from '@/lib/http';

export const runtime = 'nodejs';

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const session = await getServerSession();
  if (!session || !session.admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  let body: { status?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  if (!body.status || !REQUEST_STATUSES.includes(body.status as RequestStatus)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }
  const updated = updateRequest(id, { status: body.status as RequestStatus });
  if (!updated) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ request: updated });
}
