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
  // 활성 경매 우선 정렬
  const auctions = [...db.auctions].sort((a, b) => {
    if (a.status === 'ACTIVE' && b.status !== 'ACTIVE') return -1;
    if (a.status !== 'ACTIVE' && b.status === 'ACTIVE') return 1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

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

    const { title, description, imageUrl, startingBid, minBidIncrement, durationHours } = await req.json();

    if (!title || !startingBid || !minBidIncrement) {
      return NextResponse.json({ success: false, message: '물품명, 최소 시작 입찰가, 최소 호가 단위를 입력해주세요.' }, { status: 400 });
    }

    const sBid = parseInt(String(startingBid), 10);
    const mInc = parseInt(String(minBidIncrement), 10);
    const hours = parseInt(String(durationHours || '72'), 10);

    if (sBid <= 0 || mInc <= 0) {
      return NextResponse.json({ success: false, message: '금액은 0보다 커야 합니다.' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date();
    const endsAt = new Date(now.getTime() + hours * 3600000).toISOString();

    // 물품명에 맞는 기본 아이콘 자동 매칭
    let resolvedImage = imageUrl;
    if (!resolvedImage) {
      if (title.includes('방어구')) resolvedImage = '/images/shop-armor.png';
      else if (title.includes('장신구') || title.includes('어금니')) resolvedImage = '/images/shop-acc.png';
      else resolvedImage = '/images/shop-weapon.png';
    }

    const newAuction = {
      id: `auc_${Date.now()}`,
      title: title.trim(),
      description: description ? description.trim() : `시작 입찰가 ${sBid.toLocaleString()} 금전 / 최소 호가 단위 +${mInc.toLocaleString()} 금전`,
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
    saveDb(db);

    return NextResponse.json({
      success: true,
      auction: newAuction
    });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
