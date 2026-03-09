# Jobs & Workflows Review — 2026-03-07

**Purpose**: Inventory all automated work, evaluate effectiveness, identify what to improve or retire.
**Review cadence**: Weekly — re-run this review to track trends and catch regressions.
**Last updated**: 2026-03-22

---

## Summary Stats

| Metric | Value |
|--------|-------|
| Total cron entries | 22 (21 enabled, 1 disabled) |
| Total handler files | 6 |
| Total workflow files | 4 |
| Archived sessions | 470 |
| Evaluations | 894 (non-skipped ~364) |
| Overall quality (good+acceptable) | ~54% |

---

## 1. JS Handlers (run in-process, no LLM)

### ✅ watchdog — every 10m
- **Purpose**: Cancel sessions stuck running > 30min
- **Assessment**: Essential safety net. Zero visible catches in health-log (good — means agents aren't getting stuck much). Low cost (no LLM).
- **Verdict**: **KEEP** — insurance policy, costs nothing.

### ✅ evaluate-sessions — every 4h  
- **Purpose**: Find unevaluated sessions, skip trivial ones, run evaluator on the rest
- **Assessment**: 894 evals written (~500 skipped, ~364 scored). Evaluator is the highest-volume agent (223 sessions, 1.3 avg turns). Only 20 sessions currently unevaluated. Working well.
- **Issue**: 58% skip rate is fine — those are short/trivial sessions. But the eval handler spawns one evaluator session per session-to-evaluate, which is wasteful. Batch evaluation would be more efficient.
- **Verdict**: **KEEP** — core feedback loop. Consider batching.

### ✅ system-status — every 4h
- **Purpose**: Collect metrics, write health-log.md entry
- **Assessment**: Health log shows useful data — session counts, unevaluated backlog, tsc status, test results. Actually caught ⚠️ tsc failures and evaluation backlog.
- **Verdict**: **KEEP** — useful observability. Cheap.

### ✅ drain-todo — every 4h (× 5 agents: may, optimizer, amy, coach, scout)
- **Purpose**: Read agent's todo.md, delegate top item
- **Assessment**: 
  - Bob: 5 unchecked / 20 checked — working well (drained via heartbeat, no separate cron entry)
  - Amy: 12 unchecked / 5 checked — falling behind (items accumulate faster than drain)
  - Coach: 4 unchecked / 1 checked — slow
  - Scout: 6 unchecked / 5 checked — OK
  - May: 5 unchecked / 0 checked — nothing ever completes?
  - Optimizer: 0/0 — empty todo
- **Verdict**: **KEEP but watch** Amy's backlog.

### ✅ focus-task-tracker — every 8h
- **Purpose**: Check focus-tasks.md for stuck tasks, escalate
- **Assessment**: 2 tasks tracked (F1: lean heartbeats, F2: pattern recognition). New, no check history yet.
- **Verdict**: **KEEP** — newly created, give it time.

### ✅ daily-brief — every 24h (JS handler)
- **Purpose**: Generate daily metrics summary, emit to Telegram
- **Assessment**: Wired up this cycle (was dead code before). Running.
- **Verdict**: **KEEP** — provides daily summary.

---

## 2. Heartbeats (spawn LLM sessions)

### ✅ heartbeat (may) — every 30m
- **Purpose**: May captain heartbeat — health check, task follow-up, dispatch
- **Assessment**: Active. Now uses `--chat` mode properly (autoClose bug fixed).
- **Verdict**: **KEEP** — captain oversight loop.

### ⚠️ heartbeat-bob — every 2h (was 30m)
- **Purpose**: Bob design reflection, todo drain, philosophy
- **Assessment**: Quality 27% (worst agent). Avg 35 turns/session — very expensive. Reduced from 30m to 2h this cycle.
- **Track**: Did quality improve with lower frequency?
- **Verdict**: **KEEP at 2h** — monitor next review.

### ✅ heartbeat-optimizer — every 1d
- **Assessment**: Low volume, reasonable cadence.
- **Verdict**: **KEEP**

### ✅ heartbeat-coach — every 2d
- **Assessment**: Low frequency, low cost.
- **Verdict**: **KEEP**

### ✅ heartbeat-evaluator — every 1d
- **Assessment**: Evaluator quality 84%. Whatever it's doing works.
- **Verdict**: **KEEP**

### ⚠️ heartbeat-amy — every 12h
- **Assessment**: Amy quality 60%. Explore sessions use 32.5 avg turns — expensive.
- **Verdict**: **KEEP but watch** turn counts.

### ⚠️ heartbeat-scout — every 2d (was 1d)
- **Assessment**: Quality 44%, one heartbeat run used 39 turns. Reduced frequency.
- **Track**: Did quality improve?
- **Verdict**: **KEEP at 2d** — monitor.

---

## 3. Detached Jobs (spawn LLM sessions)

### ✅ analyze-failures — every 1d → bob
- **Assessment**: 5 runs, 7 avg turns. Bob analyzes eval patterns. All succeeded.
- **Verdict**: **KEEP** — drives the improvement loop.

### ⚠️ optimize — every 1d → optimizer  
- **Assessment**: 2 runs, 42.5 avg turns — expensive! Optimizer quality 29%.
- **Verdict**: **KEEP but needs turn budget**. Optimizer maxTurns is 40, still high.

### ✅ coaching — every 2d → coach
- **Assessment**: 6 runs, 18.3 avg turns. Coach quality 53%. maxTurns reduced 100→40.
- **Verdict**: **KEEP**

### ✅ lesson-consolidation — every 7d → bob
- **Assessment**: 4 runs, 5.5 avg turns. Cheap, useful for cleanup.
- **Verdict**: **KEEP**

### ❌ philosophy-check — every 1d → bob (DISABLED)
- **Assessment**: 3 historical runs, 3.3 avg turns. Low value — Bob's heartbeat already covers philosophy reflection. Duplicates work.
- **Verdict**: **RETIRED** — disabled 2026-03-22.

---

## 4. Workflows

### ✅ implement-and-review (may + optimizer)
- **Assessment**: 56 coder sessions + 37 QA sessions = most-used workflow. Coder quality 66%, QA quality 84%.
- **Verdict**: **KEEP** — core development workflow.

### ⏳ test-and-fix (may)
- **Assessment**: Low/no direct usage visible in history.
- **Verdict**: **EVALUATE next review** — if still unused, retire.

### ✅ design-review (optimizer)
- **Assessment**: 2 runs historically. Low usage but useful when needed.
- **Verdict**: **KEEP**

### ✅ implement-review (optimizer)
- **Assessment**: Used via optimizer's design-review workflow.
- **Verdict**: **KEEP**

---

## 5. Changes Applied

### Cycle 1 (2026-03-07)
| Change | Before | After | Rationale |
|--------|--------|-------|-----------|
| heartbeat-bob interval | 30m | 2h | 27% quality, 35 avg turns — worst ROI |
| heartbeat-scout interval | 1d | 2d | 44% quality, 39-turn sessions |
| health-check job | existed | removed | Duplicated system-status handler |
| bob-drain-todo | existed (disabled) | removed | Bob gets drained via heartbeat |
| daily-brief | dead code | wired up | Handler existed but had no cron entry |

### Cycle 2 (2026-03-22)
| Change | Before | After | Rationale |
|--------|--------|-------|-----------|
| philosophy-check | enabled | disabled | Low value, duplicates Bob's heartbeat |
| coach maxTurns | 100 | 40 | 43 avg turns, 53% quality — way too generous |

---

## 6. Remaining Action Items

### Short-term
1. **Check test-and-fix workflow** — is it called anywhere? If not, retire next review.
2. **Watch Amy todo backlog** — 12 unchecked items. Consider more frequent drain or stop over-producing items.
3. **Consider batch evaluation** — evaluator spawns 1 session per eval, could batch.

### Track (ongoing)
4. **Bob quality (27%)** — reduced heartbeat frequency; check if quality improves next review.
5. **Scout quality (44%)** — reduced frequency; track improvement.
6. **Optimizer quality (29%)** — maxTurns=40. Watch if this helps.
7. **May drain-todo** — only 1 historical run. Verify it actually fires.
8. **Evaluate coach maxTurns impact** — lowered 100→40, did it affect quality?

---

## 7. Review Cadence

This review should be re-run weekly. Key metrics to track:

- **Agent quality %** — are low performers improving?
- **Avg turns per heartbeat** — are heartbeats staying lean?
- **Todo drain rates** — are backlogs growing or shrinking?
- **New entries added** — are we adding jobs without retiring old ones?
- **Error rates** — any new job failures?

Next review: 2026-03-29
