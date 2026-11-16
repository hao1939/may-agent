/**
 * middleware.ts — Express middleware for auth
 * 
 * Uses in-memory session store from auth.ts.
 * TODO: Update to use Redis when auth migration is complete.
 */

import { getSession, validateSession } from './auth';

export function authMiddleware(req: any, res: any, next: any) {
  const sessionId = req.headers['x-session-id'] as string;
  
  if (!sessionId) {
    return res.status(401).json({ error: 'No session ID provided' });
  }
  
  if (!validateSession(sessionId)) {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
  
  const session = getSession(sessionId);
  if (!session) {
    return res.status(401).json({ error: 'Session not found' });
  }
  
  req.user = session;
  next();
}

export function requireRole(role: string) {
  return (req: any, res: any, next: any) => {
    if (!req.user || req.user.role !== role) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
