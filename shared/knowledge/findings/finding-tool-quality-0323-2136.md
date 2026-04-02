# Tool Quality Review — 2026-03-23T21:36

## Context
Manual tool quality review across 30 most recent sessions (375 total ops, 10 agents).
Handler-based tool-quality-scan still dead (binary rebuild blocked).

## Key Findings

### 1. Large Tool Results (>20KB) — HIGH IMPACT
**21 occurrences across 30 sessions** consuming massive tokens.

Top offenders by file:
- `agents/evaluator/skills/monitor-session.cjs` — 50KB, read 5x (tech-lead)
- `agents/coach/knowledge/method-catalog.md` — 51KB, read 2x (coach)
- `agents/tech-lead/workspace/pending-decisions.md` — 31KB, read 3x (bob)
- `agents/shared/focus-tasks.md` — 31KB, read 3x (bob)
- `agents/may/handlers/active-nudge.ts` — 50KB, read 2x (tech-lead)

**Impact**: ~650KB of token waste from just these reads across 30 sessions.
**Fix options**: (1) Add `limit` param guidance to agent heartbeats, (2) Break up large files, (3) Add read-size warning to read() tool output when >15KB.

### 2. Bash-as-Cat Still Present — MEDIUM IMPACT
**39 bash-as-cat calls** (using `cat`/`head` in bash instead of `read()` tool).

By agent:
- coach: 18 calls (worst offender)
- optimizer: 13 calls (own sessions — skill lifecycle sub-sessions)
- tech-lead: 7 calls

**Trend**: Down from 93 calls/6h at last review (Mar 22 16:39) but still present.
Coach's bash-as-cat is concentrated in common-sense-verify sessions where it greps session.jsonl files.

### 3. Coach Session.jsonl Grep Bypass — HIGH IMPACT
Coach session s_1774299966402_102: **23 bash calls touching session.jsonl = 51KB** of data.
This bypasses the session-read-guard that blocks `read()` of session.jsonl.
Already known issue from cost-scan-0323-1906.md. Still not fixed.

### 4. Idle Sessions (≤2 ops) — MEDIUM IMPACT  
**10 out of 30 sessions = 33%** are idle (≤2 ops).
- may: 4 sessions × 1 op (correctly exits via skipIfIdle)
- qa: 3 sessions × 2 ops
- bob: 1 session × 2 ops
- evaluator: 1 session × 2 ops
- optimizer: 1 session × 1 op

**Assessment**: May's 1-op sessions are working correctly (skipIfIdle). QA's 2-op sessions are also correct early exits. This is the DESIRED behavior — not waste. The idle rate being 33% means skipIfIdle is working.

### 5. ENOENT Errors — LOW IMPACT
33 ENOENT errors across 14 sessions. Most are single errors quickly recovered from.
Evaluator had 7 ENOENT in one session (guessing at file paths).

### 6. P53 Violations — LOW IMPACT
~20 P53 references across 12 sessions. These are cross-agent boundary violations that get caught and blocked. The guard is working. Most agents pivot correctly after getting P53-blocked.

### 7. Edit Match Failures — MINIMAL
Only 1 edit match failure (bob) across 30 sessions. The coder-edit-discipline skill appears to be working.

## Summary Metrics
| Metric | Count | Rate | Trend |
|--------|-------|------|-------|
| Bash-as-cat | 39 | 1.3/session | ↓ (was 2.3/session) |
| Large results >20KB | 21 | 0.7/session | NEW metric |
| Edit failures | 1 | 0.03/session | ↓ (good) |
| ENOENT errors | 33 | 1.1/session | STABLE |
| P53 violations | 20 | 0.67/session | STABLE |
| Idle sessions | 10 | 33% | ✅ (desired) |

## Recommendations (Priority Order)
1. **Break up monitor-session.cjs** (50KB read 5x) — if agents need to read it, it should be modular
2. **Add bash-grep guard for session.jsonl** — extend session-read-guard to catch bash grep patterns
3. **Break up method-catalog.md** (51KB) — coach reads it frequently; should have an index + individual files
4. **Bob: incremental-context-loading for focus-tasks.md/pending-decisions.md** — reads 31KB files repeatedly with 0 changes

## Previous Review Comparison
- **Mar 22 16:39**: Bash-as-cat 93/6h (15.5/hr). Session volume 41/6h.
- **Now**: Bash-as-cat 39/30 sessions. Session rate ~5/hr. Per-session rate improved from ~2.3 to ~1.3.
- **Edit failures**: Was not tracked. Now: 1/30 = excellent.
- **New finding**: Large tool results (>20KB) = biggest remaining token waste category.
