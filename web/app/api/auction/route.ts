import { NextResponse } from 'next/server';
import {
  getDb,
  saveDb,
  checkAndFinalizeExpiredAuctions,
  activateScheduledAuction,
  maskAuctionForClient
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

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
  // 30분 대기(SCHEDULED) -> 30분 본 경매(ACTIVE) -> 종료(ENDED) 및 10% 세금 공제 창고 세이브 자동 처리
  await checkAndFinalizeExpiredAuctions(db);

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
    if (!user) {
      return NextResponse.json({ success: false, message: '정회원 로그인 후 경매 등록이 가능합니다.' }, { status: 401 });
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

    // mode === 'SCHEDULED' 이면 30분 대기 후 30분 경매 (총 1시간), 기본은 즉시 30분 경매 개시
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
        : `시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 30분 타이머 종료 시 최고 입찰자 닉네임 공개 및 세금 10% 공제 후 문파 창고 세이브`,
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
      activateScheduledAuction(db, newAuction);
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
