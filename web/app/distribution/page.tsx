'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Coins, 
  Calculator, 
  Shield, 
  Trash2, 
  Plus, 
  Copy, 
  Check, 
  Search, 
  RotateCcw, 
  CheckCircle2, 
  Sparkles,
  Lock,
  ArrowRight,
  TrendingUp,
  Users
} from 'lucide-react';
import { MemberAttendance, ContentType, ParticipationType } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function DistributionPage() {
  const [attendance, setAttendance] = useState<MemberAttendance[]>([]);
  const { currentUser, authChecking } = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // 1. 경매 및 배점 기준 상태 (3만 금전 고정이 아닌, 실제 경매 낙찰 누적 금액 실시간 합산 반영)
  const [totalAuctionGold, setTotalAuctionGold] = useState<number>(0);
  const [endedAuctionsCount, setEndedAuctionsCount] = useState<number>(0);
  const [isCustomGold, setIsCustomGold] = useState<boolean>(false);
  const [manualWeight, setManualWeight] = useState<number>(1.0);
  const [cloneWeight, setCloneWeight] = useState<number>(0.25);

  // 복사 피드백 토글
  const [copied, setCopied] = useState(false);

  // 신규 문파원 추가 모달
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 데이터 로드
  const fetchAttendance = () => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setAttendance(d.attendance || []);
        if (typeof d.endedAuctionsCount === 'number') {
          setEndedAuctionsCount(d.endedAuctionsCount);
        }
        if (typeof d.totalAuctionGold === 'number' && !isCustomGold) {
          setTotalAuctionGold(d.totalAuctionGold);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 3500);
    const handleFocus = () => fetchAttendance();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [isCustomGold]);

  // 2. 실시간 정산 통계 계산 (가중치 및 총 낙찰금 기준)
  const stats = useMemo(() => {
    const totalRegistered = attendance.length;
    let activeParticipants = 0;
    let totalPoints = 0;

    const listWithCalculations = attendance.map(m => {
      // 실시간 가중치 기반 동적 점수 재산출
      const pSingi = m.singi?.type === 'MANUAL' ? manualWeight : 0;
      const pMihok = m.mihok?.type === 'MANUAL' ? manualWeight : 0;
      const pYosin = m.yosin?.type === 'MANUAL' ? manualWeight : m.yosin?.type === 'CLONE' ? cloneWeight : 0;
      const pGyeol = m.gyeolgye?.type === 'MANUAL' ? manualWeight : m.gyeolgye?.type === 'CLONE' ? cloneWeight : 0;
      const pts = Math.round((pSingi + pMihok + pYosin + pGyeol) * 100) / 100;

      if (pts > 0) {
        activeParticipants += 1;
        totalPoints += pts;
      }

      return {
        ...m,
        computedPoints: pts,
      };
    });

    totalPoints = Math.round(totalPoints * 100) / 100;
    const goldPerPoint = totalPoints > 0 ? totalAuctionGold / totalPoints : 0;

    let distributedSum = 0;
    const finalMembers = listWithCalculations.map(m => {
      const share = m.computedPoints > 0 ? Math.floor(m.computedPoints * goldPerPoint) : 0;
      distributedSum += share;
      return {
        ...m,
        share,
      };
    });

    const errorGold = totalAuctionGold - distributedSum;

    return {
      totalRegistered,
      activeParticipants,
      totalPoints,
      goldPerPoint: Math.round(goldPerPoint),
      distributedSum,
      errorGold,
      members: finalMembers,
    };
  }, [attendance, totalAuctionGold, manualWeight, cloneWeight]);

  // 문파원 참여 유형 토글 클릭 (수동 / 분신 / 미참)
  const handleToggleContent = async (nickname: string, content: ContentType, type: ParticipationType) => {
    // 낙관적 UI 업데이트
    setAttendance(prev => prev.map(m => {
      if (m.nickname !== nickname) return m;
      const updated = { ...m };
      const field = content === '신기' ? 'singi' : content === '미혹' ? 'mihok' : content === '요신' ? 'yosin' : 'gyeolgye';
      const pts = type === 'MANUAL' ? manualWeight : type === 'CLONE' ? cloneWeight : 0;
      updated[field] = { type, points: pts };
      return updated;
    }));

    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          content,
          type,
          manualWeight,
          cloneWeight,
        }),
      });
      fetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  // 전원 올 수동(4점) 일괄 반영
  const handleSetAllManual = async () => {
    if (!confirm('⚡ 모든 등록 문파원의 4개 컨텐츠를 [올 수동 (만점)]으로 일괄 반영하시겠습니까?')) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SET_ALL_MANUAL',
          manualWeight,
          cloneWeight,
        }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAttendance();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 전원 초기화(0점) 일괄 반영
  const handleResetAll = async () => {
    if (!confirm('⚠️ 경고: 모든 문파원의 컨텐츠 참여를 [미참 (0점)]으로 초기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_ALL' }),
      });
      const data = await res.json();
      if (data.success) {
        fetchAttendance();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 문파원 추가
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newMemberName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_MEMBER', nickname: name }),
      });
      const d = await res.json();
      if (!d.success) {
        alert(d.message || '추가 실패');
      } else {
        setNewMemberName('');
        setIsAddMemberOpen(false);
        fetchAttendance();
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 문파원 삭제
  const handleDeleteMember = async (nickname: string) => {
    if (!confirm(`정말로 [${nickname}] 문파원을 현황 목록에서 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_MEMBER', nickname }),
      });
      const d = await res.json();
      if (d.success) {
        fetchAttendance();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 디스코드 / 게임 공지 텍스트 복사
  const handleCopyNotice = () => {
    const activeList = stats.members
      .filter(m => m.computedPoints > 0)
      .sort((a, b) => b.computedPoints - a.computedPoints);

    let text = `📜 [외길 문파 주간 컨텐츠 정산 및 분배 안내]\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 총 경매 낙찰금: ${totalAuctionGold.toLocaleString()} 금전\n`;
    text += `👥 총 참여 인원: ${stats.totalRegistered}명 중 ${stats.activeParticipants}명 유효 참여\n`;
    text += `⭐ 총 누적 점수: ${stats.totalPoints.toFixed(2)} pt\n`;
    text += `🪙 1점당 분배 가치: ${stats.goldPerPoint.toLocaleString()} 금전\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `[문파원별 배분액]\n`;

    activeList.forEach((m, idx) => {
      text += `${idx + 1}. ${m.nickname}: ${m.computedPoints.toFixed(2)}pt -> ${m.share.toLocaleString()} 금전\n`;
    });

    if (stats.errorGold > 0) {
      text += `\n* 절사 잔여금: ${stats.errorGold.toLocaleString()} 금전 (문파 금고 적립)`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const filteredMembers = stats.members.filter(m =>
    m.nickname.toLowerCase().includes(search.toLowerCase())
  );

  if (authChecking) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-[#0d111e]/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Lock className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              정회원 전용 시스템
            </span>
            <h2 className="text-2xl font-black text-white">문파원 참여 & 배분 정산소</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              본 시스템의 상세 참여 점수, 가중치 설정, 실시간 금전 배분액 목록은<br />
              <strong>회원가입 후 관리자 승인을 받은 정회원</strong>만 열람하실 수 있습니다.
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
    <div className="space-y-6 max-w-7xl mx-auto pb-16">

      {/* 1. 경매 및 배점 기준 카드 (Image 2 Top) */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur">
        <div className="flex items-center space-x-2.5 mb-5">
          <Coins className="w-5 h-5 text-amber-400" />
          <h2 className="text-lg font-extrabold text-white">경매 및 배점 기준</h2>
        </div>

        {/* 총 경매 낙찰 금액 */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-xs font-semibold text-slate-400 block">
              누적 경매 낙찰 합산 금액 (금전) — 경매 종료 시 자동 합산 업데이트 ({endedAuctionsCount}건 완료)
            </label>
            {isCustomGold && (
              <button
                type="button"
                onClick={() => setIsCustomGold(false)}
                className="text-[11px] font-bold text-amber-300 hover:underline"
              >
                실제 경매 낙찰 합산금으로 자동 동기화 복원
              </button>
            )}
          </div>
          <div className="relative">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl select-none">
              💰
            </div>
            <input
              type="number"
              value={totalAuctionGold}
              onChange={e => {
                setIsCustomGold(true);
                setTotalAuctionGold(Math.max(0, Number(e.target.value) || 0));
              }}
              className="w-full bg-[#131929] border border-slate-700/80 rounded-xl pl-14 pr-4 py-3 text-amber-300 font-black text-xl sm:text-2xl focus:outline-none focus:border-amber-400 tracking-wide transition-colors"
              placeholder="0"
            />
          </div>
        </div>

        {/* 배점 가중치 */}
        <div className="mt-5 pt-5 border-t border-slate-800/80">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-300">배점 가중치</span>
            <span className="text-xs font-semibold text-purple-400">수동 참여 vs 분신</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 수동 참여 배점 */}
            <div className="bg-[#131929] border border-slate-800 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">수동 참여 배점</span>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  step="0.1"
                  value={manualWeight}
                  onChange={e => setManualWeight(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-transparent text-white font-bold text-lg w-28 focus:outline-none"
                />
                <span className="text-slate-400 text-sm font-semibold">점</span>
              </div>
            </div>

            {/* 분신 등록 배점 */}
            <div className="bg-[#131929] border border-slate-800 rounded-xl p-3.5">
              <span className="text-xs text-slate-400 block mb-1.5 font-medium">분신 등록 배점</span>
              <div className="flex items-center justify-between">
                <input
                  type="number"
                  step="0.05"
                  value={cloneWeight}
                  onChange={e => setCloneWeight(Math.max(0, Number(e.target.value) || 0))}
                  className="bg-transparent text-amber-400 font-bold text-lg w-28 focus:outline-none"
                />
                <span className="text-slate-400 text-sm font-semibold">점</span>
              </div>
            </div>
          </div>

          <p className="text-[11px] text-slate-500 mt-3">
            * 신기·미혹은 수동만 지원 / 요신·결계지는 수동 및 분신 선택 가능
          </p>
        </div>
      </div>

      {/* 2. 정산 요약 대시보드 (Image 2 Bottom) */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-extrabold text-white">정산 요약 대시보드</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-950/70 text-purple-300 border border-purple-800/70">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            실시간 자동 계산 중
          </span>
        </div>

        {/* 4대 스탯 카드 그리드 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">총 등록 인원</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-1">
              <span>{stats.totalRegistered}</span>
              <span className="text-xs font-bold text-slate-400">명</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">유효 참여 인원</div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.activeParticipants}</span>
              <span className="text-xs font-bold text-slate-400">명</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">총 누적 점수</div>
            <div className="text-2xl sm:text-3xl font-black text-purple-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.totalPoints.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400">점</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">1점당 분배 가치</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.goldPerPoint.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">금전</span>
            </div>
          </div>
        </div>

        {/* 하단 요약 및 공지 복사 버튼 */}
        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-300 font-medium">
            총 분배 완료액:{' '}
            <span className="font-extrabold text-amber-300">{stats.distributedSum.toLocaleString()}</span>
            {' / '}
            <span className="font-bold text-slate-200">{totalAuctionGold.toLocaleString()} 금전</span>
            {' '}
            <span className="text-emerald-400 font-bold ml-1">
              (오차 {stats.errorGold.toLocaleString()})
            </span>
          </div>

          <button
            onClick={handleCopyNotice}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 active:scale-95 text-white font-bold text-xs sm:text-sm shadow-lg shadow-purple-900/30 transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '클립보드 복사 완료!' : '디스코드/게임 공지 복사'}</span>
          </button>
        </div>
      </div>

      {/* 3. 문파원 참여 현황 목록 (Image 1) */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl backdrop-blur">
        {/* 헤더 바 */}
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center space-x-2">
            <Shield className="w-5 h-5 text-amber-400" />
            <h2 className="text-base sm:text-lg font-extrabold text-white">문파원 참여 현황 목록</h2>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
              {stats.totalRegistered}명
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 검색창 */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="문파원 닉네임 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#131929] border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
              />
            </div>

            {/* 일괄 액션 버튼 */}
            <button
              onClick={handleSetAllManual}
              className="px-3 py-1.5 rounded-lg bg-[#192238] hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              전원 올 수동(4점)
            </button>
            <button
              onClick={handleResetAll}
              className="px-3 py-1.5 rounded-lg bg-[#192238] hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
            >
              전원 초기화(0점)
            </button>
            <button
              onClick={() => setIsAddMemberOpen(true)}
              className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>문파원 추가</span>
            </button>
          </div>
        </div>

        {/* 표 본문 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 border-collapse">
            <thead className="bg-[#090d18] text-xs text-slate-400 border-b border-slate-800/90 font-bold">
              <tr>
                <th className="py-3 px-4 min-w-[120px]">문파원</th>
                <th className="py-3 px-3 text-center min-w-[140px]">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                      1. 신기
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">구슬 운반</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[140px]">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-pink-600/30 text-pink-300 border border-pink-500/40">
                      2. 미혹
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">보스/버프</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[170px]">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40">
                      3. 요신
                    </span>
                    <span className="text-[10px] text-amber-300 font-normal">분신 가능</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[170px]">
                  <div className="inline-flex items-center gap-1.5">
                    <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                      4. 결계지
                    </span>
                    <span className="text-[10px] text-amber-300 font-normal">분신 가능</span>
                  </div>
                </th>
                <th className="py-3 px-3 text-center min-w-[90px]">참여 점수</th>
                <th className="py-3 px-3 text-right min-w-[120px]">최종 배분액</th>
                <th className="py-3 px-3 text-center w-12">삭제</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#0d111e]/50">
              {filteredMembers.map((m) => {
                const isMe = currentUser?.nickname === m.nickname;
                return (
                  <tr 
                    key={m.nickname} 
                    className={`transition-colors hover:bg-slate-800/30 ${
                      isMe ? 'bg-indigo-950/30 border-l-2 border-indigo-400' : ''
                    }`}
                  >
                    {/* 문파원 닉네임 */}
                    <td className="py-3 px-4 font-bold text-slate-200">
                      <div className="flex items-center space-x-2">
                        <span>{m.nickname}</span>
                        {isMe && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold">
                            나
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 1. 신기 (구슬 운반): 수동 / 미참 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center bg-[#131929] p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleToggleContent(m.nickname, '신기', 'MANUAL')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.singi?.type === 'MANUAL'
                              ? 'bg-blue-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          수동
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '신기', 'ABSENT')}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            !m.singi || m.singi.type === 'ABSENT'
                              ? 'bg-slate-700/80 text-slate-300'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          미참
                        </button>
                      </div>
                    </td>

                    {/* 2. 미혹 (보스/버프): 수동 / 미참 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center bg-[#131929] p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleToggleContent(m.nickname, '미혹', 'MANUAL')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.mihok?.type === 'MANUAL'
                              ? 'bg-pink-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          수동
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '미혹', 'ABSENT')}
                          className={`px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            !m.mihok || m.mihok.type === 'ABSENT'
                              ? 'bg-slate-700/80 text-slate-300'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          미참
                        </button>
                      </div>
                    </td>

                    {/* 3. 요신 (분신 가능): 수동 / 분신 / 미참 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center bg-[#131929] p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleToggleContent(m.nickname, '요신', 'MANUAL')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.yosin?.type === 'MANUAL'
                              ? 'bg-purple-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          수동
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '요신', 'CLONE')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.yosin?.type === 'CLONE'
                              ? 'bg-amber-500 text-white font-extrabold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          분신
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '요신', 'ABSENT')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            !m.yosin || m.yosin.type === 'ABSENT'
                              ? 'bg-slate-700/80 text-slate-300'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          미참
                        </button>
                      </div>
                    </td>

                    {/* 4. 결계지 (분신 가능): 수동 / 분신 / 미참 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex items-center bg-[#131929] p-0.5 rounded-lg border border-slate-800">
                        <button
                          onClick={() => handleToggleContent(m.nickname, '결계', 'MANUAL')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.gyeolgye?.type === 'MANUAL'
                              ? 'bg-emerald-600 text-white shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          수동
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '결계', 'CLONE')}
                          className={`px-2.5 py-1 rounded text-xs font-bold transition-all ${
                            m.gyeolgye?.type === 'CLONE'
                              ? 'bg-amber-500 text-white font-extrabold shadow-sm'
                              : 'text-slate-400 hover:text-slate-200'
                          }`}
                        >
                          분신
                        </button>
                        <button
                          onClick={() => handleToggleContent(m.nickname, '결계', 'ABSENT')}
                          className={`px-2 py-1 rounded text-xs font-medium transition-all ${
                            !m.gyeolgye || m.gyeolgye.type === 'ABSENT'
                              ? 'bg-slate-700/80 text-slate-300'
                              : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          미참
                        </button>
                      </div>
                    </td>

                    {/* 참여 점수 */}
                    <td className="py-3 px-3 text-center">
                      <span className="inline-block px-2.5 py-1 rounded-md text-xs font-extrabold bg-purple-950/70 text-purple-300 border border-purple-800/70">
                        {m.computedPoints.toFixed(2)} pt
                      </span>
                    </td>

                    {/* 최종 배분액 */}
                    <td className="py-3 px-3 text-right">
                      <span className="font-black text-amber-400 text-sm">
                        {m.share.toLocaleString()} 금전
                      </span>
                    </td>

                    {/* 삭제 아이콘 */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={() => handleDeleteMember(m.nickname)}
                        className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                        title="문파원 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 문파원 추가 모달 */}
      {isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>신규 문파원 추가</span>
            </h3>
            <p className="text-xs text-slate-400 mb-4">
              참여 현황 목록에 등록할 문파원의 게임 닉네임을 입력하세요.
            </p>

            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  문파원 게임 닉네임
                </label>
                <input
                  type="text"
                  required
                  placeholder="예: 바람의검귀"
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white placeholder-slate-400 focus:outline-none focus:border-amber-400"
                />
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs transition-colors shadow-md disabled:opacity-50"
                >
                  {isSubmitting ? '추가 중...' : '등록하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
