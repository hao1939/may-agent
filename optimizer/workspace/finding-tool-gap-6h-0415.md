# Tool Gap Analysis — 6h Bash Pattern Scan (Bob & Tech-Lead)
**Date**: 2026-04-15T20:00Z  
**Window**: Last 6h (14:00–20:00 UTC)  
**Sessions analyzed**: 6 sessions, 441 total ops

| Session | Agent | Ops | Task |
|---------|-------|-----|------|
| s_1776277963790_29 | tech-lead | 108 | Evaluator quality=0 bug investigation |
| s_1776263548918_19 | bob | 86 | Gym scenario design (2 new scenarios) |
| s_1776265974823_51 | bob | 68 | Gym scenario design (sql-injection + deprecation) |
| s_1776276218931_15 | tech-lead | 57 | Guard escalation override design |
| s_1776274344039_67 | tech-lead | 54 | Human input logging implementation |
| s_1776266528990_53 | tech-lead | 41 | Metric system phase 2 |

---

## Pattern 1: Grep-Chain Code Investigation (tech-lead, ~40+ ops per session)

### Evidence
Tech-lead session `s_1776277963790_29` (108 ops) shows **78 grep commands** in a single session investigating the evaluator quality=0 bug. The pattern is:
1. `grep -rn 'someFunction' src/ --include='*.ts'` — find definition
2. Read result, decide to look for callers
3. `grep -rn 'callerOfFunction' src/ --include='*.ts'` — find callers
4. Read result, decide to trace through another layer
5. Repeat 15-25 times across files

Specific chain from this session:
```
grep -n 'computeHeuristicScores|function evaluate|quality' src/lib/evaluator.ts
grep -n 'computeHeuristic|heuristic|quality.*=' src/lib/evaluator.ts  
grep -rn 'quality.system|quality_system|system_quality' src/lib/
grep -rn 'quality.*system|getAgentScoreSummary|avgQuality' src/
grep -rn 'upsertEvaluation|hasEvaluation|hasLLMEvaluation' src/lib/
grep -rn 'evaluateTask|upsertEvaluation' src/lib/manager*.ts
grep -rn 'evaluateTask|upsertEvaluation' src/ --include='*.ts'
grep -n -B5 -A20 'evaluateTask' src/app/may.ts
grep -rn 'skippedByJs|skipped_by_js|verdict.*skipped' src/
```

### What already exists
`scripts/code-search.sh` / `scripts/code-search.ts` exist but only find single patterns. They don't do **call-chain tracing** (find function → find callers → find callers of callers).

### Proposed tool: `scripts/trace-callchain.sh`
**Input**: function name, optional starting file  
**Output**: 3-level call graph (definition → direct callers → callers of callers)  
**Estimated savings**: 15-20 bash ops per investigation session → 1-2 ops  
**Frequency**: Tech-lead does ~2-3 investigation sessions/day = **30-60 ops/day saved**

---

## Pattern 2: Gym Scenario Validation Loop (bob, ~25-30 ops per scenario)

### Evidence
Bob sessions `s_1776263548918_19` (86 ops) and `s_1776265974823_51` (68 ops) show a repetitive 4-stage validation loop for every new gym scenario:

**Stage A — Initial test** (2-3 ops):
```bash
cd agents/gym/scenarios/<name>/environment && node test/<test>.test.js
```

**Stage B — Naive fix simulation** (5-8 ops):
```bash
cp -r environment /tmp/test-naive-fix
cd /tmp/test-naive-fix && sed -i 's/<obvious_fix>/<replacement>/' src/<file>.js
node test/<test>.test.js
node success_criteria.js /tmp/test-naive-fix
```

**Stage C — Full fix simulation** (5-8 ops):
```bash
cp -r environment /tmp/test-full-fix
cd /tmp/test-full-fix && <apply all fixes>
node test/<test>.test.js  
node success_criteria.js /tmp/test-full-fix
```

**Stage D — Verification & iteration** (10-15 ops): Debugging when criteria don't match expectations, re-running with tweaks.

This 4-stage pattern repeats for EACH scenario. Bob built 4 scenarios across these 2 sessions and ran this loop 4 times.

### What already exists
`scripts/gym-run.sh` runs a gym scenario against an agent. `scripts/gym-baseline.sh` baselines a scenario. Neither validates scenario **construction** (tests pass in original state, naive fix gets partial score, full fix gets 100%).

### Proposed tool: `scripts/gym-validate-scenario.sh`
**Input**: scenario directory path  
**Output**: Validates all 3 states (broken → tests fail, naive fix → partial success_criteria pass, full fix → all criteria pass)  
**Estimated savings**: 20-25 bash ops per scenario validation → 1 op  
**Frequency**: Bob designs ~2-4 scenarios/day = **40-100 ops/day saved**

---

## Pattern 3: Git Commit Dance (both agents, ~8-12 ops per session)

### Evidence
Both agents show a recurring git commit struggle at end of sessions:

**Tech-lead** `s_1776276218931_15`:
```bash
git add agents/tech-lead/workspace/design-guard-escalation-override.md && git commit -m "..."
# Fails — gitignored workspace
git add -f agents/tech-lead/workspace/... && git commit -m "..."  
# Wrong repo — agents/ is separate
cd /app/agents && git add tech-lead/workspace/... && git commit -m "..."
# Then separate commit for src/ changes
cd /app && git add src/... && git commit -m "..."
```

**Bob** `s_1776263548918_19`:
```bash
cd /app/agents && git add bob/ gym/scenarios/... && git commit -m "..."
cd /app/agents && git status --short | head -20
cd /app && git status --short agents/gym/...
cd /app && git log --oneline -3 -- agents/gym/...
cd /app/agents && git add shared/knowledge/... && git commit -m "..."
```

The pattern: agents forget which repo they're in, forget about .gitignore, try `git add` from wrong cwd, then retry 2-3 times.

### What already exists
`scripts/sync-agents.sh` exists but isn't used during commits. No "smart commit" script.

### Proposed tool: `scripts/smart-commit.sh`  
**Input**: list of files to commit + message  
**Output**: Auto-detects which repo (main vs agents), handles -f for gitignored paths, commits from correct cwd  
**Estimated savings**: 4-6 bash ops per session → 1 op  
**Frequency**: Every session that commits (~8-10/day) = **30-50 ops/day saved**

---

## Summary — Priority Ranking

| # | Pattern | Ops/Day Saved | Implementation Effort | ROI |
|---|---------|---------------|----------------------|-----|
| 1 | Gym Scenario Validation | 40-100 | Medium (need to handle edge cases in success_criteria) | **Highest** |
| 2 | Grep-Chain Call Tracing | 30-60 | Medium (AST parsing vs regex heuristic) | **High** |
| 3 | Smart Commit | 30-50 | Low (shell script, well-defined rules) | **High** |

### Not covered by existing tools
- `session-query.ts` — queries session DB, doesn't help with code investigation
- `code-search.sh` — single-pattern search, no call-chain tracing
- `gym-batch.sh` — runs batches against agents, doesn't validate scenario construction
- `gym-baseline.sh` — baselines against agent, doesn't test naive-vs-full fix discrimination

### Net impact estimate
Combined: **100-210 ops/day** across bob + tech-lead, which at ~30s/op average = **50-105 minutes of wall-clock time saved daily**.
