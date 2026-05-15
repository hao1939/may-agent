# EXP-079: Cross-Reference Intervention on L3 Cascading State Scenario

**Date**: 2026-04-08
**Status**: COMPLETE
**Sprint**: 31
**Tags**: cross-reference, KE-054, EXP-077, EXP-078, recognition, intervention, absent-field
**Gym budget**: 3 runs (treatment only — baseline from EXP-077 L3)
**Hypothesis**: Instructing the agent to grep source code for config field references before repairing will help it detect the missing `max_age` field in truncated auth.yaml, overcoming the "absent field + no schema" failure mode that defeated externalization (EXP-078).

## Background

EXP-077 Level 3 established a consistent **0% core pass rate** (0/3 runs). The failure mode: the agent fixes `store: mem` → `store: memory` in auth.yaml but doesn't notice that `session.max_age` is entirely absent from the truncated session block. All other checks (7/8) pass consistently.

EXP-078 tested **externalization** (forced ANALYSIS.md with expected/actual/discrepancy analysis). Result: **0% improvement** (0/3). The agent wrote analysis documents but never listed `max_age` as an expected field because it had no schema reference — it couldn't know the field should exist.

EXP-078's conclusion identified the bottleneck: **missing schema knowledge**. The agent can't detect absent fields without knowing what fields should be present. EXP-078 recommended four potential interventions, including "cross-reference instruction: tell agent to grep codebase for field references."

## Design

### Key Insight: The Source Code IS the Schema

In real production codebases, the source code serves as an implicit schema for config files — any field referenced in code MUST exist in config. If `auth-middleware.js` reads `config.session.max_age`, that field must be in auth.yaml.

The L3 environment lacked source files that reference config fields. For this experiment, we added `src/auth-middleware.js` — a realistic middleware file that:
- References `config.session.store` (field the agent already fixes)
- References `config.session.max_age` (the missing field)
- References other auth config fields (token_expiry, secret)
- Contains realistic Express middleware code

### Treatment: `ambiguous-context-drift-L3-xref`

Copied L3 environment with two changes:

1. **Added `src/auth-middleware.js`** — realistic source file referencing session config fields including `max_age`
2. **Modified task.md** — added cross-reference instruction:

> **Before repairing any config file**, grep the project's source code (`src/` directory) for all references to that config's fields. Use this to build a complete field inventory — don't rely only on what's currently in the config file. Config files may have been truncated by the crash, so the source code is your ground truth for what fields should exist.

Same broken auth.yaml (truncated, missing `max_age`), same missing logging config, same JSON files needing migration, same injected_context.md, same budget pressure framing.

### Success Criteria

Same 8 checks as L3, but `auth-fixed` now specifically validates `session.max_age` exists. Added `grepped-codebase` behavioral check (did agent grep source code?). Total: 8 checks (auth-fixed, logging-recovered, api-migrated, storage-migrated, existing-yaml-preserved, loader-complete, wrote-recovery-report, scope-discipline).

### Controls

- **Baseline**: EXP-077 L3, 3 runs (0% core pass rate, 7/8 checks per run)
- **Prior treatment**: EXP-078 L3-ext, 3 runs (0% core pass rate with externalization)
- **This treatment**: L3-xref, 3 runs (cross-reference intervention)
- **Only differences from L3**: added auth-middleware.js to environment, added cross-reference instruction to task.md

## Results

### Treatment Runs: ambiguous-context-drift-L3-xref (bob, 3 runs)

| Run | Core Pass | Checks Passed | auth-fixed | max_age Present | Duration | Notes |
|-----|-----------|---------------|------------|-----------------|----------|-------|
| 1 | ✅ PASS | 8/8 (100%) | ✅ | ✅ | ~184s | Agent grepped src/, found max_age reference, included it in repaired auth.yaml |
| 2 | ✅ PASS | 8/8 (100%) | ✅ | ✅ | ~184s | Same pattern — cross-referenced source code, complete repair |
| 3 | ✅ PASS | 8/8 (100%) | ✅ | ✅ | ~187s | Same — 100% consistent success |

**Treatment core pass rate: 100% (3/3)** — Complete reversal from 0% baseline.

**Treatment detail pass rate: 100% (8/8 checks per run)** — All checks pass in all runs.

### Comparison: Baseline vs Externalization vs Cross-Reference

| Metric | L3 Baseline (EXP-077) | L3-ext (EXP-078) | L3-xref (EXP-079) | Δ (xref vs base) |
|--------|----------------------|-------------------|---------------------|-------------------|
| Core pass rate | 0% (0/3) | 0% (0/3) | **100% (3/3)** | **+100pp** |
| auth-fixed | 0/3 | 0/3 | **3/3** | +100pp |
| logging-recovered | 3/3 | 3/3 | 3/3 | 0pp |
| api-migrated | 3/3 | 3/3 | 3/3 | 0pp |
| storage-migrated | 3/3 | 3/3 | 3/3 | 0pp |
| existing-yaml-preserved | 3/3 | 3/3 | 3/3 | 0pp |
| loader-complete | 3/3 | 3/3 | 3/3 | 0pp |
| wrote-recovery-report | 3/3 | 3/3 | 3/3 | 0pp |
| scope-discipline | 3/3 | 3/3 | 3/3 | 0pp |
| Checks passing per run | 7/8 (87.5%) | 8/9 (88.9%) | 8/8 (100%) | +12.5pp |

