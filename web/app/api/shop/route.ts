import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
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

  const db = getDb();
  return NextResponse.json({
    success: true,
    items: db.shopItems || [],
    members: db.members || []
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
    const db = getDb();

    // 1. 내 캐릭터(또는 지정 닉네임)로 상품 구매 희망 신청 / 취소 토글
    if (action === 'TOGGLE_APPLICANT') {
      const { itemId, nickname } = body;
      const targetName = (nickname || user.nickname || '').trim();
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }
      if (!Array.isArray(item.applicants)) item.applicants = [];

      const exists = item.applicants.includes(targetName);
      if (exists) {
        item.applicants = item.applicants.filter(n => n !== targetName);
      } else {
        item.applicants.push(targetName);
      }
      saveDb(db);
      return NextResponse.json({
        success: true,
        applied: !exists,
        item,
        items: db.shopItems
      });
    }

    // 2. 특정 문파원을 해당 상품 희망자에 직접 추가
    if (action === 'ADD_APPLICANT') {
      const { itemId, nickname } = body;
      const targetName = (nickname || '').trim();
      if (!targetName) {
        return NextResponse.json({ success: false, message: '추가할 문파원 닉네임을 입력해주세요.' }, { status: 400 });
      }
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }
      if (!Array.isArray(item.applicants)) item.applicants = [];
      if (!item.applicants.includes(targetName)) {
        item.applicants.push(targetName);
        saveDb(db);
      }
      return NextResponse.json({
        success: true,
        item,
        items: db.shopItems
      });
    }

    // 3. 특정 문파원을 해당 상품 희망자에서 제거
    if (action === 'REMOVE_APPLICANT') {
      const { itemId, nickname } = body;
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }
      if (Array.isArray(item.applicants)) {
        item.applicants = item.applicants.filter(n => n !== nickname);
        saveDb(db);
      }
      return NextResponse.json({
        success: true,
        item,
        items: db.shopItems
      });
    }

    // 4. 상품 희망자 명단 초기화
    if (action === 'RESET_APPLICANTS') {
      db.shopItems.forEach(item => {
        item.applicants = [];
      });
      saveDb(db);
      return NextResponse.json({
        success: true,
        items: db.shopItems
      });
    }

    // 5. 문파 상점 '전설 도안 선택 상자'로 즉시 30분 경매 시작하기
    if (action === 'START_AUCTION_FROM_SHOP') {
      const { itemId, startingBid, minBidIncrement } = body;
      const item = db.shopItems.find(i => i.id === itemId) || db.shopItems[0];
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }

      const sBid = parseInt(String(startingBid), 10);
      const mInc = parseInt(String(minBidIncrement), 10);

      if (!sBid || sBid <= 0 || !mInc || mInc <= 0) {
        return NextResponse.json({
          success: false,
          message: '최소 구매 입찰가(시작가)와 최소 입찰 단위(호가)를 올바르게 입력해주세요.'
        }, { status: 400 });
      }

      const now = new Date();
      // 상품 1개당 경매 종료 타이머 30분 고정
      const endsAt = new Date(now.getTime() + 30 * 60 * 1000).toISOString();
      const applicantsText =
        item.applicants && item.applicants.length > 0
          ? `구매 희망자(${item.applicants.length}명): ${item.applicants.join(', ')}`
          : '문파 상점 전설 도안 선택 상자';

      const newAuction = {
        id: `auc_${Date.now()}`,
        title: item.name,
        description: `[문파 상점 경매] ${applicantsText} • 시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전 • 30분 타이머 종료 시 최고 입찰자 닉네임이 공개됩니다.`,
        imageUrl: item.imageUrl || '/images/shop-weapon.png',
        startingBid: sBid,
        minBidIncrement: mInc,
        currentBid: sBid,
        status: 'ACTIVE' as const,
        bidsCount: 0,
        endsAt,
        createdAt: now.toISOString()
      };

      // 주간 한정 카운트 업데이트 표시 (예: (1/10))
      if (item.stock > 0) {
        item.stock -= 1;
        const used = (item.maxStock || 10) - item.stock;
        item.weeklyLimit = `문파 주간 한정: (${used}/${item.maxStock || 10})`;
      }

      db.auctions.unshift(newAuction);
      saveDb(db);

      return NextResponse.json({
        success: true,
        message: `[${item.name}] 30분 경매가 오픈되었습니다! (최소 입찰가 ${sBid.toLocaleString()} 금전 / 호가 단위 +${mInc.toLocaleString()} 금전)`,
        auction: newAuction
      });
    }

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
