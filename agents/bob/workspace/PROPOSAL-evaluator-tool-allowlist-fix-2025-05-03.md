# PROPOSAL: Fix Evaluator False-Positive on `notify` and `agents` Tools

**Date**: 2025-05-03  
**Author**: bob  
**Priority**: P1 (affects eval accuracy for all agents using notify)  
**Status**: DEPLOYED (2025-05-03, added to evaluator/context.md)

## Problem

The evaluator consistently penalizes agents (especially bob) for using the `notify` tool, marking it as "non-existent/unauthorized." This drops quality scores to 0.15-0.25 — a severe false positive.

### Evidence
From bob's last 209 evals (avg 0.43), 50% of low-quality evals (<0.4) are caused by this single issue:
```
Q=0.15: "Used a non-existent/unauthorized tool: [tool_call: notify]"
Q=0.25: "Used a non-existent tool: `notify` is not in the allowed tool list"
Q=0.25: "Used a non-existent tool: `notify`"
Q=0.35: "Used a non-permitted/non-listed tool `notify`"
```

### Root Cause
The evaluator's `TOOLS.md` lists only its own tools: `read, write, edit, bash, cite-source, finish`.  
When evaluating OTHER agents' sessions, it appears to reference this list (or a similarly incomplete one) as the canonical tool allowlist, failing to recognize that agents have access to:
- `notify` — one-way FYI notifications
- `agents` — fork/call/list/peek/cancel subagents
- `workflow` — run predefined workflows
- `checkpoint` — save progress mid-session
- `system_status` — dashboard of system activity
- `finish` — signal turn completion (already listed)

## Impact
- Bob's eval score depressed by ~0.15 points on average due to this single bug
- Any agent using `notify` (the recommended lightweight communication tool) gets penalized
- Creates perverse incentive to avoid `notify` in favor of heavier `agents.fork`

## Proposed Fix

### Option A: Add tool reference to evaluator context (Recommended)
Add to `agents/evaluator/context.md`:
```markdown
## Agent Tool Allowlist (for evaluations)
All agents have access to: read, write, edit, bash, agents, notify, workflow, checkpoint, system_status, finish
Individual agents may have additional tools (e.g., cite-source for evaluator).
Do NOT penalize agents for using any tool in this list.
```

### Option B: Add to SOUL.md evaluation criteria
Add explicit note that `notify` and `agents` are system-level tools available to all agents.

### Option C: Structural fix in eval prompt
Ensure the evaluation prompt template includes the target agent's actual tool list when scoring.

## Validation
After fix deployment, bob's eval avg should rise from 0.43 to ~0.55+ within 20 evals (eliminating the ~50% false-positive penalty instances).

## Next Steps
1. Get tech-lead or may to approve approach
2. Implement Option A (simplest, lowest risk)
3. Monitor eval scores for 24h post-deployment
