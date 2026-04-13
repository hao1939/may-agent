# EXP-154: Process Skill Effectiveness on Medium-Baseline Scenarios

**Date**: 2026-04-13
**Status**: IN PROGRESS
**Hypothesis**: H-154

## Background

The last 3 experiments (EXP-151, 152, 153) all failed to find skill effects due to ceiling effects (scenarios too easy) or floor effects (scenarios too hard). KE-175 establishes a "skill effectiveness window" requiring baseline variance and process-type skills.

**Key prior finding**: The coder agent has a `verify-after-edit` knowledge skill in production that explains *what* to verify after edits. Despite this, the agent fails the verify-after-edit check in 96% of `read-before-edit` runs (22/23). This suggests knowledge skills don't reliably change behavior (consistent with KE-021: process > knowledge > judgment skills).

## Hypothesis

**H-154**: A process-enforced workflow skill (with explicit step-by-step gates) improves agent behavior on medium-baseline scenarios by ≥20 percentage points over baseline, where a knowledge-only skill has already failed.

## Design

### Scenarios

| Scenario | Baseline | N (baseline) | Failure Mode | Why Selected |
|----------|----------|-------------|--------------|--------------|
| `read-before-edit` | 4.3% (1/23) | 23 | Agents pass ALL product/convention checks except C2.3 (verify-after-edit). Knowledge skill exists but doesn't work. | Perfect target: single clear failure, knowledge skill proven ineffective, process skill directly addresses gap |
| `conflicting-evidence` | 53.6% (15/28) | 28 | Agents identify the conflict (pass all behavior checks) but make the wrong fix (fail db-port-fixed + env-preserved). | Medium baseline with clear process gap: agents investigate correctly but don't reconcile evidence before fixing |

### Treatment: Process Workflow Skill

**Fork name**: `coder-exp154-process`

The treatment adds a **single process skill** that changes the agent's workflow, not just its knowledge. The key difference from existing knowledge skills:

- **Knowledge skill** (existing): "You should read back files after editing them"
- **Process skill** (treatment): "After EVERY edit() call, your literal next tool call MUST be read() of the same file. Do not proceed until you have confirmed the readback. This is step 2 of a 3-step atomic unit: read → edit → readback."

The process skill frames each edit as an **atomic 3-step unit** rather than advice to follow.

### Control: Production Baseline

**Fork name**: none (baseline runs)

The baseline already includes the `verify-after-edit` knowledge skill in `agents/coder/skills/verify-after-edit.md` — this IS the control condition. If the process skill works where the knowledge skill doesn't, that's the finding.

### Sample Size

- 5 trials per condition per scenario = 20 total runs
- Scenarios: 2 (read-before-edit, conflicting-evidence)
- With existing baseline data (23 and 28 runs), we can compare treatment against historical baseline

### Measurements

**Primary**: Pass rate (% of trials passing all checks)
**Secondary**: 
- For `read-before-edit`: C2.3 verify-after-edit check specifically
- For `conflicting-evidence`: db-port-fixed check specifically

### Controls

- ONE skill intervention per trial (KE-123: never stack)
- NO few-shot examples for discovery tasks (KE-133)
- Same scenario, same agent, same model — only the skill text differs

## Process Skill Text (Treatment)

See `workspace/process-skill-atomic-edit.md` for the full skill text used in the treatment fork.

## Predictions

1. `read-before-edit`: Treatment ≥40% pass rate (vs 4.3% baseline) — the atomic workflow frame forces readback
2. `conflicting-evidence`: Treatment ≥70% pass rate (vs 53.6% baseline) — evidence reconciliation before fixing prevents wrong-fix
3. If both show ≥20pp improvement, H-154 is supported: process skills work where knowledge skills fail
