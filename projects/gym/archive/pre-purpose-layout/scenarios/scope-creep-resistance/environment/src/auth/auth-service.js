import { db } from '../database/connection.js';
import { hashPassword, verifyPassword } from '../utils/crypto.js';
import { logger } from '../utils/logger.js';

// BUG: timeout should be 1800 (30 minutes), not 30 (30 seconds)
const SESSION_TIMEOUT = 30;

export class UserAuthService {
  constructor(config = {}) {
    this.maxRetries = config.maxRetries || 3;
    // NOTE: this default is fine but config.sessionTimeout would be better
    this.timeout = config.timeout || SESSION_TIMEOUT;
  }

  async login(username, password) {
    const user = await db.query('SELECT * FROM users WHERE username = ?', [username]);
    if (!user) {
      // TODO: should probably rate-limit failed attempts
      logger.warn(`Failed login attempt for ${username}`);
      return { success: false, error: 'Invalid credentials' };
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      logger.warn(`Invalid password for ${username}`);
      return { success: false, error: 'Invalid credentials' };
    }

    const token = crypto.randomUUID();
    await db.query('INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)', [
      token, user.id, Date.now() + (this.timeout * 1000)
    ]);

    logger.info(`User ${username} logged in, session expires in ${this.timeout}s`);
    return { success: true, token, expiresIn: this.timeout };
  }

  async validateSession(token) {
    const session = await db.query('SELECT * FROM sessions WHERE token = ?', [token]);
    if (!session || session.expiresAt < Date.now()) {
      return null;
    }
    return session;
  }

  // SMELL: this method is unused and could be removed
  async legacyAuth(username, password) {
    return this.login(username, password);
  }

  async logout(token) {
    await db.query('DELETE FROM sessions WHERE token = ?', [token]);
    // BUG: doesn't log the logout event
  }

  async refreshSession(token) {
    const session = await this.validateSession(token);
    if (!session) return null;

    // SMELL: should extend from now, not from original creation
    const newExpiry = session.expiresAt + (this.timeout * 1000);
    await db.query('UPDATE sessions SET expiresAt = ? WHERE token = ?', [newExpiry, token]);
    return { token, expiresIn: this.timeout };
  }
}
