import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { LadderRung, LadderItemOption, LadderState } from '@/lib/types';

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
    ladderState: db.ladderState || null,
    ladderHistory: db.ladderHistory || [],
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
      const item = db.shopItems.find(i => i.id === itemId);
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
      const item = db.shopItems.find(i => i.id === itemId);
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
      const item = db.shopItems.find(i => i.id === itemId);
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

    // 4. 전체 상품 희망자 명단 초기화
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

    // 5. 사다리 타기 실행 (전설 도안 선택 상자 희망자 추첨 또는 부위 추첨, 전 문파원 실시간 결과 공유)
    if (action === 'RUN_LADDER') {
      const { ladderMode = 'APPLICANTS', startCol } = body;
      const unifiedItem = db.shopItems[0];
      const applicants = unifiedItem?.applicants || [];

      let ladderCandidates: LadderItemOption[] = [];

      if (ladderMode === 'APPLICANTS' && applicants.length >= 2) {
        // 희망 신청한 문파원(닉네임)별로 사다리 하단 슬롯 구성
        const icons = ['/images/shop-weapon.png', '/images/shop-armor.png', '/images/shop-acc.png'];
        ladderCandidates = applicants.map((nick, idx) => ({
          itemId: unifiedItem.id,
          name: `전설 도안 선택 상자 (${nick})`,
          imageUrl: icons[idx % icons.length],
          applicants: [nick]
        }));
      } else {
        // 희망자가 2명 미만이거나 부위 추첨 모드일 경우 3열 전설 도안 선택 상자(무기/방어구/장신구 통합) 슬롯 구성
        ladderCandidates = [
          {
            itemId: unifiedItem?.id || 'shop_1',
            name: '전설 도안 선택 상자 (무기)',
            imageUrl: '/images/shop-weapon.png',
            applicants
          },
          {
            itemId: unifiedItem?.id || 'shop_1',
            name: '전설 도안 선택 상자 (방어구)',
            imageUrl: '/images/shop-armor.png',
            applicants
          },
          {
            itemId: unifiedItem?.id || 'shop_1',
            name: '전설 도안 선택 상자 (장신구)',
            imageUrl: '/images/shop-acc.png',
            applicants
          }
        ];
      }

      // 하단 상품 순서 무작위 셔플 (Fisher-Yates)
      const bottomItems = [...ladderCandidates];
      for (let i = bottomItems.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bottomItems[i], bottomItems[j]] = [bottomItems[j], bottomItems[i]];
      }

      const numCols = bottomItems.length;
      const totalSteps = 8;
      const rungs: LadderRung[] = [];

      // 각 가로 단계(1..totalSteps)별로 인접한 가로줄이 겹치지 않도록 사다리 가로줄 생성
      for (let r = 1; r <= totalSteps; r++) {
        let c = 0;
        while (c < numCols - 1) {
          if (Math.random() < 0.55) {
            rungs.push({ col: c, row: r });
            c += 2; // 인접 열 동시 가로줄 방지
          } else {
            c += 1;
          }
        }
      }

      // 각 열 사이에 최소 1개 이상의 가로줄이 있도록 보장
      for (let gap = 0; gap < numCols - 1; gap++) {
        const hasRung = rungs.some(rg => rg.col === gap);
        if (!hasRung) {
          // 비어있는 행 찾아서 추가
          for (let r = 1; r <= totalSteps; r++) {
            const conflict = rungs.some(rg => rg.row === r && Math.abs(rg.col - gap) <= 1);
            if (!conflict) {
              rungs.push({ col: gap, row: r });
              break;
            }
          }
        }
      }

      // 출발 열 결정 (지정된 출발 번호가 있으면 사용, 없으면 무작위)
      const chosenStartCol =
        typeof startCol === 'number' && startCol >= 0 && startCol < numCols
          ? startCol
          : Math.floor(Math.random() * numCols);

      // 사다리 경로 추적 계산
      let curCol = chosenStartCol;
      const path: { col: number; row: number }[] = [{ col: curCol, row: 0 }];

      for (let r = 1; r <= totalSteps; r++) {
        path.push({ col: curCol, row: r });
        const rightRung = rungs.find(rg => rg.row === r && rg.col === curCol);
        const leftRung = rungs.find(rg => rg.row === r && rg.col === curCol - 1);

        if (rightRung) {
          curCol += 1;
          path.push({ col: curCol, row: r });
        } else if (leftRung) {
          curCol -= 1;
          path.push({ col: curCol, row: r });
        }
      }

      path.push({ col: curCol, row: totalSteps + 1 });

      const winningBottomCol = curCol;
      const winnerItem = bottomItems[winningBottomCol];
      const startLabels = Array.from({ length: numCols }, (_, idx) => `${idx + 1}번 사다리`);

      const newLadder: LadderState = {
        id: `ladder_${Date.now()}`,
        createdAt: new Date().toISOString(),
        executedBy: user.nickname,
        numCols,
        totalSteps,
        startLabels,
        bottomItems,
        rungs,
        chosenStartCol,
        winningBottomCol,
        path,
        winnerItem
      };

      db.ladderState = newLadder;
      if (!Array.isArray(db.ladderHistory)) db.ladderHistory = [];
      db.ladderHistory.unshift(newLadder);
      if (db.ladderHistory.length > 10) {
        db.ladderHistory = db.ladderHistory.slice(0, 10);
      }

      saveDb(db);

      return NextResponse.json({
        success: true,
        ladderState: newLadder,
        ladderHistory: db.ladderHistory
      });
    }

    // 6. 뽑힌 상점 상품으로 즉시 경매 시작하기 (최소 구매 입찰가 & 최소 입찰 호가 단위 설정)
    if (action === 'START_AUCTION_FROM_SHOP') {
      const { itemId, startingBid, minBidIncrement, durationHours } = body;
      const item = db.shopItems.find(i => i.id === itemId);
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 상점 상품입니다.' }, { status: 404 });
      }

      const sBid = parseInt(String(startingBid), 10);
      const mInc = parseInt(String(minBidIncrement), 10);
      const hours = parseInt(String(durationHours || '24'), 10);

      if (!sBid || sBid <= 0 || !mInc || mInc <= 0) {
        return NextResponse.json({
          success: false,
          message: '최소 구매 입찰가(시작가)와 최소 입찰 단위(호가)를 올바르게 입력해주세요.'
        }, { status: 400 });
      }

      const now = new Date();
      const endsAt = new Date(now.getTime() + hours * 3600000).toISOString();
      const applicantsText =
        item.applicants && item.applicants.length > 0
          ? `구매 희망자(${item.applicants.length}명): ${item.applicants.join(', ')}`
          : '문파 상점 추첨 상품';

      const newAuction = {
        id: `auc_${Date.now()}`,
        title: item.name,
        description: `[사다리 선정] ${applicantsText} • 시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전`,
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
      if (db.ladderState && db.ladderState.winnerItem.itemId === item.id) {
        db.ladderState.linkedAuctionId = newAuction.id;
      }

      saveDb(db);

      return NextResponse.json({
        success: true,
        message: `[${item.name}] 경매가 오픈되었습니다! (최소 입찰가 ${sBid.toLocaleString()} 금전 / 호가 단위 +${mInc.toLocaleString()} 금전)`,
        auction: newAuction
      });
    }

    return NextResponse.json({ success: false, message: '유효한 요청이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
