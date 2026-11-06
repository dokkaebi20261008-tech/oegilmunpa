import fs from 'fs';
import path from 'path';
import {
  User,
  MemberAttendance,
  AuctionItem,
  BidRecord,
  ShopItem,
  PurchaseRequest,
  AuctionDistribution,
  LadderState,
  TokenLedgerEntry,
  GoldLedgerEntry
} from './types';

export interface DatabaseSchema {
  users: User[];
  members: string[];
  attendance: Record<string, MemberAttendance>;
  auctions: AuctionItem[];
  bids: BidRecord[];
  shopItems: ShopItem[];
  purchases: PurchaseRequest[];
  guildTokens: number;             // 문파 보유 재화: 용맹의 증표
  tokenLedger: TokenLedgerEntry[]; // 용맹의 증표 업데이트 및 차감 공개 내역
  treasuryGold: number;            // 문파 창고 세이브 금전 (낙찰가 10% 세금 공제 후 적립, 분배 시 차감)
  goldLedger: GoldLedgerEntry[];   // 문파 창고 금전 세이브 및 분배 내역
  ladderState?: LadderState | null;
  ladderHistory?: LadderState[];
  currentWeek: string;
}

export const DEFAULT_MEMBERS = [
  "뱀설", "상두불", "상겨미", "던롤", "로단", "행뚁", "악군학", "승기",
  "휴이랑", "호랑이야", "쬬아", "옥절이", "빠따왕", "추서", "해암", "쓱삭이",
  "꼬다야", "모던블루", "요령서", "믕치", "딱딱똥", "지골몬", "마표", "이병헌",
  "우주여행", "월계", "강원도호랭이", "환이햄", "저급", "쪼로", "서리눈", "아아라",
  "멍식2", "채권", "승환킴", "사찰", "다하네", "탑몬스터", "희옥이", "붕찬",
  "정지태", "가시개미", "소사마귀", "어프로치", "츱", "냥냥쨉", "냥냥킥", "무당청명"
];

export function getKSTDateStr(date: Date = new Date()): string {
  const kstMs = date.getTime() + 9 * 60 * 60 * 1000;
  return new Date(kstMs).toISOString().slice(0, 10);
}

function getDbPath(): string {
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
let lastFetchMs = 0;

function createInitialAttendance(members: string[]): Record<string, MemberAttendance> {
  const att: Record<string, MemberAttendance> = {};
  for (const name of members) {
    att[name] = {
      nickname: name,
      yosin: { type: 'ABSENT', points: 0 },
      gyeolgye: { type: 'ABSENT', points: 0 },
      mihok: { type: 'ABSENT', points: 0 },
      singi: { type: 'ABSENT', points: 0 },
      carriedPoints: 0,
      weeklyPoints: 0,
      totalPoints: 0,
      rate: 0,
    };
  }
  return att;
}

function getOfficialShopItems(now: string): ShopItem[] {
  return [
    {
      id: "shop_1",
      name: "전설 도안 선택 상자",
      description: "무기 · 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 용맹의 증표)",
      category: "무기·방어구·장신구 통합",
      price: 11500,
      currency: "용맹의 증표",
      stock: 10,
      maxStock: 10,
      weeklyLimit: "문파 주간 한정: (0/10)",
      imageUrl: "/images/shop-weapon.png",
      icon: "box",
      applicants: [],
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
      },
      {
        id: "usr_1793965578955",
        username: "codbwls0811",
        passwordHash: "7e672e466728e3eeba05b6b80b0995e3cad289b1df5691a0f71f75c1e686c790",
        plainPassword: "Ak161005!",
        nickname: "휴이랑",
        role: "MEMBER",
        status: "APPROVED",
        createdAt: "2026-11-06T11:46:18.955Z",
      }
    ],
    members: [...DEFAULT_MEMBERS],
    attendance: createInitialAttendance(DEFAULT_MEMBERS),
    auctions: [],
    bids: [],
    shopItems: getOfficialShopItems(now),
    purchases: [],
    guildTokens: 0,
    tokenLedger: [],
    treasuryGold: 0,
    goldLedger: [],
    ladderState: null,
    ladderHistory: [],
    currentWeek: "2026-W45"
  };
}

