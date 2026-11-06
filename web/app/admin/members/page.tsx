'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
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
  Search
} from 'lucide-react';

interface MemberUser {
  id: string;
  username: string;
  plainPassword?: string;
  nickname: string;
  role: 'ADMIN' | 'MEMBER';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export default function AdminMembersPage() {
  const [users, setUsers] = useState<MemberUser[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [showPasswords, setShowPasswords] = useState<boolean>(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [search, setSearch] = useState('');

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
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (!d.authenticated || d.user.role !== 'ADMIN') {
          alert('문파장(어드민)만 접근 가능한 페이지입니다.');
          window.location.href = '/';
          return;
        }
        setCurrentUser(d.user);
        fetchUsers();
      });

    const interval = setInterval(fetchUsers, 4000);
    const handleFocus = () => fetchUsers();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleAction = async (
    action: 'APPROVE' | 'REJECT' | 'DELETE',
    userId: string,
    nickname: string
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
        body: JSON.stringify({ action, userId }),
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

  const handleResetPassword = async (user: MemberUser) => {
    const newPass = prompt(
      `[${user.nickname}] 문파원의 새로운 비밀번호를 입력해주세요:`,
      user.plainPassword || ''
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
    const text = `[외길 문파 로그인 계정 안내]\n• 캐릭터 닉네임(활동명): ${user.nickname}\n• 로그인 아이디: ${user.username}\n• 비밀번호: ${user.plainPassword || ''}`;
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

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="flex items-center space-x-2 text-xs text-slate-400 mb-1">
            <Link href="/" className="hover:text-white flex items-center space-x-1">
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>대시보드로 돌아가기</span>
            </Link>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white flex items-center space-x-3">
            <Shield className="w-7 h-7 text-amber-400" />
            <span>어드민 전용 회원정보 & 가입 승인 관리</span>
          </h1>
          <div className="mt-1.5 text-xs sm:text-sm text-slate-400 space-y-0.5">
            <p>• 일반 문파원 화면에서는 서로의 아이디가 비공개되며 오직 캐릭터 닉네임(활동명)만 표시됩니다.</p>
            <p>• 문파장(어드민) 전용 메뉴인 이곳에서만 분실 안내를 위해 회원들의 아이디와 비밀번호를 확인·관리할 수 있습니다.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setShowPasswords(prev => !prev)}
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-bold transition-all"
          >
            {showPasswords ? <EyeOff className="w-4 h-4 text-amber-400" /> : <Eye className="w-4 h-4 text-amber-400" />}
            <span>{showPasswords ? '비밀번호 가리기' : '비밀번호 표시하기'}</span>
          </button>
          <span className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
            승인 대기: {pendingUsers.length}명 / 정회원: {approvedUsers.length}명
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

      {/* 1. Pending Approval Section (Highlighted) */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-amber-300 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>🚨 가입 승인 대기자 목록 ({pendingUsers.length}명)</span>
          </h2>
          <span className="text-xs text-slate-400">
            승인 즉시 해당 아이디/비밀번호로 로그인 가능
          </span>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">로딩 중...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-slate-400 text-sm">
            현재 대기 중인 신규 가입 요청이 없습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map(user => (
              <div
                key={user.id}
                className="bg-slate-950/90 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      승인 대기
                    </span>
                    <span className="text-[11px] text-slate-500">
                      신청일: {new Date(user.createdAt).toLocaleString()}
                    </span>
                  </div>

                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 space-y-1.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">캐릭터 닉네임(활동명):</span>
                      <span className="text-sm font-black text-white">{user.nickname}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">로그인 아이디:</span>
                      <code className="font-bold text-amber-300">{user.username}</code>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400">설정한 비밀번호:</span>
                      <code className="font-bold text-emerald-300">
                        {showPasswords ? user.plainPassword : '••••••••'}
                      </code>
                    </div>
                  </div>
                </div>

                <div className="flex space-x-2 pt-2 border-t border-slate-900">
                  <button
                    onClick={() => handleAction('APPROVE', user.id, user.nickname)}
                    disabled={actionLoadingId === user.id}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition-colors flex items-center justify-center space-x-1.5 disabled:opacity-50"
                  >
                    <UserCheck className="w-4 h-4" />
                    <span>가입 승인</span>
                  </button>
                  <button
                    onClick={() => handleAction('REJECT', user.id, user.nickname)}
                    disabled={actionLoadingId === user.id}
                    className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-rose-900/50 text-rose-400 hover:text-white font-semibold text-xs border border-slate-700 transition-colors flex items-center justify-center space-x-1"
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

      {/* 2. Approved Members Section (with ID & Password lookup for Admin) */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            <span>정회원 계정 정보 목록 ({approvedUsers.length}명)</span>
          </h2>
          <span className="text-xs text-slate-400">
            비밀번호를 분실한 문파원에게 [계정 복사] 또는 [비번 변경]으로 즉시 안내할 수 있습니다
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">캐릭터 닉네임 (사이트 활동명)</th>
                <th className="py-3 px-4">로그인 아이디 (어드민 열람)</th>
                <th className="py-3 px-4">비밀번호 (어드민 열람)</th>
                <th className="py-3 px-4">권한</th>
                <th className="py-3 px-4">가입일</th>
                <th className="py-3 px-4 text-center">분실 안내 / 관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {approvedUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-black text-white">{user.nickname}</td>
                  <td className="py-3 px-4">
                    <code className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-amber-300 font-bold text-xs">
                      {user.username}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <code className="px-2 py-1 rounded bg-slate-950 border border-slate-800 text-emerald-300 font-bold text-xs">
                      {user.role === 'ADMIN'
                        ? '(문파장 보안 비밀번호)'
                        : showPasswords
                        ? user.plainPassword
                        : '••••••••'}
                    </code>
                  </td>
                  <td className="py-3 px-4">
                    <span
                      className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                        user.role === 'ADMIN'
                          ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {user.role === 'ADMIN' ? '문파장(어드민)' : '정회원'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1.5">
                      {user.role !== 'ADMIN' && (
                        <>
                          <button
                            type="button"
                            onClick={() => handleCopyCredentials(user)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 text-xs font-bold transition-colors"
                            title="아이디/비밀번호 복사하여 안내하기"
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

                          <button
                            type="button"
                            onClick={() => handleResetPassword(user)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-bold transition-colors"
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
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
