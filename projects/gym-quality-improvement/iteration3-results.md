# Iteration 3 Results — Skill Files Created

**Date**: 2025-01-14

## Deliverables

### 4 New Skill Files Created

| # | Skill | Path | Target Scenario |
|---|-------|------|-----------------|
| 1 | backward-compatibility-check | `/app/agents/shared/skills/backward-compatibility-check/SKILL.md` | silent-data-corruption |
| 2 | absent-information-discovery | `/app/agents/shared/skills/absent-information-discovery/SKILL.md` | truncated-schema-migration |
| 3 | context-verification | `/app/agents/shared/skills/context-verification/SKILL.md` | ambiguous-context-drift |
| 4 | primary-source-analysis | `/app/agents/shared/skills/primary-source-analysis/SKILL.md` | approach-validation-trap |

### Skill Format

Each skill follows the existing pattern in `/app/agents/shared/skills/` with:
- YAML frontmatter (name, version, description, owner)
- "When to Apply" triggers
- Step-by-step Protocol
- Anti-Pattern with ❌/✅ examples
- Inviolable Constraint (⛔ rule)

### What Was NOT Done

1. **Gym scenario runs**: The gym runner (`/app/agents/test/gym/run-gym.sh`) requires a full agent runtime (adapter for coder/claude-code). Cannot be run from a worker session. Gym runs must be triggered by the coach or via the gym infrastructure.

2. **SOUL.md edits**: Per task instructions, no direct edits to SOUL.md. The proposed additions remain in `guidance-proposals.md`.

3. **LIBRARY.md updates**: The new skills should be registered in `/app/agents/shared/skills/LIBRARY.md` with status `⚪ untested` once gym runs confirm baseline behavior. Current status of all 4 skills: **untested**.

## Existing Skills Context

The skills directory already had these relevant skills:
- `verification/` — general verify-with-tools protocol
- `evidence-over-narrative/` — related to primary-source-analysis
- `baseline-before-change/` — related to backward-compatibility-check
- `session-awareness-guard/` — related to context-verification

The new skills are more specific and scenario-targeted than the existing general ones.

## Next Steps

1. **Register in LIBRARY.md** — Add 4 rows with `⚪ untested` status
2. **Add to coder SOUL.md** — The proposed constraint lines from `guidance-proposals.md`
3. **Run gym scenarios** — Test each failing scenario with skills injected:
   - `build-activation-gap` (existing skill should cover — verify)
   - `silent-data-corruption` + backward-compatibility-check
   - `truncated-schema-migration` + absent-information-discovery
   - `ambiguous-context-drift` + context-verification
   - `approach-validation-trap` + primary-source-analysis
4. **Compare results** — Current baseline: 0/3 on all 5 scenarios. Target: ≥2/3 on each.