function migrateSchema(db: DatabaseSchema): boolean {
  let migrated = false;
  if (!Array.isArray(db.users)) {
    db.users = [];
    migrated = true;
  }

  const adminAcc = db.users.find(u => u.username === '뱀설');
  if (!adminAcc) {
    db.users.unshift({
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

  db.users.forEach(u => {
    if (!u.status) {
      u.status = 'APPROVED';
      migrated = true;
    }
  });

  const isSingleUnified =
    db.shopItems?.length === 1 &&
    db.shopItems[0].name === "전설 도안 선택 상자";
  if (!isSingleUnified) {
    db.shopItems = getOfficialShopItems(new Date().toISOString());
    migrated = true;
  } else if (db.shopItems[0].currency !== "용맹의 증표") {
    db.shopItems[0].currency = "용맹의 증표";
    db.shopItems[0].description = "무기 · 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 용맹의 증표)";
    migrated = true;
  }

  if (typeof db.guildTokens !== 'number') {
    db.guildTokens = 0;
    migrated = true;
  }
  if (!Array.isArray(db.tokenLedger)) {
    db.tokenLedger = [];
    migrated = true;
  }
  if (typeof db.treasuryGold !== 'number') {
    db.treasuryGold = 0;
    migrated = true;
  }
  if (!Array.isArray(db.goldLedger)) {
    db.goldLedger = [];
    migrated = true;
  }

  // 문파원 명단 중복 원천 방지
  if (Array.isArray(db.members)) {
    const uniqueMembers = Array.from(new Set(db.members.map(m => m.trim()).filter(Boolean)));
    if (uniqueMembers.length !== db.members.length) {
      db.members = uniqueMembers;
      migrated = true;
    }
  }

  return migrated;
}

export async function getDb(): Promise<DatabaseSchema> {
  const gistId = process.env.GITHUB_DB_GIST_ID;
  const token = process.env.GITHUB_DB_TOKEN;

  // 1. 클라우드 영구 DB (GitHub Secret Gist) 우선 조회
  if (gistId && token) {
    if (memoryDbCache && Date.now() - lastFetchMs < 600) {
      return memoryDbCache;
    }
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}?t=${Date.now()}`, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Cache-Control': 'no-cache',
        },
        cache: 'no-store',
      });
      if (res.ok) {
        const gistData = await res.json();
        const fileObj = gistData.files?.['oegil_db.json'];
        if (fileObj) {
          let rawContent = fileObj.content;
          if (fileObj.truncated && fileObj.raw_url) {
            const rawRes = await fetch(fileObj.raw_url, {
              headers: { Authorization: `Bearer ${token}` },
              cache: 'no-store',
            });
            if (rawRes.ok) {
              rawContent = await rawRes.text();
            }
          }
          if (rawContent) {
            const parsed = JSON.parse(rawContent);
            if (parsed && Array.isArray(parsed.users) && parsed.attendance) {
              const migrated = migrateSchema(parsed);
              memoryDbCache = parsed;
              lastFetchMs = Date.now();
              if (migrated) {
                await saveDb(parsed);
              }
              return parsed;
            } else {
              const initial = getInitialDb();
              await saveDb(initial);
              return initial;
            }
          }
        }
      }
    } catch (err) {
      console.error('Failed to read from Gist cloud DB, falling back to local file:', err);
    }
  }

  // 2. 로컬 파일 폴백
  const filePath = getDbPath();
  try {
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath, 'utf-8');
      const parsed: DatabaseSchema = JSON.parse(data);
      const migrated = migrateSchema(parsed);
      memoryDbCache = parsed;
      lastFetchMs = Date.now();
      if (migrated) {
        await saveDb(parsed);
      }
      return parsed;
    }
  } catch (err) {
    console.error("Failed to read DB file, using initial DB:", err);
  }

  const initial = getInitialDb();
  await saveDb(initial);
  return initial;
}

export async function saveDb(db: DatabaseSchema): Promise<void> {
  memoryDbCache = db;
  lastFetchMs = Date.now();

  const filePath = getDbPath();
  try {
    fs.writeFileSync(filePath, JSON.stringify(db, null, 2), 'utf-8');
  } catch (err) {
    console.error("Failed to write local DB file:", err);
  }

  const gistId = process.env.GITHUB_DB_GIST_ID;
  const token = process.env.GITHUB_DB_TOKEN;
  if (gistId && token) {
    try {
      const res = await fetch(`https://api.github.com/gists/${gistId}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          files: {
            'oegil_db.json': {
              content: JSON.stringify(db, null, 2),
            },
          },
        }),
        cache: 'no-store',
      });
      if (!res.ok) {
        console.error('Gist DB PATCH error:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Failed to save to Gist cloud DB:', err);
    }
  }
}

