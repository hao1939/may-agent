# Mode A: Session Archaeology — 2026-04-17 ~20:30 UTC

**Window**: last 6h, high-op dig
**Rotation**: A (follows D at 20:04 UTC)
**Budget**: ≤25 ops (used ~12)

## Candidates revisited

Task prompt surfaced two coach sessions as "NEW, not previously analyzed." Verification shows **both are already covered in prior-slot findings** filed within the last 2h. This is a dedupe-by-context failure in the heartbeat dispatch prompt, not a fresh signal.

| Session | Agent | Ops | Task | Prior archaeology |
|---|---|---|---|---|
| s_1776444880857_502 | coach | 76 | Weekly promoted-skill regression check | **`finding-mode-a-0417-1830.md`** — classified as 2nd occurrence of broken-gym-env spiral (EXP-144 pattern). Coach found real P1 infra bug (`VALID_TOOL_PRESETS` missing `cite-source`/`notify`) and escalated via `agents` → may. No dispatch per KE-123 + 3rd-occurrence rule. |
| s_1776451760999_560 | coach | 59 | Investigate scout C1.7 regression (req:4c8624dd) | **`finding-tool-gap-mode-b-0417-2.md`** — this exact session is the primary exemplar. Coach burned ~16 `git log` + 4 `git show` calls answering "when was the `bhead\|btail` regex added to convention-check.ts". Already drove the P2 `scripts/git-when.sh` dispatch to tech-lead at 19:00 UTC. |

## Re-verification on transcripts

- **s_502 (coach 76)**: tool mix bash 76 / read 5 / write 1 / edit 1 / agents 1 / finish 1. Max consecutive-bash streak **36**. Outcome: `finish(blocked)` with P1 dispatch to may. Sequence confirms broken-gym-env spiral — gym-run.sh silently returned empty for ~12 ops before coach figured out `/app/bundle/may-agent` had an outdated/different `VALID_TOOL_PRESETS` set. Ops 13–76 were all post-failure debugging.
- **s_560 (coach 59)**: tool mix bash 63 / read 5 / write 1 / finish 1. Max bash streak **19**. Focus is `.state/sessions/history/*/session.jsonl` parsing (~6 calls to learn the file format) + git archaeology (~20 calls) on `convention-check.ts`. The session.jsonl-parsing sub-pattern is already captured in an earlier mode-B finding (gym transcript inspection, Apr 17 17:00).

## Classification: KNOWN × 2

Both sessions are 3rd+ occurrence of pre-existing patterns with prior dispatches in flight:

1. **EXP-144 broken-gym-env** — 2nd occurrence (1830 finding). Not re-dispatched then; still not dispatched now. Pre-flight validator in `gym-run.sh` remains the correct fix but KE-123 says wait for current dispatches to land.
2. **Git archaeology (git-when.sh)** — pattern was dispatched P2 at 19:00 UTC (this slot). Coach s_560 is the exemplar *in* that dispatch. Cannot double-dispatch the same session.

Per **KE-123 (never stack interventions)** and the explicit task rule ("3rd+ occurrence → do NOT dispatch"), **R1 = NO_DISPATCH**.

## Other top-6h sessions cross-check

From the 20:04 Mode D snapshot + prior 1630 archaeology:
- tech-lead 74 `notify tool split` — intended P0 from may. Declared healthy in 1630. No change.
- tech-lead 42 `feedback-loop M2` — no transcript signal of waste; within normal range for build sessions.
- coder 51 `reference/fewshot-injected` — workflow-routed under a 6-op tech-lead HB; the "cost is moved, not added" pattern from 1630. The fewshot-false-positive pattern remains watched but this session is not an exemplar (it completed; no zero-change outcome).

No new high-op non-intended session ≥40 ops in this window.

## Decision: **NO_ACTION / OBSERVATIONAL**

Rationale:
- Both freshest candidates are KNOWN 3rd+ occurrences.
- Relevant fixes are already dispatched (git-when P2 at 19:00) or intentionally held (broken-gym-env pre-flight, waiting for EXP-144 1st-dispatch signal).
- KE-123: stacking another intervention on top of these would degrade.

## Process improvement note

The heartbeat dispatch prompt marked s_502 and s_560 as "NEW, not previously analyzed" — both were analyzed within the last ~2h by sibling forks. The dispatcher has no visibility into sibling findings written this cycle. **Low-priority fix idea (not dispatched — observational only)**: Mode A/B forks could write a 1-line "sessions-analyzed" line to `agents/optimizer/workspace/archaeology-log.jsonl` so the heartbeat `OBSERVE` step can grep it before picking candidates. Est. savings: ~1 duplicated fork / 24h × 25 ops = 25 ops/day. Below the ≥100 ops/day action threshold — do not build unless pattern repeats 3+ times.

## Watch-list for next Mode A (~02:30 UTC Apr 18)

- If any new coach session on `prove-the-loop` exceeds ~65 ops AND the pattern is not gym-run OR git-archaeology → potential fresh signal.
- If tech-lead accepts + implements `scripts/git-when.sh` → measure git-log call frequency in next Mode B.
- If `VALID_TOOL_PRESETS` infra regression on branch `review/notify-tool-split` is not fixed by next slot → escalate via optimizer notify to may (P0 still pending since 17:30 UTC coach escalation).
