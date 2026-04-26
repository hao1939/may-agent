# Intervention Design Guide — Before You Run an Experiment, Read This

**Author**: Bob | **Date**: 2026-10-06
**Based on**: 100+ experiments, KE-101 (Theory of Agent Improvement), KE-397 (Text Intervention Quartet)

## Decision Tree: Will This Intervention Work?

```
Is the target behavior a JUDGMENT decision (what to do) or a FACT recall (what exists)?
├── FACT recall → Text MAY work (e.g., "npx not available, use bun")
│   └── But only if the fact changes the FIRST action, not a later decision
└── JUDGMENT decision → Text WILL NOT work (0/57 experiments, 0%)
    │
    ├── Can you change the ACTION SEQUENCE? (force step before acting)
    │   └── YES → Workflow/forced externalization → Expected: +50-93%
    │
    ├── Can you REMOVE the wrong option from the environment?
    │   └── YES → Infrastructure constraint → Expected: partial (~37% reduction)
    │
    ├── Can you AUTO-REWRITE the wrong action to the right one?
    │   └── YES → Environmental transform → Expected: UNTESTED (H-EXP-027)
    │
    └── None of the above?
        └── STOP. This failure mode may not be fixable with current tools.
```

## Anti-Patterns (Don't Do These)

| Anti-Pattern | Why It Fails | Examples |
|-------------|-------------|----------|
| Add skill file for behavior X | Suppressed by action-mode reasoning | EXP-224 (0%) |
| Inject information into task | Agent has info but still doesn't use it | EXP-225 (0%) |
| Context.md rule "do X not Y" | Invisible during execution | EXP-226 Arm A (0%) |
| Task prepend with instructions | Same channel as task, gets overridden | EXP-226 Arm B (0%) |
| Stack multiple interventions | Iatrogenic: -12pp average | KE-123 |

## What Actually Works

| Pattern | Mechanism | Evidence | Effect Size |
|---------|-----------|----------|-------------|
| Forced externalization | Write analysis → gate → act | KE-031, 17/17 scenarios | +69pp |
| Workflow restructuring | Phase 1 (assess) → Phase 2 (act) | H-EXP-012, 6 experiments | +58-93% |
| Infrastructure block | Environment prevents execution | EXP-223 | -37pp (partial) |
| Classify-then-act | Force classification before response | KE-029 | Eliminates sycophancy |

## Before Designing an Experiment, Ask:

1. **Is this a text intervention?** If yes, STOP unless it's a pure factual constraint.
2. **Does this change when the agent thinks vs. when it acts?** If no, it won't work.
3. **Can I test this without gym?** If not, check `GYM_AGENT_BIN` availability first.
4. **Has a similar intervention been tried?** Check EXP-220 through EXP-227 and KE-101.
5. **Am I stacking interventions?** Never combine 2+ behavioral interventions (KE-123).
