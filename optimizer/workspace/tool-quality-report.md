# Tool Quality Report

**Generated**: 2026-04-16T18:19  
**Window**: 24h  
**Total calls**: 3148  
**Wasted calls**: 733  
**Waste rate**: 23.3% ↑  
**Sessions with failures**: 178  

## Waste Rate Trend

0.0% → 8.5% → 9.8% → 10.0% → 13.8% → **23.3%**

## Top Issues (by wasted calls)

### bash:exit-code-nonzero
- **Count**: 170
- **Wasted**: 404
- **Agents**: tech-lead(37), bob(34), optimizer(31), may(26), coach(21), coder(19), scout(2)
- **Examples**:
  - `[tech-lead] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"; bun -e \"import{Database}from — 1 | import{Database}from`
  - `[coach] exec failed: {"command":"scripts/gym-run.sh exp165-f2-only --agent coder --trials 8 2>&1","ti — Unknown flag: --trials

`
  - `[coach] exec failed: {"command":"scripts/gym-batch.sh --scenario exp165-f2-only --agent coder --trial — ╔═══════════════════════`

### bash:nonexistent-path
- **Count**: 26
- **Wasted**: 112
- **Agents**: bob(12), coder(7), qa(2), scout(2), optimizer(2), tech-lead(1)
- **Examples**:
  - `[bob] exec failed: {"command":"ls agents/gym/src/"} — ls: cannot access 'agents/gym/src/': No such file or directory


Command`
  - `[bob] exec failed: {"command":"ls agents/gym/src/"} — ls: cannot access 'agents/gym/src/': No such file or directory


Command`
  - `[bob] exec failed: {"command":"ls agents/src/gym/scenarios/ | grep -E \"sql-injection|cascading\" 2 — ls: cannot access 'agent`

### bash:git-error
- **Count**: 54
- **Wasted**: 74
- **Agents**: bob(11), coach(11), optimizer(11), tech-lead(6), may(6), coder(4), scout(4), qa(1)
- **Examples**:
  - `[bob] exec failed: {"command":"cd agents && git add bob/workspace/h161-ceiling-analysis.md bob/work — The following paths are `
  - `[coach] exec failed: {"command":"cd agents && git add shared/knowledge/experiments/EXP-165/results.md — On branch main
Your bran`
  - `[bob] exec failed: {"command":"cd /app/agents && git add bob/workspace/exp165-arm-a-results.md && g — The following paths are `

### bash:timeout-killed
- **Count**: 18
- **Wasted**: 37
- **Agents**: qa(11), coach(4), bob(2), optimizer(1)
- **Examples**:
  - `[qa] exec failed: {"command":"./node_modules/.bin/vitest --run","timeout":120} — 
 RUN  v3.2.4 /app

(node:157308) Experiment`
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\" && cd /app && bun /tmp/run-exp — Command timed out after `
  - `[qa] exec failed: {"command":"./node_modules/.bin/tsc --noEmit","timeout":120} — src/app/bundle-mode.ts(18,10): error TS1470:`

### bash:test-failure
- **Count**: 12
- **Wasted**: 35
- **Agents**: coder(7), bob(4), coach(1)
- **Examples**:
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"\n# Run 7 of 13 trials of exp16 — === F2-ONLY RUN 1 ===
  `
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"\n# Run 5 more trials of exp165 — === F2-ONLY RUN 1 ===
  `
  - `[bob] exec failed: {"command":"export PATH=\".state/.bun/bin:$PATH\"\nexport GYM_AGENT_BIN=\"/app/a — Keeping work dir: /tmp/g`

## All Categories

| Category | Count | Wasted | Top Agent |
|----------|------:|-------:|-----------|
| bash:exit-code-nonzero | 170 | 404 | tech-lead(37) |
| bash:nonexistent-path | 26 | 112 | bob(12) |
| bash:git-error | 54 | 74 | bob(11) |
| bash:timeout-killed | 18 | 37 | qa(11) |
| bash:test-failure | 12 | 35 | coder(7) |
| read:nonexistent-path | 18 | 31 | bob(7) |
| bash:module-not-found | 3 | 8 | coder(3) |
| bash:cmd-not-found | 2 | 7 | bob(2) |
| bash:cmd-aborted | 7 | 7 | bob(6) |
| edit:edit-match-fail | 6 | 6 | tech-lead(4) |
| edit:schema-violation | 3 | 3 | bob(1) |
| read:other | 2 | 2 | bob(1) |
| bash:python-error | 1 | 2 | tech-lead(1) |
| edit:other | 2 | 2 | tech-lead(2) |
| bash:syntax-error | 1 | 2 | optimizer(1) |
| bash:convention-block | 1 | 1 | coach(1) |