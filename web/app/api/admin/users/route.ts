import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, saveDb, renameMember } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { Role, ROLE_LABELS, ROLE_RANK, isManagerRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

const VALID_ROLES: Role[] = ['ADMIN', 'SUB_ADMIN', 'ELITE_MEMBER', 'MEMBER'];

export async function GET(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !isManagerRole(user.role)) {
      return NextResponse.json(
        { success: false, message: '문주 또는 부문주 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const db = await getDb();
    const isMainAdmin = user.role === 'ADMIN';

    const adminViewUsers = db.users
      .map(u => ({
        id: u.id,
        username: u.username,
        // 문주(ADMIN)만 다른 회원의 비밀번호를 열람할 수 있음.
        // 부문주(SUB_ADMIN)에게는 어떤 회원의 비밀번호도 노출되지 않고 마스킹 보호됨.
        plainPassword:
          !isMainAdmin
            ? '••••••••'
            : u.role === 'ADMIN'
            ? '(문주 보안 비밀번호)'
            : u.plainPassword || '(이전 가입 계정 - 비번 재설정 가능)',
        nickname: u.nickname,
        role: (u.role || 'MEMBER') as Role,
        status: u.status || 'APPROVED',
        createdAt: u.createdAt,
      }))
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

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
    if (!user || !isManagerRole(user.role)) {
      return NextResponse.json(
        { success: false, message: '문주 또는 부문주 권한이 필요합니다.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, userId, newPassword, username, password, nickname, role, newRole } = body;
    const db = await getDb();

    // 1. 문주/부문주가 문파원 계정을 직접 생성 (즉시 정회원 승인 상태)
    if (action === 'CREATE_APPROVED_USER') {
      const cleanUsername = String(username || '').trim().toLowerCase();
      const cleanPass = String(password || '').trim();
      const cleanNickname = String(nickname || '').trim();
      const requestedRole: Role = VALID_ROLES.includes(role) ? role : 'MEMBER';

      if (!cleanUsername || !cleanPass || !cleanNickname) {
        return NextResponse.json(
          { success: false, message: '캐릭터 닉네임, 로그인 아이디, 비밀번호를 모두 입력해주세요.' },
          { status: 400 }
        );
      }

      // 최고 권력자인 문주(ADMIN) 계정은 추가 생성 불가
      if (requestedRole === 'ADMIN') {
        return NextResponse.json(
          { success: false, message: '⛔ 최고 권력자인 [문주] 직책은 추가로 생성할 수 없습니다.' },
          { status: 400 }
        );
      }

      if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
        return NextResponse.json({ success: false, message: '이미 존재하는 로그인 아이디입니다.' }, { status: 400 });
      }
      if (db.users.some(u => u.nickname.toLowerCase() === cleanNickname.toLowerCase())) {
        return NextResponse.json({ success: false, message: '이미 등록된 캐릭터 닉네임입니다.' }, { status: 400 });
      }

      const newUser = {
        id: `usr_${Date.now()}`,
        username: cleanUsername,
        passwordHash: crypto.createHash('sha256').update(cleanPass).digest('hex'),
        plainPassword: cleanPass,
        nickname: cleanNickname,
        role: requestedRole,
        status: 'APPROVED' as const,
        createdAt: new Date().toISOString()
      };

      db.users.push(newUser);
      if (!db.members.includes(cleanNickname)) {
        db.members.push(cleanNickname);
        db.attendance[cleanNickname] = {
          nickname: cleanNickname,
          yosin: { type: 'ABSENT', points: 0 },
          gyeolgye: { type: 'ABSENT', points: 0 },
          mihok: { type: 'ABSENT', points: 0 },
          singi: { type: 'ABSENT', points: 0 },
          totalPoints: 0,
          rate: 0
        };
      }

      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${cleanNickname}' 계정이 [${ROLE_LABELS[requestedRole]}] 등급으로 즉시 승인 생성되었습니다!`
      });
    }

    if (!action || !userId) {
      return NextResponse.json({ success: false, message: 'action과 userId를 입력해주세요.' }, { status: 400 });
    }

    const targetUser = db.users.find(u => u.id === userId);
    if (!targetUser) {
      return NextResponse.json({ success: false, message: '해당 회원을 찾을 수 없습니다.' }, { status: 404 });
    }

    // 🔒 위계 보호 원칙: 부문주(SUB_ADMIN)는 절대 문주(ADMIN) 계정을 수정/삭제/강등/비번변경 할 수 없음!
    if (targetUser.role === 'ADMIN' && user.role !== 'ADMIN') {
      return NextResponse.json(
        {
          success: false,
          message: '⛔ 부문주 권한으로는 최고 권력자인 [문주] 계정의 권한이나 정보를 변경할 수 없습니다.'
        },
        { status: 403 }
      );
    }

    // 2. 가입 승인 (승인 시 등급 지정 가능, 기본값 문파원)
    if (action === 'APPROVE') {
      const assignedRole: Role = VALID_ROLES.includes(role) ? role : targetUser.role || 'MEMBER';
      if (assignedRole === 'ADMIN' && user.role !== 'ADMIN') {
        return NextResponse.json(
          { success: false, message: '부문주 권한으로는 [문주] 등급을 부여할 수 없습니다.' },
          { status: 403 }
        );
      }

      targetUser.status = 'APPROVED';
      targetUser.role = assignedRole;

      if (!db.members.includes(targetUser.nickname)) {
        db.members.push(targetUser.nickname);
        db.attendance[targetUser.nickname] = {
          nickname: targetUser.nickname,
          yosin: { type: 'ABSENT', points: 0 },
          gyeolgye: { type: 'ABSENT', points: 0 },
          mihok: { type: 'ABSENT', points: 0 },
          singi: { type: 'ABSENT', points: 0 },
          totalPoints: 0,
          rate: 0
        };
      }
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 님의 가입이 [${ROLE_LABELS[assignedRole]}] 등급으로 정식 승인되었습니다!`
      });
    }

    // 3. 회원 등급(직책) 변경: 문주 / 부문주 / 열혈 문파원 / 문파원
    if (action === 'UPDATE_ROLE') {
      const targetRole = (newRole || role) as Role;
      if (!VALID_ROLES.includes(targetRole)) {
        return NextResponse.json(
          { success: false, message: '유효한 등급(문주, 부문주, 열혈 문파원, 문파원)을 선택해주세요.' },
          { status: 400 }
        );
      }

      // 창립 문주(뱀설) 계정은 절대 강등 불가
      if (targetUser.username === '뱀설' && targetRole !== 'ADMIN') {
        return NextResponse.json(
          { success: false, message: '⛔ 최고 권력자인 문주(뱀설) 계정의 등급은 변경할 수 없습니다.' },
          { status: 403 }
        );
      }

      // 문주(ADMIN) 직책은 양도 또는 변경할 수 없음
      if (targetRole === 'ADMIN') {
        return NextResponse.json(
          {
            success: false,
            message: '⛔ 문주 직책은 양도 또는 변경할 수 없는 고유 직책입니다.'
          },
          { status: 400 }
        );
      }

      // 부문주가 다른 부문주의 등급을 강등/변경하는 것 방지 (문주만 부문주 해임 가능)
      if (user.role === 'SUB_ADMIN' && targetUser.role === 'SUB_ADMIN' && user.userId !== targetUser.id) {
        return NextResponse.json(
          {
            success: false,
            message: '⛔ 다른 부문주의 등급 변경은 최고 권력자인 [문주]만 가능합니다.'
          },
          { status: 403 }
        );
      }

      const prevRoleLabel = ROLE_LABELS[targetUser.role] || '문파원';
      const nextRoleLabel = ROLE_LABELS[targetRole];
      targetUser.role = targetRole;
      await saveDb(db);

      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 님의 등급이 [${prevRoleLabel}] ➔ [${nextRoleLabel}](으)로 변경되었습니다.`
      });
    }

    // 4. 가입 거절
    if (action === 'REJECT') {
      targetUser.status = 'REJECTED';
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 님의 가입 신청이 거절되었습니다.`
      });
    }

    // 5. 비밀번호 재설정
    if (action === 'UPDATE_PASSWORD') {
      if (user.role === 'SUB_ADMIN' && targetUser.role === 'SUB_ADMIN' && user.userId !== targetUser.id) {
        return NextResponse.json(
          { success: false, message: '다른 부문주의 비밀번호 변경은 최고 권력자인 [문주]만 가능합니다.' },
          { status: 403 }
        );
      }
      if (!newPassword || String(newPassword).trim().length === 0) {
        return NextResponse.json({ success: false, message: '변경할 새 비밀번호를 입력해주세요.' }, { status: 400 });
      }
      const cleanPass = String(newPassword).trim();
      targetUser.plainPassword = cleanPass;
      targetUser.passwordHash = crypto.createHash('sha256').update(cleanPass).digest('hex');
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 문파원의 비밀번호가 '${cleanPass}'(으)로 변경되었습니다.`
      });
    }

    // 6. 계정 삭제
    if (action === 'DELETE') {
      if (targetUser.username === '뱀설' || targetUser.role === 'ADMIN') {
        return NextResponse.json(
          { success: false, message: '⛔ 최고 권력자인 [문주] 계정은 삭제할 수 없습니다.' },
          { status: 403 }
        );
      }
      if (user.role === 'SUB_ADMIN' && targetUser.role === 'SUB_ADMIN' && user.userId !== targetUser.id) {
        return NextResponse.json(
          { success: false, message: '⛔ 다른 부문주 계정 삭제는 최고 권력자인 [문주]만 가능합니다.' },
          { status: 403 }
        );
      }

      db.users = db.users.filter(u => u.id !== userId);
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `'${targetUser.nickname}' 계정이 삭제되었습니다.`
      });
    }

    // 7. 회원/문파원 닉네임 변경
    if (action === 'RENAME_NICKNAME' || action === 'RENAME_MEMBER') {
      const oldNick = String(body.oldNickname || body.nickname || targetUser?.nickname || '').trim();
      const newNick = String(body.newNickname || '').trim();
      const result = renameMember(db, oldNick, newNick);
      if (!result.success) {
        return NextResponse.json({ success: false, message: result.message }, { status: 400 });
      }
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: result.message
      });
    }

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
