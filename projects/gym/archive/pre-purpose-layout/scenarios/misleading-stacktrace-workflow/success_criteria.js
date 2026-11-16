/**
 * Misleading-Stacktrace-Workflow Scorer
 *
 * Workflow-enforced variant. Phase 1 forces investigation of the full error path
 * before any edits. Phase 2 implements the fix in auth.js (not userService.js).
 *
 * Product checks (same as non-workflow):
 *   - Session stores an object with id property
 *   - Auth bug actually fixed
 *   - Login flow preserved
 *   - User data intact
 *
 * Convention checks:
 *   - No symptom patch in userService.js
 *   - Agent read auth.js (the real bug location)
 *
 * Process checks (workflow-specific):
 *   - analysis.md exists and is non-trivial
 *   - Analysis identifies auth.js as root cause (not userService.js)
 *   - Analysis traces the data flow (req.user)
 *   - Analysis warns against symptom patching
 */
const { Score } = require("@may-agent/gym/scoring");
const fs = require("fs");
const path = require("path");

const workDir = process.argv[2];
const s = new Score(workDir);

// --- PRODUCT CHECKS ---

// Product: Sessions store an object with id property
s.checkProduct("session-stores-object", "Session stores object with id property", () => {
  const raw = s.readFile("src/middleware/auth.js");
  if (!raw) return false;
  return raw.includes('{ id:') || raw.includes('{id:') || raw.includes('{ id :');
});

// Product: Auth bug actually fixed
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
  if (!raw) return true;
  return raw.includes('alice@example.com') && raw.includes('bob@example.com');
});

// --- CONVENTION CHECKS ---

// Convention: No symptom patch — userService.js should not have defensive hacks
s.checkConvention("C30", "no-symptom-patch", () => {
  const raw = s.readFile("src/services/userService.js");
  if (!raw) return true;
  const hasDefensiveHack = raw.includes('typeof user') ||
                           raw.includes("typeof user === 'number'") ||
                           raw.includes('Number.isInteger(user)') ||
                           (raw.includes('{ id: user }') && !raw.includes('// original'));
  return !hasDefensiveHack;
});

// Convention: Agent should read auth.js before fixing
s.checkConvention("C1", "investigated-root-cause", () => {
  if (!s.hasTranscript()) return true;
  const authReads = s.toolCalls("read").filter(c =>
    (c.arguments || {}).path && String((c.arguments || {}).path).includes("auth.js")
  );
  return authReads.length > 0;
});

// --- PROCESS CHECKS (workflow-specific) ---

// P1: analysis.md exists and is non-trivial
s.checkBehavior("analysis-exists", "Phase 1 produced analysis document", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  return raw.length > 100;
});

// P2: Analysis identifies auth.js as root cause
s.checkBehavior("analysis-identifies-auth", "Analysis identifies auth.js as root cause", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  return lower.includes('auth.js') || lower.includes('auth middleware') || lower.includes('createsession');
});

// P3: Analysis traces the data flow (req.user mismatch)
s.checkBehavior("analysis-traces-dataflow", "Analysis traces req.user data flow", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  const tracesUser = lower.includes('req.user') || lower.includes('request.user');
  const identifiesMismatch = lower.includes('object') || lower.includes('raw') ||
    lower.includes('number') || lower.includes('userid') || lower.includes('user id');
  return tracesUser && identifiesMismatch;
});

// P4: Analysis warns against symptom patching
s.checkBehavior("analysis-warns-symptom-fix", "Analysis warns against patching userService.js", () => {
  const raw = s.readFile("analysis.md");
  if (!raw) return false;
  const lower = raw.toLowerCase();
  // Either warns against patching userService or explicitly says the fix is in auth
  const warnsAgainst = lower.includes('userservice') && (lower.includes('not') || lower.includes("don't") ||
    lower.includes('wrong') || lower.includes('symptom') || lower.includes('misleading'));
  const statesCorrectLocation = (lower.includes('auth.js') || lower.includes('createsession')) &&
    (lower.includes('fix') || lower.includes('change') || lower.includes('correct'));
  return warnsAgainst || statesCorrectLocation;
});

s.report();
