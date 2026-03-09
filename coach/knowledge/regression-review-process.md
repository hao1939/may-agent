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

Each agent's graduation exercises become their regression exercises. This table maps agents to their replay exercises (to be filled as agents graduate):

| Agent | Core Weakness Tested | Regression Exercise | Exercise File |
|-------|---------------------|---------------------|---------------|
| Coder | Blind-overwrite | Replay: surgical edit in large file | `exercises/coder-blind-overwrite-exercise.md` |
| QA | Blind-overwrite via write() after truncated read | Replay: truncated-read + write scenario | `exercises/qa-truncated-read-exercise.md` |
| Master | Exec guard circumvention, excessive exploration | Replay: efficiency exercise (≤2 CLI calls) | TBD (not yet created) |
| Bob | Execution discipline during consolidation | TBD | TBD |

*Other agents added to this table as they enter and complete coaching.*

---

## Cost Budget

Regression reviews should not consume more than **20% of coaching capacity** in any given period. If more than 2 agents regress simultaneously, triage by:

1. Agents actively running feature work (highest priority — regression affects real output)
2. Agents with the worst regression signal (lowest quality scores)
3. Agents that regressed on the most critical skill (blind-overwrite > efficiency)

---

## Implementation Checklist

When the first agent graduates:

- [ ] Add `## Graduated — Review Schedule` section to COACHEES.md
- [ ] Set the first Tier 2 review date (graduation date + 2 weeks)
- [ ] Record which exercise is the regression exercise for that agent
- [ ] Add a reminder to coach's todo.md for the review date

---

*Created: 2026-03-22. Process version 1.0.*
*Review this process itself after 3 regression reviews have been conducted — is the cadence right? Are the triggers catching real regressions?*
