'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  Calculator,
  Shield,
  Trash2,
  Plus,
  Copy,
  Check,
  Search,
  RotateCcw,
  Lock,
  Vault,
  Flame,
  Pencil
} from 'lucide-react';
import { MemberAttendance, ContentType, ParticipationType, isManagerRole } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function DistributionPage() {
  const [attendance, setAttendance] = useState<MemberAttendance[]>([]);
  const { currentUser, authChecking } = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // 문파 창고 세이브 금전 (낙찰가에서 세금 10% 공제 후 적립된 실수령 잔액)
  const [treasuryGold, setTreasuryGold] = useState<number>(0);
  const [guildTokens, setGuildTokens] = useState<number>(0);
  const [totalAuctionGold, setTotalAuctionGold] = useState<number>(0);
  const [endedAuctionsCount, setEndedAuctionsCount] = useState<number>(0);
  const [isCustomGold, setIsCustomGold] = useState<boolean>(false);
  const [manualWeight, setManualWeight] = useState<number>(1.0);
  const [cloneWeight, setCloneWeight] = useState<number>(0.25);

  const [copied, setCopied] = useState(false);
  const [distributing, setDistributing] = useState(false);

  // 신규 문파원 추가 모달 (관리자 전용)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isAdmin = isManagerRole(currentUser?.role);

  const fetchAttendance = () => {
    fetch(`/api/attendance?t=${Date.now()}`, { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        setAttendance(d.attendance || []);
        if (typeof d.endedAuctionsCount === 'number') {
          setEndedAuctionsCount(d.endedAuctionsCount);
        }
        const savedGold = d.treasuryGold ?? d.totalAuctionGold ?? 0;
        setTreasuryGold(savedGold);
        setGuildTokens(d.guildTokens ?? 0);
        if (!isCustomGold) {
          setTotalAuctionGold(savedGold);
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

  // 실시간 정산 통계 계산 (이월 누적 점수 + 이번 주 가중치 점수 합산 기준)
  const stats = useMemo(() => {
    const totalRegistered = attendance.length;
    let activeParticipants = 0;
    let totalPoints = 0;

    const listWithCalculations = attendance.map(m => {
      const pSingi = m.singi?.type === 'MANUAL' ? manualWeight : 0;
      const pMihok = m.mihok?.type === 'MANUAL' ? manualWeight : 0;
      const pYosin = m.yosin?.type === 'MANUAL' ? manualWeight : m.yosin?.type === 'CLONE' ? cloneWeight : 0;
      const pGyeol = m.gyeolgye?.type === 'MANUAL' ? manualWeight : m.gyeolgye?.type === 'CLONE' ? cloneWeight : 0;
      const weeklyPts = Math.round((pSingi + pMihok + pYosin + pGyeol) * 100) / 100;
      const carriedPts = Math.round((m.carriedPoints || 0) * 100) / 100;
      const pts = Math.round((carriedPts + weeklyPts) * 100) / 100;

      if (pts > 0) {
        activeParticipants += 1;
        totalPoints += pts;
      }

      return {
        ...m,
        weeklyComputedPoints: weeklyPts,
        carriedComputedPoints: carriedPts,
        computedPoints: pts
      };
    });

    totalPoints = Math.round(totalPoints * 100) / 100;
    const goldPerPoint = totalPoints > 0 ? totalAuctionGold / totalPoints : 0;

    let distributedSum = 0;
    const finalMembers = listWithCalculations
      .map(m => {
        const share = m.computedPoints > 0 ? Math.floor(m.computedPoints * goldPerPoint) : 0;
        distributedSum += share;
        return {
          ...m,
          share
        };
      })
      .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

    const errorGold = totalAuctionGold - distributedSum;

    return {
      totalRegistered,
      activeParticipants,
      totalPoints,
      goldPerPoint: Math.round(goldPerPoint),
      distributedSum,
      errorGold,
      members: finalMembers
    };
  }, [attendance, totalAuctionGold, manualWeight, cloneWeight]);

  // 어드민 전용: 문파원 참여 유형 토글 클릭 (수동 / 분신 / 미참)
  const handleToggleContent = async (nickname: string, content: ContentType, type: ParticipationType) => {
    if (!isAdmin) return;
    setAttendance(prev =>
      prev.map(m => {
        if (m.nickname !== nickname) return m;
        const updated = { ...m };
        const field =
          content === '신기' ? 'singi' : content === '미혹' ? 'mihok' : content === '요신' ? 'yosin' : 'gyeolgye';
        const pts = type === 'MANUAL' ? manualWeight : type === 'CLONE' ? cloneWeight : 0;
        updated[field] = { type, points: pts };
        return updated;
      })
    );

    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname,
          content,
          type,
          manualWeight,
          cloneWeight
        })
      });
      fetchAttendance();
    } catch (err) {
      console.error(err);
    }
  };

  // 어드민 전용 1. 전원 올 수동(4점) 일괄 반영
  const handleSetAllManual = async () => {
    if (!isAdmin) return;
    if (!confirm('⚡ 모든 등록 문파원의 이번 주 4개 컨텐츠를 [올 수동 (+4.0P)]으로 일괄 반영하시겠습니까?')) return;
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'SET_ALL_MANUAL',
        manualWeight,
        cloneWeight
      })
    });
    const data = await res.json();
    if (data.success) fetchAttendance();
  };

  // 어드민 전용 2. 주간 컨텐츠만 미참으로 초기화 (누적 점수는 초기화되지 않고 이월 유지 + 주차별 참여·분신 기록 1개월 자동 보관!)
  const handleResetWeeklyContentOnly = async () => {
    if (!isAdmin) return;
    const kst = new Date(Date.now() + 9 * 60 * 60 * 1000);
    const day = kst.getUTCDay();
    const daysSinceFriday = day === 5 ? 7 : (day - 5 + 7) % 7;
    const friUtc = new Date(Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate() - daysSinceFriday));
    const satUtc = new Date(Date.UTC(friUtc.getUTCFullYear(), friUtc.getUTCMonth(), friUtc.getUTCDate() + 1));
    const tueUtc = new Date(Date.UTC(friUtc.getUTCFullYear(), friUtc.getUTCMonth(), friUtc.getUTCDate() + 4));
    const fmt = (d: Date) => `${String(d.getUTCMonth() + 1).padStart(2, '0')}/${String(d.getUTCDate()).padStart(2, '0')}`;
    const defaultLabel = `${friUtc.getUTCMonth() + 1}월 ${Math.ceil(friUtc.getUTCDate() / 7)}주차`;
    const scheduleSummary = `${fmt(friUtc)}(금) 미혹 · ${fmt(satUtc)}(토) 신기 · ${fmt(tueUtc)}(화) 요신·결계지`;

    const inputLabel = prompt(
      '🔄 [주간 컨텐츠만 미참 초기화 & 주차별 참여 기록 자동 저장]\n\n' +
        `• 저장될 컨텐츠 주기: ${defaultLabel} (${scheduleSummary})\n` +
        '• 화요일 컨텐츠 종료 직후 바로 초기화하시거나 수·목·금요일에 늦게 초기화하셔도 동일하게 직전 완료 주차로 기록됩니다.\n' +
        '• 문파원들의 누적 총 점수는 절대 초기화되지 않고 그대로 보존(이월)됩니다!\n' +
        '• 이번 주 누가 어떤 컨텐츠(수동/분신)에 참여했는지 기록이 [상세 출석부]의 보관함에 자동 저장되며, 다음달 동일 주차 도달 시 자동 삭제됩니다.\n\n' +
        '보관함에 저장할 주차 이름을 확인해주세요:',
      defaultLabel
    );
    if (inputLabel === null) {
      return;
    }
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RESET_WEEKLY_CONTENT',
        weekLabel: inputLabel.trim() || defaultLabel
      })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) fetchAttendance();
  };

  // 어드민 전용 3. 누적 점수 전체 0P 초기화 (문파 창고 세이브 금전이 모두 분배되어 0 금전일 때만 가능!)
  const handleResetAllCumulativePoints = async () => {
    if (!isAdmin) return;
    if (treasuryGold > 0) {
      alert(
        `⚠️ 현재 문파 창고에 아직 분배되지 않은 세이브 금전(${treasuryGold.toLocaleString()} 금전)이 남아있습니다!\n\n점수 초기화는 창고 금전이 모두 분배(창고 잔액 0 금전)된 후에만 실행할 수 있습니다. 먼저 [문파 창고 금전 분배 완료]를 진행해주세요.`
      );
      return;
    }
    if (
      !confirm(
        '🗑️ 문파 창고 금전 분배가 모두 완료되었습니다.\n전 문파원의 누적 점수와 컨텐츠 참여 내역을 모두 [0P]로 초기화하시겠습니까?'
      )
    ) {
      return;
    }
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'RESET_ALL_POINTS' })
    });
    const data = await res.json();
    alert(data.message);
    if (data.success) fetchAttendance();
  };

  // 어드민 전용 4. 문파 창고 세이브 금전 분배 실행 (분배 시 창고 금전 차감)
  const handleDistributeTreasuryGold = async () => {
    if (!isAdmin) return;
    if (treasuryGold <= 0) {
      alert('현재 문파 창고에 세이브된 분배 대기 금전이 없습니다. (창고 잔액: 0 금전)');
      return;
    }
    if (
      !confirm(
        `💰 문파 창고 세이브 금전 [${treasuryGold.toLocaleString()} 금전]을 문파원 누적 점수 비례로 분배 완료 처리(창고 잔액에서 차감)하시겠습니까?`
      )
    ) {
      return;
    }
    setDistributing(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'DISTRIBUTE_TREASURY_GOLD',
          amount: treasuryGold
        })
      });
      const d = await res.json();
      alert(d.message);
      if (d.success) {
        setIsCustomGold(false);
        fetchAttendance();
      }
    } finally {
      setDistributing(false);
    }
  };

  // 어드민 전용: 문파원 추가
  const handleAddMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    const name = newMemberName.trim();
    if (!name) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'ADD_MEMBER', nickname: name })
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

  // 어드민 전용: 문파원 삭제
  const handleDeleteMember = async (nickname: string) => {
    if (!isAdmin) return;
    if (!confirm(`정말로 [${nickname}] 문파원을 현황 목록에서 삭제하시겠습니까?`)) return;
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_MEMBER', nickname })
    });
    const d = await res.json();
    if (d.success) fetchAttendance();
  };

  // 어드민 전용: 문파원 닉네임 변경
  const handleRenameMember = async (currentNickname: string) => {
    if (!isAdmin) return;
    if (currentNickname === '뱀설') {
      alert('최고 권력자인 문주(뱀설) 캐릭터 닉네임은 변경할 수 없습니다.');
      return;
    }
    const newNick = prompt(`[${currentNickname}] 문파원의 새로운 캐릭터 닉네임을 입력해주세요:`, currentNickname);
    if (!newNick || !newNick.trim()) return;
    const cleanNew = newNick.trim();
    if (cleanNew === currentNickname) {
      alert('기존 닉네임과 동일합니다.');
      return;
    }
    try {
      const res = await fetch('/api/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'RENAME_MEMBER',
          oldNickname: currentNickname,
          newNickname: cleanNew
        })
      });
      const d = await res.json();
      if (!d.success) {
        alert(d.message || '닉네임 변경 실패');
        return;
      }
      alert(d.message);
      fetchAttendance();
    } catch (err: any) {
      alert(err.message);
    }
  };

  // 디스코드 / 게임 공지 텍스트 복사
  const handleCopyNotice = () => {
    const activeList = stats.members
      .filter(m => m.computedPoints > 0)
      .sort((a, b) => b.computedPoints - a.computedPoints);

    let text = `📜 [외길 문파 창고 세이브 금전 정산 및 분배 안내]\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `💰 문파 창고 세이브 분배금 (세금 10% 공제 후): ${totalAuctionGold.toLocaleString()} 금전\n`;
    text += `👥 총 참여 인원: ${stats.totalRegistered}명 중 ${stats.activeParticipants}명 유효 참여\n`;
    text += `⭐ 총 누적 점수: ${stats.totalPoints.toFixed(2)} pt\n`;
    text += `🪙 1점당 분배 가치: ${stats.goldPerPoint.toLocaleString()} 금전\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;
    text += `[문파원별 배분액]\n`;

    activeList.forEach((m, idx) => {
      text += `${idx + 1}. ${m.nickname}: ${m.computedPoints.toFixed(2)}pt -> ${m.share.toLocaleString()} 금전\n`;
    });

    if (stats.errorGold > 0) {
      text += `\n* 절사 잔여금: ${stats.errorGold.toLocaleString()} 금전`;
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const renderReadOnlyBadge = (item?: { type: string; points: number }) => {
    if (item?.type === 'MANUAL') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
          수동 {manualWeight}P
        </span>
      );
    }
    if (item?.type === 'CLONE') {
      return (
        <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs font-bold bg-sky-500/15 text-sky-300 border border-sky-500/30">
          분신 {cloneWeight}P
        </span>
      );
    }
    return <span className="text-xs text-slate-500">미참</span>;
  };

  // 문파원 명단 항상 가나다순 정렬
  const filteredMembers = stats.members
    .filter(m => m.nickname.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));

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
              회원가입
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* 1. 문파 창고 세이브 금전 (세금 10% 공제 후 실수령) & 배점 기준 카드 (어드민만 수정 가능) */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-2.5">
            <Vault className="w-6 h-6 text-emerald-400 shrink-0" />
            <div>
              <h2 className="text-lg font-extrabold text-white">
                문파 창고 세이브 금전 (세금 10% 공제 실수령) & 배점 기준
              </h2>
              <p className="text-xs text-slate-400 mt-0.5 break-keep">
                인게임 지정 분배 시 낙찰가에서 세금 10%가 제외된 90% 금액(예: 3만G 낙찰 → 2만7천G)이 문파 창고에 세이브되며, 분배 시 차감됩니다.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-xs font-bold text-amber-300 flex items-center space-x-1.5 whitespace-nowrap shrink-0">
              <Flame className="w-3.5 h-3.5 shrink-0" />
              <span>용맹의 증표: {guildTokens.toLocaleString()}개</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-center">
          <div className={isAdmin ? 'lg:col-span-7 space-y-2' : 'lg:col-span-12 space-y-2'}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-semibold text-slate-300 block">
                현재 문파 창고 세이브 금전 (실제 분배 대상 잔액 • 완료 경매 {endedAuctionsCount}건)
              </label>
              {isAdmin && isCustomGold && (
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomGold(false);
                    setTotalAuctionGold(treasuryGold);
                  }}
                  className="text-[11px] font-bold text-amber-300 hover:underline"
                >
                  실제 문파 창고 세이브 잔액({treasuryGold.toLocaleString()}G)으로 복원
                </button>
              )}
            </div>

            {isAdmin ? (
              <div className="relative">
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-2xl select-none">💰</div>
                <input
                  type="number"
                  value={totalAuctionGold}
                  onChange={e => {
                    setIsCustomGold(true);
                    setTotalAuctionGold(Math.max(0, Number(e.target.value) || 0));
                  }}
                  className="w-full bg-[#131929] border border-slate-700/80 rounded-xl pl-14 pr-4 py-3 text-emerald-400 font-black text-xl sm:text-2xl focus:outline-none focus:border-emerald-400 tracking-wide transition-colors"
                  placeholder="0"
                />
              </div>
            ) : (
              <div className="w-full bg-[#131929] border border-slate-800 rounded-xl px-4 py-3.5 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-300 flex items-center space-x-2">
                  <span>💰</span>
                  <span>문파 창고 세이브 금전 (세금 10% 공제 후 적립금)</span>
                </span>
                <span className="text-emerald-400 font-black text-xl sm:text-2xl">
                  {treasuryGold.toLocaleString()} 금전
                </span>
              </div>
            )}
          </div>

          {isAdmin && (
            <div className="lg:col-span-5 flex flex-col gap-2">
              <button
                type="button"
                disabled={distributing || treasuryGold <= 0}
                onClick={handleDistributeTreasuryGold}
                className="w-full py-3.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 disabled:text-slate-500 text-slate-950 font-black text-xs sm:text-sm shadow-lg transition-all"
              >
                {distributing
                  ? '분배 차감 처리 중...'
                  : treasuryGold > 0
                  ? `💰 어드민: 문파 창고 세이브 금전 (${treasuryGold.toLocaleString()}G) 분배 완료 및 차감`
                  : '현재 문파 창고 세이브 금전 0 금전 (분배 완료 상태)'}
              </button>
              <p className="text-[11px] text-slate-400 text-center">
                * 분배 완료 시 창고 세이브 금전이 0G로 차감되며, 이후 [누적 점수 0P 초기화]를 실행할 수 있습니다.
              </p>
            </div>
          )}
        </div>

        {/* 배점 가중치 (어드민만 수정 가능, 일반 회원은 읽기 전용) */}
        <div className="pt-4 border-t border-slate-800/80">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-[#131929] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">수동 참여 배점 (기본 1.0P)</span>
              {isAdmin ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.1"
                    value={manualWeight}
                    onChange={e => setManualWeight(Math.max(0, Number(e.target.value) || 0))}
                    className="bg-transparent text-white font-bold text-base w-16 text-right focus:outline-none border-b border-slate-700"
                  />
                  <span className="text-slate-400 text-xs font-semibold">점</span>
                </div>
              ) : (
                <span className="text-emerald-400 font-black text-base">{manualWeight} 점</span>
              )}
            </div>

            <div className="bg-[#131929] border border-slate-800 rounded-xl p-3.5 flex items-center justify-between">
              <span className="text-xs text-slate-400 font-medium">분신 등록 배점 (기본 0.25P)</span>
              {isAdmin ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="number"
                    step="0.05"
                    value={cloneWeight}
                    onChange={e => setCloneWeight(Math.max(0, Number(e.target.value) || 0))}
                    className="bg-transparent text-amber-400 font-bold text-base w-16 text-right focus:outline-none border-b border-slate-700"
                  />
                  <span className="text-slate-400 text-xs font-semibold">점</span>
                </div>
              ) : (
                <span className="text-amber-400 font-black text-base">{cloneWeight} 점</span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 2. 정산 요약 대시보드 */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2.5">
            <Calculator className="w-5 h-5 text-purple-400" />
            <h2 className="text-lg font-extrabold text-white">창고 세이브 금전 정산 요약</h2>
          </div>
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-purple-950/70 text-purple-300 border border-purple-800/70">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse"></span>
            누적 점수 비례 실시간 계산
          </span>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">총 등록 문파원</div>
            <div className="text-2xl sm:text-3xl font-black text-white mt-1.5 flex items-baseline gap-1">
              <span>{stats.totalRegistered}</span>
              <span className="text-xs font-bold text-slate-400">명</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">누적 점수 보유 인원</div>
            <div className="text-2xl sm:text-3xl font-black text-cyan-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.activeParticipants}</span>
              <span className="text-xs font-bold text-slate-400">명</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">문파 총 누적 점수</div>
            <div className="text-2xl sm:text-3xl font-black text-purple-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.totalPoints.toFixed(2)}</span>
              <span className="text-xs font-bold text-slate-400">점</span>
            </div>
          </div>

          <div className="bg-[#131929]/90 border border-slate-800/80 rounded-xl p-4">
            <div className="text-xs font-semibold text-slate-400">1점당 창고 배당금</div>
            <div className="text-2xl sm:text-3xl font-black text-amber-400 mt-1.5 flex items-baseline gap-1">
              <span>{stats.goldPerPoint.toLocaleString()}</span>
              <span className="text-xs font-bold text-slate-400">금전</span>
            </div>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-800/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="text-xs sm:text-sm text-slate-300 font-medium">
            배분 합계:{' '}
            <span className="font-extrabold text-amber-300">{stats.distributedSum.toLocaleString()}</span>
            {' / '}
            <span className="font-bold text-slate-200">{totalAuctionGold.toLocaleString()} 금전</span>
            <span className="text-emerald-400 font-bold ml-2">(자투리 {stats.errorGold.toLocaleString()}G)</span>
          </div>

          <button
            onClick={handleCopyNotice}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-purple-600 hover:brightness-110 text-white font-bold text-xs sm:text-sm shadow-lg transition-all"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-300" /> : <Copy className="w-4 h-4" />}
            <span>{copied ? '클립보드 복사 완료!' : '디스코드/게임 정산 공지 복사'}</span>
          </button>
        </div>
      </div>

      {/* 3. 문파원 참여 현황 목록 (수정 및 초기화 버튼은 어드민 전용) */}
      <div className="bg-[#0d111e]/90 border border-slate-800/90 rounded-2xl overflow-hidden shadow-xl backdrop-blur">
        <div className="p-4 sm:p-5 border-b border-slate-800/80 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <Shield className="w-5 h-5 text-amber-400" />
              <h2 className="text-base sm:text-lg font-extrabold text-white">문파원 참여 및 누적 점수 목록</h2>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-800/80 text-slate-300 border border-slate-700">
                {stats.totalRegistered}명
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              • <strong>주간 컨텐츠 미참 초기화</strong>: 컨텐츠 체크만 미참으로 리셋하며 <strong>누적 점수는 그대로 유지(이월)</strong>되고, 해당 주차 수동·분신 참여 기록은 <strong>1개월간 보관 후 자동 삭제</strong>됩니다.<br />
              • <strong>누적 점수 0P 초기화</strong>: 문파 창고 세이브 금전이 모두 분배(0G)된 후에만 문파장(어드민)이 실행할 수 있습니다.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/attendance"
              className="px-3 py-1.5 rounded-lg bg-indigo-500/15 hover:bg-indigo-500/25 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors whitespace-nowrap"
            >
              📅 지난 주차별 참여·분신 기록 보기
            </Link>
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="문파원 닉네임 검색..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-8 pr-3 py-1.5 rounded-lg bg-[#131929] border border-slate-700 text-xs text-white placeholder-slate-400 focus:outline-none focus:border-indigo-500 w-36 sm:w-44"
              />
            </div>

            {isAdmin && (
              <>
                <button
                  onClick={handleSetAllManual}
                  className="px-3 py-1.5 rounded-lg bg-[#192238] hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition-colors"
                >
                  전원 올 수동(+4P)
                </button>

                <button
                  onClick={handleResetWeeklyContentOnly}
                  className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/40 text-xs font-extrabold transition-colors"
                  title="4대 주간 컨텐츠만 미참으로 리셋하고 누적 점수는 그대로 유지합니다"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>주간 컨텐츠만 미참 초기화 (점수 유지)</span>
                </button>

                <button
                  onClick={handleResetAllCumulativePoints}
                  className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-extrabold border transition-colors ${
                    treasuryGold === 0
                      ? 'bg-rose-500/15 hover:bg-rose-500/25 text-rose-300 border-rose-500/40'
                      : 'bg-slate-900 text-slate-500 border-slate-800 cursor-not-allowed'
                  }`}
                  title={
                    treasuryGold === 0
                      ? '금전 분배가 완료되었으므로 누적 점수를 0P로 초기화할 수 있습니다'
                      : '창고 금전을 먼저 모두 분배해야 점수를 초기화할 수 있습니다'
                  }
                >
                  <span>누적 점수 0P 초기화 {treasuryGold > 0 ? '(분배 후 가능)' : ''}</span>
                </button>

                <button
                  onClick={() => setIsAddMemberOpen(true)}
                  className="inline-flex items-center space-x-1 px-3.5 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs shadow-sm transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>문파원 추가</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* 표 본문 */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300 border-collapse">
            <thead className="bg-[#090d18] text-xs text-slate-400 border-b border-slate-800/90 font-bold">
              <tr>
                <th className="py-3 px-4 min-w-[120px]">문파원</th>
                <th className="py-3 px-3 text-center min-w-[130px]">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-600/30 text-blue-300 border border-blue-500/40">
                    1. 신기
                  </span>
                </th>
                <th className="py-3 px-3 text-center min-w-[130px]">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-pink-600/30 text-pink-300 border border-pink-500/40">
                    2. 미혹
                  </span>
                </th>
                <th className="py-3 px-3 text-center min-w-[165px]">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-600/30 text-purple-300 border border-purple-500/40">
                    3. 요신 (분신가능)
                  </span>
                </th>
                <th className="py-3 px-3 text-center min-w-[165px]">
                  <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-600/30 text-emerald-300 border border-emerald-500/40">
                    4. 결계지 (분신가능)
                  </span>
                </th>
                <th className="py-3 px-3 text-center min-w-[120px]">누적 점수 (이월+주간)</th>
                <th className="py-3 px-3 text-right min-w-[120px]">창고 금전 배분액</th>
                {isAdmin && <th className="py-3 px-3 text-center w-12">삭제</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-[#0d111e]/50">
              {filteredMembers.map(m => {
                const isMe = currentUser?.nickname === m.nickname;
                return (
                  <tr
                    key={m.nickname}
                    className={`transition-colors hover:bg-slate-800/30 ${
                      isMe ? 'bg-indigo-950/30 border-l-2 border-indigo-400' : ''
                    }`}
                  >
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

                    {/* 1. 신기 */}
                    <td className="py-3 px-3 text-center">
                      {isAdmin ? (
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
                      ) : (
                        renderReadOnlyBadge(m.singi)
                      )}
                    </td>

                    {/* 2. 미혹 */}
                    <td className="py-3 px-3 text-center">
                      {isAdmin ? (
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
                      ) : (
                        renderReadOnlyBadge(m.mihok)
                      )}
                    </td>

                    {/* 3. 요신 */}
                    <td className="py-3 px-3 text-center">
                      {isAdmin ? (
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
                      ) : (
                        renderReadOnlyBadge(m.yosin)
                      )}
                    </td>

                    {/* 4. 결계지 */}
                    <td className="py-3 px-3 text-center">
                      {isAdmin ? (
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
                      ) : (
                        renderReadOnlyBadge(m.gyeolgye)
                      )}
                    </td>

                    {/* 누적 점수 */}
                    <td className="py-3 px-3 text-center">
                      <div className="inline-flex flex-col items-center">
                        <span className="px-2.5 py-0.5 rounded-md text-xs font-extrabold bg-purple-950/70 text-purple-300 border border-purple-800/70">
                          {m.computedPoints.toFixed(2)} pt
                        </span>
                        {m.carriedComputedPoints > 0 && (
                          <span className="text-[10px] text-slate-400 mt-0.5">
                            (이월 {m.carriedComputedPoints} + 주간 {m.weeklyComputedPoints})
                          </span>
                        )}
                      </div>
                    </td>

                    {/* 최종 배분액 */}
                    <td className="py-3 px-3 text-right">
                      <span className="font-black text-amber-400 text-sm">
                        {m.share.toLocaleString()} 금전
                      </span>
                    </td>

                    {/* 관리 아이콘 (어드민 전용) */}
                    {isAdmin && (
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleRenameMember(m.nickname)}
                            className="text-slate-400 hover:text-amber-300 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                            title="문파원 닉네임 변경"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMember(m.nickname)}
                            className="text-slate-500 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-800/60 transition-colors"
                            title="문파원 삭제"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 문파원 추가 모달 (어드민 전용) */}
      {isAdmin && isAddMemberOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="bg-[#0f172a] border border-slate-700 rounded-2xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white mb-2 flex items-center space-x-2">
              <Plus className="w-5 h-5 text-amber-400" />
              <span>신규 문파원 추가 (어드민 전용)</span>
            </h3>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div>
                <label className="text-xs text-slate-300 font-semibold block mb-1">
                  문파원 게임 닉네임
                </label>
                <input
                  type="text"
                  required
                  value={newMemberName}
                  onChange={e => setNewMemberName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-slate-800 border border-slate-700 text-sm text-white"
                />
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs"
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs"
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
