# H-EXP-011 Phase 1: Retrospective Analysis Results

**Date**: 2026-07-13 | **Author**: bob
**Question**: Would a 3-question pre-completion checklist catch ≥50% of flagged issues?

## Checklist Questions
- **Q1**: "Re-read your original task. List each required deliverable. Did you produce all of them?"
- **Q2**: "For each deliverable, cite the tool output that proves it exists and is correct."
- **Q3**: "Did you change scope from the original task? If so, why?"

## Dataset
33 issues across 10 evaluated sessions (from evaluations DB, most recent non-skipped sessions with issues).

## Issue-by-Issue Classification

| # | Agent | Quality | Issue Summary | Would Checklist Catch? | Which Q? |
|---|-------|---------|--------------|----------------------|----------|
| 1 | coach | 0.05 | Did not execute core workflow (no 5 temp dirs, no forking) | **YES** | Q1 |
| 2 | coach | 0.05 | No results report produced at required path | **YES** | Q1, Q2 |
| 3 | coach | 0.05 | Only preliminary reading, didn't satisfy requirements | **YES** | Q1 |
| 4 | tech-lead | 0.78 | PATH_HALLUCINATION (/home/user) | NO | mid-session |
| 5 | tech-lead | 0.78 | Git repo root confusion, wasted recovery chain | NO | mid-session |
| 6 | tech-lead | 0.78 | Verification blocked by guard, recovered | NO | mid-session |
| 7 | qa | 0.45 | Repeated git commands in wrong directory | NO | mid-session |
| 8 | qa | 0.45 | Verification mis-scoped (wrong node_modules path) | NO | mid-session |
| 9 | qa | 0.45 | No concrete QA artifact produced, only narrative | **YES** | Q1, Q2 |
| 10 | qa | 0.45 | Used invalid finish() status 'conditional' | NO | tooling |
| 11 | coach | 0.65 | 51 wasted calls from exploratory probing | NO | mid-session |
| 12 | coach | 0.65 | Tried sqlite3 which isn't installed | NO | mid-session |
| 13 | coach | 0.65 | Gym infra probing unresolved, no tracked action | MAYBE | Q1 |
| 14 | coach | 0.65 | Finish-guard blocked, corrected | NO | already caught |
| 15 | optimizer | 0.20 | Read session files (HARD_CONSTRAINT_VIOLATION) | NO | Q3 partial |
| 16 | optimizer | 0.20 | No successful finish() | NO | systemic |
| 17 | optimizer | 0.20 | Weak evidence for conclusions | **YES** | Q2 |
| 18 | optimizer | 0.20 | Wasted exploratory commands | NO | mid-session |
| 19 | optimizer | 0.20 | Overwriting file with unverified prior content | NO | mid-session |
| 20 | bob | 0.55 | Repeated failed DB updates (wrong schema) | NO | mid-session |
| 21 | bob | 0.55 | Claimed event dismissal without tool evidence | **YES** | Q2 |
| 22 | bob | 0.55 | Committed after DB error, sloppy ordering | NO | mid-session |
| 23 | bob | 0.55 | Scope drift on path discovery | **YES** | Q3 |
| 24 | coach | 0.85 | git add failed on ignored path | NO | minor |
| 25 | coach | 0.85 | finish() blocked by uncommitted changes | NO | already caught |
| 26 | coach | 0.85 | Reflection claims not fully evidenced | MAYBE | Q2 |
| 27 | coach | 0.60 | Looping on gym runner scripts | NO | mid-session |
| 28 | coach | 0.60 | Verification evidence overstated in finish() | **YES** | Q2 |
| 29 | coach | 0.60 | Committed unrelated files | NO | mid-session |
| 30 | coach | 0.60 | Timeout with no retry | NO | mid-session |
| 31 | scout | 0.10 | session_error | NO | systemic |
| 32 | tech-lead | 0.25 | Didn't actually fix stated P0 error | **YES** | Q1, Q2 |
| 33 | tech-lead | 0.25 | 21 wasted calls in investigation loop | NO | mid-session |

## Results Summary

- **YES (would catch)**: 9 issues (#1, #2, #3, #9, #17, #21, #23, #28, #32)
- **MAYBE**: 2 issues (#13, #26)
- **NO**: 22 issues

**Catch rate: 9/33 = 27%** (or 11/33 = 33% including MAYBEs)

## Success Criteria Check
- ≥50% of issues caught? **NO — only 27-33%**

## Analysis

The checklist would be most effective for:
- **Deliverable omission** (Q1): 5 catches — agents finishing without producing required outputs
- **Evidence fabrication/weakness** (Q2): 4 catches — agents claiming verification without tool evidence
- **Scope drift** (Q3): 1 catch

The checklist would NOT catch the dominant failure mode:
- **Mid-session waste/confusion** (18/33 = 55%): path hallucination, wrong directories, tool unfamiliarity, looping. These happen during execution, not at completion time.

## Conclusion

H-EXP-011's pre-completion checklist hypothesis is **partially validated but below threshold**. A 27% catch rate doesn't justify the intervention overhead (extra tool calls every session).

**Revised hypothesis**: The bigger opportunity is **mid-session orientation** — agents waste calls because they don't know environment basics (git root, tool availability, correct paths). This is an environmental knowledge problem, not a completion-time discipline problem.

**Recommendation**: 
1. Don't deploy H-EXP-011 as designed (below 50% threshold)
2. Instead, investigate: strengthening agent context.md with environment facts (git root, available tools, correct paths) — this targets the 55% of issues that are mid-session confusion
3. This aligns with existing code-vs-data-decisions.md guidance: environmental knowledge → context.md