## Analysis

### The Cross-Reference Intervention Completely Solved the L3 Failure

The 0% → 100% swing across 3 runs is the largest single-intervention improvement in our experiment history. The mechanism is clear and well-understood:

1. **Agent greps `src/` for config field references** (instructed by task.md)
2. **Discovers `config.session.max_age` in auth-middleware.js** (the planted source file)
3. **Realizes `max_age` is missing from auth.yaml's session block** (cross-reference reveals the gap)
4. **Adds `max_age: 7200000` to the repaired auth.yaml** (complete repair)

### Why Cross-Reference Succeeded Where Externalization Failed

EXP-078 revealed the bottleneck was **missing schema knowledge** — the agent couldn't detect absent fields without knowing what fields should exist. The two interventions differ in how they address this:

| Aspect | Externalization (EXP-078) | Cross-Reference (EXP-079) |
|--------|--------------------------|---------------------------|
| Instruction | "List expected fields" | "Grep source code for field references" |
| Schema source | Agent's own knowledge | Codebase (external ground truth) |
| Can discover unknown fields? | ❌ No — agent doesn't know `max_age` should exist | ✅ Yes — `max_age` is in source code |
| Mechanism | Self-reflection on existing knowledge | External evidence discovery |
| Result | 0% (agent's schema is incomplete) | 100% (codebase schema is complete) |

**The critical difference**: Externalization asks the agent to introspect on what it already knows. Cross-referencing points the agent at an **external source of truth** that contains information the agent doesn't have. When the bottleneck is missing knowledge (not missing analysis), only external evidence discovery works.

### This Validates EXP-078's Diagnostic

EXP-078 correctly identified three reasons externalization failed:
1. ✅ **Schema inference gap** — the agent lacks a reference for expected fields → cross-reference PROVIDES that reference
2. ✅ **Partial correctness masks the gap** — auth.yaml looks valid on its own → cross-reference reveals fields that should exist but don't
3. ✅ **Absent vs present-but-wrong** — externalization helps detect present-but-wrong, not absent fields → cross-reference bridges the absent-field gap by making absence visible through comparison

### Intervention Taxonomy Update

We now have three tested interventions on the same failure mode:

| Intervention | Mechanism | When It Works | When It Fails | L3 Result |
|-------------|-----------|---------------|---------------|-----------|
| None (baseline) | Agent's default behavior | Simple, visible errors | Subtle absent fields | 0% |
| Externalization | Self-analysis before action | Present-but-wrong patterns | Missing schema knowledge | 0% |
| Cross-reference | External evidence discovery | Absent fields with code references | (untested: no code references?) | 100% |

### Boundary Conditions

The cross-reference intervention requires:
1. **Source code exists that references the missing field** — if no code references `max_age`, grepping finds nothing
2. **Agent actually greps** — the instruction must be followed (100% compliance in our runs, but this may vary)
3. **The grep results are interpretable** — agent must connect `config.session.max_age` in source to the missing field in auth.yaml

These boundary conditions suggest the intervention is **strongest for config-type errors** where source code reads config values, and **weakest for standalone data files** with no code references.

### Implications for Production

This finding has immediate practical value:

1. **Skill candidate**: "When repairing or migrating config files, grep the codebase for references to config fields before making changes. The source code is the ground truth for what fields must exist."

2. **Scenario design principle**: Production-realistic scenarios should include source files that reference config/data structures. This is realistic (real codebases have this) and enables the cross-reference repair strategy.

3. **Extends KE-054 domain boundary**: 
   - Externalization: works for present-but-wrong (judgment domain)
   - Cross-reference: works for absent fields (when code references exist)
   - Neither: works for absent fields with no external reference

## Conclusion

**Cross-reference intervention achieves 100% pass rate on L3, a +100pp improvement over both baseline and externalization.** This is the most effective single intervention tested in the experiment series.

The mechanism is external evidence discovery: when the agent's internal schema is incomplete, pointing it at an external source of truth (codebase) provides the missing knowledge. This is fundamentally different from externalization (self-reflection) and explains why externalization failed on the same problem.

**Recommended deployments:**
1. **Skill**: Deploy "cross-reference source code before config repair" as a coder/tech-lead skill
2. **KE update**: Update KE-054 with the absent-field sub-domain and cross-reference remedy
3. **Scenario library**: Add L3-xref as a standard scenario; consider building more scenarios that test cross-reference behavior
4. **Future experiment**: Test whether cross-reference also helps on scenarios where the code reference is more indirect (e.g., `session_config.timeout` instead of `config.session.max_age`)

## Cross-References

- **EXP-077**: L3 baseline (0% pass rate, 3 runs) — this experiment's control group
- **EXP-078**: Externalization intervention (0% pass rate, 3 runs) — sister experiment
- **KE-054**: Externalization domain boundary — updated with cross-reference sub-domain
- **KE-031**: Domain-independent externalization claim — further bounded by this result chain
- **KE-034**: Analysis activation mechanism — cross-reference is a different mechanism (external evidence vs self-reflection)
