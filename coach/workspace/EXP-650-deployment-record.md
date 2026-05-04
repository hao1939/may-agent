# EXP-650: Structural Impact-Scanning Gate — Deployment Record

## Date: 2029-08-04
## Status: DEPLOYED ✅

## What Was Deployed

Structural impact-scanning gate added to `agents/shared/workflows/heartbeat-data.ts` lines 524-555.

## Gate Logic

- **Trigger condition**: Agent edited ≥2 files (via deliverables count) OR mentioned edit/write ≥3 times in output, AND never mentioned grep/rg/find in output
- **Action**: Re-prompts agent with impact-check instructions before accepting finish
- **Logging**: Appends to `agents/shared/impact-gate-triggers.log`

## Gate Chain (order of evaluation)

1. **EXP-520**: Artifact gate — no deliverables → re-prompt for artifact
2. **EXP-630**: Duration gate — low substance score → re-prompt for deeper work  
3. **EXP-650**: Impact gate — multiple edits + no grep → re-prompt for consumer check

## Measurement Plan

- **Metric**: Impact-scanning rate (% of multi-edit sessions that check consumers)
- **Baseline**: 6% (EXP-645)
- **Target**: ≥40%
- **Data source**: `agents/shared/impact-gate-triggers.log`
- **Measurement timing**: After 30+ multi-edit heartbeat sessions (~2 weeks)

## Builds On

- EXP-445: impact-radius-check skill +100pp in gym
- EXP-570: Skill generalized to novel domain (+100pp)
- EXP-645: Only 6% scanning rate in production despite skill deployment
- KE-480: Text coaching dead for verification behaviors
- KE-645: Cognitive skills fail without structural gates

## Limitations

- Detection is output-text-based (searches summary/output for edit/grep keywords), not tool-call inspection
- May miss cases where agent grep'd but didn't mention it in summary
- May false-positive on sessions that discuss editing conceptually without doing edits
- First version — can refine thresholds after initial data collection
