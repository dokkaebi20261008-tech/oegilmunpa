import { NextResponse } from 'next/server';
import { getDb, saveDb, recalculateMember, archiveWeeklyContentHistory } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isManagerRole } from '@/lib/types';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const authHeader = req.headers.get('authorization');
    const isSecretValid = authHeader === `Bearer ${process.env.API_SECRET || 'oegil_secret'}`;

    if (!isSecretValid && !isManagerRole(user?.role)) {
      return NextResponse.json({ success: false, message: '문주 또는 부문주 권한이 필요합니다.' }, { status: 403 });
    }

    let body: any = {};
    try {
      body = await req.json();
    } catch {
      body = {};
    }

    const mode = body.mode || 'WEEKLY_CONTENT_ONLY'; // 기본값: 주간 컨텐츠만 미참으로 초기화 (누적 점수는 유지)
    const db = await getDb();

    if (mode === 'ALL_POINTS') {
      const treasuryGold = db.treasuryGold || 0;
      if (treasuryGold > 0 && !body.force) {
        return NextResponse.json(
          {
            success: false,
            message: `현재 문파 창고에 미분배 세이브 금전(${treasuryGold.toLocaleString()} 금전)이 남아 있습니다. 금전이 모두 분배(0 금전)된 후에만 누적 점수를 초기화할 수 있습니다.`
          },
          { status: 400 }
        );
      }

      for (const name in db.attendance) {
        db.attendance[name] = {
          nickname: name,
          carriedPoints: 0,
          weeklyPoints: 0,
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
        message: '모든 문파원의 누적 점수 및 주간 출석 내역이 0P로 완전 초기화되었습니다.'
      });
    }

    // WEEKLY_CONTENT_ONLY: 4대 주간 컨텐츠만 미참(ABSENT)으로 초기화하고 점수는 carriedPoints로 이월 유지 + 주차별 참여 기록 아카이브
    const archived = archiveWeeklyContentHistory(db, user?.nickname || '관리자', body.weekLabel);

    for (const name in db.attendance) {
      const m = db.attendance[name];
      recalculateMember(m);
      m.carriedPoints = m.totalPoints;
      m.weeklyPoints = 0;
      m.yosin = { type: 'ABSENT', points: 0 };
      m.gyeolgye = { type: 'ABSENT', points: 0 };
      m.mihok = { type: 'ABSENT', points: 0 };
      m.singi = { type: 'ABSENT', points: 0 };
      recalculateMember(m);
    }

    await saveDb(db);

    return NextResponse.json({
      success: true,
      archivedEntry: archived,
      weeklyHistory: db.weeklyHistory || [],
      message: archived
        ? `[${archived.weekLabel}] 주간 컨텐츠 참여 기록이 자동 저장되었으며(1개월 보관 후 다음달 동일 주차 자동 삭제), 이번 주 4대 컨텐츠는 미참으로 초기화되었습니다. (누적 점수는 그대로 유지)`
        : '주간 4대 컨텐츠가 모두 미참으로 초기화되었으며, 문파원들의 누적 점수는 그대로 유지(이월)되었습니다.'
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
