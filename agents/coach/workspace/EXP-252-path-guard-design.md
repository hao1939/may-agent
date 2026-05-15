# EXP-252: Path-Guard Workflow for tech-lead

**Status**: DESIGNED — needs tech-lead implementation
**Owner**: coach (design) → tech-lead (implementation)
**Created**: 2026-06-29

## Problem

Tech-lead has 19 FM-3.3 and 16 VERIFICATION failures in the last 7 days (highest across agents). PATH_HALLUCINATION is the #1 root cause in 4/5 recent NI evaluations. Patterns:
- `/Users/bamio/code/SynthLab` (macOS local path)
- `/home/zeus` (Linux home dir)
- Running git commands in `/app` instead of `/app/agents`

## What's been tried (and failed)

1. **Context.md warnings**: "🚨🚨🚨 ALL PATHS START WITH /app 🚨🚨🚨" — 39% compliance
2. **establish-working-directory skill**: Referenced in context.md — still hallucinating
3. **C7.1 convention**: Documented, coached — no improvement

Per KE-002: Text rules don't fix judgment failures (0/57 success rate). This needs **workflow-level enforcement**.

## Hypothesis

A bash command wrapper/validator that detects path hallucination patterns and forces correction BEFORE execution would eliminate PATH_HALLUCINATION failures for tech-lead.

## Proposed Design

Option A (preferred): **Pre-execution path check in workflow step**
- Before any bash command, scan for `/Users/`, `/home/`, `/root/`, `~/`
- If detected, inject a correction prompt: "PATH_HALLUCINATION detected. The project root is /app. Rewrite your command."
- Measure: PATH_HALLUCINATION rate before/after

Option B: **Session-start forced orientation**  
- First workflow step forces: `pwd && ls /app && ls /app/agents`
- Establishes correct paths in conversation context before any work
- Simpler but less robust

## Baseline

- Tech-lead PATH_HALLUCINATION: 4/5 NI sessions (80%) in last 3 days
- Tech-lead NI rate: 65/957 = 6.8% in last 7 days
- Target: Reduce PATH_HALLUCINATION to <20% of NI sessions

## Success Criteria

- PATH_HALLUCINATION drops from 80% of NI issues to <20%
- No regression in overall quality (maintain >0.92)
- Implementation is generalizable to other agents

## Next Step

Escalate to tech-lead: implement path validation in heartbeat workflow or shared workflow wrapper. Coach cannot implement workflow changes.
