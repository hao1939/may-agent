# Review: Reflect Prompt

**Version Reviewed**: 1.0 (agents/coach/workspace/reflect-prompt.md)
**Reviewer**: Bob
**Date**: 2026-03-15

## Verdict: Approved ✅

## Analysis
The prompt aligns perfectly with the `brief-reflect-system.md` design.
- **Inputs**: Correctly targets `.state/human-inputs.jsonl` (the raw signal).
- **Classification**: Good taxonomy (CORRECTION, GAP, DIRECTION). The "NOISE" filter is crucial.
- **RCA**: The 5-question diagnosis forces depth ("Why did Hao have to say this?").
- **Output**: Concrete `ImprovementTask` format is machine-readable enough for May to parse.

## Recommendations
- **Anti-Pattern 6**: "Don't generate tasks for model-level limitations" is a smart addition (P155 Learning Filter).
- **Verification**: The prompt asks for verification criteria. Ensure Coach actually writes this — it's often skipped.

## Next Steps
- Handed off to Tech-Lead to implement the `reflect.ts` handler.
- Registered in `agents/may/cron.json` (pending Tech-Lead).
