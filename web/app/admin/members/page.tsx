'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { UserCheck, UserX, Clock, Shield, Trash2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';

interface MemberUser {
  id: string;
  username: string;
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
          alert('문파장(관리자)만 접근 가능한 페이지입니다.');
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

  const handleAction = async (action: 'APPROVE' | 'REJECT' | 'DELETE', userId: string, nickname: string) => {
    const actionLabel = action === 'APPROVE' ? '승인' : action === 'REJECT' ? '거절' : '삭제';
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

  const pendingUsers = users.filter(u => u.status === 'PENDING');
  const approvedUsers = users.filter(u => u.status === 'APPROVED');
  const rejectedUsers = users.filter(u => u.status === 'REJECTED');

  return (
    <div className="max-w-5xl mx-auto space-y-8">
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
            <span>문파원 가입 승인 및 계정 관리</span>
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            문파원이 아이디/패스워드로 회원가입을 요청하면, 문파장이 확인 후 정식 승인합니다.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-300 font-bold text-xs">
            대기 중인 신청: {pendingUsers.length}건
          </span>
        </div>
      </div>

      {/* 1. Pending Approval Section (Highlighted) */}
      <div className="bg-gradient-to-r from-amber-950/30 via-slate-900 to-slate-900 border border-amber-900/40 rounded-2xl p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-amber-300 flex items-center space-x-2">
            <Clock className="w-5 h-5 text-amber-400 animate-pulse" />
            <span>🚨 가입 승인 대기자 목록 ({pendingUsers.length}명)</span>
          </h2>
          <span className="text-xs text-slate-400">승인 시 즉시 사이트 로그인 및 경매 입찰 가능</span>
        </div>

        {loading ? (
          <div className="text-center py-6 text-slate-400 text-sm">로딩 중...</div>
        ) : pendingUsers.length === 0 ? (
          <div className="p-6 rounded-xl bg-slate-950/60 border border-slate-800/80 text-center text-slate-400 text-sm">
            현재 대기 중인 신규 가입 요청이 없습니다. 모든 요청이 처리되었습니다.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pendingUsers.map(user => (
              <div
                key={user.id}
                className="bg-slate-950/80 border border-slate-800 rounded-xl p-4 flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-400 px-2 py-0.5 rounded bg-amber-500/10 border border-amber-500/20">
                      승인 대기
                    </span>
                    <span className="text-[11px] text-slate-500">
                      신청일: {new Date(user.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="mt-3">
                    <div className="text-base font-black text-white flex items-center space-x-2">
                      <span>활동 닉네임: {user.nickname}</span>
                    </div>
                    <div className="text-xs text-slate-500 mt-0.5">
                      로그인 아이디: 비공개 보호됨
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

      {/* 2. Approved Members Section */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-lg space-y-4">
        <h2 className="text-lg font-bold text-white flex items-center space-x-2">
          <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          <span>승인 완료된 정회원 계정 ({approvedUsers.length}명)</span>
        </h2>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-xs uppercase text-slate-400 font-bold border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">게임 캐릭터 닉네임 (활동명)</th>
                <th className="py-3 px-4">권한</th>
                <th className="py-3 px-4">가입일</th>
                <th className="py-3 px-4 text-center w-24">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {approvedUsers.map(user => (
                <tr key={user.id} className="hover:bg-slate-800/40">
                  <td className="py-3 px-4 font-bold text-white">{user.nickname}</td>
                  <td className="py-3 px-4">
                    <span className={`text-[11px] font-bold px-2 py-0.5 rounded border ${
                      user.role === 'ADMIN'
                        ? 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                        : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                    }`}>
                      {user.role === 'ADMIN' ? '문파장' : '정회원'}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500">
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-4 text-center">
                    {user.role !== 'ADMIN' && (
                      <button
                        onClick={() => handleAction('DELETE', user.id, user.nickname)}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors"
                        title="계정 삭제"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
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
