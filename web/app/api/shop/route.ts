import { NextResponse } from 'next/server';
import {
  getDb,
  saveDb,
  getKSTDateStr,
  getKSTWednesdaySchedule,
  checkAndFinalizeExpiredAuctions,
  activateScheduledAuction,
  maskAuctionForClient
} from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { isManagerRole, getRoleLabel } from '@/lib/types';

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
  const wednesdaySchedule = getKSTWednesdaySchedule();

  return NextResponse.json({
    success: true,
    todayKST: getKSTDateStr(),
    wednesdaySchedule,
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
    const wednesdaySchedule = getKSTWednesdaySchedule();

    // 1. 문주 / 부문주 전용: 문파 재화 '용맹의 증표' 업데이트 (전체 공개 내역 기록)
    if (action === 'UPDATE_GUILD_TOKENS') {
      if (!isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문주 또는 부문주만 용맹의 증표를 업데이트할 수 있습니다.' }, { status: 403 });
      }
      const rawBal = body.newBalance !== undefined ? body.newBalance : body.guildTokens;
      const parsedBalance = parseInt(String(rawBal), 10);
      if (isNaN(parsedBalance) || parsedBalance < 0) {
        return NextResponse.json({ success: false, message: '유효한 용맹의 증표 수량(0 이상)을 입력해주세요.' }, { status: 400 });
      }

      const prevBalance = db.guildTokens || 0;
      const delta = parsedBalance - prevBalance;
      db.guildTokens = parsedBalance;

      const roleName = getRoleLabel(user.role);
      const cleanMemo = String(body.memo || body.reason || '').trim() || `${roleName} 용맹의 증표 보유량 업데이트`;
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

    // 2. 내 캐릭터로 상품 구매 희망 신청 / 취소 토글
    // 매주 수요일 19:00:00 ~ 23:59:59 에 희망 신청 오픈 (목요일 00:00:00 희망 신청 마감)
    // 최초 신청자 발생 시 10분 뒤 자동 경매 시작 -> 30분간 진행 후 자동 종료 및 재신청 가능!
    if (action === 'TOGGLE_APPLICANT') {
      // 이미 본 경매(ACTIVE)가 진행 중인 경우 경매 종료 후 신청 안내
      const activeAuc = db.auctions.find(a => a.status === 'ACTIVE');
      if (activeAuc) {
        return NextResponse.json({
          success: false,
          message: '현재 경매가 진행 중입니다. 경매 종료 후 구매 희망을 신청할 수 있습니다.'
        }, { status: 400 });
      }

      const isAdminOverride = Boolean(body.forceAdminTest && isManagerRole(user.role));
      if (!wednesdaySchedule.isShopOpen && !isAdminOverride) {
        return NextResponse.json({
          success: false,
          message: `구매 희망 신청은 매주 수요일 오후 7시에 오픈됩니다.`
        }, { status: 400 });
      }

      const { itemId } = body;
      const targetName = (user.nickname || '').trim();
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }
      if (!Array.isArray(item.applicants)) item.applicants = [];

      // 다중 경매 방지: 다른 아이템이 이미 경매 대기(SCHEDULED) 중이면 차단
      let scheduledAuc = db.auctions.find(a => a.status === 'SCHEDULED');
      if (scheduledAuc && item.activeAuctionId && scheduledAuc.id !== item.activeAuctionId) {
        return NextResponse.json({
          success: false,
          message: '현재 다른 상품의 경매 시작 대기가 진행 중입니다. 경매 종료 후 신청할 수 있습니다.'
        }, { status: 400 });
      }

      const exists = item.applicants.includes(targetName);

      if (exists) {
        item.applicants = item.applicants.filter(n => n !== targetName);
      } else {
        item.applicants.push(targetName);
      }

      if (item.applicants.length > 0) {
        if (!scheduledAuc) {
          // 최초 희망 신청 시점으로부터 10분 후 자동 경매 시작, 시작 후 30분간 진행 (진행 중 자정이 지나더라도 마감 시간 보장)
          const nowMs = Date.now();
          const startMs = nowMs + 10 * 60 * 1000;
          const finalEndMs = startMs + 30 * 60 * 1000;

          scheduledAuc = {
            id: `auc_${nowMs}`,
            title: item.name,
            description: `[수요일 자동 경매] 구매 희망 신청 10분 후 자동 시작 • 30분간 익명 경매 진행`,
            imageUrl: '/images/shop-weapon.png',
            startingBid: item.minStartBid || 20000,
            minBidIncrement: item.bidStep || 500,
            currentBid: item.minStartBid || 20000,
            status: 'SCHEDULED',
            scheduledStartAt: new Date(startMs).toISOString(),
            applicants: [...item.applicants],
            bidsCount: 0,
            endsAt: new Date(finalEndMs).toISOString(),
            createdAt: new Date(nowMs).toISOString()
          };
          db.auctions.unshift(scheduledAuc);
          item.activeAuctionId = scheduledAuc.id;
        } else {
          // 기존 10분 타이머 유지하면서 신청자 순번 명단만 갱신
          scheduledAuc.applicants = [...item.applicants];
        }
      } else if (scheduledAuc) {
        // 대기 중 전원이 신청을 취소한 경우 예정 경매 취소 및 타이머 초기화
        db.auctions = db.auctions.filter(a => a.id !== scheduledAuc!.id);
        item.activeAuctionId = undefined;
      }

      const myOrder = item.applicants.indexOf(targetName) + 1;

      await saveDb(db);
      return NextResponse.json({
        success: true,
        applied: !exists,
        myOrder: !exists ? myOrder : 0,
        item,
        items: db.shopItems,
        wednesdaySchedule,
        auctions: db.auctions.map(maskAuctionForClient),
        message: !exists
          ? `${myOrder}번 순번으로 구매 희망 신청이 완료되었습니다! 대기시간(10분) 종료 후 자동으로 30분 익명 경매가 시작됩니다.`
          : '구매 희망 신청이 취소되었습니다.'
      });
    }

    // 3. 문주 / 부문주 전용: 경매 최소 입찰가 / 호가 단위 설정 변경
    if (action === 'UPDATE_AUCTION_CONFIG') {
      if (!isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문주 또는 부문주 권한이 필요합니다.' }, { status: 403 });
      }
      const { startingBid, minBidIncrement } = body;
      const sBid = parseInt(String(startingBid), 10);
      const mInc = parseInt(String(minBidIncrement), 10);
      if (!sBid || sBid <= 0 || !mInc || mInc <= 0) {
        return NextResponse.json({ success: false, message: '올바른 시작가와 호가 단위를 입력해주세요.' }, { status: 400 });
      }
      if (db.shopItems[0]) {
        db.shopItems[0].minStartBid = sBid;
        db.shopItems[0].bidStep = mInc;
      }
      const targetAuc = db.auctions.find(a => a.status === 'SCHEDULED' || (a.status === 'ACTIVE' && a.bidsCount === 0));
      if (targetAuc) {
        targetAuc.startingBid = sBid;
        targetAuc.minBidIncrement = mInc;
        if (targetAuc.bidsCount === 0) {
          targetAuc.currentBid = sBid;
        }
      }
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: `경매 최소 입찰가(${sBid.toLocaleString()}G) 및 최소 호가 단위(+${mInc.toLocaleString()}G)가 반영되었습니다.`,
        items: db.shopItems,
        auctions: db.auctions.map(maskAuctionForClient)
      });
    }

    // 4. 문주 / 부문주 전용: 대기 중인 경매를 즉시 본 경매(ACTIVE 30분)로 전환하거나 신규 오픈
    if (action === 'START_AUCTION_FROM_SHOP') {
      if (!isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문주 또는 부문주만 즉시 경매를 개시할 수 있습니다.' }, { status: 403 });
      }
      const existingActive = db.auctions.find(a => a.status === 'ACTIVE');
      if (existingActive) {
        return NextResponse.json({
          success: false,
          message: '현재 이미 진행 중인 경매가 있습니다. 경매 종료 후 새 경매를 시작할 수 있습니다.'
        }, { status: 400 });
      }

      const { itemId, startingBid, minBidIncrement } = body;
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }

      const sBid = parseInt(String(startingBid), 10) || item.minStartBid || 20000;
      const mInc = parseInt(String(minBidIncrement), 10) || item.bidStep || 500;
      item.minStartBid = sBid;
      item.bidStep = mInc;

      let targetAuc = db.auctions.find(a => a.status === 'SCHEDULED');
      if (!targetAuc) {
        const nowMs = Date.now();
        targetAuc = {
          id: `auc_${nowMs}`,
          title: item.name,
          description: `[문파 상점 경매] 경매 최소 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 종료 즉시 낙찰자 및 최종 낙찰금액이 공개됩니다.`,
          imageUrl: '/images/shop-weapon.png',
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

      activateScheduledAuction(db, targetAuc, true);
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

    // 5. 문주 / 부문주 전용: 희망 신청 마감 잠금 해제
    if (action === 'UNLOCK_DAILY_SHOP') {
      if (!isManagerRole(user.role)) {
        return NextResponse.json({ success: false, message: '문주 또는 부문주 권한이 필요합니다.' }, { status: 403 });
      }
      db.shopItems.forEach(item => {
        item.dailyLockedDate = undefined;
        item.applicants = [];
      });
      await saveDb(db);
      return NextResponse.json({
        success: true,
        message: '구매 희망 신청 마감 잠금이 해제되었습니다.',
        items: db.shopItems
      });
    }

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
