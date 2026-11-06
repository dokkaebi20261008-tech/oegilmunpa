'use client';

import { useState, useEffect } from 'react';
import { ShoppingBag, Plus, Sparkles, Shield, Package, CheckCircle, AlertCircle } from 'lucide-react';
import { ShopItem } from '@/lib/types';

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 관리자 신규 아이템 등록 모달
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('소모품');
  const [price, setPrice] = useState(500);
  const [currency, setCurrency] = useState<'문파재화' | '금전'>('문파재화');
  const [stock, setStock] = useState(50);
  const [submitting, setSubmitting] = useState(false);

  const fetchItems = () => {
    fetch('/api/shop', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setItems(d.items || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.authenticated) setCurrentUser(d.user);
      });
    fetchItems();
    const interval = setInterval(fetchItems, 4000);
    const handleFocus = () => fetchItems();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ADD',
          name,
          description,
          category,
          price,
          currency,
          stock
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '등록 실패');
        setSubmitting(false);
        return;
      }
      setIsAddModalOpen(false);
      setName('');
      setDescription('');
      fetchItems();
      alert('🎉 신규 상점 물품이 성공적으로 등록되었습니다!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handlePurchase = async (item: ShopItem) => {
    if (!currentUser) {
      alert('상점 아이템 구매는 정회원 로그인 후 가능합니다.');
      window.location.href = '/login';
      return;
    }

    if (!confirm(`'${item.name}' (${item.price.toLocaleString()} ${item.currency})을(를) 구매 신청하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'PURCHASE',
          itemId: item.id
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '구매 실패');
        return;
      }
      alert(data.message);
      fetchItems();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <ShoppingBag className="w-7 h-7 text-amber-400" />
            <span>외길 문파 상점</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            문파 컨텐츠 완료 시 획득한 문파 재화 및 금전으로 유용한 아이템을 구매하고 분배할 수 있습니다.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => setIsAddModalOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>상점 물품 추가 (관리자)</span>
          </button>
        )}
      </div>

      {/* Info Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center space-x-3 text-xs text-slate-300">
        <Sparkles className="w-5 h-5 text-amber-400 shrink-0" />
        <div>
          <span className="font-bold text-white">문파 재화 획득 안내: </span>
          요신 토벌령, 결계지 방어, 미혹의 정원, 신기 쟁탈전 완료 시 문파 전체에 재화가 적립되며, 문파원 누구나 필요한 비약과 강화 재료를 구매할 수 있습니다.
        </div>
      </div>

      {/* Item Grid */}
      {loading ? (
        <div className="text-center py-12 text-slate-400">상점 목록 불러오는 중...</div>
      ) : items.length === 0 ? (
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
          등록된 상점 아이템이 없습니다.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {items.map(item => (
            <div
              key={item.id}
              className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 shadow-lg flex flex-col justify-between hover:border-slate-700 transition-all"
            >
              <div>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                    {item.category}
                  </span>
                  <span className="text-xs text-slate-400 font-semibold">
                    잔여 재고: <span className="text-white">{item.stock}개</span>
                  </span>
                </div>

                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-900/60 to-slate-800 flex items-center justify-center text-amber-400 border border-slate-700 mb-3 shadow-inner">
                  <Package className="w-6 h-6" />
                </div>

                <h3 className="text-lg font-bold text-white leading-snug">{item.name}</h3>
                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{item.description}</p>

                <div className="mt-4 p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex items-center justify-between">
                  <span className="text-xs text-slate-400">구매 가격</span>
                  <span className="text-base font-black text-amber-300">
                    {item.price.toLocaleString()} {item.currency}
                  </span>
                </div>
              </div>

              <div className="mt-5">
                <button
                  onClick={() => handlePurchase(item)}
                  disabled={item.stock <= 0}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-md transition-all disabled:opacity-40"
                >
                  {item.stock <= 0 ? '품절' : '구매 신청하기'}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleAddItem}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>문파 상점 아이템 등록 (관리자)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">아이템 이름</label>
              <input
                type="text"
                required
                placeholder="예: 용맹의 비약"
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">상세 설명</label>
              <textarea
                rows={2}
                placeholder="아이템 효과 및 용도 설명"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">카테고리</label>
                <select
                  value={category}
                  onChange={e => setCategory(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="소모품">소모품</option>
                  <option value="장비">장비</option>
                  <option value="특수">특수</option>
                  <option value="기타">기타</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">화폐 단위</label>
                <select
                  value={currency}
                  onChange={e => setCurrency(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                >
                  <option value="문파재화">문파재화</option>
                  <option value="금전">금전</option>
                  <option value="용맹의증표">용맹의증표</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">가격</label>
                <input
                  type="number"
                  required
                  value={price}
                  onChange={e => setPrice(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">준비 수량</label>
                <input
                  type="number"
                  required
                  value={stock}
                  onChange={e => setStock(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md"
              >
                {submitting ? '등록 중...' : '상점에 등록'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
