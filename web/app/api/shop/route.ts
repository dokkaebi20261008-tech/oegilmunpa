import { NextResponse } from 'next/server';
import {
  getDb,
  saveDb,
  getKSTDateStr,
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
  await checkAndFinalizeExpiredAuctions(db);

  return NextResponse.json({
    success: true,
    todayKST: getKSTDateStr(),
    items: db.shopItems || [],
    members: db.members || [],
    guildTokens: db.guildTokens || 0,
    tokenLedger: db.tokenLedger || [],
    auctions: (db.auctions || []).map(maskAuctionForClient)
  });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    if (!user) {
      return NextResponse.json({ success: false, message: '정회원 로그인 후 이용 가능합니다.' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;
    const db = await getDb();
    await checkAndFinalizeExpiredAuctions(db);
    const todayKST = getKSTDateStr();

    // 1. 문파장(어드민) 문파 재화 '용맹의 증표' 업데이트 (전체 공개 내역 기록)
    if (action === 'UPDATE_GUILD_TOKENS') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: '문파장(어드민)만 용맹의 증표를 업데이트할 수 있습니다.' }, { status: 403 });
      }
      const { newBalance, memo } = body;
      const parsedBalance = parseInt(String(newBalance), 10);
      if (isNaN(parsedBalance) || parsedBalance < 0) {
        return NextResponse.json({ success: false, message: '유효한 용맹의 증표 수량(0 이상)을 입력해주세요.' }, { status: 400 });
      }

      const prevBalance = db.guildTokens || 0;
      const delta = parsedBalance - prevBalance;
      db.guildTokens = parsedBalance;

      const cleanMemo = String(memo || '').trim() || '문파장 용맹의 증표 보유량 업데이트';
      db.tokenLedger.unshift({
        id: `tok_${Date.now()}`,
        type: 'ADMIN_UPDATE',
        delta,
        balanceAfter: parsedBalance,
        description: `${cleanMemo} (${prevBalance.toLocaleString()} → ${parsedBalance.toLocaleString()})`,
        actorNickname: user.nickname,
        createdAt: new Date().toISOString()
      });

      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `문파 총 용맹의 증표가 ${parsedBalance.toLocaleString()}개로 업데이트되었으며 공개 내역에 기록되었습니다.`,
        guildTokens: db.guildTokens,
        tokenLedger: db.tokenLedger
      });
    }

    // 2. 내 캐릭터로 상품 구매 희망 신청 / 취소 토글 (첫 신청 순간 30분 경매 대기 타이머 자동 시작!)
    if (action === 'TOGGLE_APPLICANT') {
      const { itemId } = body;
      const targetName = (user.nickname || '').trim();
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }
      if (!Array.isArray(item.applicants)) item.applicants = [];

      const exists = item.applicants.includes(targetName);

      // 이미 30분 대기가 끝나 당일 마감된 경우 신청/취소 불가
      if (item.dailyLockedDate === todayKST) {
        return NextResponse.json({
          success: false,
          message: '금일 30분 구매 희망 신청 모집이 마감되어 당일 추가 희망 신청이 불가능합니다.'
        }, { status: 400 });
      }

      // 이미 본 경매(ACTIVE)가 진행 중인 경우 신청/취소 불가
      const activeAuc = db.auctions.find(a => a.status === 'ACTIVE');
      if (activeAuc) {
        return NextResponse.json({
          success: false,
          message: '현재 문파 익명 경매가 이미 진행 중이므로 희망 신청을 변경할 수 없습니다.'
        }, { status: 400 });
      }

      if (exists) {
        item.applicants = item.applicants.filter(n => n !== targetName);
      } else {
        item.applicants.push(targetName);
      }

      let scheduledAuc = db.auctions.find(a => a.status === 'SCHEDULED');

      if (item.applicants.length > 0) {
        if (!scheduledAuc) {
          // 최초 희망 신청 순간! -> 30분 경매 시작 대기 타이머 자동 시작 (30분 대기 + 30분 본 경매 = 총 1시간 자동화)
          const nowMs = Date.now();
          const scheduledStartAt = new Date(nowMs + 30 * 60 * 1000).toISOString();
          const endsAt = new Date(nowMs + 60 * 60 * 1000).toISOString();
          scheduledAuc = {
            id: `auc_${nowMs}`,
            title: item.name,
            description: `[자동 경매 파이프라인] 구매 희망 신청 30분 대기 후 30분간 익명 경매가 자동 진행됩니다. 종료 시 최고 입찰자 닉네임이 공개됩니다.`,
            imageUrl: item.imageUrl || '/images/shop-weapon.png',
            startingBid: 20000,
            minBidIncrement: 500,
            currentBid: 20000,
            status: 'SCHEDULED',
            scheduledStartAt,
            applicants: [...item.applicants],
            bidsCount: 0,
            endsAt,
            createdAt: new Date(nowMs).toISOString()
          };
          db.auctions.unshift(scheduledAuc);
          item.activeAuctionId = scheduledAuc.id;
        } else {
          scheduledAuc.applicants = [...item.applicants];
        }
      } else if (scheduledAuc) {
        // 대기 중 전원이 신청을 취소한 경우 대기 타이머 취소
        db.auctions = db.auctions.filter(a => a.id !== scheduledAuc!.id);
        item.activeAuctionId = undefined;
      }

      await saveDb(db);
      return NextResponse.json({
        success: true,
        applied: !exists,
        item,
        items: db.shopItems,
        auctions: db.auctions.map(maskAuctionForClient),
        message: !exists
          ? item.applicants.length === 1
            ? '구매 희망 신청이 완료되어 [30분 경매 시작 대기 타이머]가 자동 시작되었습니다! 30분 뒤 익명 경매(30분)가 자동 개시됩니다.'
            : '구매 희망 신청 명단에 추가되었습니다.'
          : '구매 희망 신청이 취소되었습니다.'
      });
    }

    // 3. 어드민: 대기 중인 경매의 최소 입찰가 / 호가 단위 설정 변경
    if (action === 'UPDATE_AUCTION_CONFIG') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: '문파장(어드민) 권한이 필요합니다.' }, { status: 403 });
      }
      const { startingBid, minBidIncrement } = body;
      const sBid = parseInt(String(startingBid), 10);
      const mInc = parseInt(String(minBidIncrement), 10);
      if (!sBid || sBid <= 0 || !mInc || mInc <= 0) {
        return NextResponse.json({ success: false, message: '올바른 시작가와 호가 단위를 입력해주세요.' }, { status: 400 });
      }
      const targetAuc = db.auctions.find(a => a.status === 'SCHEDULED' || (a.status === 'ACTIVE' && a.bidsCount === 0));
      if (targetAuc) {
        targetAuc.startingBid = sBid;
        targetAuc.minBidIncrement = mInc;
        if (targetAuc.bidsCount === 0) {
          targetAuc.currentBid = sBid;
        }
        await saveDb(db);
      }
      return NextResponse.json({
        success: true,
        message: `경매 최소 입찰가(${sBid.toLocaleString()}G) 및 최소 호가 단위(+${mInc.toLocaleString()}G)가 반영되었습니다.`,
        auctions: db.auctions.map(maskAuctionForClient)
      });
    }

    // 4. 어드민: 30분 대기 중인 경매를 즉시 본 경매(ACTIVE 30분)로 전환하거나 신규 오픈
    if (action === 'START_AUCTION_FROM_SHOP') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: '문파장(어드민)만 즉시 경매를 개시할 수 있습니다.' }, { status: 403 });
      }
      const { itemId, startingBid, minBidIncrement } = body;
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }

      const sBid = parseInt(String(startingBid), 10) || 20000;
      const mInc = parseInt(String(minBidIncrement), 10) || 500;

      let targetAuc = db.auctions.find(a => a.status === 'SCHEDULED');
      if (!targetAuc) {
        const nowMs = Date.now();
        targetAuc = {
          id: `auc_${nowMs}`,
          title: item.name,
          description: `[문파 상점 경매] 시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 30분 타이머 종료 시 최고 입찰자 닉네임이 공개됩니다.`,
          imageUrl: item.imageUrl || '/images/shop-weapon.png',
          startingBid: sBid,
          minBidIncrement: mInc,
          currentBid: sBid,
          status: 'SCHEDULED',
          scheduledStartAt: new Date(nowMs).toISOString(),
          applicants: [...(item.applicants || [])],
          bidsCount: 0,
          endsAt: new Date(nowMs + 30 * 60 * 1000).toISOString(),
          createdAt: new Date(nowMs).toISOString()
        };
        db.auctions.unshift(targetAuc);
        item.activeAuctionId = targetAuc.id;
      } else {
        targetAuc.startingBid = sBid;
        targetAuc.minBidIncrement = mInc;
        targetAuc.currentBid = sBid;
        targetAuc.scheduledStartAt = new Date().toISOString();
      }

      activateScheduledAuction(db, targetAuc);
      await saveDb(db);

      return NextResponse.json({
        success: true,
        message: `[${item.name}] 30분 익명 경매가 개시되었으며, 문파 총재화에서 ${item.price.toLocaleString()} 용맹의 증표가 자동 차감되었습니다!`,
        auction: maskAuctionForClient(targetAuc),
        items: db.shopItems,
        guildTokens: db.guildTokens,
        tokenLedger: db.tokenLedger
      });
    }

    // 5. 어드민: 당일 희망 신청 마감 잠금 해제 (필요 시 재오픈)
    if (action === 'UNLOCK_DAILY_SHOP') {
      if (user.role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: '문파장(어드민) 권한이 필요합니다.' }, { status: 403 });
      }
      db.shopItems.forEach(item => {
        item.dailyLockedDate = undefined;
        item.applicants = [];
      });
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '금일 구매 희망 신청 마감 잠금이 해제되어 다시 신청을 받을 수 있습니다.',
        items: db.shopItems
      });
    }

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
