'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Users,
  Plus,
  X,
  Sparkles,
  Gavel,
  RotateCcw,
  Play,
  CheckCircle2,
  Coins,
  ArrowRight,
  History,
  UserPlus,
  Check
} from 'lucide-react';
import { ShopItem, LadderState } from '@/lib/types';

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const [ladderState, setLadderState] = useState<LadderState | null>(null);
  const [ladderHistory, setLadderHistory] = useState<LadderState[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // 각 상품별 수동 닉네임 추가 입력 상태
  const [addNickInputs, setAddNickInputs] = useState<Record<string, string>>({});

  // 사다리 설정 상태
  const [onlyWithApplicants, setOnlyWithApplicants] = useState(true);
  const [selectedStartCol, setSelectedStartCol] = useState<number | 'RANDOM'>('RANDOM');
  const [isRunningLadder, setIsRunningLadder] = useState(false);
  const [animProgress, setAnimProgress] = useState(100); // 0 ~ 100 애니메이션 진행률
  const [lastLadderId, setLastLadderId] = useState<string | null>(null);

  // 사다리 당첨 상품 -> 경매 등록 모달 상태
  const [auctionModalItem, setAuctionModalItem] = useState<ShopItem | null>(null);
  const [startingBid, setStartingBid] = useState<number>(20000);
  const [minBidIncrement, setMinBidIncrement] = useState<number>(500);
  const [durationHours, setDurationHours] = useState<number>(24);
  const [creatingAuction, setCreatingAuction] = useState(false);

  const fetchShopData = () => {
    fetch('/api/shop', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setItems(d.items || []);
          setLadderState(d.ladderState || null);
          setLadderHistory(d.ladderHistory || []);
        }
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

    fetchShopData();
    const interval = setInterval(fetchShopData, 3500);
    const handleFocus = () => fetchShopData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // 새로운 사다리 결과가 도착하면 자동으로 경로 애니메이션 재생
  useEffect(() => {
    if (ladderState && ladderState.id !== lastLadderId) {
      setLastLadderId(ladderState.id);
      triggerPathAnimation();
    }
  }, [ladderState, lastLadderId]);

  const triggerPathAnimation = () => {
    setAnimProgress(0);
    let step = 0;
    const timer = setInterval(() => {
      step += 5;
      if (step >= 100) {
        setAnimProgress(100);
        clearInterval(timer);
      } else {
        setAnimProgress(step);
      }
    }, 35);
  };

  // 내 캐릭터로 희망 신청/취소 토글
  const handleToggleMyApplication = async (itemId: string) => {
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_APPLICANT', itemId })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 특정 문파원 닉네임을 희망자에 추가
  const handleAddApplicant = async (itemId: string, e: React.FormEvent) => {
    e.preventDefault();
    const nick = (addNickInputs[itemId] || '').trim();
    if (!nick) return;

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_APPLICANT', itemId, nickname: nick })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
        setAddNickInputs(prev => ({ ...prev, [itemId]: '' }));
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 희망자 태그 삭제
  const handleRemoveApplicant = async (itemId: string, nickname: string) => {
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE_APPLICANT', itemId, nickname })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 전체 희망자 초기화
  const handleResetAllApplicants = async () => {
    if (!confirm('3가지 상품의 구매 희망자 명단을 모두 초기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_APPLICANTS' })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 사다리 타기 실행
  const handleRunLadder = async () => {
    setIsRunningLadder(true);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RUN_LADDER',
          onlyWithApplicants,
          startCol: selectedStartCol === 'RANDOM' ? undefined : selectedStartCol
        })
      });
      const d = await res.json();
      if (d.success) {
        setLadderState(d.ladderState);
        setLadderHistory(d.ladderHistory || []);
        setLastLadderId(d.ladderState.id);
        triggerPathAnimation();
      } else {
        alert(d.message || '사다리 실행 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsRunningLadder(false);
    }
  };

  // 경매 시작 모달 열기
  const handleOpenAuctionModal = (item: ShopItem) => {
    setAuctionModalItem(item);
    setStartingBid(20000);
    setMinBidIncrement(500);
    setDurationHours(24);
  };

  // 뽑힌 상품으로 경매 오픈 실행
  const handleCreateAuctionFromShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionModalItem) return;
    setCreatingAuction(true);

    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_AUCTION_FROM_SHOP',
          itemId: auctionModalItem.id,
          startingBid,
          minBidIncrement,
          durationHours
        })
      });
      const d = await res.json();
      if (!d.success) {
        alert(d.message || '경매 등록 실패');
        setCreatingAuction(false);
        return;
      }
      setAuctionModalItem(null);
      fetchShopData();
      if (confirm(`🎉 [${d.auction.title}] 경매가 시작되었습니다!\n\n• 최소 시작 입찰가: ${startingBid.toLocaleString()} 금전\n• 최소 입찰 단위(호가): +${minBidIncrement.toLocaleString()} 금전\n\n지금 바로 경매장 페이지로 이동하시겠습니까?`)) {
        window.location.href = '/auction';
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingAuction(false);
    }
  };

  // 비로그인 게이트키퍼
  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <ShoppingBag className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              정회원 전용 상점 & 사다리 추첨소
            </span>
            <h2 className="text-2xl font-black text-white">문파 상점 & 상품 사다리 추첨</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              3대 도안 선택 상자 구매 희망 신청, 상품 선정 사다리 타기, 경매 연동 기능은<br />
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

  // 사다리 SVG 좌표 계산 헬퍼
  const renderLadderSvg = (ladder: LadderState) => {
    const svgWidth = 600;
    const svgHeight = 320;
    const padX = 95;
    const padTop = 30;
    const padBottom = 30;
    const usableW = svgWidth - padX * 2;
    const usableH = svgHeight - padTop - padBottom;

    const getX = (col: number) =>
      ladder.numCols <= 1 ? svgWidth / 2 : padX + (col / (ladder.numCols - 1)) * usableW;
    const getY = (row: number) =>
      padTop + (row / (ladder.totalSteps + 1)) * usableH;

    // 애니메이션 진행률에 따른 경로 슬라이스
    const totalPts = ladder.path.length;
    const visibleCount = Math.max(1, Math.ceil((animProgress / 100) * totalPts));
    const visiblePath = ladder.path.slice(0, visibleCount);
    const polylinePoints = visiblePath.map(pt => `${getX(pt.col)},${getY(pt.row)}`).join(' ');

    return (
      <svg
        viewBox={`0 0 ${svgWidth} ${svgHeight}`}
        className="w-full max-w-2xl mx-auto h-64 sm:h-80 select-none overflow-visible"
      >
        <defs>
          <linearGradient id="pathGlow" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#fbbf24" />
            <stop offset="50%" stopColor="#f59e0b" />
            <stop offset="100%" stopColor="#10b981" />
          </linearGradient>
          <filter id="glowFilter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* 세로 기둥 줄 */}
        {Array.from({ length: ladder.numCols }).map((_, cIdx) => (
          <line
            key={`v-${cIdx}`}
            x1={getX(cIdx)}
            y1={getY(0)}
            x2={getX(cIdx)}
            y2={getY(ladder.totalSteps + 1)}
            stroke="#334155"
            strokeWidth="5"
            strokeLinecap="round"
          />
        ))}

        {/* 가로 다리 줄 (Rungs) */}
        {ladder.rungs.map((rg, idx) => (
          <line
            key={`r-${idx}`}
            x1={getX(rg.col)}
            y1={getY(rg.row)}
            x2={getX(rg.col + 1)}
            y2={getY(rg.row)}
            stroke="#475569"
            strokeWidth="4"
            strokeLinecap="round"
          />
        ))}

        {/* 당첨 이동 경로 하이라이트 선 */}
        {visiblePath.length > 1 && (
          <polyline
            fill="none"
            stroke="url(#pathGlow)"
            strokeWidth="7"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={polylinePoints}
            filter="url(#glowFilter)"
          />
        )}

        {/* 출발 지점 마커 */}
        <circle
          cx={getX(ladder.chosenStartCol)}
          cy={getY(0)}
          r="9"
          fill="#fbbf24"
          stroke="#0f172a"
          strokeWidth="3"
        />

        {/* 도착 지점 마커 (애니메이션 완료 시 강조) */}
        {animProgress >= 100 && (
          <circle
            cx={getX(ladder.winningBottomCol)}
            cy={getY(ladder.totalSteps + 1)}
            r="11"
            fill="#10b981"
            stroke="#0f172a"
            strokeWidth="3"
          />
        )}
      </svg>
    );
  };

  return (
    <div className="space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <ShoppingBag className="w-7 h-7 text-amber-400" />
            <span>문파 상점 & 상품 추첨 사다리</span>
          </h1>
          <div className="mt-1.5 text-xs sm:text-sm text-slate-400 space-y-0.5">
            <p>• 3가지 도안 선택 상자별로 구매를 희망하는 문파원을 모집합니다.</p>
            <p>• 희망자가 모이면 사다리 타기로 이번 경매 상품을 추첨하며, 결과는 모든 문파원에게 실시간 공유됩니다.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            onClick={handleResetAllApplicants}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 font-semibold text-xs transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>희망자 전체 초기화</span>
          </button>
          <Link
            href="/auction"
            className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Gavel className="w-3.5 h-3.5" />
            <span>문파 경매장 바로가기</span>
          </Link>
        </div>
      </div>

      {/* STEP 1: 문파 상점 3대 도안 선택 상자 & 상품별 희망자 모집 */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-1 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 font-black text-xs">
              STEP 1
            </span>
            <h2 className="text-lg sm:text-xl font-extrabold text-white">
              문파 상점 3대 상품 & 구매 희망자 신청
            </h2>
          </div>
          <span className="text-xs text-slate-400">
            원하는 상자에 [희망 신청]을 누르거나 문파원 닉네임을 등록하세요
          </span>
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">문파 상점 목록 불러오는 중...</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
            {items.map((item) => {
              const applicants = item.applicants || [];
              const isMeApplied = applicants.includes(currentUser.nickname);
              const isWinner = ladderState?.winnerItem?.itemId === item.id;

              return (
                <div
                  key={item.id}
                  className={`rounded-2xl bg-[#141824] border transition-all flex flex-col justify-between overflow-hidden shadow-xl ${
                    isWinner
                      ? 'border-amber-400 ring-2 ring-amber-400/30'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div>
                    {/* 인게임 상점 슬롯 동일 디자인 헤더 */}
                    <div className="p-4 bg-[#1c1f26] border-b border-slate-800/90 flex items-center space-x-4 relative">
                      {isWinner && (
                        <span className="absolute top-2.5 right-3 px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-[10px] shadow">
                          👑 사다리 당첨 상품
                        </span>
                      )}
                      <div className="relative w-16 h-16 rounded-xl overflow-hidden shrink-0 border border-amber-400/60 shadow-md bg-[#2a2215]">
                        <img
                          src={item.imageUrl || '/images/shop-weapon.png'}
                          alt={item.name}
                          className="w-full h-full object-cover"
                        />
                      </div>

                      <div className="space-y-1 min-w-0 flex-1">
                        <h3 className="text-base font-extrabold text-slate-100 truncate">
                          {item.name}
                        </h3>
                        <div className="flex items-center space-x-1.5">
                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-500/30 border border-amber-400/60 text-[10px] text-amber-300 font-black">
                            🪙
                          </span>
                          <span className="text-base font-black text-[#e05252] tracking-tight">
                            {item.price.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs font-extrabold text-[#e5c158]">
                          {item.weeklyLimit || '문파 주간 한정: (0/10)'}
                        </div>
                      </div>
                    </div>

                    {/* 구매 희망자 명단 영역 */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-300 flex items-center space-x-1.5">
                          <Users className="w-4 h-4 text-indigo-400" />
                          <span>구매 희망자 명단</span>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-extrabold ${
                            applicants.length > 0
                              ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {applicants.length}명 희망
                        </span>
                      </div>

                      {/* 희망자 배지 목록 */}
                      <div className="min-h-[64px] p-3 rounded-xl bg-slate-950/80 border border-slate-800/80 flex flex-wrap items-start gap-1.5">
                        {applicants.length === 0 ? (
                          <span className="text-xs text-slate-500 m-auto">
                            아직 이 상품을 신청한 희망자가 없습니다.
                          </span>
                        ) : (
                          applicants.map(nick => (
                            <span
                              key={nick}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-950/80 border border-indigo-500/40 text-xs font-bold text-indigo-200"
                            >
                              <span>{nick}</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveApplicant(item.id, nick)}
                                className="text-slate-400 hover:text-rose-400 ml-1"
                                title="희망자 제외"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          ))
                        )}
                      </div>

                      {/* 내 캐릭터 원클릭 희망 신청 / 취소 버튼 */}
                      <button
                        type="button"
                        onClick={() => handleToggleMyApplication(item.id)}
                        className={`w-full py-2.5 px-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center space-x-1.5 ${
                          isMeApplied
                            ? 'bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40'
                            : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-950/50'
                        }`}
                      >
                        {isMeApplied ? (
                          <>
                            <Check className="w-4 h-4" />
                            <span>내 캐릭터({currentUser.nickname}) 희망 신청됨 (클릭 시 취소)</span>
                          </>
                        ) : (
                          <>
                            <UserPlus className="w-4 h-4" />
                            <span>✋ [{currentUser.nickname}] 이 상품 희망 신청하기</span>
                          </>
                        )}
                      </button>

                      {/* 다른 문파원 수동 추가 입력폼 */}
                      <form onSubmit={e => handleAddApplicant(item.id, e)} className="flex gap-1.5 pt-1">
                        <input
                          type="text"
                          placeholder="희망 문파원 닉네임 직접 추가..."
                          value={addNickInputs[item.id] || ''}
                          onChange={e =>
                            setAddNickInputs(prev => ({ ...prev, [item.id]: e.target.value }))
                          }
                          className="flex-1 px-3 py-1.5 rounded-lg bg-slate-950 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          type="submit"
                          className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 shrink-0"
                        >
                          + 추가
                        </button>
                      </form>
                    </div>
                  </div>

                  {/* 하단 즉시 경매 오픈 버튼 */}
                  <div className="px-4 pb-4 pt-2 border-t border-slate-800/60">
                    <button
                      type="button"
                      onClick={() => handleOpenAuctionModal(item)}
                      className="w-full py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 font-extrabold text-xs transition-all flex items-center justify-center space-x-1.5"
                    >
                      <Gavel className="w-3.5 h-3.5" />
                      <span>이 상품으로 경매 시작하기 (최소 입찰가 설정)</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* STEP 2: 상품 선정 사다리 타기 & 실시간 결과 공유 */}
      <div className="bg-[#0d121f] border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-300 font-black text-xs">
                STEP 2
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">
                🪜 문파 상점 상품 선정 사다리 타기
              </h2>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                전 문파원 실시간 결과 공유
              </span>
            </div>
            <p className="text-xs sm:text-sm text-slate-400">
              각 상품별 희망자가 있을 때 사다리를 돌려 이번 회차에 구매 및 경매를 진행할 도안 상자를 공정하게 추첨합니다.
            </p>
          </div>

          {/* 사다리 옵션 및 실행 버튼 */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setOnlyWithApplicants(prev => !prev)}
              className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all ${
                onlyWithApplicants
                  ? 'bg-indigo-600/20 border-indigo-500/40 text-indigo-300'
                  : 'bg-slate-900 border-slate-700 text-slate-400'
              }`}
            >
              {onlyWithApplicants ? '✓ 희망자 있는 상품 우선 추첨' : '3대 도안 상자 전체 추첨'}
            </button>

            <select
              value={selectedStartCol}
              onChange={e =>
                setSelectedStartCol(
                  e.target.value === 'RANDOM' ? 'RANDOM' : Number(e.target.value)
                )
              }
              className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-400"
            >
              <option value="RANDOM">🎲 출발 번호: 무작위 자동</option>
              <option value={0}>1번 사다리에서 출발</option>
              <option value={1}>2번 사다리에서 출발</option>
              <option value={2}>3번 사다리에서 출발</option>
            </select>

            <button
              type="button"
              onClick={handleRunLadder}
              disabled={isRunningLadder}
              className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 via-amber-500 to-amber-400 hover:brightness-110 active:scale-95 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition-all disabled:opacity-50"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>{isRunningLadder ? '사다리 추첨 중...' : '사다리 타기 시작!'}</span>
            </button>
          </div>
        </div>

        {/* 사다리 그래픽 보드 */}
        {!ladderState ? (
          <div className="py-14 text-center space-y-4 bg-slate-950/60 rounded-2xl border border-slate-800/80">
            <div className="text-4xl">🪜</div>
            <div className="space-y-1">
              <div className="text-base font-bold text-white">
                아직 실행된 사다리 추첨 결과가 없습니다
              </div>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                위 상품 카드에서 희망자를 확인한 뒤 <strong>[사다리 타기 시작!]</strong> 버튼을 누르면 모든 문파원 화면에 사다리 경로와 당첨 상품이 실시간 표시됩니다.
              </p>
            </div>
            <button
              type="button"
              onClick={handleRunLadder}
              className="inline-flex items-center space-x-2 px-6 py-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm shadow-lg"
            >
              <Play className="w-4 h-4 fill-slate-950" />
              <span>첫 사다리 추첨 시작하기</span>
            </button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 sm:p-6">
              {/* 상단 출발 노드 헤더 */}
              <div
                className="grid gap-2 max-w-2xl mx-auto mb-2 text-center"
                style={{ gridTemplateColumns: `repeat(${ladderState.numCols}, minmax(0, 1fr))` }}
              >
                {ladderState.startLabels.map((label, idx) => {
                  const isChosen = idx === ladderState.chosenStartCol;
                  return (
                    <div key={label} className="flex flex-col items-center">
                      <span
                        className={`px-3 py-1.5 rounded-xl text-xs font-extrabold border transition-all ${
                          isChosen
                            ? 'bg-amber-400 text-slate-950 border-amber-300 shadow-lg shadow-amber-500/20 scale-105'
                            : 'bg-slate-900 text-slate-400 border-slate-800'
                        }`}
                      >
                        {isChosen ? `🚩 ${label} (출발)` : label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* 중앙 사다리 SVG */}
              {renderLadderSvg(ladderState)}

              {/* 하단 도착 상품 슬롯 */}
              <div
                className="grid gap-3 max-w-2xl mx-auto mt-2"
                style={{ gridTemplateColumns: `repeat(${ladderState.numCols}, minmax(0, 1fr))` }}
              >
                {ladderState.bottomItems.map((bItem, idx) => {
                  const isWinSlot = idx === ladderState.winningBottomCol && animProgress >= 100;
                  return (
                    <div
                      key={`${bItem.itemId}-${idx}`}
                      className={`p-3 rounded-2xl border text-center flex flex-col items-center space-y-2 transition-all ${
                        isWinSlot
                          ? 'bg-gradient-to-b from-emerald-950/90 to-slate-900 border-emerald-400 ring-2 ring-emerald-400/30 shadow-xl scale-105'
                          : 'bg-slate-900/70 border-slate-800 opacity-75'
                      }`}
                    >
                      {isWinSlot && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-400 text-slate-950 font-black text-[10px]">
                          🎉 당첨 상품!
                        </span>
                      )}
                      <img
                        src={bItem.imageUrl}
                        alt={bItem.name}
                        className="w-12 h-12 rounded-xl border border-amber-400/50 object-cover"
                      />
                      <div className="text-xs font-extrabold text-white leading-snug break-keep">
                        {bItem.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        희망자:{' '}
                        <strong className="text-amber-300">
                          {bItem.applicants.length > 0
                            ? `${bItem.applicants.join(', ')} (${bItem.applicants.length}명)`
                            : '없음'}
                        </strong>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 사다리 최종 당첨 결과 요약 배너 & 즉시 경매 시작 버튼 */}
            <div className="bg-gradient-to-r from-amber-950/40 via-slate-900 to-emerald-950/40 border border-amber-500/40 rounded-2xl p-5 sm:p-6 flex flex-col lg:flex-row items-center justify-between gap-5">
              <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                <img
                  src={ladderState.winnerItem.imageUrl}
                  alt={ladderState.winnerItem.name}
                  className="w-16 h-16 rounded-2xl border-2 border-amber-400 shadow-lg object-cover shrink-0"
                />
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className="px-2.5 py-0.5 rounded-full bg-amber-400 text-slate-950 font-black text-xs">
                      👑 사다리 추첨 완료
                    </span>
                    <span className="text-xs text-slate-400">
                      추첨 실행: <strong className="text-slate-200">{ladderState.executedBy}</strong> •{' '}
                      {new Date(ladderState.createdAt).toLocaleTimeString()}
                    </span>
                  </div>
                  <h3 className="text-xl sm:text-2xl font-black text-white">
                    뽑힌 상품: <span className="text-amber-300">{ladderState.winnerItem.name}</span>
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-300">
                    구매 희망자:{' '}
                    <strong className="text-emerald-300">
                      {ladderState.winnerItem.applicants.length > 0
                        ? ladderState.winnerItem.applicants.join(', ')
                        : '전 문파원 입찰 가능'}
                    </strong>
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2.5 shrink-0 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={triggerPathAnimation}
                  className="px-3.5 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold border border-slate-700 transition-all"
                >
                  🔄 사다리 경로 다시보기
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const matched =
                      items.find(i => i.id === ladderState.winnerItem.itemId) || items[0];
                    if (matched) handleOpenAuctionModal(matched);
                  }}
                  className="inline-flex items-center justify-center space-x-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 transition-all"
                >
                  <Gavel className="w-4 h-4" />
                  <span>뽑힌 상품 경매 시작하기 (입찰가/단위 설정)</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* 최근 사다리 추첨 결과 이력 (모든 문파원 열람 가능) */}
        {ladderHistory.length > 0 && (
          <div className="pt-4 border-t border-slate-800/80 space-y-3">
            <h3 className="text-sm font-bold text-slate-300 flex items-center space-x-2">
              <History className="w-4 h-4 text-amber-400" />
              <span>최근 사다리 추첨 결과 기록 ({ladderHistory.length}건)</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ladderHistory.slice(0, 4).map((hist, idx) => (
                <div
                  key={hist.id}
                  className="p-3 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center space-x-2.5 min-w-0">
                    <img
                      src={hist.winnerItem.imageUrl}
                      alt={hist.winnerItem.name}
                      className="w-8 h-8 rounded-lg border border-amber-500/40 shrink-0"
                    />
                    <div className="truncate">
                      <div className="font-bold text-white truncate">
                        {idx === 0 ? '🔥 [최신] ' : ''}
                        {hist.winnerItem.name}
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {hist.chosenStartCol + 1}번 출발 → 당첨 • 희망자:{' '}
                        {hist.winnerItem.applicants.length > 0
                          ? hist.winnerItem.applicants.join(', ')
                          : '전체'}
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-500 shrink-0 ml-2">
                    {new Date(hist.createdAt).toLocaleTimeString()}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* STEP 3: 뽑힌 상품 경매 등록 모달 (최소 구매 입찰가 & 최소 호가 단위 설정) */}
      {auctionModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleCreateAuctionFromShop}
            className="bg-[#0f1626] border border-slate-700 rounded-3xl max-w-lg w-full p-6 sm:p-7 shadow-2xl space-y-5"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div className="flex items-center space-x-2.5">
                <Gavel className="w-5 h-5 text-amber-400" />
                <h3 className="text-lg font-black text-white">
                  뽑힌 상품 경매 시작 설정
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setAuctionModalItem(null)}
                className="text-slate-400 hover:text-white text-sm"
              >
                ✕
              </button>
            </div>

            {/* 선택된 상점 아이템 카드 */}
            <div className="p-3.5 rounded-2xl bg-[#1c1f26] border border-slate-700 flex items-center space-x-3.5">
              <img
                src={auctionModalItem.imageUrl || '/images/shop-weapon.png'}
                alt={auctionModalItem.name}
                className="w-14 h-14 rounded-xl border border-amber-400/60 shrink-0"
              />
              <div>
                <span className="text-[11px] font-bold text-amber-400">경매 대상 상품</span>
                <div className="text-base font-extrabold text-white">{auctionModalItem.name}</div>
                <div className="text-xs text-slate-400 mt-0.5">
                  구매 희망자:{' '}
                  <strong className="text-emerald-300">
                    {auctionModalItem.applicants?.length > 0
                      ? auctionModalItem.applicants.join(', ')
                      : '제한 없음 (전 문파원)'}
                  </strong>
                </div>
              </div>
            </div>

            {/* 1. 최소 구매 입찰가 (시작가) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 block">
                1. 최소 구매할 수 있는 시작 입찰가 (금전)
              </label>
              <div className="relative">
                <Coins className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min={100}
                  step={100}
                  value={startingBid}
                  onChange={e => setStartingBid(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-lg font-black text-amber-300 focus:outline-none focus:border-amber-400"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  금전
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[10000, 15000, 20000, 30000, 50000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setStartingBid(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      startingBid === val
                        ? 'bg-amber-500/20 border-amber-400 text-amber-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    {val.toLocaleString()} 금전
                  </button>
                ))}
              </div>
            </div>

            {/* 2. 최소 입찰가를 부르는 단위 (호가 단위) */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-200 block">
                2. 최소 입찰가를 부르는 단위 (호가 단위, 금전)
              </label>
              <div className="relative">
                <Plus className="w-4 h-4 text-emerald-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="number"
                  required
                  min={10}
                  step={100}
                  value={minBidIncrement}
                  onChange={e => setMinBidIncrement(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  className="w-full pl-10 pr-14 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-lg font-black text-emerald-300 focus:outline-none focus:border-emerald-400"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                  금전 단위
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {[100, 500, 1000, 2000, 5000].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setMinBidIncrement(val)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-all ${
                      minBidIncrement === val
                        ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300'
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    +{val.toLocaleString()} 금전
                  </button>
                ))}
              </div>
            </div>

            {/* 실시간 입찰 진행 예시 미리보기 */}
            <div className="p-4 rounded-2xl bg-slate-950/90 border border-slate-800 space-y-1.5 text-xs">
              <div className="font-bold text-amber-300 flex items-center space-x-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span>입찰 진행 규칙 미리보기</span>
              </div>
              <p className="text-slate-300">
                • 첫 입찰자는 최소 시작가인{' '}
                <strong className="text-amber-300">{startingBid.toLocaleString()} 금전</strong>부터 입찰할 수 있습니다.
              </p>
              <p className="text-slate-300">
                • 다음 입찰자는{' '}
                <strong className="text-emerald-300">+{minBidIncrement.toLocaleString()} 금전</strong> 단위가 적용되어 최소{' '}
                <strong className="text-white">
                  {(startingBid + minBidIncrement).toLocaleString()} 금전
                </strong>
                부터 부를 수 있습니다.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setAuctionModalItem(null)}
                className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold text-xs sm:text-sm"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={creatingAuction}
                className="flex-1 py-3 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs sm:text-sm shadow-xl shadow-amber-500/20 disabled:opacity-50"
              >
                {creatingAuction ? '경매 오픈 중...' : '🚀 이 조건으로 경매 즉시 오픈'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
