# Tool Gap Scan — Apr 16, 2026 (Evening 6h Window)

## Sessions Analyzed (opCount > 10, last 6h)
| Agent | Session | Ops | Eff | Key Pattern |
|-------|---------|-----|-----|-------------|
| bob | s_…4254_320 | 72 | 0.55 | EXP-173 execution — path guessing waste |
| coach | s_…1320_341 | 51 | 0.80 | EXP-172 replication |
| coach | s_…2517_321 | 43 | 0.78 | EXP-173 setup — git hygiene waste |
| coach | s_…9494_243 | 30 | 0.80 | EXP-172 design |
| bob | s_…8576_273 | 23 | 0.74 | EXP-172 trials — count verification mismatch |
| tech-lead | s_…3669_190 | 22 | 0.62 | Persistent task — FM-3.3 guard tax |
| bob | s_…4519_340 | 22 | 0.55 | EXP-174 design — path thrash |
| tech-lead | s_…7679_389 | 21 | 0.42 | Review branch — reasoning-action mismatch |

**Total: 284 ops across 8 sessions. Weighted avg efficiency: 0.65**

## Pattern 1: Path Guessing (Bob 72-op, Bob 22-op) — RECURRING

**Frequency:** 3 of 8 sessions (all Bob sessions). Present in prior scans too.
**Waste:** 5-10 ops per session. Bob tries `tests/scenarios/`, `tests/gym/scenarios/` before finding `agents/gym/scenarios/`.
**Root cause:** Bob's context doesn't include the gym scenario path. This was flagged in previous scans.
**Status:** Known issue. Path hints were added to bob's context but the pattern persists — Bob may not be reading context on experiment sessions.
**Action:** Verify bob's context.md includes `agents/gym/scenarios/` path. If yes, this is a context-reading problem, not a tool gap.

## Pattern 2: FM-3.3 Verification Guard Tax (tech-lead 22-op, all agents)

**Frequency:** Systemic — affects every session.
**Waste:** 2-3 ops per session (write checklist + read-back to verify).
**Status:** By design. The guard prevents real errors. Not a tool gap.

## Pattern 3: Sequential Gym Trial Execution (Bob, Coach)

**Frequency:** Bob 72-op and 23-op sessions, Coach 43-op and 51-op sessions.
**Waste:** Each `gym-run.sh` call is 1 op. Running 30 trials = 30 ops minimum.
**Status:** `gym-batch.sh` was proposed in previous scans. Not yet implemented.
**Action:** This remains the #1 savings opportunity. A batch runner would cut 50-70% of ops from experiment sessions.

## Pattern 4: Tech-Lead Low Efficiency (0.42-0.62)

**Frequency:** Both tech-lead sessions.
**Waste:** FM-3.3 guard redirects + reasoning-action mismatch (implemented shell script when spec said TypeScript function).
**Root cause:** Task spec ambiguity + verification overhead. Not a tool gap.

## Delta from Previous Scan (0416-early)

- **Path guessing:** Still happening despite being flagged 5+ times. Escalation needed.
- **Gym batch runner:** Still not built. Remains top recommendation.
- **New:** Tech-lead efficiency dropped (0.42 is lowest seen). The review-branch-merge workflow may need tighter specs.

## Recommendations

1. **[HIGH] Build gym-batch.sh** — Estimated 30+ op savings per experiment session. Flagged in 6 consecutive scans.
2. **[MED] Investigate bob context reading** — Path guessing recurs despite context.md fixes. Is bob reading context on experiment tasks?
3. **[LOW] Tech-lead task spec quality** — M1 spec said `commitAndMerge()` function but tech-lead built a shell script. Clearer deliverable format needed.
