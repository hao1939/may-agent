# Doc-Code Drift Tracker

Tracks key design documents and their corresponding implementation files.
Bob checks 2-3 of these per heartbeat to ensure `doc` matches `code`.

| Document | Code Target | Last Checked | Status |
|---|---|---|---|
| `agents/shared/philosophy.md` | `src/lib/manager.ts` (Principles) | 2026-03-29 | ✅ Aligned (P85 OpBudget Logging Fixed) |
| `agents/shared/skills/evaluator-scoring/SKILL.md` | `agents/evaluator/skills/score.md` | 2026-03-28 | ✅ Aligned |
| `agents/shared/tasks/consolidate-memory.md` | `agents/*/handlers/handle_consolidation.ts` | 2026-03-12 | ✅ Aligned |
| `agents/shared/team.md` | `src/app/agent-loader.ts` (Team defs) | 2026-03-13 | ✅ Aligned (Master has claude-code/gemini-cli) |
| `agents/bob/workspace/design-ops-gates.md` | `src/lib/ops-gate.ts` | 2026-03-13 | ✅ Aligned |
| `agents/bob/workspace/design-hmac-receipts.md` | `src/lib/manager.ts` (Tool signing) | 2026-03-12 | ✅ Aligned |
| `agents/bob/workspace/design-drift-detection.md` | `agents/evaluator/skills/detect-drift.md` | 2026-03-13 | ✅ Aligned |
| `agents/bob/workspace/design-counter-zombie.md` | `agents/shared/philosophy.md` (P95) | 2026-03-13 | ✅ Aligned |
| `agents/bob/workspace/brief-p53-bash.md` | `src/app/agent-loader.ts` (Bash Guard) | 2026-03-13 | ✅ Aligned |
| `agents/shared/skills/growth-cycle.md` | `agents/coach/skills/growth-cycle.md` | 2026-03-25 | ✅ Aligned |
| `agents/shared/philosophy.md` | `agents/bob/workspace/synthesis/2026-03-13-security-supply-chain.md` | 2026-03-29 | ✅ Aligned (P88 JIT Ban implemented) |
| `agents/evaluator/skills/detect-drift.md` | `agents/evaluator/skills/detect-drift.cjs` | 2026-03-13 | ✅ Fixed (.js -> .cjs) |
| `agents/evaluator/skills/challenge-agent.md` | `agents/evaluator/skills/challenge-agent.cjs` | 2026-03-13 | ✅ Fixed (.js -> .cjs) |
| `agents/coach/agent.json` | `agents/shared/team.md` (Coach tools) | 2026-03-13 | ✅ Aligned |
