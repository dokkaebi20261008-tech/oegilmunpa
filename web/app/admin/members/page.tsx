'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuthUser } from '@/lib/clientAuth';
import { Role, ROLE_LABELS, isManagerRole } from '@/lib/types';
import {
  UserCheck,
  UserX,
  Clock,
  Shield,
  Trash2,
  CheckCircle2,
  ArrowLeft,
  Eye,
  EyeOff,
  Copy,
  Check,
  KeyRound,
  Search,
  UserPlus,
  RefreshCw,
  X,
  Crown,
  Award
} from 'lucide-react';

interface MemberUser {
  id: string;
  username: string;
  plainPassword?: string;
  nickname: string;
  role: Role;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function AdminMembersPage() {
  const [users, setUsers] = useState<MemberUser[]>([]);
  const { currentUser, authChecking } = useAuthUser();
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

  // 문파원 계정 직접 생성 모달 상태
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newNickname, setNewNickname] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<Role>('MEMBER');
  const [creatingUser, setCreatingUser] = useState(false);

  const isMainAdmin = currentUser?.role === 'ADMIN';
  const isSubAdmin = currentUser?.role === 'SUB_ADMIN';
  const canManage = isManagerRole(currentUser?.role);

  const fetchUsers = () => {
    fetch('/api/admin/users', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setUsers(d.users || []);
        } else {
          setUsers([]);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchUsers();
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (!d.authenticated || !isManagerRole(d.user.role)) {
          alert('문주 또는 부문주만 접근 가능한 관리 페이지입니다.');
          window.location.href = '/';
          return;
        }
      });

    const interval = setInterval(fetchUsers, 3000);
    const handleFocus = () => fetchUsers();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const getRoleBadgeStyle = (role: Role) => {
    switch (role) {
      case 'ADMIN':
        return 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-black';
      case 'SUB_ADMIN':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-black';
      case 'ELITE_MEMBER':
        return 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold';
      default:
        return 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30 font-semibold';
    }
  };

