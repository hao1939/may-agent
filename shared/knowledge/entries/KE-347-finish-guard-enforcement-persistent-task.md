# KE-347: Finish-Guard Enforcement Is the Only Mechanism for Persistent-Task Adoption

**Rating**: ★★★★★
**Source**: EXP-188 (N=6, +100pp, PROMOTE verdict)
**Date**: 2026-06-23

## Core Finding

Finish-guard gates achieve +100pp improvement (0%→100%) in persistent-task workflow adoption. Text injection alone produces 0% adoption — agents read the instruction, do the work inline, and call finish(success) without invoking the workflow. The finish-guard blocks finish(success) unless the workflow has been called, creating an unavoidable enforcement point.

## Evidence

| Arm | N | Pass Rate |
|-----|---|-----------|
| Baseline (text injection only) | 3 | 0% |
| Treatment (finish-guard gate) | 3 | 100% |

Replicates EXP-184's identical +100pp result. The mechanism is purely structural: the agent literally cannot claim success without using the workflow.

## Key Insight

The finish-guard pattern represents the strongest form of Channel 2 enforcement — it operates at the session completion boundary (KE-160's "boundary-moment" principle), requires zero LLM judgment, and has a binary success criterion. This is the canonical example of KE-161 Law 1 (permanent structural enforcement > teaching).

## Deployment Status

✅ DEPLOYED as `agents/shared/guards/finish-guard.ts` with 41 passing tests. PROMOTE recommendation issued.

⚠️ **BLOCKED**: Guards are dead code — no runtime loads them. Tech-lead P0 sent 2026-04-22. The guard exists but has zero production effect until workflow engine wiring is implemented.

## Connections

- Extends KE-007 (workflow enforcement as only reliable intervention)
- Extends KE-129 (forced externalization for judgment tasks)
- Validates KE-160 (boundary-moment guard design)
- Validates KE-161 Law 1 (permanent infrastructure > teaching)
- Connects EXP-184, EXP-188
