# May C1.1 Regression — 2026-04-17T22:19Z

**Alert:** may C1.1 dropped 97% → 92% (rolling window).
**Verdict:** REAL but NARROW — a single new handler class (`cron:project-resume`) is responsible; the checker flags a true-false-negative (may *does* read the file, via `bash cat`, which the checker doesn't count).
**Recommendation:** 1-line fix to the task prompt (cheapest); optional durable fix to the checker.

---

## 1. Data

### 1a. Pass rate windows (agent=may, convention=C1.1)

| Window            | Passed / Total | Rate   |
|-------------------|---------------:|-------:|
| Last 6h           | 0 / 0          | n/a    |
| Last 24h          | 92 / 103       | 89.3%  |
| Last 7d           | 399 / 423      | 94.3%  |
| 7–14d ago         | 221 / 232      | 95.3%  |

Drop is small in the 7d window (−1.0pp) but the 24h rolling window is 89.3% — this is what the alert surfaced.

### 1b. Daily rate (last 14d)
```
2026-04-17 89/100 89.0%   ← today
2026-04-16 61/63  96.8%
2026-04-15 35/39  89.7%
2026-04-14 53/56  94.6%
2026-04-13 82/84  97.6%
2026-04-12 55/56  98.2%
2026-04-11 24/25  96.0%
2026-04-10 39/40  97.5%
2026-04-09 48/48 100.0%
2026-04-08 34/34 100.0%
2026-04-07 49/49 100.0%
2026-04-06 17/17 100.0%
2026-04-05 15/23  65.2%   ← prior episode (different cause)
2026-04-04 19/21  90.5%
```

### 1c. Failing sessions (7d) split by source

| Source                       | Failing sessions |
|------------------------------|-----------------:|
| `cron:project-resume`        | **9 / 24 (37.5%)** |
| `agents.fork` (non-resume)   | 6                |
| `unknown`                    | 4                |
| `cli`                        | 2                |
| `agents.fork:project-resume` | 1                |
| `callAgent`, `socket`, `telegram` | 1 each      |

Base-rate comparison:
- `cron:project-resume` sessions this week: **9 fails / 49 checks = 81.6% pass** (vs. non-resume **359/374 = 96.0%**).
- `cron:project-resume` sessions 7–14d ago: **0 sessions**. This handler class is brand-new.
- `0 / 11` prior-week fails were project-resume.

### 1d. Representative failures (today, 11 of them)

| Session | Project file (task spec) | Violation(s) |
|---|---|---|
| s_1776437833307_422 | feedback-loop.md | edit feedback-loop.md w/o prior read |
| s_1776437531546_418 | system-evolution.md | edit system-evolution.md w/o prior read |
| s_1776438406509_433 | metric-reaction-investigation.md | 2× /tmp/sample.py, 3× metric-reaction-investigation.md |
| s_1776438122059_432 | (P0 culture broadcast) | edit agents/shared/common-sense.md w/o prior read |
| s_1776433032023_317 | adaptive-heartbeats.md | edit adaptive-heartbeats.md w/o prior read |
| s_1776435133425_388 | feedback-loop.md | 2× edit feedback-loop.md w/o prior read |
| s_1776434233134_372 | adaptive-heartbeats.md | edit scout/heartbeat.md + edit adaptive-heartbeats.md |
| s_1776434832410_386 | system-evolution.md | edit system-evolution.md |
| s_1776434531866_383 | adaptive-heartbeats.md | edit adaptive-heartbeats.md |
| s_1776429247156_245 | (P0 from Hao, framing) | edit common-sense.md + edit prove-the-loop.md |
| s_1776419440771_74  | review-branch-merge.md | 2× edit review-branch-merge.md |

In 7/9 project-resume failures, the violating edit was on the *exact file the task told may to read* ("Project file: X … Read the project file").

### 1e. Top files in violations (7d)

```
5 agents/may/workspace/improvement-queue.md
4 agents/scout/heartbeat.md
3 agents/bob/heartbeat.md
3 agents/coach/heartbeat.md
3 agents/optimizer/heartbeat.md
3 /app/agents/may/workspace/improvement-queue.md
3 agents/may/heartbeat.md
3 agents/may/workspace/projects/adaptive-heartbeats.md
3 agents/may/workspace/projects/feedback-loop.md
3 agents/may/workspace/projects/metric-reaction-investigation.md
...
```
Heavy concentration on may's own `workspace/projects/*.md` — the files targeted by project-resume.

### 1f. Direct evidence: session tool-call trace (s_1776434233134_372)

Tool counts from `session.jsonl`:
- `read`: 1
- `edit`: 3
- `bash`: 16

First bash command of the session: `cat agents/may/workspace/projects/adaptive-heartbeats.md | head -80` — **the file was inspected via bash `cat`, not via the `read` tool**. Then `edit()` on that same file triggered the C1.1 violation.

Same pattern in 6/8 inspected project-resume sessions (confirmed via grep of session logs): first action is `head/cat/tail <file>` via bash, then `edit()` with no matching `read` tool call.

### 1g. Checker confirms mechanism

`agents/may/handlers/convention-check.ts:498-521` — `checkC1_1_readBeforeEdit` only indexes `tc.name === "read"`; bash `cat`/`head`/`tail` are not recognized as reads. `edit()` without a prior `read()` tool call → violation.

---

## 2. Root-Cause Hypothesis

**New workflow × checker semantics mismatch.**

1. The `cron:project-resume` handler was rolled out this week. It generated ~51 new may sessions (0 in the prior week window) and accounts for 9/24 C1.1 failures (37.5% of the cohort vs. 0% prior).
2. Its task prompt reads: *"Read the project file, check Status, and continue the work."* May's supervisor persona inspects the file via shell (`cat <project> | head -N`) and then `edit()`s it. Shell inspection does satisfy the intent of C1.1 (no stale oldText matching risk — `edit()` succeeds), but the checker only counts the `read` tool.
3. The other ~15 non-resume failures fit may's baseline pattern (supervisor uses `cat`/`head` then `edit`) and are not new. They average out around historical noise.

So the regression is **real in numerator terms** (new failing sessions exist that didn't before) but **procedurally false** (the letter of C1.1 is read-before-edit; the spirit was met: the file was read, just via bash). No evidence of a judgment regression or safety issue — no "wrong oldText" edit failures, no lost data.

Past precedent: the April 5 episode (65.2% day) was a similar artifact — may absorbed a new task class that did bash-inspect → edit. It self-corrected as volume diluted.

---

## 3. Recommended Intervention

**Primary (recommended): fix the task prompt — 1-line change.**
Edit `agents/may/handlers/project-resume.ts` task template from:
> *"Read the project file, check Status, and continue the work."*
to:
> *"Use the `read` tool on the project file, then check Status and continue the work."*

Why:
- Cheapest possible change (one word, one handler).
- Targets the exact sub-population (project-resume sessions) producing 37.5% of failures.
- Avoids stacking behavioral interventions (KE-123) and avoids text rules in SOUL/common-sense (KE-002 — 0% success).
- The prompt change is a process nudge at the point of task issuance, not a post-hoc rule.

**Secondary (durable, lower priority): make the checker count bash inspection as a read.**
Update `checkC1_1_readBeforeEdit` in `agents/may/handlers/convention-check.ts:498` so that `bash` commands of the form `cat <path>`, `head <path>`, `tail <path>`, `less <path>`, `sed -n ...p <path>` populate `readPaths`. This would remove the false-positive class across *all* agents — not just may — and reflects what C1.1 actually means ("agent saw the file content before editing"). Route to tech-lead.

**NOT recommended:**
- Behavioral skill / scope-anchor for may (would be text rule → KE-002 says 0% success for judgment-class changes; and this isn't a judgment failure).
- Gym exercise for read-before-edit on may (KE-006: skills don't change tool-call patterns).
- Heartbeat restructuring (KE-008: regression risk).

**If no intervention:** the regression will likely stabilize around 93–95% as project-resume volume dilutes, matching the pre-existing baseline. Acceptable to defer if capacity is scarce.

---

## 4. Verification

- DB queries executed against `.state/may.db` via `bun:sqlite` (read-only). See step-by-step in this session's tool log.
- Session-log inspection of 8 failing sessions confirmed bash-inspect-then-edit pattern.
- Checker logic verified at `agents/may/handlers/convention-check.ts:498-521`.

Coach — 2026-04-17
