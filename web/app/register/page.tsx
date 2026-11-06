'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Shield, Lock, User, Sparkles, ArrowRight, AlertCircle } from 'lucide-react';

export default function RegisterPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.message || '회원가입에 실패했습니다.');
        setLoading(false);
        return;
      }
      setSubmitted(true);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="max-w-md mx-auto my-12 bg-slate-900/90 border border-amber-500/30 rounded-3xl p-8 shadow-2xl space-y-6 text-center">
        <div className="w-16 h-16 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center mx-auto text-amber-400">
          <Sparkles className="w-8 h-8" />
        </div>
        <h1 className="text-2xl font-black text-white">가입 신청 완료!</h1>
        <p className="text-sm text-slate-300 leading-relaxed break-keep">
          <strong className="text-amber-400">[{nickname}]</strong> 문파원님의 계정 등록 요청이 문파장에게 전달되었습니다.
        </p>
        <div className="p-4 rounded-2xl bg-slate-950 border border-slate-800 text-xs text-slate-300 space-y-1.5 break-keep leading-relaxed text-left">
          <div className="text-amber-300 font-bold">💡 문파장 가입 승인제 안내</div>
          <div>• 우리 문파는 허위 가입 방지를 위해 문파장이 직접 확인 후 승인합니다.</div>
          <div>• 문파장 승인 완료 즉시 등록하신 아이디로 바로 로그인하실 수 있습니다.</div>
        </div>
        <Link
          href="/login"
          className="block w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20"
        >
          로그인 페이지로 가기
        </Link>
      </div>
    );
  }

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
        <h1 className="text-2xl font-black text-white tracking-tight">외길 문파 정회원 가입</h1>
        <div className="text-xs text-slate-400 space-y-0.5 leading-relaxed">
          <p>게임 내 캐릭터 닉네임을 정확히 입력해 주세요.</p>
          <p className="text-slate-500">(주간 컨텐츠 출석 체크 및 정산과 자동 매칭됩니다)</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">게임 캐릭터 닉네임 (사이트 활동명 • 필수)</label>
          <div className="relative">
            <Shield className="w-4 h-4 text-amber-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={nickname}
              onChange={e => setNickname(e.target.value)}
              placeholder="게임 내 실제 캐릭터 닉네임 입력"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <p className="text-[11px] text-amber-300/90 mt-0.5">
            * 사이트 내 모든 곳(출석·사다리·경매·분배)에서 오직 이 닉네임만 활동명으로 표시됩니다.
          </p>
        </div>

        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-300">로그인 전용 아이디 (비공개)</label>
          <div className="relative">
            <User className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              required
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="본인만 아는 로그인 아이디 입력"
              className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            * 로그인 아이디는 다른 문파원에게 절대 노출되지 않습니다.
          </p>
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

        {error && (
          <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-start space-x-2.5 break-keep leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="whitespace-pre-line">{error}</span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-sm shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
        >
          <span>{loading ? '가입 처리 중...' : '정회원 가입 완료'}</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </form>

      <div className="pt-4 border-t border-slate-800 text-center text-xs text-slate-400">
        이미 계정이 있으신가요?{' '}
        <Link href="/login" className="font-bold text-indigo-400 hover:underline">
          로그인하기
        </Link>
      </div>
    </div>
  );
}