  const handleAction = async (
    action: 'APPROVE' | 'REJECT' | 'DELETE',
    userId: string,
    nickname: string,
    roleForApprove?: Role
  ) => {
    const actionLabel =
      action === 'APPROVE' ? '승인' : action === 'REJECT' ? '거절' : '삭제';
    if (!confirm(`'${nickname}' 문파원을 정말 ${actionLabel}하시겠습니까?`)) {
      return;
    }

    setActionLoadingId(userId);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, userId, role: roleForApprove }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '처리 실패');
        setActionLoadingId(null);
        return;
      }
      alert(data.message);
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleUpdateRole = async (user: MemberUser, targetRole: Role) => {
    if (user.role === targetRole) return;
    if (user.username === '뱀설') {
      alert('최고 권력자인 문주(뱀설) 계정의 등급은 변경할 수 없습니다.');
      return;
    }
    if (!confirm(`'${user.nickname}' 님의 등급을 [${ROLE_LABELS[targetRole]}](으)로 변경하시겠습니까?`)) {
      return;
    }

    setActionLoadingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_ROLE',
          userId: user.id,
          newRole: targetRole,
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchUsers();
      } else {
        alert(data.message || '등급 변경 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCreateApprovedUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newNickname.trim() || !newUsername.trim() || !newPassword.trim()) {
      alert('캐릭터 닉네임, 로그인 아이디, 비밀번호를 모두 입력해주세요.');
      return;
    }
    setCreatingUser(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'CREATE_APPROVED_USER',
          nickname: newNickname.trim(),
          username: newUsername.trim(),
          password: newPassword.trim(),
          role: newRole,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        alert(data.message || '계정 생성 실패');
        setCreatingUser(false);
        return;
      }
      alert(data.message);
      setIsCreateOpen(false);
      setNewNickname('');
      setNewUsername('');
      setNewPassword('');
      setNewRole('MEMBER');
      fetchUsers();
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingUser(false);
    }
  };

  const handleResetPassword = async (user: MemberUser) => {
    const newPass = prompt(
      `[${user.nickname}] 문파원의 새로운 비밀번호를 입력해주세요:`,
      isMainAdmin ? (user.plainPassword || '') : ''
    );
    if (!newPass || !newPass.trim()) return;

    setActionLoadingId(user.id);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_PASSWORD',
          userId: user.id,
          newPassword: newPass.trim(),
        }),
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchUsers();
      } else {
        alert(data.message || '비밀번호 변경 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCopyCredentials = (user: MemberUser) => {
    const passDisplay = isMainAdmin
      ? user.plainPassword || ''
      : '•••••••• (문주만 열람 가능)';
    const text = `[외길 문파 로그인 계정 안내]\n• 등급: ${ROLE_LABELS[user.role] || '문파원'}\n• 캐릭터 닉네임(활동명): ${user.nickname}\n• 로그인 아이디: ${user.username}\n• 비밀번호: ${passDisplay}`;
    navigator.clipboard.writeText(text);
    setCopiedId(user.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filteredUsers = users.filter(
    u =>
      u.nickname.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase())
  );

  const pendingUsers = filteredUsers.filter(u => u.status === 'PENDING');
  const approvedUsers = filteredUsers.filter(u => u.status === 'APPROVED');

  if (authChecking) return null;
  if (!canManage) return null;

  return (
    <div className="max-w-6xl mx-auto space-y-5 pb-16">
      {/* 상단 헤더 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-white flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>대시보드로 돌아가기</span>
            </Link>
          </div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-extrabold text-white flex items-center space-x-2.5">
            <Crown className="w-6 h-6 sm:w-7 sm:h-7 text-amber-400 shrink-0" />
            <span>문파원 등급 부여 & 가입 승인 관리소</span>
          </h1>
          <div className="mt-1.5 text-xs sm:text-sm text-slate-400 space-y-0.5">
            <p>
              • 접속 권한: <strong className="text-amber-300">문주</strong>(최고 권력자) 및 <strong className="text-purple-300">부문주</strong>(전체 관리 허용, 문주 불침범)
            </p>
            <p>
              • 문파원들의 등급을 <strong className="text-amber-300">문주</strong>, <strong className="text-purple-300">부문주</strong>, <strong className="text-rose-300">열혈 문파원</strong>, <strong className="text-indigo-300">문파원</strong> 4단계로 자유롭게 조정할 수 있습니다.
            </p>
            <p>
              • <strong className="text-amber-300">비밀번호 열람·확인</strong> 기능은 보안상 최고 권력자인 <strong className="text-amber-300">문주</strong>만 가능합니다.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setIsCreateOpen(true)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold shadow-md transition-all whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>+ 문파원 계정 직접 생성</span>
          </button>
          <button
            type="button"
            onClick={fetchUsers}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 text-emerald-400" />
            <span>새로고침</span>
          </button>
          {isMainAdmin && (
            <button
              type="button"
              onClick={() => setShowPasswords(prev => !prev)}
              className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all whitespace-nowrap"
            >
              {showPasswords ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
              <span>{showPasswords ? '비밀번호 숨김' : '비밀번호 보기'}</span>
            </button>
          )}
          <span className="px-3 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs whitespace-nowrap">
            대기: {pendingUsers.length}명 / 등록: {approvedUsers.length}명
          </span>
        </div>
      </div>

      {/* 검색창 */}
      <div className="relative max-w-md">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          placeholder="캐릭터 닉네임 또는 로그인 아이디 검색..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
        />
      </div>

      {/* 1. 가입 승인 대기 목록 (Highlighted) */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-4 sm:p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold text-amber-300 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>🚨 가입 승인 대기자 목록 ({pendingUsers.length}명)</span>
          </h2>
          <span className="text-xs text-slate-400">
            승인 즉시 선택된 등급으로 해당 아이디/비밀번호 로그인 가능
          </span>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">로딩 중...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-slate-400 text-xs sm:text-sm">
            현재 대기 중인 신규 가입 요청이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map(user => (
              <div
                key={user.id}
                className="bg-slate-950/90 border border-amber-500/40 rounded-xl p-4 flex flex-col justify-between space-y-3 shadow-lg"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-300 px-2.5 py-0.5 rounded bg-amber-500/20 border border-amber-500/40 animate-pulse">
                      🔔 신규 승인 대기
                    </span>
                    <span className="text-[11px] text-slate-400">
                      신청일: {new Date(user.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">캐릭터 닉네임:</span>
                      <span className="text-sm font-black text-white">{user.nickname}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">로그인 아이디:</span>
                      <code className="font-bold text-amber-300">{user.username}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">설정한 비밀번호:</span>
                      <code className="font-bold text-emerald-300">
                        {isMainAdmin && showPasswords ? user.plainPassword : '••••••••'}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => handleAction('APPROVE', user.id, user.nickname, 'MEMBER')}
                    disabled={actionLoadingId === user.id}
                    className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1 whitespace-nowrap"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>문파원으로 승인</span>
                  </button>

                  <button
                    onClick={() => handleAction('APPROVE', user.id, user.nickname, 'ELITE_MEMBER')}
                    disabled={actionLoadingId === user.id}
                    className="py-2 px-3 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                  >
                    <span>열혈문파원으로 승인</span>
                  </button>

                  {isMainAdmin && (
                    <button
                      onClick={() => handleAction('APPROVE', user.id, user.nickname, 'SUB_ADMIN')}
                      disabled={actionLoadingId === user.id}
                      className="py-2 px-3 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs shadow-md transition-colors whitespace-nowrap"
                    >
                      <span>부문주로 승인</span>
                    </button>
                  )}

                  <button
                    onClick={() => handleAction('REJECT', user.id, user.nickname)}
                    disabled={actionLoadingId === user.id}
                    className="py-2 px-3 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 hover:text-white font-semibold text-xs border border-slate-700 transition-colors whitespace-nowrap"
                  >
                    <UserX className="w-3.5 h-3.5" />
                    <span>거절</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 2. 등록 문파원 계정 및 등급 관리 목록 */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-base sm:text-lg font-bold text-white flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>등록 문파원 등급 및 계정 정보 목록 ({approvedUsers.length}명)</span>
          </h2>
          <span className="text-xs text-slate-400">
            문주/부문주가 직접 문파원들의 직책(등급)을 변경하거나 분실 비밀번호를 안내할 수 있습니다
          </span>
        </div>

        {/* 데스크톱/태블릿 테이블 뷰 */}
        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs sm:text-sm text-slate-300">
            <thead className="bg-slate-950/80 text-xs text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-3 sm:px-4 whitespace-nowrap">문파 활동명</th>
                <th className="py-3 px-3 sm:px-4 whitespace-nowrap">로그인 아이디</th>
                <th className="py-3 px-3 sm:px-4 whitespace-nowrap">비밀번호</th>
                <th className="py-3 px-3 sm:px-4 whitespace-nowrap min-w-[130px]">현재 등급</th>
                <th className="py-3 px-3 sm:px-4 whitespace-nowrap min-w-[140px]">등급 변경</th>
                <th className="py-3 px-3 sm:px-4 text-center whitespace-nowrap">분실 안내 / 계정 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {approvedUsers.map(user => {
                const isTargetAdmin = user.role === 'ADMIN';
                const isTargetSubAdmin = user.role === 'SUB_ADMIN';
                // 부문주는 문주 계정에 대해 어떠한 조작도 불가
                const disabledForSubAdmin = isSubAdmin && isTargetAdmin;
                // 부문주는 다른 부문주 계정을 삭제/강등할 수 없음
                const disabledForOtherSubAdmin = isSubAdmin && isTargetSubAdmin && currentUser?.id !== user.id;

                return (
                  <tr key={user.id} className="hover:bg-slate-800/40 transition-colors">
                    <td className="py-3 px-3 sm:px-4 font-black text-white whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        {isTargetAdmin && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                        {isTargetSubAdmin && <Shield className="w-3.5 h-3.5 text-purple-400 shrink-0" />}
                        <span>{user.nickname}</span>
                      </div>
                    </td>

                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs">
                        {user.username}
                      </code>
                    </td>

                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <code className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-emerald-300 font-bold text-xs">
                        {isTargetAdmin && isMainAdmin
                          ? '(문주 보안 비밀번호)'
                          : isMainAdmin && showPasswords
                          ? user.plainPassword
                          : '••••••••'}
                      </code>
                    </td>

                    {/* 현재 등급 배지 */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded border text-xs ${getRoleBadgeStyle(user.role)}`}>
                        {ROLE_LABELS[user.role] || '문파원'}
                      </span>
                    </td>

                    {/* 등급 변경 드롭다운 */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      {isTargetAdmin ? (
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-500/10 px-2 py-1 rounded border border-amber-500/20">
                          👑 최고 권력자 (변경 불가)
                        </span>
                      ) : disabledForSubAdmin || disabledForOtherSubAdmin ? (
                        <span className="text-[11px] text-slate-500">문주 전용 권한</span>
                      ) : (
                        <select
                          value={user.role}
                          disabled={actionLoadingId === user.id}
                          onChange={e => handleUpdateRole(user, e.target.value as Role)}
                          className="px-2.5 py-1 rounded-lg bg-slate-950 border border-slate-700 text-xs font-bold text-white focus:outline-none focus:border-amber-400 cursor-pointer"
                        >
                          <option value="MEMBER">문파원</option>
                          <option value="ELITE_MEMBER">열혈 문파원</option>
                          <option value="SUB_ADMIN">부문주</option>
                        </select>
                      )}
                    </td>

                    {/* 분실 안내 / 계정 관리 버튼 */}
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        {disabledForSubAdmin ? (
                          <span className="text-xs text-slate-500">보호된 계정</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyCredentials(user)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors whitespace-nowrap"
                              title="아이디/비밀번호 복사하여 문파원에게 안내"
                            >
                              {copiedId === user.id ? (
                                <>
                                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  <span>복사됨</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3.5 h-3.5" />
                                  <span>계정 복사</span>
                                </>
                              )}
                            </button>

                            {!isTargetAdmin && !disabledForOtherSubAdmin && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleResetPassword(user)}
                                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors whitespace-nowrap"
                                  title="비밀번호 변경/재설정"
                                >
                                  <KeyRound className="w-3.5 h-3.5" />
                                  <span>비번 변경</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleAction('DELETE', user.id, user.nickname)}
                                  className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                                  title="계정 삭제"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 문파원 계정 직접 생성 모달 */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <form
            onSubmit={handleCreateApprovedUser}
            className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl space-y-4"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-extrabold text-white flex items-center space-x-2">
                <UserPlus className="w-5 h-5 text-amber-400" />
                <span>문파원 계정 직접 생성 (즉시 승인)</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">부여할 등급(직책)</label>
              <select
                value={newRole}
                onChange={e => setNewRole(e.target.value as Role)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm font-bold text-amber-300 focus:outline-none focus:border-amber-400"
              >
                <option value="MEMBER">문파원</option>
                <option value="ELITE_MEMBER">열혈 문파원</option>
                <option value="SUB_ADMIN">부문주</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">캐릭터 닉네임 (활동명)</label>
              <input
                type="text"
                required
                placeholder="예: 상두불"
                value={newNickname}
                onChange={e => setNewNickname(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-white focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">로그인 아이디</label>
              <input
                type="text"
                required
                placeholder="문파원이 로그인할 아이디"
                value={newUsername}
                onChange={e => setNewUsername(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-amber-300 font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-300">초기 비밀번호</label>
              <input
                type="text"
                required
                placeholder="초기 비밀번호 입력"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-slate-950 border border-slate-700 text-sm text-emerald-300 font-bold focus:outline-none focus:border-amber-400"
              />
            </div>

            <div className="flex space-x-3 pt-2">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs hover:bg-slate-700"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={creatingUser}
                className="flex-1 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs shadow-md disabled:opacity-50"
              >
                {creatingUser ? '생성 중...' : '계정 생성'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