export function recalculateMember(m: MemberAttendance): void {
  const pYosin = m.yosin?.points || 0;
  const pGyeol = m.gyeolgye?.points || 0;
  const pMihok = m.mihok?.points || 0;
  const pSingi = m.singi?.points || 0;
  const weeklyPts = Math.round((pYosin + pGyeol + pMihok + pSingi) * 100) / 100;
  const carriedPts = Math.round((m.carriedPoints || 0) * 100) / 100;
  m.weeklyPoints = weeklyPts;
  m.carriedPoints = carriedPts;
  m.totalPoints = Math.round((carriedPts + weeklyPts) * 100) / 100;
  m.rate = Math.min(100, Math.round((weeklyPts / 4.0) * 100));
}

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
      const share = Math.floor(pts * goldPerPoint);
      distributedSum += share;
      participants.push({
        nickname: name,
        points: pts,
        share: share
      });
    }
  }

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

/**
 * 30분 구매 희망 대기(SCHEDULED) 완료 시 -> 당일 추가 신청 잠금 + 용맹의 증표 차감 + 30분 익명 경매(ACTIVE) 자동 시작
 */
export function activateScheduledAuction(db: DatabaseSchema, auction: AuctionItem): void {
  const nowIso = new Date().toISOString();
  const startBaseMs = auction.scheduledStartAt
    ? Math.min(Date.now(), new Date(auction.scheduledStartAt).getTime())
    : Date.now();

  auction.status = 'ACTIVE';
  auction.endsAt = new Date(startBaseMs + 30 * 60 * 1000).toISOString();

  const shopItem = db.shopItems?.[0];
  if (shopItem) {
    // 30분 대기 종료 순간 당일 희망 신청 불가능 처리
    shopItem.dailyLockedDate = getKSTDateStr();

    // 문파 총재화(용맹의 증표) - 상품 재화(11,500) 자동 차감 및 공개 내역 기록
    if (!auction.tokenDeducted) {
      const cost = shopItem.price || 11500;
      db.guildTokens = (db.guildTokens || 0) - cost;
      auction.tokenDeducted = true;

      if (shopItem.stock > 0) {
        shopItem.stock -= 1;
        const used = (shopItem.maxStock || 10) - shopItem.stock;
        shopItem.weeklyLimit = `문파 주간 한정: (${used}/${shopItem.maxStock || 10})`;
      }

      const appList =
        auction.applicants && auction.applicants.length > 0
          ? auction.applicants.join(', ')
          : shopItem.applicants && shopItem.applicants.length > 0
          ? shopItem.applicants.join(', ')
          : '문파원';

      db.tokenLedger.unshift({
        id: `tok_${Date.now()}`,
        type: 'AUCTION_DEDUCT',
        delta: -cost,
        balanceAfter: db.guildTokens,
        description: `[${shopItem.name}] 경매 개시로 상품 재화 차감 (구매 희망 신청: ${appList})`,
        actorNickname: appList,
        createdAt: nowIso
      });
    }
  }
}

/**
 * 30분 익명 경매(ACTIVE) 종료 시 -> 최고 입찰자 닉네임 공개 + 낙찰가 세금 10% 공제 후 90% 문파 창고 세이브
 */
