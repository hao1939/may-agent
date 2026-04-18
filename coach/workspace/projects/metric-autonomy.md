# Project: Metric Autonomy

**Status**: done
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

### Iter 4 — 2026-04-18 — variant D (suggested action) + variant E (position-first)

**Scope**: (a) spot-check run 2590 (C's one pass); (b) build D = A with an
explicit suggested-action phrase appended to the metric line (`… — query and
clean them up`); (c) build E = A with the entire metrics block moved to the
TOP of task.md, before any heading or steps; (d) run n=10 each on coder.

**Built**:
- `agents/gym/scenarios/metric-reaction-D/` — `cp -r` of `metric-reaction/`
  with exactly one edit to `task.md` line 8:
  - A: `stuck-requests: 76, target: 0`
  - D: `stuck-requests: 76, target: 0 — query and clean them up`
  - scenario.json `name`/`tags`/`description` updated. Checker unchanged.
- `agents/gym/scenarios/metric-reaction-E/` — `cp -r` of `metric-reaction/`
  with `task.md` restructured so the metrics block is the first thing in the
  file, above the `# Heartbeat Cycle` heading and above the dispatch board.
  Metric line text is identical to variant A. scenario.json updated.

**Spot-check of run 2590 (C's lone pass)**: Could not locate the transcript.
`gym_runs.transcript` is NULL for all ids 2580–2592 in `.state/may.db`, and
session `s_1776495490514_0` is not present in `.state/sessions/` or
`.state/sessions/history/` (checked with `find` and `grep`). Mitigation:
the checker is deterministic tool-call-based (see
`agents/gym/scenarios/metric-reaction/success_criteria.js` — it requires an
actual `bash`/`read`/`agents`/file-tool call whose args match `/stuck/i`, or
`finish()` summary citing `stuck` + `76`). It cannot pass on "agent
mentioned the metric in prose"; it only passes on a concrete tool action.
False-positive risk is therefore low. Noting as a gap (transcript retention
would let us spot-check in future iters) rather than a blocker — filing as
follow-up.

**Ran**:
- Variant D (n=10): runIds 2593–2602. One pass (2599).
- Variant E (n=10): runIds 2603–2612. Zero passes.

Grouped verification (SQL on `.state/may.db`, id > 2592):

```
metric-reaction-D: passed=1, n=10
metric-reaction-E: passed=0, n=10
```

**Results table (all variants, n=10 each on coder)**:

| variant | lever                              | pass | n  | rate | 95% CI (Wilson) |
|---------|-------------------------------------|------|----|------|-----------------|
| A       | bare number                         | 0    | 10 | 0%   | [0.0%, 27.8%]   |
| C       | ⚠️ + ownership tag                  | 1    | 10 | 10%  | [1.8%, 40.4%]   |
| D       | suggested action appended           | 1    | 10 | 10%  | [1.8%, 40.4%]   |
| E       | metric block at TOP of task.md      | 0    | 10 | 0%   | [0.0%, 27.8%]   |

Artifacts:
- `agents/coach/workspace/projects/metric-autonomy/variantD-n10.jsonl`
- `agents/coach/workspace/projects/metric-autonomy/variantE-n10.jsonl`

**Reading**: None of the single-axis framing tweaks (ownership+⚠️,
suggested-action, position-first) move the reaction rate meaningfully above
the 0% baseline. All three point estimates sit within each other's 95% CIs
and well below the pre-registered 30% "clear lever" threshold. Notable: E
(position-first) produced 0/10, same as baseline — putting the metric at the
very top of the context is *not* sufficient to displace the numbered-step
routine. This is consistent with the `/tmp/why-no-reaction.md` hypothesis
that the bottleneck is **not presentation** but that the agent commits to
the numbered-step plan the moment it sees one, regardless of what surrounds
it. Statement-style framing (A/C/D/E) all behave like the baseline.

**Status**: Iter 4 DONE. D=1/10, E=0/10. Neither clears the lever threshold.
Four single-axis presentation variants tested; none work.

## Next (iter 5)

Pivot away from statement-style presentation. Per hao's 2026-04-18 comments,
test **question-framing** and **discovery** — variants that force the agent
to *reason about* its metrics or *encounter* the problem, rather than be
told about it.

1. **Variant F (question-framing)**: replace the metric line with a question,
   e.g. `Why do you have 76 stuck requests? What's going on?` — hypothesis:
   questions trigger investigation, data points trigger noting.
2. **Variant G (heartbeat-opens-with-question)**: replace the first step
   with `What's the most important thing you should work on right now,
   based on your metrics?` before the dispatch-board step. Hypothesis:
   asking the agent to reason about priorities routes around the
   numbered-step autopilot.
3. **Variant H (discovery, cheapest sketch first)**: agent's todo contains
   a task that naturally requires looking at request data; if while doing
   that task the agent notices 76 stuck ones, does it react? Defer if F/G
   show signal — scenario is more expensive to build.
4. If F or G clears 30%, stop and write up the question-framing lever as
   a candidate KE + heartbeat recommendation.

Follow-ups (not blocking iter 5):
- **Transcript retention gap**: `gym_runs.transcript` is NULL for recent
  runs; can't spot-check passes. File a tech-lead request to either store
  transcript in `gym_runs` or keep the session directory (don't delete
  `s_<gym-session>` after run). Without this, false-positive auditing is
  impossible.
- `gym-batch.sh` parser bug — still open.

## Comments

<!-- Input, not instructions. Owner reads at start of each iteration and uses judgment. Format: [YYYY-MM-DD who] comment -->

- [2026-04-18 hao] try variant E first, it's the cheapest test
- [2026-04-18 hao-via-assistant] baseline 0/7 is a strong floor — if any variant reaches >30% that's a clear lever. Consider pairing variants (e.g. ownership + suggested action) once single-variant data is in; interactions may matter.
- [2026-04-18 assistant] gym-batch.sh parser bug is a real blocker for scale — worth filing as its own tech-lead task rather than a follow-up; the whole research program benefits.
- [2026-04-18 hao] Important finding: if presentation doesn't work, what does? Maybe the answer isn't in the metric injection at all. Maybe the agent needs to encounter the problem naturally during its own work — not be told about it. Think about: what if instead of injecting "stuck-requests: 76", the agent hits a stuck request while doing its normal work and realizes "there are a lot of these"? Discovery vs notification. Test that if D and E fail.
- [2026-04-18 hao] Key insight from watching the assistant work: when someone ASKS QUESTIONS about the system, they investigate and find problems. When given DATA, they note it and move on. Try a new variant: inject the metric as a QUESTION, not a statement. Instead of "stuck-requests: 76" try "Why do you have 76 stuck requests? What's going on?" or "You have 76 stuck requests — can you figure out why?" The question triggers investigation. The data point triggers noting. This might be the lever. Also try: what if the heartbeat starts with a question about the agent's own metrics instead of instructions? "What's the most important thing you should work on right now, based on your metrics?" — let the agent reason about it instead of being told.
- [2026-04-18 hao] Meta-observation: this project itself demonstrates the problem. Coach runs one-shot sessions per iteration instead of using workflow.run("persistent-task"). Common-sense.md says to use persistent-task for multi-session work. Coach reads it and doesn't do it. Same pattern as agents reading metrics and not acting. Maybe the answer is the same for both — it's not about what agents are TOLD, it's about what they naturally DO. The question-framing hypothesis might apply here too: instead of "use persistent-task for multi-session work" (instruction), what about "this project has 5+ iterations — how will you keep it running without stopping?" (question that forces reasoning about the approach).

### Iteration 1 — 2026-04-18T08:06:39.562Z
**Worker task**: Iteration 1 — work toward goal
**Worker result**: **Status:** done (11m24s)

**Files modified:**
- agents/gym/scenarios/metric-reaction-F/task.md
- agents/gym/scenarios/metric-reaction-G/task.md
- agents/gym/scenarios/metric-reaction-F/scenario.json
- agents/gym/scenarios/metric-reaction-G/scenario.json

**Files read (not modified):**
- agents/coach/workspace/projects/metric-autonomy.md

**Errors encountered:**
- [bash] 8c8
< stuck-requests: 76, target: 0
---
> Why do you have 76 stuck requests? What's going on? (target: 0)
---
23,25c23,26
< 1. Read the dispatch board items above.
< 2. Pick ONE item and produce a short (3–5 line) write-up for it in `triage-note.md`.
< 3. Call `finish()` with a summary of what you d
- [edit] Could not find the exact text in agents/coach/workspace/projects/metric-autonomy.md. The old text must match exactly including all whitespace and newlines.
- [bash] (no output)

Command exited with code 1
- [bash] The following paths are ignored by one of your .gitignore files:
coach/workspace/projects
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"


Command exited with code 1

**Agent response:**
The prior session already added a caveat noting the confound (my G has step 3 also modified, not just step 1). Good — they caught my mistake. Let me accept that caveat and commit:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — auto (review skipped)


### Iteration 2 — 2026-04-18T08:16:08.184Z
**Worker task**: Iteration 2 — work toward goal
**Worker result**: **Status:** interrupted (9m28s)

**Files read (not modified):**
- agents/coach/workspace/projects/metric-autonomy.md

**Errors encountered:**
- [bash] agents/gym/scenarios/metric-reaction-F/:
environment
package.json
scenario.json
success_criteria.js
task.md

agents/gym/scenarios/metric-reaction-G/:
environment
package.json
scenario.json
success_criteria.js
task.md
---F task.md---
8c8
< stuck-requests: 76, target: 0
---
> Why do you have 76 stuck 
- [edit] Could not find the exact text in agents/coach/workspace/projects/metric-autonomy.md. The old text must match exactly including all whitespace and newlines.
- [bash] (no output)

Command exited with code 1
- [bash] Command aborted

**Agent response:**
Prior session wrote Iter 5 already. My runs (2652-2671) are topup data. Let me add Iter 6 with my topup + build the de-confounded G′.
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — — G is 30/30 (massive signal) and F is 6/29 (~21%). Two success criteria remain unchecked:

1. **KE entry not written yet** — need a KE (e.g. KE-190) documenting the question-framing lever: "Replacing numbered instructions with a reasoning question ('What's the most important thing to work on based on your metrics?') raises metric-reaction rate from 0% to 100%. Statement-style framing variants (bare number, ownership, suggested action, position-first) all ≈0-10%."

2. **Heartbeat design recommendation not written** — the finding needs to feed back into a concrete recommendation for all agents' heartbeat design.

3. **G confound** — the worker noted G modified step 3 as well as step 1. A de-confounded G′ (only step 1 changed) was in progress but interrupted. This is important for the KE to be credible — either run G′ to confirm, or note the confound explicitly in the KE with the caveat.

**Next iteration should**: (a) build and run G′ (de-confounded, only step 1 changed) for n=10, (b) if G′ still passes at high rate, write the KE entry, (c) write the heartbeat design recommendation. If G′ also passes strongly, all 4 success criteria can be checked off and the project can be marked DONE.


### Iteration 3 — 2026-04-18T08:27:54.303Z
**Worker task**: Iteration 3 — work toward goal
**Worker result**: **Status:** done (9m7s)

**Files modified:**
- agents/shared/knowledge/entries/KE-215-question-framing-triggers-metric-reaction.md

**Files read (not modified):**
- agents/coach/workspace/projects/metric-autonomy.md

**Errors encountered:**
- [bash] 25c25
< 3. Pick ONE item (or a metric-driven action, if that's more important) and produce a short (3–5 line) write-up for it in `triage-note.md`.
---
> 3. Pick ONE item and produce a short (3–5 line) write-up for it in `triage-note.md`.


Command exited with code 1

**Agent response:**
Now commit:
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — — KE-215 was written, but two items still need verification/completion:

1. **Verify KE-215 actually exists and has good content** — the worker said "Now commit:" but the session ended. Check if the file is on disk and committed.

2. **Heartbeat design recommendation** — the goal says "Answer feeds into heartbeat design for all agents." A KE entry documents the finding, but there should be a concrete recommendation written into the project log or a actionable next-step for applying question-framing to real heartbeats.

3. **G′ de-confound status** — was G′ (step-1-only change) ever run? If not, the KE should at minimum note the confound caveat clearly.

**Next iteration should**: (a) verify KE-215 is committed and well-written, (b) check if G′ was run or if the confound is noted in the KE, (c) write the heartbeat design recommendation (can be a section in the project log or a note in the KE), (d) mark project DONE if all criteria met.


### Iteration 4 — 2026-04-18T08:28:44.608Z
**Worker task**: Iteration 4 — work toward goal
**Worker result**: **Status:** done (42s)

**Agent response:**
KE-215 is excellent — committed, includes G′ 10/10 de-confound, and has a clear Application section with heartbeat design recommendations. Now I need to: (1) check off success criteria, (2) mark project DONE.
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — The working copy has regressed the file back to "active" with unchecked criteria — this is from a stale session. The committed version (bcfe94e38) is correct. I need to restore it.


### Iteration 5 — 2026-04-18T08:29:57.848Z
**Worker task**: Iteration 5 — work toward goal
**Worker result**: **Status:** done (41s)

**Errors encountered:**
- [bash] # Project: Metric Autonomy

**Status**: DONE
**Owner**: coach
**Reviewer**: may
The following paths are ignored by one of your .gitignore files:
coach/workspace/projects
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"
- [bash] On branch review/common-sense-audit-fix-s_1776493920060_943
Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   coach/ERROR_LOG.jsonl
	modified:   coach/last-session.md
	modif

**Agent response:**
Everything is already in place — project is DONE, KE-215 exists and is committed.
**Files touched**: (see worker session)
**Owner assessment**: DONE — — Project is complete. KE-215 is committed (bcfe94e38) with G′ 10/10 de-confound evidence and heartbeat design recommendations. The key finding: question-framing (variant G) moves metric reaction rate from 0% baseline to 100%, and this holds even with the de-confounded G′ (step-1-only change, 10/10). The project file is marked DONE in the committed version.

