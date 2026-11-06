'use client';

import { useState, useEffect } from 'react';
import { CheckCircle2, RotateCcw, Search, UserCheck, Shield, Sparkles, AlertCircle } from 'lucide-react';
import { MemberAttendance, ContentType, ParticipationType } from '@/lib/types';

export default function AttendancePage() {
  const [attendance, setAttendance] = useState<MemberAttendance[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  // 관리자 직접 체크 모달
  const [isCheckModalOpen, setIsCheckModalOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState('');
  const [selectedContent, setSelectedContent] = useState<ContentType>('요신');
  const [selectedType, setSelectedType] = useState<ParticipationType>('MANUAL');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchAttendance = () => {
    fetch('/api/attendance')
      .then(res => res.json())
      .then(d => {
        setAttendance(d.attendance || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetch('/api/auth/me')
      .then(res => res.json())
      .then(d => {
        if (d.authenticated) setCurrentUser(d.user);
      });

    fetchAttendance();
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

  const handleWeeklyReset = async () => {
    if (!confirm('⚠️ 경고: 주간 정산이 완료되어 모든 문파원의 출석 체크박스와 포인트를 0으로 초기화하시겠습니까?')) {
      return;
    }

    try {
      const res = await fetch('/api/attendance/reset', { method: 'POST' });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '초기화 실패');
        return;
      }
      alert('🔄 모든 문파원의 출석과 포인트가 0으로 초기화되었습니다.');
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
    return <span className="text-slate-600 text-xs">-</span>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-400" />
            <span>상세 출석부 & 포인트 관리소</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            4대 주간 컨텐츠별 참여 유형(수동 1P / 분신 0.25P)을 실시간으로 확인하고 관리합니다.
          </p>
        </div>

        {currentUser?.role === 'ADMIN' && (
          <div className="flex items-center space-x-2 self-start sm:self-auto">
            <button
              onClick={() => {
                setSelectedMember(attendance[0]?.nickname || '');
                setIsCheckModalOpen(true);
              }}
              className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition-colors"
            >
              <UserCheck className="w-4 h-4" />
              <span>수동 출석 체크 (관리자)</span>
            </button>
            <button
              onClick={handleWeeklyReset}
              className="inline-flex items-center space-x-2 px-3 py-2 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border border-rose-500/30 font-semibold text-xs transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>주간 초기화</span>
            </button>
          </div>
        )}
      </div>

      {/* Discord Bot Sync Info Banner */}
      <div className="bg-slate-900/80 border border-indigo-950 rounded-2xl p-4 sm:p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-600/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">디스코드 봇 실시간 연동 안내</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              디스코드 스크린샷 인증 시 텍스트에 <code className="text-amber-300 bg-slate-950 px-1.5 py-0.5 rounded">요신</code> (수동 1P) 또는 <code className="text-sky-300 bg-slate-950 px-1.5 py-0.5 rounded">요신 분신</code> (분신 0.25P)을 적어주시면 봇이 이 웹사이트에 즉시 자동 반영합니다!
            </p>
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
                <th className="py-3 px-4 text-center">주간 포인트</th>
                <th className="py-3 px-4 text-center">참여율</th>
                {currentUser?.role === 'ADMIN' && (
                  <th className="py-3 px-4 text-center w-24">관리</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    로딩 중...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-400">
                    검색된 문파원이 없습니다.
                  </td>
                </tr>
              ) : (
                filtered.map((member, index) => (
                  <tr key={member.nickname} className="hover:bg-slate-800/40">
                    <td className="py-3 px-4 text-center text-xs text-slate-500">{index + 1}</td>
                    <td className="py-3 px-4 font-bold text-white">{member.nickname}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(member.yosin)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(member.gyeolgye)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(member.mihok)}</td>
                    <td className="py-3 px-4 text-center">{renderBadge(member.singi)}</td>
                    <td className="py-3 px-4 text-center font-black text-amber-300">{member.totalPoints}P</td>
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
                ))
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
                    {m.nickname} (현재 {m.totalPoints}P)
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
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedType('MANUAL')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === 'MANUAL'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  ⚔️ 직접 수동 참가 (+1.0P)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedType('CLONE')}
                  className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all ${
                    selectedType === 'CLONE'
                      ? 'bg-sky-500/20 border-sky-500 text-sky-300 shadow-md'
                      : 'bg-slate-950 border-slate-800 text-slate-400 hover:bg-slate-800'
                  }`}
                >
                  👤 분신 등록 참가 (+0.25P)
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
