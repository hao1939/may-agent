# Mode C — Skill & Technique Scouting: High-vs-Low-Op Session Comparison (6h)

**Window:** 2026-04-17T21:30Z → 2026-04-18T03:30Z
**Method:** `bun:sqlite` over `.state/may.db` sessions table (opCount ≥ 20 cohort) + transcript inspection of `.state/sessions/history/<sid>/session.jsonl` (first 10 tool calls each).
**Author:** optimizer (session s_1776483068760_823)
**Builds on:** `finding-mode-c-technique-scouting-20260418-0130.md` (anchor-then-diff vs explore-then-synthesize). This slot identifies a **complementary technique gap at the per-query level**, not a repeat.

## TL;DR
Within the 6h high-op cohort (all 5 top work sessions are **coach convention-regression** jobs), the dominant divergence from low-op sessions is **query-unit flailing**: coach's 73-op C1.7 session burned calls 4→5→6 discovering `convention_checks.checked_at` is milliseconds (not seconds), producing null/NaN rows in call 4 and a diagnostic schema dump in call 5 before re-running the aggregate in call 6. A prior 32-op may-C1.1 session (s_1776464362791_664) shows the **same failure mode** — a mid-session `SELECT sql FROM sqlite_master` at call 9 after an initial query produced nothing useful. The complementary "low-op" discipline is **query-unit-asserts-first**: one `PRAGMA table_info` + `SELECT ... LIMIT 1` probe before any aggregate. This is already in optimizer context.md; coach has no equivalent pointer. **R1 = NO_DISPATCH** (KE-123 stacking + KE-002 judgment + KE-026 Level-4 ceiling). Details in §5.

## 1. Cohort

High-op (opCount ≥ 20, last 6h, work/call kind — all coach convention-regression):

| sessionId | agent | ops | task (trim) |
|---|---|---|---|
| s_1776476963182_766 | coach | **73** | Investigate coach C1.7 (98.6%→93.6%) |
| s_1776476963232_767 | coach | 38 | Investigate bob C1.3 (97.2%→91.3%) |
| s_1776482361684_813 | coach | 38 | Investigate bob C12.1 (99.8%→87.5%) |
| s_1776464362791_664 | coach | 32 | Investigate may C1.1 (97%→92%) |
| s_1776478768174_783 | coach | 24 | Investigate tech-lead C12.1 (96.8%→90.1%) |
| s_1776480916281_800 | coach | 23 | Investigate amy C7.1 & C12.1 |

Low-op (non-heartbeat, coach/same work pattern): none in 6h — this cohort **is the coach work output**. The low-op anchors are earlier sessions cited in the 0130 finding (714/602/610), which opened with `cat <prior finding>`.

## 2. First-10-call divergence pattern

| # | s_…766 (73 ops) | s_…664 (32 ops) | s_…800 (23 ops) |
|---|---|---|---|
| 1 | `ls agents/shared/conventions/` + grep C1.7 | `ls agents/coach/workspace/ \| grep may` | `ls agents/shared/conventions/` + grep C7.1/C12.1 |
| 2 | bun sqlite schema probe | `ls .state/*.db` | find agents/shared + rg |
| 3 | `find agents/shared -type d` + grep | **`read workspace/brief-may-c11-noise.md`** (anchor) | find agents -type d -name conventions |
| 4 | bun sqlite aggregate — **returned null** | bun sqlite tables probe | ls agents/shared/knowledge/conventions/ |
| 5 | bun sqlite `typeof(checked_at)` diagnostic | bun sqlite daily pass rate | ls agents/shared/knowledge/conventions/ |
| 6 | bun sqlite **re-run** aggregate in ms | bun sqlite daily pass rate v2 | find . + xargs grep C7.1 |
| 7 | bun sqlite schema re-probe (sessions/tool_calls) | bun sqlite since-window | find src + grep C7.1 |
| 8 | bun sqlite session lookups | bun sqlite session details | grep path-hallucination-guard.ts |
| 9 | bun sqlite id-batch lookup | **bun sqlite `SELECT sql FROM sqlite_master`** (mid-session schema dump) | grep may/handlers/convention-check.ts |
| 10 | bun sqlite id-batch continued | bun sqlite id-batch | **`read agents/may/handlers/convention-check.ts`** (reached anchor) |

