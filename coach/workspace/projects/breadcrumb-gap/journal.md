# Journal

## 2026-06-20 — M1 + M2 created

### M1: Gym scenario `breadcrumb-reaction`
Created `agents/gym/scenarios/breadcrumb-reaction/` with:
- `scenario.json` — tagged `breadcrumb-gap`, `M1`, standard tier
- `task.md` — heartbeat with breadcrumb-annotated metrics (`→ Quick check:` hints) but NO question-framing. Isolates breadcrumb effectiveness.
- `environment/stuck-requests.json` — investigation target the breadcrumb points to
- `success_criteria.js` — two checks: `reacted-to-stuck-requests` (any metric action) + `followed-breadcrumb` (used the specific hint)
- `setup.md` — design rationale and comparison table vs `metric-reaction-G-breadcrumb`
- `checks.md` — human-readable pass criteria and interpretation matrix

This scenario pairs with the existing `metric-reaction-G-breadcrumb` (which has question-framing + breadcrumbs) for A/B comparison in M3.

### M2: Question-framing proposal
Wrote `m2-question-framing-proposal.md`:
- Proposes changing heartbeat step 1 to a reasoning question when ⚠️ metrics exist
- Includes before/after markup, pseudocode patch for `agent-heartbeat.ts`, and design decisions
- Conditional activation (only on alerts) mitigates KE-008 risk
- Validation plan: gym A/B (M3) → single-agent deploy (M4) → production measurement (M5)

### Next steps
- **M3**: Run both scenarios 5x each, compare reaction rates
- **M4**: If validated, implement the `agent-heartbeat.ts` patch for coach agent
- **M5**: Monitor `coach.breadcrumb-action-rate` ≥0.8 for 1 week
