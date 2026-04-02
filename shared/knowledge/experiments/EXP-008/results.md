# EXP-008 Results: Verify-After-Edit Skill Effectiveness

**Date**: 2026-04-02
**Status**: COMPLETE
**Verdict**: NULL RESULT — skill text had no measurable effect

## Hypothesis
The `verify-after-edit` skill installed in coder/skills/ causes the agent to read files back after editing, improving pass rate on convention-verify-edit scenario's C2.3 check.

## Design
- **Scenario**: convention-verify-edit
- **Control**: coder WITHOUT verify-after-edit.md (lab fork `coder-no-verify-skill`)
- **Treatment**: coder WITH verify-after-edit.md (production coder)
- **Runs per arm**: 5
- **Primary metric**: C2.3 (verify-after-edit) pass rate
- **Secondary metric**: Overall pass rate

## Results

### Control (NO skill) — 5 runs
| Run | C2.3 | C3 | Overall |
|-----|------|-----|---------|
| 1   | ✅   | ✅  | PASS    |
| 2   | ❌   | ✅  | FAIL    |
| 3   | ✅   | ✅  | PASS    |
| 4   | ✅   | ✅  | PASS    |
| 5   | ✅   | ✅  | PASS    |
| **Total** | **4/5 (80%)** | **5/5 (100%)** | **4/5 (80%)** |

### Treatment (WITH skill) — 5 runs
| Run | C2.3 | C3 | Overall |
|-----|------|-----|---------|
| 1   | ✅   | ✅  | PASS    |
| 2   | ❌   | ✅  | FAIL    |
| 3   | ✅   | ✅  | PASS    |
| 4   | ✅   | ✅  | PASS    |
| 5   | ✅   | ✅  | PASS    |
| **Total** | **4/5 (80%)** | **5/5 (100%)** | **4/5 (80%)** |

### Comparison
| Metric | Control | Treatment | Δ |
|--------|---------|-----------|---|
| C2.3 pass rate | 80% | 80% | 0% |
| Overall pass rate | 80% | 80% | 0% |
| C3 pass rate | 100% | 100% | 0% |

## Analysis

### The skill text had zero effect.
Both arms showed identical 4/5 pass rates (80% C2.3) across 5 runs. The verify-after-edit skill markdown, despite being detailed with examples, did not change agent behavior.

### Why: Behavioral pattern depends on tool selection, not instructions
Transcript analysis of failing runs reveals the mechanism:

**Passing runs (typical pattern, 6 tool calls):**
`read → bash → write → bash(validate) → read(verify) → finish`

The agent uses `write()` for the edit, then naturally follows up with `read()` to verify.

**Failing runs (typical pattern, 3 tool calls):**
`read → bash(edit+validate combined) → finish`

The agent uses `bash` to do the edit AND validation in a single Python/Node one-liner. It considers the bash output sufficient verification and never calls `read()` separately.

### Key Insight
The agent's decision to use `bash` vs `write()/edit()` for the file modification is what determines whether read-back happens. When the agent chooses the `bash` shortcut, it bypasses the write→read chain entirely. No amount of skill text can influence this branching decision — it's made before the skill's instructions would apply.

### Consistency with Prior Findings
This confirms the broader finding from 0/18 text-injection experiments: **instructional text in the system prompt does not reliably change agent behavior.** The skill text is a prompt instruction; the agent may read it but doesn't consistently follow it when it chooses an alternative code path.

## Implications
1. **Skills-as-text are unreliable** for behavioral compliance — they work only when the agent happens to follow a compatible code path
2. **Workflow enforcement** (splitting edit/verify into separate sessions) remains the reliable approach
3. The 80% baseline pass rate means the agent ALREADY verifies most of the time without the skill — the skill is redundant
4. Future skill design should focus on structural enforcement, not instructional text
