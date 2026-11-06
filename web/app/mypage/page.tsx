'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Trophy, Coins, CheckCircle, ArrowRight } from 'lucide-react';
import { MemberAttendance, getRoleLabel } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function MyPage() {
  const { currentUser, authChecking } = useAuthUser();
  const [myAttendance, setMyAttendance] = useState<MemberAttendance | null>(null);
  const [guildSummary, setGuildSummary] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const loadMyData = () => {
    fetch(`/api/auth/me?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (!d.authenticated) {
          window.location.href = '/login';
          return;
        }
        setMyAttendance(d.myAttendance);
        setLoading(false);
      })
      .catch(() => setLoading(false));

    fetch(`/api/attendance?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(d => setGuildSummary(d));
  };

  useEffect(() => {
    loadMyData();
    const interval = setInterval(loadMyData, 4000);
    const handleFocus = () => loadMyData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  if (authChecking && !currentUser) {
    return null;
  }

  if (!currentUser) return null;

  const totalPoints = myAttendance?.totalPoints || 0;
  const carriedPoints = myAttendance?.carriedPoints || 0;
  const weeklyPoints =
    myAttendance?.weeklyPoints !== undefined
      ? myAttendance.weeklyPoints
      : (myAttendance?.yosin?.points || 0) +
        (myAttendance?.gyeolgye?.points || 0) +
        (myAttendance?.mihok?.points || 0) +
        (myAttendance?.singi?.points || 0);
  const guildTotalPoints = guildSummary?.totalGuildPoints || 0;
  const treasuryGold = guildSummary?.treasuryGold !== undefined ? guildSummary.treasuryGold : (guildSummary?.totalAuctionGold || 0);
  const endedAuctionsCount = guildSummary?.endedAuctionsCount || 0;
  const myShareRate = guildTotalPoints > 0 ? (totalPoints / guildTotalPoints) * 100 : 0;
  // 문파 창고 세이브 금전(세금 10% 공제 후) 기준 내 예상 배당금
  const myEstimatedGold = guildTotalPoints > 0 ? Math.floor((totalPoints / guildTotalPoints) * treasuryGold) : 0;

  const renderBadge = (item?: { type: string; points: number }) => {
    if (!item || item.type === 'ABSENT') {
      return <span className="text-xs text-slate-500 font-semibold">미참여 (0P)</span>;
    }
    if (item.type === 'MANUAL') {
      return <span className="text-xs font-bold text-emerald-400">⚔️ 직접 수동 참가 (+1.0P)</span>;
    }
    if (item.type === 'CLONE') {
      return <span className="text-xs font-bold text-sky-400">👤 분신 등록 참가 (+0.25P)</span>;
    }
    return null;
  };

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Profile Card */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-xl flex flex-col sm:flex-row items-center gap-6">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 to-indigo-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-500/20">
          {currentUser.nickname.slice(0, 1)}
        </div>
        <div className="text-center sm:text-left space-y-1">
          <div className="flex items-center justify-center sm:justify-start space-x-2">
            <h1 className="text-2xl font-black text-white">{currentUser.nickname}</h1>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-bold">
              {getRoleLabel(currentUser.role)}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            문파 공식 활동명: <strong className="text-slate-200">{currentUser.nickname}</strong> <span className="text-slate-500">(로그인 아이디 비공개 보호됨)</span>
          </p>
          <div className="pt-2 flex flex-wrap items-center justify-center sm:justify-start gap-3 text-xs text-slate-400">
            <span>총 누적 포인트: <strong className="text-amber-300 text-sm font-black">{totalPoints}P</strong></span>
            <span>•</span>
            <span>이월 점수: <strong className="text-slate-300 font-bold">{carriedPoints}P</strong></span>
            <span>•</span>
            <span>이번 주 점수: <strong className="text-sky-300 font-bold">{weeklyPoints}P</strong></span>
            <span>•</span>
            <span>주간 참여율: <strong className="text-emerald-400 text-sm font-bold">{myAttendance?.rate || 0}%</strong></span>
          </div>
        </div>
      </div>

      {/* Dividend Estimation Card */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-gradient-to-br from-indigo-950/60 to-slate-900/80 border border-indigo-900/50 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between text-indigo-300 text-xs font-bold uppercase">
            <span>문파 내 지분율</span>
            <Trophy className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-black text-white">
            {myShareRate.toFixed(1)}%
          </div>
          <p className="text-[11px] text-slate-400">
            전체 누적 참여 포인트({guildTotalPoints}P) 중 내 기여 비중
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-950/40 to-slate-900/80 border border-emerald-900/40 rounded-2xl p-5 space-y-2">
          <div className="flex items-center justify-between gap-2 text-emerald-300 text-xs font-bold uppercase">
            <span className="whitespace-nowrap">문파 창고 세이브 금전 배당금</span>
            <span className="px-2 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 whitespace-nowrap shrink-0">
              세금 10% 공제
            </span>
          </div>
          <div className="text-3xl font-black text-emerald-300">
            +{myEstimatedGold.toLocaleString()} 금전
          </div>
          <p className="text-[11px] text-slate-400">
            창고 세이브 금전({treasuryGold.toLocaleString()} 금전, 낙찰 {endedAuctionsCount}건) 중 내 포인트 비례 분배금
          </p>
        </div>
      </div>

      {/* My Weekly Participation Breakdown */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4 shadow-lg">
        <h2 className="text-base font-bold text-white flex items-center space-x-2">
          <CheckCircle className="w-5 h-5 text-emerald-400" />
          <span>이번 주 나의 4대 컨텐츠 참여 내역</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">1. 요신 토벌령</div>
              <div className="mt-1">{renderBadge(myAttendance?.yosin)}</div>
            </div>
            <div className="text-right font-black text-sm text-amber-300">
              {myAttendance?.yosin?.points || 0}P
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">2. 결계지 방어</div>
              <div className="mt-1">{renderBadge(myAttendance?.gyeolgye)}</div>
            </div>
            <div className="text-right font-black text-sm text-amber-300">
              {myAttendance?.gyeolgye?.points || 0}P
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">3. 미혹의 정원</div>
              <div className="mt-1">{renderBadge(myAttendance?.mihok)}</div>
            </div>
            <div className="text-right font-black text-sm text-amber-300">
              {myAttendance?.mihok?.points || 0}P
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-950/70 border border-slate-800/80 flex items-center justify-between">
            <div>
              <div className="text-xs text-slate-400 font-semibold">4. 신기 쟁탈전</div>
              <div className="mt-1">{renderBadge(myAttendance?.singi)}</div>
            </div>
            <div className="text-right font-black text-sm text-amber-300">
              {myAttendance?.singi?.points || 0}P
            </div>
          </div>
        </div>

        <div className="pt-2 flex justify-end">
          <Link
            href="/auction"
            className="inline-flex items-center space-x-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-bold"
          >
            <span>경매장 & 창고 금전 내역 보기</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
