import { NextResponse } from 'next/server';
import { getDb, saveDb } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  const db = getDb();
  return NextResponse.json({
    success: true,
    items: db.shopItems || []
  });
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser(req);
    const body = await req.json();
    const { action } = body;

    const db = getDb();

    if (action === 'ADD') {
      if (user?.role !== 'ADMIN') {
        return NextResponse.json({ success: false, message: '상점 물품 등록은 관리자만 가능합니다.' }, { status: 403 });
      }

      const { name, description, category, price, currency, stock, icon } = body;
      if (!name || !price) {
        return NextResponse.json({ success: false, message: '아이템명과 가격을 입력해주세요.' }, { status: 400 });
      }

      const newItem = {
        id: `shop_${Date.now()}`,
        name: name.trim(),
        description: description ? description.trim() : '',
        category: category || '일반',
        price: parseInt(price, 10),
        currency: currency || '문파재화',
        stock: parseInt(stock || '99', 10),
        icon: icon || 'package',
        createdAt: new Date().toISOString()
      };

      db.shopItems.push(newItem);
      saveDb(db);

      return NextResponse.json({ success: true, item: newItem });
    }

    if (action === 'PURCHASE') {
      if (!user) {
        return NextResponse.json({ success: false, message: '로그인 후 구매 신청이 가능합니다.' }, { status: 401 });
      }

      const { itemId } = body;
      const item = db.shopItems.find(i => i.id === itemId);
      if (!item) {
        return NextResponse.json({ success: false, message: '존재하지 않는 아이템입니다.' }, { status: 404 });
      }

      if (item.stock <= 0) {
        return NextResponse.json({ success: false, message: '재고가 부족합니다.' }, { status: 400 });
      }

      const newPurchase = {
        id: `pur_${Date.now()}`,
        itemId: item.id,
        itemName: item.name,
        buyerNickname: user.nickname,
        buyerId: user.userId,
        price: item.price,
        currency: item.currency,
        status: 'PENDING' as const,
        createdAt: new Date().toISOString()
      };

      item.stock -= 1;
      db.purchases.push(newPurchase);
      saveDb(db);

      return NextResponse.json({
        success: true,
        message: `'${item.name}' 구매 신청이 완료되었습니다. 관리자 확인 후 지급됩니다.`,
        purchase: newPurchase
      });
    }

    return NextResponse.json({ success: false, message: '유효한 action이 아닙니다.' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
