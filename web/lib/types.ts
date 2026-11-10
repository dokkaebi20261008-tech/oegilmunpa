export type Role = 'ADMIN' | 'SUB_ADMIN' | 'ELITE_MEMBER' | 'MEMBER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: '문주',
  SUB_ADMIN: '부문주',
  ELITE_MEMBER: '열혈 문파원',
  MEMBER: '문파원',
};

export const ROLE_RANK: Record<Role, number> = {
  ADMIN: 100,       // 문주 (어드민 / 최고 권력자)
  SUB_ADMIN: 80,    // 부문주 (사이트 전체 관리 권한 보유, 단 문주 권한 침범 불가)
  ELITE_MEMBER: 20, // 열혈 문파원
  MEMBER: 10,       // 일반 문파원
};

export function isManagerRole(role?: string | null): boolean {
  return role === 'ADMIN' || role === 'SUB_ADMIN';
}

export function getRoleLabel(role?: string | null): string {
  if (!role) return '문파원';
  return ROLE_LABELS[role as Role] || '문파원';
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  plainPassword?: string; // 문파원 분실 시 문주/부문주가 열람 가능한 비밀번호 (문주 비밀번호는 부문주에게 비공개 보호)
  nickname: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export type ContentType = '신기' | '미혹' | '요신' | '결계';
export type ParticipationType = 'MANUAL' | 'CLONE' | 'ABSENT';

export interface ContentParticipation {
  type: ParticipationType;
  points: number; // MANUAL: 1.0, CLONE: 0.25, ABSENT: 0
  updatedAt?: string;
}

export interface MemberAttendance {
  nickname: string;
  yosin: ContentParticipation;     // 요신 토벌령 (수동 1.0 / 분신 0.25)
  gyeolgye: ContentParticipation;  // 결계지 방어 (수동 1.0 / 분신 0.25)
  mihok: ContentParticipation;     // 미혹의 정원 (수동 1.0)
  singi: ContentParticipation;     // 신기 쟁탈전 (수동 1.0)
  carriedPoints?: number;          // 주간 컨텐츠 초기화 시 이월된 누적 점수
  weeklyPoints?: number;           // 이번 주 4대 컨텐츠 점수 (최대 4.0)
  totalPoints: number;             // 총 누적 점수 (carriedPoints + weeklyPoints)
  rate: number;                    // 이번 주 컨텐츠 참여율 (%)
}

export interface AuctionDistributionParticipant {
  nickname: string;
  points: number;
  share: number; // 배분된 금전
}

export interface AuctionDistribution {
  totalGold: number;
  totalPoints: number;
  goldPerPoint: number;
  participants: AuctionDistributionParticipant[];
  leftoverGold: number; // 잔여 금전 (문파 창고 잔류)
}

export interface BidRecord {
  id: string;
  auctionId: string;
  bidderNickname: string;
  bidderId: string;
  amount: number;
  createdAt: string;
}

export interface AuctionItem {
  id: string;
  title: string;
  description: string;
  imageUrl?: string;
  startingBid: number;          // 최소 입찰가 (시작가)
  minBidIncrement: number;      // 최소 입찰 단위 (호가 단위)
  currentBid: number;           // 현재 최고 입찰가
  highestBidderNickname?: string;
  highestBidderId?: string;
  status: 'SCHEDULED' | 'ACTIVE' | 'ENDED' | 'CANCELLED';
  scheduledStartAt?: string;    // 구매 희망 신청 후 10분 뒤 익명 경매 자동 시작 시각
  applicants?: string[];        // 구매 희망 신청 문파원 목록
  grossBid?: number;            // 낙찰 금액 (세전)
  taxAmount?: number;           // 인게임 거래 세금 10%
  netSavedGold?: number;        // 문파 창고 세이브 금전 (세후 90%)
  tokenDeducted?: boolean;      // 용맹의 증표 차감 완료 여부
  goldSaved?: boolean;          // 문파 창고 금전 세이브 완료 여부
  bidsCount: number;
  endsAt: string;
  createdAt: string;
  distribution?: AuctionDistribution; // 낙찰 완료 시 계산된 분배 내역
}

export interface ShopItem {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  currency: '용맹의 증표' | '금전' | '문파재화' | '문파주화' | '용맹의증표';
  stock: number;
  maxStock?: number;
  weeklyLimit?: string;
  imageUrl?: string;
  icon: string;
  applicants: string[];         // 이 상품을 희망 신청한 문파원 닉네임 목록
  minStartBid?: number;         // 어드민 설정 최소 시작 입찰가
  bidStep?: number;             // 어드민 설정 최소 호가 단위
  dailyLockedDate?: string;     // 30분 대기 완료되어 당일 추가 희망 신청 불가 처리된 날짜 (YYYY-MM-DD)
  activeAuctionId?: string;     // 현재 대기 중(SCHEDULED) 또는 진행 중(ACTIVE)인 경매 ID
  createdAt: string;
}

export interface TokenLedgerEntry {
  id: string;
  type: 'ADMIN_UPDATE' | 'AUCTION_DEDUCT';
  delta: number;
  balanceAfter: number;
  description: string;
  actorNickname: string;
  createdAt: string;
}

export interface GoldLedgerEntry {
  id: string;
  type: 'AUCTION_SAVED' | 'DISTRIBUTED' | 'ADMIN_ADJUST';
  grossAmount?: number;
  taxAmount?: number;
  delta: number;
  balanceAfter: number;
  description: string;
  actorNickname: string;
  distribution?: AuctionDistribution;
  createdAt: string;
}

export interface LadderRung {
  col: number;
  row: number;
}

export interface LadderItemOption {
  itemId: string;
  name: string;
  imageUrl: string;
  applicants: string[];
}

export interface LadderState {
  id: string;
  createdAt: string;
  executedBy: string;
  numCols: number;
  totalSteps: number;
  startLabels: string[];
  bottomItems: LadderItemOption[];
  rungs: LadderRung[];
  chosenStartCol: number;
  winningBottomCol: number;
  path: { col: number; row: number }[];
  winnerItem: LadderItemOption;
  linkedAuctionId?: string;
}

export interface PurchaseRequest {
  id: string;
  itemId: string;
  itemName: string;
  buyerNickname: string;
  buyerId: string;
  price: number;
  currency: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
}

export interface WeeklyHistoryMemberRecord {
  nickname: string;
  singi: ContentParticipation;
  mihok: ContentParticipation;
  yosin: ContentParticipation;
  gyeolgye: ContentParticipation;
  weeklyPoints: number;
  carriedPoints: number;
  totalPoints: number;
  rate: number;
}

export interface WeeklyContentHistoryEntry {
  id: string;
  weekLabel: string;        // 예: "2026년 11월 1주차"
  year: number;
  monthNumber: number;      // 1 ~ 12
  weekOfMonth: number;      // 1 ~ 5 (해당 월의 주차)
  createdAt: string;        // 주간 초기화(기록 저장) 시각 ISO
  expiresAt: string;        // 자동 삭제 시각 ISO (다음달 동일 주차 / 약 1개월 후)
  archivedBy: string;       // 초기화를 실행한 관리자 닉네임
  totalMembers: number;
  activeWeeklyCount: number;// 해당 주차에 1개 이상 컨텐츠에 참여한 인원 수
  members: WeeklyHistoryMemberRecord[];
}
