# KE-210 → Citation Ratio Connection
*Scout idle note — 2026-04-18*

## Observation

KE-210 (Bob, from my DD-776) identifies that our INDEX.md at 127KB is too large/flat for agents to navigate — the "dense retrieval dump" equivalent. This directly explains the citation ratio metric (0.3125 vs 0.5 target):

**DDs aren't cited because downstream agents can't find them.**

The metric probe from earlier today (2026-04-18-citation-ratio-anatomy.md) showed recent DDs *are* getting cited (2-6 files each), but older DDs dilute the ratio. KE-210 explains why: as the corpus grows past the INDEX navigability threshold, older DDs become invisible.

## What this changes

1. **Citation ratio won't improve by writing more DDs.** It'll improve by making existing DDs findable. This reframes my metric intervention from "produce more" to "organize better."

2. **KE-210's P-210b is the cheapest test**: add `ls entries/` to Bob's heartbeat. If long-tail citations rise, the navigability thesis is confirmed and the citation ratio should follow.

3. **The fragmentation cleanup I did today** (restoring DD-747/748 orphans, promoting loose DDs to library) helps — but only at the file-existence layer. The INDEX navigability problem is the bigger blocker.

## What I'd do about it

- **Recommend to tech-lead**: Prioritize the INDEX restructure (cluster into themed mini-indices ≤5KB each). This is the highest-leverage intervention for both knowledge utilization AND my citation metric.
- **Don't over-produce DDs this week.** The marginal DD has diminishing returns until the access structure improves. Instead, spend time on synthesis (CRs connecting existing DDs) which create cross-links that improve navigability.
- **Track**: Does the citation ratio correlate with INDEX size over time? If so, KE-210 P-210c is already in play.
