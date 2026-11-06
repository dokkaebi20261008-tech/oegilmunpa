import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { getDb, saveDb } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password, nickname } = await req.json();

    if (!username || !password || !nickname) {
      return NextResponse.json({ success: false, message: '모든 항목을 입력해주세요.' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanNickname = nickname.trim();

    const db = await getDb();

    // 중복 검사
    if (db.users.some(u => u.username.toLowerCase() === cleanUsername)) {
      return NextResponse.json({ success: false, message: '이미 존재하는 아이디입니다.' }, { status: 400 });
    }

    if (db.users.some(u => u.nickname.toLowerCase() === cleanNickname.toLowerCase())) {
      return NextResponse.json({ success: false, message: '이미 가입된 문파원 닉네임입니다.' }, { status: 400 });
    }

    const isAdmin = db.users.length === 0;
    const initialStatus = isAdmin ? 'APPROVED' : 'PENDING';

    const hashedPassword = crypto.createHash('sha256').update(password).digest('hex');

    const newUser = {
      id: `usr_${Date.now()}`,
      username: cleanUsername,
      passwordHash: hashedPassword,
      plainPassword: password,
      nickname: cleanNickname,
      role: (isAdmin ? 'ADMIN' : 'MEMBER') as 'ADMIN' | 'MEMBER',
      status: initialStatus as 'APPROVED' | 'PENDING',
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);

    // 최초 관리자이거나 즉시 승인 상태인 경우에만 출석부에 추가 (일반 가입 대기자는 승인 시 추가)
    if (newUser.status === 'APPROVED' && !db.members.includes(cleanNickname)) {
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
    console.log(`[REGISTER] New user registered: nickname=${newUser.nickname}, username=${newUser.username}, status=${newUser.status}`);

    if (newUser.status === 'PENDING') {
      return NextResponse.json({
        success: true,
        pendingApproval: true,
        message: '회원가입 신청이 완료되었습니다! 문파장(관리자)의 승인 후 로그인하실 수 있습니다.',
        user: {
          nickname: newUser.nickname,
          status: newUser.status
        }
      });
    }

    const token = createSessionToken(newUser);
    const res = NextResponse.json({
      success: true,
      pendingApproval: false,
      user: {
        id: newUser.id,
        nickname: newUser.nickname,
        role: newUser.role,
        status: newUser.status
      }
    });

    res.cookies.set('oegil_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30일
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
