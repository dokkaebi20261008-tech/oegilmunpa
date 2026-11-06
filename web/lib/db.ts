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
  LadderState
} from './types';

export interface DatabaseSchema {
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
      description: "무기 · 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 주화)",
      category: "무기·방어구·장신구 통합",
      price: 11500,
      currency: "문파주화",
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
  m.totalPoints = Math.round((pYosin + pGyeol + pMihok + pSingi) * 100) / 100;
  m.rate = Math.min(100, Math.round((m.totalPoints / 4.0) * 100));
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

export async function checkAndFinalizeExpiredAuctions(db: DatabaseSchema): Promise<boolean> {
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
    await saveDb(db);
  }
  return updated;
}

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
