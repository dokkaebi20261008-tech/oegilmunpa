import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';
import { createSessionToken } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const { username, password } = await req.json();

    if (!username || !password) {
      return NextResponse.json({ success: false, message: '아이디와 비밀번호를 입력해주세요.' }, { status: 400 });
    }

    const cleanUsername = username.trim().toLowerCase();
    const db = getDb();

    const user = db.users.find(u => u.username.toLowerCase() === cleanUsername && u.passwordHash === password);
    if (!user) {
      return NextResponse.json({ success: false, message: '아이디 또는 비밀번호가 일치하지 않습니다.' }, { status: 401 });
    }

    // 가입 승인 상태 검사
    if (user.status === 'PENDING') {
      return NextResponse.json({
        success: false,
        status: 'PENDING',
        message: '문파장의 가입 승인 대기 중입니다. 문파장 승인 후 로그인이 가능합니다.'
      }, { status: 403 });
    }

    if (user.status === 'REJECTED') {
      return NextResponse.json({
        success: false,
        status: 'REJECTED',
        message: '가입 승인이 거절된 계정입니다. 문파장에게 문의해주세요.'
      }, { status: 403 });
    }

    const token = createSessionToken(user);
    const res = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        role: user.role
      }
    });

    res.cookies.set('oegil_session', token, {
      httpOnly: true,
      secure: Boolean(process.env.VERCEL),
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30,
    });

    return res;
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
