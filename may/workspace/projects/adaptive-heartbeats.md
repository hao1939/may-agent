# Adaptive Heartbeats

**Owner:** may
**Goal:** When an agent wakes with no assigned task, it should do something autonomous and useful — not exit fast. Idle heartbeats are the system's *exploration budget*.
**Created:** 2026-04-16
**Updated:** 2026-04-17 (reframed per Hao)
**Status:** Active
**Master project:** [system-evolution.md](./system-evolution.md) → Gap 4
**Source feedback:** [scout](../../scout/workspace/system-gaps.md), [coach](../../coach/workspace/system-gaps.md)
**Tracked metrics:** `system.agent-utilization`, `system.request-throughput`

> **Framing correction (Hao, 2026-04-17):**
> "Heartbeats is by design for agent to explore and try. It's OK to waste tokens as long as it provides chance for agent to be autonomous."
>
> An earlier version of this project treated idle heartbeats as overhead to minimize and proposed a "fast exit" gate. That framing is **wrong** and has been replaced. Exiting fast in 2 ops when nothing is assigned is the failure, not the fix. The failure mode is agents waking up and *doing nothing*, not agents waking up and burning tokens to explore.

## Why
Heartbeats are an exploration budget. If an agent wakes and there's no assigned work, it should pick from a prioritized list of autonomous options — probe a metric, work a system-gap, test a hypothesis, clean workspace, investigate a stale project, read a paper, draft a KE. Tokens spent on autonomous exploration are cheap relative to a missed opportunity to catch a bug, notice drift, or push an improvement forward.

The real failure modes this project addresses:
1. **Idle-exit failures** — agent wakes with no assigned task, does ≤2 ops, exits. That's a wasted chance at autonomy.
2. **Correctness-level waste** — scout polling arXiv between windows (no new data possible). This is about correctness (can't find what isn't there), not about idleness.
3. **Load management** — system-wide cron density should scale with active work, so heartbeat storms don't mask signal or spike ops during quiet hours.

## Milestones

