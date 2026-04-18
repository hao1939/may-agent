# Project: Metric Autonomy

**Status**: active
**Owner**: coach
**Reviewer**: may
**Master**: may/system-evolution (gap-3 / metric-reaction)
**Started**: 2026-04-18

## Goal

Find what makes agents notice and act on metric signals during heartbeats
**without** explicit instructions or mechanical triggers.

Observation (from `/tmp/why-no-reaction.md`): May sees `Stuck requests: 76` in
every heartbeat and does nothing. The priority ladder says "react to red
metrics" but numbered steps ("Step 1: read dispatch board") win every time.

Core question: is there a *presentation* of metrics that beats the default
routine, or do we need a mechanical trigger (metric breach → auto-project)?

## Hypothesis

Framing determines action. Specifically:

- H1: A bare number is ignored (baseline).
- H2: Ownership ("YOU own this") cuts through default routine.
- H3: Suggested action ("Query and clean them up") cuts through even more.
- H4: Position (metric as the FIRST thing in context) beats content framing.

## Experiment Design

Five presentation variants, each a gym scenario. Inject a red metric
(`stuck-requests: 76`, target 0) into a heartbeat context and measure whether
the agent acts on it vs follows its default todo routine.

- **A**: bare number — `stuck-requests: 76`
- **B**: number + implication — `stuck-requests: 76 — work is being lost`
- **C**: number + ownership — `YOU own this metric. 76 stuck requests.`
- **D**: number + suggested action — `76 stuck requests. Query and clean them up.`
- **E**: number as FIRST thing in context, before any other instructions

Test subject: **bob** (low stakes, diverse routine, not may — may's heartbeat
was just rewritten in commit 1c56b3f87 with "Step 1 = React to Red Metrics";
she'd bias the signal toward any framing).

Metric: per-variant pass rate across N trials.
Pass = agent takes a concrete action on the stuck-requests metric (queries DB,
forks/messages someone, mentions it in finish() completed_items).
Fail = agent follows default todo routine, never acts on the metric.

Checker: `agents/gym/scenarios/metric-autonomy-A/success_criteria.js`
(checks transcript for mentions + actions on "stuck-request").

## Success Criteria

- [ ] All 5 variants (A–E) built as gym scenarios
- [ ] Each variant run ≥10 trials → pass rate with confidence interval
- [ ] One finding landed as a KE: "framing X triggers metric reaction" OR "no
      framing triggers metric reaction without mechanical support"
- [ ] Finding fed back into heartbeat design recommendation for all agents

## Iteration Log

### Iter 1 — 2026-04-18 — build variant A + baseline

**Goal**: build the gym harness + run first baseline (variant A = bare number).

**Built**:
- `agents/gym/scenarios/metric-autonomy-A/` — scenario.json, task.md,
  injected_context.md (bare number), success_criteria.js, package.json
- Environment seeded with a clean `agents/bob/workspace/todo.md` (no pending
  items, so the routine option = "exit lean" — strongest competition against
  the metric signal).

**Ran**: 1 baseline trial, variant A, agent=bob, model=opus (runId 2562).

**Result**: **FAIL — agent ignored the metric entirely.**
- `metric-noticed`: FAIL ("Agent did not mention stuck-requests — signal ignored")
- `metric-acted-on`: FAIL ("no concrete action on it")
- `metric-prioritized`: FAIL ("stuck never referenced — cannot be prioritized")
- Checker summary: `"FAIL: agent ignored the metric entirely"`
- Gym DB row: `runId=2562, scenario=metric-autonomy-A, passed=false`.

**Reading**: this is the expected baseline — a bare number (`stuck-requests: 76`)
buried in a list of 4 metrics, with no ⚠️ marker, no ownership, no suggested
action, does not trigger reaction even when the default routine is "exit lean"
(todo is clean). This confirms the core observation from `/tmp/why-no-reaction.md`
on gym and establishes the baseline against which variants B–E will be compared.

**Status**: Iter 1 DONE. Variant A baseline = 0/1 pass. Need N≥10 for stable rate.

## Next

Run **2 more variant-A trials** to confirm baseline behavior, then build
variant C (ownership framing — the cheapest strong contrast to A) and run 10
trials on each via `scripts/gym-batch.sh --trials 10`. If C beats A by >30pp,
also build D and E. If A ≈ C ≈ 80%+, the scenario ceiling is too high — make
the default routine stronger (add a P1 pending task as bait) and re-baseline.

Concrete first command for iter 2:
`scripts/gym-batch.sh --scenarios metric-autonomy-A --trials 10 --agent bob`

---

### Iter 2 — 2026-04-18 — rebuild scenario + n=7 baseline (variant A, coder)

**Scope change**: rebuilt scenario under the name `metric-reaction` (simpler
single checker: "did the agent take a concrete action on the stuck-requests
metric?"). Agent = **coder** (not bob) because coder sessions are shorter and
cheaper for running N=10+ trials.

**Built**: `agents/gym/scenarios/metric-reaction/`
- scenario.json, task.md (heartbeat shape with metrics block),
  environment/stuck-requests.json, success_criteria.js (one check:
  reacted-to-stuck-requests), package.json.
- Variant A = bare number injected in a 4-metric block, no ⚠️ / ownership /
  action framing. Todo is empty, so the routine option is "exit lean".

**Ran**: 7 trials via direct `scripts/gym-run.sh` loop.
(`scripts/gym-batch.sh` parses the runner's stdout but gym-run.sh appends a
`{"recorded":...}` footer line that breaks the batch's JSON parser — filed
as follow-up, not blocking.)

**Result**: **0/7 reacted (0%, 95% CI ≈ 0–35%).**
All 7 trials FAIL the `reacted-to-stuck-requests` check. Spot-checked
`s_1776492305645_0` — coder picked an unrelated SOUL.md dedup task and
finished success, never referencing stuck-requests. This is genuine ignore
behavior, not a grader artifact.

Artifacts: `agents/coach/workspace/projects/metric-autonomy/baseline-variantA-coder-n7.jsonl`

**Reading**: baseline confirmed across a different agent (coder, n=7) and a
simpler checker. Variant A framing is effectively 0% even when the default
routine is weak (empty todo). This gives a strong floor for measuring
variants B–E — any intervention that moves reaction rate above ~30% is a
clear signal.

**Status**: Iter 2 DONE. Baseline = 0/7 on coder (variant A).

## Next (iter 3)

1. Run 3 more variant-A trials to reach n=10 (mechanical, confirms 0%).
2. Build **variant C** (ownership + ⚠️ framing) — smallest-change contrast:
   same number, but shown as `⚠️ stuck-requests: 76 (owner: may, target: 0)`.
   Run 10 trials. If >30% react, ownership is the lever. If still 0%,
   build variant D (explicit suggested action) and E (budget framing).
3. Fix `gym-batch.sh` parser (or add `--quiet` to gym-run.sh) so variant
   comparison can use the standard tool. File as a may follow-up task.
