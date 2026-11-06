import { NextResponse } from 'next/server';
import { getDb, saveDb, calculateAuctionDistribution } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '경매 마감 및 분배 정산은 관리자만 가능합니다.' }, { status: 403 });
    }

    const db = getDb();
    const auction = db.auctions.find(a => a.id === params.id);
    if (!auction) {
      return NextResponse.json({ success: false, message: '존재하지 않는 경매입니다.' }, { status: 404 });
    }

    if (auction.status === 'ENDED') {
      return NextResponse.json({ success: false, message: '이미 마감된 경매입니다.' }, { status: 400 });
    }

    // 최종 낙찰 금액
    const finalGold = auction.currentBid;

    // 출석 포인트 기반 분배 계산 (수동 1.0점, 분신 0.25점)
    const distribution = calculateAuctionDistribution(finalGold, db.attendance);

    auction.status = 'ENDED';
    auction.distribution = distribution;

    saveDb(db);

    return NextResponse.json({
      success: true,
      message: `경매가 성공적으로 낙찰 마감되었습니다. 총 ${finalGold.toLocaleString()}금전이 참여 포인트에 비례하여 자동 분배되었습니다.`,
      auction,
      distribution
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
