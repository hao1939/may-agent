# Tool Quality Report

**Generated**: 2026-04-16T02:19  
**Window**: 24h  
**Total calls**: 7936  
**Wasted calls**: 675  
**Waste rate**: 8.5% ↑  
**Sessions with failures**: 140  

## Waste Rate Trend

2.3% → 1.4% → 0.0% → 0.0% → 0.0% → **8.5%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 156
- **Wasted**: 329
- **Agents**: optimizer(49), bob(33), coder(23), coach(23), tech-lead(21), may(4), scout(3)
- **Examples**:
  - `[optimizer] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"; bun -e \"import{Database}from — 1 | import{Database}from`
  - `[tech-lead] exec failed: {"command":"cat .state/cron.json 2>/dev/null || echo \"Not found\"; echo \"---\" — Not found
---
./agents/m`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/premature-ship-pressure/environment && node  — TAP version 13
# Subtest`

### bash:nonexistent-path
- **Count**: 27
- **Wasted**: 120
- **Agents**: bob(11), coder(9), optimizer(2), scout(2), coach(1), tech-lead(1), qa(1)
- **Examples**:
  - `[bob] exec failed: {"command":"ls -la agents/gym/lib/"} — ls: cannot access 'agents/gym/lib/': No such file or directory


Com`
  - `[optimizer] exec failed: {"command":"cd /var/task && ls agents/optimizer/workspace/"} — /bin/bash: line 1: cd: /var/task: No such fi`
  - `[optimizer] exec failed: {"command":"cd /var/task && sqlite3 .state/state.db \".tables\" 2>/dev/null"} — /bin/bash: line 1: cd: /var`

### bash:git-error
- **Count**: 53
- **Wasted**: 80
- **Agents**: bob(13), optimizer(10), coder(9), scout(7), tech-lead(6), coach(5), qa(3)
- **Examples**:
  - `[qa] exec failed: {"command":"cd /app && git show --name-only --oneline --no-patch 7b0055a1"} — fatal: options '--name-only',`
  - `[scout] exec failed: {"command":"cd /root && git add agents/shared/knowledge/library/deep-dives/DD-75 — fatal: not a git reposit`
  - `[qa] exec failed: {"command":"git show --name-only --oneline --no-patch HEAD"} — fatal: options '--name-only', '--name-status`

### bash:test-failure
- **Count**: 17
- **Wasted**: 38
- **Agents**: bob(13), coder(3), coach(1)
- **Examples**:
  - `[coder] exec failed: {"command":"cd /app && ./node_modules/.bin/tsc --noEmit && ./node_modules/.bin/v — 
 RUN  v3.2.4 /app

(nod`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/type-mismatch-silent-coercion && echo \"===  — === 1. ORIGINAL (broken)`
  - `[bob] exec failed: {"command":"cd agents/gym/scenarios/sql-injection-in-query-builder/environment & — Product Search Tests

  `

### bash:cmd-not-found
- **Count**: 13
- **Wasted**: 23
- **Agents**: optimizer(8), bob(2), coach(1), tech-lead(1), coder(1)
- **Examples**:
  - `[optimizer] exec failed: {"command":"bun -e \"import{Database}from'bun:sqlite'; const db=new Database('.s — /bin/bash: line 1: bun: `
  - `[optimizer] exec failed: {"command":"bun -e \"\nimport{Database}from'bun:sqlite';\nconst db=new Database( — /bin/bash: line 1: bun: `
  - `[optimizer] exec failed: {"command":"bun -e \"\nimport{Database}from'bun:sqlite';\nconst db=new Database( — /bin/bash: line 1: bun: `

## ⚠️ Regressions

- **bash:git-error**: 53 (was 0, +100%)
- **bash:timeout-killed**: 10 (was 0, +100%)
- **bash:cmd-not-found**: 13 (was 0, +100%)
- **bash:exit-code-nonzero**: 156 (was 0, +100%)
- **bash:cmd-aborted**: 12 (was 0, +100%)
- **bash:module-not-found**: 7 (was 0, +100%)
- **bash:nonexistent-path**: 27 (was 0, +100%)
- **edit:edit-match-fail**: 5 (was 0, +100%)
- **bash:test-failure**: 17 (was 0, +100%)
- **edit:schema-violation**: 3 (was 0, +100%)
- **read:other**: 3 (was 0, +100%)
- **read:nonexistent-path**: 12 (was 0, +100%)

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 156 | 329 | optimizer(49) |
| bash:nonexistent-path | 27 | 120 | bob(11) |
| bash:git-error | 53 | 80 | bob(13) |
| bash:test-failure | 17 | 38 | bob(13) |
| bash:cmd-not-found | 13 | 23 | optimizer(8) |
| read:nonexistent-path | 12 | 22 | coder(7) |
| bash:timeout-killed | 10 | 14 | qa(8) |
| bash:cmd-aborted | 12 | 12 | bob(8) |
| bash:module-not-found | 7 | 9 | coder(5) |
| bash:path-is-directory | 1 | 9 | coach(1) |
| edit:edit-match-fail | 5 | 5 | optimizer(2) |
| edit:schema-violation | 3 | 3 | optimizer(1) |
| read:other | 3 | 3 | bob(2) |
| edit:other | 2 | 2 | bob(1) |
| read:path-is-directory | 1 | 2 | coach(1) |
| finish:schema-violation | 1 | 1 | qa(1) |
| write:other | 1 | 1 | optimizer(1) |
| bash:permission-denied | 1 | 1 | coder(1) |
| checkpoint:schema-violation | 1 | 1 | bob(1) |