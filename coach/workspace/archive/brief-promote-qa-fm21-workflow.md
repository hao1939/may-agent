# Promotion Brief: QA FM-2.1 Fix via Workflow Enforcement

**From**: Coach  
**Date**: 2026-03-25  
**Experiment**: exp-qa-fm21-overstrict  
**Status**: PROMOTE  

## Problem

QA has 5 repeated FM-2.1 errors (OVER_STRICT_GATE). When `vitest --run` fails due to pre-existing environment issues (missing dependencies, unrelated module failures), QA blocks the patch entirely instead of distinguishing environment failures from patch-specific failures. This causes correct patches to be rejected.

## Evidence

- **Baseline**: QA fails `qa-overstrict-gate` scenario — 0/1 checks (doesn't even produce a review file)
- **Workflow variant (Method #15)**: QA passes 6/6 checks — correctly distinguishes environment failures, gives CONDITIONAL verdict, does not false-blame the patch

## Recommended Changes

### 1. Workflow Change (CRITICAL — this is the actual fix)

In `agents/tech-lead/workflows/implement-and-review.ts`, modify the `reviewTask` template to add two-phase guidance:

```typescript
const reviewTask =
  `Phase 1: DIAGNOSE — gather evidence before any verdict.\n` +
  `Read the changed files yourself and run checks yourself.\n\n` +
  `## Task Description\n${ctx.task}\n\n` +
  `## Coder's Summary (claims to verify — do NOT trust without checking)\n${coder.lastAssistantText}\n\n` +
  `Your job: verify the coder's claims by reading the actual files and running tsc/tests yourself.\n` +
  `IMPORTANT: If vitest fails, determine whether failures are caused by the patch ` +
  `or are pre-existing environment issues. Only blame the patch for failures it introduced.\n\n` +
  `Phase 2: VERDICT — now give your assessment based on Phase 1 evidence.\n` +
  `Form your own judgment. Report what YOU found, not what the coder said.`;
```

Apply similar two-phase framing to the review tasks in `verify-parallel.ts`.

### 2. QA SOUL Update (SUPPLEMENTARY — text alone won't fix it per Method #15 evidence)

Add to QA's `## Severity Calibration` section:

```markdown
### Environment vs Patch Failures (FM-2.1)
When `vitest --run` fails, **distinguish between pre-existing environment failures and failures caused by the patch under review**. If tests fail due to missing dependencies, unrelated modules, or pre-existing issues NOT introduced by the patch:
- Do NOT block the patch for environment failures
- Give **CONDITIONAL** verdict: "Patch is correct; environment has pre-existing issues: [list them]"
- Only FAIL for issues the patch actually introduced
```

### 3. Gym Scenario Available for Regression Testing

Both `qa-overstrict-gate` and `qa-overstrict-gate-workflow` scenarios exist in `agents/gym/scenarios/` for future regression testing.

## Method Evidence Summary

Method #15 (Workflow Enforcement) now has 41/44 (93%+) pass rate across 8 scenarios, 5 agents, 3 models. It is the ONLY method that reliably changes agent behavior. Text-based methods are 0/13 on judgment behavior.
