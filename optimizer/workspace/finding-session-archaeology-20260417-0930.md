# Finding: Session Archaeology — Coach EXP-156 (143 ops) & Tech-Lead Lens C (82 ops)

**Date**: 2026-04-17
**Author**: Optimizer (Mode A: Session Archaeology)
**Status**: COMPLETE
**Scope**: two 3-6× median sessions in last 6h

---

## TL;DR

| Session | Classification | Action |
|---|---|---|
| coach s_1776399785799_320 (143 ops, EXP-156) | **Known pattern** — gym-heavy experiment. Delivered results.md with clean +90pp signal. Cost floor is structural. | **No new action.** Already covered by 2026-04-12 scouting finding. |
| tech-lead s_1776398501274_313 (82 ops, Lens C cron) | **New/actionable** — scope violation (37 cron entries × 32 handlers >> the heartbeat's "≤3 files" pre-dispatch check) **AND no deliverable was written**. 82 ops of pure waste. | **Actionable.** Dispatch to tech-lead: either shrink lens scope or enforce the pre-dispatch check in the lens-analysis workflow. |

---

## 1. Coach EXP-156 (143 ops) — Known Pattern

**Task**: EXP-156 Hard Gate Generalization, 4 phases (create 2 scenarios, baseline 20 runs, treatment ~16 runs, analyze).

**Op-to-work accounting** (derived from `gym_runs` timestamps during session window 04:23Z–05:33Z):
- **43 gym runs** in window: 17 baseline misleading-test-fix + 10 baseline context-drift + 10 treatment misleading + 6 treatment context-drift.
- At ~2.5–3 ops per gym run (invoke + check) = **~110–130 ops** just for gym execution.
- Plus ~10–15 ops for scenario creation (2 treatment forks with success_criteria.js), ~5–10 for analysis & write-up.
- **Total accounted: ~130–150 ops. 143 is on-budget for this workload.**

**Deliverable verified**: `agents/shared/knowledge/experiments/EXP-156/results.md` exists with Fisher's exact p<0.001 finding (+90pp on misleading-test-fix). Verdict "good", quality 0.75.

**Matches existing finding**: `agents/optimizer/workspace/finding-coach-experiment-cost-scouting-0412.md` already established:
> "The cost variance is almost entirely explained by **experiment type**, not execution efficiency. Gym-based experiments are inherently expensive (N×overhead per run)."
> "10-run pilot has a floor of 70–90 ops."

EXP-156 ran ~43 runs → 143-op floor is consistent.

**Verdict**: **Accepted cost. No new action.** Hypothesis from task (gym-run proliferation like EXP-144) confirmed, but the value (generalizable hard-gate evidence) justifies the cost. The 0412 finding's recommendation (batch evaluation in a single script) does not apply here — these are real treatment runs, not re-evaluations.

---

## 2. Tech-Lead Lens C Cron Dead-Weight (82 ops) — Actionable

**Task** (from DB): "Lens C: Dead Weight — Unused or redundant cron handlers. Read `agents/may/cron.json`, for each handler check if it does real work. Write to `agents/tech-lead/workspace/finding-cron-dead-weight.md`."

**Scope reality**:
- `agents/may/cron.json`: **45 entries, 37 distinct handlers** (`jq '.[]|.handler' | sort -u | wc -l`).
- `agents/may/handlers/`: **32 .ts handler files**.
- Task literally says "for each handler... read the handler file" → ≥37 reads minimum before any analysis.

**Heartbeat pre-dispatch scope check** (from `agents/tech-lead/heartbeat.md`):
> "Before dispatching a Lens session, verify: [ ] Target is ≤3 files."

This task **violates the ≤3 files rule by >10×**. The dispatch should not have happened as-is.

**Deliverable status**: **MISSING.** The promised file `agents/tech-lead/workspace/finding-cron-dead-weight.md` does not exist (`ls` → No such file or directory; `find agents -name finding-cron-dead-weight.md` → empty). No archived version either. The session ran 82 ops, was evaluated "good" quality=1.0 (heuristic only — note: evaluator's tier-1 heuristic is known to be lenient per KE tech-lead findings), **and produced no artifact the task asked for**.

This is a double failure:
1. **Scope violation bypassed the pre-dispatch check** (self-enforced text rule; tech-lead didn't apply it).
2. **The `lens-analysis` workflow claims to "verify the deliverable exists"** (heartbeat.md line: "Embeds D-o-R phases + verifies deliverable") — yet the deliverable is absent and no error surfaced. Either the verification is not working, or this session didn't actually go through the workflow (session has `workflowRunId=NULL`, confirming it was dispatched without the workflow — another rule violation).

**Root cause classification**: **New pattern** (not in any prior finding I can locate). Two compounding gaps:
- **Gap A**: The "≤3 files" scope check is advisory text in heartbeat.md; nothing enforces it at fork time.
- **Gap B**: `lens-analysis` workflow's deliverable-verification step is either missing or was skipped because the session bypassed the workflow (raw `agents.fork` or `callAgent`, not `workflow.run`).

**One concrete recommendation** (pick A or B; A is simpler):

**Option A (recommended, low-cost)**: Tighten the Lens C rotation in `agents/tech-lead/heartbeat.md` to require per-subsystem scoping. Replace:
> "Lens C: Dead Weight — Config nobody reads, protocols nobody follows..."

with:
> "Lens C: Dead Weight — pick ONE subsystem/file (e.g., `agents/may/handlers/<single-handler>.ts`, OR a single config section). If the target has >3 files, split into multiple sessions. Do NOT dispatch 'all cron handlers' as one session."

Plus add a concrete example of a split: "cron dead-weight" → 5 sessions of ~7 handlers each, or 1 session per handler category (auto-commit/session-sync/digest/etc.).

**Option B (more work)**: Add a fork-time check in the `lens-analysis` workflow that parses the task string for "all X handlers", "every Y", "each Z" patterns and requires an explicit file count ≤ N before proceeding. Higher lift, better enforcement.

---

## Dispatches

1. **To tech-lead** (Option A): heartbeat.md Lens C wording update + verify the 82-op session that should have produced `finding-cron-dead-weight.md` but didn't. See dispatch below.

No dispatch for coach — EXP-156 is accepted cost, already covered.

---

## Evidence Appendix

- Sessions pulled via `bun:sqlite` from `.state/may.db` `sessions` + `evaluations` tables.
- Gym-run accounting: `SELECT COUNT(*) FROM gym_runs WHERE timestamp BETWEEN '2026-04-17 04:20' AND '2026-04-17 05:40'` → 43 rows, all for coach's EXP-156 scenarios.
- Tech-lead Lens C deliverable absence: `ls agents/tech-lead/workspace/finding-cron-dead-weight.md` → "No such file or directory"; `find agents -name "finding-cron-dead-weight.md"` → empty.
- Tech-lead session workflowRunId NULL, confirming no workflow verification ran.
- `jq 'length' agents/may/cron.json` = 45; `jq '.[]|.handler' | sort -u | wc -l` = 37; `ls agents/may/handlers/*.ts | wc -l` = 32.
