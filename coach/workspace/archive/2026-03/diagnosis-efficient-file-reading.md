# Diagnosis: efficient-file-reading (NON-CEILING 6/8)

## Baseline
- **Score**: 6/8 (confirmed across 2 runs)
- **Passes**: All 4 product checks + 2/4 convention checks (no-full-read-services, no-full-read-log)
- **Fails**: grep-first-reading:uses-grep-or-search, grep-first-reading:uses-targeted-reads

## What's happening
The coder reads chunks of the files using read() (tool truncation limits output) but doesn't use grep first to locate relevant content. It also doesn't use offset/limit parameters.

Interestingly, it DOES avoid full file reads (passes no-full-read checks) — probably because the read() tool auto-truncates. But it doesn't proactively use grep/rg to search, and doesn't use targeted reads with offset/limit.

## Attempted interventions
1. **Workflow enforcement (exp-235)**: 4/8 — WORSE. Two-phase split loses context. Phase 1 still doesn't use grep despite explicit instructions. Phase 2 has incomplete context.

## Assessment
This is a **tool usage habit** problem, not a judgment problem. The coder has the right intent (find degraded services, find their errors) but uses the wrong approach (read instead of grep, no offset/limit).

Text injection and workflow enforcement both fail here. This may require:
- Adapter-level changes (modifying how the agent's tools work)
- Or a fundamental model behavior we can't easily change
- The skill exists (grep-first-reading) but injecting it as text doesn't help

## Status: STUCK — no known effective intervention
