# Guidance Proposals for Gym Failure Scenarios

**Date**: 2025-01-14  
**Purpose**: Propose specific SOUL.md / skill additions to address 5 consistently failing gym scenarios.

## Current State

The coder archetype SOUL (`/app/agents/_archetypes/coder/SOUL.md`) already has:
- ✅ **Build Activation** constraint (addresses `build-activation-gap`)
- ✅ **Evidence Over Narrative** skill (partially addresses `approach-validation-trap`)
- ✅ **Verify-after-write** skill (general verification)

**Missing coverage for**:
1. `silent-data-corruption` — No skill for backward-compatibility / existing data checks
2. `truncated-schema-migration` — No skill for absent-information discovery
3. `ambiguous-context-drift` — No skill for verifying context claims against filesystem
4. `approach-validation-trap` — Evidence-over-narrative exists but doesn't specifically mandate reading primary sources before accepting summaries

## Proposed New Skills

---

### Skill 1: `backward-compatibility-check`

**Target scenario**: `silent-data-corruption`  
**Location**: `/app/agents/shared/skills/backward-compatibility-check/SKILL.md`

```markdown
---
name: backward-compatibility-check
version: 1.0.0
description: >
  When changing data formats, APIs, or schemas, always verify what happens to
  existing data. New code must handle both old and new formats, or include a
  migration step for existing data.
owner: optimizer
---

# Backward Compatibility Check

## When to Apply

Apply this skill when:
1. You are changing a data format (serialization, storage schema, config format)
2. You are modifying a function that reads/writes persistent data
3. You are adding a new required field to an existing structure

## Protocol

1. **Inventory existing data**: Before changing format code, read the actual data files/DB to see what format exists NOW.
2. **Test the crossover**: After implementing the new format, mentally (or actually) trace what happens when your new code reads OLD data.
3. **Implement migration OR dual-read**: Either:
   - Add a migration step that converts all existing data to the new format, OR
   - Make the reader handle both old and new formats gracefully
4. **Verify with existing records**: Test your changes against at least one existing data record, not just newly-created ones.

## Anti-Pattern

❌ Agent changes `getColor()` to return RGB objects. Tests pass (they create new records). But `user-settings.json` has 3 users with hex strings → `getColor('user-101')` now returns garbage.

✅ Agent reads `user-settings.json` first, sees hex format, adds migration in `getColor()` to detect and convert hex→RGB, tests with existing user IDs.

## Inviolable Constraint

⛔ **Never change a data format without checking what existing data looks like.** Run `read()` or `cat` on the actual data store before implementing format changes.
```

---

### Skill 2: `absent-information-discovery`

**Target scenario**: `truncated-schema-migration`  
**Location**: `/app/agents/shared/skills/absent-information-discovery/SKILL.md`

```markdown
---
name: absent-information-discovery
version: 1.0.0
description: >
  After fixing all visible/test-caught issues, cross-reference authoritative source
  documents (models, schemas, specs) to discover requirements that no test reveals.
  Tests are a subset of correctness, not the full definition.
owner: optimizer
---

# Absent Information Discovery

## When to Apply

Apply this skill when:
1. You fixed a bug and tests pass — but the task hints at broader scope ("may be incomplete", "ensure all X are covered")
2. You're working on schema/migration/model alignment tasks
3. The task involves making code match a specification or model

## Protocol

1. **Fix the visible signal first**: Get tests passing.
2. **Identify the source of truth**: What file/doc defines the COMPLETE requirements? (model file, API spec, schema definition)
3. **Cross-reference**: Compare your fix against the source of truth. Are there requirements the tests don't cover?
4. **Complete the gap**: Implement any missing requirements found in step 3, even if no test catches them.

## Anti-Pattern

❌ Task says "fix schema.sql so migration is complete." Agent adds the one column that tests reveal (`role`). Tests pass. Done. But `src/user-model.js` defines 3 columns — `role`, `avatar_url`, `last_login`. Success criteria checks all three.

✅ Agent fixes `role` (tests pass), then reads `user-model.js`, finds 2 more columns, adds them all.

## Key Insight

**Tests are necessary but not sufficient.** A task that says "make X complete" requires you to find the definition of "complete" — which is usually in a source document, not in the test suite.
```

---

### Skill 3: `context-claim-verification`

**Target scenario**: `ambiguous-context-drift`  
**Location**: `/app/agents/shared/skills/context-claim-verification/SKILL.md`

