'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ShoppingBag,
  Users,
  X,
  Gavel,
  RotateCcw,
  CheckCircle2,
  Coins,
  UserPlus,
  Check,
  Clock
} from 'lucide-react';
import { ShopItem } from '@/lib/types';
import { useAuthUser } from '@/lib/clientAuth';

export default function ShopPage() {
  const [items, setItems] = useState<ShopItem[]>([]);
  const { currentUser } = useAuthUser();
  const [loading, setLoading] = useState(true);

  // 상점 상품 -> 30분 경매 등록 모달 상태
  const [auctionModalItem, setAuctionModalItem] = useState<ShopItem | null>(null);
  const [startingBid, setStartingBid] = useState<number>(20000);
  const [minBidIncrement, setMinBidIncrement] = useState<number>(500);
  const [creatingAuction, setCreatingAuction] = useState(false);

  const fetchShopData = () => {
    fetch('/api/shop', { cache: 'no-store' })
      .then(res => res.json())
      .then(d => {
        if (d.success) {
          setItems(d.items || []);
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchShopData();
    const interval = setInterval(fetchShopData, 3500);
    const handleFocus = () => fetchShopData();
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  // 내 캐릭터로 희망 신청/취소 토글
  const handleToggleMyApplication = async (itemId: string) => {
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'TOGGLE_APPLICANT', itemId })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 희망자 태그 삭제
  const handleRemoveApplicant = async (itemId: string, nickname: string) => {
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'REMOVE_APPLICANT', itemId, nickname })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 희망자 명단 초기화
  const handleResetAllApplicants = async () => {
    if (!confirm('전설 도안 선택 상자의 구매 희망자 명단을 초기화하시겠습니까?')) return;
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'RESET_APPLICANTS' })
      });
      const d = await res.json();
      if (d.success) {
        setItems(d.items);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 상점 상품으로 30분 경매 즉시 시작
  const handleStartAuction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auctionModalItem) return;

    if (startingBid <= 0 || minBidIncrement <= 0) {
      alert('최소 구매 입찰가와 최소 입찰 호가 단위를 0보다 크게 입력해주세요.');
      return;
    }

    setCreatingAuction(true);
    try {
      const res = await fetch('/api/shop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'START_AUCTION_FROM_SHOP',
          itemId: auctionModalItem.id,
          startingBid,
          minBidIncrement
        })
      });
      const d = await res.json();
      if (d.success) {
        setAuctionModalItem(null);
        fetchShopData();
        window.location.href = '/auction';
      } else {
        alert(d.message || '경매 생성 실패');
      }
    } catch (err: any) {
      alert(err.message);
    } finally {
      setCreatingAuction(false);
    }
  };

  const singleItem = items[0];

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '2.2rem 1.5rem 4rem' }}>
      {/* 상단 헤더 */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: '2rem'
        }}
      >
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <span
              className="badge"
              style={{
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#fbbf24',
                border: '1px solid rgba(245, 158, 11, 0.35)',
                fontWeight: 700
              }}
            >
              📦 문파 주간 한정 상점 • 단일 품목 경매 연동
            </span>
          </div>
          <h1
            style={{
              fontSize: '1.85rem',
              fontWeight: 800,
              display: 'flex',
              alignItems: 'center',
              gap: 10
            }}
          >
            <ShoppingBag size={28} color="#f59e0b" />
            외길 문파 상점 (전설 도안 선택 상자)
          </h1>
          <div
            style={{
              color: '#94a3b8',
              marginTop: 10,
              fontSize: '0.92rem',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              lineHeight: 1.65
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#f59e0b', fontWeight: 800 }}>•</span>
              <span>
                문파 상점은{' '}
                <strong style={{ color: '#e2e8f0' }}>전설 도안 선택 상자 (11,500 주화)</strong>{' '}
                단일 품목으로 운영됩니다.
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ color: '#38bdf8', fontWeight: 800 }}>•</span>
              <span>
                구매 희망자를 접수한 뒤{' '}
                <strong style={{ color: '#38bdf8' }}>최소 입찰가와 호가 단위</strong>를 정하여{' '}
                <strong style={{ color: '#fbbf24' }}>30분 타이머 익명 경매</strong>를 즉시 시작할 수 있습니다.
              </span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleResetAllApplicants}
            className="btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.86rem' }}
          >
            <RotateCcw size={15} />
            희망자 명단 초기화
          </button>
          <Link
            href="/auction"
            className="btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              textDecoration: 'none',
              fontSize: '0.9rem'
            }}
          >
            <Gavel size={16} />
            문파 경매장 바로가기
          </Link>
        </div>
      </div>

      {/* 단일 상품 카드: 전설 도안 선택 상자 */}
      {loading ? (
        <div className="glass-card" style={{ padding: '4rem', textAlign: 'center', color: '#94a3b8' }}>
          문파 상점 정보를 불러오는 중입니다...
        </div>
      ) : singleItem ? (
        <div
          className="glass-card"
          style={{
            padding: '1.85rem',
            borderRadius: 18,
            background: 'linear-gradient(180deg, rgba(24, 26, 36, 0.96) 0%, rgba(16, 18, 26, 0.98) 100%)',
            border: '1px solid rgba(245, 158, 11, 0.35)',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.45)',
            display: 'flex',
            flexDirection: 'column',
            gap: '1.5rem'
          }}
        >
          {/* 인게임 상점 슬롯 배너 (전설 도안 선택 상자 단일 표시) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 18,
              padding: '1.25rem 1.4rem',
              borderRadius: 14,
              background: 'rgba(18, 19, 24, 0.96)',
              border: '1px solid rgba(255, 255, 255, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
              <div
                style={{
                  position: 'relative',
                  width: 84,
                  height: 84,
                  borderRadius: 14,
                  overflow: 'hidden',
                  flexShrink: 0,
                  border: '2px solid #eab308',
                  boxShadow: '0 4px 16px rgba(234, 179, 8, 0.35)',
                  background: '#1e1b18'
                }}
              >
                <img
                  src={singleItem.imageUrl || '/images/shop-weapon.png'}
                  alt={singleItem.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{
                      fontSize: '0.76rem',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: 6,
                      background: 'rgba(245, 158, 11, 0.16)',
                      color: '#fbbf24',
                      border: '1px solid rgba(245, 158, 11, 0.35)'
                    }}
                  >
                    문파 상점 단일 품목
                  </span>
                </div>
                <div
                  style={{
                    fontSize: '1.35rem',
                    fontWeight: 900,
                    color: '#f8fafc',
                    marginBottom: 6,
                    letterSpacing: '-0.02em'
                  }}
                >
                  {singleItem.name}
                </div>

                {/* 주화 아이콘 + 11,500 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: '50%',
                      background: 'radial-gradient(circle at 30% 30%, #fde047, #ca8a04)',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.72rem',
                      fontWeight: 900,
                      color: '#422006',
                      boxShadow: '0 0 6px rgba(234,179,8,0.5)'
                    }}
                  >
                    紋
                  </span>
                  <span
                    style={{
                      fontSize: '1.25rem',
                      fontWeight: 900,
                      color: '#ef4444',
                      letterSpacing: '-0.01em'
                    }}
                  >
                    {singleItem.price.toLocaleString()}
                  </span>
                  <span style={{ fontSize: '0.84rem', color: '#94a3b8' }}>문파 주화</span>
                </div>

                {/* 문파 주간 한정: (0/10) */}
                <div
                  style={{
                    fontSize: '0.92rem',
                    fontWeight: 800,
                    color: '#facc15'
                  }}
                >
                  {singleItem.weeklyLimit || `문파 주간 한정: (${10 - singleItem.stock}/10)`}
                </div>
              </div>
            </div>

            {/* 우측: 즉시 30분 경매 시작 버튼 */}
            <button
              onClick={() => {
                setAuctionModalItem(singleItem);
                setStartingBid(20000);
                setMinBidIncrement(500);
              }}
              className="btn-primary"
              style={{
                padding: '0.95rem 1.4rem',
                borderRadius: 12,
                fontSize: '0.98rem',
                fontWeight: 800,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                boxShadow: '0 8px 24px rgba(245, 158, 11, 0.3)'
              }}
            >
              <Gavel size={18} />
              전설 도안 선택 상자 경매 열기 (30분)
            </button>
          </div>

          {/* 구매 희망자 접수 및 목록 */}
          <div
            style={{
              background: 'rgba(15, 23, 42, 0.65)',
              borderRadius: 14,
              padding: '1.25rem',
              border: '1px solid rgba(148, 163, 184, 0.14)',
              display: 'flex',
              flexDirection: 'column',
              gap: 14
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <span
                style={{
                  fontSize: '0.95rem',
                  fontWeight: 800,
                  color: '#cbd5e1',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8
                }}
              >
                <Users size={18} color="#f59e0b" />
                전설 도안 선택 상자 구매 희망자
              </span>
              <span
                style={{
                  fontSize: '0.82rem',
                  fontWeight: 800,
                  padding: '4px 12px',
                  borderRadius: 999,
                  background: (singleItem.applicants || []).length > 0 ? 'rgba(245, 158, 11, 0.2)' : 'rgba(148, 163, 184, 0.12)',
                  color: (singleItem.applicants || []).length > 0 ? '#fbbf24' : '#64748b'
                }}
              >
                총 {(singleItem.applicants || []).length}명 희망 중
              </span>
            </div>

            {/* 희망자 닉네임 배지 목록 */}
            <div
              style={{
                minHeight: 60,
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                alignItems: 'center',
                padding: '0.75rem',
                borderRadius: 10,
                background: 'rgba(2, 6, 23, 0.45)',
                border: '1px solid rgba(148, 163, 184, 0.1)'
              }}
            >
              {(singleItem.applicants || []).length === 0 ? (
                <span style={{ fontSize: '0.88rem', color: '#64748b' }}>
                  아직 구매 희망 신청자가 없습니다. 아래 버튼으로 희망 신청을 해주세요.
                </span>
              ) : (
                (singleItem.applicants || []).map(nick => {
                  const isMe = currentUser?.nickname === nick;
                  return (
                    <span
                      key={nick}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '5px 12px',
                        borderRadius: 8,
                        fontSize: '0.88rem',
                        fontWeight: 700,
                        background: isMe ? 'rgba(245, 158, 11, 0.22)' : 'rgba(30, 41, 59, 0.9)',
                        color: isMe ? '#fde047' : '#e2e8f0',
                        border: isMe
                          ? '1px solid rgba(245, 158, 11, 0.5)'
                          : '1px solid rgba(148, 163, 184, 0.25)'
                      }}
                    >
                      {nick}
                      <button
                        type="button"
                        onClick={() => handleRemoveApplicant(singleItem.id, nick)}
                        title="희망자 제외"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#94a3b8',
                          cursor: 'pointer',
                          padding: 0,
                          display: 'inline-flex',
                          alignItems: 'center'
                        }}
                      >
                        <X size={14} />
                      </button>
                    </span>
                  );
                })
              )}
            </div>

            {/* 내 캐릭터 원클릭 희망 신청 */}
            <div>
              {(() => {
                const myNick = currentUser?.nickname || '';
                const isApplied = myNick ? (singleItem.applicants || []).includes(myNick) : false;
                return (
                  <button
                    type="button"
                    onClick={() => handleToggleMyApplication(singleItem.id)}
                    style={{
                      width: '100%',
                      padding: '0.8rem 1rem',
                      borderRadius: 10,
                      fontSize: '0.92rem',
                      fontWeight: 800,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      transition: 'all 0.15s',
                      background: isApplied
                        ? 'rgba(16, 185, 129, 0.18)'
                        : 'rgba(245, 158, 11, 0.16)',
                      color: isApplied ? '#34d399' : '#fbbf24',
                      border: isApplied
                        ? '1px solid rgba(16, 185, 129, 0.45)'
                        : '1px solid rgba(245, 158, 11, 0.4)'
                    }}
                  >
                    {isApplied ? (
                      <>
                        <Check size={17} /> 내 캐릭터 ({myNick}) 희망 신청 완료 (클릭 시 취소)
                      </>
                    ) : (
                      <>
                        <UserPlus size={17} /> 내 캐릭터 ({myNick || '문파원'}) 구매 희망 신청
                      </>
                    )}
                  </button>
                );
              })()}
            </div>
          </div>
        </div>
      ) : null}

      {/* 상점 상품 -> 30분 경매 시작 설정 모달 */}
      {auctionModalItem && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(2, 6, 23, 0.84)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}
        >
          <div
            className="glass-card"
            style={{
              width: '100%',
              maxWidth: 520,
              padding: '2rem',
              border: '1px solid rgba(245, 158, 11, 0.45)',
              boxShadow: '0 24px 60px rgba(0, 0, 0, 0.65)'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 900, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Gavel size={22} color="#f59e0b" />
                문파 상점 30분 경매 시작 설정
              </h2>
              <button
                onClick={() => setAuctionModalItem(null)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={22} />
              </button>
            </div>

            {/* 선택된 상점 아이템 요약 */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                padding: '0.9rem 1rem',
                borderRadius: 12,
                background: 'rgba(15, 23, 42, 0.85)',
                border: '1px solid rgba(234, 179, 8, 0.35)',
                marginBottom: '1.4rem'
              }}
            >
              <img
                src={auctionModalItem.imageUrl || '/images/shop-weapon.png'}
                alt={auctionModalItem.name}
                style={{ width: 56, height: 56, borderRadius: 10, border: '1.5px solid #eab308' }}
              />
              <div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: '#f8fafc' }}>{auctionModalItem.name}</div>
                <div style={{ fontSize: '0.82rem', color: '#fbbf24', marginTop: 3 }}>
                  구매 희망자 ({(auctionModalItem.applicants || []).length}명):{' '}
                  {(auctionModalItem.applicants || []).length > 0
                    ? auctionModalItem.applicants.join(', ')
                    : '전체 문파원 입찰 가능'}
                </div>
              </div>
            </div>

            <form onSubmit={handleStartAuction} style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              {/* 1. 최소 구매 입찰가 (시작가) */}
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
                  1. 최소 구매 입찰가 (경매 시작 금전)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    className="input-field"
                    min={100}
                    step={100}
                    value={startingBid}
                    onChange={e => setStartingBid(Number(e.target.value))}
                    required
                    style={{ fontSize: '1.05rem', fontWeight: 800, color: '#fbbf24' }}
                  />
                  <span style={{ fontWeight: 800, color: '#94a3b8', whiteSpace: 'nowrap' }}>금전</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[10000, 20000, 30000, 50000].map(preset => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setStartingBid(preset)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: startingBid === preset ? 'rgba(245, 158, 11, 0.25)' : 'rgba(30, 41, 59, 0.8)',
                        color: startingBid === preset ? '#fde047' : '#94a3b8',
                        border: startingBid === preset ? '1px solid #f59e0b' : '1px solid rgba(148,163,184,0.2)'
                      }}
                    >
                      {preset.toLocaleString()} 금전
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. 최소 입찰 호가 단위 */}
              <div>
                <label style={{ display: 'block', fontSize: '0.88rem', fontWeight: 800, color: '#e2e8f0', marginBottom: 6 }}>
                  2. 최소 입찰가를 부르는 단위 (호가 단위)
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <input
                    type="number"
                    className="input-field"
                    min={10}
                    step={10}
                    value={minBidIncrement}
                    onChange={e => setMinBidIncrement(Number(e.target.value))}
                    required
                    style={{ fontSize: '1.05rem', fontWeight: 800, color: '#38bdf8' }}
                  />
                  <span style={{ fontWeight: 800, color: '#94a3b8', whiteSpace: 'nowrap' }}>금전 단위</span>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                  {[100, 500, 1000, 2000, 5000].map(unit => (
                    <button
                      key={unit}
                      type="button"
                      onClick={() => setMinBidIncrement(unit)}
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        cursor: 'pointer',
                        background: minBidIncrement === unit ? 'rgba(56, 189, 248, 0.22)' : 'rgba(30, 41, 59, 0.8)',
                        color: minBidIncrement === unit ? '#38bdf8' : '#94a3b8',
                        border: minBidIncrement === unit ? '1px solid #38bdf8' : '1px solid rgba(148,163,184,0.2)'
                      }}
                    >
                      +{unit.toLocaleString()} 금전
                    </button>
                  ))}
                </div>
              </div>

              {/* 실시간 입찰 규칙 및 30분 타이머 미리보기 박스 */}
              <div
                style={{
                  padding: '0.95rem 1.1rem',
                  borderRadius: 10,
                  background: 'rgba(16, 185, 129, 0.08)',
                  border: '1px solid rgba(16, 185, 129, 0.3)',
                  fontSize: '0.85rem',
                  color: '#cbd5e1',
                  lineHeight: 1.65
                }}
              >
                <div style={{ fontWeight: 800, color: '#34d399', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <CheckCircle2 size={16} /> 경매 규칙 자동 적용 미리보기
                </div>
                • 경매 시작가:{' '}
                <strong style={{ color: '#fde047' }}>{(startingBid || 0).toLocaleString()} 금전</strong>
                <br />• 다음 입찰 가능 금액:{' '}
                <strong style={{ color: '#38bdf8' }}>
                  {((startingBid || 0) + (minBidIncrement || 0)).toLocaleString()} 금전
                </strong>{' '}
                <span style={{ color: '#94a3b8' }}>
                  (최소 호가 단위 +{(minBidIncrement || 0).toLocaleString()} 금전씩 상승)
                </span>
                <br />• 경매 제한 시간:{' '}
                <strong style={{ color: '#fbbf24' }}>⏱️ 30분 타이머 고정</strong> (진행 중 최고 입찰자 익명 보호 / 종료 시 낙찰자 닉네임 공개)
              </div>

              <div style={{ display: 'flex', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setAuctionModalItem(null)}
                  className="btn-secondary"
                  style={{ flex: 1 }}
                >
                  취소
                </button>
                <button
                  type="submit"
                  disabled={creatingAuction}
                  className="btn-primary"
                  style={{ flex: 2, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}
                >
                  <Clock size={18} />
                  {creatingAuction ? '경매 오픈 중...' : '30분 경매 즉시 시작하기'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
