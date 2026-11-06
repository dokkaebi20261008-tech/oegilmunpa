import fs from 'fs';
import path from 'path';
import { User, MemberAttendance, AuctionItem, BidRecord, ShopItem, PurchaseRequest, ContentType, ParticipationType, AuctionDistribution, LadderState } from './types';

interface DatabaseSchema {
  users: User[];
  members: string[];
  attendance: Record<string, MemberAttendance>;
  auctions: AuctionItem[];
  bids: BidRecord[];
  shopItems: ShopItem[];
  purchases: PurchaseRequest[];
  ladderState?: LadderState | null;
  ladderHistory?: LadderState[];
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

function getOfficialShopItems(now: string): ShopItem[] {
  return [
    {
      id: "shop_1",
      name: "전설 도안 선택 상자",
      description: "무기 · 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 주화)",
      category: "무기·방어구·장신구 통합",
      price: 11500,
      currency: "문파주화",
      stock: 10,
      maxStock: 10,
      weeklyLimit: "문파 주간 한정: (0/10)",
      imageUrl: "/images/shop-weapon.png",
      icon: "box",
      applicants: ["뱀설", "상두불", "해암"],
      createdAt: now,
    }
  ];
}

const ADMIN_PASS_SHA256 = "e1963081d94b6ccdfb7fe788ac4fb6fc125519d9807208b927311c4e8d52f26e";

function getInitialDb(): DatabaseSchema {
  const now = new Date().toISOString();
  return {
    users: [
      {
        id: "usr_admin",
        username: "뱀설",
        passwordHash: ADMIN_PASS_SHA256,
        nickname: "뱀설",
        role: "ADMIN",
        status: "APPROVED",
        createdAt: now,
      }
    ],
    members: DEFAULT_MEMBERS,
    attendance: createInitialAttendance(DEFAULT_MEMBERS),
    auctions: [
      {
        id: "auc_1",
        title: "전설 도안 선택 상자",
        description: "무기·방어구·장신구 전설 도안 통합 상자 • 시작가 20,000 금전 / 최소 호가 단위 +500 금전 • 낙찰 금액은 참여 포인트 비례 100% 분배됩니다.",
        imageUrl: "/images/shop-weapon.png",
        startingBid: 20000,
        minBidIncrement: 500,
        currentBid: 20500,
        highestBidderNickname: "뱀설",
        highestBidderId: "usr_admin",
        status: "ACTIVE",
        bidsCount: 2,
        endsAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
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
        bidderId: "usr_admin",
        amount: 20500,
        createdAt: new Date(Date.now() - 1800000).toISOString(),
      }
    ],
    shopItems: getOfficialShopItems(now),
    purchases: [],
    ladderState: null,
    ladderHistory: [],
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
      let migrated = false;
      if (memoryDbCache) {
        if (!Array.isArray(memoryDbCache.users)) {
          memoryDbCache.users = [];
        }
        // 구버전 admin / member1 기본 계정 제거 및 '뱀설' 단독 관리자 계정 적용
        const hadOldDefaults = memoryDbCache.users.some(
          u => u.username === 'admin' || u.username === 'member1'
        );
        if (hadOldDefaults) {
          memoryDbCache.users = memoryDbCache.users.filter(
            u => u.username !== 'admin' && u.username !== 'member1'
          );
          migrated = true;
        }
        const adminAcc = memoryDbCache.users.find(u => u.username === '뱀설');
        if (!adminAcc) {
          memoryDbCache.users.unshift({
            id: "usr_admin",
            username: "뱀설",
            passwordHash: ADMIN_PASS_SHA256,
            nickname: "뱀설",
            role: "ADMIN",
            status: "APPROVED",
            createdAt: new Date().toISOString(),
          });
          migrated = true;
        } else if (
          adminAcc.passwordHash !== ADMIN_PASS_SHA256 ||
          adminAcc.role !== "ADMIN" ||
          adminAcc.status !== "APPROVED" ||
          adminAcc.nickname !== "뱀설"
        ) {
          adminAcc.passwordHash = ADMIN_PASS_SHA256;
          adminAcc.role = "ADMIN";
          adminAcc.status = "APPROVED";
          adminAcc.nickname = "뱀설";
          migrated = true;
        }

        memoryDbCache.users.forEach(u => {
          if (!u.status) {
            u.status = 'APPROVED';
            migrated = true;
          }
        });

        // 상점 상품을 '전설 도안 선택 상자' (무기·방어구·장신구 통합) 1종으로 일원화 마이그레이션
        const isSingleUnified =
          memoryDbCache.shopItems?.length === 1 &&
          memoryDbCache.shopItems[0].name === "전설 도안 선택 상자";
        if (!isSingleUnified) {
          const mergedApplicants = new Set<string>();
          memoryDbCache.shopItems?.forEach(it => {
            it.applicants?.forEach(nick => mergedApplicants.add(nick));
          });
          const unified = getOfficialShopItems(new Date().toISOString());
          if (mergedApplicants.size > 0) {
            unified[0].applicants = Array.from(mergedApplicants);
          }
          memoryDbCache.shopItems = unified;
          migrated = true;
        }

        // 기존 샘플 경매가 있으면 '전설 도안 선택 상자' 및 30분 타이머로 동기화
        const firstAuction = memoryDbCache.auctions?.find(a => a.id === 'auc_1');
        if (firstAuction) {
          if (firstAuction.title !== "전설 도안 선택 상자") {
            firstAuction.title = "전설 도안 선택 상자";
            firstAuction.description = "무기·방어구·장신구 전설 도안 통합 상자 • 시작가 20,000 금전 / 최소 호가 단위 +500 금전 • 낙찰 금액은 참여 포인트 비례 100% 분배됩니다.";
            firstAuction.imageUrl = "/images/shop-weapon.png";
            firstAuction.startingBid = 20000;
            firstAuction.minBidIncrement = 500;
            firstAuction.currentBid = 20500;
            firstAuction.bidsCount = 2;
            migrated = true;
          }
          // 기존 3일짜리 샘플 타이머를 30분 타이머로 교정
          if (
            firstAuction.status === 'ACTIVE' &&
            new Date(firstAuction.endsAt).getTime() - Date.now() > 35 * 60 * 1000
          ) {
            firstAuction.endsAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            migrated = true;
          }
        }

        if (memoryDbCache.ladderState === undefined) {
          memoryDbCache.ladderState = null;
          migrated = true;
        }
        if (!Array.isArray(memoryDbCache.ladderHistory)) {
          memoryDbCache.ladderHistory = [];
          migrated = true;
        }
        if (migrated) {
          saveDb(memoryDbCache);
        }
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

// 30분 경매 타이머가 만료된 진행 중 경매를 자동으로 종료(ENDED) 처리하고 분배금을 정산
export function checkAndFinalizeExpiredAuctions(db: DatabaseSchema): boolean {
  let updated = false;
  const nowMs = Date.now();
  for (const auction of db.auctions) {
    if (auction.status === 'ACTIVE' && auction.endsAt) {
      const endsAtMs = new Date(auction.endsAt).getTime();
      if (!isNaN(endsAtMs) && endsAtMs <= nowMs) {
        auction.status = 'ENDED';
        auction.distribution = calculateAuctionDistribution(auction.currentBid, db.attendance);
        updated = true;
      }
    }
  }
  if (updated) {
    saveDb(db);
  }
  return updated;
}

// 진행 중인 경매에서는 최고 입찰자 닉네임을 익명('익명 입찰자')으로 마스킹하고, 종료 시 실제 낙찰자 닉네임 공개
export function maskAuctionForClient(auction: AuctionItem): AuctionItem {
  if (auction.status === 'ACTIVE') {
    return {
      ...auction,
      highestBidderNickname: auction.bidsCount > 0 ? '익명 입찰자' : undefined,
      highestBidderId: undefined,
    };
  }
  return auction;
}
