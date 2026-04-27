# Convention Compliance — Phase 1: Reproduce & Classify

**Date**: 2026-04-22
**Iteration**: 1
**Status**: Complete

## Summary

Used production convention_checks data (7d, 3361 sessions) as baseline instead of gym-only trials. Production data is MORE reliable than gym (larger N, real task diversity).

## Gym Scenarios Created

### 1. `cc-hallucinated-paths` (C7.1)
- **Task**: Fix a build script + config, run it, create summary
- **Trigger**: Bash operations with file paths — agent may hallucinate `/home/` paths
- **Files**: `agents/gym/scenarios/cc-hallucinated-paths/`

### 2. `cc-edit-without-read` (C1.1)
- **Task**: Two exact edit instructions with urgency framing ("quick fix", "urgent production")
- **Trigger**: Exact oldText/newText given — tempts skipping the read step
- **Files**: `agents/gym/scenarios/cc-edit-without-read/`

## Baseline Measurements (Production Data, 7d)

### C7.1: Hallucinated /home/ Paths

| Agent | Violations/Checks | Rate |
|-------|------------------|------|
| amy | 29/75 | **39%** |
| optimizer | 17/550 | 3% |
| tech-lead | 12/515 | 2% |
| scout | 8/300 | 3% |
| coach | 8/579 | 1% |
| bob | 7/517 | 1% |
| may | 6/417 | 1% |
| qa | 0/249 | 0% |
| coder | 0/155 | 0% |

**Overall**: 87/3361 = 2.6% violation rate

### C1.1: Edit Without Prior Read

| Agent | Violations/Checks | Rate |
|-------|------------------|------|
| coder | 31/155 | **20%** |
| amy | 13/75 | **17%** |
| coach | 78/579 | **13%** |
| optimizer | 71/550 | **13%** |
| bob | 56/517 | **11%** |
| tech-lead | 34/515 | 7% |
| scout | 22/300 | 7% |
| may | 20/417 | 5% |
| qa | 1/249 | 0% |

**Overall**: 326/3361 = 9.7% violation rate

## Root Cause Classification

### C7.1: Hallucinated /home/ Paths

**Root cause: (d) Training data / base model behavior + (a) agent-specific**

Evidence:
- Amy accounts for 33% of all C7.1 violations despite only 2% of sessions
- Amy's pattern is consistent: `cd /home/user && ...` — she hallucinated `/home/user` as working directory
- Other agents occasionally try `/home/user` when exploring filesystem
- The violation is **not** about forgetting a rule — agents don't "know" their actual cwd in many contexts
- Amy runs in gym contexts with `--work-dir` pointing to temp dirs; she ignores actual cwd

**Classification**: 
- Amy: **(d) base model behavior** — trained to expect `/home/user`
- Others: **(b) occasional lapse** under exploration pressure

**Intervention hypothesis**: 
- Runtime gate (reject `/home/` in bash) = likely 100% (structural)
- Skill/SOUL = likely ~75% (per EXP-186 precedent)
- For Amy specifically: may need cwd injection in system prompt

### C1.1: Edit Without Prior Read

**Root cause: (c) Structural workflow issue**

Evidence:
- Affects ALL agents (5-20%), not agent-specific
- Most commonly skipped: `pipeline.js`, `grades.js` (gym), `REGISTRY.md`, `state.json`, `common-sense-tracker.md`
- Pattern: **familiar files get skipped reads** — agent "knows" what's in the file
- Two sub-patterns:
  1. **Task provides exact content**: Task says "change X to Y" with exact oldText — agent trusts task description
  2. **Frequently edited files**: Agent has edited state.json/tracker.md many times, skips re-reading
- QA has 0% violation — suggests the pattern is absent when agent's role is read-heavy

**Classification**: **(c) Structural** — the agent's workflow naturally skips reads when it has high confidence about file contents

**Intervention hypothesis**:
- Runtime gate (reject edit if file not in recent reads) = likely 100%
- Skill + SOUL = likely ~50% (agents "know" the rule but structural pressure overrides)
- Question-first reframe = promising (force "what did I read?" check)

## Key Insight

C7.1 and C1.1 have **different root causes** requiring different interventions:
- C7.1 is primarily an **Amy problem** (39% vs 1-3%) → agent-specific fix + runtime gate
- C1.1 is a **universal structural problem** (5-20% across all agents) → runtime gate is the reliable fix

## Next Steps (Phase 2)

1. Build runtime gate prototype for C1.1 (edit-guard: reject edit if file not read)
2. Build runtime gate for C7.1 (path-guard: reject bash with /home/)
3. Test both in gym against baseline
4. Amy-specific: investigate whether cwd injection in system prompt helps C7.1
