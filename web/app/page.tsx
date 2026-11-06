'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Swords, Trophy, Users, Coins, Sparkles, Search, CheckCircle, ArrowRight, ShieldCheck } from 'lucide-react';
import { MemberAttendance } from '@/lib/types';

export default function HomePage() {
  const [data, setData] = useState<{
    totalMembers: number;
    activeMembersCount: number;
    totalGuildPoints: number;
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

  useEffect(() => {
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
  }, []);

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

  return (
    <div className="space-y-8">
      {/* Top Banner / Hero */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950/80 to-slate-900 border border-slate-800 p-6 sm:p-8 shadow-xl">
        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs font-semibold mb-4">
            <Sparkles className="w-3.5 h-3.5" />
            <span>외길 문파 주간 컨텐츠 & 경매 분배 포털</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight leading-snug">
            주간 4대 컨텐츠 참여도 기반<br />
            <span className="bg-gradient-to-r from-amber-400 to-amber-200 bg-clip-text text-transparent">
              공정하고 투명한 금전 분배 시스템
            </span>
          </h1>
          <p className="mt-3 text-sm text-slate-300 leading-relaxed">
            디스코드에 스크린샷을 올리면 봇이 자동으로 수동(1.0P) 및 분신(0.25P) 참여를 인식합니다.
            문파 경매 종료 시 낙찰된 금전(예: 30,000 금전)은 전 문파원의 참여 포인트에 비례하여 100% 자동 분배됩니다.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/auction"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-bold text-sm hover:from-amber-400 hover:to-amber-500 shadow-lg shadow-amber-500/20 transition-all"
            >
              <span>경매장 입찰 & 분배 현황</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/attendance"
              className="inline-flex items-center space-x-2 px-4 py-2.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-200 font-semibold text-sm hover:bg-slate-700 transition-colors"
            >
              <CheckCircle className="w-4 h-4 text-emerald-400" />
              <span>상세 출석부 확인</span>
            </Link>
          </div>
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-gradient-to-l from-indigo-500/10 to-transparent pointer-events-none" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">등록 문파원</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-white">
            {loading ? '...' : `${data?.totalMembers || 0}명`}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            이번 주 참여: <span className="text-emerald-400 font-bold">{data?.activeMembersCount || 0}명</span>
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">문파 총 참여 포인트</span>
            <Trophy className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-amber-300">
            {loading ? '...' : `${data?.totalGuildPoints || 0}P`}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            주 4회 올수동 기준 만점 4.0P
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">포인트 가치 (3만금전 기준)</span>
            <Coins className="w-4 h-4 text-yellow-400" />
          </div>
          <div className="text-2xl sm:text-3xl font-black text-emerald-400">
            {data?.totalGuildPoints ? `${Math.floor(30000 / data.totalGuildPoints).toLocaleString()}G` : '0G'}
          </div>
          <div className="mt-1 text-[11px] text-slate-400">
            1포인트당 실시간 예상 배당금
          </div>
        </div>

        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 sm:p-5">
          <div className="flex items-center justify-between text-slate-400 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">참여 배점 규칙</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-sm font-bold text-slate-200 space-y-0.5">
            <div>수동 참가: <span className="text-emerald-400 font-black">+1.0P</span></div>
            <div>분신 등록: <span className="text-sky-400 font-black">+0.25P</span></div>
          </div>
          <div className="mt-1 text-[10px] text-slate-400">
            요신 / 결계지 분신 등록 지원
          </div>
        </div>
      </div>

      {/* Main Attendance List */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        {/* Table Header Controls */}
        <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center space-x-2">
              <Swords className="w-5 h-5 text-indigo-400" />
              <span>주간 4대 컨텐츠 출석 및 포인트 현황표</span>
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              디스코드 봇 인식 및 관리자 입력 내역이 실시간으로 동기화됩니다.
            </p>
          </div>

          <div className="flex items-center space-x-3">
            {/* Filter buttons */}
            <div className="flex rounded-lg bg-slate-800 p-0.5 border border-slate-700 text-xs font-semibold">
              <button
                onClick={() => setFilter('ALL')}
                className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'ALL' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                전체 ({data?.totalMembers || 0})
              </button>
              <button
                onClick={() => setFilter('ACTIVE')}
                className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'ACTIVE' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                참여자 ({data?.activeMembersCount || 0})
              </button>
              <button
                onClick={() => setFilter('PERFECT')}
                className={`px-3 py-1.5 rounded-md transition-colors ${filter === 'PERFECT' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
              >
                올수동 만점 (4P)
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="문파원 닉네임 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-40 sm:w-52"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400 font-bold border-b border-slate-800">
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
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    데이터를 불러오는 중입니다...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    검색 조건에 맞는 문파원이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((member, idx) => {
                  const estShare = data?.totalGuildPoints && data.totalGuildPoints > 0
                    ? Math.floor((member.totalPoints / data.totalGuildPoints) * 30000)
                    : 0;

                  return (
                    <tr
                      key={member.nickname}
                      className="hover:bg-slate-800/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 text-center font-bold text-xs">
                        {idx === 0 && member.totalPoints > 0 ? (
                          <span className="text-amber-400">🥇 1</span>
                        ) : idx === 1 && member.totalPoints > 0 ? (
                          <span className="text-slate-300">🥈 2</span>
                        ) : idx === 2 && member.totalPoints > 0 ? (
                          <span className="text-amber-600">🥉 3</span>
                        ) : (
                          <span className="text-slate-500">{idx + 1}</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white flex items-center space-x-2">
                        <span>{member.nickname}</span>
                      </td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(member.yosin)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(member.gyeolgye)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(member.mihok)}</td>
                      <td className="py-3.5 px-4 text-center">{renderBadge(member.singi)}</td>
                      <td className="py-3.5 px-4 text-center font-black text-amber-300">
                        {member.totalPoints}P
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center space-x-2">
                          <div className="w-16 h-2 bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${member.rate >= 100 ? 'bg-amber-400' : member.rate > 0 ? 'bg-indigo-500' : 'bg-transparent'}`}
                              style={{ width: `${member.rate}%` }}
                            />
                          </div>
                          <span className="text-xs font-semibold text-slate-400 w-8">{member.rate}%</span>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold text-emerald-400">
                        {estShare > 0 ? `+${estShare.toLocaleString()}G` : '-'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
