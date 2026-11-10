'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, RotateCcw, Search, UserCheck, Shield, Sparkles, RefreshCw, Coins, Award, Pencil, Calendar, Clock, Trash2 } from 'lucide-react';
import { MemberAttendance, ContentType, ParticipationType, WeeklyContentHistoryEntry, isManagerRole } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

function getClientGuildCycleInfo() {
  const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const day = kst.getUTCDay();
  const daysSinceFriday = (day - 5 + 7) % 7;
  const friUtc = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceFriday));
  const satUtc = new Date(Date.UTC(friUtc.getUTCFullYear(), friUtc.getUTCMonth(), friUtc.getUTCDate() + 1));
  const tueUtc = new Date(Date.UTC(friUtc.getUTCFullYear(), friUtc.getUTCMonth(), friUtc.getUTCDate() + 4));
  const fmt = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
  const m = friUtc.getUTCMonth() + 1;
  const w = Math.ceil(friUtc.getUTCDate() / 7);
  const weekLabel = `${m}월 ${w}주차`;
  const scheduleSummary = `${fmt(friUtc)}(금) 미혹 · ${fmt(satUtc)}(토) 신기 · ${fmt(tueUtc)}(화) 요신·결계지`;
  return { weekLabel, scheduleSummary };
}

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<MemberAttendance[]>([]);
  const [weeklyHistory, setWeeklyHistory] = useState<WeeklyContentHistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string>('');
  const [historySearch, setHistorySearch] = useState<string>('');
  const [treasuryGold, setTreasuryGold] = useState<number>(0);
  const [guildTokens, setGuildTokens] = useState<number>(0);
  const { currentUser, authChecking } = useAuthUser();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const canManage = isManagerRole(currentUser?.role);

  // 관리자 직접 체크 모달
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedContent, setSelectedContent] = useState<ContentType>('신기');
  const [selectedType, setSelectedType] = useState<ParticipationType>('MANUAL');
  const [actionLoading, setActionLoading] = useState(false);

  // 문파원 닉네임 변경 모달
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState('');
  const [renameNewNick, setRenameNewNick] = useState('');
  const [renameLoading, setRenameLoading] = useState(false);

  const fetchAttendance = () => {
    fetch(`/api/attendance?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setAttendance(d.attendance || []);
        if (Array.isArray(d.weeklyHistory)) {
          setWeeklyHistory(d.weeklyHistory);
          setSelectedHistoryId(prev => {
            if (prev && d.weeklyHistory.some((h: WeeklyContentHistoryEntry) => h.id === prev)) {
              return prev;
            }
            return d.weeklyHistory[0]?.id || '';
          });
        }
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

  // 1) 주간 컨텐츠만 미참으로 초기화 (누적 점수는 유지 + 주차별 참여·분신 기록 1개월 자동 보관)
  const handleWeeklyContentReset = async () => {
    const cycle = getClientGuildCycleInfo();
    const defaultLabel = cycle.weekLabel;
    const inputLabel = prompt(
      '🔄 [주간 컨텐츠만 미참 초기화 & 주차별 참여 기록 자동 저장]\n\n' +
        `• 현재 컨텐츠 주기: ${cycle.weekLabel} (${cycle.scheduleSummary})\n` +
        '• 문파원들의 누적 점수는 0으로 초기화되지 않고 100% 그대로 유지(이월)됩니다.\n' +
        '• 초기화 직전 이번 주 누가 어떤 컨텐츠(수동/분신)에 참여했는지 기록이 보관함에 자동 저장되며, 다음달 동일 주차 도달 시 자동 삭제됩니다.\n\n' +
        '보관함에 저장할 주차 이름을 확인해주세요:',
      defaultLabel
    );
    if (inputLabel === null) {
      return;
    }

    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RESET_WEEKLY_CONTENT',
          weekLabel: inputLabel.trim() || defaultLabel
        })
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '초기화 실패');
        return;
      }
      if (data.archivedEntry?.id) {
        setSelectedHistoryId(data.archivedEntry.id);
      }
      alert(data.message);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDeleteWeeklyHistory = async (historyId: string, weekLabel: string) => {
    if (!confirm(`[${weekLabel}] 주차 참여 기록을 수동 삭제하시겠습니까?`)) return;
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'DELETE_WEEKLY_HISTORY', historyId })
      });
      const data = await res.json();
      if (data.success) {
        fetchAttendance();
      } else {
        alert(data.message || '삭제 실패');
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 2) 누적 점수 0P 초기화 (문파 창고 금전이 모두 분배된 후에만 가능)
  const handleResetAllPoints = async () => {
    if (treasuryGold > 0) {
      alert(
        `⚠️ 현재 문파 창고에 미분배 세이브 금전(${treasuryGold.toLocaleString()} 금전)이 남아 있습니다.\n\n점수 초기화는 문파 창고 금전이 모두 분배(0 금전)된 후에만 가능합니다. 먼저 [참여·분배 현황] 또는 [문파 경매·창고]에서 금전 분배 완료 처리를 진행해 주세요.`
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

  const handleOpenRename = (currentNickname: string) => {
    setRenameTarget(currentNickname);
    setRenameNewNick(currentNickname);
    setIsRenameModalOpen(true);
  };

  const handleRenameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNew = renameNewNick.trim();
    if (!renameTarget || !cleanNew) return;
    if (renameTarget === cleanNew) {
      alert('기존 닉네임과 동일합니다.');
      return;
    }
    setRenameLoading(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RENAME_MEMBER',
          oldNickname: renameTarget,
          newNickname: cleanNew,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '닉네임 변경에 실패했습니다.');
        setRenameLoading(false);
        return;
      }
      alert(data.message);
      setIsRenameModalOpen(false);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setRenameLoading(false);
    }
  };

  // 문파원 명단 항상 가나다순 정렬
  const sortedAttendance = [...attendance].sort((a, b) =>
    a.nickname.localeCompare(b.nickname, 'ko')
  );

  const filtered = sortedAttendance.filter(m =>
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
              회원가입
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
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold mb-2">
            <Calendar className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              현재 진행 주차: {getClientGuildCycleInfo().weekLabel} ({getClientGuildCycleInfo().scheduleSummary})
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            <span>상세 출석부 & 누적 포인트 관리소</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400 break-keep">
            주간 컨텐츠(금 미혹 · 토 신기 · 화 요신·결계지) 종료 후 <strong className="text-sky-300">[주간 컨텐츠만 미참 초기화]</strong>를 누르면 해당 주차 수동·분신 기록이 아래 보관함에 1개월간 남고 <strong className="text-amber-300">누적 점수</strong>는 그대로 유지됩니다.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start lg:self-auto">
          <a
            href="/distribution"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:brightness-110 text-white font-bold text-xs shadow-md transition-all"
          >
            <span>💰 참여 & 배분 정산소</span>
          </a>
          {canManage && (
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
          <div className="space-y-1 w-full">
            <div className="text-xs font-bold text-emerald-300 flex items-center justify-between gap-2">
              <span className="flex items-center space-x-1.5 whitespace-nowrap">
                <Coins className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>문파 창고 세이브 금전</span>
              </span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-bold text-emerald-300 whitespace-nowrap shrink-0">
                세금 10% 공제
              </span>
            </div>
            <div className="text-xl font-black text-emerald-400">
              {treasuryGold.toLocaleString()} 금전
            </div>
            <div className="text-[11px] text-slate-400 flex items-center space-x-2 whitespace-nowrap">
              <Award className="w-3.5 h-3.5 text-amber-400 shrink-0" />
              <span>문파 용맹의 증표: <strong className="text-amber-300">{guildTokens.toLocaleString()}개</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* 지난 주차별 컨텐츠 참여·분신 기록 보관함 (1개월 보관 후 다음달 동일 주차 자동 삭제) */}
      <div className="bg-slate-900/75 border border-indigo-500/30 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3.5">
          <div className="space-y-1">
            <h2 className="text-base sm:text-lg font-extrabold text-white flex items-center space-x-2">
              <Calendar className="w-5 h-5 text-indigo-400 shrink-0" />
              <span>지난 주차별 컨텐츠 참여·분신 기록 보관함 (1개월 자동 보관)</span>
            </h2>
            <p className="text-xs text-slate-400 break-keep">
              <strong className="text-sky-300">[주간 컨텐츠만 미참 초기화]</strong> 실행 시 해당 주차에 누가 어떤 컨텐츠를 <strong className="text-emerald-300">수동(1.0P)</strong> 또는 <strong className="text-sky-300">분신(0.25P)</strong>으로 참여했는지 자동 기록되며, <strong className="text-amber-300">다음달 동일 주차(약 1개월 경과) 도달 시 자동 삭제</strong>됩니다.
            </p>
          </div>
          <span className="px-3 py-1.5 rounded-xl bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-extrabold whitespace-nowrap self-start sm:self-auto">
            보관 기록: {weeklyHistory.length} / 최대 4주 (1개월)
          </span>
        </div>

        {weeklyHistory.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center space-y-1.5">
            <div className="text-xs sm:text-sm font-bold text-slate-300">
              아직 보관된 지난 주차 컨텐츠 참여 기록이 없습니다.
            </div>
            <p className="text-xs text-slate-500 break-keep">
              1주차 컨텐츠 종료 후 상단의 <strong>[주간 컨텐츠만 미참 초기화 (점수 유지)]</strong> 버튼을 누르면 해당 주차의 수동·분신 참여 내역이 이곳에 자동 기록됩니다.
            </p>
          </div>
        ) : (
          (() => {
            const activeRecord =
              weeklyHistory.find(h => h.id === selectedHistoryId) || weeklyHistory[0];
            if (!activeRecord) return null;

            const singiManual = activeRecord.members.filter(m => m.singi?.type === 'MANUAL').map(m => m.nickname);
            const mihokManual = activeRecord.members.filter(m => m.mihok?.type === 'MANUAL').map(m => m.nickname);
            const yosinManual = activeRecord.members.filter(m => m.yosin?.type === 'MANUAL').map(m => m.nickname);
            const yosinClone = activeRecord.members.filter(m => m.yosin?.type === 'CLONE').map(m => m.nickname);
            const gyeolManual = activeRecord.members.filter(m => m.gyeolgye?.type === 'MANUAL').map(m => m.nickname);
            const gyeolClone = activeRecord.members.filter(m => m.gyeolgye?.type === 'CLONE').map(m => m.nickname);

            const filteredHistoryMembers = activeRecord.members.filter(m =>
              m.nickname.toLowerCase().includes(historySearch.toLowerCase())
            );

            return (
              <div className="space-y-4">
                {/* 주차 선택 탭 */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    {weeklyHistory.map(h => {
                      const isSelected = h.id === activeRecord.id;
                      return (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => setSelectedHistoryId(h.id)}
                          className={`px-3.5 py-2 rounded-xl text-xs font-extrabold border transition-all flex items-center space-x-2 ${
                            isSelected
                              ? 'bg-indigo-600 text-white border-indigo-400 shadow-lg shadow-indigo-600/20'
                              : 'bg-slate-950 text-slate-300 border-slate-800 hover:bg-slate-800'
                          }`}
                        >
                          <span>
                            📅 {h.weekLabel}
                            {h.scheduleSummary ? ` (${h.scheduleSummary})` : ''}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-[10px] ${isSelected ? 'bg-indigo-900 text-indigo-200' : 'bg-slate-900 text-slate-400'}`}>
                            참여 {h.activeWeeklyCount}명
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                    <span className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-800">
                      <Clock className="w-3.5 h-3.5 text-amber-400" />
                      <span>
                        기록 저장: {new Date(activeRecord.createdAt).toLocaleDateString('ko-KR')} • 자동 삭제 예정:{' '}
                        <strong className="text-amber-300">
                          다음달 {activeRecord.weekOfMonth}주차 ({new Date(activeRecord.expiresAt).toLocaleDateString('ko-KR')})
                        </strong>
                      </span>
                    </span>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => handleDeleteWeeklyHistory(activeRecord.id, activeRecord.weekLabel)}
                        className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold"
                        title="이 주차 기록 삭제"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>기록 삭제</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* 4대 컨텐츠별 수동 / 분신 참여자 한눈에 보기 요약 */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between font-extrabold text-white border-b border-slate-800 pb-1.5">
                      <span>1. 신기 쟁탈전</span>
                      <span className="text-emerald-400">수동 {singiManual.length}명</span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed break-keep max-h-24 overflow-y-auto">
                      <strong className="text-emerald-300">⚔️ 수동:</strong>{' '}
                      {singiManual.length > 0 ? singiManual.join(', ') : '없음'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between font-extrabold text-white border-b border-slate-800 pb-1.5">
                      <span>2. 미혹의 정원</span>
                      <span className="text-emerald-400">수동 {mihokManual.length}명</span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed break-keep max-h-24 overflow-y-auto">
                      <strong className="text-emerald-300">⚔️ 수동:</strong>{' '}
                      {mihokManual.length > 0 ? mihokManual.join(', ') : '없음'}
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between font-extrabold text-white border-b border-slate-800 pb-1.5">
                      <span>3. 요신 토벌령</span>
                      <span className="text-sky-300">
                        수동 {yosinManual.length} / 분신 {yosinClone.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed break-keep space-y-1 max-h-24 overflow-y-auto">
                      <div>
                        <strong className="text-emerald-300">⚔️ 수동:</strong>{' '}
                        {yosinManual.length > 0 ? yosinManual.join(', ') : '없음'}
                      </div>
                      <div>
                        <strong className="text-sky-300">👤 분신:</strong>{' '}
                        {yosinClone.length > 0 ? yosinClone.join(', ') : '없음'}
                      </div>
                    </div>
                  </div>

                  <div className="p-3.5 rounded-xl bg-slate-950/90 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between font-extrabold text-white border-b border-slate-800 pb-1.5">
                      <span>4. 결계지 방어</span>
                      <span className="text-sky-300">
                        수동 {gyeolManual.length} / 분신 {gyeolClone.length}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-300 leading-relaxed break-keep space-y-1 max-h-24 overflow-y-auto">
                      <div>
                        <strong className="text-emerald-300">⚔️ 수동:</strong>{' '}
                        {gyeolManual.length > 0 ? gyeolManual.join(', ') : '없음'}
                      </div>
                      <div>
                        <strong className="text-sky-300">👤 분신:</strong>{' '}
                        {gyeolClone.length > 0 ? gyeolClone.join(', ') : '없음'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 선택된 주차 전체 문파원 상세 참여 기록표 */}
                <div className="bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden">
                  <div className="p-3 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="text-xs font-extrabold text-indigo-300">
                      📋 [{activeRecord.weekLabel}] 문파원별 4대 컨텐츠 수동·분신 상세 기록표
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="해당 주차 닉네임 검색..."
                        value={historySearch}
                        onChange={e => setHistorySearch(e.target.value)}
                        className="pl-8 pr-3 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-44 sm:w-56"
                      />
                    </div>
                  </div>
                  <div className="overflow-x-auto max-h-80 overflow-y-auto">
                    <table className="w-full text-left text-xs text-slate-300">
                      <thead className="bg-slate-950 text-slate-400 font-bold border-b border-slate-800 sticky top-0">
                        <tr>
                          <th className="py-2.5 px-3 w-10 text-center">No</th>
                          <th className="py-2.5 px-3">문파원 닉네임</th>
                          <th className="py-2.5 px-3 text-center">1. 신기 쟁탈전</th>
                          <th className="py-2.5 px-3 text-center">2. 미혹의 정원</th>
                          <th className="py-2.5 px-3 text-center">3. 요신 토벌령</th>
                          <th className="py-2.5 px-3 text-center">4. 결계지 방어</th>
                          <th className="py-2.5 px-3 text-center">해당 주차 점수</th>
                          <th className="py-2.5 px-3 text-center">당시 총 누적</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/50">
                        {filteredHistoryMembers.map((hm, idx) => (
                          <tr key={hm.nickname} className="hover:bg-slate-900/60">
                            <td className="py-2 px-3 text-center text-slate-500">{idx + 1}</td>
                            <td className="py-2 px-3 font-bold text-white">{hm.nickname}</td>
                            <td className="py-2 px-3 text-center">{renderBadge(hm.singi)}</td>
                            <td className="py-2 px-3 text-center">{renderBadge(hm.mihok)}</td>
                            <td className="py-2 px-3 text-center">{renderBadge(hm.yosin)}</td>
                            <td className="py-2 px-3 text-center">{renderBadge(hm.gyeolgye)}</td>
                            <td className="py-2 px-3 text-center font-bold text-sky-300">{hm.weeklyPoints}P</td>
                            <td className="py-2 px-3 text-center font-black text-amber-300">{hm.totalPoints}P</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            );
          })()
        )}
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
                <th className="py-3 px-4 text-center">1. 신기 쟁탈전</th>
                <th className="py-3 px-4 text-center">2. 미혹의 정원</th>
                <th className="py-3 px-4 text-center">3. 요신 토벌령</th>
                <th className="py-3 px-4 text-center">4. 결계지 방어</th>
                <th className="py-3 px-4 text-center">이월 점수</th>
                <th className="py-3 px-4 text-center">이번주 점수</th>
                <th className="py-3 px-4 text-center">총 누적 포인트</th>
                <th className="py-3 px-4 text-center">주간 참여율</th>
                {canManage && (
                  <th className="py-3 px-4 text-center w-36">관리</th>
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
                      <td className="py-3 px-4 text-center">{renderBadge(member.singi)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.mihok)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.yosin)}</td>
                      <td className="py-3 px-4 text-center">{renderBadge(member.gyeolgye)}</td>
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
                      {canManage && (
                        <td className="py-3 px-4 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedMember(member.nickname);
                                setIsCheckModalOpen(true);
                              }}
                              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-indigo-400 text-xs font-semibold"
                            >
                              체크
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRename(member.nickname)}
                              className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 text-xs font-semibold border border-amber-500/30 flex items-center gap-1 transition-colors"
                              title="문파원 닉네임 변경"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>닉네임</span>
                            </button>
                          </div>
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
                <option value="신기">1. 신기 쟁탈전 (수동 참여)</option>
                <option value="미혹">2. 미혹의 정원 (수동 참여)</option>
                <option value="요신">3. 요신 토벌령 (분신 등록 가능)</option>
                <option value="결계">4. 결계지 방어 (분신 등록 가능)</option>
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

      {/* Admin Member Nickname Rename Modal */}
      {isRenameModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <form
            onSubmit={handleRenameSubmit}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center space-x-2">
                <Pencil className="w-5 h-5 text-amber-400" />
                <span>문파원 닉네임 변경 (관리자)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-400">현재 문파원 닉네임</label>
              <input
                type="text"
                disabled
                value={renameTarget}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-800 text-sm font-bold text-slate-400 cursor-not-allowed"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-amber-300">변경할 새로운 캐릭터 닉네임</label>
              <input
                type="text"
                required
                autoFocus
                value={renameNewNick}
                onChange={e => setRenameNewNick(e.target.value)}
                placeholder="새 닉네임 입력 (예: 최강홍섭)"
                className="w-full px-3 py-2.5 rounded-lg bg-slate-950 border border-amber-500/50 text-sm font-bold text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400"
              />
              <p className="text-[11px] text-slate-400 mt-1">
                * 닉네임 변경 시 출석 포인트, 계정 정보, 경매 및 정산 내역이 새로운 닉네임으로 자동 승계·통합됩니다.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
              <button
                type="button"
                onClick={() => setIsRenameModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-all"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={renameLoading || !renameNewNick.trim() || renameNewNick.trim() === renameTarget}
                className="px-5 py-2 rounded-lg bg-amber-400 hover:bg-amber-300 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 text-xs font-black transition-all shadow-md"
              >
                {renameLoading ? '변경 중...' : '닉네임 변경 적용'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