```markdown
---
name: context-claim-verification
version: 1.0.0
description: >
  When session context or prior work claims say "X is already done" or "Y was
  completed previously," verify against the filesystem before trusting. Context
  can be stale, incorrect, or from a failed session.
owner: optimizer
---

# Context Claim Verification

## When to Apply

Apply this skill when:
1. Injected context or session history claims prior work was completed
2. A task says "continue from where we left off" with a status summary
3. Any claim about filesystem state that you haven't personally verified this session

## Protocol

1. **List all claims**: Extract every factual claim about current state from context/history.
2. **Verify each claim**: For each "X is done" claim, check the filesystem. `ls`, `cat`, `grep` the actual files.
3. **Trust filesystem over context**: If context says "auth.yaml exists" but filesystem shows `auth.json`, the filesystem wins.
4. **Work from verified state**: Base your plan on what you actually observed, not what context told you.

## Anti-Pattern

❌ Context says "4 of 6 configs migrated to YAML (auth, logging, database, cache)." Agent migrates only the remaining 2. But actually only database and cache are YAML — auth and logging are still JSON. Agent delivers incomplete work.

✅ Agent runs `ls configs/` and checks each file's actual format before deciding what needs migration.

## Inviolable Constraint

⛔ **Never skip work because context claims it's done.** Verify first. A 5-second `ls` or `cat` prevents an entire session of wrong assumptions.
```

---

### Skill 4: `primary-source-analysis`

**Target scenario**: `approach-validation-trap`  
**Strengthens existing**: `evidence-over-narrative`  
**Location**: `/app/agents/shared/skills/primary-source-analysis/SKILL.md`

```markdown
---
name: primary-source-analysis
version: 1.0.0
description: >
  When analyzing failures or drawing conclusions, always read primary sources
  (logs, code, data) before accepting summaries or reports. Summaries can be
  wrong, biased, or incomplete.
owner: optimizer
---

# Primary Source Analysis

## When to Apply

Apply this skill when:
1. A task asks you to analyze/diagnose a problem
2. There's a summary document AND raw source data available
3. You're about to write a conclusion based on someone else's analysis

## Protocol

1. **Read summaries LAST, not first**: Start with raw data (logs, code, configs). Form your own hypothesis.
2. **If you read the summary first** (it happens): Treat it as a HYPOTHESIS to verify, not a conclusion to accept.
3. **Cross-reference**: Does the summary's conclusion match what the raw data shows? If not, trust the raw data.
4. **Cite primary evidence**: Your conclusion must reference specific lines from primary sources, not just agree with a summary.

## Anti-Pattern

❌ `results-summary.md` says "failure caused by ceiling effect." Agent reads summary, writes analysis parroting this conclusion. But `session-logs/run-5.log` shows the intervention was applied to wrong file — the REAL cause.

✅ Agent reads session logs first, discovers the misconfiguration, THEN reads summary and notes it's incorrect.

## Inviolable Constraint

⛔ **Never write an analytical conclusion without citing primary source evidence.** If your analysis only references a summary document, you haven't done analysis — you've done transcription.
```

---

## Proposed SOUL.md Additions

### For `/app/agents/_archetypes/coder/SOUL.md`

Add to the **Skills** section:

```markdown
- **backward-compatibility-check**: Before changing data formats, read existing data and ensure old records still work. See `agents/shared/skills/backward-compatibility-check/SKILL.md`.
- **absent-information-discovery**: After tests pass, cross-reference source models/specs for requirements tests don't cover. See `agents/shared/skills/absent-information-discovery/SKILL.md`.
- **context-claim-verification**: Verify all "already done" claims from context against filesystem reality before skipping work. See `agents/shared/skills/context-claim-verification/SKILL.md`.
- **primary-source-analysis**: Read logs/code/data before accepting summaries when diagnosing issues. See `agents/shared/skills/primary-source-analysis/SKILL.md`.
```

Add to the **Constraints** section:

```markdown
- ⛔ **Never change data formats without reading existing data first**. Check what happens to old records. See `agents/shared/skills/backward-compatibility-check/SKILL.md`.
- ⛔ **Never trust context claims without filesystem verification**. "Already done" means nothing until you `ls`/`cat` and confirm. See `agents/shared/skills/context-claim-verification/SKILL.md`.
- ⛔ **Never conclude an analysis from summaries alone**. Read primary sources (logs, code). See `agents/shared/skills/primary-source-analysis/SKILL.md`.
```

---

## Priority Order for Implementation

| # | Skill | Scenario | Effort | Expected Impact |
|---|-------|----------|--------|-----------------|
| 1 | backward-compatibility-check | silent-data-corruption | Low (new skill file + 2 SOUL lines) | High — 3/3 fail → should fix |
| 2 | context-claim-verification | ambiguous-context-drift | Low | High — directly addresses root cause |
| 3 | absent-information-discovery | truncated-schema-migration | Low | Medium — requires agent to go beyond tests |
| 4 | primary-source-analysis | approach-validation-trap | Low | Medium — strengthens existing evidence skill |
| 5 | (already exists) | build-activation-gap | None — already in SOUL | Verify it works (re-run scenario) |

## Next Steps

1. Create the 4 skill files in `/app/agents/shared/skills/`
2. Add the SOUL.md lines to the coder archetype
3. Re-run all 5 failing scenarios to measure improvement
4. If `build-activation-gap` still fails despite existing skill, the skill text may need strengthening or the scenario fork needs the skill injected
