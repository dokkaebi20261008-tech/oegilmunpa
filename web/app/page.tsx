'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Swords, 
  Trophy, 
  Users, 
  Coins, 
  Search, 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  LogIn, 
  UserPlus,
  Calculator,
  Gavel,
  Award,
  ShoppingBag
} from 'lucide-react';
import { MemberAttendance } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function HomePage() {
  const { currentUser, authChecking } = useAuthUser();
  const [data, setData] = useState<{
    totalMembers: number;
    activeMembersCount: number;
    totalGuildPoints: number;
    totalAuctionGold: number;
    treasuryGold: number;
    guildTokens: number;
    endedAuctionsCount: number;
    attendance: MemberAttendance[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PERFECT'>('ALL');

  const loadDashboardData = () => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setData(d);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  };

  // 실시간 동기화 (로그인된 경우에만 주기적 폴링)
  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 4000);
    const handleFocus = () => loadDashboardData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [currentUser]);

  const attendanceList = data?.attendance || [];
  const filtered = attendanceList.filter(m => {
    const matchSearch = m.nickname.toLowerCase().includes(search.toLowerCase());
    if (!matchSearch) return false;
    if (filter === 'ACTIVE') return m.totalPoints > 0;
    if (filter === 'PERFECT') return m.totalPoints >= 4.0;
    return true;
  });

  const renderBadge = (item: { type: string; points: number }) => {
    if (item.type === 'MANUAL') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          수동 1.0P
        </span>
      );
    }
    if (item.type === 'CLONE') {
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          분신 0.25P
        </span>
      );
    }
    return <span className="text-slate-600 text-xs">-</span>;
  };

  // 인증 확인 중 로딩 화면
  if (authChecking) {
    return (
      <div className="flex flex-col items-center justify-center py-24 space-y-4">
        <div className="w-10 h-10 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">외길 문파 시스템 접속 확인 중...</p>
      </div>
    );
  }

  // 🔒 [비로그인 상태] 게이트웨이 화면 - 회원가입/로그인 전까지는 내부 현황을 볼 수 없음
  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto py-8 sm:py-14 space-y-10 animate-fadeIn">
        {/* Hero Gatekeeper Card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-[#0d1322] to-slate-950 border border-slate-800 shadow-2xl text-center">
          {/* Official Oegil Guild Banner */}
          <div className="relative w-full overflow-hidden border-b border-slate-800/80">
            <img
              src="/images/oegil-banner.jpg"
              alt="외길 문파 공식 배너 - 한 길만 걷는 우리, 지금도, 앞으로도"
              className="w-full h-auto max-h-[340px] object-cover object-center"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0d1322] via-transparent to-transparent opacity-80 pointer-events-none"></div>
          </div>

          <div className="relative z-10 p-6 sm:p-10 space-y-6 -mt-4 sm:-mt-6">
            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide shadow-lg backdrop-blur">
              <Lock className="w-3.5 h-3.5" />
              <span>정회원 전용 포털 (보안 접속)</span>
            </div>

            <h1 className="text-2xl sm:text-4xl font-black text-white tracking-tight leading-tight">
              외길 문파 통합 포털<br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                참여율 · 상점 · 경매 · 분배 시스템
              </span>
            </h1>

            <div className="max-w-xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 text-left space-y-3">
              <div className="text-amber-300 font-bold text-sm flex items-center space-x-2 border-b border-slate-800 pb-2.5">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>외길 문파 정회원 전용 이용 안내</span>
              </div>

              <ul className="space-y-2 text-xs sm:text-sm text-slate-300 leading-relaxed">
                <li className="flex items-start space-x-2">
                  <span className="text-amber-400 font-bold">•</span>
                  <span>
                    <strong>원스톱 관리:</strong> 컨텐츠 참여율 확인 → 문파 상점 희망 신청 → 1시간 자동 익명 경매 → 세금 10% 공제 후 문파 창고 금전 비례 분배까지 한곳에서 이루어집니다.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-indigo-400 font-bold">•</span>
                  <span>
                    <strong>열람 권한:</strong> 외부 유출 방지를 위해 <span className="text-amber-300 font-bold">회원가입 후 문파장 승인을 받은 정회원</span>만 로그인하여 확인하실 수 있습니다.
                  </span>
                </li>
                <li className="flex items-start space-x-2">
                  <span className="text-emerald-400 font-bold">•</span>
                  <span>
                    <strong>신규 가입:</strong> 게임 내 실제 캐릭터 닉네임으로 <strong>[회원가입 요청]</strong>을 신청하시면 문파장 승인 즉시 이용 가능합니다.
                  </span>
                </li>
              </ul>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3.5 max-w-md mx-auto">
              <Link
                href="/login"
                className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-sm shadow-xl shadow-amber-500/20 hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <LogIn className="w-4 h-4" />
                <span>로그인 하기</span>
              </Link>

              <Link
                href="/register"
                className="w-full sm:w-1/2 py-3.5 px-6 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm border border-slate-700 hover:border-slate-600 shadow-md hover:scale-105 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                <UserPlus className="w-4 h-4 text-amber-400" />
                <span>회원가입 요청</span>
              </Link>
            </div>
          </div>
        </div>

        {/* 4-Step Core Flow Guide */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 text-blue-400 flex items-center justify-center font-black text-sm">
              1
            </div>
            <h3 className="font-extrabold text-white text-sm pt-1">컨텐츠 참여율 집계</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              디스코드 인증으로 수동(1.0P)과 분신(0.25P) 점수가 실시간 누적됩니다.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center font-black text-sm">
              2
            </div>
            <h3 className="font-extrabold text-white text-sm pt-1">문파 상점 구매 희망</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              문파 재화(용맹의 증표)로 전설 도안 상자 구매 희망 신청 시 30분 뒤 자동 경매가 열립니다.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center font-black text-sm">
              3
            </div>
            <h3 className="font-extrabold text-white text-sm pt-1">30분 익명 경매</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              30분간 익명 경매 진행 후 낙찰자가 공개되며, 인게임 지정 분배 시 세금 10% 공제 후 창고에 세이브됩니다.
            </p>
          </div>

          <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-2">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center justify-center font-black text-sm">
              4
            </div>
            <h3 className="font-extrabold text-white text-sm pt-1">창고 세이브 금전 분배</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              문파 창고에 세이브된 금전(90%)을 누적 참여 포인트 비율대로 분배 및 차감합니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ✅ [로그인된 정회원 화면] 회원가입 & 승인된 회원만 볼 수 있는 대시보드
  const totalRegistered = data?.totalMembers || 0;
  const totalPoints = data?.totalGuildPoints || 0;
  const treasuryGold = data?.treasuryGold !== undefined ? data.treasuryGold : (data?.totalAuctionGold || 0);
  const guildTokens = data?.guildTokens || 0;
  const endedAuctionsCount = data?.endedAuctionsCount || 0;
  const goldPerPoint = totalPoints > 0 && treasuryGold > 0 ? treasuryGold / totalPoints : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Logged-in Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-[#0d1322] to-slate-900 border border-slate-800 shadow-2xl">
        {/* Official Oegil Guild Artwork Banner */}
        <div className="relative w-full overflow-hidden border-b border-slate-800/80">
          <img
            src="/images/oegil-banner.jpg"
            alt="외길 문파 공식 배너 - 한 길만 걷는 우리, 지금도, 앞으로도"
            className="w-full h-auto max-h-[320px] object-cover object-center"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1322] via-transparent to-transparent opacity-75 pointer-events-none"></div>
        </div>

        <div className="relative z-10 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>정회원 인증 완료</span>
              </div>
              <span className="text-xs text-slate-400">
                접속자: <strong className="text-white">{currentUser.nickname}</strong> ({currentUser.role === 'ADMIN' ? '문파장' : '정회원'})
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
              주간 4대 컨텐츠 참여도 기반<br />
              <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
                공정하고 투명한 금전 분배 포털
              </span>
            </h1>
            <div className="mt-3 space-y-1 text-xs sm:text-sm text-slate-300 leading-relaxed">
              <p>• 디스코드 인증 시 수동(1.0P) 및 분신(0.25P) 참여 점수가 실시간 자동 누적됩니다.</p>
              <p>• 상점 희망 신청 후 1시간 자동 경매가 종료되면 인게임 지정 분배 시 <strong>세금 10% 공제 후 90% 금전이 문파 창고에 세이브</strong>되어 포인트 비율로 분배됩니다.</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 shrink-0">
            <Link
              href="/shop"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-amber-300 font-bold text-sm border border-amber-500/30 transition-all"
            >
              <ShoppingBag className="w-4 h-4 text-amber-400" />
              <span>문파 상점 (용맹의 증표)</span>
            </Link>
            <Link
              href="/auction"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Gavel className="w-4 h-4" />
              <span>문파 경매장</span>
            </Link>
            <Link
              href="/distribution"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-purple-900/30 transition-all"
            >
              <Calculator className="w-4 h-4 text-amber-300" />
              <span>참여 & 분배 정산소</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* 4대 스탯 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 등록 문파원 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>등록 문파원</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-white">{totalRegistered}</span>
            <span className="text-xs text-slate-400">명</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            누적 참여자: <span className="text-indigo-400 font-semibold">{data?.activeMembersCount || 0}명</span>
          </div>
        </div>

        {/* 문파 총 누적 포인트 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>문파 총 누적 포인트</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-amber-400">{totalPoints}</span>
            <span className="text-xs text-slate-400">P</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            주간 미참 초기화 시에도 누적 점수 유지
          </div>
        </div>

        {/* 문파 창고 세이브 금전 (세금 10% 공제) */}
        <div className="bg-slate-900/60 border border-emerald-500/30 rounded-2xl p-5 hover:border-emerald-500/50 transition-colors">
          <div className="flex items-center justify-between text-emerald-300 text-xs font-semibold">
            <span>문파 창고 세이브 금전 (세금 10% 공제)</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-emerald-400">{treasuryGold.toLocaleString()}</span>
            <span className="text-xs text-slate-400">G</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            1P당 분배금: <span className="text-emerald-400 font-semibold">{Math.round(goldPerPoint).toLocaleString()}G</span> (낙찰 {endedAuctionsCount}건)
          </div>
        </div>

        {/* 문파 재화 (용맹의 증표) */}
        <div className="bg-slate-900/60 border border-amber-500/30 rounded-2xl p-5 hover:border-amber-500/50 transition-colors">
          <div className="flex items-center justify-between text-amber-300 text-xs font-semibold">
            <span>문파 재화 (용맹의 증표)</span>
            <Award className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-amber-300">{guildTokens.toLocaleString()}</span>
            <span className="text-xs text-slate-400">개</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-400">
            상점 경매 시작 시 <span className="text-rose-400 font-semibold">-11,500개</span> 자동 차감
          </div>
        </div>
      </div>

      {/* 실시간 출석 현황 테이블 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
              <Swords className="w-5 h-5 text-indigo-400" />
              <span>주간 4대 컨텐츠 출석 및 누적 포인트 현황표</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              디스코드 봇 인식 및 관리자 입력 내역이 실시간으로 동기화되며, 창고 세이브 금전 기준 예상 배당금이 계산됩니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Filter Pills */}
            <div className="inline-flex rounded-xl bg-slate-800 p-1 border border-slate-700 text-xs">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filter === 'ALL' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                전체 ({attendanceList.length})
              </button>
              <button
                onClick={() => setFilter('ACTIVE')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filter === 'ACTIVE' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                참여자 ({data?.activeMembersCount || 0})
              </button>
              <button
                onClick={() => setFilter('PERFECT')}
                className={`px-3 py-1 rounded-lg font-semibold transition-colors ${
                  filter === 'PERFECT' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                4P 이상
              </button>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="문파원 닉네임 검색..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 pr-4 py-1.5 rounded-xl bg-slate-800 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
              />
            </div>
          </div>
        </div>

        {/* Table Content */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/60 text-xs uppercase text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-12 text-center">순위</th>
                <th className="py-3 px-4">문파원 닉네임</th>
                <th className="py-3 px-4 text-center">1. 요신 토벌령</th>
                <th className="py-3 px-4 text-center">2. 결계지 방어</th>
                <th className="py-3 px-4 text-center">3. 미혹의 정원</th>
                <th className="py-3 px-4 text-center">4. 신기 쟁탈전</th>
                <th className="py-3 px-4 text-center">총 누적 포인트</th>
                <th className="py-3 px-4 text-center">주간 참여율</th>
                <th className="py-3 px-4 text-right">창고 금전 예상 배당금</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((m, index) => {
                const estGold = goldPerPoint > 0 && m.totalPoints > 0 ? Math.floor(m.totalPoints * goldPerPoint) : 0;
                const isMe = currentUser?.nickname === m.nickname;
                return (
                  <tr 
                    key={m.nickname} 
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isMe ? 'bg-indigo-950/40 border-l-2 border-indigo-400' : ''
                    }`}
                  >
                    <td className="py-3 px-4 text-center font-bold">
                      {index === 0 && m.totalPoints > 0 ? (
                        <span className="text-amber-400 flex items-center justify-center">🥇 1</span>
                      ) : index === 1 && m.totalPoints > 0 ? (
                        <span className="text-slate-300 flex items-center justify-center">🥈 2</span>
                      ) : index === 2 && m.totalPoints > 0 ? (
                        <span className="text-amber-600 flex items-center justify-center">🥉 3</span>
                      ) : (
                        <span className="text-slate-500">{index + 1}</span>
                      )}
                    </td>
                    <td className="py-3 px-4 font-bold text-white flex items-center space-x-2">
                      <span>{m.nickname}</span>
                      {isMe && (
                        <span className="px-1.5 py-0.2 rounded text-[10px] bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 font-bold">
                          나
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">{renderBadge(m.yosin)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(m.gyeolgye)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(m.mihok)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(m.singi)}</td>
                    <td className="py-3 px-4 text-center">
                      <span className="font-extrabold text-amber-300 text-sm">{m.totalPoints}P</span>
                      {(m.carriedPoints || 0) > 0 && (
                        <span className="block text-[10px] text-slate-400">
                          (이월 {m.carriedPoints}P)
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-2">
                        <div className="w-16 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              m.rate >= 100
                                ? 'bg-amber-400'
                                : m.rate >= 50
                                ? 'bg-indigo-500'
                                : 'bg-slate-600'
                            }`}
                            style={{ width: `${Math.min(100, m.rate)}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-400 font-semibold w-8 text-right">
                          {m.rate}%
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-extrabold text-emerald-400">
                      {estGold > 0 ? `+${estGold.toLocaleString()}G` : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
