import { NextResponse } from 'next/server';
import { getDb, saveDb, recalculateMember } from '@/lib/db';
import { ContentType, ParticipationType } from '@/lib/types';

export async function GET() {
  const db = getDb();
  const list = Object.values(db.attendance);

  // 포인트 높은 순, 포인트 같으면 닉네임 가나다순
  list.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    return a.nickname.localeCompare(b.nickname);
  });

  const totalGuildPoints = Math.round(list.reduce((sum, m) => sum + (m.totalPoints || 0), 0) * 100) / 100;
  const activeMembersCount = list.filter(m => m.totalPoints > 0).length;

  return NextResponse.json({
    success: true,
    currentWeek: db.currentWeek,
    totalMembers: list.length,
    activeMembersCount,
    totalGuildPoints,
    attendance: list
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { names, nickname, content, type } = body;

    const targetNames: string[] = names && Array.isArray(names) 
      ? names 
      : nickname 
      ? [nickname] 
      : [];

    if (targetNames.length === 0 || !content) {
      return NextResponse.json({ success: false, message: '참여자 닉네임과 컨텐츠명을 입력해주세요.' }, { status: 400 });
    }

    // 컨텐츠 키워드 정규화
    let targetContent: ContentType | null = null;
    const cStr = String(content);
    if (cStr.includes('요신')) targetContent = '요신';
    else if (cStr.includes('결계')) targetContent = '결계';
    else if (cStr.includes('미혹')) targetContent = '미혹';
    else if (cStr.includes('신기')) targetContent = '신기';

    if (!targetContent) {
      return NextResponse.json({ success: false, message: '유효한 컨텐츠(요신, 결계, 미혹, 신기)가 아닙니다.' }, { status: 400 });
    }

    // 참여 형태 결정: 'CLONE'이면 0.25점, 그 외 수동(기본)은 1.0점
    const partType: ParticipationType = (type === 'CLONE' || String(type).toUpperCase() === 'CLONE' || String(type).includes('분신'))
      ? 'CLONE'
      : 'MANUAL';
    
    const points = partType === 'CLONE' ? 0.25 : 1.0;

    const db = getDb();
    const updated: string[] = [];
    const now = new Date().toISOString();

    for (const rawName of targetNames) {
      const name = String(rawName).trim();
      if (!name) continue;

      if (!db.attendance[name]) {
        // 명단에 없으면 자동 등록
        db.members.push(name);
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

      const m = db.attendance[name];
      if (targetContent === '요신') m.yosin = { type: partType, points, updatedAt: now };
      else if (targetContent === '결계') m.gyeolgye = { type: partType, points, updatedAt: now };
      else if (targetContent === '미혹') m.mihok = { type: partType, points, updatedAt: now };
      else if (targetContent === '신기') m.singi = { type: partType, points, updatedAt: now };

      recalculateMember(m);
      updated.push(`${name} (${partType === 'CLONE' ? '분신 0.25P' : '수동 1.0P'})`);
    }

    saveDb(db);

    return NextResponse.json({
      success: true,
      content: targetContent,
      type: partType,
      points,
      updatedCount: updated.length,
      updated
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
