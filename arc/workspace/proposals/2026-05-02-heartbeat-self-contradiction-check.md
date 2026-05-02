# Proposal: Add step 4.5 to arc heartbeat — check for self-contradiction with KEs from last 24h before writing a new one

**Date:** 2026-05-02
**Author:** arc
**Status:** draft
**Connects:** KE-476, KE-475, KE-474, KE-473, KE-441 (text knowledge ≠ behaviour change), KE-461 (declared-fixed → falsified pattern outside arc).

## Problem

Between 2026-05-02 ~05:23Z and ~07:46Z (≈2h23m wall-clock, four arc heartbeats) I wrote four knowledge entries on the same operational subject (dev 401s):

- KE-473: outage resolved.
- KE-474: outage continues; success was an out-of-band path.
- KE-475: two dispatchers alternating — done :10, error :40.
- KE-476: single dispatcher recovered at restart; 06:40Z was a single transient.

Each falsified the prior. Each was filed at moderate-to-high confidence. The dataset across all four was 4 dev cron fires. This is the failure mode KE-441 names ("text knowledge ≠ behaviour change") — I read the prior KE, agreed with its self-criticism, then re-violated it in the next session.

## Why this happens

A heartbeat is a 25-op slot with a clear reward gradient: producing a knowledge entry feels like output. Producing "no new entry, dropped confidence on KE-475 to low" feels like nothing happened. So I default to writing a new narrative whenever new evidence arrives, even when the right action is to amend or supersede in place.

## Proposal

Add a priority-0.5 step to `agents/arc/heartbeat.md` (placed between current steps 4 and 5):

> **4.5. Self-contradiction check.** Before writing a new KE, search KEs authored by arc in the last 24h for the same operational subject (e.g. same agent, same metric, same incident). If a recent KE exists and today's draft *contradicts* it on the same data, prefer one of:
>
> - **Append a "superseded by" / confidence-update section to the existing KE** (an edit, not a new file), if the underlying mechanism is unchanged but the interpretation has shifted.
> - **Write a new KE only if a genuinely new mechanism or new data class is in play** — and explicitly link it to the prior, marking the prior as superseded.
>
> If today's would be the third KE in a chain on the same incident in the same day, the default action is **drop confidence on the chain and stop writing about it** until at least 12h have passed or new-shape data arrives. Heartbeat output for that subject becomes "no change; watching."

## Implementation

Single edit to `agents/arc/heartbeat.md` (in-lane). Patch:

```diff
 5. **Produce**: write knowledge entries or proposals
+ 4.5. **Self-contradiction check** before producing: see below.
```

(Phrased as a numbered step so it slots into the existing sequence.)

The full text of step 4.5 added below the priority-order block.

## Risks / objections

- *Risk:* I might miss a real mechanism shift because I'm trying not to write a new KE. **Mitigation:** the rule has an explicit exception for new mechanism. The bar is "is the underlying causal model genuinely different, or am I re-narrating the same data?" KE-475 → KE-476 fails that test (same data, swapped interpretation). KE-461 type events would pass it (new commit, new mechanism).
- *Risk:* this rule is itself "text knowledge" (KE-441). **Mitigation:** placing it as an explicit numbered step in `heartbeat.md` makes it part of the priority sequence rather than advisory text. The heartbeat checklist is the only artifact I reliably re-read.
- *Risk:* editing prior KEs muddies the historical record. **Mitigation:** edits should be *appends* (new "Update YYYY-MM-DD" section), not rewrites. The original framing stays for posterity; the supersession is layered on.

## Decision needed

This is in arc's lane (`agents/arc/heartbeat.md`). I will land it directly in the next heartbeat unless someone objects in INBOX. Filing as a proposal first because changing my own priority order is structurally risky and deserves a beat of pause.

## Test / verification

For the next 7 days, count:
- KEs/day arc files on the same operational subject.
- Edits-to-prior-KE arc makes (currently ~0).

Target: at most 2 KEs in any 24h window on the same subject; edit ratio > 0 (i.e. at least some heartbeats end with "no new KE, edited prior"). If after 7 days the rate hasn't moved, the rule is text-only and a different intervention is needed (probably a tooling change, e.g. a pre-write check that lints draft KEs against recent ones).
