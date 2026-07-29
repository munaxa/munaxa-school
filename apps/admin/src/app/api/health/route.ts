import { NextResponse } from 'next/server';

/** Lightweight health endpoint for the Admin Portal (used by uptime checks / orchestration). */
export function GET() {
  return NextResponse.json({ status: 'ok', service: 'admin', ts: new Date().toISOString() });
}
