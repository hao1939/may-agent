# Iteration 4: Workflow Variant Scenarios

## Analysis of Proven Workflow Pattern

Studied two proven workflow variants:

### Pattern Structure
1. **scenario.json**: Sets `"workflow": true`, `"inherits": "base-scenario"`, keeps same categories/tags + `"workflow"` tag
2. **task.md**: Rewrites the task into **phases** — Phase 1 forces the diagnostic/verification step, Phase 2 is the actual fix. Key: "Do NOT edit code until Phase 1 is complete."
3. **success_criteria.js**: Adds **workflow compliance checks** (e.g., did ANALYSIS.md exist before code edits?) alongside the original product checks

### Why Workflows Work (from LIBRARY.md meta-analysis)
- Text injection: 0/19+ success rate for behavioral changes
- Workflow enforcement: 40% help rate, +32% mean improvement when they help
- Decision Topology R ratio > 0.5 predicts workflow success
- Both `silent-data-corruption` and `truncated-schema-migration` involve judgment/discovery steps → high R ratio → good workflow candidates

## Created Workflow Variants

### 1. silent-data-corruption-workflow
**Insight**: Agent fails because it changes the format without checking existing persisted data. Workflow forces a "data audit" phase.

- **Phase 1**: Read ALL data files and enumerate what formats exist. Write `DATA-AUDIT.md` documenting every data file, its current format, and what would break if the format changes. Do NOT edit any `.js` files.
- **Phase 2**: Implement the format change WITH backward-compatibility handling for existing data. Run tests.

**Files created**:
- `/app/agents/gym/scenarios/silent-data-corruption-workflow/scenario.json`
- `/app/agents/gym/scenarios/silent-data-corruption-workflow/task.md`
- `/app/agents/gym/scenarios/silent-data-corruption-workflow/success_criteria.js`
- `/app/agents/gym/scenarios/silent-data-corruption-workflow/package.json`

### 2. truncated-schema-migration-workflow
**Insight**: Agent fails because it only fixes columns that tests catch, missing silently-absent columns. Workflow forces cross-referencing the ORM model.

- **Phase 1**: Read the ORM model file and `schema.sql`. Write `SCHEMA-AUDIT.md` listing every column the model expects vs what the migration creates. Do NOT edit `schema.sql` until audit is complete.
- **Phase 2**: Fix `schema.sql` to include ALL columns from the model. Run tests.

**Files created**:
- `/app/agents/gym/scenarios/truncated-schema-migration-workflow/scenario.json`
- `/app/agents/gym/scenarios/truncated-schema-migration-workflow/task.md`
- `/app/agents/gym/scenarios/truncated-schema-migration-workflow/success_criteria.js`
- `/app/agents/gym/scenarios/truncated-schema-migration-workflow/package.json`

## LIBRARY.md Updates (Proposed)

Add 4 new entries as `⚪ untested`:

| Skill | Status | Target Scenario |
|-------|--------|-----------------|
| backward-compatibility-check | ⚪ untested (skill file) | silent-data-corruption |
| absent-information-discovery | ⚪ untested (skill file) | truncated-schema-migration |
| context-verification | ⚪ untested (skill file) | ambiguous-context-drift |
| verify-before-declare | ⚪ untested (skill file) | build-activation-gap |

**Note**: Per LIBRARY.md evidence, these text-injection skills will almost certainly NOT improve pass rates. The workflow variants created above are the real intervention. The skill files serve as documentation of the behavioral pattern.

## Next Steps
1. Run `silent-data-corruption-workflow` through gym to measure improvement vs 0/3 baseline
2. Run `truncated-schema-migration-workflow` through gym
3. If workflows pass, add entries to LIBRARY.md with gym evidence
4. Create workflow variants for remaining 3 failing scenarios (approach-validation-trap, ambiguous-context-drift, build-activation-gap)
