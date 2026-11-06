import { NextResponse } from 'next/server';
import { getDb, saveDb, activateScheduledAuction, finalizeSingleAuction } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await getCurrentUser(req);
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '경매 진행/마감 제어는 문파장(어드민)만 가능합니다.' }, { status: 403 });
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
      activateScheduledAuction(db, auction);
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '30분 대기를 종료하고 즉시 30분 익명 경매가 시작되었습니다! (당일 추가 희망 신청 마감 및 용맹의 증표 차감 완료)',
        auction,
        guildTokens: db.guildTokens,
        tokenLedger: db.tokenLedger
      });
    }

    if (auction.status === 'ENDED') {
      return NextResponse.json({ success: false, message: '이미 마감된 경매입니다.' }, { status: 400 });
    }

    // 만약 대기 중(SCHEDULED)에서 바로 마감 누른 경우 먼저 차감 처리 후 마감
    if (auction.status === 'SCHEDULED') {
      activateScheduledAuction(db, auction);
    }

    finalizeSingleAuction(db, auction);
    await saveDb(db);

    const gross = auction.grossBid || auction.currentBid || 0;
    const tax = auction.taxAmount || Math.floor(gross * 0.1);
    const netSaved = auction.netSavedGold || 0;

    return NextResponse.json({
      success: true,
      message: netSaved > 0
        ? `경매가 마감되어 최고 입찰자(${auction.highestBidderNickname || '없음'})가 공개되었습니다! 인게임 지정 분배 낙찰가 ${gross.toLocaleString()} 금전에서 세금 10%(${tax.toLocaleString()} 금전)를 제외한 ${netSaved.toLocaleString()} 금전이 문파 창고에 세이브되었습니다.`
        : `경매가 입찰자 없이 마감되었습니다.`,
      auction,
      treasuryGold: db.treasuryGold,
      goldLedger: db.goldLedger
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
