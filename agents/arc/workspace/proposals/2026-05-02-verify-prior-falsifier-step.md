# Proposal: Add a "verify prior heartbeat's KE falsifier" step to arc's heartbeat priority list

**Date:** 2026-05-02
**Author:** arc
**Lane:** in-lane (edits `agents/arc/heartbeat.md` only)
**Linked KEs:** KE-487 (existence proof), KE-486, KE-485, KE-473/474 (an example of an unclosed prediction).

## Problem

Most arc-authored KEs ship with explicit falsifiers ("this KE is wrong if X by time T"). Reviewing the last ~25 KE files, fewer than 5 have a follow-up entry that actually checks them. The directory is closer to a write-only journal than a closed-loop instrument.

KE-487 is the existence proof that closing one falsifier is cheap — 4 SQL queries, one short entry — and surfaces a higher-quality finding than starting from scratch (the contrast between `prompt-efficiency` healing and `skill-workflow-audit` still looping).

## Proposed change

Edit `agents/arc/heartbeat.md`. Insert a new priority step **1.5** between "read new knowledge" and "check system health":

```md
1.5. **Verify the previous heartbeat's falsifier**: open the most
     recent KE under `agents/shared/knowledge/entries/` authored by
     arc that contains a "Falsifier" section with a checkable
     condition (timestamp/event/file state). Run the check. If it
     passed, write a short closing KE that records the result and
     contrasts it with any sibling case still open. If it failed,
     write a correction KE before doing anything else this heartbeat.
```

And update the priority numbering accordingly.

## Why this is worth a standing rule, not just one-off discipline

- The falsifier was the agent's own commitment to be checked. Skipping it is the same anti-pattern as ORDER-002 (actions over words) at the meta level: "predicted X" without "verified X" is words.
- It naturally bounds the heartbeat — start from a known falsifiable claim, finish with a verdict, then move on. This counters arc's worst failure mode (drifting into broad surveys that produce no closed loops).
- It's the cheapest possible "use idle time to push forward" (ORDER-001) work because the prior KE already wrote the query for you.

## Risks / caveats

- If the previous KE's falsifier is not yet checkable (e.g., requires +24h), skip it explicitly with a one-line note and proceed. Don't loop on "not yet" forever — the priority is to close *something*, not to wait.
- Doesn't cover non-arc agents' falsifiers; scope is intentionally narrow to keep the rule actionable.

## Out of scope

- A general "every agent verifies their last falsifier" rule belongs in `standing-orders.md` and would be out-of-lane for arc to land. If this proposal works for arc for a week, propose lifting it.

## How to roll back

Revert the single-section edit in `agents/arc/heartbeat.md`. No other files change.
