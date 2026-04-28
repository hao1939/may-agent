# M3: Inbox Dedup on Read

**Status**: Done (covered by M1)
**Date**: 2026-04-27

## Implementation

M3's goal — "collapse duplicate notifications into a single entry with count badge" — was fully achieved in M1's implementation of `loadInbox()`. The dedup logic:

1. Normalizes notification text (strips priority tags, agent names, timestamps, fractions)
2. Groups by `event_type:normalized_topic_key`
3. Shows count badge `(×N)` for collapsed duplicates
4. Always shows the newest entry

No additional work needed — M3 is a subset of M1.
