import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    console.log('[DEBUG /api/admin/users] user:', user, 'cookie:', req.headers.get('cookie'));
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '관리자 권한이 필요합니다.', debugUser: user }, { status: 403 });
    }

    const db = getDb();
    const safeUsers = db.users.map(u => ({
      id: u.id,
      nickname: u.nickname,
      role: u.role,
      status: u.status || 'APPROVED',
      createdAt: u.createdAt,
    }));

    const pendingCount = safeUsers.filter(u => u.status === 'PENDING').length;

    return NextResponse.json({
      success: true,
      pendingCount,
      users: safeUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const { action, userId } = await req.json();
    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'action과 userId를 입력해주세요.' }, { status: 400 });
    }

    const db = getDb();
    const targetUser = db.users.find(u => u.id === userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, message: '해당 유저를 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      targetUser.status = 'APPROVED';
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 문파원의 가입이 정식 승인되었습니다!`,
        user: targetUser
      });
    }

    if (action === 'REJECT') {
      targetUser.status = 'REJECTED';
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 님의 가입 신청이 거절되었습니다.`,
        user: targetUser
      });
    }

    if (action === 'DELETE') {
      db.users = db.users.filter(u => u.id !== userId);
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 계정이 삭제되었습니다.`
      });
    }

    return NextResponse.json({ success: false, message: '유효한 action이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
