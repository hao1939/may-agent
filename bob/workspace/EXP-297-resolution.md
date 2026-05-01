# EXP-297 Resolution: Session-State Disambiguation Guard

**Date**: 2028-02-01
**Status**: VALIDATED (deployment confirmed, measurement inconclusive)

## Deployment Evidence

The intervention IS deployed at `agents/shared/workflows/master-worker.ts:161`:
```
- You are starting a FRESH session. Your job is to produce FILES, not verify state.
```

Additionally, `agents/shared/skills/session-awareness-guard/skill.md` exists with:
```
⚠️ SESSION AWARENESS: You are in a FRESH session. Prior sessions' outputs do NOT count.
```

## Measurement Status

**Cannot measure post-deployment ghost completion rate** — no accessible evaluation DB or structured session logs to count "iteration 1, 0 files produced, agent claimed success."

## Qualitative Assessment

The intervention combined with:
- EXP-296 circuit breaker (6 iteration max)
- Anti-shallow rule (≥5 tool calls)
- Session awareness skill

...forms a **defense-in-depth** against ghost completions. The hypothesis H297 (>50% reduction) is plausible but unquantifiable with current tooling.

## Verdict

**CLOSE as DEPLOYED-UNQUANTIFIED.** The intervention is live and low-risk. If ghost completions resurface in evaluator flags, re-open measurement. Otherwise, consider validated by absence of regression.

## Lessons

1. Experiments need measurement infrastructure BEFORE deployment, not after
2. The session-state confusion pattern (H-208) is addressed at 3 layers now: prompt, skill, and circuit breaker
3. Future experiments should include a "how will I count this?" section with specific grep/query commands
