'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Shield, Swords, Gavel, ShoppingBag, User as UserIcon, LogOut, CheckCircle2, Menu, X, Users, Calculator } from 'lucide-react';
import { getCachedUser, setCachedUser } from '@/lib/clientAuth';
import { isManagerRole, getRoleLabel } from '@/lib/types';

export default function Navbar() {
  const pathname = usePathname();
  const [currentUser, setCurrentUser] = useState<any>(() => getCachedUser());
  const [pendingCount, setPendingCount] = useState(0);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const getRoleBadgeClass = (role?: string) => {
    if (role === 'ADMIN') return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    if (role === 'SUB_ADMIN') return 'bg-purple-500/20 text-purple-300 border-purple-500/40';
    if (role === 'ELITE_MEMBER') return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
  };

  const syncData = () => {
    fetch('/api/auth/me', { cache: 'no-store' })
      .then(res => res.json())
      .then(data => {
        if (data.authenticated && data.user) {
          setCachedUser(data.user);
          setCurrentUser(data.user);
          if (isManagerRole(data.user.role)) {
            fetch('/api/admin/users', { cache: 'no-store' })
              .then(r => r.json())
              .then(ud => setPendingCount(ud.pendingCount || 0))
              .catch(() => {});
          }
        } else {
          setCachedUser(null);
          setCurrentUser(null);
        }
      })
      .catch(() => {});
  };

  useEffect(() => {
    syncData();
    const interval = setInterval(syncData, 3000);
    const handleFocus = () => syncData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, [pathname]);

  const handleLogout = async () => {
    setCachedUser(null);
    await fetch('/api/auth/logout', { method: 'POST' });
    setCurrentUser(null);
    window.location.href = '/';
  };

  const navLinks = currentUser ? [
    { href: '/', label: '출석 대시보드', icon: Swords },
    { href: '/distribution', label: '참여·분배 현황', icon: Calculator },
    { href: '/attendance', label: '상세 출석부', icon: CheckCircle2 },
    { href: '/auction', label: '문파 경매장', icon: Gavel },
    { href: '/shop', label: '문파 상점', icon: ShoppingBag },
  ] : [
    { href: '/', label: '문파 포털 안내', icon: Shield },
  ];

  if (isManagerRole(currentUser?.role)) {
    navLinks.push({
      href: '/admin/members',
      label: '회원·등급 관리',
      icon: Users,
    });
  }

  return (
    <nav className="sticky top-0 z-50 bg-[#0f172a]/95 backdrop-blur border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2.5 group shrink-0 whitespace-nowrap">
            <img
              src="/images/oegil-logo.jpg"
              alt="외길 문파 로고"
              className="w-10 h-10 rounded-xl object-cover border border-amber-500/40 shadow-lg shadow-indigo-500/30 group-hover:scale-105 transition-transform shrink-0"
            />
            <div className="whitespace-nowrap">
              <div className="font-extrabold text-base lg:text-lg tracking-tight bg-gradient-to-r from-amber-300 via-amber-100 to-white bg-clip-text text-transparent flex items-center gap-2 whitespace-nowrap">
                <span className="whitespace-nowrap">외길 문파</span>
                <span className="hidden xl:inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-semibold tracking-normal whitespace-nowrap shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0"></span>
                  <span>실시간 연동</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400 -mt-0.5 tracking-wider uppercase font-semibold whitespace-nowrap">
                Dokkaebi Guild System
              </div>
            </div>
          </Link>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center space-x-1 shrink-0">
            {navLinks.map((link) => {
              const Icon = link.icon;
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`flex items-center space-x-1.5 px-2.5 lg:px-3 py-2 rounded-lg text-xs lg:text-sm font-semibold whitespace-nowrap shrink-0 transition-colors ${
                    isActive
                      ? 'bg-indigo-600/20 text-amber-300 border border-indigo-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-amber-400' : 'text-slate-400'}`} />
                  <span className="whitespace-nowrap">{link.label}</span>
                  {link.href === '/admin/members' && pendingCount > 0 && (
                    <span className="ml-1 inline-flex items-center px-1.5 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-black shadow-sm shadow-rose-500/50 animate-pulse whitespace-nowrap shrink-0">
                      대기 {pendingCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* User Controls */}
          <div className="hidden md:flex items-center space-x-3 shrink-0 whitespace-nowrap">
            {currentUser ? (
              <div className="flex items-center space-x-2.5 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-1.5 whitespace-nowrap shrink-0">
                <Link href="/mypage" className="flex items-center space-x-2 text-sm hover:opacity-80 transition-opacity whitespace-nowrap">
                  <div className="w-7 h-7 rounded-full bg-indigo-600/30 border border-indigo-500/50 flex items-center justify-center text-xs font-bold text-indigo-300 shrink-0">
                    {currentUser.nickname.slice(0, 1)}
                  </div>
                  <div className="whitespace-nowrap">
                    <span className="font-bold text-slate-200 whitespace-nowrap">{currentUser.nickname}</span>
                    <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded border font-semibold whitespace-nowrap ${getRoleBadgeClass(currentUser.role)}`}>
                      {getRoleLabel(currentUser.role)}
                    </span>
                  </div>
                </Link>
                <button
                  onClick={handleLogout}
                  className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors shrink-0"
                  title="로그아웃"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link
                  href="/login"
                  className="px-3 py-1.5 text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  className="px-3.5 py-1.5 text-sm font-semibold text-slate-900 bg-amber-400 hover:bg-amber-300 rounded-lg shadow-sm transition-colors"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden">
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-800 bg-[#0f172a] px-4 pt-3 pb-4 space-y-2">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href;
            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center space-x-3 px-3 py-2.5 rounded-lg text-base font-medium ${
                  isActive ? 'bg-indigo-600/30 text-amber-300' : 'text-slate-300 hover:bg-slate-800'
                }`}
              >
                <Icon className="w-5 h-5 text-slate-400" />
                <span>{link.label}</span>
              </Link>
            );
          })}
          <div className="pt-3 border-t border-slate-800">
            {currentUser ? (
              <div className="flex items-center justify-between">
                <Link href="/mypage" onClick={() => setMobileMenuOpen(false)} className="text-sm font-medium text-slate-200">
                  {currentUser.nickname} ({getRoleLabel(currentUser.role)})
                </Link>
                <button
                  onClick={handleLogout}
                  className="text-xs text-rose-400 hover:underline"
                >
                  로그아웃
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                <Link
                  href="/login"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-sm font-medium bg-slate-800 text-white rounded-lg"
                >
                  로그인
                </Link>
                <Link
                  href="/register"
                  onClick={() => setMobileMenuOpen(false)}
                  className="text-center py-2 text-sm font-bold bg-amber-400 text-slate-900 rounded-lg"
                >
                  회원가입
                </Link>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
