import fs from 'fs';
import path from 'path';
import { User, MemberAttendance, AuctionItem, BidRecord, ShopItem, PurchaseRequest, ContentType, ParticipationType, AuctionDistribution } from './types';

interface DatabaseSchema {
  users: User[];
  members: string[];
  attendance: Record<string, MemberAttendance>;
  auctions: AuctionItem[];
  bids: BidRecord[];
  shopItems: ShopItem[];
  purchases: PurchaseRequest[];
  currentWeek: string;
}

const DEFAULT_MEMBERS = [
  "뱀설", "상두불", "상겨미", "던롤", "로단", "행뚁", "악군학", "승기",
  "휴이랑", "호랑이야", "쬬아", "옥절이", "빠따왕", "추서", "해암", "쓱삭이",
  "꼬다야", "모던블루", "요령서", "믕치", "딱딱똥", "지골몬", "마표", "이병헌",
  "우주여행", "월계", "강원도호랭이", "환이햄", "저급", "쪼로", "서리눈", "아아라",
  "멍식2", "채권", "승환킴", "사찰", "다하네", "탑몬스터", "희옥이", "붕찬",
  "정지태", "가시개미", "소사마귀", "어프로치", "츱", "냥냥쨉", "냥냥킥", "무당청명"
];

function getDbPath(): string {
  // Vercel serverless 환경에서는 /tmp만 쓰기 가능
  if (process.env.VERCEL) {
    return path.join('/tmp', 'oegil_db.json');
  }
  const dir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return path.join(dir, 'db.json');
}

let memoryDbCache: DatabaseSchema | null = null;

function createInitialAttendance(members: string[]): Record<string, MemberAttendance> {
  const att: Record<string, MemberAttendance> = {};
  for (const name of members) {
    att[name] = {
      nickname: name,
      yosin: { type: 'ABSENT', points: 0 },
      gyeolgye: { type: 'ABSENT', points: 0 },
      mihok: { type: 'ABSENT', points: 0 },
      singi: { type: 'ABSENT', points: 0 },
      totalPoints: 0,
      rate: 0,
    };
  }

  // 데모를 위한 현실적인 초기 참여 데이터 몇 개 부여 (요신 수동 1.0 / 결계 분신 0.25 등)
  if (att["뱀설"]) {
    att["뱀설"].yosin = { type: 'MANUAL', points: 1.0 };
    att["뱀설"].gyeolgye = { type: 'MANUAL', points: 1.0 };
    att["뱀설"].mihok = { type: 'MANUAL', points: 1.0 };
    att["뱀설"].singi = { type: 'MANUAL', points: 1.0 };
    att["뱀설"].totalPoints = 4.0;
    att["뱀설"].rate = 100;
  }
  if (att["상두불"]) {
    att["상두불"].yosin = { type: 'MANUAL', points: 1.0 };
    att["상두불"].gyeolgye = { type: 'CLONE', points: 0.25 };
    att["상두불"].mihok = { type: 'MANUAL', points: 1.0 };
    att["상두불"].singi = { type: 'ABSENT', points: 0 };
    att["상두불"].totalPoints = 2.25;
    att["상두불"].rate = 56;
  }
  if (att["해암"]) {
    att["해암"].yosin = { type: 'CLONE', points: 0.25 };
    att["해암"].gyeolgye = { type: 'CLONE', points: 0.25 };
    att["해암"].mihok = { type: 'ABSENT', points: 0 };
    att["해암"].singi = { type: 'ABSENT', points: 0 };
    att["해암"].totalPoints = 0.5;
    att["해암"].rate = 12.5;
  }

  return att;
}

function getInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "usr_admin",
        username: "admin",
        passwordHash: "admin1234", // 기본 관리자 (문파장)
        nickname: "문파장",
        role: "ADMIN",
        status: "APPROVED",
        createdAt: now,
      },
      {
        id: "usr_demo",
        username: "member1",
        passwordHash: "1234",
        nickname: "뱀설",
        role: "MEMBER",
        status: "APPROVED",
        createdAt: now,
      }
    ],
    members: DEFAULT_MEMBERS,
    attendance: createInitialAttendance(DEFAULT_MEMBERS),
    auctions: [
      {
        id: "auc_1",
        title: "🔥 [전설] 신기 쟁탈전 보물 상패 (3만 금전 분배 샘플)",
        description: "문파 컨텐츠 종료 후 획득한 전설 등급 보물입니다. 낙찰 금액(예: 30,000 금전)은 전 문파원의 참여 포인트 비율(수동 1점 / 분신 0.25점)로 차등 분배됩니다.",
        startingBid: 10000,
        minBidIncrement: 1000,
        currentBid: 30000,
        highestBidderNickname: "뱀설",
        highestBidderId: "usr_demo",
        status: "ACTIVE",
        bidsCount: 3,
        endsAt: new Date(Date.now() + 86400000 * 3).toISOString(),
        createdAt: now,
      }
    ],
    bids: [
      {
        id: "bid_1",
        auctionId: "auc_1",
        bidderNickname: "상두불",
        bidderId: "usr_sangdubul",
        amount: 20000,
        createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
      },
      {
        id: "bid_2",
        auctionId: "auc_1",
        bidderNickname: "뱀설",
        bidderId: "usr_demo",
        amount: 30000,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      }
    ],
    shopItems: [
      {
        id: "shop_1",
        name: "✨ 용맹의 문파 비약 (공격력 +15%)",
        description: "1시간 동안 모든 데미지가 15% 증가하는 문파 전용 비약",
        category: "소모품",
        price: 500,
        currency: "문파재화",
        stock: 50,
        icon: "flask-round",
        createdAt: now,
      },
      {
        id: "shop_2",
        name: "🛡️ 결계의 파편 (방어력 +10%)",
        description: "결계지 방어 성공 시 제작 가능한 고급 수호석",
        category: "장비",
        price: 1500,
        currency: "문파재화",
        stock: 20,
        icon: "shield",
        createdAt: now,
      },
      {
        id: "shop_3",
        name: "🎁 문파 보물 상자 (무작위 희귀 획득)",
        description: "금전 및 희귀 강화 재료가 무작위로 등장하는 상자",
        category: "특수",
        price: 3000,
        currency: "금전",
        stock: 10,
        icon: "gift",
        createdAt: now,
      }
    ],
    purchases: [],
    currentWeek: "2026-W45"
  };
}

export function getDb(): DatabaseSchema {
  if (memoryDbCache) return memoryDbCache;
  const filePath = getDbPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      memoryDbCache = JSON.parse(data);
      if (memoryDbCache && memoryDbCache.users) {
        memoryDbCache.users.forEach(u => {
          if (!u.status) u.status = 'APPROVED';
        });
      }
      return memoryDbCache!;
    }
  } catch (err) {
    console.error("Failed to read DB file, using initial DB:", err);
  }
  const initial = getInitialDb();
  saveDb(initial);
  return initial;
}

export function saveDb(db: DatabaseSchema): void {
  memoryDbCache = db;
  const filePath = getDbPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to write DB file:", err);
  }
}

// 참여율 및 총 포인트 재계산 헬퍼
export function recalculateMember(m: MemberAttendance): void {
  const pYosin = m.yosin?.points || 0;
  const pGyeol = m.gyeolgye?.points || 0;
  const pMihok = m.mihok?.points || 0;
  const pSingi = m.singi?.points || 0;
  m.totalPoints = Math.round((pYosin + pGyeol + pMihok + pSingi) * 100) / 100;
  // 주 4회 올 수동 만점(4.0점) 기준 참여율 (%)
  m.rate = Math.min(100, Math.round((m.totalPoints / 4.0) * 100));
}

// 경매 낙찰 금액 기반 포인트 비례 분배 계산기
export function calculateAuctionDistribution(totalGold: number, attendanceRecord: Record<string, MemberAttendance>): AuctionDistribution {
  let totalPoints = 0;
  for (const name in attendanceRecord) {
    totalPoints += attendanceRecord[name].totalPoints || 0;
  }
  totalPoints = Math.round(totalPoints * 100) / 100;

  if (totalPoints <= 0 || totalGold <= 0) {
    return {
      totalGold,
      totalPoints: 0,
      goldPerPoint: 0,
      participants: [],
      leftoverGold: totalGold
    };
  }

  const goldPerPoint = totalGold / totalPoints;
  const participants = [];
  let distributedSum = 0;

  for (const name in attendanceRecord) {
    const pts = attendanceRecord[name].totalPoints || 0;
    if (pts > 0) {
      // 내 분배금 = (내 포인트 / 총 포인트) * 총 금전
      const share = Math.floor(pts * goldPerPoint);
      distributedSum += share;
      participants.push({
        nickname: name,
        points: pts,
        share: share
      });
    }
  }

  // 포인트 높은 순으로 정렬
  participants.sort((a, b) => b.points - a.points);

  const leftoverGold = totalGold - distributedSum;

  return {
    totalGold,
    totalPoints,
    goldPerPoint: Math.round(goldPerPoint * 10) / 10,
    participants,
    leftoverGold
  };
}
