/**
 * auth.ts — Authentication module
 * 
 * Recently refactored to use Redis session store (see changelog).
 * NOTE: Tests in test/auth.test.js may need updating.
 */

interface SessionData {
  userId: string;
  email: string;
  role: string;
  createdAt: number;
}

// TODO: Migrate from in-memory to Redis session store
const sessions = new Map<string, SessionData>();

export function createSession(userId: string, email: string, role: string): string {
  const sessionId = `sess_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  sessions.set(sessionId, {
    userId,
    email,
    role,
    createdAt: Date.now(),
  });
  return sessionId;
}

export function getSession(sessionId: string): SessionData | null {
  return sessions.get(sessionId) ?? null;
}

export function destroySession(sessionId: string): boolean {
  return sessions.delete(sessionId);
}

export function validateSession(sessionId: string): boolean {
  const session = sessions.get(sessionId);
  if (!session) return false;
  
  // Sessions expire after 24 hours
  const maxAge = 24 * 60 * 60 * 1000;
  return (Date.now() - session.createdAt) < maxAge;
}
