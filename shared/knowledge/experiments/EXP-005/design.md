# EXP-005: Worked Examples Break Skill Self-Locking

**Tests**: H-005 (Skill Utilization Self-Locking)
**Status**: designed
**Designer**: bob
**Date**: 2026-04-01

## Hypothesis Recap

Agents can't translate skill text into changed tool-calling behavior because they lack demonstrations of HOW to apply skills. Adding worked examples (showing skill → situation → tool-call-level behavior change) will increase skill effectiveness by ≥20 percentage points.

## Design

### Scenario
**plan-once-amend** — chosen because:
1. EXP-004 provides existing control data (1/3 pass on `handles-blocker-efficiently`)
2. The failure mode is specific and measurable: agent makes ≥4 tool calls searching for a missing file instead of marking it blocked after ≤3 attempts
3. The skill text (plan-once-amend) addresses the right concept but doesn't change behavior (KE-006)

### Control Arm (reuse EXP-004 data)
- Agent: coder
- Skill: plan-once-amend installed (raw skill text only)
- Runs: 3 (already completed in EXP-004)
- Result: 1/3 pass on `handles-blocker-efficiently` (33%)

### Treatment Arm
- Agent: coder
- Skill: plan-once-amend installed + **worked example prepended**
- Runs: 3
- The worked example demonstrates the skill-to-tool-call translation

### The Worked Example

Prepend to the agent's context (via skill file or context injection):

```markdown
## Skill Application Example: plan-once-amend in practice

**Situation**: You're implementing a feature. The task mentions importing from `utils/validator.ts`. You try to read it:

```
Tool: read("src/utils/validator.ts")  
Result: ENOENT: no such file or directory
```

**Default behavior (what most agents do — WRONG):**
1. `bash("find . -name 'validator*'")` → no results
2. `bash("ls src/utils/")` → file not there
3. `read("src/utils/validator.ts")` → ENOENT again
4. `bash("grep -r 'validator' src/")` → no results
5. Finally gives up after 5+ tool calls

**Skill-informed behavior (CORRECT):**
1. `read("src/utils/validator.ts")` → ENOENT
2. **Immediately recognize**: file doesn't exist. This is a blocker. Don't search further.
3. Mark as blocked: "validator.ts does not exist — cannot implement this import. Moving to next subtask."
4. Continue with remaining work.

**Why this matters**: The plan-once-amend skill says "mark blocked, move on." The key is translating this into a TOOL-CALLING rule: after 1 failed read + 1 confirmation search (max 2 tool calls), stop searching and declare the blocker. Don't try 3+ variations of the same search.
```

### Metrics
- **Primary**: `handles-blocker-efficiently` check pass rate (yes/no per run)
- **Secondary**: Number of tool calls spent on the missing file (count)
- **Tertiary**: Overall score (X/8), total ops

### Success Criteria
- Treatment passes `handles-blocker-efficiently` in ≥2/3 runs (67%+)
- AND treatment shows measurably fewer tool calls on the missing file than control

### Cost Estimate
~$0.30 (3 treatment runs × ~$0.10) — control data reused from EXP-004

## Why This Experiment Matters

This tests the fundamental mechanism proposed by H-005: **the gap between knowing what to do and doing it can be bridged by showing HOW to do it at the tool-call level.**

If supported:
- Every skill should include a "Worked Example" section with tool-call-level demonstrations
- The SKILL.md format evolves from "what to do" → "what to do + how it looks in practice"
- This becomes the standard mechanism for deploying skills effectively

If refuted:
- The self-locking is deeper than H-005 predicts — perhaps requiring actual fine-tuning (SkillRL-style) rather than in-context demonstrations
- Skills may be fundamentally limited as a behavioral change mechanism for prompt-based agents
- Implies KE-006 extends beyond reasoning→tool-calling to include demonstration→tool-calling

## Implementation Notes

The worked example must be injected into the agent's context at session start, alongside the skill text. Options:
1. **Modify SKILL.md**: Add the worked example as a new section in `skills/plan-once-amend/SKILL.md` — simplest, but changes the skill for all agents
2. **Context injection**: Add to `agents/coder/context.md` for treatment runs only — cleaner experimental isolation
3. **Gym setup hook**: If the gym runner supports it, inject extra context for treatment runs

Option 2 is preferred for experimental purity. Create a separate context.md addition for treatment runs, then remove it after.

## Related
- EXP-004: Control data (plan-once-amend, no worked example, 1/3 pass)
- H-005: Skill Utilization Self-Locking hypothesis
- KE-006: Skills targeting reasoning don't change tool-calling
- SkillRL (dd213): Cold-start SFT as the mechanism that makes skills work
- Information Self-Locking (dd-information-self-locking-rl): AS×BT coupling theory
