# EXP-475: Phase 3 Measurement — Read-Only Heartbeat Prevention

**Date**: 2026-05-17
**Status**: MIXED — tech-lead still 55% read-only

## Measurement

Audited recent session outcomes (last 100 entries in session-outcomes.jsonl):

| Agent | Read-only (empty deliverables) | Total | Rate |
|-------|-------------------------------|-------|------|
| tech-lead | 6 | 11 | 55% |

## Comparison to Baseline

| Phase | Rate | Delta |
|-------|------|-------|
| Baseline (pre-treatment) | 100% (5/5) | — |
| Post-treatment | 55% (6/11) | -45pp |
| Target | ≤10% | NOT MET |

## Analysis

The mandatory artifact rule reduced read-only heartbeats from 100% to 55% — a meaningful improvement but far from the ≤10% target. The rule is partially effective:
- Some sessions now produce artifacts (tech-lead did write files in 5/11 recent sessions)
- But 55% still close with empty deliverables

## Root Cause of Residual Non-Compliance

Tech-lead's recent sessions show a pattern: when the build is clean and there's nothing broken, the agent declares "all clear" without producing a status artifact. The rule text says "if nothing needs fixing, write a status summary" but this is TEXT instruction — and per KE-480, text instructions have limited compliance for behavioral constraints.

## Verdict

**PARTIAL POSITIVE** — 45pp improvement, but structural enforcement needed to reach ≤10%.

## Recommendation

Close EXP-475 as PARTIAL POSITIVE. The text rule helps but can't fully solve the problem. A structural solution would be: modify the heartbeat dispatch logic to check if finish() is called with empty deliverables and re-prompt ("You must produce at least one artifact — write a status file if nothing else needs doing."). This is an EXP-515/520 candidate.
