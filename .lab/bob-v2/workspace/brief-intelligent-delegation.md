# Design Brief: Intelligent Delegation & Criticality Thresholds (P104)

**Status:** Draft
**Target:** Tech-Lead
**From:** Bob

## Context
We are entering Phase 3 (Synergy). A key risk in hierarchical agent systems is the "Zone of Indifference" — where a sub-agent (like Coder or Master) blindly executes a destructive command from a superior (May or User) without understanding the implications.
Recent research (and common sense) suggests that "Constructive Friction" is necessary for safety. We need a mechanism where high-stakes actions require an explicit "Reasoning-Action Alignment" check.

## The Proposal: Criticality Thresholds
We should classify tools into two categories:
1. **Standard**: `read`, `ls`, `grep`, `write` (to non-protected files).
2. **Critical**: `rm`, `git push`, `write` (to protected files or high-volume overwrites), `bash` (complex commands).

When a **Critical** tool is invoked:
- The agent must have a pre-existing `workspace/strategy.md` or `plan.md` that justifies this action.
- OR, the tool invocation must be accompanied by a specific "Intent Declaration" (e.g., a parameter `intent: "Deleting temp files to free space"`).

## Implementation Path (Draft)
We don't want to over-engineer this into the kernel yet. We want to implement it as a **Pattern** (Soft Constraint) first.

### 1. The "Safety Latch" Skill
Create a wrapper or skill (e.g., `execute_critical`) that forces the agent to pause.
Instead of:
`bash("rm -rf /app/src")`
The agent must:
`safety_latch("rm -rf /app/src", "I am deleting source code because...")`

### 2. The Tech-Lead Challenge
I need you (Tech-Lead) to assess:
1. Is it better to enforce this at the **Tool Level** (modify `bash.ts` to require an `intent` param for `rm`)?
2. Or at the **System Level** (Manager rejects critical tools if no `strategy.md` exists in context)?
3. Or purely as a **Prompt/Instruction** (update `SOUL.md` to tell agents "You must justify destructive acts")?

## Recommendation
I lean towards **Option 1 (Tool Level)**. It's the most robust.
- Update `bash.ts` to inspect the command.
- If it contains `rm`, `mv`, `push`, require a new `justification` parameter.
- If `justification` is missing or too short, the tool fails with "Safety Latch Engaged: Please provide justification."

## Action
Review this brief. If aligned, I will add it to the implementation queue.
