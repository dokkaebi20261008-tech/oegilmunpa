'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Users,
  Gavel,
  CheckCircle2,
  Coins,
  UserPlus,
  Check,
  Clock,
  Lock,
  Unlock,
  History,
  Flame,
  ArrowRight,
  Settings,
  X,
  Trophy
} from 'lucide-react';
import { ShopItem, TokenLedgerEntry, AuctionItem, isManagerRole, getRoleLabel } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

function getClientKSTSchedule(nowMs: number) {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(nowMs + kstOffsetMs);
  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth();
  const date = kstNow.getUTCDate();
  const day = kstNow.getUTCDay(); // 0=일 ~ 3=수 ~ 6=토
  const hour = kstNow.getUTCHours();
  const minute = kstNow.getUTCMinutes();
  const second = kstNow.getUTCSeconds();

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const nowFormatted = `${year}.${String(month + 1).padStart(2, '0')}.${String(date).padStart(2, '0')} (${dayNames[day]}) ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  // 매주 수요일 19:00:00 ~ 19:29:59 상점 희망 신청 오픈
  const isShopOpen = day === 3 && hour === 19 && minute >= 0 && minute < 30;
  // 매주 수요일 19:30:00 ~ 19:59:59 익명 경매 진행
  const isAuctionWindow = day === 3 && hour === 19 && minute >= 30 && minute < 60;

  let daysUntilWed = 0;
  if (day === 3) {
    daysUntilWed = hour >= 20 ? 7 : 0;
  } else {
    daysUntilWed = (3 - day + 7) % 7;
  }

  const targetWedUTC = new Date(Date.UTC(year, month, date + daysUntilWed, 0, 0, 0));
  const wy = targetWedUTC.getUTCFullYear();
  const wm = targetWedUTC.getUTCMonth();
  const wd = targetWedUTC.getUTCDate();

  const shopOpenAtISO = new Date(Date.UTC(wy, wm, wd, 10, 0, 0)).toISOString();     // 수요일 19:00:00
  const auctionStartAtISO = new Date(Date.UTC(wy, wm, wd, 10, 30, 0)).toISOString(); // 수요일 19:30:00
  const auctionEndAtISO = new Date(Date.UTC(wy, wm, wd, 11, 0, 0)).toISOString();    // 수요일 20:00:00

  return {
    nowFormatted,
    isShopOpen,
    isAuctionWindow,
    shopOpenAtISO,
    auctionStartAtISO,
    auctionEndAtISO
  };
}

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [guildTokens, setGuildTokens] = useState<number>(0);
  const [tokenLedger, setTokenLedger] = useState<TokenLedgerEntry[]>([]);
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [todayKST, setTodayKST] = useState<string>('');
  const { currentUser, authChecking } = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // 어드민 전용 용맹의 증표 업데이트 입력 상태
  const [tokenInput, setTokenInput] = useState<string>('');
  const [tokenMemo, setTokenMemo] = useState<string>('');
  const [updatingToken, setUpdatingToken] = useState(false);

  // 어드민 전용 경매 최소 입찰가/호가 설정 모달
  const [auctionModalItem, setAuctionModalItem] = useState<ShopItem | null>(null);
  const [startingBid, setStartingBid] = useState<number>(20000);
  const [minBidIncrement, setMinBidIncrement] = useState<number>(500);
  const [creatingAuction, setCreatingAuction] = useState(false);

  const fetchShopData = () => {
    fetch('/api/shop', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setItems(d.items || []);
          setGuildTokens(d.guildTokens ?? 0);
          setTokenLedger(d.tokenLedger || []);
          setAuctions(d.auctions || []);
          setTodayKST(d.todayKST || '');
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchShopData();
    const interval = setInterval(fetchShopData, 3000);
    const handleFocus = () => fetchShopData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // 1초마다 한국 시간(KST) 및 수요일 19:30 / 20:00 자동 전환 트리거
  useEffect(() => {
    const timer = setInterval(() => {
      const cur = Date.now();
      setNowMs(cur);
      const shouldSync = auctions.some(
        a =>
          (a.status === 'SCHEDULED' && a.scheduledStartAt && new Date(a.scheduledStartAt).getTime() <= cur) ||
          (a.status === 'ACTIVE' && a.endsAt && new Date(a.endsAt).getTime() <= cur)
      );
      if (shouldSync) {
        fetchShopData();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auctions]);

  const formatRemainingTime = (targetIso?: string) => {
    if (!targetIso) return '00:00';
    const diffSec = Math.max(0, Math.floor((new Date(targetIso).getTime() - nowMs) / 1000));
    const days = Math.floor(diffSec / 86400);
    const hours = Math.floor((diffSec % 86400) / 3600);
    const mins = Math.floor((diffSec % 3600) / 60);
    const secs = diffSec % 60;
    if (days > 0) {
      return `${days}일 ${hours}시간 ${mins}분`;
    }
    if (hours > 0) {
      return `${hours}시간 ${String(mins).padStart(2, '0')}분 ${String(secs).padStart(2, '0')}초`;
    }
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDateTime = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleString('ko-KR', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return iso;
    }
  };

  // 문파장(어드민) 전용: 용맹의 증표 보유량 업데이트
  const handleUpdateGuildTokens = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseInt(tokenInput, 10);
    if (isNaN(num) || num < 0) {
      alert('유효한 용맹의 증표 수량(0 이상)을 입력해주세요.');
      return;
    }
    setUpdatingToken(true);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_GUILD_TOKENS',
          newBalance: num,
          memo: tokenMemo
        })
      });
      const d = await res.json();
      if (d.success) {
        setGuildTokens(d.guildTokens);
        setTokenLedger(d.tokenLedger || []);
        setTokenInput('');
        setTokenMemo('');
        alert(d.message);
      } else {
        alert(d.message || '업데이트 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setUpdatingToken(false);
    }
  };

  // 내 캐릭터로 구매 희망 신청 / 취소 토글 (매주 수요일 19:00 ~ 19:30 KST에만 가능)
  const handleToggleMyApplication = async (itemId: string) => {
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_APPLICANT', itemId })
      });
      const d = await res.json();
      if (!d.success) {
        alert(d.message || '신청 처리 실패');
        return;
      }
      setItems(d.items || []);
      if (d.auctions) setAuctions(d.auctions);
    } catch (err) {
      console.error(err);
    }
  };

  // 어드민 전용: 당일 희망 신청 마감 잠금 해제
  const handleUnlockDailyShop = async () => {
    if (!confirm('금일 구매 희망 신청 마감 잠금을 해제하시겠습니까?')) return;
    const res = await fetch('/api/shop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UNLOCK_DAILY_SHOP' })
    });
    const d = await res.json();
    if (d.success) {
      setItems(d.items || []);
      alert(d.message);
    }
  };

  // 어드민 전용: 경매 시작가/호가 설정 저장 또는 즉시 본 경매 시작
  const handleStartOrConfigAuction = async (e: React.FormEvent, startImmediately: boolean) => {
    e.preventDefault();
    if (!auctionModalItem) return;

    setCreatingAuction(true);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: startImmediately ? 'START_AUCTION_FROM_SHOP' : 'UPDATE_AUCTION_CONFIG',
          itemId: auctionModalItem.id,
          startingBid,
          minBidIncrement
        })
      });
      const d = await res.json();
      if (d.success) {
        alert(d.message);
        setAuctionModalItem(null);
        fetchShopData();
        if (startImmediately) {
          window.location.href = '/auction';
        }
      } else {
        alert(d.message || '설정 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingAuction(false);
    }
  };

  if (authChecking) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              정회원 전용 시스템
            </span>
            <h2 className="text-2xl font-black text-white">외길 문파 상점 & 용맹의 증표</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              문파 재화(용맹의 증표) 현황 및 상점 아이템 구매 희망 신청은<br />
              <strong>회원가입 후 관리자 승인을 받은 정회원</strong>만 이용하실 수 있습니다.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
            <Link
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all"
            >
              로그인 하기
            </Link>
            <Link
              href="/register"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all"
            >
              회원가입 요청
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const singleItem = items[0];
  const scheduledAuction = auctions.find(a => a.status === 'SCHEDULED');
  const activeAuction = auctions.find(a => a.status === 'ACTIVE');
  const latestEndedAuction = auctions.find(a => a.status === 'ENDED');
  const canManage = isManagerRole(currentUser?.role);
  const kstSched = getClientKSTSchedule(nowMs);

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-16">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900/75 border border-slate-800 rounded-2xl p-5 shadow-xl">
        <div className="space-y-1.5">
          <div className="inline-flex items-center space-x-2 px-2.5 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold">
            <span>📦 매주 수요일 상점 희망 신청 (19:00~19:30) & 정기 자동 경매 (19:30~20:00)</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white flex items-center space-x-2.5">
            <ShoppingBag className="w-6 h-6 text-amber-400 shrink-0" />
            <span>외길 문파 상점 & 용맹의 증표 관리소</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 leading-relaxed">
            <strong className="text-amber-300">매주 수요일 19:00:00 ~ 19:29:59</strong> 구매 희망 신청 ➔ 희망자 신청 시 <strong className="text-emerald-300">19:30:00 문파 경매장 자동 개시</strong> (19:59:59 입찰 마감) ➔ <strong className="text-indigo-300">20:00:00 경매 자동 종료 및 낙찰자·낙찰금액 즉시 공개</strong>
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <Link
            href="/auction"
            className="inline-flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs sm:text-sm shadow-lg shadow-amber-500/20 transition-all"
          >
            <Gavel className="w-4 h-4" />
            <span>문파 경매장 바로가기</span>
          </Link>
        </div>
      </div>

      {/* 1. 문파 재화: 용맹의 증표 현황 & 관리자 업데이트 카드 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className={`${canManage ? 'lg:col-span-5' : 'lg:col-span-12'} bg-gradient-to-br from-amber-950/40 via-slate-900/90 to-slate-900 border border-amber-500/35 rounded-2xl p-5 shadow-xl flex flex-col justify-between space-y-4`}>
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-300 uppercase tracking-wider flex items-center space-x-1.5 whitespace-nowrap">
                <Flame className="w-4 h-4 text-amber-400 shrink-0" />
                <span>문파 보유 총 재화 (정회원 공개)</span>
              </span>
              <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300 whitespace-nowrap shrink-0">
                용맹의 증표
              </span>
            </div>
            <div className="pt-2 flex items-baseline space-x-2">
              <span className="text-3xl sm:text-4xl font-black text-white tracking-tight">
                {guildTokens.toLocaleString()}
              </span>
              <span className="text-sm font-bold text-amber-400 whitespace-nowrap">용맹의 증표</span>
            </div>
          </div>

          <div className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 text-xs text-slate-300 space-y-1 leading-relaxed">
            <div>
              • 상점 상품 가격: <strong className="text-amber-300">11,500 용맹의 증표</strong>
            </div>
            <div>
              • 수요일 19:30:00 경매 개시 순간 <strong className="text-rose-300">문파 총재화 - 11,500 증표</strong>가 자동 차감되며 아래 공개 장부에 날짜별로 기록됩니다.
            </div>
          </div>
        </div>

        {canManage && (
          <form
            onSubmit={handleUpdateGuildTokens}
            className="lg:col-span-7 bg-slate-900/80 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5 flex flex-col justify-between"
          >
            <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
              <h2 className="text-sm font-extrabold text-white flex items-center space-x-2 whitespace-nowrap">
                <Coins className="w-4 h-4 text-amber-400 shrink-0" />
                <span>문주/부문주 전용: 문파 총 [용맹의 증표] 업데이트</span>
              </h2>
              <span className="px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-[11px] text-amber-300 font-bold whitespace-nowrap shrink-0">
                {getRoleLabel(currentUser?.role)} 권한
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 whitespace-nowrap">
                  현재 문파 보유 총 용맹의 증표 수량 입력
                </label>
                <input
                  type="number"
                  min={0}
                  required
                  placeholder={`현재: ${guildTokens.toLocaleString()}`}
                  value={tokenInput}
                  onChange={e => setTokenInput(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1 whitespace-nowrap">
                  업데이트 사유 / 메모 (공개 내역 표시)
                </label>
                <input
                  type="text"
                  placeholder="예: 주간 문파 컨텐츠 용맹의 증표 정산 반영"
                  value={tokenMemo}
                  onChange={e => setTokenMemo(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs sm:text-sm text-white focus:outline-none focus:border-amber-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between gap-2 pt-1">
              <div className="flex flex-wrap gap-1.5">
                {[11500, 23000, 50000, 100000].map(preset => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setTokenInput(String(preset))}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300 whitespace-nowrap"
                  >
                    {preset.toLocaleString()}
                  </button>
                ))}
              </div>
              <button
                type="submit"
                disabled={updatingToken}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md transition-all disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                {updatingToken ? '반영 중...' : '용맹의 증표 보유량 업데이트'}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* 2. 매주 수요일 정기 스케줄 진행 현황 */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-lg space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <span className="text-xs sm:text-sm font-extrabold text-white flex items-center space-x-2">
            <Clock className="w-4 h-4 text-amber-400 shrink-0" />
            <span>매주 수요일 정기 상점 & 경매 자동화 일정</span>
          </span>
          <span className="text-xs font-bold text-amber-300 bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 whitespace-nowrap shrink-0">
            현재 시각: {kstSched.nowFormatted}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 text-xs">
          <div
            className={`p-3 rounded-xl border ${
              kstSched.isShopOpen
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-200 shadow-lg shadow-emerald-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-black text-white flex items-center justify-between gap-1.5">
              <span className="whitespace-nowrap">1. 희망 신청 오픈</span>
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap shrink-0">수 19:00 ~ 19:30</span>
            </div>
            <div className="text-[11px] mt-1 whitespace-nowrap">
              {kstSched.isShopOpen ? '🟢 현재 구매 희망 신청 가능!' : '수요일 19:00:00 ~ 19:29:59'}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              scheduledAuction
                ? 'bg-amber-500/20 border-amber-400 text-amber-200 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-black text-white flex items-center justify-between gap-1.5">
              <span className="whitespace-nowrap">2. 경매 시작 대기</span>
              <span className="text-[10px] font-bold text-amber-300 whitespace-nowrap shrink-0">~ 19:30:00</span>
            </div>
            <div className="text-[11px] mt-1 whitespace-nowrap">
              {scheduledAuction
                ? `개시까지 ${formatRemainingTime(scheduledAuction.scheduledStartAt)}`
                : '희망자 있을 시 19:30:00 자동 개시'}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              activeAuction || kstSched.isAuctionWindow
                ? 'bg-indigo-500/20 border-indigo-400 text-indigo-200 shadow-lg shadow-indigo-500/10'
                : 'bg-slate-950/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-black text-white flex items-center justify-between gap-1.5">
              <span className="whitespace-nowrap">3. 자동 익명 경매</span>
              <span className="text-[10px] font-bold text-indigo-300 whitespace-nowrap shrink-0">19:30 ~ 19:59:59</span>
            </div>
            <div className="text-[11px] mt-1 whitespace-nowrap">
              {activeAuction
                ? `🔥 종료까지 ${formatRemainingTime(activeAuction.endsAt)}`
                : '19:30:00 개시 시 11,500 증표 차감'}
            </div>
          </div>

          <div
            className={`p-3 rounded-xl border ${
              latestEndedAuction && !activeAuction && !scheduledAuction
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-200'
                : 'bg-slate-950/70 border-slate-800 text-slate-400'
            }`}
          >
            <div className="font-black text-white flex items-center justify-between gap-1.5">
              <span className="whitespace-nowrap">4. 낙찰 안내 & 기록</span>
              <span className="text-[10px] font-bold text-emerald-300 whitespace-nowrap shrink-0">20:00:00 종료</span>
            </div>
            <div className="text-[11px] mt-1 whitespace-nowrap">
              낙찰자 공개 & 10% 공제 창고 적립
            </div>
          </div>
        </div>
      </div>

      {/* 3. 단일 상품 카드: 전설 도안 선택 상자 */}
      {loading ? (
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-12 text-center text-slate-400 text-sm">
          문파 상점 정보를 불러오는 중입니다...
        </div>
      ) : singleItem ? (
        <div className="bg-slate-900/85 border border-amber-500/35 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <div className="flex items-center space-x-4">
              <img
                src="/images/shop-weapon.png"
                onError={e => {
                  e.currentTarget.onerror = null;
                  e.currentTarget.src = '/images/oegil-logo.jpg';
                }}
                alt={singleItem.name}
                className="w-20 h-20 rounded-2xl border-2 border-amber-400 object-cover shrink-0 shadow-lg shadow-amber-500/20 bg-slate-900"
              />
              <div className="space-y-1">
                <span className="px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-[11px] font-bold text-amber-300">
                  문파 상점 핵심 상품 (무기·방어구·장신구 도안 통합)
                </span>
                <h2 className="text-lg sm:text-xl font-black text-white">{singleItem.name}</h2>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-base sm:text-lg font-black text-rose-400">
                    {singleItem.price.toLocaleString()}
                  </span>
                  <span className="text-xs font-bold text-amber-300">용맹의 증표</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-xs font-extrabold text-yellow-400">
                    {typeof singleItem.weeklyLimit === 'string'
                      ? singleItem.weeklyLimit
                      : `문파 주간 한정: (${10 - (singleItem.stock ?? 10)}/10)`}
                  </span>
                </div>
              </div>
            </div>

            {canManage && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setAuctionModalItem(singleItem);
                    setStartingBid(scheduledAuction?.startingBid || singleItem.minStartBid || 20000);
                    setMinBidIncrement(scheduledAuction?.minBidIncrement || singleItem.bidStep || 500);
                  }}
                  className="inline-flex items-center space-x-1.5 px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs transition-all whitespace-nowrap"
                >
                  <Settings className="w-4 h-4" />
                  <span>시작가/호가 설정 • 수동 경매 개시</span>
                </button>
                {singleItem.dailyLockedDate && (
                  <button
                    type="button"
                    onClick={handleUnlockDailyShop}
                    className="inline-flex items-center space-x-1.5 px-3 py-2.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border border-rose-500/30 font-bold text-xs transition-all whitespace-nowrap"
                  >
                    <Unlock className="w-4 h-4" />
                    <span>마감 잠금 해제</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* 수요일 19:30 대기 중 또는 19:30~20:00 본 경매 실시간 알림 배너 */}
          {scheduledAuction && (
            <div className="p-4 rounded-xl bg-amber-500/15 border border-amber-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-black text-amber-300 flex items-center space-x-1.5">
                  <Clock className="w-4 h-4 animate-spin" />
                  <span>⏳ 수요일 오후 7시 30분 문파 경매장 자동 시작 대기 중</span>
                </div>
                <p className="text-xs text-slate-200">
                  구매 희망 신청자가 있어 <strong>수요일 오후 7시 30분에 문파 경매장에서 자동으로 익명 경매가 시작</strong>되며,{' '}
                  <strong>오후 8시에 자동 종료</strong>됩니다.
                </p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-amber-400/50 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">19:30 경매 자동 시작까지</div>
                  <div className="text-lg font-black text-amber-300">
                    {formatRemainingTime(scheduledAuction.scheduledStartAt)}
                  </div>
                </div>
                <Link
                  href="/auction"
                  className="px-3.5 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center space-x-1"
                >
                  <span>경매장 보기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {activeAuction && (
            <div className="p-4 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="text-xs font-black text-emerald-300 flex items-center space-x-1.5">
                  <Gavel className="w-4 h-4" />
                  <span>🔥 현재 문파 경매장에서 익명 경매가 진행 중입니다! (오후 8시 자동 종료)</span>
                </div>
                <p className="text-xs text-slate-200">
                  문파 총재화에서 <strong>11,500 용맹의 증표가 자동 차감</strong>되었으며, 경매 종료 즉시 낙찰자 닉네임과 최종 낙찰금액이 안내됩니다.
                </p>
              </div>
              <div className="flex items-center space-x-3 shrink-0">
                <div className="px-3.5 py-2 rounded-xl bg-slate-950 border border-emerald-400/50 text-center">
                  <div className="text-[10px] text-slate-400 font-bold">경매 자동 종료까지</div>
                  <div className="text-lg font-black text-emerald-300">
                    {formatRemainingTime(activeAuction.endsAt)}
                  </div>
                </div>
                <Link
                  href="/auction"
                  className="px-3.5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs inline-flex items-center space-x-1"
                >
                  <span>입찰하러 가기</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            </div>
          )}

          {/* 최근 낙찰 완료 안내 배너 (최종 낙찰금액 우선 안내 + 10% 공제 창고 세이브 금액 별도 안내) */}
          {latestEndedAuction && !activeAuction && !scheduledAuction && (
            <div className="p-4 rounded-xl bg-indigo-950/40 border border-indigo-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="text-xs font-black text-amber-300 flex items-center space-x-1.5">
                  <Trophy className="w-4 h-4 text-amber-400" />
                  <span>🏆 최근 경매 낙찰 완료 안내 ({formatDateTime(latestEndedAuction.endsAt)})</span>
                </div>
                <div className="text-sm font-extrabold text-white">
                  최종 낙찰자: <span className="text-amber-300">{latestEndedAuction.highestBidderNickname || '없음'}</span>
                  {' • '}
                  인게임 지정 분배 입력 낙찰금액:{' '}
                  <span className="text-amber-300 font-black">
                    {(latestEndedAuction.grossBid ?? latestEndedAuction.currentBid ?? 0).toLocaleString()} 금전
                  </span>
                </div>
                <div className="text-xs text-emerald-300 font-semibold">
                  ↳ 세금 10%(-{(latestEndedAuction.taxAmount ?? Math.floor((latestEndedAuction.currentBid || 0) * 0.1)).toLocaleString()} 금전) 공제 후 문파 창고 세이브 금액:{' '}
                  <strong>
                    +{(latestEndedAuction.netSavedGold ?? Math.floor((latestEndedAuction.currentBid || 0) * 0.9)).toLocaleString()} 금전
                  </strong>
                </div>
              </div>
              <Link
                href="/auction"
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 shrink-0 text-center"
              >
                경매장 기록 보기
              </Link>
            </div>
          )}

          {/* 구매 희망 신청자 명단 & 내 캐릭터 신청 버튼 (수요일 19:00 ~ 19:30 KST에만 오픈) */}
          <div className="p-4 sm:p-5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-sm font-extrabold text-white flex items-center space-x-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>전설 도안 선택 상자 구매 희망 신청자 명단</span>
              </span>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300">
                  총 {(singleItem.applicants || []).length}명 희망 신청
                </span>
              </div>
            </div>

            <div className="min-h-[52px] p-3 rounded-xl bg-slate-900/90 border border-slate-800/80 flex flex-wrap items-center gap-2">
              {(singleItem.applicants || []).length === 0 ? (
                <span className="text-xs text-slate-400">
                  {kstSched.isShopOpen
                    ? '현재 구매 희망 신청이 오픈되어 있습니다! 아래 버튼을 눌러 희망 신청을 등록하세요.'
                    : '현재 등록된 구매 희망 신청자가 없습니다. (매주 수요일 오후 7시 ~ 7시 30분 오픈)'}
                </span>
              ) : (
                (singleItem.applicants || []).map(nick => {
                  const isMe = currentUser?.nickname === nick;
                  return (
                    <span
                      key={nick}
                      className={`inline-flex items-center space-x-1.5 px-3 py-1 rounded-lg text-xs font-bold border ${
                        isMe
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                          : 'bg-slate-800 text-slate-200 border-slate-700'
                      }`}
                    >
                      <span>{nick}</span>
                    </span>
                  );
                })
              )}
            </div>

            {/* 내 캐릭터 구매 희망 신청 버튼 (매주 수요일 19:00:00 ~ 19:29:59에만 활성화) */}
            {(() => {
              const myNick = currentUser?.nickname || '';
              const isApplied = myNick ? (singleItem.applicants || []).includes(myNick) : false;

              if (!kstSched.isShopOpen) {
                return (
                  <div className="w-full py-3 px-4 rounded-xl bg-slate-900 border border-slate-700 text-slate-300 font-bold text-xs sm:text-sm flex flex-col sm:flex-row items-center justify-between gap-2.5">
                    <div className="flex items-center space-x-2 text-rose-300 text-xs sm:text-sm">
                      <Lock className="w-4 h-4 shrink-0" />
                      <span>
                        구매 희망 신청은 <strong>매주 수요일 오후 7시부터 7시 30분까지 (19:00:00 ~ 19:29:59)</strong> 오픈됩니다. (현재 닫힘)
                      </span>
                    </div>
                    <span className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800 text-amber-300 text-xs font-extrabold shrink-0 whitespace-nowrap">
                      다음 수요일 19:00 오픈까지: {formatRemainingTime(kstSched.shopOpenAtISO)}
                    </span>
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  onClick={() => handleToggleMyApplication(singleItem.id)}
                  className={`w-full py-3.5 px-4 rounded-xl font-extrabold text-xs sm:text-sm transition-all flex items-center justify-center space-x-2 border ${
                    isApplied
                      ? 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 border-amber-400 shadow-lg shadow-amber-500/20'
                  }`}
                >
                  {isApplied ? (
                    <>
                      <Check className="w-4 h-4" />
                      <span>
                        내 캐릭터 ({myNick}) 구매 희망 신청 완료 (19:30:00 자동 경매 개시 • 클릭 시 취소)
                      </span>
                    </>
                  ) : (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>
                        내 캐릭터 ({myNick}) 구매 희망 신청하기 (19:30:00 문파 경매장 자동 시작)
                      </span>
                    </>
                  )}
                </button>
              );
            })()}
          </div>
        </div>
      ) : null}

      {/* 4. 문파 재화 [용맹의 증표] 업데이트 및 차감 날짜별 공개 내역 */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-amber-400" />
            <span>용맹의 증표 업데이트 & 상점 경매 차감 공개 내역</span>
          </h2>
          <span className="text-xs text-slate-400">
            문파장 재화 업데이트 및 상품 경매 개시 차감(-11,500) 내역이 날짜별로 투명하게 기록됩니다
          </span>
        </div>

        {tokenLedger.length === 0 ? (
          <div className="p-8 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs sm:text-sm text-slate-500">
            아직 기록된 용맹의 증표 업데이트 및 차감 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-3 px-4">날짜 및 시각</th>
                  <th className="py-3 px-4">구분</th>
                  <th className="py-3 px-4">상세 내역</th>
                  <th className="py-3 px-4 text-right">변동 수량</th>
                  <th className="py-3 px-4 text-right">반영 후 총 보유량</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {tokenLedger.map(entry => {
                  const isDeduct = entry.type === 'AUCTION_DEDUCT' || entry.delta < 0;
                  return (
                    <tr key={entry.id} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-xs text-slate-400 whitespace-nowrap">
                        {formatDateTime(entry.createdAt)}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                            entry.type === 'AUCTION_DEDUCT'
                              ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                              : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          }`}
                        >
                          {entry.type === 'AUCTION_DEDUCT' ? '상품 경매 차감' : '문파장 업데이트'}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-semibold text-white">{entry.description}</td>
                      <td
                        className={`py-3 px-4 text-right font-black whitespace-nowrap ${
                          isDeduct ? 'text-rose-400' : 'text-emerald-400'
                        }`}
                      >
                        {entry.delta > 0 ? `+${entry.delta.toLocaleString()}` : entry.delta.toLocaleString()} 증표
                      </td>
                      <td className="py-3 px-4 text-right font-black text-amber-300 whitespace-nowrap">
                        {entry.balanceAfter.toLocaleString()} 용맹의 증표
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 어드민/부문주 전용 경매 시작가/호가 설정 모달 */}
      {canManage && auctionModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <span>전설 도안 선택 상자 경매 설정 (어드민 전용)</span>
              </h3>
              <button
                onClick={() => setAuctionModalItem(null)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  1. 최소 구매 입찰가 (시작가 금전)
                </label>
                <input
                  type="number"
                  value={startingBid}
                  onChange={e => setStartingBid(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-black text-amber-300"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[10000, 20000, 30000, 50000].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStartingBid(preset)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
                    >
                      {preset.toLocaleString()}G
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  2. 최소 입찰 단위 (호가 금전)
                </label>
                <input
                  type="number"
                  value={minBidIncrement}
                  onChange={e => setMinBidIncrement(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm font-black text-emerald-400"
                />
                <div className="flex gap-1.5 mt-1.5">
                  {[100, 500, 1000, 2000].map(unit => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setMinBidIncrement(unit)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-bold text-slate-300"
                    >
                      +{unit.toLocaleString()}G
                    </button>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1">
                <div className="font-bold text-emerald-400 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>경매 개시 및 낙찰 안내 규칙</span>
                </div>
                <div>• 개시 시 문파 총재화에서 <strong>11,500 용맹의 증표</strong> 자동 차감</div>
                <div>• 종료 시 <strong>낙찰자 & 최종 낙찰금액(인게임 지정 분배 입력금)</strong> 우선 표시 + <strong>세금 10% 공제 금액(90%)</strong> 별도 표시 및 창고 적립</div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 pt-2">
              <button
                type="button"
                disabled={creatingAuction}
                onClick={e => handleStartOrConfigAuction(e, false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/30 font-bold text-xs"
              >
                시작가/호가 설정만 저장
              </button>
              <button
                type="button"
                disabled={creatingAuction}
                onClick={e => handleStartOrConfigAuction(e, true)}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md"
              >
                {creatingAuction ? '처리 중...' : '수동 30분 경매 즉시 개시'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
