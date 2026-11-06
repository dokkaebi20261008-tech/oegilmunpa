'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Lock, User, ArrowRight, AlertCircle, Check } from 'lucide-react';

const SAVED_ID_KEY = 'oegil_saved_username';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberId, setRememberId] = useState(true);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 페이지 진입 시 저장된 아이디 불러오기
  useEffect(() => {
    try {
      const saved = localStorage.getItem(SAVED_ID_KEY);
      if (saved) {
        setUsername(saved);
        setRememberId(true);
      }
    } catch (e) {
      // ignore storage errors
    }
  }, []);

  const handleToggleRemember = (checked: boolean) => {
    setRememberId(checked);
    try {
      if (!checked) {
        localStorage.removeItem(SAVED_ID_KEY);
      } else if (username.trim()) {
        localStorage.setItem(SAVED_ID_KEY, username.trim());
      }
    } catch (e) {
      // ignore
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '로그인에 실패했습니다.');
        setLoading(false);
        return;
      }

      // 로그인 성공 시 아이디 저장 체크 여부에 따라 저장/삭제
      try {
        if (rememberId && username.trim()) {
          localStorage.setItem(SAVED_ID_KEY, username.trim());
        } else {
          localStorage.removeItem(SAVED_ID_KEY);
        }
      } catch (e) {
        // ignore
      }

      window.location.href = '/';
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto my-12 bg-slate-900/80 border border-slate-800 rounded-3xl p-8 shadow-2xl space-y-6">
      <div className="text-center space-y-3">
        <div className="overflow-hidden rounded-2xl border border-slate-700/80 shadow-lg mb-2">
          <img
            src="/images/oegil-banner.jpg"
            alt="외길 문파 공식 배너"
            className="w-full h-36 object-cover object-center"
          />
        </div>
        <h1 className="text-2xl font-black text-white tracking-tight">외길 문파원 로그인</h1>
        <p className="text-xs text-slate-400">
          경매 입찰 및 개인 출석/배당금 확인을 위해 로그인해 주세요.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">아이디</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="아이디를 입력하세요"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">비밀번호</label>
          <div className="relative">
            <Lock className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="비밀번호를 입력하세요"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
        </div>

        {/* 아이디 저장 체크박스 */}
        <div className="flex items-center justify-between pt-0.5">
          <label className="inline-flex items-center space-x-2 cursor-pointer select-none group">
            <input
              type="checkbox"
              checked={rememberId}
              onChange={e => handleToggleRemember(e.target.checked)}
              className="sr-only"
            />
            <span
              className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
                rememberId
                  ? 'bg-amber-500 border-amber-400 text-slate-950'
                  : 'bg-slate-950 border-slate-700 group-hover:border-slate-500'
              }`}
            >
              {rememberId && <Check className="w-3 h-3 stroke-[3]" />}
            </span>
            <span className="text-xs font-semibold text-slate-300 group-hover:text-white transition-colors">
              아이디 저장
            </span>
          </label>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span>{loading ? '로그인 중...' : '로그인'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
        아직 외길 문파원이 아니신가요?{' '}
        <Link href="/register" className="font-bold text-amber-400 hover:underline">
          회원가입하기
        </Link>
      </div>

      <div className="p-3 bg-slate-950/60 rounded-xl text-[11px] text-slate-400 border border-slate-800/80 text-center">
        🔒 로그인 아이디는 본인 인증에만 사용되며, 사이트 내 모든 활동명은 <strong>캐릭터 닉네임</strong>으로만 표시됩니다.
      </div>
    </div>
  );
}
