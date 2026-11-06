'use client';

import { useState, useEffect } from 'react';
import { Gavel, Clock, Trophy, Coins, Plus, AlertCircle, Calculator, ShieldAlert, Lock, Eye } from 'lucide-react';
import { AuctionItem, AuctionDistribution } from '@/lib/types';

export default function AuctionPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
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

  // 모의 계산기 (3만 금전 등)
  const [calcGold, setCalcGold] = useState(30000);
  const [simDistribution, setSimDistribution] = useState<AuctionDistribution | null>(null);

  const fetchAuctions = () => {
    fetch('/api/auction', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        setAuctions(data.auctions || []);
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
  }, []);

  // 1초마다 실시간 30분 카운트다운 타이머 갱신 및 만료 시 자동 동기화
  useEffect(() => {
    const timer = setInterval(() => {
      const current = Date.now();
      setNowMs(current);
      const hasJustExpired = auctions.some(
        a => a.status === 'ACTIVE' && a.endsAt && new Date(a.endsAt).getTime() <= current
      );
      if (hasJustExpired) {
        fetchAuctions();
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [auctions]);

  const formatRemainingTime = (endsAt: string) => {
    const diffSec = Math.max(0, Math.floor((new Date(endsAt).getTime() - nowMs) / 1000));
    const mins = Math.floor(diffSec / 60);
    const secs = diffSec % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // 모의 계산 실행
  useEffect(() => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (!d.attendance) return;
        const totalPoints = d.totalGuildPoints || 0;
        if (totalPoints <= 0) return;
        const goldPerPoint = calcGold / totalPoints;
        const participants: any[] = [];
        let distributedSum = 0;
        for (const m of d.attendance) {
          if (m.totalPoints > 0) {
            const share = Math.floor(m.totalPoints * goldPerPoint);
            distributedSum += share;
            participants.push({ nickname: m.nickname, points: m.totalPoints, share });
          }
        }
        participants.sort((a, b) => b.points - a.points);
        setSimDistribution({
          totalGold: calcGold,
          totalPoints,
          goldPerPoint: Math.round(goldPerPoint * 10) / 10,
          participants,
          leftoverGold: calcGold - distributedSum
        });
      });
  }, [calcGold]);

  const handleOpenBid = (auction: AuctionItem) => {
    setSelectedAuction(auction);
    const minRequired = auction.bidsCount === 0
      ? auction.startingBid
      : auction.currentBid + auction.minBidIncrement;
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
        body: JSON.stringify({ amount: bidAmount }),
      });
      const data = await res.json();
      if (!data.success) {
        setBidError(data.message || '입찰에 실패했습니다.');
        setBidLoading(false);
        return;
      }
      setSelectedAuction(null);
      fetchAuctions();
      alert(`🎉 [${selectedAuction.title}] ${bidAmount.toLocaleString()}금전 익명 입찰이 등록되었습니다! (30분 종료 시 최고 입찰자 닉네임 공개)`);
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setBidLoading(false);
    }
  };

  const handleEndAuction = async (auction: AuctionItem) => {
    if (!confirm(`'${auction.title}' 경매를 마감하여 최고 입찰자 닉네임을 공개하고, 최종 낙찰 금액(${auction.currentBid.toLocaleString()}금전)을 문파원들에게 자동 분배하시겠습니까?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/auction/${auction.id}/end`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '마감 실패');
        return;
      }
      alert(`✅ 경매가 마감되어 최고 입찰자(${data.auction?.highestBidderNickname || '없음'})가 공개되고 총 ${auction.currentBid.toLocaleString()}금전이 분배 완료되었습니다!`);
      fetchAuctions();
    } catch (err: any) {
      alert('오류 발생: ' + err.message);
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
        }),
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
      alert('🎉 신규 경매 물품이 30분 타이머로 등록되었습니다!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const activeAuctions = auctions.filter(a => a.status === 'ACTIVE');
  const endedAuctions = auctions.filter(a => a.status === 'ENDED');

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
            <a
              href="/login"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-sm shadow-md transition-all"
            >
              로그인 하기
            </a>
            <a
              href="/register"
              className="w-full sm:w-auto px-6 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 transition-all"
            >
              회원가입 요청
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Compact Single-Row Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900/70 border border-slate-800 rounded-2xl px-5 py-3.5 shadow-lg">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              <Gavel className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-extrabold text-white leading-tight">
                외길 문파 경매장 & 금전 분배소
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                상품당 <strong className="text-amber-300">30분 타이머</strong> 진행 • 입찰 중 <strong className="text-indigo-300">최고 입찰자 익명</strong> 보호 • 종료 시 <strong className="text-emerald-300">낙찰자 닉네임 공개 & 포인트 100% 분배</strong>
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <a
            href="/shop"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-bold text-xs transition-all"
          >
            <span>📦 문파 상점</span>
          </a>
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>신규 30분 경매 등록</span>
          </button>
        </div>
      </div>

      {/* Unified 3-Column Same-Row Dashboard Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 items-stretch">
        {/* Column 1: 진행 중인 30분 경매 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                <span>진행 중인 경매 ({activeAuctions.length}건)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/25 text-[11px] font-bold text-amber-300">
                30분 타이머 • 익명
              </span>
            </div>

            {loading ? (
              <div className="text-center py-16 text-xs text-slate-400">경매 정보를 불러오는 중...</div>
            ) : activeAuctions.length === 0 ? (
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-8 text-center space-y-2 my-4">
                <Gavel className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">현재 진행 중인 경매가 없습니다</div>
                <p className="text-xs text-slate-500">
                  우측 상단 [신규 30분 경매 등록] 또는 [문파 상점]에서 전설 도안 선택 상자 경매를 시작할 수 있습니다.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {activeAuctions.map(auction => {
                  const nextMinBid =
                    auction.bidsCount === 0
                      ? auction.startingBid
                      : auction.currentBid + auction.minBidIncrement;
                  const timeLeftStr = formatRemainingTime(auction.endsAt);

                  return (
                    <div
                      key={auction.id}
                      className="bg-slate-950/70 border border-slate-800 rounded-xl p-4 space-y-3.5"
                    >
                      {/* 상단 상태 배지 & 30분 타이머 */}
                      <div className="flex items-center justify-between text-xs">
                        <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
                          입찰 {auction.bidsCount}회 진행중
                        </span>
                        <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black">
                          <Clock className="w-3.5 h-3.5 text-amber-400" />
                          <span>남은 시간 {timeLeftStr}</span>
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
                          <h3 className="text-base font-extrabold text-white truncate">
                            {auction.title}
                          </h3>
                          <p className="text-[11px] text-slate-400 truncate mt-0.5">
                            무기·방어구·장신구 통합 도안 상자
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
                            {auction.bidsCount === 0 ? '첫 입찰 시작가' : '현재 최고 입찰가'}
                          </div>
                          <div className="text-base font-black text-amber-300 mt-0.5">
                            {auction.currentBid.toLocaleString()} 금전
                          </div>
                        </div>
                        <div className="p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/80">
                          <div className="text-[11px] text-slate-400">현재 최고 입찰자</div>
                          <div className="text-xs font-bold text-amber-300 mt-1 flex items-center gap-1">
                            {auction.bidsCount > 0 ? (
                              <>
                                <Lock className="w-3 h-3 text-amber-400 shrink-0" />
                                <span className="truncate">익명 (종료시 공개)</span>
                              </>
                            ) : (
                              <span className="text-slate-500">입찰 대기 중</span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* 다음 최소 입찰 안내 */}
                      <div className="flex items-center justify-between px-3 py-2 rounded-lg bg-slate-900/90 border border-slate-800 text-xs">
                        <span className="text-slate-400">다음 최소 입찰 가능액</span>
                        <span className="text-white font-extrabold">
                          {nextMinBid.toLocaleString()} 금전 이상
                        </span>
                      </div>

                      {/* 입찰 & 관리자 마감 버튼 */}
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
                            경매 즉시 종료 • 낙찰자 공개 및 분배 (관리자)
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 2: 최근 낙찰 완료 및 금전 분배 내역 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-4">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <Trophy className="w-4 h-4 text-amber-400" />
                <span>최근 낙찰 완료 및 분배 ({endedAuctions.length}건)</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/25 text-[11px] font-bold text-emerald-300">
                종료 시 닉네임 공개
              </span>
            </div>

            {endedAuctions.length === 0 ? (
              <div className="bg-slate-950/50 border border-slate-800/80 rounded-xl p-8 text-center space-y-2.5 my-4">
                <Trophy className="w-7 h-7 text-slate-600 mx-auto" />
                <div className="text-sm font-bold text-slate-300">아직 마감된 경매가 없습니다</div>
                <p className="text-xs text-slate-400 leading-relaxed">
                  좌측 진행 중인 경매의 <strong className="text-amber-300">30분 타이머가 종료</strong>되면,<br />
                  이곳에 <strong className="text-white">최고 입찰자 닉네임</strong>과 <strong className="text-emerald-300">문파원 분배 정산표</strong>가 즉시 공개됩니다.
                </p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[430px] overflow-y-auto pr-1">
                {endedAuctions.map(item => {
                  const dist = item.distribution;
                  return (
                    <div key={item.id} className="bg-slate-950/70 border border-slate-800 rounded-xl p-3.5 space-y-3">
                      <div className="flex items-start justify-between gap-2 border-b border-slate-800 pb-2.5">
                        <div>
                          <span className="text-[11px] font-bold text-rose-400">[경매 종료 • 낙찰자 공개]</span>
                          <h3 className="text-sm font-extrabold text-white mt-0.5">{item.title}</h3>
                          <div className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-xs">
                            <Eye className="w-3 h-3 text-amber-400" />
                            <span className="text-slate-300">최종 낙찰자:</span>
                            <span className="text-amber-300 font-black">{item.highestBidderNickname || '입찰자 없음'}</span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className="text-[11px] text-slate-400">최종 낙찰가</span>
                          <div className="text-base font-black text-amber-300">
                            {item.currentBid.toLocaleString()} 금전
                          </div>
                        </div>
                      </div>

                      {dist ? (
                        <div className="space-y-2.5">
                          <div className="grid grid-cols-3 gap-1.5 p-2 bg-slate-900/90 rounded-lg text-center text-[11px]">
                            <div>
                              <div className="text-slate-400">총 포인트</div>
                              <div className="font-bold text-amber-300">{dist.totalPoints}P</div>
                            </div>
                            <div>
                              <div className="text-slate-400">1P당 가치</div>
                              <div className="font-bold text-emerald-400">{dist.goldPerPoint.toLocaleString()}G</div>
                            </div>
                            <div>
                              <div className="text-slate-400">금고 적립</div>
                              <div className="font-bold text-slate-300">{dist.leftoverGold.toLocaleString()}G</div>
                            </div>
                          </div>

                          <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-800">
                            <table className="w-full text-xs text-left">
                              <thead className="bg-slate-900 text-slate-400 font-bold sticky top-0">
                                <tr>
                                  <th className="py-1.5 px-2.5">문파원</th>
                                  <th className="py-1.5 px-2 text-center">포인트</th>
                                  <th className="py-1.5 px-2.5 text-right">분배금</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                                {dist.participants.map(p => (
                                  <tr key={p.nickname} className="hover:bg-slate-800/30">
                                    <td className="py-1.5 px-2.5 font-semibold text-white">{p.nickname}</td>
                                    <td className="py-1.5 px-2 text-center text-amber-300">{p.points}P</td>
                                    <td className="py-1.5 px-2.5 text-right font-bold text-emerald-400">
                                      +{p.share.toLocaleString()} 금전
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-500">분배 데이터 없음</div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Column 3: 실시간 포인트 분배 모의 계산기 */}
        <div className="bg-slate-900/75 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl flex flex-col justify-between">
          <div className="space-y-3.5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-sm sm:text-base font-extrabold text-white flex items-center space-x-2">
                <Calculator className="w-4 h-4 text-indigo-400" />
                <span>실시간 분배 모의 계산기</span>
              </h2>
              <span className="px-2 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 text-[11px] font-bold text-indigo-300">
                예상 배당금
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs text-slate-300 font-semibold">예상 낙찰 금전 입력</label>
                <div className="flex gap-1">
                  {[10000, 20000, 30000, 50000].map(val => (
                    <button
                      key={val}
                      onClick={() => setCalcGold(val)}
                      className={`px-2 py-0.5 rounded text-[11px] font-bold transition-colors ${
                        calcGold === val
                          ? 'bg-amber-500 text-slate-950'
                          : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                      }`}
                    >
                      {val / 10000}만
                    </button>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Coins className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  value={calcGold}
                  onChange={e => setCalcGold(parseInt(e.target.value, 10) || 0)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-amber-300 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {simDistribution && (
              <div className="space-y-3">
                <div className="grid grid-cols-3 gap-1.5 p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 text-center text-[11px]">
                  <div>
                    <div className="text-slate-400">총 누적 점수</div>
                    <div className="font-bold text-amber-300 mt-0.5">{simDistribution.totalPoints}P</div>
                  </div>
                  <div>
                    <div className="text-slate-400">1P당 배당금</div>
                    <div className="font-bold text-emerald-400 mt-0.5">
                      {simDistribution.goldPerPoint.toLocaleString()}G
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">금고 잔여금</div>
                    <div className="font-bold text-slate-300 mt-0.5">
                      {simDistribution.leftoverGold.toLocaleString()}G
                    </div>
                  </div>
                </div>

                <div className="max-h-56 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950/50">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-950 text-slate-400 font-bold sticky top-0">
                      <tr>
                        <th className="py-2 px-3">문파원 (순위)</th>
                        <th className="py-2 px-2 text-center">점수</th>
                        <th className="py-2 px-3 text-right">예상 분배금</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {simDistribution.participants.map((p, i) => (
                        <tr key={p.nickname} className="hover:bg-slate-800/30">
                          <td className="py-2 px-3">
                            <span className="text-[10px] text-slate-500 mr-1.5">{i + 1}.</span>
                            <span className="font-bold text-white">{p.nickname}</span>
                          </td>
                          <td className="py-2 px-2 text-center text-amber-300 font-semibold">{p.points}P</td>
                          <td className="py-2 px-3 text-right font-bold text-emerald-400">
                            +{p.share.toLocaleString()} 금전
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bid Modal */}
      {selectedAuction && (() => {
        const minRequired =
          selectedAuction.bidsCount === 0
            ? selectedAuction.startingBid
            : selectedAuction.currentBid + selectedAuction.minBidIncrement;

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

            <div className="flex items-center space-x-3 p-3 rounded-xl bg-slate-950 border border-slate-800">
              <img
                src={selectedAuction.imageUrl || '/images/shop-weapon.png'}
                alt={selectedAuction.title}
                className="w-12 h-12 rounded-xl border border-amber-400/50 object-cover shrink-0"
              />
              <div>
                <div className="text-sm font-bold text-white">{selectedAuction.title}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  시작 입찰가: <span className="text-slate-200 font-semibold">{selectedAuction.startingBid.toLocaleString()} 금전</span>
                  {' • '}호가 단위: <span className="text-emerald-400 font-bold">+{selectedAuction.minBidIncrement.toLocaleString()} 금전</span>
                </div>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800 space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-400">현재 최고 입찰가:</span>
                <span className="font-bold text-amber-300">
                  {selectedAuction.bidsCount === 0
                    ? `입찰 전 (시작가 ${selectedAuction.startingBid.toLocaleString()} 금전)`
                    : `${selectedAuction.currentBid.toLocaleString()} 금전 (익명 입찰자)`}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">이번 입찰 최소 가능 금액:</span>
                <span className="font-black text-emerald-400">
                  {minRequired.toLocaleString()} 금전 이상
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">남은 경매 시간:</span>
                <span className="font-bold text-amber-300">
                  {formatRemainingTime(selectedAuction.endsAt)} (종료 시 낙찰자 닉네임 공개)
                </span>
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
                <span>신규 30분 경매 물품 등록</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">문파 상점 단일 품목 선택</label>
              <div className="grid grid-cols-1 gap-1.5">
                {['전설 도안 선택 상자'].map(itemName => (
                  <button
                    key={itemName}
                    type="button"
                    onClick={() => setNewTitle(itemName)}
                    className={`px-3 py-2.5 rounded-xl text-left text-xs font-bold border transition-all flex items-center justify-between ${
                      newTitle === itemName
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span>{itemName} (무기 · 방어구 · 장신구 통합)</span>
                    {newTitle === itemName && <span className="text-[10px] font-black">✓ 선택됨</span>}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">물품명</label>
              <input
                type="text"
                required
                placeholder="전설 도안 선택 상자"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
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
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap gap-1">
                  {[10000, 20000, 30000, 50000].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewStartBid(v)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-semibold"
                    >
                      {(v / 10000)}만
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-300">2. 최소 입찰 단위 (호가)</label>
                <input
                  type="number"
                  required
                  value={newMinIncrement}
                  onChange={e => setNewMinIncrement(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-emerald-300 font-bold focus:outline-none focus:border-indigo-500"
                />
                <div className="flex flex-wrap gap-1">
                  {[100, 500, 1000, 5000].map(v => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setNewMinIncrement(v)}
                      className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[11px] text-slate-300 font-semibold"
                    >
                      +{v.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5">
              <div>
                💡 <strong>경매 진행 규칙 안내:</strong>
              </div>
              <div>
                • 시작가 <strong className="text-amber-300">{newStartBid.toLocaleString()} 금전</strong>으로 시작 시, 다음 사람은 최소 <strong className="text-emerald-300">{(newStartBid + newMinIncrement).toLocaleString()} 금전</strong>(+{newMinIncrement.toLocaleString()} 단위)부터 부를 수 있습니다.
              </div>
              <div>
                • 상품 1개당 <strong className="text-amber-300">⏱️ 30분 경매 종료 타이머</strong>가 자동 적용되며, 진행 중에는 최고 입찰자가 <strong className="text-indigo-300">익명</strong>으로 표시되고 30분 종료 시 <strong className="text-emerald-300">최고 입찰자의 닉네임이 공개</strong>됩니다.
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
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-md"
              >
                {createLoading ? '등록 중...' : '30분 경매 등록 완료'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
