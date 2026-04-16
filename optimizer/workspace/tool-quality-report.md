# Tool Quality Report

**Generated**: 2026-04-16T10:19  
**Window**: 24h  
**Total calls**: 6801  
**Wasted calls**: 680  
**Waste rate**: 10.0% ↑  
**Sessions with failures**: 156  

## Waste Rate Trend

0.0% → 0.0% → 0.0% → 8.5% → 9.8% → **10.0%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 169
- **Wasted**: 344
- **Agents**: optimizer(40), bob(39), coach(31), coder(23), tech-lead(18), may(16), scout(2)
- **Examples**:
  - `[bob] exec failed: {"command":"grep -n \"H-085\\|H-093\\|H-095\\|conclusion\\|Conclusion\" agents/b — (no output)

Command exi`
  - `[optimizer] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"; bun -e \"\nimport{Database}fr — 1 | 
2 | import{Database`
  - `[bob] exec failed: {"command":"cd /app/agents && grep -n \"^Status:\" shared/knowledge/hypotheses/H — (no output)

Command exi`

### bash:nonexistent-path
- **Count**: 26
- **Wasted**: 114
- **Agents**: coder(10), bob(10), qa(2), scout(2), coach(1), tech-lead(1)
- **Examples**:
  - `[coder] exec failed: {"command":"cd /app; rm -f src/lib/turn-budget.test.ts; ls src/lib/turn-budget.t — ls: cannot access 'src/l`
  - `[coder] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"; ls src/app/cron-handlers/"} — ls: cannot access 'src/app`
  - `[coach] exec failed: {"command":"ls agents/lab/experiments/EXP-16[34]*"} — ls: cannot access 'agents/lab/experiments/EXP-16[34]*`

### bash:git-error
- **Count**: 50
- **Wasted**: 75
- **Agents**: bob(15), coach(10), optimizer(8), coder(6), tech-lead(6), scout(4), qa(1)
- **Examples**:
  - `[bob] exec failed: {"command":"cd /app/agents && git add bob/workspace/synthesis-hypothesis-conclus — The following paths are `
  - `[optimizer] exec failed: {"command":"cd /app/agents && git add optimizer/workspace/finding-efficiency-pat — The following paths are `
  - `[bob] exec failed: {"command":"cd agents && git add -A gym/scenarios/stale-reference-cleanup/succes — The following paths are `

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
- **Count**: 16
- **Wasted**: 28
- **Agents**: coder(7), bob(5), tech-lead(3), coach(1)
- **Examples**:
  - `[tech-lead] read tool returned ENOENT for {"path":"src/lib/tools/cost-limit-guard.ts"} with no path hint — agent could not find the `
  - `[bob] read tool returned ENOENT for {"path":"agents/bob/todo.md"} with no path hint — agent could not find the file`
  - `[coach] read tool returned ENOENT for {"path":"agents/shared/knowledge/entries/KE-180.md"} with no path hint — agent could not f`

## ⚠️ Regressions

- **bash:timeout-killed**: 11 (was 9, +22%)

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 169 | 344 | optimizer(40) |
| bash:nonexistent-path | 26 | 114 | coder(10) |
| bash:git-error | 50 | 75 | bob(15) |
| bash:test-failure | 21 | 51 | bob(13) |
| read:nonexistent-path | 16 | 28 | coder(7) |
| bash:timeout-killed | 11 | 15 | qa(8) |
| bash:cmd-not-found | 8 | 13 | bob(3) |
| bash:cmd-aborted | 9 | 9 | bob(8) |
| bash:path-is-directory | 1 | 9 | coach(1) |
| bash:module-not-found | 4 | 9 | coder(3) |
| edit:edit-match-fail | 4 | 4 | coder(2) |
| edit:schema-violation | 3 | 3 | optimizer(1) |
| read:other | 3 | 3 | bob(2) |
| read:path-is-directory | 1 | 2 | coach(1) |
| edit:other | 1 | 1 | optimizer(1) |