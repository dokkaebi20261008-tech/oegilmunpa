'use client';

import { useState, useEffect } from 'react';
import { Gavel, Clock, Trophy, Coins, Plus, AlertCircle, CheckCircle2, ChevronRight, Calculator, ShieldAlert } from 'lucide-react';
import { AuctionItem, AuctionDistribution } from '@/lib/types';

export default function AuctionPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 입찰 모달
  const [selectedAuction, setSelectedAuction] = useState<AuctionItem | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(0);
  const [bidError, setBidError] = useState<string>('');
  const [bidLoading, setBidLoading] = useState(false);

  // 신규 등록 모달 (관리자 전용)
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newStartBid, setNewStartBid] = useState(10000);
  const [newMinIncrement, setNewMinIncrement] = useState(1000);
  const [newDuration, setNewDuration] = useState(72);
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
      alert(`🎉 [${selectedAuction.title}] ${bidAmount.toLocaleString()}금전 입찰이 성공적으로 등록되었습니다!`);
    } catch (err: any) {
      setBidError(err.message);
    } finally {
      setBidLoading(false);
    }
  };

  const handleEndAuction = async (auction: AuctionItem) => {
    if (!confirm(`'${auction.title}' 경매를 마감하고, 최종 낙찰 금액(${auction.currentBid.toLocaleString()}금전)을 문파원들에게 자동 분배하시겠습니까?`)) {
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
      alert(`✅ 경매가 마감되어 총 ${auction.currentBid.toLocaleString()}금전이 참여 포인트 기준으로 분배 완료되었습니다!`);
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
          minBidIncrement: newMinIncrement,
          durationHours: newDuration
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '등록 실패');
        setCreateLoading(false);
        return;
      }
      setIsCreateOpen(false);
      setNewTitle('');
      setNewDesc('');
      fetchAuctions();
      alert('🎉 신규 경매 물품이 정상 등록되었습니다!');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const activeAuctions = auctions.filter(a => a.status === 'ACTIVE');
  const endedAuctions = auctions.filter(a => a.status === 'ENDED');

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <Gavel className="w-7 h-7 text-amber-400" />
            <span>외길 문파 경매장 & 금전 분배소</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            문파 컨텐츠 획득 아이템을 경매에 부치고, 낙찰된 금전을 전 문파원의 참여 포인트(수동 1P / 분신 0.25P)에 비례하여 100% 분배합니다.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <button
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 transition-all self-start sm:self-auto"
          >
            <Plus className="w-4 h-4" />
            <span>신규 경매 등록 (관리자)</span>
          </button>
        )}
      </div>

      {/* Active Auctions Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <span>진행 중인 경매 ({activeAuctions.length}건)</span>
          </h2>
          <span className="text-xs text-slate-400">정회원 로그인 시 실시간 입찰 가능</span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">경매 목록 로딩 중...</div>
        ) : activeAuctions.length === 0 ? (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
            현재 진행 중인 경매가 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeAuctions.map(auction => (
              <div
                key={auction.id}
                className="bg-slate-900/70 border border-slate-800 hover:border-slate-700 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-2">
                    <span className="px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-bold">
                      진행중 • 입찰 {auction.bidsCount}회
                    </span>
                    <span className="flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5" />
                      <span>3일 남음</span>
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-white leading-snug">
                    {auction.title}
                  </h3>

                  <p className="mt-2 text-xs text-slate-400 line-clamp-2">
                    {auction.description || '문파 컨텐츠 보상 아이템'}
                  </p>

                  <div className="mt-4 p-3.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">시작 입찰가</span>
                      <span className="text-slate-300 font-semibold">{auction.startingBid.toLocaleString()} 금전</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-slate-400">최소 호가 단위</span>
                      <span className="text-slate-300 font-semibold">+{auction.minBidIncrement.toLocaleString()} 금전</span>
                    </div>
                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <span className="text-xs font-bold text-amber-400">현재 최고 입찰가</span>
                      <span className="text-lg font-black text-amber-300">
                        {auction.currentBid.toLocaleString()} 금전
                      </span>
                    </div>
                    {auction.highestBidderNickname && (
                      <div className="text-[11px] text-right text-slate-400">
                        최고 입찰자: <span className="text-white font-bold">{auction.highestBidderNickname}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-5 space-y-2">
                  {currentUser ? (
                    <button
                      onClick={() => handleOpenBid(auction)}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center space-x-2"
                    >
                      <Gavel className="w-4 h-4" />
                      <span>입찰 참여하기</span>
                    </button>
                  ) : (
                    <a
                      href="/login"
                      className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-sm transition-colors flex items-center justify-center space-x-2"
                    >
                      <ShieldAlert className="w-4 h-4 text-amber-400" />
                      <span>정회원 로그인 후 입찰</span>
                    </a>
                  )}

                  {currentUser?.role === 'ADMIN' && (
                    <button
                      onClick={() => handleEndAuction(auction)}
                      className="w-full py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-colors"
                    >
                      경매 마감 및 즉시 금전 분배 (관리자)
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Point-based Distribution Calculator & Ended Auctions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Ended Auctions and Detailed Distribution */}
        <div className="lg:col-span-2 space-y-4">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Trophy className="w-5 h-5 text-amber-400" />
            <span>최근 낙찰 완료 및 금전 분배 내역 ({endedAuctions.length}건)</span>
          </h2>

          {endedAuctions.length === 0 ? (
            <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-8 text-center text-slate-400">
              아직 마감된 경매가 없습니다. 위 진행 중인 경매를 마감하면 포인트 비례 분배표가 여기에 표시됩니다.
            </div>
          ) : (
            endedAuctions.map(item => {
              const dist = item.distribution;
              return (
                <div key={item.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <span className="text-xs font-bold text-rose-400 uppercase tracking-wider">[낙찰 완료]</span>
                      <h3 className="text-base font-bold text-white">{item.title}</h3>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-slate-400">최종 낙찰가 / 분배 총액</span>
                      <div className="text-xl font-black text-amber-300">
                        {item.currentBid.toLocaleString()} 금전
                      </div>
                      <div className="text-[11px] text-slate-400">
                        낙찰자: <span className="text-white font-bold">{item.highestBidderNickname || '낙찰자 없음'}</span>
                      </div>
                    </div>
                  </div>

                  {dist ? (
                    <div>
                      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-950/60 rounded-xl text-center text-xs mb-3">
                        <div>
                          <div className="text-slate-400">총 참여 포인트</div>
                          <div className="font-bold text-amber-300 mt-0.5">{dist.totalPoints}P</div>
                        </div>
                        <div>
                          <div className="text-slate-400">1포인트당 가치</div>
                          <div className="font-bold text-emerald-400 mt-0.5">{dist.goldPerPoint.toLocaleString()} 금전</div>
                        </div>
                        <div>
                          <div className="text-slate-400">문파 금고 적립금</div>
                          <div className="font-bold text-slate-300 mt-0.5">{dist.leftoverGold.toLocaleString()} 금전</div>
                        </div>
                      </div>

                      <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-800">
                        <table className="w-full text-xs text-left">
                          <thead className="bg-slate-950 text-slate-400 font-bold sticky top-0">
                            <tr>
                              <th className="py-2 px-3">문파원</th>
                              <th className="py-2 px-3 text-center">주간 포인트</th>
                              <th className="py-2 px-3 text-right">분배 지급액</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/60 text-slate-300">
                            {dist.participants.map(p => (
                              <tr key={p.nickname} className="hover:bg-slate-800/30">
                                <td className="py-2 px-3 font-semibold text-white">{p.nickname}</td>
                                <td className="py-2 px-3 text-center text-amber-300">{p.points}P</td>
                                <td className="py-2 px-3 text-right font-bold text-emerald-400">
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
            })
          )}
        </div>

        {/* Right Col: Instant 30,000 Gold Distribution Simulator */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-4">
          <div className="flex items-center space-x-2 text-white font-bold text-base">
            <Calculator className="w-5 h-5 text-indigo-400" />
            <span>실시간 포인트 분배 모의 계산기</span>
          </div>

          <p className="text-xs text-slate-400">
            상품 금액(예: 30,000 금전)을 입력하면 현재 주간 출석 포인트(수동 1P / 분신 0.25P)에 따라 각 문파원에게 몇 금전씩 분배되는지 즉시 계산합니다.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs text-slate-300 font-semibold">경매 총 금전 (금전)</label>
            <div className="relative">
              <Coins className="w-4 h-4 text-amber-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="number"
                value={calcGold}
                onChange={e => setCalcGold(parseInt(e.target.value, 10) || 0)}
                className="w-full pl-9 pr-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-sm font-bold text-amber-300 focus:outline-none focus:border-indigo-500"
              />
            </div>
            <div className="flex gap-1.5 pt-1">
              {[10000, 30000, 50000, 100000].map(val => (
                <button
                  key={val}
                  onClick={() => setCalcGold(val)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300"
                >
                  {val / 10000}만
                </button>
              ))}
            </div>
          </div>

          {simDistribution && (
            <div className="space-y-3 pt-2">
              <div className="p-3 bg-slate-950/80 rounded-xl border border-slate-800/80 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400">총 누적 포인트:</span>
                  <span className="font-bold text-amber-300">{simDistribution.totalPoints}P</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">1포인트당 분배금:</span>
                  <span className="font-bold text-emerald-400">
                    약 {simDistribution.goldPerPoint.toLocaleString()} 금전
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">문파 금고 잔여금:</span>
                  <span className="font-semibold text-slate-300">
                    {simDistribution.leftoverGold.toLocaleString()} 금전
                  </span>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-300">상위 분배 예상 문파원:</div>
              <div className="max-h-56 overflow-y-auto space-y-1 pr-1">
                {simDistribution.participants.slice(0, 10).map((p, i) => (
                  <div
                    key={p.nickname}
                    className="flex items-center justify-between p-2 rounded-lg bg-slate-950/50 border border-slate-800/50 text-xs"
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-[10px] text-slate-500 w-4">{i + 1}</span>
                      <span className="font-bold text-white">{p.nickname}</span>
                      <span className="text-[10px] text-amber-400 font-semibold">({p.points}P)</span>
                    </div>
                    <span className="font-bold text-emerald-400">+{p.share.toLocaleString()} 금전</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bid Modal */}
      {selectedAuction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Gavel className="w-5 h-5 text-amber-400" />
                <span>경매 입찰하기</span>
              </h3>
              <button
                onClick={() => setSelectedAuction(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            <div>
              <div className="text-sm font-bold text-white">{selectedAuction.title}</div>
              <div className="text-xs text-slate-400 mt-1">
                현재 최고 입찰가: <span className="font-bold text-amber-300">{selectedAuction.currentBid.toLocaleString()} 금전</span>
                {' '}(최소 호가: +{selectedAuction.minBidIncrement.toLocaleString()})
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
              <div className="flex gap-2 pt-1">
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
                {bidLoading ? '입찰 처리 중...' : `${bidAmount.toLocaleString()}금전 입찰`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Create Auction Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateAuction}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Plus className="w-5 h-5 text-amber-400" />
                <span>신규 경매 물품 등록 (관리자)</span>
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
              <label className="text-xs font-semibold text-slate-300">물품명 (아이템 이름)</label>
              <input
                type="text"
                required
                placeholder="예: [전설] 신기 쟁탈전 보물 상자"
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">물품 설명</label>
              <textarea
                rows={2}
                placeholder="낙찰된 금액은 전 문파원의 출석 포인트에 비례하여 자동 분배됩니다."
                value={newDesc}
                onChange={e => setNewDesc(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">최소 입찰가 (시작가)</label>
                <input
                  type="number"
                  required
                  value={newStartBid}
                  onChange={e => setNewStartBid(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-semibold text-slate-300">최소 입찰 단위 (호가)</label>
                <input
                  type="number"
                  required
                  value={newMinIncrement}
                  onChange={e => setNewMinIncrement(parseInt(e.target.value, 10) || 0)}
                  className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">경매 진행 시간 (시간)</label>
              <input
                type="number"
                value={newDuration}
                onChange={e => setNewDuration(parseInt(e.target.value, 10) || 24)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              />
            </div>

            <div className="flex space-x-3 pt-3">
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
                {createLoading ? '등록 중...' : '경매 등록 완료'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
