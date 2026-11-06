import { NextResponse } from 'next/server';
import {
  getDb,
  saveDb,
  getKSTWednesdaySchedule,
  checkAndFinalizeExpiredAuctions,
  activateScheduledAuction,
  maskAuctionForClient
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isManagerRole } from '@/lib/types';

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
  // 수요일 19:30 대기(SCHEDULED) -> 19:30~20:00 본 경매(ACTIVE) -> 20:00 종료(ENDED) 및 10% 세금 공제 창고 세이브 자동 처리
  await checkAndFinalizeExpiredAuctions(db);
  const wednesdaySchedule = getKSTWednesdaySchedule();

  const statusOrder: Record<string, number> = {
    ACTIVE: 0,
    SCHEDULED: 1,
    ENDED: 2,
    CANCELLED: 3
  };

  const auctions = [...db.auctions]
    .sort((a, b) => {
      const oa = statusOrder[a.status] ?? 9;
      const ob = statusOrder[b.status] ?? 9;
      if (oa !== ob) return oa - ob;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map(maskAuctionForClient);

  return NextResponse.json({
    success: true,
    wednesdaySchedule,
    auctions,
    treasuryGold: db.treasuryGold || 0,
    goldLedger: db.goldLedger || [],
    guildTokens: db.guildTokens || 0,
    tokenLedger: db.tokenLedger || []
  });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user || !isManagerRole(user.role)) {
      return NextResponse.json({ success: false, message: '문주 또는 부문주만 신규 경매를 등록할 수 있습니다.' }, { status: 403 });
    }

    const { title, description, imageUrl, startingBid, minBidIncrement, mode } = await req.json();

    if (!title || !startingBid || !minBidIncrement) {
      return NextResponse.json({ success: false, message: '물품명, 최소 시작 입찰가, 최소 호가 단위를 입력해주세요.' }, { status: 400 });
    }

    const sBid = parseInt(String(startingBid), 10);
    const mInc = parseInt(String(minBidIncrement), 10);

    if (sBid <= 0 || mInc <= 0) {
      return NextResponse.json({ success: false, message: '금액은 0보다 커야 합니다.' }, { status: 400 });
    }

    const db = await getDb();
    const nowMs = Date.now();
    const resolvedImage = imageUrl || '/images/shop-weapon.png';

    const isScheduled = mode === 'SCHEDULED';
    const scheduledStartAt = isScheduled
      ? new Date(nowMs + 30 * 60 * 1000).toISOString()
      : new Date(nowMs).toISOString();
    const endsAt = isScheduled
      ? new Date(nowMs + 60 * 60 * 1000).toISOString()
      : new Date(nowMs + 30 * 60 * 1000).toISOString();

    const newAuction = {
      id: `auc_${nowMs}`,
      title: title.trim(),
      description: description
        ? description.trim()
        : `시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 종료 시 최고 입찰자 닉네임 및 최종 낙찰금액 공개 (세금 10% 공제 후 창고 세이브)`,
      imageUrl: resolvedImage,
      startingBid: sBid,
      minBidIncrement: mInc,
      currentBid: sBid,
      status: isScheduled ? ('SCHEDULED' as const) : ('ACTIVE' as const),
      scheduledStartAt,
      applicants: [user.nickname],
      bidsCount: 0,
      endsAt,
      createdAt: new Date(nowMs).toISOString()
    };

    if (!isScheduled) {
      activateScheduledAuction(db, newAuction, true);
    }

    db.auctions.unshift(newAuction);
    await saveDb(db);

    return NextResponse.json({
      success: true,
      auction: maskAuctionForClient(newAuction)
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
