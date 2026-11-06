import { NextResponse } from 'next/server';
import { getDb, saveDb, recalculateMember } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ContentType, ParticipationType } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  if (!user) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      message: '로그인이 필요한 서비스입니다.'
    }, { status: 401 });
  }

  const db = await getDb();
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
    const { action, nickname, names, content, type, manualWeight, cloneWeight } = body;
    const db = await getDb();
    const now = new Date().toISOString();

    const mWeight = typeof manualWeight === 'number' ? manualWeight : 1.0;
    const cWeight = typeof cloneWeight === 'number' ? cloneWeight : 0.25;

    // 1. [전원 올 수동 (4점)] 일괄 처리
    if (action === 'SET_ALL_MANUAL') {
      for (const name of db.members) {
        if (!db.attendance[name]) {
          db.attendance[name] = {
            nickname: name,
            yosin: { type: 'MANUAL', points: mWeight, updatedAt: now },
            gyeolgye: { type: 'MANUAL', points: mWeight, updatedAt: now },
            mihok: { type: 'MANUAL', points: mWeight, updatedAt: now },
            singi: { type: 'MANUAL', points: mWeight, updatedAt: now },
            totalPoints: mWeight * 4,
            rate: 100
          };
        } else {
          const m = db.attendance[name];
          m.yosin = { type: 'MANUAL', points: mWeight, updatedAt: now };
          m.gyeolgye = { type: 'MANUAL', points: mWeight, updatedAt: now };
          m.mihok = { type: 'MANUAL', points: mWeight, updatedAt: now };
          m.singi = { type: 'MANUAL', points: mWeight, updatedAt: now };
          recalculateMember(m);
        }
      }
      await saveDb(db);
      return NextResponse.json({ success: true, message: '전원 올 수동 반영 완료', attendance: Object.values(db.attendance) });
    }

    // 2. [전원 초기화 (0점)] 일괄 처리
    if (action === 'RESET_ALL') {
      for (const name of db.members) {
        if (db.attendance[name]) {
          const m = db.attendance[name];
          m.yosin = { type: 'ABSENT', points: 0, updatedAt: now };
          m.gyeolgye = { type: 'ABSENT', points: 0, updatedAt: now };
          m.mihok = { type: 'ABSENT', points: 0, updatedAt: now };
          m.singi = { type: 'ABSENT', points: 0, updatedAt: now };
          recalculateMember(m);
        }
      }
      await saveDb(db);
      return NextResponse.json({ success: true, message: '전원 초기화 완료', attendance: Object.values(db.attendance) });
    }

    // 3. [문파원 추가]
    if (action === 'ADD_MEMBER') {
      const targetName = String(nickname || '').trim();
      if (!targetName) {
        return NextResponse.json({ success: false, message: '추가할 문파원 닉네임을 입력해주세요.' }, { status: 400 });
      }
      if (db.members.includes(targetName)) {
        return NextResponse.json({ success: false, message: '이미 존재하는 문파원입니다.' }, { status: 400 });
      }
      db.members.push(targetName);
      db.attendance[targetName] = {
        nickname: targetName,
        yosin: { type: 'ABSENT', points: 0 },
        gyeolgye: { type: 'ABSENT', points: 0 },
        mihok: { type: 'ABSENT', points: 0 },
        singi: { type: 'ABSENT', points: 0 },
        totalPoints: 0,
        rate: 0
      };
      await saveDb(db);
      return NextResponse.json({ success: true, message: `문파원 [${targetName}] 등록 완료`, attendance: Object.values(db.attendance) });
    }

    // 4. [문파원 삭제]
    if (action === 'DELETE_MEMBER') {
      const targetName = String(nickname || '').trim();
      if (!targetName) {
        return NextResponse.json({ success: false, message: '삭제할 문파원 닉네임을 입력해주세요.' }, { status: 400 });
      }
      db.members = db.members.filter(n => n !== targetName);
      delete db.attendance[targetName];
      await saveDb(db);
      return NextResponse.json({ success: true, message: `문파원 [${targetName}] 삭제 완료`, attendance: Object.values(db.attendance) });
    }

    // 5. 개별 출석/유형 토글 체크
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

    // 참여 형태 결정: 'ABSENT' | 'CLONE' | 'MANUAL'
    let partType: ParticipationType = 'MANUAL';
    let points = mWeight;

    const tUpper = String(type || '').toUpperCase();
    if (tUpper === 'ABSENT' || tUpper.includes('미참')) {
      partType = 'ABSENT';
      points = 0;
    } else if (tUpper === 'CLONE' || tUpper.includes('분신')) {
      partType = 'CLONE';
      points = cWeight;
    } else {
      partType = 'MANUAL';
      points = mWeight;
    }

    const updated: string[] = [];

    for (const rawName of targetNames) {
      const name = String(rawName).trim();
      if (!name) continue;

      if (!db.attendance[name]) {
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
      const participationData = { type: partType, points, updatedAt: now };

      if (targetContent === '요신') m.yosin = participationData;
      else if (targetContent === '결계') m.gyeolgye = participationData;
      else if (targetContent === '미혹') m.mihok = participationData;
      else if (targetContent === '신기') m.singi = participationData;

      recalculateMember(m);
      updated.push(`${name} (${partType === 'ABSENT' ? '미참 0P' : partType === 'CLONE' ? `분신 ${cWeight}P` : `수동 ${mWeight}P`})`);
    }

    await saveDb(db);

    return NextResponse.json({
      success: true,
      content: targetContent,
      type: partType,
      points,
      updatedCount: updated.length,
      updated,
      attendance: Object.values(db.attendance)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
