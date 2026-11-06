import { cookies } from 'next/headers';
import { User } from './types';
import { getDb } from './db';

const SESSION_COOKIE = 'oegil_session';

export interface SessionData {
  userId: string;
  nickname: string;
  role: 'ADMIN' | 'MEMBER';
}

export function createSessionToken(user: User): string {
  const payload: SessionData = {
    userId: user.id,
    nickname: user.nickname,
    role: user.role,
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function parseSessionToken(token: string): SessionData | null {
  try {
    const raw = decodeURIComponent(token);
    const json = Buffer.from(raw, 'base64').toString('utf-8');
    return JSON.parse(json);
  } catch (err) {
    return null;
  }
}

export async function getCurrentUser(req?: Request): Promise<SessionData | null> {
  let token: string | undefined;

  if (req) {
    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/oegil_session=([^;]+)/);
      if (match) token = match[1];
    }
  }

  if (!token) {
    try {
      const cookieStore = cookies();
      token = cookieStore.get(SESSION_COOKIE)?.value;
    } catch (e) {
      // ignore
    }
  }

  if (!token) return null;
  const session = parseSessionToken(token);
  if (!session) return null;
  
  // DB에서 유효성 재확인
  const db = getDb();
  const user = db.users.find(u => u.id === session.userId);
  if (!user) return null;

  return {
    userId: user.id,
    nickname: user.nickname,
    role: user.role,
  };
}
