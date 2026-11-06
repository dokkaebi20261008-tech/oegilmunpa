import { NextResponse } from 'next/server';
import { getDb, saveDb, checkAndFinalizeExpiredAuctions, maskAuctionForClient } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: '경매 입찰은 정회원 로그인 후 가능합니다.' }, { status: 401 });
    }

    const { amount } = await req.json();
    const bidAmount = parseInt(amount, 10);
    if (!bidAmount || isNaN(bidAmount)) {
      return NextResponse.json({ success: false, message: '올바른 입찰 금액을 입력해주세요.' }, { status: 400 });
    }

    const db = await getDb();
    // 만료된 30분 경매 자동 종료 체크
    await checkAndFinalizeExpiredAuctions(db);

    const auction = db.auctions.find(a => a.id === params.id);
    if (!auction) {
      return NextResponse.json({ success: false, message: '존재하지 않는 경매 물품입니다.' }, { status: 404 });
    }

    if (auction.status !== 'ACTIVE') {
      return NextResponse.json({ success: false, message: '경매 제한 시간(30분)이 종료되어 마감된 경매입니다.' }, { status: 400 });
    }

    // 최소 필요 입찰가 계산
    const minRequired = auction.bidsCount === 0
      ? auction.startingBid
      : auction.currentBid + auction.minBidIncrement;

    if (bidAmount < minRequired) {
      return NextResponse.json({
        success: false,
        message: `최소 ${minRequired.toLocaleString()}금전 이상으로 입찰해야 합니다. (현재가 ${auction.currentBid.toLocaleString()} + 최소 호가 ${auction.minBidIncrement.toLocaleString()})`
      }, { status: 400 });
    }

    // DB에는 실제 닉네임을 저장하여 30분 종료 시 최고 입찰자 닉네임이 공개되도록 보존
    auction.currentBid = bidAmount;
    auction.highestBidderNickname = user.nickname;
    auction.highestBidderId = user.userId;
    auction.bidsCount += 1;

    const newBid = {
      id: `bid_${Date.now()}`,
      auctionId: auction.id,
      bidderNickname: user.nickname,
      bidderId: user.userId,
      amount: bidAmount,
      createdAt: new Date().toISOString()
    };

    db.bids.unshift(newBid);
    await saveDb(db);

    // 진행 중 응답에서는 최고 입찰자 닉네임 익명 마스킹
    return NextResponse.json({
      success: true,
      auction: maskAuctionForClient(auction),
      bid: {
        ...newBid,
        bidderNickname: '익명 입찰자',
        bidderId: undefined
      }
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
