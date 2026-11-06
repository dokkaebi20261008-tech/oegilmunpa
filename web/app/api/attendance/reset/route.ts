import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    // 관리자 또는 API 시크릿 키로 초기화 허용
    const authHeader = req.headers.get('authorization');
    const isSecretValid = authHeader === `Bearer ${process.env.API_SECRET || 'oegil_secret'}`;

    if (!isSecretValid && user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '관리자 권한이 필요합니다.' }, { status: 403 });
    }

    const db = getDb();
    for (const name in db.attendance) {
      db.attendance[name] = {
        nickname: name,
        yosin: { type: 'ABSENT', points: 0 },
        gyeolgye: { type: 'ABSENT', points: 0 },
        mihok: { type: 'ABSENT', points: 0 },
        singi: { type: 'ABSENT', points: 0 },
        totalPoints: 0,
        rate: 0
      };
    }

    saveDb(db);

    return NextResponse.json({
      success: true,
      message: '모든 문파원의 출석 체크박스와 포인트가 0으로 초기화되었습니다.'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
