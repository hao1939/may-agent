# Proposal: Add D-o-R Phase Structure to Coach Heartbeat

**Author**: Tech-lead  
**Date**: 2026-04-13  
**Target**: agents/coach/heartbeat.md  
**Motivation**: Workflow adoption stuck at 3/9 agents. Coach's experiment lifecycle is naturally phased — adding explicit phase structure prevents the #1 failure mode (50 ops of analysis, then no budget left for writing results).

## Change

Insert the following section **immediately before** the line `### Coach Work Session Examples` (around line 100):

```markdown
### ⚙️ Phase Structure for Work Sessions

Every work session should follow a phased approach. This prevents the #1 failure mode: doing 50 ops of analysis then running out of budget before writing results.

**Experiment lifecycle phases:**

| Phase | What | Budget | Gate to next phase |
|-------|------|--------|--------------------|
| **1. Design** | Read context, define hypothesis, success criteria, metrics | ≤5 ops | Hypothesis + criteria written to workspace/ |
| **2. Setup** | Create scenario, configure baseline, prepare gym | ≤5 ops | Scenario runnable, baseline defined |
| **3. Run** | Execute gym scenarios (baseline + treatment) | ≤15 ops | Raw results captured in workspace/ |
| **4. Analyze** | Compare results, compute metrics, write finding | ≤8 ops | Finding written to workspace/ |
| **5. Graduate/Reject** | Update EXP-XXX status, promote skill or reject hypothesis | ≤2 ops | Status updated, next steps clear |

**Phase rules:**
- **Checkpoint between phases.** If you're at budget after Phase 3, checkpoint results and finish — Phase 4 continues in the next session.
- **Write as you go.** Each phase produces a written artifact (design doc, baseline numbers, raw results, finding). Don't hold everything in context until the end.
- **Phase 1 cap: 5 ops.** If you need more than 5 ops to understand the task, the task description is too vague — escalate back to the heartbeat.
- **Never skip Phase 5.** A completed experiment without a status update is invisible to the team.
```

## Why This Matters

- Bob's old D-o-R workflow enforced phases mechanically; now verify-wrap handles Phase 3 (verify) but phases 1-4 are left to agent discipline
- Explicit phase budgets create natural checkpoints — sessions can resume across heartbeat gaps
- The phase gates prevent the "analyze forever, never write" anti-pattern that wastes 40+ ops/session
