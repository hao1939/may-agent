
## Blocked
- [ ] **EXP-245 Auditor Generalization** — designed but blocked on gym runner bugs:
  1. Environment copy bug: `fs.cpSync` nests `environment/` instead of flattening (fixed in .gym-runner-bundle.mjs but needs verification)
  2. Agent routing bug: `may-agent --oneshot --agent "coder"` routes to wrong agent (qa/amy instead of coder)
  - Design: `agents/shared/knowledge/experiments/EXP-245/design.md`
