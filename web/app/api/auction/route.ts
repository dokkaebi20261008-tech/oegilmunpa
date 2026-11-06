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
    if (user?.role !== 'ADMIN') {
      return NextResponse.json({ success: false, message: '경매 물품 등록은 문파장/관리자만 가능합니다.' }, { status: 403 });
    }

    const { title, description, startingBid, minBidIncrement, durationHours } = await req.json();

    if (!title || !startingBid || !minBidIncrement) {
      return NextResponse.json({ success: false, message: '물품명, 시작 입찰가, 최소 호가 단위를 입력해주세요.' }, { status: 400 });
    }

    const sBid = parseInt(startingBid, 10);
    const mInc = parseInt(minBidIncrement, 10);
    const hours = parseInt(durationHours || '72', 10);

    if (sBid <= 0 || mInc <= 0) {
      return NextResponse.json({ success: false, message: '금액은 0보다 커야 합니다.' }, { status: 400 });
    }

    const db = getDb();
    const now = new Date();
    const endsAt = new Date(now.getTime() + hours * 3600000).toISOString();

    const newAuction = {
      id: `auc_${Date.now()}`,
      title: title.trim(),
      description: description ? description.trim() : '',
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
