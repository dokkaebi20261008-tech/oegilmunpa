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
  GoldLedgerEntry,
  WeeklyContentHistoryEntry,
  WeeklyHistoryMemberRecord
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
  weeklyHistory?: WeeklyContentHistoryEntry[]; // 주간 컨텐츠 초기화 시 저장되는 주차별 참여·분신 기록 (1개월 보관 후 자동 삭제)
  ladderState?: LadderState | null;
  ladderHistory?: LadderState[];
  currentWeek: string;
}

export interface WednesdayScheduleInfo {
  nowKSTFormatted: string;
  dayOfWeekKST: number;       // 0(일) ~ 3(수) ~ 6(토)
  isShopOpen: boolean;        // 매주 수요일 19:00:00 <= KST <= 23:59:59
  isAuctionWindow: boolean;   // 매주 수요일 19:00:00 <= KST <= 23:59:59 (목요일 00:00:00 자동 클로즈)
  cycleDateStr: string;       // 이번(또는 다음) 수요일 YYYY-MM-DD (KST)
  shopOpenAtISO: string;      // 수요일 19:00:00 KST (UTC ISO)
  auctionStartAtISO: string;  // 수요일 19:10:00 KST (UTC ISO)
  auctionEndAtISO: string;    // 목요일 00:00:00 KST (수요일 23:59:59 마감, UTC ISO)
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

/**
 * 한국 시간(KST) 기준 매주 수요일 상점 구매 희망 & 경매 오픈(19:00:00~23:59:59) 및 목요일 00:00:00 자동 클로즈 스케줄 계산
 */
export function getKSTWednesdaySchedule(nowMs: number = Date.now()): WednesdayScheduleInfo {
  const kstOffsetMs = 9 * 60 * 60 * 1000;
  const kstNow = new Date(nowMs + kstOffsetMs);

  const year = kstNow.getUTCFullYear();
  const month = kstNow.getUTCMonth();
  const date = kstNow.getUTCDate();
  const day = kstNow.getUTCDay(); // 0=일, 1=월, 2=화, 3=수, 4=목, 5=금, 6=토
  const hour = kstNow.getUTCHours();
  const minute = kstNow.getUTCMinutes();
  const second = kstNow.getUTCSeconds();

  const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
  const nowKSTFormatted = `${year}-${String(month + 1).padStart(2, '0')}-${String(date).padStart(2, '0')} (${dayNames[day]}) ${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}`;

  // 매주 수요일 오후 7시(19:00:00) ~ 오후 11시 59분 59초(23:59:59) 상점 구매 희망 및 경매 오픈 (목요일 00:00:00 자동 클로즈)
  const isShopOpen = day === 3 && hour >= 19 && hour <= 23;
  const isAuctionWindow = day === 3 && hour >= 19 && hour <= 23;

  let daysUntilWed = 0;
  if (day === 3) {
    daysUntilWed = 0;
  } else {
    daysUntilWed = (3 - day + 7) % 7;
  }

  const targetWedUTC = new Date(Date.UTC(year, month, date + daysUntilWed, 0, 0, 0));
  const wy = targetWedUTC.getUTCFullYear();
  const wm = targetWedUTC.getUTCMonth();
  const wd = targetWedUTC.getUTCDate();

  const cycleDateStr = `${wy}-${String(wm + 1).padStart(2, '0')}-${String(wd).padStart(2, '0')}`;
  // KST 19:00:00 = UTC 10:00:00, KST 24:00:00(목요일 00:00:00) = UTC 15:00:00
  const shopOpenAtISO = new Date(Date.UTC(wy, wm, wd, 10, 0, 0)).toISOString();
  const auctionStartAtISO = new Date(Date.UTC(wy, wm, wd, 10, 10, 0)).toISOString();
  const auctionEndAtISO = new Date(Date.UTC(wy, wm, wd, 15, 0, 0)).toISOString();

  return {
    nowKSTFormatted,
    dayOfWeekKST: day,
    isShopOpen,
    isAuctionWindow,
    cycleDateStr,
    shopOpenAtISO,
    auctionStartAtISO,
    auctionEndAtISO
  };
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
      description: "무기 및 산군 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 용맹의 증표)",
      category: "무기 및 산군 방어구·장신구 통합",
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
    weeklyHistory: [],
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
  } else {
    if (db.shopItems[0].currency !== "용맹의 증표") {
      db.shopItems[0].currency = "용맹의 증표";
      db.shopItems[0].description = "무기 및 산군 방어구 · 장신구 모든 전설 도안 장비 통합 선택 상자 (11,500 용맹의 증표)";
      migrated = true;
    }
    if (db.shopItems[0].imageUrl !== "/images/shop-weapon.png") {
      db.shopItems[0].imageUrl = "/images/shop-weapon.png";
      migrated = true;
    }
  }