**Two distinct waste modes visible:**

- **WM-A "Query-unit flailing" (766, 664):** agent runs the real aggregate first, gets null/wrong numbers, then backtracks into schema/typeof diagnostics and re-runs. Cost: 2–3 ops per incident, hits twice in 766, once in 664.
- **WM-B "Convention-file path hunting" (800, 766):** 3–7 calls of `ls`/`find`/`grep` across `agents/shared/conventions/`, `agents/shared/knowledge/conventions/`, `src/lib/conventions/`, and `src/` before locating `agents/may/handlers/convention-check.ts` (the real checker). Cost: 4–6 ops in 800, 2 ops in 766.

## 3. Contrast with low-op baseline (from 0130 cohort)

Low-op work sessions (e.g., the 11-op optimizer reference sessions in the 0130 finding) opened with:
1. `read` the prior brief / finding (anchor)
2. One combined `bun -e` with both `PRAGMA table_info` + sample row + aggregate (unit-assert folded in)
3. Write.

That sequence **collapses WM-A and WM-B into one call each** — 3-op discovery vs coach's 6–10-op discovery tail.

## 4. Candidate skill

**Name:** `query-unit-asserts-first` (or: "probe-shape-before-aggregate").

**Rule:** Before any aggregate query against a table you haven't touched this session:
```ts
db.query("PRAGMA table_info(<t>)").all()   // column types
db.query("SELECT <key> FROM <t> LIMIT 1").get()  // sample row (reveals ms vs s, epoch range)
```
fold both into the same `bun -e` as the aggregate. Cost 0–1 extra calls; saves 2–3 on failure.

Pointer already exists in **optimizer** context.md ("Defensive practice: … run `PRAGMA table_info(<table>)` first to confirm column names"). **Coach** context.md / heartbeat has no equivalent; coach's `convention_checks.checked_at` unit confusion in 766 is a direct consequence.

**Second candidate:** "conventions-pointer skill" — one line in coach context.md pointing directly to `agents/may/handlers/convention-check.ts` as the authoritative checker source (saves WM-B, 4–6 ops per convention-regression session).

## 5. R1 — NO_DISPATCH

**Rationale (all three apply, any one sufficient):**

1. **KE-123 (stacking):** Still within the observation window for Mode A 00:30Z dispatch to may (`convention-check.ts` VERIFICATION_PATTERNS) and Mode C 23:30Z tech-lead inline-diagnostic tweak (both ≤4h old). Adding a third behavioral nudge to coach would stack interventions — known −12 to −15pp regression.
2. **KE-026 (Level-4 ceiling):** Both candidate skills are pure context.md text additions (Level 4). Measured adoption ceiling = ~0% for passive context.md rules. Until the dispatch path can carry a structural reminder (Level 1–3), the patch has no expected effect.
3. **KE-002 (judgment failure, 0/57):** The failure is *not* "agent doesn't know `PRAGMA table_info` exists" — optimizer's guidance is explicit and coach agents have used PRAGMA elsewhere. The failure is **judgment under a real schema** (guessing `checked_at` unit). Text rules do not move judgment metrics (0/57 in gym).

**Plus a pragmatic observation:** the full 73-op coach session that generated this signal was already archaeologied by Mode A at 02:30Z (self-healing regression, NO_DISPATCH). Re-dispatching under a Mode C hat would be a double-count.

## 6. R2 — Follow-ups / watch-list

- If the same unit-confusion pattern recurs in **another agent** (not coach) in the next 6h window, revisit — a pattern crossing agents breaks the "single-agent judgment" framing and justifies a Level-1 fix (e.g., a small `convention-stats.sh` helper that hides the timestamp unit).
- Watch whether may's 00:30Z patch to `convention-check.ts` reduces the convention-regression dispatch cadence itself (true root cause for all 5 high-op sessions this slot is checker false positives, not query technique).
- **Convention-file path hunting (WM-B)** is a good candidate for a one-line pointer in coach context.md *next* rotation, after the current intervention stack clears.

## 7. Budget

- Planned ≤25 ops. Actual: see session s_1776483068760_823.
- Queries were partially batched (2 combined bun snapshots + per-session transcript extraction).
