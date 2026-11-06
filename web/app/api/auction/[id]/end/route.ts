import { NextResponse } from 'next/server';
import { getDb, saveDb, activateScheduledAuction, finalizeSingleAuction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isManagerRole } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (!isManagerRole(user?.role)) {
      return NextResponse.json({ success: false, message: '경매 진행/마감 제어는 문주 또는 부문주만 가능합니다.' }, { status: 403 });
    }

    let action = 'END';
    try {
      const body = await req.json();
      if (body?.action) action = body.action;
    } catch {
      // body 없을 경우 기본 END
    }

    const db = await getDb();
    const auction = db.auctions.find(a => a.id === params.id);
    if (!auction) {
      return NextResponse.json({ success: false, message: '존재하지 않는 경매입니다.' }, { status: 404 });
    }

    // 대기 중인 경매(SCHEDULED)를 즉시 본 경매(ACTIVE 30분)로 전환
    if (action === 'START_NOW' && auction.status === 'SCHEDULED') {
      activateScheduledAuction(db, auction, true);
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '대기를 종료하고 즉시 30분 익명 경매가 시작되었습니다! (용맹의 증표 차감 완료)',
        auction,
        guildTokens: db.guildTokens,
        tokenLedger: db.tokenLedger
      });
    }

    if (auction.status === 'ENDED') {
      return NextResponse.json({ success: false, message: '이미 마감된 경매입니다.' }, { status: 400 });
    }

    if (auction.status === 'SCHEDULED') {
      activateScheduledAuction(db, auction, true);
    }

    finalizeSingleAuction(db, auction);
    await saveDb(db);

    const gross = auction.grossBid || auction.currentBid || 0;
    const tax = auction.taxAmount || Math.floor(gross * 0.1);
    const netSaved = auction.netSavedGold || 0;

    return NextResponse.json({
      success: true,
      message: netSaved > 0
        ? `🎉 경매가 종료되어 낙찰자 [${auction.highestBidderNickname || '없음'}]님이 확정되었습니다!\n• 최종 낙찰 금액 (인게임 지정 분배 입력 금액): ${gross.toLocaleString()} 금전\n• 세금 10%(-${tax.toLocaleString()} 금전) 공제 후 문파 창고 세이브 금액: +${netSaved.toLocaleString()} 금전`
        : `경매가 입찰자 없이 마감되었습니다.`,
      auction,
      treasuryGold: db.treasuryGold,
      goldLedger: db.goldLedger
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