  if (Array.isArray(db.auctions)) {
    db.auctions.forEach(a => {
      if (a.imageUrl !== "/images/shop-weapon.png") {
        a.imageUrl = "/images/shop-weapon.png";
        migrated = true;
      }
    });
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
  if (!Array.isArray(db.weeklyHistory)) {
    db.weeklyHistory = [];
    migrated = true;
  }

  // 문파원 명단 중복 원천 방지 및 항상 가나다순 자동 정렬
  if (Array.isArray(db.members)) {
    const uniqueMembers = Array.from(new Set(db.members.map(m => m.trim()).filter(Boolean)));
    const sortedMembers = [...uniqueMembers].sort((a, b) => a.localeCompare(b, 'ko'));
    const isDifferent =
      uniqueMembers.length !== db.members.length ||
      sortedMembers.some((m, idx) => m !== db.members[idx]);
    if (isDifferent) {
      db.members = sortedMembers;
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
 * 구매 희망 신청 후 10분 대기 시간 도달 시 -> 용맹의 증표 차감 + 30분 익명 경매(ACTIVE) 자동 시작
 */
export function activateScheduledAuction(db: DatabaseSchema, auction: AuctionItem, isManualNow: boolean = false): void {
  const nowMs = Date.now();
  const nowIso = new Date(nowMs).toISOString();
  const scheduledStartMs = auction.scheduledStartAt ? new Date(auction.scheduledStartAt).getTime() : nowMs;
  const baseStartMs = isManualNow ? nowMs : (scheduledStartMs <= nowMs ? scheduledStartMs : nowMs);

  auction.status = 'ACTIVE';
  const rawEndMs = (isManualNow ? nowMs : Math.max(baseStartMs, nowMs - 60 * 1000)) + 30 * 60 * 1000;
  // 진행 중인 경매는 자정(00:00:00)이 지나더라도 원래의 30분 진행 마감 시간을 끝까지 보장
  auction.endsAt = new Date(rawEndMs).toISOString();

  const shopItem = db.shopItems?.find(i => i.activeAuctionId === auction.id) || db.shopItems?.[0];
  const minBid = auction.startingBid || shopItem?.minStartBid || 20000;
  auction.startingBid = minBid;
  if (auction.bidsCount === 0) {
    auction.currentBid = minBid;
    auction.highestBidderNickname = undefined;
    auction.highestBidderId = undefined;
  }

  // 구매 희망 신청자 명단 동기화 (선착순 신청 순번 그대로 보존)
  const orderedApplicants =
    auction.applicants && auction.applicants.length > 0
      ? [...auction.applicants]
      : shopItem?.applicants && shopItem.applicants.length > 0
      ? [...shopItem.applicants]
      : [];
  auction.applicants = orderedApplicants;

  if (shopItem) {
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
        orderedApplicants.length > 0
          ? orderedApplicants.map((n, idx) => `${idx + 1}번 ${n}`).join(', ')
          : '문파원';

      db.tokenLedger.unshift({
        id: `tok_${nowMs}`,
        type: 'AUCTION_DEDUCT',
        delta: -cost,
        balanceAfter: db.guildTokens,
        description: `[${shopItem.name}] 경매 개시로 상품 재화 차감 (희망 순번: ${appList})`,
        actorNickname: orderedApplicants[0] || '문파원',
        createdAt: nowIso
      });
    }
  }
}

/**
 * 30분 익명 경매(ACTIVE) 종료 시 -> 최고 입찰자 닉네임 및 최종 낙찰금액 안내 + 세금 10% 공제 금액(90%) 문파 창고 세이브 기록 + 구매 희망 재신청 가능 상태로 초기화
 */
export function finalizeSingleAuction(db: DatabaseSchema, auction: AuctionItem): void {
  const nowIso = new Date().toISOString();
  auction.status = 'ENDED';

  const hasWinner = auction.bidsCount > 0 && auction.currentBid > 0 && Boolean(auction.highestBidderNickname);

  if (hasWinner && auction.highestBidderNickname && !auction.goldSaved) {
    const grossBid = auction.currentBid; // 인게임 지정 분배 시 입력할 최종 낙찰 금액 (원금)
    const taxAmount = Math.floor(grossBid * 0.1); // 인게임 세금 10%
    const netSavedGold = grossBid - taxAmount; // 세금 10% 공제 후 문파 창고 세이브 금전 (90%)

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
      description: `[${auction.title}] 낙찰자 '${auction.highestBidderNickname}' | 최종 낙찰금액(인게임 지정 분배 입력금): ${grossBid.toLocaleString()} 금전 | 세금 10%(-${taxAmount.toLocaleString()}G) 공제 후 문파 창고 세이브: +${netSavedGold.toLocaleString()} 금전`,
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

  // 경매 종료 즉시 다시 구매 희망 신청을 받을 수 있도록 상점 아이템 상태 초기화
  const shopItem = db.shopItems?.find(i => i.activeAuctionId === auction.id) || db.shopItems?.[0];
  if (shopItem) {
    shopItem.activeAuctionId = undefined;
    shopItem.applicants = [];
    shopItem.dailyLockedDate = undefined;
  }
}

/**
 * 주차별 컨텐츠 참여 기록 1개월 보관 및 자동 삭제 (예: 1주차 기록은 다음달 1주차 도달 시 또는 28일 경과 시 자동 영구 삭제)
 */
export function pruneExpiredWeeklyHistory(db: DatabaseSchema, nowMs: number = Date.now()): boolean {
  if (!Array.isArray(db.weeklyHistory)) {
    db.weeklyHistory = [];
    return false;
  }
  if (db.weeklyHistory.length === 0) return false;

  const kstDate = new Date(nowMs + 9 * 60 * 60 * 1000);
  const curYear = kstDate.getUTCFullYear();
  const curMonth = kstDate.getUTCMonth() + 1;
  const curDay = kstDate.getUTCDate();
  const curWeekOfMonth = Math.ceil(curDay / 7);

  const beforeLen = db.weeklyHistory.length;
  db.weeklyHistory = db.weeklyHistory.filter(entry => {
    const expMs = new Date(entry.expiresAt).getTime();
    if (!isNaN(expMs) && expMs <= nowMs) {
      return false;
    }
    const entryYear = entry.year || new Date(entry.createdAt).getUTCFullYear();
    const isNextMonthOrLater =
      curYear > entryYear || (curYear === entryYear && curMonth > entry.monthNumber);
    // 이전 달의 기록 중 현재 월의 동일 주차 이상에 도달한 기록은 자동 삭제 (예: 11월 1주차 기록 -> 12월 1주차 도달 시 자동 삭제)
    if (isNextMonthOrLater && curWeekOfMonth >= entry.weekOfMonth) {
      return false;
    }
    return true;
  });

  // 최대 4주(약 1개월) 분량만 유지
  if (db.weeklyHistory.length > 4) {
    db.weeklyHistory = db.weeklyHistory.slice(0, 4);
  }

  return db.weeklyHistory.length !== beforeLen;
}

/**
 * 주간 컨텐츠 초기화 직전 현재 주차의 4대 컨텐츠 참여(수동/분신/미참) 내역을 스냅샷으로 저장
 */
export function archiveWeeklyContentHistory(
  db: DatabaseSchema,
  actorNickname: string = '관리자',
  customWeekLabel?: string,
  nowMs: number = Date.now()
): WeeklyContentHistoryEntry | null {
  pruneExpiredWeeklyHistory(db, nowMs);

  const kstDate = new Date(nowMs + 9 * 60 * 60 * 1000);
  const year = kstDate.getUTCFullYear();
  const monthNumber = kstDate.getUTCMonth() + 1;
  const dayOfMonth = kstDate.getUTCDate();
  const weekOfMonth = Math.ceil(dayOfMonth / 7);

  const weekLabel = (customWeekLabel || '').trim() || `${year}년 ${monthNumber}월 ${weekOfMonth}주차`;
  const createdAt = new Date(nowMs).toISOString();
  // 다음달 동일 주차(28일 = 4주 후) 자동 만료
  const expiresAt = new Date(nowMs + 28 * 24 * 60 * 60 * 1000).toISOString();

  const sortedNames = [...(db.members || Object.keys(db.attendance || {}))].sort((a, b) =>
    a.localeCompare(b, 'ko')
  );

  const memberSnapshots: WeeklyHistoryMemberRecord[] = [];
  let activeWeeklyCount = 0;

  for (const name of sortedNames) {
    const m = db.attendance[name];
    if (!m) continue;
    recalculateMember(m);
    const hasParticipated =
      m.singi?.type !== 'ABSENT' ||
      m.mihok?.type !== 'ABSENT' ||
      m.yosin?.type !== 'ABSENT' ||
      m.gyeolgye?.type !== 'ABSENT';
    if (hasParticipated) {
      activeWeeklyCount += 1;
    }

    memberSnapshots.push({
      nickname: m.nickname,
      singi: { ...(m.singi || { type: 'ABSENT', points: 0 }) },
      mihok: { ...(m.mihok || { type: 'ABSENT', points: 0 }) },
      yosin: { ...(m.yosin || { type: 'ABSENT', points: 0 }) },
      gyeolgye: { ...(m.gyeolgye || { type: 'ABSENT', points: 0 }) },
      weeklyPoints: m.weeklyPoints || 0,
      carriedPoints: m.carriedPoints || 0,
      totalPoints: m.totalPoints || 0,
      rate: m.rate || 0,
    });
  }

  if (!Array.isArray(db.weeklyHistory)) {
    db.weeklyHistory = [];
  }

  // 이미 동일 주차(weekLabel)에 유효한 참여 기록이 저장되어 있는데 실수로 연속 초기화(0명 참여)를 누른 경우 기존 기록 보존
  const existingSameWeekIdx = db.weeklyHistory.findIndex(h => h.weekLabel === weekLabel);
  if (existingSameWeekIdx !== -1 && activeWeeklyCount === 0 && db.weeklyHistory[existingSameWeekIdx].activeWeeklyCount > 0) {
    return db.weeklyHistory[existingSameWeekIdx];
  }

  const newEntry: WeeklyContentHistoryEntry = {
    id: `wh_${nowMs}`,
    weekLabel,
    year,
    monthNumber,
    weekOfMonth,
    createdAt,
    expiresAt,
    archivedBy: actorNickname,
    totalMembers: memberSnapshots.length,
    activeWeeklyCount,
    members: memberSnapshots,
  };

  if (existingSameWeekIdx !== -1) {
    db.weeklyHistory[existingSameWeekIdx] = newEntry;
  } else {
    db.weeklyHistory.unshift(newEntry);
  }

  // 이전 달의 동일 주차 기록 즉시 자동 정리 및 최대 4주 유지
  db.weeklyHistory = db.weeklyHistory.filter((entry, idx) => {
    if (idx === 0 || entry.id === newEntry.id) return true;
    const isOlderMonth =
      year > entry.year || (year === entry.year && monthNumber > entry.monthNumber);
    if (isOlderMonth && entry.weekOfMonth <= weekOfMonth) {
      return false;
    }
    return true;
  });

  if (db.weeklyHistory.length > 4) {
    db.weeklyHistory = db.weeklyHistory.slice(0, 4);
  }

  return newEntry;
}

export async function checkAndFinalizeExpiredAuctions(db: DatabaseSchema): Promise<boolean> {
  let updated = pruneExpiredWeeklyHistory(db);
  const nowMs = Date.now();
  const wedSched = getKSTWednesdaySchedule(nowMs);

  for (let i = db.auctions.length - 1; i >= 0; i--) {
    const auction = db.auctions[i];

    // 1단계: 대기 중(SCHEDULED) 경매 처리 (이미 수요일 마감 전 희망 신청된 상품은 00:00:00 이후라도 예정된 10분 대기 후 30분 경매를 정상 진행)
    if (auction.status === 'SCHEDULED') {
      if (auction.scheduledStartAt) {
        const startMs = new Date(auction.scheduledStartAt).getTime();
        if (!isNaN(startMs) && startMs <= nowMs) {
          const shopItem = db.shopItems?.[0];
          const applicantsCount = (auction.applicants?.length || 0) + (shopItem?.applicants?.length || 0);
          if (applicantsCount > 0) {
            activateScheduledAuction(db, auction, false);
          } else {
            // 희망 신청자가 0명이면 대기 경매 자동 제거
            db.auctions.splice(i, 1);
          }
          updated = true;
        }
      }
    }

    // 2단계: 익명 경매(ACTIVE) 종료 시각 도달 (진행 마감 시간 30분 경과 시) -> 경매 종료(ENDED) 처리
    if (auction.status === 'ACTIVE' && auction.endsAt) {
      const endsAtMs = new Date(auction.endsAt).getTime();
      if (!isNaN(endsAtMs) && endsAtMs <= nowMs) {
        finalizeSingleAuction(db, auction);
        updated = true;
      }
    }
  }

  // 수요일 오픈 시간(19:00:00 ~ 23:59:59)이 아닐 때 남아있는 미진행 구매 희망 신청자 명단 자동 클로즈
  if (!wedSched.isShopOpen && Array.isArray(db.shopItems)) {
    for (const item of db.shopItems) {
      const hasLiveAuc = db.auctions.some(
        a => (a.status === 'ACTIVE' || a.status === 'SCHEDULED') && a.id === item.activeAuctionId
      );
      if (!hasLiveAuc && ((item.applicants && item.applicants.length > 0) || item.dailyLockedDate)) {
        item.applicants = [];
        item.activeAuctionId = undefined;
        item.dailyLockedDate = undefined;
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

/**
 * 문파원 닉네임 일괄 변경 (members, attendance, users, shopItems, auctions, bids, ledgers 등 전역 일괄 동기화)
 */
export function renameMember(
  db: DatabaseSchema,
  oldNickname: string,
  newNickname: string
): { success: boolean; message: string } {
  const oldName = String(oldNickname || '').trim();
  const newName = String(newNickname || '').trim();

  if (!oldName) {
    return { success: false, message: '기존 문파원 닉네임을 입력해주세요.' };
  }
  if (!newName) {
    return { success: false, message: '변경할 새로운 닉네임을 입력해주세요.' };
  }
  if (oldName === newName) {
    return { success: false, message: '기존 닉네임과 새 닉네임이 동일합니다.' };
  }
  if (oldName === '뱀설') {
    return { success: false, message: '⛔ 최고 권력자인 [문주(뱀설)] 캐릭터 닉네임은 변경할 수 없습니다.' };
  }

  // 중복 닉네임 검사
  const isMemberExists = (db.members || []).some(m => m.toLowerCase() === newName.toLowerCase());
  const isUserExists = (db.users || []).some(u => u.nickname.toLowerCase() === newName.toLowerCase());
  if (isMemberExists || isUserExists) {
    return { success: false, message: `이미 문파에 존재하는 닉네임입니다: [${newName}]` };
  }

  // 1. members 배열 내 닉네임 교체 및 항상 가나다순 재정렬
  if (Array.isArray(db.members)) {
    const idx = db.members.indexOf(oldName);
    if (idx !== -1) {
      db.members[idx] = newName;
    } else {
      db.members.push(newName);
    }
    db.members.sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // 2. attendance 출석부 키 및 내부 nickname 교체
  if (db.attendance) {
    if (db.attendance[oldName]) {
      const record = db.attendance[oldName];
      delete db.attendance[oldName];
      record.nickname = newName;
      db.attendance[newName] = record;
    } else {
      db.attendance[newName] = {
        nickname: newName,
        yosin: { type: 'ABSENT', points: 0 },
        gyeolgye: { type: 'ABSENT', points: 0 },
        mihok: { type: 'ABSENT', points: 0 },
        singi: { type: 'ABSENT', points: 0 },
        carriedPoints: 0,
        weeklyPoints: 0,
        totalPoints: 0,
        rate: 0
      };
    }
  }

  // 3. users 계정 정보 내 nickname 동기화
  if (Array.isArray(db.users)) {
    db.users.forEach(u => {
      if (u.nickname === oldName) {
        u.nickname = newName;
      }
    });
  }

  // 4. shopItems 희망 신청자 명단 교체
  if (Array.isArray(db.shopItems)) {
    db.shopItems.forEach(item => {
      if (Array.isArray(item.applicants)) {
        item.applicants = item.applicants.map(app => (app === oldName ? newName : app));
      }
    });
  }

  // 5. auctions 경매 최고 입찰자 및 신청자 명단 교체
  if (Array.isArray(db.auctions)) {
    db.auctions.forEach(a => {
      if (a.highestBidderNickname === oldName) {
        a.highestBidderNickname = newName;
      }
      if (Array.isArray(a.applicants)) {
        a.applicants = a.applicants.map(app => (app === oldName ? newName : app));
      }
      if (a.distribution && Array.isArray(a.distribution.participants)) {
        a.distribution.participants.forEach(p => {
          if (p.nickname === oldName) p.nickname = newName;
        });
      }
    });
  }

  // 6. bids 입찰 기록 닉네임 교체
  if (Array.isArray(db.bids)) {
    db.bids.forEach(b => {
      if (b.bidderNickname === oldName) {
        b.bidderNickname = newName;
      }
    });
  }

  // 7. purchases 구매 기록 닉네임 교체
  if (Array.isArray(db.purchases)) {
    db.purchases.forEach(p => {
      if (p.buyerNickname === oldName) {
        p.buyerNickname = newName;
      }
    });
  }

  // 8. tokenLedger & goldLedger 장부 내역 교체
  if (Array.isArray(db.tokenLedger)) {
    db.tokenLedger.forEach(t => {
      if (t.actorNickname === oldName) t.actorNickname = newName;
    });
  }
  if (Array.isArray(db.goldLedger)) {
    db.goldLedger.forEach(g => {
      if (g.actorNickname === oldName) g.actorNickname = newName;
      if (g.distribution && Array.isArray(g.distribution.participants)) {
        g.distribution.participants.forEach(p => {
          if (p.nickname === oldName) p.nickname = newName;
        });
      }
    });
  }
  if (Array.isArray(db.weeklyHistory)) {
    db.weeklyHistory.forEach(w => {
      if (w.archivedBy === oldName) w.archivedBy = newName;
      if (Array.isArray(w.members)) {
        w.members.forEach(m => {
          if (m.nickname === oldName) m.nickname = newName;
        });
        w.members.sort((a, b) => a.nickname.localeCompare(b.nickname, 'ko'));
      }
    });
  }

  return {
    success: true,
    message: `문파원 닉네임이 [${oldName}] ➔ [${newName}](으)로 성공적으로 변경되었습니다.`
  };
}

/**
 * 문파원 추방 및 삭제 (members, attendance, users 계정, shop/auction 신청자 목록 등 전역 일괄 제거)
 */
export function removeMember(
  db: DatabaseSchema,
  target: { nickname?: string; userId?: string }
): { success: boolean; message: string; removedNickname?: string } {
  let targetNick = String(target.nickname || '').trim();
  const userId = target.userId;

  let userObj = userId ? (db.users || []).find(u => u.id === userId) : undefined;
  if (!targetNick && userObj) {
    targetNick = userObj.nickname;
  }
  if (!userObj && targetNick) {
    userObj = (db.users || []).find(u => u.nickname === targetNick);
  }

  if (!targetNick && !userId) {
    return { success: false, message: '추방/삭제할 문파원 닉네임 또는 유저 ID를 지정해주세요.' };
  }

  // 최고 권력자인 문주(뱀설) 계정은 추방 불가
  if (targetNick === '뱀설' || userObj?.username === '뱀설' || userObj?.role === 'ADMIN') {
    return { success: false, message: '⛔ 최고 권력자인 [문주(뱀설)]는 추방 또는 삭제할 수 없습니다.' };
  }

  // 1. users 테이블에서 계정 삭제
  if (Array.isArray(db.users)) {
    if (userId) {
      db.users = db.users.filter(u => u.id !== userId);
    } else if (targetNick) {
      db.users = db.users.filter(u => u.nickname !== targetNick);
    }
  }

  // 2. members 목록에서 제외 및 항상 가나다순 유지
  if (targetNick && Array.isArray(db.members)) {
    db.members = db.members.filter(m => m !== targetNick);
    db.members.sort((a, b) => a.localeCompare(b, 'ko'));
  }

  // 3. attendance 출석부에서 제외
  if (targetNick && db.attendance) {
    delete db.attendance[targetNick];
  }

  // 4. shopItems 희망 신청자 명단에서 제외
  if (targetNick && Array.isArray(db.shopItems)) {
    db.shopItems.forEach(item => {
      if (Array.isArray(item.applicants)) {
        item.applicants = item.applicants.filter(app => app !== targetNick);
      }
    });
  }

  // 5. auctions 경매 신청자 명단에서 제외
  if (targetNick && Array.isArray(db.auctions)) {
    db.auctions.forEach(a => {
      if (Array.isArray(a.applicants)) {
        a.applicants = a.applicants.filter(app => app !== targetNick);
      }
    });
  }

  // 6. weeklyHistory 주차별 기록에서도 추방 인원 제외
  if (targetNick && Array.isArray(db.weeklyHistory)) {
    db.weeklyHistory.forEach(w => {
      if (Array.isArray(w.members)) {
        w.members = w.members.filter(m => m.nickname !== targetNick);
        w.totalMembers = w.members.length;
      }
    });
  }

  return {
    success: true,
    message: `'${targetNick || '해당'}' 문파원이 추방(계정 삭제)되었으며 문파 명단에서도 완전히 제외되었습니다.`,
    removedNickname: targetNick
  };
}
