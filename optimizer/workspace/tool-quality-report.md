# Tool Quality Report

**Generated**: 2026-04-16T06:19  
**Window**: 24h  
**Total calls**: 7710  
**Wasted calls**: 752  
**Waste rate**: 9.8% ↑  
**Sessions with failures**: 161  

## Waste Rate Trend

1.4% → 0.0% → 0.0% → 0.0% → 8.5% → **9.8%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 176
- **Wasted**: 370
- **Agents**: optimizer(50), bob(40), coach(28), coder(26), tech-lead(23), may(6), scout(3)
- **Examples**:
  - `[tech-lead] exec failed: {"command":"cd /app && git checkout main 2>&1"} — error: Your local changes to the following files would be`
  - `[optimizer] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\" && bun -e \"\nimport{Database} — 1 | 
2 | import{Database`
  - `[bob] exec failed: {"command":"ls agents/gym/*.ts agents/gym/*.js agents/gym/*.sh 2>/dev/null"} — (no output)

Command exited `

### bash:nonexistent-path
- **Count**: 30
- **Wasted**: 133
- **Agents**: bob(13), coder(10), optimizer(2), scout(2), coach(1), tech-lead(1), qa(1)
- **Examples**:
  - `[bob] exec failed: {"command":"ls -la agents/gym/lib/"} — ls: cannot access 'agents/gym/lib/': No such file or directory


Com`
  - `[optimizer] exec failed: {"command":"cd /var/task && ls agents/optimizer/workspace/"} — /bin/bash: line 1: cd: /var/task: No such fi`
  - `[optimizer] exec failed: {"command":"cd /var/task && sqlite3 .state/state.db \".tables\" 2>/dev/null"} — /bin/bash: line 1: cd: /var`

### bash:git-error
- **Count**: 56
- **Wasted**: 83
- **Agents**: bob(16), optimizer(11), coder(9), coach(7), scout(6), tech-lead(6), qa(1)
- **Examples**:
  - `[scout] exec failed: {"command":"cd /app && git add agents/scout/workspace/todo.md agents/shared/know — The following paths are `
  - `[scout] exec failed: {"command":"cd /app && git add -f agents/scout/workspace/todo.md agents/shared/k — 
❌ Direct commits to mai`
  - `[optimizer] exec failed: {"command":"cd agents && git add optimizer/workspace/finding-session-archaeology — The following paths are `

### bash:test-failure
- **Count**: 22
- **Wasted**: 52
- **Agents**: bob(13), coder(8), coach(1)
- **Examples**:
  - `[coder] exec failed: {"command":"cd /app && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/v — 
 RUN  v3.2.4 /app

(nod`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/type-mismatch-silent-coercion && echo \"===  — === 1. ORIGINAL (broken)`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/sql-injection-in-query-builder/environment & — Product Search Tests

  `

### read:nonexistent-path
- **Count**: 14
- **Wasted**: 25
- **Agents**: coder(7), tech-lead(3), bob(3), coach(1)
- **Examples**:
  - `[tech-lead] read tool returned ENOENT for {"path":"src/lib/tools/cost-limit-guard.ts"} with no path hint — agent could not find the `
  - `[bob] read tool returned ENOENT for {"path":"agents/bob/todo.md"} with no path hint — agent could not find the file`
  - `[coach] read tool returned ENOENT for {"path":"agents/shared/knowledge/entries/KE-180.md"} with no path hint — agent could not f`

## ⚠️ Regressions

- **bash:test-failure**: 22 (was 17, +29%)

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 176 | 370 | optimizer(50) |
| bash:nonexistent-path | 30 | 133 | bob(13) |
| bash:git-error | 56 | 83 | bob(16) |
| bash:test-failure | 22 | 52 | bob(13) |
| read:nonexistent-path | 14 | 25 | coder(7) |
| bash:cmd-not-found | 13 | 22 | optimizer(7) |
| bash:module-not-found | 8 | 15 | coder(6) |
| bash:timeout-killed | 9 | 13 | qa(6) |
| bash:cmd-aborted | 12 | 12 | bob(8) |
| bash:path-is-directory | 1 | 9 | coach(1) |
| edit:edit-match-fail | 5 | 5 | optimizer(2) |
| edit:schema-violation | 3 | 3 | optimizer(1) |
| read:other | 3 | 3 | bob(2) |
| edit:other | 2 | 2 | bob(1) |
| read:path-is-directory | 1 | 2 | coach(1) |
| write:other | 1 | 1 | optimizer(1) |
| bash:permission-denied | 1 | 1 | coder(1) |
| checkpoint:schema-violation | 1 | 1 | bob(1) |