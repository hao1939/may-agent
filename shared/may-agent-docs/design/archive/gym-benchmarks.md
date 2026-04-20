# Per-Agent Gym Benchmarks

## Current state

81 scenarios, 75 target `coder`, 1 `tech-lead`, 1 `optimizer`, 3 `any`. The gym infrastructure supports per-agent runs (`--agent <name>`) and records results to `test/gym/stats.db` with `agent_name` column. But it's empty — no systematic benchmarks have been recorded.

## What we need

A **baseline measurement** before prompt simplification, then re-run after each change to detect regressions. The benchmark is: run scenario X with agent Y, record pass/fail per check.

## Scenario selection per agent

Not all 81 scenarios make sense for all agents. Select scenarios that test the skills each agent needs.

### Universal scenarios (run with every agent)

These test basic competency that all agents should have:

| Scenario | Tests | Key checks |
|----------|-------|------------|
| `abandoned-branch` | Staying on task | Doesn't abandon work when distracted |
| `convention-verify-edit` | Read-before-edit, verify-after | C1.1, C1.3 |
| `error-recovery-broken-config` | Error handling | Recovers from bad state |
| `hasty-fix` | Thoroughness | Doesn't apply superficial fix |
| `exit-code-misread` | Check exit codes | C2.2 |
| `read-before-edit` | File safety | Reads full file before editing |
| `silent-dependency` | Investigation depth | Finds hidden dependencies |

### Agent-specific scenarios

**coder** (primary gym agent — run ALL 75 coder scenarios):
Full suite. This is the regression baseline.

**tech-lead** (delegates, coordinates):
- Universal scenarios (above)
- `convention-verify-edit-workflow` — multi-step with delegation
- `convention-verify-multi-edit-workflow` — complex edit coordination
- `delegation-scope-boundary` — knows when to delegate vs do
- `delegation-verify-pattern` — verifies delegated work

**optimizer** (analyzes, improves):
- Universal scenarios
- `optimize-deploy-config` — its designated scenario
- `search-strategy-escalation` — stop grep spirals
- `idempotent-already-fixed` — detect already-done work
- `efficient-file-reading` — don't re-read unchanged files
- `scope-creep-trap` — stay focused on one fix

**coach** (trains, evaluates):
- Universal scenarios
- `judgment-ambiguous-spec` — handle unclear requirements
- `judgment-destructive-trap` — refuse harmful actions
- `behavior-escalation-stubborn` — deal with resistance

**bob** (architect, synthesizes):
- Universal scenarios
- `conflicting-evidence` — resolve contradictory info
- `delegation-scope-boundary` — design boundaries
- `spec-adherence-multi-step` — follow multi-step specs

**scout** (researcher):
- Universal scenarios
- `incremental-context-loading` — efficient large-doc reading
- `red-herring-investigation` — don't get distracted by false leads

**qa** (reviews):
- Universal scenarios
- `phantom-fix` — detect fake fixes
- `skip-verification` — catch missing verification

**evaluator**:
- Universal scenarios
- `judgment-ambiguous-spec` — evaluate unclear situations

**may** (coordinator):
- Universal scenarios
- `delegation-scope-boundary` — dispatch correctly
- `escalation-impossible-task` — escalate when appropriate

## Running benchmarks

### Baseline run (before prompt changes)

```bash
# Run all coder scenarios (full baseline)
scripts/gym-run.sh --run-all --agent coder 2>&1 | bun scripts/gym-record.ts

# Run universal scenarios with each agent
for agent in tech-lead optimizer coach bob scout qa evaluator may; do
  for scenario in abandoned-branch convention-verify-edit error-recovery-broken-config hasty-fix exit-code-misread read-before-edit silent-dependency; do
    scripts/gym-run.sh "$scenario" --agent "$agent" 2>&1 | bun scripts/gym-record.ts
  done
done

# Run agent-specific scenarios
scripts/gym-run.sh optimize-deploy-config --agent optimizer 2>&1 | bun scripts/gym-record.ts
scripts/gym-run.sh delegation-scope-boundary --agent tech-lead 2>&1 | bun scripts/gym-record.ts
# ... etc
```

### After prompt changes

Same runs. Compare with:

```bash
bun scripts/gym-stats.ts --agent coder --regressions
bun scripts/gym-stats.ts --agent tech-lead --regressions
# ... etc
```

### Automation

Add a `benchmark` cron entry or script that:
1. Runs universal scenarios with all agents
2. Runs agent-specific scenarios
3. Records results to stats.db
4. Compares with previous benchmark
5. Reports regressions in daily digest

## Cost estimate

Each scenario run costs ~$0.05-0.15 (one LLM session, 3-5 min).
- Full coder baseline (75 scenarios × 3 runs): ~$35
- Per-agent universal (7 scenarios × 8 agents × 1 run): ~$5
- Per-agent specific (~5 scenarios × 8 agents × 1 run): ~$5
- **Total baseline: ~$45**

Re-runs after changes: same cost. Budget ~$50 per benchmark cycle.
