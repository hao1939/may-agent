# Tool Quality Report

**Generated**: 2026-04-16T14:19  
**Window**: 24h  
**Total calls**: 5403  
**Wasted calls**: 745  
**Waste rate**: 13.8% ↑  
**Sessions with failures**: 181  

## Waste Rate Trend

0.0% → 0.0% → 8.5% → 9.8% → 10.0% → **13.8%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 183
- **Wasted**: 391
- **Agents**: bob(44), optimizer(36), tech-lead(30), coach(27), may(23), coder(21), scout(2)
- **Examples**:
  - `[optimizer] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\" && bun -e \"\nimport{Database} — 1 | 
2 | import{Database`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/partial-migration-leftover && cp -r environm — === Record Fetch Tests =`
  - `[bob] exec failed: {"command":"grep -n \"BUG\" agents/gym/scenarios/type-mismatch-silent-coercion/e — (no output)

Command exi`

### bash:nonexistent-path
- **Count**: 27
- **Wasted**: 118
- **Agents**: bob(10), coder(8), tech-lead(2), qa(2), scout(2), optimizer(2), coach(1)
- **Examples**:
  - `[coach] exec failed: {"command":"ls agents/lab/experiments/EXP-16[34]*"} — ls: cannot access 'agents/lab/experiments/EXP-16[34]*`
  - `[coder] exec failed: {"command":"ls -la /app/agents/may/handlers/metrics-snapshot.ts /app/scripts/see — ls: cannot access '/app/`
  - `[bob] exec failed: {"command":"cd /app && ls agents/gym/src/runner.ts && head -50 agents/gym/src/ru — ls: cannot access 'agent`

### bash:git-error
- **Count**: 60
- **Wasted**: 82
- **Agents**: optimizer(13), bob(13), coach(10), tech-lead(8), coder(6), may(5), scout(4), qa(1)
- **Examples**:
  - `[optimizer] exec failed: {"command":"cd agents && git add optimizer/workspace/finding-tech-lead-heartbeat — The following paths are `
  - `[coder] exec failed: {"command":"cd /app && git add agents/may/handlers/metrics-snapshot.ts scripts/s — The following paths are `
  - `[coder] exec failed: {"command":"cd /app && git commit -m \"feat(metrics): Phase 1 Unified Metric Sys — 
❌ Direct commits to mai`

### bash:test-failure
- **Count**: 21
- **Wasted**: 51
- **Agents**: bob(13), coder(7), coach(1)
- **Examples**:
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/type-mismatch-silent-coercion && echo \"===  — === 1. ORIGINAL (broken)`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/sql-injection-in-query-builder/environment & — Product Search Tests

  `
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/sql-injection-in-query-builder/environment & — Product Search Tests

  `

### read:nonexistent-path
- **Count**: 19
- **Wasted**: 32
- **Agents**: bob(7), coder(7), tech-lead(3), coach(1), qa(1)
- **Examples**:
  - `[tech-lead] read tool returned ENOENT for {"path":"src/lib/tools/cost-limit-guard.ts"} with no path hint — agent could not find the `
  - `[bob] read tool returned ENOENT for {"path":"agents/bob/todo.md"} with no path hint — agent could not find the file`
  - `[coach] read tool returned ENOENT for {"path":"agents/shared/knowledge/entries/KE-180.md"} with no path hint — agent could not f`

## ⚠️ Regressions

- **edit:edit-match-fail**: 8 (was 4, +100%)
- **bash:timeout-killed**: 16 (was 11, +45%)
- **edit:other**: 2 (was 1, +100%)

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 183 | 391 | bob(44) |
| bash:nonexistent-path | 27 | 118 | bob(10) |
| bash:git-error | 60 | 82 | optimizer(13) |
| bash:test-failure | 21 | 51 | bob(13) |
| read:nonexistent-path | 19 | 32 | bob(7) |
| bash:timeout-killed | 16 | 21 | qa(9) |
| bash:cmd-not-found | 6 | 11 | bob(3) |
| bash:module-not-found | 4 | 9 | coder(3) |
| bash:cmd-aborted | 9 | 9 | bob(8) |
| edit:edit-match-fail | 8 | 8 | tech-lead(5) |
| read:other | 3 | 3 | bob(2) |
| edit:schema-violation | 3 | 3 | bob(1) |
| bash:python-error | 1 | 2 | tech-lead(1) |
| edit:other | 2 | 2 | tech-lead(2) |
| bash:syntax-error | 1 | 2 | optimizer(1) |
| bash:convention-block | 1 | 1 | coach(1) |