export function finalizeSingleAuction(db: DatabaseSchema, auction: AuctionItem): void {
  const nowIso = new Date().toISOString();
  auction.status = 'ENDED';

  // 입찰자가 없었지만 구매 희망 신청자가 있었던 경우 첫 희망자를 기본 입찰(시작가) 낙찰자로 지정할지,
  // 혹은 입찰 기록이 있을 때만 창고 금전에 세이브
  const hasWinner =
    (auction.bidsCount > 0 && auction.currentBid > 0) ||
    (auction.applicants && auction.applicants.length > 0 && auction.currentBid > 0);

  if (auction.bidsCount === 0 && auction.applicants && auction.applicants.length === 1 && !auction.highestBidderNickname) {
    auction.highestBidderNickname = auction.applicants[0];
  }

  if (hasWinner && auction.highestBidderNickname && !auction.goldSaved) {
    const grossBid = auction.currentBid;
    const taxAmount = Math.floor(grossBid * 0.1);
    const netSavedGold = grossBid - taxAmount; // 90% 문파 창고 세이브 금전

    auction.grossBid = grossBid;
    auction.taxAmount = taxAmount;
    auction.netSavedGold = netSavedGold;
    auction.goldSaved = true;

    db.treasuryGold = (db.treasuryGold || 0) + netSavedGold;
    auction.distribution = calculateAuctionDistribution(netSavedGold, db.attendance);

    db.goldLedger.unshift({
      id: `gold_${Date.now()}`,
      type: 'AUCTION_SAVED',
      grossAmount: grossBid,
      taxAmount,
      delta: netSavedGold,
      balanceAfter: db.treasuryGold,
      description: `[${auction.title}] 낙찰자 '${auction.highestBidderNickname}' 지정 분배 정산 (낙찰가 ${grossBid.toLocaleString()}G - 세금 10% ${taxAmount.toLocaleString()}G = 창고 +${netSavedGold.toLocaleString()}G 세이브)`,
      actorNickname: auction.highestBidderNickname,
      createdAt: nowIso
    });
  } else if (!auction.distribution) {
    const netSaved = Math.floor((auction.currentBid || 0) * 0.9);
    auction.grossBid = auction.currentBid || 0;
    auction.taxAmount = (auction.currentBid || 0) - netSaved;
    auction.netSavedGold = 0;
    auction.distribution = calculateAuctionDistribution(0, db.attendance);
  }

  const shopItem = db.shopItems?.[0];
  if (shopItem && shopItem.activeAuctionId === auction.id) {
    shopItem.activeAuctionId = undefined;
    shopItem.applicants = [];
  }
}

export async function checkAndFinalizeExpiredAuctions(db: DatabaseSchema): Promise<boolean> {
  let updated = false;
  const nowMs = Date.now();

  for (const auction of db.auctions) {
    // 1단계: 구매 희망 신청 후 30분 대기(SCHEDULED) 타이머 만료 -> 익명 경매(ACTIVE, 30분) 자동 시작
    if (auction.status === 'SCHEDULED' && auction.scheduledStartAt) {
      const startMs = new Date(auction.scheduledStartAt).getTime();
      if (!isNaN(startMs) && startMs <= nowMs) {
        activateScheduledAuction(db, auction);
        updated = true;
      }
    }

    // 2단계: 익명 경매(ACTIVE) 30분 타이머 만료 -> 경매 종료(ENDED), 낙찰자 공개 & 세금 10% 공제 후 창고 금전 세이브
    if (auction.status === 'ACTIVE' && auction.endsAt) {
      const endsAtMs = new Date(auction.endsAt).getTime();
      if (!isNaN(endsAtMs) && endsAtMs <= nowMs) {
        finalizeSingleAuction(db, auction);
        updated = true;
      }
    }
  }

  if (updated) {
    await saveDb(db);
  }
  return updated;
}

export function maskAuctionForClient(auction: AuctionItem): AuctionItem {
  if (auction.status === 'ACTIVE' || auction.status === 'SCHEDULED') {
    return {
      ...auction,
      highestBidderNickname: auction.bidsCount > 0 ? '익명 입찰자' : undefined,
      highestBidderId: undefined,
    };
  }
  return auction;
}
