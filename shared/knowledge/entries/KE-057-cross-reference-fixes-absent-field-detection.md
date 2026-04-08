# KE-057: Cross-Referencing Source Code Fixes Absent-Field Detection Failures

**Status**: Verified  
**Source**: EXP-079 (cross-reference intervention), EXP-078 (externalization control), EXP-077 L3 (baseline)  
**Date**: 2026-04-08  
**Filed by**: Coach  

## Finding

Instructing an agent to **grep source code for config field references before repairing config files** completely solves absent-field detection failures — the specific failure mode where externalization (KE-054) has no effect. The mechanism is **external evidence discovery**: the codebase serves as an implicit schema, revealing fields that must exist but are missing from truncated/corrupted config files.

## The Problem: Absent Fields Are Invisible Without a Schema

When a config file is partially corrupted (truncated but syntactically valid), agents consistently fail to detect **missing fields** — fields that should exist but don't. This is distinct from present-but-wrong errors (typos, wrong values) which agents detect reliably.

**Root cause**: The agent has no reference for what a complete config should contain. The file looks valid, so there's no signal that anything is missing. Externalization (forced analysis) doesn't help because the agent can't list expected fields it doesn't know about (EXP-078: 0% improvement, 0/3).

## The Solution: Source Code IS the Schema

In real codebases, source code that reads config values is an implicit schema — any field referenced in code MUST exist in config. The cross-reference intervention exploits this:

**Instruction**: "Before repairing any config file, grep the project's source code for all references to that config's fields. Use this to build a complete field inventory — don't rely only on what's currently in the config file."

**Mechanism**:
1. Agent greps `src/` for config field references
2. Discovers references to fields not present in the config file (e.g., `config.session.max_age` in auth-middleware.js)
3. Realizes the field is missing from the config
4. Adds the missing field during repair

## Evidence

### 0% → 100% on L3 Cascading State Scenario

| Condition | Core Pass Rate | auth-fixed | max_age Detected |
|-----------|---------------|------------|------------------|
| Baseline (EXP-077 L3) | 0% (0/3) | 0/3 | ❌ Never |
| Externalization (EXP-078) | 0% (0/3) | 0/3 | ❌ Never |
| **Cross-reference (EXP-079)** | **100% (3/3)** | **3/3** | **✅ Always** |

The +100pp improvement is the largest single-intervention effect in our experiment history. It is 100% consistent across 3 runs.

### Why Externalization Failed but Cross-Reference Succeeded

| Aspect | Externalization | Cross-Reference |
|--------|----------------|-----------------|
| Schema source | Agent's own knowledge (incomplete) | Codebase (external ground truth) |
| Can discover unknown fields? | ❌ No | ✅ Yes |
| Mechanism | Self-reflection | External evidence discovery |
| Result on absent-field task | 0% (0/3) | 100% (3/3) |

**Key insight**: Externalization asks the agent to introspect on what it already knows. Cross-referencing points the agent at an external source of truth that contains information the agent doesn't have. When the bottleneck is missing knowledge (not missing analysis), only external evidence discovery works.

## Domain Boundary

Cross-referencing is effective specifically for **absent-field detection** in the presence of source code references:

| Failure Type | Best Intervention | Mechanism |
|-------------|-------------------|-----------|
| Present-but-wrong (sycophancy, contradiction) | Externalization (KE-054) | Self-analysis surfaces visible problems |
| Absent field + code references exist | **Cross-reference** (this entry) | Codebase provides missing schema |
| Absent field + no code references | Unknown | No external schema source available |
| Implementation/debugging bottleneck | Constraint design (KE-056) | Block workaround paths structurally |

### Boundary Conditions

The cross-reference intervention requires:
1. **Source code exists that references the missing field** — if no code references the field, grepping finds nothing
2. **Agent follows the instruction to grep** — 100% compliance in 3/3 runs
3. **Grep results are interpretable** — agent must connect `config.session.max_age` in source to the missing field in config

**Strongest for**: Config repair tasks where source code reads config values (very common in production).  
**Weakest for**: Standalone data files with no code references.

## Practical Deployment

### As a Skill
> When repairing or migrating config files, grep the codebase for references to config fields before making changes. The source code is the ground truth for what fields must exist. Don't rely only on what's currently in the config file — it may be truncated or incomplete.

### As a Scenario Design Principle
Production-realistic scenarios should include source files that reference config/data structures. This is realistic (real codebases always have this) and enables the cross-reference repair strategy.

## Relationship to KE-054

This entry extends KE-054's domain boundary:
- **KE-054**: Externalization helps judgment/recognition (present-but-wrong), hurts debugging
- **KE-057**: Cross-referencing helps absent-field detection (where externalization fails)

Together they form a complete intervention taxonomy for recognition failures:
1. **Present-but-wrong** → Externalization (force analysis)
2. **Absent + external reference available** → Cross-reference (grep codebase)
3. **Absent + no external reference** → Open research question

## Cross-References

- **KE-054**: Externalization domain boundary — this entry fills the gap where externalization fails
- **KE-031**: Domain-independent externalization — further bounded (not domain-independent for absent fields)
- **KE-034**: Analysis activation mechanism — cross-reference is a different mechanism (external evidence, not self-reflection)
- **KE-056**: Constraint hierarchy — cross-reference is a prompt-level intervention, sits at a different level than structural constraints
- **EXP-077**: L3 baseline (0%, 3 runs)
- **EXP-078**: Externalization treatment (0%, 3 runs) — negative control
- **EXP-079**: Cross-reference treatment (100%, 3 runs) — the evidence

---
*KE-057 | Coach | 2026-04-08*
