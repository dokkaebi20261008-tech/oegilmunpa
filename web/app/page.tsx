'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { 
  Swords, 
  Trophy, 
  Users, 
  Coins, 
  Sparkles, 
  Search, 
  CheckCircle, 
  ArrowRight, 
  ShieldCheck, 
  Lock, 
  UserCheck, 
  KeyRound, 
  Clock, 
  Shield, 
  LogIn, 
  UserPlus,
  Calculator,
  Gavel
} from 'lucide-react';
import { MemberAttendance } from '@/lib/types';

export default function HomePage() {
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [authChecking, setAuthChecking] = useState(true);
  const [data, setData] = useState<{
    totalMembers: number;
    activeMembersCount: number;
    totalGuildPoints: number;
    attendance: MemberAttendance[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'PERFECT'>('ALL');

  // 1. 로그인 여부 먼저 확인
  useEffect(() => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.authenticated && d.user) {
          setCurrentUser(d.user);
          loadDashboardData();
        } else {
          setCurrentUser(null);
          setLoading(false);
        }
        setAuthChecking(false);
      })
      .catch(() => {
        setCurrentUser(null);
        setAuthChecking(false);
        setLoading(false);
      });
  }, []);

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
    if (!currentUser) return;
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
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-900 via-[#0d1322] to-slate-950 border border-slate-800 p-8 sm:p-12 shadow-2xl text-center">
          {/* Background decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-indigo-600/10 blur-[100px] rounded-full pointer-events-none"></div>

          <div className="relative z-10 space-y-6">
            {/* Guild Shield Icon */}
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-tr from-amber-600 via-indigo-600 to-indigo-500 shadow-xl shadow-indigo-600/30 border border-indigo-400/30 mb-2">
              <Shield className="w-10 h-10 text-white" />
            </div>

            <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold tracking-wide">
              <Lock className="w-3.5 h-3.5" />
              <span>정회원 전용 포털 (보안 접속)</span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
              외길 문파 주간 컨텐츠 &<br />
              <span className="bg-gradient-to-r from-amber-400 via-amber-200 to-amber-400 bg-clip-text text-transparent">
                공정 금전 분배 시스템
              </span>
            </h1>

            <div className="max-w-2xl mx-auto bg-slate-900/90 border border-slate-800 rounded-2xl p-5 text-sm text-slate-300 leading-relaxed space-y-2">
              <div className="text-amber-300 font-bold flex items-center justify-center space-x-2">
                <ShieldCheck className="w-4 h-4" />
                <span>문파원 회원가입 및 로그인 안내</span>
              </div>
              <p className="text-xs sm:text-sm text-slate-300">
                본 시스템의 <strong>주간 4대 컨텐츠 출석부, 참여율, 포인트 통계, 문파 경매장 및 금전 배분 현황</strong>은 
                외부 비인가자 유출 방지를 위해 <span className="text-amber-400 font-bold">회원가입 후 문파장의 승인을 받은 정회원만 열람</span>하실 수 있습니다.
              </p>
              <p className="text-xs text-slate-400">
                아직 계정이 없으신 문파원님께서는 게임 내 캐릭터 닉네임으로 <strong>[회원가입 요청]</strong>을 진행해 주세요.
              </p>
            </div>

            {/* Primary Action Buttons */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-4 max-w-md mx-auto">
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

        {/* 3-Step Guide Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center font-black">
              1
            </div>
            <h3 className="text-base font-bold text-white">회원가입 요청</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              아이디, 비밀번호와 함께 <strong>게임 내 실제 캐릭터 닉네임</strong>을 입력하여 정회원 등록을 요청합니다.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center font-black">
              2
            </div>
            <h3 className="text-base font-bold text-white">문파장 승인</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              문파장이 등록 요청을 1:1 확인 후 승인합니다. 승인이 완료되면 대기 상태가 해제되어 즉시 로그인 가능합니다.
            </p>
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              3
            </div>
            <h3 className="text-base font-bold text-white">실시간 참여 & 분배</h3>
            <p className="text-xs text-slate-400 leading-relaxed">
              로그인 후 본인의 출석 점수(수동 1P / 분신 0.25P)와 경매 낙찰금 기준 실시간 배분금을 확인하실 수 있습니다.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ✅ [로그인된 정회원 화면] 회원가입 & 승인된 회원만 볼 수 있는 대시보드
  const totalRegistered = data?.totalMembers || 0;
  const totalPoints = data?.totalGuildPoints || 0;
  const sampleAuctionGold = 30000;
  const goldPerPoint = totalPoints > 0 ? Math.round(sampleAuctionGold / totalPoints) : 0;

  return (
    <div className="space-y-8 animate-fadeIn">
      {/* Logged-in Welcome Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl">
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
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            디스코드에 스크린샷을 올리면 봇이 자동으로 수동(1.0P) 및 분신(0.25P) 참여를 인식합니다.
            문파 경매 종료 시 낙찰된 금전(예: 30,000 금전)은 전 문파원의 참여 포인트에 비례하여 100% 자동 분배됩니다.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/distribution"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:brightness-110 text-white font-bold text-sm shadow-lg shadow-purple-900/30 transition-all"
            >
              <Calculator className="w-4 h-4 text-amber-300" />
              <span>참여 & 분배 현황 정산소</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/auction"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all"
            >
              <Gavel className="w-4 h-4" />
              <span>문파 경매장</span>
            </Link>
            <Link
              href="/attendance"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-white font-semibold text-sm border border-slate-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>상세 출석부</span>
            </Link>
          </div>
        </div>

        <div className="hidden lg:block absolute right-8 top-1/2 -translate-y-1/2 opacity-20 hover:opacity-30 transition-opacity pointer-events-none">
          <Trophy className="w-64 h-64 text-amber-400" />
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
            이번 주 참여: <span className="text-indigo-400 font-semibold">{data?.activeMembersCount || 0}명</span>
          </div>
        </div>

        {/* 문파 총 참여 포인트 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>문파 총 참여 포인트</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-amber-400">{totalPoints}</span>
            <span className="text-xs text-slate-400">P</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            주 4회 올수동 기준 만점 4.0P
          </div>
        </div>

        {/* 포인트 가치 (3만금전 기준) */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>포인트 가치 (3만금전 기준)</span>
            <Coins className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="mt-2 flex items-baseline space-x-2">
            <span className="text-3xl font-black text-emerald-400">{goldPerPoint.toLocaleString()}</span>
            <span className="text-xs text-slate-400">G</span>
          </div>
          <div className="mt-2 text-[11px] text-slate-500">
            1포인트당 실시간 예상 배당금
          </div>
        </div>

        {/* 참여 배점 규칙 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
          <div className="flex items-center justify-between text-slate-400 text-xs font-semibold">
            <span>참여 배점 규칙</span>
            <ShieldCheck className="w-4 h-4 text-sky-400" />
          </div>
          <div className="mt-2 text-xs font-bold text-slate-200 space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-400 font-normal">수동 참가:</span>
              <span className="text-emerald-400">+1.0P</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-normal">분신 등록:</span>
              <span className="text-sky-400">+0.25P</span>
            </div>
          </div>
          <div className="mt-1 text-[10px] text-slate-500">
            요신 / 결계지 분신 등록 지원
          </div>
        </div>
      </div>

      {/* 실시간 출석 현황 테이블 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-5 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-extrabold text-white flex items-center space-x-2">
              <Swords className="w-5 h-5 text-indigo-400" />
              <span>주간 4대 컨텐츠 출석 및 포인트 현황표</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              디스코드 봇 인식 및 관리자 입력 내역이 실시간으로 동기화됩니다.
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
                올수동 만점 (4P)
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
                <th className="py-3 px-4 text-center">총 포인트</th>
                <th className="py-3 px-4 text-center">참여율</th>
                <th className="py-3 px-4 text-right">3만G 예상 분배</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtered.map((m, index) => {
                const estGold = goldPerPoint > 0 ? Math.floor(m.totalPoints * goldPerPoint) : 0;
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
