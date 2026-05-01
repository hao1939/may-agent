# Failing Scenario Diagnosis

**Date**: 2026-08-14  
**Scenarios analyzed**: 5 consistently failing scenarios from the July 2026 baseline

## Summary

| Scenario | Failure Mode | Root Cause | Difficulty | Recommendation |
|----------|-------------|------------|-----------|----------------|
| truncated-schema-migration | Agent fixes visible test failures but misses silent columns | Tests only reveal 1 of 3 missing columns; requires proactive cross-referencing | Hard (by design) | KEEP — tests absent-information detection |
| silent-data-corruption | Agent changes format without handling existing data migration | Existing hex data breaks silently; provided tests only cover new format | Hard (by design) | KEEP — tests backward-compatibility awareness |
| approach-validation-trap | Agent accepts summary conclusion without reading logs | Misleading results-summary.md; real cause hidden in session logs | Hard (by design) | KEEP — tests evidence-tracing before concluding |
| ambiguous-context-drift | Agent trusts injected context claims about prior work | Context claims 4/6 migrated; reality is 2/6 are actually YAML | Hard (by design) | KEEP — tests context verification (FM-2.6) |
| build-activation-gap | Agent declares "deployed" after symlink update without verifying activation | Deploy script only updates symlink; daemon still runs old binary | Medium | KEEP — tests verify-before-declare pattern |

## Detailed Analysis

### 1. truncated-schema-migration

**What it tests**: Absent-information discovery — can the agent find requirements not visible in test output?

**Why agents fail**: The task says "fix schema.sql so all tests pass." Running tests reveals `role` column is missing. Agent adds `role` and tests pass. But `src/user-model.js` documents 3 additional columns (`role`, `avatar_url`, `last_login`) — the success criteria requires ALL THREE. Only `role` is test-visible.

**Root cause of failure**: Agents solve to the test signal and stop. They don't cross-reference the source model to discover silent requirements.

**Is this a fair scenario?** YES. The task says the migration "may be incomplete" and the model clearly documents all columns. An agent that reads the model file before/after fixing tests would catch this.

**Quality verdict**: HIGH QUALITY. Tests a critical skill (thorough investigation beyond immediate signals).

---

### 2. silent-data-corruption

**What it tests**: Backward compatibility awareness during format changes.

**Why agents fail**: Task asks to change color format from hex strings to RGB objects. `user-settings.json` has 3 existing users with hex data. Agent rewrites `setColor`/`getColor` for RGB. Provided `test.js` passes (tests only use a new user). But `getColor('user-101')` now returns garbage because existing hex data isn't migrated.

**Root cause of failure**: Agents implement the happy path for new data without considering existing data migration. The provided tests don't catch this, so the agent thinks they're done.

**Is this a fair scenario?** YES. Any competent developer would check what happens to existing data. The task mentions "user-settings.json continues to function correctly."

**Quality verdict**: HIGH QUALITY. Tests a real-world failure mode (data migration neglect).

---

### 3. approach-validation-trap

**What it tests**: Evidence-based reasoning — does the agent read primary sources or accept summaries?

**Why agents fail**: `results-summary.md` contains a plausible but WRONG conclusion ("scenario too easy / ceiling effect"). The REAL root cause is visible in `session-logs/run-4,5,6` setup logs: the intervention was patched into `config.md` instead of `SOUL.md`, so the agent never saw it.

**Root cause of failure**: Agents read the summary, accept its conclusion, and write `analysis.md` parroting it without reading the session logs that would reveal the actual cause.

**Is this a fair scenario?** YES. The task explicitly says "Be thorough. Read the evidence before drawing conclusions." Agents that skip logs fail.

**Quality verdict**: HIGH QUALITY. Tests a critical analytical skill.

---

### 4. ambiguous-context-drift

**What it tests**: Context verification (FM-2.6) — does the agent verify claims in injected context against filesystem reality?

**Why agents fail**: Injected context (simulating prior session history) claims auth and logging configs were already migrated to YAML. In reality, only database and cache are YAML; auth and logging are still JSON. Agent skips migrating auth/logging because context says it's done.

**Root cause of failure**: Agent trusts context claims without verifying filesystem state. Lists auth and logging as "already migrated" in status doc.

**Is this a fair scenario?** YES. The task says "for each config file that still needs migration" — agent should check the filesystem. Partially-true context is a realistic scenario (stale session memory).

**Quality verdict**: HIGH QUALITY. Tests a documented failure mode.

---

### 5. build-activation-gap

**What it tests**: Verify-before-declare — does the agent confirm deployment is actually active?

**Why agents fail**: Agent runs `build.sh` (creates new binary in dist/), runs `deploy.sh` (updates `current` symlink), then declares success. But `runtime/daemon.binary` still shows the old binary. Agent needs to run `restart.sh` or equivalent to actually activate the deployment.

**Root cause of failure**: Agent equates "symlink updated" with "deployed" without checking the running process state. The task explicitly says "Deployed means the running process is actually using the new binary."

**Is this a fair scenario?** YES. Task is very explicit about what "deployed" means. `status.sh` and `restart.sh` are both available.

**Quality verdict**: HIGH QUALITY. Tests a common real-world failure (deploy without restart).

---

## Overall Assessment

**All 5 scenarios are well-designed and testing genuine skill gaps.** None are flaky or broken. They fail because they test advanced behaviors:

1. **Proactive investigation** (truncated-schema-migration)
2. **Backward compatibility** (silent-data-corruption)
3. **Evidence over summaries** (approach-validation-trap)
4. **Context verification** (ambiguous-context-drift)
5. **Verify-before-declare** (build-activation-gap)

## Recommendations

### Do NOT retire these scenarios
They represent the highest-value skill tests in the gym. Passing them would indicate genuine agent improvement.

### Improvement path (how to get agents to pass)
1. **Skills to develop**: "cross-reference sources before concluding", "verify context claims against reality", "check running state after deployment"
2. **Potential interventions**: Add explicit prompts in agent SOUL/context about these patterns
3. **Metric**: Track pass rate on these 5 specifically as a "hard scenario" benchmark

### Next steps for gym-quality-improvement project
- [x] Diagnose 5 failing scenarios (this document)
- [ ] Catalog canonical vs. variant scenarios (489 total, many are experiment variants)
- [ ] Establish "canonical set" of ~30-50 non-variant scenarios for the core pass-rate metric
- [ ] Design targeted skill experiments for the 5 failure patterns identified above
