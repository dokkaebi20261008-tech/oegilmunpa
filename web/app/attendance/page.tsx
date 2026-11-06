'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, RotateCcw, Search, UserCheck, Shield, Sparkles, RefreshCw, Coins, Award } from 'lucide-react';
import { MemberAttendance, ContentType, ParticipationType } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<MemberAttendance[]>([]);
  const [treasuryGold, setTreasuryGold] = useState<number>(0);
  const [guildTokens, setGuildTokens] = useState<number>(0);
  const { currentUser, authChecking } = useAuthUser();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // 관리자 직접 체크 모달
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedContent, setSelectedContent] = useState<ContentType>('요신');
  const [selectedType, setSelectedType] = useState<ParticipationType>('MANUAL');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAttendance = () => {
    fetch('/api/attendance', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setAttendance(d.attendance || []);
        if (typeof d.treasuryGold === 'number') setTreasuryGold(d.treasuryGold);
        if (typeof d.guildTokens === 'number') setGuildTokens(d.guildTokens);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchAttendance();
    const interval = setInterval(fetchAttendance, 4000);
    const handleFocus = () => fetchAttendance();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleManualCheck = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setActionLoading(true);

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: selectedMember,
          content: selectedContent,
          type: selectedType,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '체크 실패');
        setActionLoading(false);
        return;
      }
      setIsCheckModalOpen(false);
      fetchAttendance();
      alert(`✅ [${selectedMember}] 님의 [${selectedContent}] (${selectedType === 'CLONE' ? '분신 0.25P' : '수동 1.0P'}) 출석이 반영되었습니다!`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // 1) 주간 컨텐츠만 미참으로 초기화 (누적 점수는 유지)
  const handleWeeklyContentReset = async () => {
    if (
      !confirm(
        '🔄 [주간 컨텐츠만 미참 초기화 (점수 유지)]\n\n일주일 컨텐츠 주기가 지나 4대 컨텐츠(요신·결계·미혹·신기) 참여 상태만 모두 [미참]으로 초기화하시겠습니까?\n\n※ 문파원들의 누적 점수는 0으로 초기화되지 않고 그대로 보존(이월)됩니다.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_WEEKLY_CONTENT' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '초기화 실패');
        return;
      }
      alert(data.message);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2) 누적 점수 0P 초기화 (문파 창고 금전이 모두 분배된 후에만 가능)
  const handleResetAllPoints = async () => {
    if (treasuryGold > 0) {
      alert(
        `⚠️ 현재 문파 창고에 미분배 세이브 금전(${treasuryGold.toLocaleString()} 금전)이 남아 있습니다.\n\n점수 초기화는 문파 창고 금전이 모두 분배(0 금전)된 후에만 가능합니다. 먼저 [참여·분배 현황] 또는 [문파 경매장]에서 금전 분배 완료 처리를 진행해 주세요.`
      );
      return;
    }

    if (
      !confirm(
        '⚠️ [누적 점수 0P 완전 초기화]\n\n금전 분배가 모두 완료되었습니까?\n확인 시 모든 문파원의 이월 점수 및 주간 출석 점수가 0P로 완전 초기화됩니다.'
      )
    ) {
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_ALL_POINTS' })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '점수 초기화 실패');
        return;
      }
      alert(data.message);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const filtered = attendance.filter(m =>
    m.nickname.toLowerCase().includes(search.toLowerCase())
  );

  const renderBadge = (item: { type: string; points: number }) => {
    if (item.type === 'MANUAL') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          수동 1.0P
        </span>
      );
    }
    if (item.type === 'CLONE') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          분신 0.25P
        </span>
      );
    }
    return <span className="text-slate-600 text-xs">미참</span>;
  };

  if (authChecking) {
    return null;
  }

  if (!currentUser) {
    return (
      <div className="max-w-2xl mx-auto py-12 px-4 text-center space-y-6 animate-fadeIn">
        <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-8 sm:p-10 shadow-2xl space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-400 flex items-center justify-center mx-auto shadow-lg shadow-amber-500/10">
            <Shield className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
              정회원 전용 페이지
            </span>
            <h2 className="text-2xl font-black text-white">상세 출석부 & 포인트 관리소</h2>
            <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-md mx-auto">
              본 페이지의 4대 주간 컨텐츠 출석부 및 문파원 포인트 목록은<br />
              <strong>회원가입 후 관리자 승인을 받은 정회원</strong>만 열람하실 수 있습니다.
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            <span>상세 출석부 & 누적 포인트 관리소</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            주간 컨텐츠는 매주 <strong className="text-sky-300">[주간 컨텐츠만 미참 초기화]</strong>로 리셋하며, <strong className="text-amber-300">누적 점수</strong>는 금전 분배가 모두 완료된 뒤 초기화할 수 있습니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <a
            href="/distribution"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs shadow-md transition-all"
          >
            <span>💰 참여 & 배분 정산소</span>
          </a>
          {currentUser?.role === 'ADMIN' && (
            <>
              <button
                onClick={() => {
                  setSelectedMember(attendance[0]?.nickname || '');
                  setIsCheckModalOpen(true);
                }}
                className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>수동 출석 체크</span>
              </button>
              <button
                onClick={handleWeeklyContentReset}
                className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-sky-500/15 hover:bg-sky-500/25 text-sky-300 border border-sky-500/30 font-bold text-xs transition-colors"
                title="4대 주간 컨텐츠만 미참으로 초기화하고 누적 점수는 유지합니다"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>주간 컨텐츠만 미참 초기화 (점수 유지)</span>
              </button>
              <button
                onClick={handleResetAllPoints}
                className={`inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl font-bold text-xs border transition-colors ${
                  treasuryGold > 0
                    ? 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                    : 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border-rose-500/30'
                }`}
                title={
                  treasuryGold > 0
                    ? `문파 창고 세이브 금전(${treasuryGold.toLocaleString()}G)을 모두 분배해야 점수 초기화가 가능합니다`
                    : '금전 분배 완료 후 모든 누적 점수를 0P로 초기화합니다'
                }
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>누적 점수 0P 초기화 {treasuryGold > 0 ? '(미분배 금전 있음)' : '(분배 완료 시)'}</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Discord Bot & Treasury Summary Banner */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 bg-slate-900/80 border border-indigo-950 rounded-2xl p-4 sm:p-5 flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-white">디스코드 봇 실시간 연동 및 주간/누적 안내</h3>
            <div className="text-xs text-slate-400 space-y-0.5">
              <p>• <strong>스크린샷 업로드(+1.0P):</strong> 디스코드에 참여 스크린샷 업로드 시 항상 <strong className="text-emerald-300">수동 참가(+1.0P)</strong>로 자동 반영됩니다.</p>
              <p>• <strong>다수 인원 수동 추가:</strong> <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">!수동추가 닉1 닉2 닉3 신기</code> 처럼 2명 이상 한 번에 명령어 입력 가능</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-4 sm:p-5 flex items-center justify-between">
          <div className="space-y-1">
            <div className="text-xs font-bold text-emerald-300 flex items-center space-x-1.5">
              <Coins className="w-4 h-4 text-emerald-400" />
              <span>문파 창고 세이브 금전 (세금 10% 공제)</span>
            </div>
            <div className="text-xl font-black text-emerald-400">
              {treasuryGold.toLocaleString()} 금전
            </div>
            <div className="text-[11px] text-slate-400 flex items-center space-x-2">
              <Award className="w-3.5 h-3.5 text-amber-400" />
              <span>문파 용맹의 증표: <strong className="text-amber-300">{guildTokens.toLocaleString()}개</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table Card */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl overflow-hidden shadow-lg">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="text-sm font-bold text-slate-200">
            총 등록 문파원: <span className="text-amber-400">{attendance.length}명</span>
          </div>

          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="문파원 닉네임 검색..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9 pr-3 py-1.5 rounded-lg bg-slate-800/80 border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-48 sm:w-60"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-12 text-center">No</th>
                <th className="py-3 px-4">문파원 닉네임</th>
                <th className="py-3 px-4 text-center">1. 요신 토벌령</th>
                <th className="py-3 px-4 text-center">2. 결계지 방어</th>
                <th className="py-3 px-4 text-center">3. 미혹의 정원</th>
                <th className="py-3 px-4 text-center">4. 신기 쟁탈전</th>
                <th className="py-3 px-4 text-center">이월 점수</th>
                <th className="py-3 px-4 text-center">이번주 점수</th>
                <th className="py-3 px-4 text-center">총 누적 포인트</th>
                <th className="py-3 px-4 text-center">주간 참여율</th>
                {currentUser?.role === 'ADMIN' && (
                  <th className="py-3 px-4 text-center w-24">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    로딩 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-12 text-center text-slate-400">
                    검색된 문파원이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((member, index) => {
                  const weeklyPts =
                    member.weeklyPoints !== undefined
                      ? member.weeklyPoints
                      : (member.yosin?.points || 0) +
                        (member.gyeolgye?.points || 0) +
                        (member.mihok?.points || 0) +
                        (member.singi?.points || 0);
                  const carriedPts = member.carriedPoints || 0;
                  return (
                    <tr key={member.nickname} className="hover:bg-slate-800/40">
                      <td className="py-3 px-4 text-center text-xs text-slate-500">{index + 1}</td>
                      <td className="py-3 px-4 font-bold text-white">{member.nickname}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.yosin)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.gyeolgye)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.mihok)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.singi)}</td>
                      <td className="py-3 px-4 text-center text-xs font-semibold text-slate-400">
                        {carriedPts > 0 ? `${carriedPts}P` : '-'}
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-bold text-sky-300">
                        {weeklyPts}P
                      </td>
                      <td className="py-3 px-4 text-center font-black text-amber-300">
                        {member.totalPoints}P
                      </td>
                      <td className="py-3 px-4 text-center text-xs font-semibold text-slate-400">{member.rate}%</td>
                      {currentUser?.role === 'ADMIN' && (
                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => {
                              setSelectedMember(member.nickname);
                              setIsCheckModalOpen(true);
                            }}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-semibold"
                          >
                            체크
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Admin Manual Check Modal */}
      {isCheckModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleManualCheck}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <UserCheck className="w-5 h-5 text-indigo-400" />
                <span>문파원 출석 수동 체크 (관리자)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCheckModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">문파원 선택</label>
              <select
                value={selectedMember}
                onChange={e => setSelectedMember(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                {attendance.map(m => (
                  <option key={m.nickname} value={m.nickname}>
                    {m.nickname} (현재 누적 {m.totalPoints}P)
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">참여 컨텐츠</label>
              <select
                value={selectedContent}
                onChange={e => setSelectedContent(e.target.value as ContentType)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-indigo-500"
              >
                <option value="요신">1. 요신 토벌령 (분신 등록 가능)</option>
                <option value="결계">2. 결계지 방어 (분신 등록 가능)</option>
                <option value="미혹">3. 미혹의 정원 (수동 참여)</option>
                <option value="신기">4. 신기 쟁탈전 (수동 참여)</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">참여 형태 및 포인트</label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedType('MANUAL')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === 'MANUAL'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  ⚔️ 수동 (+1.0P)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('CLONE')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === 'CLONE'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  👤 분신 (+0.25P)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('ABSENT')}
                  className={`py-2 px-2 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === 'ABSENT'
                      ? 'bg-rose-500/20 border-rose-500 text-rose-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  ❌ 미참 (0P)
                </button>
              </div>
            </div>

            <div className="flex space-x-3 pt-3">
              <button
                type="button"
                onClick={() => setIsCheckModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-sm hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={actionLoading}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm shadow-md"
              >
                {actionLoading ? '반영 중...' : '출석 반영 완료'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
