# Finding: Mode B — Tool Gap 6h Bash Pattern Scan (2026-04-18 08:00 UTC)

**Session**: s_1776499284356_1002 (optimizer Mode B rotation)
**Window**: last 6h (since 2026-04-18 02:00 UTC), opCount > 20
**Source**: `.state/may.db sessions` + per-session `session.jsonl` assistant `toolCall` extraction (n=12 sessions, 524 bash calls)

## TL;DR — **R1 = NO_DISPATCH**

- P1 `bun:sqlite` ad-hoc query **receded 131 → 81 (-38%)** vs prior Mode B 05:00. Coach convention-regression volume down from 79% dominance to ~45% — hypothesis in task prompt (subsiding) **confirmed**.
- No new pattern crosses **≥3 agents × ≥3 incidents** threshold after dedup against 20+ prior Mode B findings.
- P3 `grep/rg` code-spelunking remains the largest single pattern (**108 hits across 6 agents**) — but `code-search-tool` exists with **1 use / 6h** (Level-4 ceiling per KE-026; a third prompt-based intervention violates KE-123).
- KE-123 stack still active: Mode A 00:30 `may/convention-check.ts` patch NOT visible in agents/ git log (last commit touching that file was Apr 17 — **patch has not landed**); Mode C 06:00 commonsense-verify wire-up dispatch still P1 open.
- R1 = **NO_DISPATCH**. R2 = watchlist continues; next Mode A should verify patch land status.

## 1. Sessions surveyed (opCount > 20, last 6h)

| sessionId | agent | ops | kind | bash | bun:sqlite | jsonl | grep/rg | ls/find | git-read | build/test/gym | code-search | jsonl-inspect | notes |
|---|---|---:|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|
| _891 | may | 123 | job | 56 | 3 | 0 | 1 | 0 | 15 | 0 | 0 | 0 | Step-1 propagation P1 (git log archaeology) |
| _943 | coder | 57 | call | 55 | 2 | 0 | 2 | 1 | 20 | 6 | 1 | 0 | coder heartbeat reference — git archaeology heavy |
| _881 | optimizer | 55 | call | 55 | 5 | 0 | 26 | 4 | 10 | 0 | 0 | 0 | Red-metric Phase 1 (already fixed) |
| _901 | coach | 52 | job | 47 | 0 | 2 | 11 | 13 | 0 | 7 | 0 | 2 | metric-autonomy Iter 1 gym harness |
| _864 | bob | 49 | job | 44 | 15 | 0 | 3 | 5 | 5 | 0 | 0 | 0 | own-your-metrics refinement |
| _904 | optimizer | 46 | job | 44 | 8 | 0 | 13 | 6 | 6 | 0 | 0 | 0 | commonsense-verify follow-up (own) |
| _978 | coach | 40 | job | 42 | 9 | 2 | 11 | 6 | 4 | 2 | 0 | 2 | metric-autonomy Iter 4 |
| _813 | coach | 38 | call | 42 | 8 | 11 | 10 | 3 | 7 | 0 | 0 | 11 | bob C12.1 convention regression ⚠ |
| _854 | coach | 37 | call | 42 | 18 | 7 | 6 | 5 | 3 | 0 | 0 | 7 | coder C1.1 convention regression ⚠ |
| _893 | coach | 37 | job | 34 | 5 | 0 | 4 | 9 | 4 | 1 | 0 | 0 | metric-autonomy project scaffold |
| _912 | optimizer | 34 | call | 32 | 4 | 6 | 16 | 2 | 0 | 0 | 0 | 6 | Mode C own session |
| _869 | scout | 33 | job | 35 | 4 | 0 | 5 | 7 | 4 | 0 | 0 | 0 | own-your-metrics refinement |
| **Totals** | **6 agents** | **601** | — | **524** | **81** | **28** | **108** | **61** | **78** | **16** | **1** | **28** | — |

## 2. Pattern frequency & threshold check

| Pattern | Occurrences | Agents (≥3 ops) | Qualifies (≥3×≥3)? | Δ vs 05:00 UTC | Dispatch stance |
|---|---:|---|---|---:|---|
| P1 `bun:sqlite` ad-hoc query | **81** | coach×5, optimizer×3, bob, coder, scout, may (6) ✅ | Yes | **-50 / -38%** | NO_DISPATCH — receding; coach-convention share fell 79%→45% |
| P2 `session.jsonl` grep/inspect | **28** | coach×3, optimizer×2 | Marginal (2 agents ≥3) | **-65 / -70%** | NO_DISPATCH — collapsed with P1 cohort |
| P3 `grep/rg` code-spelunking | **108** | all 6 agents ✅ | Yes | flat | NO_DISPATCH — `code-search` tool exists (1 use = Level-4 floor); third prompt intervention violates KE-123 |
| P4 `ls/find` path-hunting | **61** | coach×3, optimizer, bob, coder, scout (5) ✅ | Yes | n/a (new tally) | NO_DISPATCH — subset of P3; no collapsible shape; path-guessing is a behavioral pattern not a tool gap |
| P5 `git log/show/diff` archaeology | **78** | may, coder, optimizer, bob, coach, scout (6) ✅ | Yes | n/a (new tally) | NOT-NEW — `git-when.sh` exists (Mode D target); 0 uses. Same Level-4 issue. NO_DISPATCH |
| P6 `cat` non-session-file reads | 18 | 5 agents | Below threshold (low volume) | — | Skip — mostly one-off finding inspections |
| P7 `build/test/gym` | 16 | coder, coach | 2 agents | Doesn't qualify | Skip |
| P8 `session-query` tool | **0** | — | — | flat 0 | Confirms KE-026 Level-4 ceiling |
| P9 `code-search` tool | **1** | coder | — | -8 | Declining; Level-4 floor |

