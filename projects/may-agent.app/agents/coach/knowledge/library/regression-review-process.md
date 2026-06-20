# Periodic Regression Review Process

How graduated agents get checked for regressions after completing coaching.

## Problem

Currently we coach and forget. An agent passes 3 consecutive exercises, graduates, and is never re-tested. But agents can regress — model updates, domain.md changes, new tool patterns, or simply drifting behavior as context evolves. We need a lightweight process that catches regressions without wasting coaching budget on agents that are fine.

## Design Principles

1. **Cheap by default** — Most reviews should cost zero coaching sessions (passive signal)
2. **Escalate on evidence** — Only re-coach when concrete regression signal appears
3. **Reuse existing exercises** — Don't design new exercises for regression; replay graduation exercises
4. **Don't block feature work** — Regression reviews run during coaching windows, not during feature sprints

---

## Review Cadence

### Tier 1: Passive Monitoring (continuous, zero cost)

Every evaluation that runs through the normal evaluator pipeline is regression signal for free. Coach checks this data during planning phases.

**What to check:**
- Quality scores trending downward (3+ consecutive evaluations below agent's historical median)
- Efficiency scores dropping (e < 0.5 when agent's baseline is ≥ 0.7)
- Recurrence of a *previously coached* failure pattern (e.g., QA doing blind-overwrite again)
- Memory entries flagging the same issue type that coaching addressed

**When:** Coach reviews this passively whenever planning any coaching session. No dedicated session needed.

**Source data:**
```
ls -t .state/evaluations/ | head -20    # Recent evaluations
read .state/memory/<agent>.jsonl        # Memory patterns
```

### Tier 2: Scheduled Spot Check (every 2 weeks after graduation)

For each graduated agent, coach replays ONE exercise from the agent's graduation set. Pick the exercise that tested the agent's historically weakest area.

**What to run:**
- The exercise that the agent previously failed/partially passed before finally passing
- If all exercises were clean passes, pick the one testing the core competency for that agent's role

**Pass criteria:** Same as the original exercise. No interventions needed. Agent demonstrates the skill unprompted.

**Cadence:** First spot check 2 weeks after graduation. If passes: next check in 4 weeks. If passes again: move to Tier 3 (quarterly). This is a graduated cooldown — agents that keep passing get checked less often.

**Schedule tracking:** Add to COACHEES.md under a `## Graduated — Review Schedule` section:

```
| Agent  | Graduated | Last Review | Next Review | Review Exercise        | Streak |
|--------|-----------|-------------|-------------|------------------------|--------|
| Coder  | 2026-04-01| 2026-04-15  | 2026-05-13  | blind-overwrite replay | 2/2    |
```

### Tier 3: Quarterly Regression (steady state)

After an agent passes 2 consecutive Tier 2 spot checks, move to quarterly reviews. Same exercise, same criteria.

**What changes at Tier 3:**
- Review interval: every 12 weeks
- Exercise: still the same historically-weak exercise
- Can batch multiple agents into one coaching session window

**Exit from Tier 3:** Agent stays here indefinitely. There is no "fully exempt" tier — quarterly is the minimum.

---

## Regression Triggers (immediate re-coaching)

These events bypass the scheduled cadence and trigger immediate regression investigation:

### Automatic Triggers (from passive monitoring)

| Trigger | Threshold | Action |
|---------|-----------|--------|
| Quality score crash | q < 0.3 on 2+ consecutive evaluations (agent's baseline ≥ 0.6) | Re-run graduation exercise for the affected skill |
| Known-pattern recurrence | Evaluator or memory flags the exact failure pattern coaching fixed | Re-run the specific exercise that addressed this pattern |
| Capability level downgrade | Evidence suggests agent dropped a level (L2 → L1 behavior) | Full coaching session (not just spot check) |

### Manual Triggers (coach judgment)

| Trigger | Example | Action |
|---------|---------|--------|
| Domain.md changed | Optimizer rewrote agent's domain.md substantially | Spot check — does agent still follow coached behaviors? |
| Model swap | Agent moved from Sonnet to Opus, or vice versa | Full exercise battery — model change can reset learned patterns |
| New tool added | Agent gets a new tool that could interfere with coached patterns | Targeted exercise testing the interaction |
| Infra change | Docker mounts, state directories, tool paths changed | Smoke test before any coaching exercise |

---

## Re-coaching Protocol

When a regression is detected:

1. **Diagnose scope** — Is this a single-skill regression or broad degradation?
   - Single-skill: Re-run the relevant exercise only
   - Broad: Full coaching session with multiple exercises

2. **Reset pass streak** — Agent's consecutive pass count in COACHEES.md resets to 0/3

3. **Root cause classification** — Apply the MAST taxonomy:
   - **Agent** — Model behavior drifted; re-coaching the skill
   - **Design** — domain.md or tools changed; fix the design, then re-test
   - **Infra** — Environment broke; fix infra, then re-test

4. **Re-graduation path** — Same as original: 3 consecutive passes required. But use the *same exercises* — we're testing whether the regression is fixed, not introducing new challenges.

5. **Document in COACHEES.md** — Add to coaching history:
   ```
   - **2026-XX-XX** — Regression detected: [pattern]. Trigger: [source].
     Re-test result: PASS/FAIL. [Details.]
   ```

---

## Exercise Replay Mapping

Each agent's graduation exercises become their regression exercises. This table maps agents to their replay exercises.

| Agent | Core Weakness Tested | Regression Exercise | Exercise File | Graduated |
|-------|---------------------|---------------------|---------------|-----------|
| Coder | Pattern-based sed (not line-number) | Multi-file mixed edits, 6 edits across 3 files | `exercises/coder-regression/` (stage/revert scripts + .bak backups) | 2026-03-24 |
| Scout | Dedup, path accuracy, failure reporting | Multi-source research with constrained budget | `exercises/scout-graduation-retest.md` | 2026-03-09 |
| QA | write() avoidance, sed for fixes | Multi-file event service (3 files, 2 planted bugs) | `exercises/qa-truncation-test/` | 2026-03-10 |
| May | subagents.run (not delegate), self-execute simple tasks | Multi-step dispatch + self-execution + follow-through | Graduation re-test prompt (see session report) | 2026-03-10 |
| Amy-Kimi | Write safety under multi-file pressure | Cross-archive synthesis, append to 3 files | `exercises/amy-graduation/` | 2026-03-10 |
| Tech-Lead | Scope control, self-execute vs delegate judgment | Multi-module implementation from design spec | Tech-lead regression exercise files (session-cleanup) | 2026-03-10 |
| Amy | Write safety internalization (no explicit instruction) | Strategic intelligence report, append to 2 files | `exercises/amy-graduation/` | 2026-03-10 |
| Optimizer | Bug detection, surgical fix, pattern learning | Session-quality-monitor bug fix (unsorted data) | `exercises/optimizer-graduation/` | 2026-03-10 |
| Evaluator | Truncation distinction, blame attribution, tool awareness | 7-session task tree with all edge cases | `exercises/evaluator-graduation/` | 2026-03-10 |
| Master | Exec guard circumvention, excessive exploration | Replay: efficiency exercise (≤2 CLI calls) | TBD (infra-blocked, not graduated) |
| Bob | Execution discipline, file existence checking | TBD | TBD (model-limited, not graduated) |

### Priority Order for Regression Reviews

When multiple agents need review in the same window, prioritize by production impact:

1. **Evaluator** — Multiplier effect: evaluation accuracy affects all agents' scores
2. **May** — Supervisor: routing errors cascade to downstream agents
3. **Tech-Lead** — Builder lead: orchestrates coder+QA, high session volume
4. **Optimizer** — System health: had worst pre-fix failure rate (47%), regression risk highest
5. **Coder** — Core builder: highest session volume
6. **QA** — Quality gate: sed regression → blind overwrites in production
7. **Scout** — Research: lower frequency, isolated impact
8. **Amy / Amy-Kimi** — Intelligence: lower frequency, write safety is main risk

---

## Cost Budget

Regression reviews should not consume more than **20% of coaching capacity** in any given period. If more than 2 agents regress simultaneously, triage by:

1. Agents actively running feature work (highest priority — regression affects real output)
2. Agents with the worst regression signal (lowest quality scores)
3. Agents that regressed on the most critical skill (blind-overwrite > efficiency)

---

## Implementation Checklist

- [x] Add `## Graduated — Review Schedule` section to COACHEES.md → Created as `regression-review-schedule.md` (2026-03-10, heartbeat #46)
- [x] Set the first Tier 2 review date (graduation date + 2 weeks) → All 9 agents scheduled
- [x] Record which exercise is the regression exercise for that agent → Exercise Replay Mapping table complete
- [x] Add a reminder to coach's todo.md for the review date → Regression review items already in todo.md

---

*Created: 2026-03-22. Process version 1.0.*
*Review this process itself after 3 regression reviews have been conducted — is the cadence right? Are the triggers catching real regressions?*
