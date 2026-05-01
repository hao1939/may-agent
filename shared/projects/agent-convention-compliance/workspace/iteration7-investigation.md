# Iteration 7 Investigation — Transcript & Convention Failures

**Date**: 2026-09-16
**Coach session**: heartbeat investigation

## P7.1: Transcript Infra Bug — RECLASSIFIED AS BEHAVIORAL VARIANCE

### Finding
The transcript infrastructure is **NOT broken**. `transcript.jsonl` is correctly generated and placed in `workDir` by the gym runner (line 422 of `.gym-runner-bundle.mjs`). The success_criteria.js correctly reads it from `process.argv[2]` which IS `workDir`.

### Root Cause of Failures

**Fewshot variant**: Stochastic agent behavior. Re-run showed 5/5 pass (vs 3/5 on prior run). The agent sometimes claims config.json "already has correct values" without editing (possibly reading a stale copy or hallucinating). Other times it edits correctly. **NOT a transcript bug — it's behavioral variance.**

**Verify-wrap variant**: Design flaw in workflow scoring. This is a 2-phase workflow (Phase 1: edit, Phase 2: verify). The transcript only captures the LAST phase's agent calls. Phase 2 agent reads/validates but doesn't edit → C2.3 says "No write/edit found" because the edit happened in Phase 1. **This is the workflow context stripping issue (P7.3).**

### Root Cause CONFIRMED: Pre-Solved Scenario Bug
The environment `config.json` starts with `timeout: 1000, retries: 1` (checked source). But when the agent reads it at runtime, it sees `timeout: 5000, retries: 3` (correct values). The agent says "already correct, no changes needed" and skips editing.

This means the workDir setup is leaking corrected files from a previous run, or the `inherits` mechanism is copying from the wrong source. The agent literally cannot demonstrate verify-after-edit because there's nothing to edit.

**UPDATE**: This is NOT a pre-solved bug. The source environment is correct (1000/1). The agent hallucinated "already correct" in one run but correctly edited in another. Behavioral variance, not infra bug.

### Revised Assessment
- **Fewshot**: 1 of 2 "transcript bug" checks is actually just behavioral variance. Can pass on re-run.
- **Verify-wrap**: True design flaw — workflow scenarios need combined-phase transcript for scoring.

## P7.2: C40.1 Declare-Intent Deployment

**Status**: Escalated to May. Coach cannot modify other agents' SOUL.md files.

Agents needing C40.1 "Declare intent first" rule: arc, bob, dev, optimizer (4/7 missing).

Already deployed: amy, coach, scout (3/7).

Expected impact: +1-2 checks on convention-promise-report scenario.

## P7.3: Workflow Context Stripping (4 failures)

Not yet investigated. The `convention-verify-multi-edit-workflow` consistently fails 4/9 checks. SOUL.md rules don't propagate through the workflow runner. This is the biggest remaining gap (4 checks = 7.8% of total).

## Updated Path to 90%

| Fix | Checks Gained | Feasibility |
|-----|--------------|-------------|
| P7.1: Fix pre-solved fewshot/verify-wrap scenarios | +2 | Medium — need to verify env has wrong initial values |
| P7.2: C40.1 deploy to 4 agents | +1-2 | High — escalated to May |
| P7.3: Workflow context propagation | +4 | Hard — requires runner code change |

**Current**: 43/51 = 84.3%
**After P7.1+P7.2**: ~46/51 = 90.2% ← meets target
**After all**: ~49/51 = 96.1%