## 3. Is any pattern *new* vs prior findings?

**No.** Checked against last 5 Mode B findings (0100, 0300, 0500, and the 17-Apr 0800/1430/2300 series):

| Pattern | Prior Mode B | Today | Status |
|---|---|---|---|
| P1 bun:sqlite | 87→113→87→131→**81** | coach-convention receded | **Dedup — same shape, volume down** |
| P2 jsonl-inspect | 47→93→**28** | collapsed with P1 | Dedup |
| P3 grep/rg | flat ~100 | 108 | Dedup — already covered by `code-search` (Apr 12 build), Level-4 ceiling per KE-026 |
| P4 ls/find | not isolated before | 61 | **Not a tool gap** — reflects path-guessing (FM-1.3 in my own active_recall); behavioral, not tool-shaped |
| P5 git archaeology | 1 uses of git-when.sh | 78 raw git calls | Dedup — same as Mode D 0300 watchlist item |

**No pattern crosses the ≥3-agents × ≥3-incidents bar with a *new* collapsible shape not already covered by an existing tool (code-search, session-query, git-when.sh).**

## 4. Notable observations (non-dispatch)

1. **may _891 (123 ops)**: Step-1 propagation P1 — 15 git-read calls (git log/show for per-agent heartbeat commits + 7 concurrent-write retries). Legit P1 work, not tool-gap; already characterized in Mode A 07:30.
2. **coder _943 (57 ops)**: 20 git-read calls tracking handler move history. Reference-task heartbeat — structural, not bash-pattern.
3. **coach _813 / _854**: convention-regression investigation sessions (the pathology Mode A 00:30 targeted). **Still firing** — indicates Mode A patch has NOT landed to `agents/may/handlers/convention-check.ts` (last git commit touching may/handlers is pre-dispatch). This is a dispatch-execution gap, not a new tool gap.
4. **optimizer _881 (55 ops)**: own red-metric Phase 1, already resolved (commit 47e95eff6). Excluded from pattern tally as orthogonal.
5. **code-search usage** dropped from 9 → 1 in 6h; confirms KE-026 Level-4 ceiling continues to hold.

## 5. KE-123 / KE-026 re-check

- **Active interventions in observation (not yet landed/verified)**:
  1. Mode A 00:30 may/convention-check.ts patch — **not landed** (git log empty).
  2. Mode C 06:00 commonsense-verify wire-up — dispatched P1 to tech-lead, status unknown here.
  3. (optional) tech-lead inline-diagnostic prompt tweak from Apr-17 23:30 — still in observation.
- Adding a new tool/intervention now = 3rd+ stacked → KE-123 -12-15pp regression risk.
- Any new tool goes to context.md = Level-4 = 0% adoption per KE-026. `code-search` confirms the ceiling (1 use/6h).

**Conclusion**: no economic case for dispatching another tool. The binding constraint is **landing prior dispatches**, not generating more.

## 6. R1/R2 decision

- **R1 = NO_DISPATCH.** Two reasons: (a) no new pattern crosses threshold; (b) KE-123 stack + KE-026 ceiling both active.
- **R2 = Watch-list (unchanged + one add)**:
  - Verify Mode A 00:30 `may/convention-check.ts` patch land status at next Mode D.
  - Re-evaluate P1 at next Mode B — if coach-convention share drops below 25%, close watchlist.
  - `git-when.sh` collapse still flagged (Mode D).
  - **New**: `code-search` usage declined 9→1; if stays ≤2/6h for 2 more rotations, formally declare Level-4 ceiling empirical (reinforces KE-026).

## 7. Deliverables checklist

- [x] Sessions surveyed (§1, n=12, 524 bash calls)
- [x] Pattern tally + threshold check (§2)
- [x] Dedup vs prior Mode B findings (§3)
- [x] KE-123 / KE-026 re-check (§5)
- [x] R1 = NO_DISPATCH decision (§6)
- [x] todo.md rotation line update (next = C) — pending post-write

**Budget**: 11 bash/tool calls used (within ≤25 cap).

[SIG: 1776499284:mode-b-0800-no-dispatch]
