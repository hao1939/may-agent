# Tool Quality Report

**Generated**: 2026-04-16T22:19  
**Window**: 24h  
**Total calls**: 1446  
**Wasted calls**: 707  
**Waste rate**: 48.9% ↑  
**Sessions with failures**: 178  

## Waste Rate Trend

8.5% → 9.8% → 10.0% → 13.8% → 23.3% → **48.9%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 154
- **Wasted**: 372
- **Agents**: tech-lead(40), bob(34), may(24), optimizer(20), coach(18), coder(16), scout(2)
- **Examples**:
  - `[coach] exec failed: {"command":"ls agents/gym/scenarios/ | grep exp166"} — (no output)

Command exited with code 1`
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"\nbun -e \"\nimport {Database}  — 1 | 
2 | import {Databas`
  - `[optimizer] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\" && bun -e \"\nimport{Database} — 2 | import{Database}from`

### bash:nonexistent-path
- **Count**: 25
- **Wasted**: 105
- **Agents**: bob(11), coder(7), qa(2), scout(2), optimizer(2), tech-lead(1)
- **Examples**:
  - `[bob] exec failed: {"command":"ls agents/src/gym/scenarios/ | grep -E \"sql-injection|cascading\" 2 — ls: cannot access 'agent`
  - `[qa] exec failed: {"command":"wc -l workspace/journal.md"} — wc: workspace/journal.md: No such file or directory


Command ex`
  - `[coder] exec failed: {"command":"ls test/product-search.test.js 2>&1"} — ls: cannot access 'test/product-search.test.js': No suc`

### bash:git-error
- **Count**: 54
- **Wasted**: 76
- **Agents**: bob(13), optimizer(12), coach(7), tech-lead(6), may(6), coder(4), scout(4), qa(2)
- **Examples**:
  - `[tech-lead] exec failed: {"command":"cd /app/agents && git add tech-lead/workspace/finding-compaction-ts- — The following paths are `
  - `[optimizer] exec failed: {"command":"cd /app/agents && git add optimizer/workspace/finding-high-op-outlie — The following paths are `
  - `[coder] exec failed: {"command":"cd /app/agents && git add gym/scenarios/sql-injection-in-query-build — The following paths are `

### bash:timeout-killed
- **Count**: 20
- **Wasted**: 39
- **Agents**: qa(13), coach(4), bob(2), optimizer(1)
- **Examples**:
  - `[qa] exec failed: {"command":"./node_modules/.bin/vitest --run","timeout":120} — 
 RUN  v3.2.4 /app

(node:157308) Experiment`
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\" && cd /app && bun /tmp/run-exp — Command timed out after `
  - `[qa] exec failed: {"command":"./node_modules/.bin/tsc --noEmit","timeout":120} — src/app/bundle-mode.ts(18,10): error TS1470:`

### read:nonexistent-path
- **Count**: 19
- **Wasted**: 33
- **Agents**: bob(9), coder(7), tech-lead(2), qa(1)
- **Examples**:
  - `[tech-lead] read tool returned ENOENT for {"path":"src/lib/workflows/persistent-task.ts"} with no path hint — agent could not find t`
  - `[tech-lead] read tool returned ENOENT for {"path":"src/lib/workflow-engine.ts"} with no path hint — agent could not find the file`
  - `[coder] read tool returned ENOENT for {"path":"/app/src/product-search.js"} with no path hint — agent could not find the file`

## ⚠️ Regressions

- **bash:cmd-not-found**: 4 (was 2, +100%)
- **edit:edit-match-fail**: 16 (was 6, +167%)

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 154 | 372 | tech-lead(40) |
| bash:nonexistent-path | 25 | 105 | bob(11) |
| bash:git-error | 54 | 76 | bob(13) |
| bash:timeout-killed | 20 | 39 | qa(13) |
| read:nonexistent-path | 19 | 33 | bob(9) |
| bash:test-failure | 10 | 31 | coder(7) |
| edit:edit-match-fail | 16 | 16 | qa(9) |
| bash:cmd-not-found | 4 | 10 | bob(2) |
| bash:module-not-found | 3 | 8 | coder(3) |
| bash:cmd-aborted | 7 | 7 | bob(6) |
| edit:schema-violation | 2 | 2 | scout(1) |
| bash:python-error | 1 | 2 | tech-lead(1) |
| edit:other | 2 | 2 | tech-lead(2) |
| bash:syntax-error | 1 | 2 | optimizer(1) |
| read:other | 1 | 1 | tech-lead(1) |
| bash:convention-block | 1 | 1 | coach(1) |