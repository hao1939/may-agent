# Skill: Critical Pause

**Purpose**: Force deliberate reasoning before high-stakes actions to prevent Imitation Collapse (FM-2.6) — where agents imitate success patterns without critically evaluating their actions.

**Based on**: Agentic Critical Training (ACT) research (arXiv:2603.08706). See `agents/bob/workspace/synthesis/2026-04-17-act-critical-training.md`.

## When to Use

Before any **high-stakes action**:
- Recursive delete (`rm -rf`, bulk file removal)
- Git push / force push
- Modifying core files (SOUL.md, INDEX.md, heartbeat.md, config files)
- Overwriting files without reading them first
- Running destructive database operations
- Promoting agent changes to production
- Any action that is **irreversible** or has **wide blast radius**

## Process

### 1. STOP
Do not execute the action yet. Pause and think.

### 2. OPTIONS — List at least 2 alternatives

| | Option A (Act Now) | Option B (Check First) |
|---|---|---|
| **Description** | Execute the planned action immediately | Verify preconditions / gather more info before acting |

You may generate more than 2 options if appropriate.

### 3. CRITIQUE — Evaluate each option

For each option, assess:
- **Risks**: What could go wrong? Is it reversible? Side effects?
- **Benefits**: Speed, correctness, completeness?
- **Assumptions**: What am I assuming is true? Have I verified it?

### 4. SELECT — Choose the best option

State which option you're selecting and why. If Option B (or a safer variant) reveals that your assumptions are wrong, update your plan.

### 5. EXECUTE — Run the chosen action

Proceed with the selected option.

### 6. LOG — Record the decision

After executing, briefly note what you considered and why you chose the path you did. This can go in your workspace journal or inline in your response.

## Example

**Scenario**: Agent needs to update `agents/coder/SOUL.md` with a new lesson.

```
CRITICAL PAUSE — Modifying core agent file

Option A: Write the new lesson directly to SOUL.md
  Risks: May overwrite existing content if file structure changed; could break formatting
  Benefits: Fast

Option B: Read SOUL.md first, then edit surgically
  Risks: Slightly slower
  Benefits: Preserves existing content; ensures correct placement; catches conflicts

Selected: Option B — Reading first is low-cost and prevents data loss.
```

## Anti-Patterns

- **Skipping the pause on "simple" changes**: Even small edits to core files can break agents. Pause anyway.
- **Generating options but not actually critiquing them**: The critique step is where the value is. Don't just list pros/cons mechanically — genuinely evaluate.
- **Always choosing the safe option**: Sometimes acting fast is correct. The point is to *think*, not to always be cautious.

## Connection to Principles

- **P109 (Break the Lock)**: The critique step breaks self-reinforcing bad plans.
- **P9 (Explore Then Harden)**: Critical pause is the "harden" phase of reasoning — you explored options, now commit deliberately.
