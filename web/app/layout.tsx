import type { Metadata } from 'next';
import './globals.css';
import Navbar from '@/components/Navbar';

export const metadata: Metadata = {
  metadataBase: new URL('https://oegilmunpa.vercel.app'),
  title: '외길 문파 - 출석 & 경매 분배 시스템',
  description: '도깨비의 세계 외길 문파 주간 4대 컨텐츠 출석 및 경매 금전 분배 공식 사이트',
  icons: {
    icon: '/images/oegil-logo.jpg',
    apple: '/images/oegil-logo.jpg',
  },
  openGraph: {
    title: '외길 문파 - 통합 참여율 · 상점 · 경매 · 분배 포털',
    description: '한 길만 걷는 우리, 지금도, 앞으로도 - 외길 문파 공식 포털',
    images: ['/images/oegil-banner.jpg'],
  },
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
        <footer className="border-t border-slate-900 bg-slate-950/60 py-6 text-center text-xs text-slate-500 space-y-3">
          <div className="flex items-center justify-center gap-3">
            <a
              href="https://discord.com/invite/tbQtBc8ZTf"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#5865F2]/20 hover:bg-[#5865F2]/30 text-indigo-300 border border-[#5865F2]/40 text-xs transition-colors font-semibold"
            >
              <span>문파 디스코드</span>
            </a>
            <a
              href="https://open.kakao.com/o/gRASfxRi"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-full bg-[#FEE500]/20 hover:bg-[#FEE500]/30 text-amber-300 border border-[#FEE500]/40 text-xs transition-colors font-semibold"
            >
              <span>문파 오픈톡방</span>
            </a>
          </div>
          <p>© 2026 외길 문파 관리 위원회. All rights reserved.</p>
          <p className="text-[11px] text-slate-600">
            수동 참여 1.0P / 분신 등록 0.25P • 경매 낙찰 금전 포인트 비례 자동 분배
          </p>
        </footer>
      </body>
    </html>
  );
}
