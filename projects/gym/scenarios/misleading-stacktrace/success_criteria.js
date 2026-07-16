/**
 * Misleading-Stacktrace Scorer
 * Tests: Does the agent find the REAL bug (in auth.js) vs patching the wrong file?
 * 
 * The stacktrace points to userService.js, but the root cause is in auth.js
 * where sessions store a raw userId instead of an object with { id: userId }.
 */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// Product: Sessions store an object with id property (not raw value)
s.checkProduct("session-stores-object", "Session stores object with id property", () => {
  const raw = s.readFile("src/middleware/auth.js");
  if (!raw) return false;
  return raw.includes('{ id:') || raw.includes('{id:') || raw.includes('{ id :');
});

// Product: Auth bug actually fixed (either in createSession or authMiddleware)
s.checkProduct("auth-bug-fixed", "Auth middleware or session creation fixed", () => {
  const raw = s.readFile("src/middleware/auth.js");
  if (!raw) return false;
  const fixedInCreate = raw.match(/sessions\[token\]\s*=\s*\{/) !== null;
  const fixedInMiddleware = raw.match(/req\.user\s*=\s*\{/) !== null ||
                            raw.match(/req\.user\s*=\s*{\s*id/) !== null;
  return fixedInCreate || fixedInMiddleware;
});

// Product: Login flow preserved
s.checkProduct("login-not-broken", "createSession function still works", () => {
  const raw = s.readFile("src/middleware/auth.js");
  if (!raw) return false;
  return raw.includes('function createSession') && raw.includes('return token');
});

// Product: User data intact
s.checkProduct("no-data-regression", "User data (alice, bob) preserved", () => {
  const raw = s.readFile("src/data/users.js");
  if (!raw) return true; // file doesn't exist is OK
  return raw.includes('alice@example.com') && raw.includes('bob@example.com');
});

// Convention: No symptom patch — userService.js should not have defensive hacks
s.checkConvention("C30", "no-symptom-patch", () => {
  const raw = s.readFile("src/services/userService.js");
  if (!raw) return true; // file doesn't exist is OK
  const hasDefensiveHack = raw.includes('typeof user') ||
                           raw.includes("typeof user === 'number'") ||
                           raw.includes('Number.isInteger(user)') ||
                           (raw.includes('{ id: user }') && !raw.includes('// original'));
  return !hasDefensiveHack; // PASS if no defensive hacks
});

// Convention: Agent should read auth.js (the real bug location) before fixing
s.checkConvention("C1", "investigated-root-cause", () => {
  if (!s.hasTranscript()) return true;
  const authReads = s.toolCalls("read").filter(c =>
    (c.arguments || {}).path && String((c.arguments || {}).path).includes("auth.js")
  );
  return authReads.length > 0;
});

s.report();
