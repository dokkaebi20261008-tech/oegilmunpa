import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  title: '외길 문파 - 출석 & 경매 분배 시스템',
  description: '도깨비의 세계 외길 문파 주간 4대 컨텐츠 출석 및 경매 금전 분배 공식 사이트',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body className="bg-[#0b0f19] text-slate-100 min-h-screen flex flex-col">
        <Navbar />
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
          {children}
        </main>
        <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500">
          <p>© 2026 외길 문파 관리 위원회. All rights reserved.</p>
          <p className="mt-1 text-[11px] text-slate-600">
            수동 참여 1.0P / 분신 등록 0.25P • 경매 낙찰 금전 포인트 비례 자동 분배
          </p>
        </footer>
      </body>
    </html>
  );
}
