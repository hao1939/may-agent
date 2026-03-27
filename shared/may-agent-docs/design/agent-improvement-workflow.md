# Agent Improvement Workflow

## The Loop

Every agent improvement follows the same cycle, regardless of what's being changed:

```
Detect → Hypothesize → Baseline → Apply → Measure → Compare → Ship or Revert
```

This applies to: prompt changes, skill additions, rule changes, configuration tweaks, tool changes, workflow changes. The gym is the gate — not human judgment, not self-assessment.

## Steps

### 1. Detect

Find something to improve. Sources:
- **Evaluations**: Low quality/efficiency scores on specific agents or patterns
- **Error logs**: Repeated failure modes (ERROR_LOG.jsonl)
- **Convention checks**: C1.1, C2.2 violations in convention_checks table
- **Cost analysis**: High token usage, wasted calls, idle sessions
- **Human feedback**: Requests table, reflection log
- **Gym results**: Failing scenarios (Benchmarks tab in web UI)

### 2. Hypothesize

What's the fix? Be specific:
- "Add search-strategy-escalation skill to optimizer's SOUL.md"
- "Remove 'Post-Fix Full Audit' section from coder's SOUL.md (too verbose, replaced by verify-after-write skill)"
- "Increase optimizer opBudget from 60 to 80"
- "Move DOMAIN.md reference content to knowledge/ (reduce prompt size)"

### 3. Baseline

Measure the current state BEFORE making any change:

```bash
# For behavioral changes — gym pass rates
scripts/gym-baseline.sh --tier smoke --agent <name>

# For efficiency changes — measure from evaluations DB
# (token usage, session count, waste rate for the agent)
```

Record the numbers. This is the "before."

### 4. Apply

Make the change. One change at a time — don't stack multiple changes in one cycle. You need to know which change caused which effect.

### 5. Measure

Run the same measurement as step 3:

```bash
scripts/gym-baseline.sh --tier smoke --agent <name>
```

### 6. Compare

Check the Benchmarks tab in web UI, or:

```bash
bun scripts/gym-stats.ts --agent <name> --regressions
```

Rules:
- **Pass rates same or improved + no regressions** → Ship it
- **Any regression** → Investigate. Was a critical rule lost? Fix it. Don't ship regressions.
- **Pass rates improved on some, regressed on others** → Net positive? Ship with a note. Net negative? Revert.

### 7. Ship or Revert

- **Ship**: Commit the change. Log in the daily digest (what changed, before/after scores).
- **Revert**: Restore the backup. Log why it failed (which scenarios regressed, what was lost).

## Who runs this workflow

### Coach — behavioral improvements

Coach detects behavioral gaps (from evaluations, convention checks, error logs) and applies fixes:
- Add/modify skills in agent SOUL.md
- Propose universal rules to common-sense.md
- Create new gym scenarios for untested behaviors
- Run growth cycles (fork agent, apply fix, gym test, promote)

Coach's improvement targets: gym pass rates, convention compliance rates, error frequency.

### Optimizer — efficiency improvements

Optimizer detects waste (from cost data, session analysis, token usage) and applies fixes:
- Slim prompt content (remove dead rules, prune LESSONS)
- Tune configuration (opBudget, heartbeat intervals, compaction thresholds)
- Migrate LLM work to JS handlers (save token cost)
- Remove redundant cron jobs

Optimizer's improvement targets: token cost per session, waste rate, session count, prompt size.

### Either agent — prompt evolution

Both coach and optimizer can run the prompt simplification process:
1. Pick an agent
2. Baseline its gym scores
3. Slim its SOUL.md (remove duplicates with common-sense.md, convert rules to curated skills)
4. Re-run gym
5. Compare and ship

## Gym as CI

The gym is the automated test suite for agent behavior. Every change to an agent's prompt or configuration should run through the gym before shipping. This is the same principle as CI/CD for code:

- **Code change** → run tests → ship if green
- **Agent change** → run gym → ship if pass rates hold

The Benchmarks tab in the web UI is the CI dashboard. It shows pass rates per agent per scenario over time. Regressions are immediately visible.

## Integration with existing systems

### Growth cycle (coach)

The current growth cycle (fork → patch → gym test → promote) already follows this pattern. The improvement is: use the standardized gym-baseline.sh script instead of ad-hoc gym runs, and record results to stats.db for tracking.

### Skill lifecycle (optimizer)

The skill lifecycle workflow (discover → draft → test → deploy) already follows this pattern for skill creation. The improvement is: after deploying a skill, re-run the agent's gym baseline to verify the skill actually improves scores.

### Daily digest

The digest should include:
- Prompt size per agent (track bloat)
- Gym pass rates per agent (track quality)
- Changes applied today (what was improved)
- Regressions detected (what broke)
