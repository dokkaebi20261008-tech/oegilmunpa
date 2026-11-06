import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '문파장(어드민) 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const db = getDb();
    // 어드민 전용 메뉴에서는 문파원들이 아이디/비밀번호 분실 시 안내할 수 있도록 username 및 plainPassword 제공
    const adminViewUsers = db.users.map(u => ({
      id: u.id,
      username: u.username,
      plainPassword: u.plainPassword || (u.role === 'ADMIN' ? '(문파장 보안 비밀번호)' : '(이전 가입 계정 - 비번 재설정 가능)'),
      nickname: u.nickname,
      role: u.role,
      status: u.status || 'APPROVED',
      createdAt: u.createdAt,
    }));

    const pendingCount = adminViewUsers.filter(u => u.status === 'PENDING').length;

    return NextResponse.json({
      success: true,
      pendingCount,
      users: adminViewUsers,
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || user.role !== 'ADMIN') {
      return NextResponse.json(
        { success: false, message: '문파장(어드민) 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const { action, userId, newPassword } = await req.json();
    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'action과 userId를 입력해주세요.' }, { status: 400 });
    }

    const db = getDb();
    const targetUser = db.users.find(u => u.id === userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, message: '해당 회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    if (action === 'APPROVE') {
      targetUser.status = 'APPROVED';
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 문파원의 가입이 정식 승인되었습니다!`
      });
    }

    if (action === 'REJECT') {
      targetUser.status = 'REJECTED';
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 님의 가입 신청이 거절되었습니다.`
      });
    }

    if (action === 'UPDATE_PASSWORD') {
      if (!newPassword || String(newPassword).trim().length === 0) {
        return NextResponse.json({ success: false, message: '변경할 새 비밀번호를 입력해주세요.' }, { status: 400 });
      }
      const cleanPass = String(newPassword).trim();
      targetUser.plainPassword = cleanPass;
      targetUser.passwordHash = crypto.createHash('sha256').update(cleanPass).digest('hex');
      saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 문파원의 비밀번호가 '${cleanPass}'(으)로 변경되었습니다.`
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

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
