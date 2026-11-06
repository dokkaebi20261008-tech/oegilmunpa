export type Role = 'ADMIN' | 'MEMBER';
export type UserStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  plainPassword?: string; // 문파원 분실 시 어드민(문파장)만 열람 가능한 비밀번호
  nickname: string;
  role: Role;
  status: UserStatus;
  createdAt: string;
}

export type ContentType = '요신' | '결계' | '미혹' | '신기';
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
  totalPoints: number;            // 주간 총 포인트 (최대 4.0)
  rate: number;                   // 참여율 (%)
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
  leftoverGold: number; // 잔여 금전 (문파 금고 적립)
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
  status: 'ACTIVE' | 'ENDED' | 'CANCELLED';
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
  currency: '금전' | '문파재화' | '문파주화' | '용맹의증표';
  stock: number;
  maxStock?: number;
  weeklyLimit?: string;
  imageUrl?: string;
  icon: string;
  applicants: string[]; // 이 상품을 희망 신청한 문파원 닉네임 목록
  createdAt: string;
}

export interface LadderRung {
  col: number; // col과 col+1을 연결하는 가로줄 (0 <= col < numCols - 1)
  row: number; // 위에서부터의 단계 (1 <= row <= totalSteps)
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
  startLabels: string[];              // 상단 출발 번호 (예: ["1번 추첨줄", "2번 추첨줄", "3번 추첨줄"])
  bottomItems: LadderItemOption[];    // 하단 배치된 상품 목록
  rungs: LadderRung[];                // 사다리 가로줄 목록
  chosenStartCol: number;             // 선택된 출발 열 (0-based)
  winningBottomCol: number;           // 사다리를 타고 도착한 하단 열 (0-based)
  path: { col: number; row: number }[]; // 사다리 이동 경로 좌표
  winnerItem: LadderItemOption;       // 최종 당첨된 상품
  linkedAuctionId?: string;           // 이 사다리 결과로 생성된 경매 ID (있을 경우)
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
