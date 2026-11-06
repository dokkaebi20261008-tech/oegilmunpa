import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getDb } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const cookieHeader = req.headers.get('cookie');
  console.log('[DEBUG /api/auth/me] Cookie header:', cookieHeader);
  const user = await getCurrentUser(req);
  console.log('[DEBUG /api/auth/me] User result:', user);
  if (!user) {
    return NextResponse.json({ authenticated: false, user: null, debugCookie: cookieHeader });
  }

  const db = await getDb();
  const attendance = db.attendance[user.nickname] || null;

  return NextResponse.json({
    authenticated: true,
    user,
    myAttendance: attendance
  });
}
