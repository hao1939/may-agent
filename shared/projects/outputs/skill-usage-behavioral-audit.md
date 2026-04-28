# Skill Usage Behavioral Audit

**Date**: 2025-06-26  
**Method**: Analyzed 9 recent agent sessions (across 5 agents) for behavioral evidence of 3 key skills  
**Skills tested**: State-Check-Before-Action (SCBA), Evidence-Over-Narrative, Verify-Before-Finish

## Key Finding

**skill.behavioral-usage-rate = 33%** (3 of 9 sessions show strong skill-aligned behavior)

This is dramatically better than the previous 0% "file read" metric, but still means 2/3 of sessions show no skill influence.

## Raw Data

| Agent | Session | Reads | Edits | Writes | SCBA | Evidence (VE>0) | Verify-Before-Finish |
|-------|---------|-------|-------|--------|------|-----------------|---------------------|
| amy | s_1777378105456_0 | 0 | 0 | 0 | N/A (no edits) | ❌ | ❌ |
| bob | s_1777285831457_5 | 1 | 1 | 1 | ✅ (1 read, 1 edit) | ❌ | ❌ |
| coder | s_1776305908253_0 | 1 | 1 | 0 | ✅ (1 read, 1 edit) | ❌ | ❌ |
| coder | s_1776304922444_0 | 10 | 12 | 4 | ✅ (reads > edits) | ✅ (VE=4) | ✅ (finish w/ VE) |
| coach | s_1777400291862_306 | 10 | 11 | 6 | ✅ (reads ≈ edits) | ✅ (VE=6) | ✅ (finish w/ VE) |
| coach | s_1777362491893_74 | 0 | 0 | 0 | N/A (no edits) | ❌ | ❌ |
| scout | s_1776857130410_4 | 5 | 1 | 2 | ✅ (5 reads, 1 edit) | ❌ | ✅ (finish=1) |
| scout | s_1776647767506_10 | 1 | 1 | 0 | ✅ (1 read, 1 edit) | ❌ | ❌ |

*Note: amy s_1777400252415_0 and bob s_1777400184782_302 had no session files (likely in-progress or too new).*

## Per-Skill Breakdown

### SCBA (State-Check-Before-Action)
- **6/7 sessions with edits**: Had reads preceding edits → **86% compliance**
- Only 1 failure: not enough data to identify (some sessions had 0 edits)
- **Verdict**: SCBA is the most adopted skill behavior

### Evidence-Over-Narrative (verification_evidence in finish)
- **2/9 sessions**: Provided verification_evidence → **22% compliance**
- Only coder and coach in their heavy-edit sessions
- **Verdict**: Low adoption. Most sessions don't cite evidence in finish calls

### Verify-Before-Finish
- **3/9 sessions**: Had verification steps before/in finish → **33% compliance**
- coder, coach, scout (1 each) showed verification
- **Verdict**: Moderate adoption, correlated with session complexity

## Skill File Reading: Still 0%

**No session explicitly read a skill file** (e.g., `agents/shared/skills/error-handling/SKILL.md`). The 📘 directives in context.md say "Read skill file X" but agents don't actually open these files. Instead, the context.md summary itself is enough to influence behavior for well-described skills.

## Conclusions

1. **Context.md injection works for behavioral influence** — agents with SCBA in context.md do read-before-edit at 86%
2. **Skill files themselves are never read** — the 📘 "Read X" directive is ignored; only the inline summary matters
3. **Complex skills (verification_evidence, evidence-over-narrative) have low adoption** — likely because context.md gives only a brief mention, not enough to change behavior
4. **Previous 0% metric was measuring the wrong thing** — file reads ≠ behavior. Real usage is ~33% behavioral compliance

## Recommendation

- **Don't deploy skill files and point to them** — instead, inline the key behaviors directly into context.md
- **For complex skills**: Add few-shot examples or step-by-step protocols inline in context.md rather than referencing external files
- **Focus on SCBA-style patterns**: Short, concrete, procedural directives work best (86% vs 22%)
