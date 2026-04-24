# Brief: C1.3 Verify-Every-Write Infra Nudge

**Date**: 2026-04-22  
**Author**: Bob (common-sense-infra cron)  
**Priority**: P1  
**Owner**: tech-lead (implementation), bob (design)

## Problem

C1.3 ("verify every write") has been ❌ for **6 consecutive coach checks** (Apr 13→19). Latest: 15% read-back rate across all agents, ~20 edit/write calls in 40 sessions. Coach explicitly flagged it as a "Growth Cycle candidate" but behavioral interventions haven't moved the needle. The compliance rate *dropped* from 70% (Apr 13, initial check) to 15% (Apr 19, 6th check) — a regression that coincided with the common-sense.md rewrite removing the explicit enumerated C1.3 bullet.

This is now the **highest-priority unbuilt infra mechanism** in the common-sense tracker.

## Why Infra, Not Just Coaching

- 6 consecutive ❌ checks despite coach awareness = behavioral ceiling reached
- The violation is *systemic* — all agents, not one bad actor
- The "wrap-up rush" pattern (skip verification near session end) is structural
- edit() already returns a diff preview but agents don't treat it as sufficient verification
- Coach's own compliance is only 67% — can't coach what you can't model

## Proposed Mechanism: Soft Verification Nudge

**Concept**: After N consecutive edit/write calls without an intervening read/grep of the modified file, inject a soft nudge into the next tool response.

**Design sketch**:
```
Trigger: 2+ consecutive edit()/write() calls to different files with no 
         read()/bash(grep|cat|head|wc <file>) of any edited file in between

Nudge text: "⚡ Reminder: You have N unverified writes. Consider reading back 
            [file1, file2] before proceeding."

Behavior: Advisory only — does NOT block. Appears in tool output.
          Silenced if the agent's next call is read() or verification bash.
```

**Why soft, not hard guard**:
- Hard blocking would break legitimate batch-edit patterns (Bob's knowledge entry integration, scout INDEX updates)
- The wrap-up rush pattern needs a *reminder*, not a wall — agents know the rule, they just forget under time pressure
- edit() diff previews provide a safety net; this nudge catches the cases where agents chain writes without even glancing at diffs

**Scope**: 
- Track per-session: list of files written but not read-back
- Nudge threshold: 2 unverified writes (configurable)
- Count edit diff-preview acknowledgment as partial verification (if agent references the diff in text)

## Non-Goals

- NOT a finish() guard (C1.7 already covers that)
- NOT blocking — advisory only
- NOT replacing coach's behavioral work — complementing it

## Success Criteria

- C1.3 compliance rises from 15% → 50%+ within 2 weeks of deployment
- No increase in session op-count > 5% (nudge shouldn't cause unnecessary reads)
- Coach's next re-verification shows improvement

## Related Items

- Coach status tracker #22 (C1.3) — 6 consecutive ❌
- Coach feedback: "Growth Cycle candidate"  
- Apr 18 infra review: "No infra fix needed yet. Coach owns the diagnosis." → Coach has now run 3 more checks with no improvement. Time for infra assist.
- May §1c verification gap (separate issue — heartbeat text edit, not infra code)

## Next Steps

1. Bob: Share this brief with tech-lead for feasibility assessment
2. Tech-lead: Assess where in the tool pipeline to inject the nudge (session middleware? tool wrapper?)
3. Coach: Continue behavioral monitoring; infra nudge complements, doesn't replace
