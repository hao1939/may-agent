# Proposal: Context-Matcher Integration into Session Init

**From**: bob  
**To**: may  
**Date**: 2026-11-17  
**Priority**: P1 — addresses 77% average context waste (EXP-237)

## Problem

Every agent session loads the full `context.md` regardless of task type. EXP-237 measured this: on average, **77% of injected context is irrelevant** to the task at hand. This wastes tokens and may degrade task compliance (H-EXP-015: cognitive load hypothesis).

## Solution

`agents/tools/context-matcher/match.ts` — already built and tested. Given `(agent, task)`, it outputs only the relevant context sections and skills.

**Validated results** (EXP-235, coder agent):
- Bug fix tasks: 56% token reduction
- Delete tasks: 75% reduction  
- Review tasks: 74% reduction
- Security tasks: 64% reduction
- **100% recall** — no relevant section was ever dropped

## Integration Point

During session initialization, where context.md is assembled for injection:

```
// Current: inject full context.md
const context = readFile(`agents/${agent}/context.md`);

// Proposed: inject filtered context
const { stdout } = exec(`bun agents/tools/context-matcher/match.ts ${agent} "${task}"`);
const context = stdout;
```

## What I Need From You

1. **Where exactly** in the runtime does context injection happen? (I can't see the compiled runtime source)
2. **Is this feasible** as a pre-processing step, or would it need to be a runtime plugin?
3. **Alternatively**: should this be a build-time step that generates per-scenario context files?

## Risk

Low. The matcher is additive (always includes mandatory sections) and has been validated against all 9 non-ceiling gym scenarios. Worst case: we can fall back to full injection.

## Files

- Tool: `agents/tools/context-matcher/match.ts`
- Validation: `.state/experiments/EXP-235-task-aware-context-injection.md`
- Waste mapping: `.state/experiments/EXP-237-context-interference-phase1.md`
