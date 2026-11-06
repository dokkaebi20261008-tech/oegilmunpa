import { NextResponse } from 'next/server';
import { getDb, saveDb, checkAndFinalizeExpiredAuctions, maskAuctionForClient } from '@/lib/db';
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
  // 30분 타이머 만료된 경매 자동 종료 및 분배 정산
  await checkAndFinalizeExpiredAuctions(db);

  // 활성 경매 우선 정렬 + 진행 중 경매 최고 입찰자 익명 마스킹 (종료 시 실제 닉네임 공개)
  const auctions = [...db.auctions]
    .sort((a, b) => {
      if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
      if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    })
    .map(maskAuctionForClient);

  return NextResponse.json({
    success: true,
    auctions
  });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: '정회원 로그인 후 경매 등록이 가능합니다.' }, { status: 401 });
    }

    const { title, description, imageUrl, startingBid, minBidIncrement, durationSeconds } = await req.json();

    if (!title || !startingBid || !minBidIncrement) {
      return NextResponse.json({ success: false, message: '물품명, 최소 시작 입찰가, 최소 호가 단위를 입력해주세요.' }, { status: 400 });
    }

    const sBid = parseInt(String(startingBid), 10);
    const mInc = parseInt(String(minBidIncrement), 10);

    if (sBid <= 0 || mInc <= 0) {
      return NextResponse.json({ success: false, message: '금액은 0보다 커야 합니다.' }, { status: 400 });
    }

    const db = await getDb();
    const now = new Date();
    // 상품 1개당 경매 종료 타이머 기본 30분 (1,800초) 적용
    const durationMs =
      typeof durationSeconds === 'number' && durationSeconds > 0
        ? durationSeconds * 1000
        : 30 * 60 * 1000;
    const endsAt = new Date(now.getTime() + durationMs).toISOString();

    const resolvedImage = imageUrl || '/images/shop-weapon.png';

    const newAuction = {
      id: `auc_${Date.now()}`,
      title: title.trim(),
      description: description
        ? description.trim()
        : `시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 30분 타이머 종료 시 최고 입찰자 닉네임이 공개됩니다.`,
      imageUrl: resolvedImage,
      startingBid: sBid,
      minBidIncrement: mInc,
      currentBid: sBid,
      status: 'ACTIVE' as const,
      bidsCount: 0,
      endsAt,
      createdAt: now.toISOString()
    };

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
