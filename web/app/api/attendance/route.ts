import { NextResponse } from 'next/server';
import {
  getDb,
  saveDb,
  recalculateMember,
  calculateAuctionDistribution,
  checkAndFinalizeExpiredAuctions
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { ContentType, ParticipationType, isManagerRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const user = await getCurrentUser(req);
  const authHeader = req.headers.get('authorization') || '';
  const userAgent = req.headers.get('user-agent') || '';
  const isBotRequest =
    authHeader === `Bearer ${process.env.API_SECRET || 'oegil_secret'}` ||
    (!user && userAgent.includes('python-requests'));

  if (!isBotRequest && !user) {
    return NextResponse.json({
      success: false,
      authenticated: false,
      message: '로그인이 필요한 서비스입니다.'
    }, { status: 401 });
  }

  const db = await getDb();
  await checkAndFinalizeExpiredAuctions(db);

  const list = Object.values(db.attendance);
  list.forEach(recalculateMember);

  // 누적 총점 높은 순, 같으면 이번 주 점수 높은 순, 같으면 가나다순
  list.sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if ((b.weeklyPoints || 0) !== (a.weeklyPoints || 0)) return (b.weeklyPoints || 0) - (a.weeklyPoints || 0);
    return a.nickname.localeCompare(b.nickname);
  });

  const totalGuildPoints = Math.round(list.reduce((sum, m) => sum + (m.totalPoints || 0), 0) * 100) / 100;
  const activeMembersCount = list.filter(m => m.totalPoints > 0).length;

  const endedAuctions = (db.auctions || []).filter(a => a.status === 'ENDED');
  const grossAuctionGold = endedAuctions.reduce((sum, a) => sum + (a.grossBid ?? a.currentBid ?? 0), 0);
  const totalSavedAuctionGold = endedAuctions.reduce(
    (sum, a) => sum + (a.netSavedGold ?? Math.floor((a.currentBid || 0) * 0.9)),
    0
  );
  const endedAuctionsCount = endedAuctions.length;

  // 현재 문파 창고에 세이브되어 분배 대기 중인 금전 (분배 시 차감됨)
  const treasuryGold = db.treasuryGold || 0;

  return NextResponse.json({
    success: true,
    currentWeek: db.currentWeek,
    totalMembers: list.length,
    activeMembersCount,
    totalGuildPoints,
    treasuryGold,
    totalAuctionGold: treasuryGold, // 분배 기준 금전 = 현재 문파 창고 세이브 금전 (세금 10% 공제 후 잔액)
    grossAuctionGold,
    totalSavedAuctionGold,
    endedAuctionsCount,
    goldLedger: db.goldLedger || [],
    guildTokens: db.guildTokens || 0,
    tokenLedger: db.tokenLedger || [],
    attendance: list
  });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const authHeader = req.headers.get('authorization') || '';
    const userAgent = req.headers.get('user-agent') || '';
    const isBotRequest =
      authHeader === `Bearer ${process.env.API_SECRET || 'oegil_secret'}` ||
      (!user && userAgent.includes('python-requests'));

    if (!isBotRequest && (!user || !isManagerRole(user.role))) {
      return NextResponse.json(
        { success: false, message: '문주 또는 부문주만 출석 및 창고 금전/배점 설정을 수정할 수 있습니다.' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { action, nickname, names, content, type, manualWeight, cloneWeight } = body;
    const db = await getDb();
    await checkAndFinalizeExpiredAuctions(db);
    const now = new Date().toISOString();

    const mWeight = typeof manualWeight === 'number' ? manualWeight : 1.0;
    const cWeight = typeof cloneWeight === 'number' ? cloneWeight : 0.25;

    // 1. [전원 올 수동 (+4.0P)] 일괄 처리
    if (action === 'SET_ALL_MANUAL') {
      for (const name of db.members) {
        if (!db.attendance[name]) {
          db.attendance[name] = {
            nickname: name,
            yosin: { type: 'MANUAL', points: mWeight, updatedAt: now },
            gyeolgye: { type: 'MANUAL', points: mWeight, updatedAt: now },
            mihok: { type: 'MANUAL', points: mWeight, updatedAt: now },
            singi: { type: 'MANUAL', points: mWeight, updatedAt: now },
            carriedPoints: 0,
            weeklyPoints: mWeight * 4,
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
      return NextResponse.json({
        success: true,
        message: '전원 이번 주 4대 컨텐츠 올 수동 반영 완료',
        attendance: Object.values(db.attendance)
      });
    }

    // 2. [주간 컨텐츠만 미참으로 초기화 (누적 점수는 그대로 보존!)]
    if (action === 'RESET_WEEKLY_CONTENT') {
      for (const name of db.members) {
        const m = db.attendance[name];
        if (m) {
          recalculateMember(m);
          // 현재 주간에 획득한 점수를 이월 누적 점수(carriedPoints)에 합산 후, 4대 컨텐츠 상태만 미참(ABSENT)으로 리셋
          m.carriedPoints = Math.round(((m.carriedPoints || 0) + (m.weeklyPoints || 0)) * 100) / 100;
          m.yosin = { type: 'ABSENT', points: 0, updatedAt: now };
          m.gyeolgye = { type: 'ABSENT', points: 0, updatedAt: now };
          m.mihok = { type: 'ABSENT', points: 0, updatedAt: now };
          m.singi = { type: 'ABSENT', points: 0, updatedAt: now };
          recalculateMember(m);
        }
      }
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '주간 4대 컨텐츠 참여 체크가 모두 [미참]으로 초기화되었습니다! (문파원들의 누적 점수는 초기화되지 않고 100% 그대로 유지됩니다)',
        attendance: Object.values(db.attendance)
      });
    }

    // 3. [누적 점수 전체 0P 초기화 (문파 창고 금전이 모두 분배되어 0 금전일 때만 가능!)]
    if (action === 'RESET_ALL_POINTS' || action === 'RESET_ALL') {
      const currentTreasury = db.treasuryGold || 0;
      if (currentTreasury > 0 && !body.allowWithTreasury) {
        return NextResponse.json({
          success: false,
          message: `⚠️ 현재 문파 창고에 아직 분배되지 않은 세이브 금전(${currentTreasury.toLocaleString()} 금전)이 남아있습니다! 창고 금전을 먼저 모두 분배(창고 잔액 0 금전)한 후에 누적 점수를 초기화할 수 있습니다.`
        }, { status: 400 });
      }

      for (const name of db.members) {
        if (db.attendance[name]) {
          const m = db.attendance[name];
          m.carriedPoints = 0;
          m.weeklyPoints = 0;
          m.yosin = { type: 'ABSENT', points: 0, updatedAt: now };
          m.gyeolgye = { type: 'ABSENT', points: 0, updatedAt: now };
          m.mihok = { type: 'ABSENT', points: 0, updatedAt: now };
          m.singi = { type: 'ABSENT', points: 0, updatedAt: now };
          recalculateMember(m);
        }
      }
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '문파 금전 분배가 완료되어 전 문파원의 누적 점수 및 컨텐츠 참여 내역이 0P로 초기화되었습니다.',
        attendance: Object.values(db.attendance)
      });
    }

    // 4. [문파 창고 세이브 금전 분배 실행 (분배 시 창고 금전 차감 & 선택 시 점수 초기화)]
    if (action === 'DISTRIBUTE_TREASURY_GOLD') {
      const user = await getCurrentUser(req);
      if (!user || !isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문파 창고 금전 분배 처리는 문주 또는 부문주만 가능합니다.' }, { status: 403 });
      }

      const currentTreasury = db.treasuryGold || 0;
      const requestedAmount = body.amount !== undefined ? parseInt(String(body.amount), 10) : currentTreasury;
      const distributeGold = Math.min(currentTreasury, Math.max(0, requestedAmount || 0));

      if (distributeGold <= 0) {
        return NextResponse.json({
          success: false,
          message: '현재 문파 창고에 분배 가능한 세이브 금전이 없습니다. (창고 잔액: 0 금전)'
        }, { status: 400 });
      }

      const dist = calculateAuctionDistribution(distributeGold, db.attendance);
      if (dist.totalPoints <= 0) {
        return NextResponse.json({
          success: false,
          message: '현재 누적 참여 점수가 있는 문파원이 없어 분배할 수 없습니다.'
        }, { status: 400 });
      }

      // 분배 실행 시 문파 창고 세이브 금전에서 차감
      db.treasuryGold = Math.max(0, currentTreasury - distributeGold);

      db.goldLedger.unshift({
        id: `gold_${Date.now()}`,
        type: 'DISTRIBUTED',
        delta: -distributeGold,
        balanceAfter: db.treasuryGold,
        description: `[문파 창고 금전 분배 완료] 총 ${distributeGold.toLocaleString()} 금전을 누적 점수(${dist.totalPoints}P) 비례로 ${dist.participants.length}명에게 분배 차감 (창고 잔액: ${db.treasuryGold.toLocaleString()}G)`,
        actorNickname: user.nickname,
        distribution: dist,
        createdAt: now
      });

      // 만약 분배 후 잔액이 0이고 resetPoints 옵션이 켜져 있으면 누적 점수도 함께 초기화
      if (body.resetPointsAfter && db.treasuryGold === 0) {
        for (const name of db.members) {
          const m = db.attendance[name];
          if (m) {
            m.carriedPoints = 0;
            m.weeklyPoints = 0;
            m.yosin = { type: 'ABSENT', points: 0, updatedAt: now };
            m.gyeolgye = { type: 'ABSENT', points: 0, updatedAt: now };
            m.mihok = { type: 'ABSENT', points: 0, updatedAt: now };
            m.singi = { type: 'ABSENT', points: 0, updatedAt: now };
            recalculateMember(m);
          }
        }
      }

      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: body.resetPointsAfter && db.treasuryGold === 0
          ? `문파 창고 세이브 금전 ${distributeGold.toLocaleString()} 금전 분배(창고 차감) 및 누적 점수 0P 초기화가 모두 완료되었습니다!`
          : `문파 창고 세이브 금전 ${distributeGold.toLocaleString()} 금전이 분배 처리되어 창고에서 차감되었습니다! (남은 창고 세이브 금전: ${db.treasuryGold.toLocaleString()} 금전)`,
        treasuryGold: db.treasuryGold,
        goldLedger: db.goldLedger,
        distribution: dist,
        attendance: Object.values(db.attendance)
      });
    }

    // 5. [문주 / 부문주: 문파 창고 세이브 금전 직접 수정/조정]
    if (action === 'UPDATE_TREASURY_GOLD') {
      const user = await getCurrentUser(req);
      if (!user || !isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문주 또는 부문주 권한이 필요합니다.' }, { status: 403 });
      }
      const newGold = parseInt(String(body.newTreasuryGold), 10);
      if (isNaN(newGold) || newGold < 0) {
        return NextResponse.json({ success: false, message: '유효한 금전 수량(0 이상)을 입력해주세요.' }, { status: 400 });
      }
      const prevGold = db.treasuryGold || 0;
      const delta = newGold - prevGold;
      db.treasuryGold = newGold;
      const memo = String(body.memo || '').trim() || '문파장 창고 세이브 금전 잔액 조정';

      db.goldLedger.unshift({
        id: `gold_${Date.now()}`,
        type: 'ADMIN_ADJUST',
        delta,
        balanceAfter: newGold,
        description: `${memo} (${prevGold.toLocaleString()}G → ${newGold.toLocaleString()}G)`,
        actorNickname: user.nickname,
        createdAt: now
      });

      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `문파 창고 세이브 금전이 ${newGold.toLocaleString()} 금전으로 업데이트되었습니다.`,
        treasuryGold: db.treasuryGold,
        goldLedger: db.goldLedger
      });
    }

    // 6. [문파원 추가]
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
        carriedPoints: 0,
        weeklyPoints: 0,
        totalPoints: 0,
        rate: 0
      };
      await saveDb(db);
      return NextResponse.json({ success: true, message: `문파원 [${targetName}] 등록 완료`, attendance: Object.values(db.attendance) });
    }

    // 7. [문파원 삭제]
    if (action === 'DELETE_MEMBER') {
      const targetName = String(nickname || '').trim();
      if (!targetName) {
        return NextResponse.json({ success: false, message: '삭제할 문파원 닉네임을 입력해주세요.' }, { status: 400 });
      }
      // 문주(ADMIN) 캐릭터는 부문주가 삭제할 수 없도록 보호
      const targetAcc = db.users.find(u => u.nickname === targetName);
      if (targetName === '뱀설' || (targetAcc?.role === 'ADMIN' && user?.role !== 'ADMIN')) {
        return NextResponse.json(
          { success: false, message: '⛔ 최고 권력자인 [문주]는 출석부에서 삭제할 수 없습니다.' },
          { status: 403 }
        );
      }
      db.members = db.members.filter(n => n !== targetName);
      delete db.attendance[targetName];
      await saveDb(db);
      return NextResponse.json({ success: true, message: `문파원 [${targetName}] 삭제 완료`, attendance: Object.values(db.attendance) });
    }

    // 8. 개별/다수 출석 체크
    const targetNames: string[] = names && Array.isArray(names)
      ? names
      : nickname
      ? [nickname]
      : [];

    if (targetNames.length === 0 || !content) {
      return NextResponse.json({ success: false, message: '참여자 닉네임과 컨텐츠명을 입력해주세요.' }, { status: 400 });
    }

    let targetContent: ContentType | null = null;
    const cStr = String(content);
    if (cStr.includes('요신')) targetContent = '요신';
    else if (cStr.includes('결계')) targetContent = '결계';
    else if (cStr.includes('미혹')) targetContent = '미혹';
    else if (cStr.includes('신기')) targetContent = '신기';

    if (!targetContent) {
      return NextResponse.json({ success: false, message: '유효한 컨텐츠(요신, 결계, 미혹, 신기)가 아닙니다.' }, { status: 400 });
    }

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
        if (!db.members.includes(name)) {
          db.members.push(name);
        }
        db.attendance[name] = {
          nickname: name,
          yosin: { type: 'ABSENT', points: 0 },
          gyeolgye: { type: 'ABSENT', points: 0 },
          mihok: { type: 'ABSENT', points: 0 },
          singi: { type: 'ABSENT', points: 0 },
          carriedPoints: 0,
          weeklyPoints: 0,
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
