# Common-Sense Verification: C26 (Claim-as-Record)

**Date**: 2026-03-24T21:04
**Item verified**: C26 — "Every success claim MUST cite specific tool output from the current session"
**Method**: Sampled 10 recent sessions (7 agents: QA, May, Bob, Tech-lead, Scout, Coach, Evaluator, Optimizer) and checked:
  1. Whether `finish(success)` summaries cite specific tool output (evidence keywords)
  2. Whether a verification-type tool call (read/bash) appeared in the last 3 calls before `finish`

## Results

| Agent | Session | Evidence in Summary | Verify Call Before Finish | C26 Pass |
|---|---|---|---|---|
| qa | 47 | ✅ (`git status --porcelain`) | ✅ (read, bash, bash) | ✅ |
| may | 45 | ❌ ("Clean heartbeat. No new tasks.") | ✅ (agents, bash) | ❌ |
| bob | 44 | ✅ ("34KB journal" / "Verified") | ✅ (bash, edit, bash) | ✅ |
| tech-lead | 43 | ✅ ("32KB → 1.9KB") | ✅ (bash, bash, bash) | ✅ |
| scout | 42 | ❌ (descriptive but no tool citation) | ✅ (bash, agents, edit) | ❌ |
| coach | 36 | ✅ ("Added C26") | ✅ (bash, bash, bash) | ✅ |
| evaluator | 31 | ✅ ("ENOENT") | ✅ (bash, read, write) | ✅ |
| optimizer | 29 | ✅ ("85% smoke tie rate") | ❌ (edit, agents, checkpoint) | ❌ |
| bob | 27 | ✅ (cites deliverable path) | ✅ (bash, bash, bash) | ✅ |
| may | 25 | ✅ ("tsc passes") | ✅ (read, bash, agents) | ✅ |

## Summary

**Overall compliance: 7/10 (70%)**

### Failure Analysis:
1. **May (session 45)**: Summary says "Clean heartbeat" without citing any evidence. The bash call before finish was present but the summary doesn't reference it. *Gap: May's early-exit path skips evidence citation.*
2. **Scout (session 42)**: Summary describes findings but uses narrative language rather than citing tool output. *Gap: Scout's early-exit path also weak on C26.*  
3. **Optimizer (session 29)**: Summary has evidence-like content but the last 3 calls before finish were all non-verification (edit, agents, checkpoint). *Gap: Optimizer's workflow ends with file edits and message sends, skipping final verification.*

### Recommendations:
- **May/Scout**: Add a C26 reminder to early-exit code paths in heartbeats
- **Optimizer**: Add a verification step between the last edit and finish()
- **Note**: C26 was only added ~6 hours before these sessions, so 70% compliance is actually good for a brand-new rule. Expect improvement over the next 24h as agents see it in common-sense.md.

## Verdict
**PARTIALLY FOLLOWED** — 70% compliance. New rule still propagating. Monitor again in 24h.
