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

### Iter 3 — 2026-04-18 — variant A topup + variant C (ownership + ⚠️)

**Scope**: (a) run 3 more variant-A trials to bring n to 10; (b) build
variant C = same scenario as A but stuck-requests line prefixed with ⚠️ and
tagged `(owner: may, target: 0)`; (c) run variant C n=10 on coder; (d) compare.

**Built**: `agents/gym/scenarios/metric-reaction-C/`
- Duplicated `metric-reaction/` and changed exactly one line in `task.md`:
  - A: `stuck-requests: 76, target: 0`
  - C: `⚠️ stuck-requests: 76 (owner: may, target: 0)`
- scenario.json `name` and `tags` updated; description notes the delta.
- Checker (`success_criteria.js`) unchanged — same pass condition.

**Ran**:
- Variant A topup (n=3): runIds 2580, 2581, 2582 — all FAIL.
- Variant C (n=10): runIds 2583–2592. One pass (2590).

**Results**:

| variant | pass | n  | rate | 95% CI (Wilson)          |
|---------|------|----|------|--------------------------|
| A       | 0    | 10 | 0%   | [0.0%, 27.8%]            |
| C       | 1    | 10 | 10%  | [1.8%, 40.4%]            |

Artifacts:
- `agents/coach/workspace/projects/metric-autonomy/variantA-topup-n3.jsonl` (raw runner footer lines)
- `agents/coach/workspace/projects/metric-autonomy/variantC-n10.jsonl`

Evidence in `.state/may.db` gym_runs:
- A topup: ids 2580–2582, scenario=`metric-reaction`, passed=0 for all.
- C: ids 2583–2592, scenario=`metric-reaction-C`, passed=1 only for id 2590.

**Reading**: Ownership + ⚠️ framing moves reaction rate from 0/10 → 1/10.
That is **not** the >30pp jump we pre-registered as a clear lever, and the
confidence intervals for A and C overlap heavily (both compatible with the
true rate being anywhere in ~0–30%). So C is **not** a lever on its own at
this scenario difficulty. The single pass (run 2590) is worth spot-checking
for what tipped it, but it's one observation — not a robust signal.

Takeaway: single-axis framing tweaks (ownership + warning marker) are
insufficient to override the default dispatch routine in coder. This matches
the /tmp/why-no-reaction.md hypothesis that **presentation alone is not the
bottleneck** — the agent follows numbered instructional steps regardless of
metric decoration. Next iter should either (a) combine framing axes (C+D:
ownership + suggested action) to test whether interactions matter, or (b)
test variant D (explicit suggested action) which is a stronger signal than
ownership, per hao's intuition. Variant E (position-first) is cheap and
remains on the list.

**Status**: Iter 3 DONE. C beats A by +10pp, not statistically meaningful
at n=10.

## Next (iter 4)

1. Spot-check run 2590 (the one C pass) to confirm it's a real metric
   reaction, not a grader false-positive.
2. Build variant D (explicit suggested action: `stuck-requests: 76 —
   query and clean them up`) and run n=10 on coder.
3. Build variant E (metric block as FIRST item in task.md, above the
   dispatch board) and run n=10 on coder.
4. If D and E both stay <30%, build a combined variant (C+D: ownership +
   suggested action) to test interaction. If any single variant ≥30%, stop
   and write up the lever.
5. Fix `gym-batch.sh` parser — still open, still worth a tech-lead task.

## Comments

<!-- Input, not instructions. Owner reads at start of each iteration and uses judgment. Format: [YYYY-MM-DD who] comment -->

- [2026-04-18 hao] try variant E first, it's the cheapest test
- [2026-04-18 hao-via-assistant] baseline 0/7 is a strong floor — if any variant reaches >30% that's a clear lever. Consider pairing variants (e.g. ownership + suggested action) once single-variant data is in; interactions may matter.
- [2026-04-18 assistant] gym-batch.sh parser bug is a real blocker for scale — worth filing as its own tech-lead task rather than a follow-up; the whole research program benefits.
- [2026-04-18 hao] Important finding: if presentation doesn't work, what does? Maybe the answer isn't in the metric injection at all. Maybe the agent needs to encounter the problem naturally during its own work — not be told about it. Think about: what if instead of injecting "stuck-requests: 76", the agent hits a stuck request while doing its normal work and realizes "there are a lot of these"? Discovery vs notification. Test that if D and E fail.
- [2026-04-18 hao] Key insight from watching the assistant work: when someone ASKS QUESTIONS about the system, they investigate and find problems. When given DATA, they note it and move on. Try a new variant: inject the metric as a QUESTION, not a statement. Instead of "stuck-requests: 76" try "Why do you have 76 stuck requests? What's going on?" or "You have 76 stuck requests — can you figure out why?" The question triggers investigation. The data point triggers noting. This might be the lever. Also try: what if the heartbeat starts with a question about the agent's own metrics instead of instructions? "What's the most important thing you should work on right now, based on your metrics?" — let the agent reason about it instead of being told.