- [ ] **Idle heartbeat playbook** — When an agent wakes with no assigned task and no failing health check, it consults a prioritized exploration list:
  1. Pick the highest-impact item from its own `system-gaps.md`
  2. Poke a metric that looks off / stale / regressing
  3. Work a dropped thread from the project files (stalled owner, blocked sub-task)
  4. Test an outstanding hypothesis from `workspace/hypotheses/` (if any)
  5. Clean workspace / archive stale artifacts / tighten own tooling
  6. Read something new (paper, KE, peer's recent report) and draft a follow-up
  Deliverable: per-agent heartbeat prompt updated to include this playbook + an explicit "don't just exit" rule. Evidence: ≥X% of idle heartbeats produce a measurable artifact (file written, request created, KE drafted).

- [ ] **Scout: skip heartbeats between arXiv windows** — Correctness concern. arXiv publishes on a known schedule; polling between windows cannot find new work. Scout's cron should align to arXiv windows, or the scout heartbeat should fast-path to the idle-exploration playbook between windows instead of re-polling.

- [ ] **Adaptive frequency (load management)** — Run heartbeats denser during active periods (Hao online, fresh dispatches, active gym batches), sparser during quiet hours. This is about matching system load to available signal, *not* about saving ops. May controls cron intervals dynamically. Idle-but-alive heartbeats still run; they just don't run as densely when nobody's around to consume output.

## Non-Goals
- Do **not** add a generic "nothing to do → exit" gate to heartbeats. That inverts the design.
- Do **not** measure success by "reduced ops per idle heartbeat." Measure by useful-artifact-per-idle-heartbeat.

## Progress Log
<!-- Append entries as milestones are completed -->

### 2026-04-17 — Reframe
Hao corrected the framing: heartbeats are exploration budget, not overhead. The prior design doc at `agents/shared/may-agent-docs/design/adaptive-heartbeats.md` leaned on a "fast-exit gate" as Phase 1 — that phase is now killed. Milestone 1 is replaced with the Idle Heartbeat Playbook. Milestone 2 (arXiv windowing) retained as a correctness concern. Milestone 3 (adaptive frequency) retained but reframed from "save ops" to "match load."

Prior iteration-1/iteration-2 logs from 2026-04-16 described a completed design doc built around the wrong framing. That doc is now superseded; any Phase 1 deploy based on it is on hold until the playbook milestone is designed against the corrected framing.

### Iteration 1 — 2026-04-16T12:38:05.252Z (SUPERSEDED)
Produced design doc at `agents/shared/may-agent-docs/design/adaptive-heartbeats.md` centered on a fast-exit gate. Retained for historical reference only; do not deploy Phase 1 from it.

### Iteration 2 — 2026-04-16T13:22:32.362Z (SUPERSEDED)
Declared the fast-exit design "done, ready for Phase 1 deploy." Not valid under the reframe; design must be redone against the Idle Heartbeat Playbook milestone.

### 2026-04-17 13:28 — Re-dispatch against reframed milestones
May forked bob (session `s_1776432499606_299`, request `af9508b1`) to run persistent-task on this project under the corrected framing. Task: draft the Idle Heartbeat Playbook (Milestone 1) and get review before rolling out to per-agent heartbeat.md files. Non-goals and "no fast-exit gate" rule explicitly reinforced in the dispatch.

### Iteration 3 — 2026-04-17T13:32:02.204Z
**Worker task**: Iteration 3 — work toward goal
**Worker result**: **Status:** done (2m58s)

**Files modified:**
- agents/shared/may-agent-docs/design/idle-heartbeat-playbook.md

**Files read (not modified):**
- agents/may/workspace/projects/adaptive-heartbeats.md
- agents/shared/may-agent-docs/design/adaptive-heartbeats.md
- agents/bob/heartbeat.md

**Errors encountered:**
- [bash] The following paths are ignored by one of your .gitignore files:
may/workspace/projects
hint: Use -f if you really want to add them.
hint: Turn this message off by running
hint: "git config advice.addIgnoredFile false"


Command exited with code 1
- [bash] On branch main
Your branch is ahead of 'k3s/main' by 53 commits.
  (use "git push" to publish your local commits)

Changes not staged for commit:
  (use "git add <file>..." to update what will be committed)
  (use "git restore <file>..." to discard changes in working directory)
	modified:   may/last
- [bash] On branch main
Your branch is up to date with 'k3s/main'.

nothing to commit, working tree clean


Command exited with code 1

**Agent response:**
All three changes verified on disk. Now finish — not resurrecting fast-exit, not rolling out to heartbeats (review-gated per task instructions "get review before rolling out").
**Files touched**: (see worker session)
**Owner assessment**: CONTINUE — Iteration 3 delivered a solid design draft for the Idle Heartbeat Playbook at `agents/shared/may-agent-docs/design/idle-heartbeat-playbook.md` (127 lines, verified on disk). The worker correctly did NOT resurrect the fast-exit gate and correctly gated rollout on review. Good stop.

**Review verdict: Design APPROVED with minor answers to the open questions. Proceed to rollout in the next iteration.**

Answers to the 4 open questions (use these, don't re-litigate):
1. **idle-log.md one-liner counts as artifact** — yes, keep the <10% guardrail. Don't force real work; the point is exploration budget, not make-work.
2. **Tailoring** — centrally drafted 2-line addition (bob writes), per-agent owners can add their own tailoring below later. Don't block rollout on per-agent review — make it opt-out not opt-in.
3. **Metric** — May will build the query post-rollout. Not a blocker for deploying. Just add a TODO to `agents/may/workspace/projects/adaptive-heartbeats.md` for the idle-artifact metric.
4. **Enforcement** — norm-only for M1. Revisit after 1 week of data. Agreed.

**Next iteration (Milestone 1 completion) — concrete steps:**
1. Create `agents/shared/protocols/idle-playbook.md` with the rule + 6-item list verbatim from the design.
2. Add the 2-line snippet to the end of Step 2 (DECIDE) in each of the 12 agents' `heartbeat.md`. Use `edit()` for each (not `write()`), preceded by `read()` per C1.1. Respect KE-008 — content addition only, no reordering.
3. Commit in `agents/` repo with a clear message referencing the design doc.
4. Update project file milestone 1 checkbox to `[x]`.
5. Then move to M2 (scout arXiv windowing) — investigate scout's current cron schedule and arXiv publication windows before designing.

**Process feedback for worker:**
- Good: read-before-edit, stopped for review, did not resurrect superseded design.
- Minor: the two git errors (gitignored path add, "up to date" on an unrelated dir) were harmless but noisy — next iteration, `cd agents/` before git ops to avoid the .gitignore conflict.

Do not combine M1 rollout with M3 (adaptive frequency) — KE-123 stacking penalty applies.

