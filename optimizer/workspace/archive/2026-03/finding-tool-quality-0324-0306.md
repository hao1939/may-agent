# Tool Quality Review — 2026-03-24T03:06

## Scope
28 sessions across 8 agents over ~5h overnight window (22:00–03:00 UTC).

## Cost Summary (model-corrected)
- **Total: $136/5h → $654/day projected** (overnight rate, daytime may differ)
- Optimizer: $92.24 (67.7%) — 5 sessions, avg $18.45/session
- Coach: $20.47 (15.0%) — 4 sessions, avg $5.12/session
- Tech-lead: $14.54 (10.7%) — 2 sessions, avg $7.27/session
- Scout: $3.44 (2.5%) — 3 sessions
- May: $2.88 (2.0%) — 5 sessions
- QA: $1.25 (0.9%) — 4 sessions
- Bob: $0.76 (0.6%) — 4 sessions (Gemini-3-Pro, much cheaper)
- Evaluator: $0.56 (0.4%) — 1 session

### KEY CORRECTION: Bob uses Gemini, not Opus
Previous cost analyses incorrectly applied Opus pricing ($15/M input) to Bob.
Bob uses `gemini-3-pro-preview` at ~$1.25/M input. This makes Bob 12x cheaper per token.
Bob's real cost: $0.76/5h = $3.65/day (was incorrectly estimated at $9.58 with Opus pricing).

## Tool Quality Metrics

### ✅ Edit Failures: 0/20 (100% success)
Zero edit failures across all 20 edit operations. Major improvement from earlier periods.
Read-before-edit discipline appears well-established.

### ⚠️ Bash-as-Cat: 10 instances across 5 sessions
- Coach: 7 (mostly `tail` on experiments.jsonl, `cat` on scenario.json)
- Tech-lead: 3 (cat bulletin.md, head finish-guard.ts)
Down from previous reviews but still present. Low-cost issue (~$0.50/day).

### 🔴 Large Tool Results (>10KB): 31 instances
This remains the biggest tool quality issue by token volume.

**Repeat offenders (same file read across multiple sessions):**
- `periodic-tasks.md`: 5x reads (optimizer, 18KB each) = ~90KB
- `focus-tasks.md`: 4x reads (bob, 19.5KB each) = ~78KB  
- `pending-decisions.md`: 3x reads (bob, 31.2KB each) = ~94KB
- `grep session history`: 3x (coach, 32-42KB each) = ~115KB
- `monitor-session.cjs`: 2x (bob+tech-lead, 49KB each) = ~98KB
- `convention-check.ts`: 2x (bob, 22KB each) = ~44KB

**Token waste from large results: ~$1.93/5h → $9.29/day (6.8% of total)**

### ⚠️ Coach session.jsonl Grep Bypass: Still Active
Session s_131 (coach): 15 references to session.jsonl, produced 3 large results (33-42KB).
The `session-read-guard` blocks `read()` of session.jsonl, but coach uses `bash` with `grep`.
This is the same pattern documented in finding-cost-scan-0323-1906.md.
**Impact: ~$5-7/day** (coach session.jsonl analysis drives the 32-42KB results)

### ✅ Idle Sessions: 11/28 (39%) — Working as Designed
May (4), QA (3), Scout (3), Bob (1) properly exit early with 1-2 ops.
Idle cost: $7.35/5h → $35/day — this is unavoidable context-injection overhead.
Lower than previous estimate ($10/day was correct for productive waste; $35/day is the full idle cost including context injection).

## Top 3 Actionable Items

1. **Optimizer periodic-tasks.md is 19KB and growing** — read 1-2x per session. Should archive older entries to a separate file, keeping only current dates + latest note per task. Est. savings: trim to ~5KB = ~$1.50/day.

2. **Bob reads same large files every session** — pending-decisions.md (31KB), focus-tasks.md (19KB), convention-check.ts (22KB). The `incremental-context-loading` skill was deployed to Bob but isn't being followed. Needs reinforcement or structural guard.

3. **Coach session.jsonl grep bypass** — already documented, needs either bash-level guard or coach-specific instruction change. Blocking on implementation path decision.

## Comparison to Previous Review (2026-03-23T21:36)
| Metric | Previous | Current | Trend |
|--------|----------|---------|-------|
| Bash-as-cat | 39 (1.3/sess) | 10 (0.6/sess) | ↓ 54% improved |
| Edit failures | 1/30 | 0/20 | ✅ |
| Large results >20KB | 21 | 15 | ↓ 29% improved |
| Idle sessions | 33% | 39% | ← stable |
| Coach session.jsonl | active | active | → unchanged |
