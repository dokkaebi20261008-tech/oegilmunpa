'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Gavel,
  Clock,
  Trophy,
  Coins,
  Plus,
  AlertCircle,
  Calculator,
  Lock,
  Eye,
  Vault,
  Flame,
  History,
  CheckCircle2,
  Play
} from 'lucide-react';
import { AuctionItem, AuctionDistribution, GoldLedgerEntry } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function AuctionPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [treasuryGold, setTreasuryGold] = useState<number>(0);
  const [goldLedger, setGoldLedger] = useState<GoldLedgerEntry[]>([]);
  const [guildTokens, setGuildTokens] = useState<number>(0);
  const { currentUser, authChecking } = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [nowMs, setNowMs] = useState<number>(Date.now());

  // 입찰 모달
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidError, setBidError] = useState<string>('');
  const [bidLoading, setBidLoading] = useState(false);

  // 신규 등록 모달
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('전설 도안 선택 상자');
  const [newDesc, setNewDesc] = useState('');
  const [newStartBid, setNewStartBid] = useState(20000);
  const [newMinIncrement, setNewMinIncrement] = useState(500);
  const [createLoading, setCreateLoading] = useState(false);

  // 문파 창고 세이브 금전 분배 계산기
  const [calcGold, setCalcGold] = useState(0);
  const [customGoldInput, setCustomGoldInput] = useState(false);
  const [simDistribution, setSimDistribution] = useState<AuctionDistribution | null>(null);
  const [resetPointsAfterDist, setResetPointsAfterDist] = useState(false);
  const [distributing, setDistributing] = useState(false);

  const fetchAuctions = () => {
    fetch('/api/auction', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        const list: AuctionItem[] = data.auctions || [];
        setAuctions(list);
        const savedGold = data.treasuryGold ?? 0;
        setTreasuryGold(savedGold);
        setGoldLedger(data.goldLedger || []);
        setGuildTokens(data.guildTokens ?? 0);
        setCalcGold(prev => (customGoldInput ? prev : savedGold));
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAuctions();
    const interval = setInterval(fetchAuctions, 3000);
    const handleFocus = () => fetchAuctions();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [customGoldInput]);

  // 1초마다 실시간 30분 대기 / 30분 본 경매 카운트다운 및 자동 전환
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      const shouldSync = auctions.some(
        a =>
          (a.status === 'SCHEDULED' && a.scheduledStartAt && new Date(a.scheduledStartAt).getTime() <= current) ||
          (a.status === 'ACTIVE' && a.endsAt && new Date(a.endsAt).getTime() <= current)
      );
      if (shouldSync) {
        fetchAuctions();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auctions]);

  const formatRemainingTime = (targetIso?: string) => {
    if (!targetIso) return '00:00';
    const diffSec = Math.max(0, Math.floor((new Date(targetIso).getTime() - nowMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const formatDateTime = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ko-KR', {
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

  // 문파 창고 세이브 금전 기반 실시간 분배 계산
  useEffect(() => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (!d.attendance) return;
        const totalPoints = d.totalGuildPoints || 0;
        const goldPerPoint = totalPoints > 0 ? calcGold / totalPoints : 0;
        const participants: any[] = [];
        let distributedSum = 0;
        for (const m of d.attendance) {
          const share = totalPoints > 0 ? Math.floor(m.totalPoints * goldPerPoint) : 0;
          distributedSum += share;
          participants.push({
            nickname: m.nickname,
            points: m.totalPoints,
            carriedPoints: m.carriedPoints || 0,
            weeklyPoints: m.weeklyPoints || 0,
            share
          });
        }
        participants.sort((a, b) => b.points - a.points);
        setSimDistribution({
          totalGold: calcGold,
          totalPoints,
          goldPerPoint: Math.round(goldPerPoint * 10) / 10,
          participants,
          leftoverGold: totalPoints > 0 ? calcGold - distributedSum : calcGold
        });
      });
  }, [calcGold, auctions, treasuryGold]);

  const handleOpenBid = (auction: AuctionItem) => {
    setSelectedAuction(auction);
    const minRequired =
      auction.bidsCount === 0 ? auction.startingBid : auction.currentBid + auction.minBidIncrement;
    setBidAmount(minRequired);
    setBidError('');
  };

  const handlePlaceBid = async () => {
    if (!selectedAuction) return;
    setBidLoading(true);
    setBidError('');

    try {
      const res = await fetch(`/api/auction/${selectedAuction.id}/bid`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: bidAmount })
      });
      const data = await res.json();
      if (!data.success) {
        setBidError(data.message || '입찰에 실패했습니다.');
        setBidLoading(false);
        return;
      }
      setSelectedAuction(null);
      fetchAuctions();
      const expectedNet = Math.floor(bidAmount * 0.9);
      alert(
        `🎉 [${selectedAuction.title}] ${bidAmount.toLocaleString()} 금전 익명 입찰이 등록되었습니다!\n• 30분 경매 종료 시 최고 입찰자 닉네임이 공개됩니다.\n• 낙찰 시 인게임 세금 10% 공제 후 ${expectedNet.toLocaleString()} 금전이 문파 창고에 세이브됩니다.`
      );
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setBidLoading(false);
    }
  };

  const handleStartScheduledNow = async (auction: AuctionItem) => {
    if (
      !confirm(
        `[${auction.title}] 30분 대기를 종료하고 지금 즉시 30분 익명 경매를 시작하시겠습니까?\n(당일 추가 희망 신청이 마감되고 11,500 용맹의 증표가 자동 차감됩니다)`
      )
    ) {
      return;
    }
    const res = await fetch(`/api/auction/${auction.id}/end`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'START_NOW' })
    });
    const d = await res.json();
    if (d.success) {
      alert(d.message);
      fetchAuctions();
    } else {
      alert(d.message || '시작 실패');
    }
  };

  const handleEndAuction = async (auction: AuctionItem) => {
    const netExpected = Math.floor(auction.currentBid * 0.9);
    const taxExpected = auction.currentBid - netExpected;
    if (
      !confirm(
        `'${auction.title}' 경매를 마감하시겠습니까?\n• 최고 입찰자 닉네임 즉시 공개\n• 인게임 지정 분배 낙찰가: ${auction.currentBid.toLocaleString()} 금전\n• 세금 10%(-${taxExpected.toLocaleString()}G) 공제 후 문파 창고 세이브: +${netExpected.toLocaleString()} 금전`
      )
    ) {
      return;
    }

    try {
      const res = await fetch(`/api/auction/${auction.id}/end`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'END' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '마감 실패');
        return;
      }
      alert(data.message);
      setCustomGoldInput(false);
      fetchAuctions();
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
    }
  };

  // 문파 창고 세이브 금전 분배 실행 (창고 차감)
  const handleDistributeTreasury = async () => {
    if (treasuryGold <= 0) {
      alert('현재 문파 창고에 분배 가능한 세이브 금전이 없습니다.');
      return;
    }
    const msg = resetPointsAfterDist
      ? `문파 창고 세이브 금전 ${treasuryGold.toLocaleString()} 금전을 누적 점수 비례로 분배 완료 처리(창고 0 금전 차감)하고, 동시에 문파원 누적 점수도 0P로 초기화하시겠습니까?`
      : `문파 창고 세이브 금전 ${treasuryGold.toLocaleString()} 금전을 누적 점수 비례로 분배 완료 처리(창고에서 차감)하시겠습니까?`;
    if (!confirm(msg)) return;

    setDistributing(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISTRIBUTE_TREASURY_GOLD',
          amount: treasuryGold,
          resetPointsAfter: resetPointsAfterDist
        })
      });
      const d = await res.json();
      if (d.success) {
        alert(d.message);
        setCustomGoldInput(false);
        fetchAuctions();
      } else {
        alert(d.message || '분배 처리 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setDistributing(false);
    }
  };

  const handleCreateAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateLoading(true);

    try {
      const res = await fetch('/api/auction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc,
          startingBid: newStartBid,
          minBidIncrement: newMinIncrement
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '등록 실패');
        setCreateLoading(false);
        return;
      }
      setIsCreateOpen(false);
      setNewTitle('전설 도안 선택 상자');
      setNewDesc('');
      fetchAuctions();
      alert('🎉 신규 30분 익명 경매가 등록되었습니다! (11,500 용맹의 증표 자동 차감 완료)');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const scheduledAuctions = auctions.filter(a => a.status === 'SCHEDULED');
  const activeAuctions = auctions.filter(a => a.status === 'ACTIVE');
  const liveOrWaitingAuctions = [...activeAuctions, ...scheduledAuctions];
  const endedAuctions = auctions.filter(a => a.status === 'ENDED');

  if (authChecking) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Gavel className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              정회원 전용 경매장
            </span>
            <h2 className="text-2xl font-black text-white">문파 전리품 경매장</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              본 경매장의 전리품 입찰 및 실시간 호가 참여는<br />
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

  return (
    <div className="space-y-5 pb-16">
      {/* 상단 헤더 & 인게임 지정 분배 10% 세금 안내 */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                외길 문파 익명 경매장 & 문파 창고 금전 분배소
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                상점 희망 신청 ➔ <strong className="text-amber-300">30분 대기</strong> ➔ <strong className="text-indigo-300">30분 익명 경매</strong> ➔ 종료 시 <strong className="text-emerald-300">닉네임 공개 & 인게임 세금 10% 공제 후 90% 창고 세이브</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              href="/shop"
              className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all"
            >
              <span>📦 문파 상점</span>
            </Link>
            {currentUser?.role === 'ADMIN' && (
              <button
                onClick={() => setIsCreateOpen(true)}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
              >
                <Plus className="w-4 h-4" />
                <span>신규 30분 경매 등록</span>
              </button>
            )}
          </div>
        </div>

        {/* 인게임 거래 및 세금 10% 세이브 핵심 요약 바 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-emerald-500/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-emerald-400 flex items-center space-x-1">
                <Vault className="w-3.5 h-3.5" />
                <span>현재 문파 창고 세이브 금전 (분배 대기)</span>
              </div>
              <div className="text-xl font-black text-white mt-0.5">
                {treasuryGold.toLocaleString()} <span className="text-xs font-bold text-emerald-400">금전</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                낙찰가에서 세금 10% 공제 후 적립 • 분배 시 차감
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-amber-500/30 flex items-center justify-between">
            <div>
              <div className="text-[11px] font-bold text-amber-300 flex items-center space-x-1">
                <Flame className="w-3.5 h-3.5" />
                <span>문파 보유 재화: 용맹의 증표</span>
              </div>
              <div className="text-xl font-black text-white mt-0.5">
                {guildTokens.toLocaleString()} <span className="text-xs font-bold text-amber-400">용맹의 증표</span>
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">
                경매 개시 시 상품가(11,500) 자동 차감
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 text-xs text-slate-300 flex flex-col justify-center space-y-1">
            <div className="font-bold text-amber-300">💡 인게임 지정 분배 & 세금 10% 안내</div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              낙찰자가 인게임 지정 분배로 낙찰금을 지불하면 <strong>세금 10%가 제외된 90% 금액</strong>(예: 30,000G 낙찰 → <strong>27,000G</strong>)이 문파 창고에 세이브되어 참여율로 분배됩니다.
            </p>
          </div>
        </div>
      </div>

      {/* Unified 3-Column Same-Row Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Column 1: 대기 중(30분) & 진행 중(30분) 경매 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>대기 및 진행 경매 ({liveOrWaitingAuctions.length}건)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] font-bold text-amber-300">
                대기 30분 ➔ 경매 30분
              </span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-xs text-slate-400">경매 정보를 불러오는 중...</div>
            ) : liveOrWaitingAuctions.length === 0 ? (
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-8 text-center space-y-2 my-4">
                <Gavel className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">현재 대기 또는 진행 중인 경매가 없습니다</div>
                <p className="text-xs text-slate-500 leading-relaxed">
                  [문파 상점]에서 문파원이 구매 희망 신청을 누르면 즉시 <strong>30분 대기 타이머</strong> 후 <strong>30분 익명 경매</strong>가 자동으로 진행됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {liveOrWaitingAuctions.map(auction => {
                  const isScheduled = auction.status === 'SCHEDULED';
                  const nextMinBid =
                    auction.bidsCount === 0
                      ? auction.startingBid
                      : auction.currentBid + auction.minBidIncrement;
                  const timeLeftStr = isScheduled
                    ? formatRemainingTime(auction.scheduledStartAt)
                    : formatRemainingTime(auction.endsAt);
                  const expectedNetSave = Math.floor(auction.currentBid * 0.9);

                  return (
                    <div
                      key={auction.id}
                      className={`bg-slate-950/75 border rounded-xl p-4 space-y-3.5 ${
                        isScheduled ? 'border-amber-500/40' : 'border-emerald-500/40'
                      }`}
                    >
                      {/* 상단 상태 배지 & 타이머 */}
                      <div className="flex items-center justify-between text-xs">
                        {isScheduled ? (
                          <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-bold">
                            ⏳ 경매 시작 대기 중 (희망자 {auction.applicants?.length || 1}명)
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                            🔥 익명 입찰 {auction.bidsCount}회 진행중
                          </span>
                        )}
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>{isScheduled ? `개시까지 ${timeLeftStr}` : `남은시간 ${timeLeftStr}`}</span>
                        </span>
                      </div>

                      {/* 아이템 아이콘 & 제목 */}
                      <div className="flex items-center space-x-3">
                        <img
                          src={auction.imageUrl || '/images/shop-weapon.png'}
                          alt={auction.title}
                          className="w-12 h-12 rounded-xl border border-amber-400/60 object-cover shrink-0 shadow-md"
                        />
                        <div className="min-w-0">
                          <h3 className="text-base font-extrabold text-white truncate">{auction.title}</h3>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            {isScheduled
                              ? `희망자: ${(auction.applicants || []).join(', ') || '접수 중'}`
                              : '무기·방어구·장신구 통합 도안 상자 (익명 경매)'}
                          </p>
                        </div>
                      </div>

                      {/* 핵심 수치 2x2 그리드 */}
                      <div className="grid grid-cols-2 gap-2">
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[11px] text-slate-400">최소 구매 입찰가</div>
                          <div className="text-xs font-bold text-slate-200 mt-0.5">
                            {auction.startingBid.toLocaleString()} 금전
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[11px] text-slate-400">최소 입찰 단위</div>
                          <div className="text-xs font-bold text-emerald-400 mt-0.5">
                            +{auction.minBidIncrement.toLocaleString()} 금전
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/30">
                          <div className="text-[11px] text-amber-300 font-semibold">
                            {auction.bidsCount === 0 ? '시작 입찰가' : '현재 최고 입찰가'}
                          </div>
                          <div className="text-base font-black text-amber-300 mt-0.5">
                            {auction.currentBid.toLocaleString()} 금전
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[11px] text-slate-400">창고 예상 세이브 (90%)</div>
                          <div className="text-xs font-black text-emerald-400 mt-1">
                            +{expectedNetSave.toLocaleString()} 금전
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                        <span className="text-slate-400">현재 최고 입찰자</span>
                        <span className="text-amber-300 font-bold flex items-center gap-1">
                          {auction.bidsCount > 0 ? (
                            <>
                              <Lock className="w-3 h-3" />
                              <span>익명 입찰자 (종료 시 공개)</span>
                            </>
                          ) : (
                            <span className="text-slate-500">
                              {isScheduled ? '대기 종료 후 입찰 오픈' : '첫 입찰 대기 중'}
                            </span>
                          )}
                        </span>
                      </div>

                      {/* 액션 버튼 */}
                      {isScheduled ? (
                        <div className="space-y-2 pt-1">
                          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-200 font-semibold">
                            ⏳ {timeLeftStr} 후 당일 희망 신청이 마감되고 30분 익명 경매가 자동 시작됩니다.
                          </div>
                          {currentUser?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleStartScheduledNow(auction)}
                              className="w-full py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center justify-center space-x-1.5"
                            >
                              <Play className="w-3.5 h-3.5" />
                              <span>대기 건너뛰고 즉시 30분 익명 경매 개시 (관리자)</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="space-y-2 pt-1">
                          <button
                            onClick={() => handleOpenBid(auction)}
                            className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-xs sm:text-sm shadow-md transition-all flex items-center justify-center space-x-1.5"
                          >
                            <Gavel className="w-4 h-4" />
                            <span>{nextMinBid.toLocaleString()} 금전부터 익명 입찰하기</span>
                          </button>

                          {currentUser?.role === 'ADMIN' && (
                            <button
                              onClick={() => handleEndAuction(auction)}
                              className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-colors"
                            >
                              경매 즉시 종료 • 낙찰자 공개 및 창고 90% 세이브 (관리자)
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: 최근 낙찰 완료 및 문파 창고 세이브 내역 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>최근 낙찰 및 창고 세이브 ({endedAuctions.length}건)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-300">
                세금 10% 공제 반영
              </span>
            </div>

            {endedAuctions.length === 0 ? (
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-8 text-center space-y-2.5 my-4">
                <Trophy className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">아직 마감된 경매가 없습니다</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  30분 익명 경매가 종료되면 이곳에 <strong className="text-white">최고 입찰자 닉네임</strong>과<br />
                  인게임 세금 10%를 제외한 <strong className="text-emerald-300">문파 창고 세이브 금전(90%)</strong>이 공개됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[480px] overflow-y-auto pr-1">
                {endedAuctions.map(item => {
                  const gross = item.grossBid ?? item.currentBid ?? 0;
                  const tax = item.taxAmount ?? Math.floor(gross * 0.1);
                  const netSaved = item.netSavedGold ?? gross - tax;

                  return (
                    <div key={item.id} className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[11px] font-bold text-emerald-400">
                            [경매 종료 • 낙찰자 공개 & 창고 세이브]
                          </span>
                          <h3 className="text-sm font-extrabold text-white mt-0.5">{item.title}</h3>
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-xs">
                            <Eye className="w-3 h-3 text-amber-400" />
                            <span className="text-slate-300">최종 낙찰자:</span>
                            <span className="text-amber-300 font-black">
                              {item.highestBidderNickname || '입찰자 없음'}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[10px] text-slate-400">{formatDateTime(item.endsAt)}</span>
                          <div className="text-sm font-black text-amber-300 mt-0.5">
                            낙찰가 {gross.toLocaleString()}G
                          </div>
                        </div>
                      </div>

                      {/* 인게임 지정 분배 -> 10% 세금 -> 90% 창고 세이브 내역 */}
                      <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-900/90 rounded-lg text-center text-[11px]">
                        <div>
                          <div className="text-slate-400">지정 분배 낙찰가</div>
                          <div className="font-bold text-slate-200 mt-0.5">{gross.toLocaleString()}G</div>
                        </div>
                        <div>
                          <div className="text-slate-400">인게임 세금(10%)</div>
                          <div className="font-bold text-rose-400 mt-0.5">-{tax.toLocaleString()}G</div>
                        </div>
                        <div>
                          <div className="text-emerald-300 font-semibold">문파 창고 세이브</div>
                          <div className="font-black text-emerald-400 mt-0.5">+{netSaved.toLocaleString()}G</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: 문파 창고 세이브 금전 & 누적 점수 분배소 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-emerald-400" />
                <span>문파 창고 세이브 금전 분배소</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-300">
                세금 10% 제외 실수령 기준
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300 font-semibold">
                  현재 문파 창고 세이브 금전 (분배 대상)
                </label>
                {customGoldInput && (
                  <button
                    type="button"
                    onClick={() => {
                      setCustomGoldInput(false);
                      setCalcGold(treasuryGold);
                    }}
                    className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500 text-slate-950"
                  >
                    실제 창고 잔액({treasuryGold.toLocaleString()}G) 동기화
                  </button>
                )}
              </div>

              <div className="relative">
                <Coins className="w-4 h-4 text-emerald-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={calcGold}
                  onChange={e => {
                    setCustomGoldInput(true);
                    setCalcGold(parseInt(e.target.value, 10) || 0);
                  }}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-black text-emerald-400 focus:outline-none focus:border-emerald-500"
                />
              </div>
              <p className="text-[11px] text-slate-400">
                경매 종료 시 낙찰가에서 세금 10%가 공제된 90% 금액이 창고에 자동 합산되며, 분배 실행 시 차감됩니다.
              </p>
            </div>

            {simDistribution && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-center text-[11px]">
                  <div>
                    <div className="text-slate-400">문파 총 누적 점수</div>
                    <div className="font-bold text-amber-300 mt-0.5">{simDistribution.totalPoints}P</div>
                  </div>
                  <div>
                    <div className="text-slate-400">1P당 배당금</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {simDistribution.goldPerPoint.toLocaleString()}G
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">자투리 잔액</div>
                    <div className="font-bold text-slate-300 mt-0.5">
                      {simDistribution.leftoverGold.toLocaleString()}G
                    </div>
                  </div>
                </div>

                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">문파원</th>
                        <th className="py-2 px-2 text-center">누적 점수</th>
                        <th className="py-2 px-3 text-right">창고 금전 배당액</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {simDistribution.participants.map((p, i) => (
                        <tr key={p.nickname} className="hover:bg-slate-800/30">
                          <td className="py-1.5 px-3">
                            <span className="text-[10px] text-slate-500 mr-1">{i + 1}.</span>
                            <span className="font-bold text-white">{p.nickname}</span>
                          </td>
                          <td className="py-1.5 px-2 text-center text-amber-300 font-semibold">{p.points}P</td>
                          <td className="py-1.5 px-3 text-right font-bold text-emerald-400">
                            +{p.share.toLocaleString()} 금전
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {currentUser?.role === 'ADMIN' && (
                  <div className="pt-1 space-y-2 border-t border-slate-800">
                    <label className="flex items-center space-x-2 text-xs text-slate-300 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={resetPointsAfterDist}
                        onChange={e => setResetPointsAfterDist(e.target.checked)}
                        className="rounded border-slate-700 text-amber-500 focus:ring-0"
                      />
                      <span>금전 분배 완료와 동시에 전 문파원 누적 점수도 0P로 초기화</span>
                    </label>
                    <button
                      type="button"
                      disabled={distributing || treasuryGold <= 0}
                      onClick={handleDistributeTreasury}
                      className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-extrabold text-xs shadow-lg transition-all"
                    >
                      {distributing
                        ? '분배 처리 중...'
                        : treasuryGold > 0
                        ? `💰 창고 세이브 금전(${treasuryGold.toLocaleString()}G) 분배 완료 및 창고 차감`
                        : '현재 창고 세이브 금전 0G (분배 대기 없음)'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 하단: 문파 창고 금전 세이브(90%) 및 분배 차감 공개 내역표 */}
      <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-5 shadow-xl space-y-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
            <History className="w-5 h-5 text-emerald-400" />
            <span>문파 창고 금전 세이브(세금 10% 공제) & 분배 차감 공개 내역</span>
          </h2>
          <span className="text-xs text-slate-400">
            경매 낙찰 시 +90% 창고 세이브 적립 및 문파원 분배 시 차감 내역이 날짜별로 기록됩니다
          </span>
        </div>

        {goldLedger.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-xs text-slate-500">
            아직 기록된 문파 창고 금전 세이브 및 분배 내역이 없습니다.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-left text-xs sm:text-sm">
              <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-4">날짜 및 시각</th>
                  <th className="py-2.5 px-4">구분</th>
                  <th className="py-2.5 px-4">상세 내역</th>
                  <th className="py-2.5 px-4 text-right">창고 금전 변동</th>
                  <th className="py-2.5 px-4 text-right">반영 후 창고 세이브 잔액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-200">
                {goldLedger.map(g => (
                  <tr key={g.id} className="hover:bg-slate-800/40">
                    <td className="py-2.5 px-4 text-xs text-slate-400 whitespace-nowrap">
                      {formatDateTime(g.createdAt)}
                    </td>
                    <td className="py-2.5 px-4 whitespace-nowrap">
                      <span
                        className={`px-2 py-0.5 rounded text-[11px] font-bold border ${
                          g.type === 'AUCTION_SAVED'
                            ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                            : g.type === 'DISTRIBUTED'
                            ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                            : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        }`}
                      >
                        {g.type === 'AUCTION_SAVED'
                          ? '경매 낙찰 세이브(90%)'
                          : g.type === 'DISTRIBUTED'
                          ? '문파원 분배 차감'
                          : '창고 잔액 조정'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-semibold text-white">{g.description}</td>
                    <td
                      className={`py-2.5 px-4 text-right font-black whitespace-nowrap ${
                        g.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {g.delta >= 0 ? `+${g.delta.toLocaleString()}` : g.delta.toLocaleString()} 금전
                    </td>
                    <td className="py-2.5 px-4 text-right font-black text-amber-300 whitespace-nowrap">
                      {g.balanceAfter.toLocaleString()} 금전
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Bid Modal */}
      {selectedAuction &&
        (() => {
          const minRequired =
            selectedAuction.bidsCount === 0
              ? selectedAuction.startingBid
              : selectedAuction.currentBid + selectedAuction.minBidIncrement;
          const expectedNet = Math.floor(bidAmount * 0.9);
          const expectedTax = bidAmount - expectedNet;

          return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                    <Gavel className="w-5 h-5 text-amber-400" />
                    <span>익명 경매 입찰하기</span>
                  </h3>
                  <button
                    onClick={() => setSelectedAuction(null)}
                    className="text-slate-400 hover:text-white text-sm"
                  >
                    ✕
                  </button>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">이번 입찰 최소 가능 금액:</span>
                    <span className="font-black text-emerald-400">{minRequired.toLocaleString()} 금전 이상</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">낙찰 시 인게임 세금(10%):</span>
                    <span className="font-bold text-rose-400">-{expectedTax.toLocaleString()} 금전</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">낙찰 시 문파 창고 세이브(90%):</span>
                    <span className="font-black text-emerald-400">+{expectedNet.toLocaleString()} 금전</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">내 입찰 금액 (금전)</label>
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={e => setBidAmount(parseInt(e.target.value, 10) || 0)}
                    step={selectedAuction.minBidIncrement}
                    className="w-full px-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-lg font-black text-amber-300 focus:outline-none focus:border-indigo-500"
                  />
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    <button
                      type="button"
                      onClick={() => setBidAmount(minRequired)}
                      className="px-2.5 py-1 rounded bg-emerald-500/15 border border-emerald-500/30 hover:bg-emerald-500/25 text-xs text-emerald-300 font-bold"
                    >
                      최소 가능액 ({minRequired.toLocaleString()})
                    </button>
                    {[1, 2, 5].map(mult => {
                      const addVal = selectedAuction.minBidIncrement * mult;
                      return (
                        <button
                          key={mult}
                          type="button"
                          onClick={() => setBidAmount(prev => prev + addVal)}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-xs text-slate-300 font-semibold"
                        >
                          +{addVal.toLocaleString()}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {bidError && (
                  <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center space-x-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{bidError}</span>
                  </div>
                )}

                <div className="flex space-x-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setSelectedAuction(null)}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    onClick={handlePlaceBid}
                    disabled={bidLoading}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm hover:from-amber-400 shadow-lg shadow-amber-500/20 disabled:opacity-50"
                  >
                    {bidLoading ? '입찰 처리 중...' : `${bidAmount.toLocaleString()} 금전 익명 입찰`}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {/* Create Auction Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAuction}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>신규 30분 익명 경매 물품 등록</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">물품명</label>
              <input
                type="text"
                required
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">1. 최소 구매 입찰가 (시작가)</label>
                <input
                  type="number"
                  required
                  value={newStartBid}
                  onChange={e => setNewStartBid(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">2. 최소 입찰 호가 단위</label>
                <input
                  type="number"
                  required
                  value={newMinIncrement}
                  onChange={e => setNewMinIncrement(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-emerald-400 font-bold"
                />
              </div>
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={createLoading}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm hover:bg-amber-400"
              >
                {createLoading ? '등록 중...' : '30분 경매 시작'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
