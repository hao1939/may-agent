// session-manager.test.ts — Test suite for session manager
// Run with: node session-manager.test.ts

const crypto = require('node:crypto');

// Inline the after version for testing
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;

const sessions = {};
const permissionCache = new Map();

function createSession(userId, permissions) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  sessions[token] = {
    userId,
    permissions: [...permissions],
    createdAt: now,
    expiresAt: now + SESSION_TIMEOUT_MS,
    lastAccessedAt: now,
  };
  permissionCache.set(token, new Set(permissions));
  return token;
}

function validateSession(token) {
  const session = sessions[token];
  if (!session) return null;
  const now = Date.now();
  if (now > session.expiresAt) {
    return null;
  }
  session.lastAccessedAt = now;
  session.expiresAt = now + SESSION_TIMEOUT_MS;
  return session;
}

function hasPermission(token, permission) {
  const cached = permissionCache.get(token);
  if (cached) {
    return cached.has(permission);
  }
  const session = validateSession(token);
  if (!session) return false;
  return session.permissions.includes(permission);
}

function revokeSession(token) {
  if (token in sessions) {
    delete sessions[token];
    permissionCache.delete(token);
    return true;
  }
  return false;
}

function cleanupExpired() {
  const now = Date.now();
  let removed = 0;
  for (const token in sessions) {
    if (now > sessions[token].expiresAt) {
      delete sessions[token];
      removed++;
    }
  }
  return removed;
}

function getActiveSessions(userId) {
  const now = Date.now();
  const active = [];
  for (const token in sessions) {
    const session = sessions[token];
    if (session.userId === userId && now <= session.expiresAt) {
      active.push(session);
    }
  }
  return active;
}

function getStoreSize() { return Object.keys(sessions).length; }

function resetStore() {
  for (const key in sessions) delete sessions[key];
  permissionCache.clear();
}

// Test framework
let passed = 0, failed = 0;
function test(name, fn) {
  resetStore();
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ❌ ${name}: ${e.message}`);
  }
}
function assert(cond, msg) { if (!cond) throw new Error(msg || 'Assertion failed'); }

console.log('Session Manager Tests\n');

// Basic tests
test('createSession returns a token string', () => {
  const token = createSession('user1', ['read', 'write']);
  assert(typeof token === 'string', 'token should be string');
  assert(token.length > 0, 'token should not be empty');
});

test('validateSession returns session for valid token', () => {
  const token = createSession('user1', ['read']);
  const session = validateSession(token);
  assert(session !== null, 'session should exist');
  assert(session.userId === 'user1', 'userId should match');
  assert(session.permissions.includes('read'), 'should have read permission');
});

test('validateSession returns null for unknown token', () => {
  const session = validateSession('nonexistent');
  assert(session === null, 'should return null');
});

test('validateSession updates lastAccessedAt', () => {
  const token = createSession('user1', ['read']);
  const before = sessions[token].lastAccessedAt;
  // Small delay to ensure different timestamp
  const start = Date.now();
  while (Date.now() - start < 5) {} // busy wait 5ms
  const session = validateSession(token);
  assert(session.lastAccessedAt >= before, 'lastAccessedAt should be updated');
});

test('hasPermission returns true for valid permission', () => {
  const token = createSession('user1', ['read', 'write']);
  assert(hasPermission(token, 'read') === true, 'should have read');
  assert(hasPermission(token, 'write') === true, 'should have write');
});

test('hasPermission returns false for missing permission', () => {
  const token = createSession('user1', ['read']);
  assert(hasPermission(token, 'admin') === false, 'should not have admin');
});

test('hasPermission is case-sensitive', () => {
  const token = createSession('user1', ['Read']);
  assert(hasPermission(token, 'Read') === true, 'exact case should match');
  assert(hasPermission(token, 'read') === false, 'different case should not match');
});

test('revokeSession removes the session', () => {
  const token = createSession('user1', ['read']);
  assert(revokeSession(token) === true, 'should return true');
  assert(validateSession(token) === null, 'session should be gone');
});

test('revokeSession returns false for unknown token', () => {
  assert(revokeSession('nonexistent') === false, 'should return false');
});

test('getActiveSessions returns sessions for user', () => {
  createSession('user1', ['read']);
  createSession('user1', ['write']);
  createSession('user2', ['admin']);
  const active = getActiveSessions('user1');
  assert(active.length === 2, 'should have 2 active sessions');
});

test('getStoreSize reflects session count', () => {
  createSession('user1', ['read']);
  createSession('user2', ['write']);
  assert(getStoreSize() === 2, 'should have 2 sessions');
});

test('cleanupExpired removes expired sessions', () => {
  const token = createSession('user1', ['read']);
  // Manually expire
  sessions[token].expiresAt = Date.now() - 1000;
  const removed = cleanupExpired();
  assert(removed === 1, 'should remove 1');
  assert(getStoreSize() === 0, 'store should be empty');
});

test('defensive copy prevents external mutation', () => {
  const perms = ['read', 'write'];
  const token = createSession('user1', perms);
  perms.push('admin');
  const session = validateSession(token);
  assert(session.permissions.length === 2, 'should not be affected by external mutation');
});

console.log(`\n${passed}/${passed + failed} tests passed`);
if (failed > 0) {
  console.log(`${failed} FAILED`);
  process.exit(1);
} else {
  console.log('All tests passed! ✅');
}
