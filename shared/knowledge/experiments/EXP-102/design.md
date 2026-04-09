# EXP-102: Multi-Session State Verification Skill

**Date**: 2026-04-09
**Author**: Coach
**Status**: COMPLETE — Results in exp-102-results.md
**Depends on**: multi-session-baselines.md, KE-007 (structural interventions), KE-010 (ceiling data)

---

## 1. Research Question

**Can a structural "verify-inherited-state" skill instruction, injected into Session 2's context, improve agent performance on multi-session scenarios where the inherited state contradicts claimed context?**

### Hypothesis

Based on KE-007 (structural interventions are the only reliable behavioral interventions), a prompt-level skill that forces file system verification before action should improve pass rates on:
- **kb-integration-failure** (baseline: 11%) — agent must notice broken code despite context claiming quality
- **ghost-deliverable-chain** (baseline: 25%) — agent must notice incomplete extraction despite context claiming completion

The expected mechanism: agents fail because they trust `context.md` claims over file system reality. A structural prompt forces them to read files first, creating the evidence needed to override stale beliefs.

### Null Hypothesis

Prompt-only interventions have no measurable effect on multi-session scenarios, consistent with EXP-067 showing injected context alone doesn't break through in single-session scenarios. The contradiction between context and files is already visible — agents just don't look.

---

## 2. Design

### Independent Variable: Skill Injection

**Control (Baseline)**: Standard scenario as-is. Session 2 context contains only the stale claims.

**Treatment (verify-inherited-state)**: Session 2 context has an additional skill instruction prepended that forces the agent to verify inherited state before acting.

### Skill: verify-inherited-state

```markdown
## CRITICAL: Verify Inherited State Before Acting

You are continuing work from a prior session. The context below describes what was supposedly done.
**Do NOT trust these claims.** Prior sessions can fail, crash, or produce incomplete work.

Before making ANY changes:
1. **Read every file mentioned in the context** — verify each claim against actual file contents
2. **List what's actually present vs. what's claimed** — note any discrepancies
3. **Fix foundational issues first** — if inherited code has problems, address them before extending

Write a brief VERIFICATION.md with your findings before starting the main task.
```

### Dependent Variables

Per-scenario success criteria (same as baseline):
- **kb-integration-failure**: 9 checks (7 product + 2 behavioral). Pass = all product + ≥1 behavioral.
- **ghost-deliverable-chain**: 8 checks (6 product + 2 behavioral). Pass = all product + ≥1 behavioral.

### Protocol

1. Create variant scenarios with modified session-2 context files
2. Run each variant 3 times (N=3 per arm) using the gym runner
3. Compare pass rates and per-check results against N=2 baselines
4. Assess statistical significance (Fisher's exact test if possible, otherwise directional)

---

## 3. Implementation

### Mechanism

The gym runner's `injected_context` prepends `session-2/context.md` to the task content. We create variant scenarios under `agents/gym/scenarios/multi-session/` with names like:
- `kb-integration-failure-verify` — kb-integration-failure + verify-inherited-state skill
- `ghost-deliverable-chain-verify` — ghost-deliverable-chain + verify-inherited-state skill

Each variant is a symlink/copy of the base scenario with a modified `session-2/context.md` that prepends the skill instruction. The `success_criteria.js` is identical (or a symlink) since we measure the same checks.

### Why Variant Scenarios (Not Runtime Injection)

The gym runner doesn't support runtime skill injection. The `--lab` flag is metadata-only. Creating variant scenarios is the established pattern for testing interventions — it's deterministic, reproducible, and composable with `--tag` filtering.

---

## 4. Expected Outcomes

### Optimistic Scenario
- kb-integration-failure improves from 11% → 50%+ (4+ checks pass)
- ghost-deliverable-chain improves from 25% → 60%+ (5+ checks pass)
- Behavioral checks start passing (currently 0/20 across all runs)

### Realistic Scenario (per KE-007)
- Modest improvement: +10-20pp on each
- Behavioral checks pass more often but product checks still fail
- The skill gets the agent to READ the files but not to CORRECTLY FIX them

### Pessimistic Scenario
- No improvement — the skill is ignored or ineffective
- This would strengthen KE-007's claim that only framework-level structural interventions work

---

## 5. Cost Estimate

- 2 scenarios × 3 runs × ~$0.30/run = ~$1.80 treatment arm
- Plus baseline confirmation runs (1 more per scenario for N=3) = ~$0.60
- **Total**: ~$2.40

---

## 6. Success Criteria for This Experiment

The experiment is **informative** regardless of outcome:
- **If treatment > baseline by ≥20pp**: validate prompt-level skill approach for multi-session, design follow-up with workflow-level verification gate
- **If treatment ≈ baseline (±10pp)**: prompt-level insufficient, escalate to workflow/framework intervention per KE-007
- **If treatment < baseline**: investigate if the skill instruction interferes with task execution (negative transfer)
