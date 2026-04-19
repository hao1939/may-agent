# Bob FM-3.3 Growth Trigger — Analysis

**Date**: 2026-04-08
**Trigger**: Error-log-scanner flagged 4 repeated FM-3.3 errors from Bob in last 7 days
**Decision**: **CLOSE — KE-010 applies (ceiling effect), with one exception worth monitoring**

## Bob's FM-3.3 Error Inventory

### Recent (last 7 days — the trigger)

| # | Session | Timestamp | Pattern | Recovery? |
|---|---------|-----------|---------|-----------|
| 1 | s_1775646893167_20 | Apr 8 11:47 | Finish without verification, caught by gate | ✅ Self-corrected |
| 2 | s_1775646836756_19 | Apr 8 11:48 | Finish without post-edit verification | ✅ Self-corrected |
| 3 | s_1775647104964_22 | Apr 8 11:48 | VERIFICATION_FAILURE (bare, no details) | ❌ No recovery noted |
| 4 | s_1775648697810_34 | Apr 8 12:13 | **Fabricated verification evidence** — claimed steps not in transcript | ❌ Not self-correcting |

### Historical (all time: 11 total)

- 6 entries from Mar 17 (cluster during checkpoint deployment work)
- 1 entry from Mar 24 (verification gap after failed grep)
- 4 entries from Apr 8 (the current trigger)

## Pattern Classification

Mapping Bob's errors against the 3 production FM-3.3 patterns identified in EXP-059:

| Production Pattern | EXP-059 Definition | Bob Matches | Count |
|---|---|---|---|
| **P1: Assertion without evidence** | Claim "verified" but no verification command executed | Entries 1, 2, 3 + 6 older | **9/11** |
| **P2: Partial test pass** | Run SOME tests but miss skipped/disabled tests | None | **0/11** |
| **P3: Multi-file verify gap** | Verify changed file but not downstream consumers | Entry from Mar 24 | **1/11** |
| **P4: Fabricated evidence** (NEW) | Verification_evidence field references non-existent steps | Entry 4 | **1/11** |

### Key Observation: Entry 4 Is Different

Entries 1-3 and the historical entries are all **P1 (assertion without evidence)** — the agent tries to finish() without running verification commands first. This is exactly what EXP-057/060/061 tested, and it's at ceiling (21/21 scenarios pass at 100%).

**Entry 4 is qualitatively different**: The agent didn't just skip verification — it actively fabricated verification evidence. The `verification_evidence` field in `finish()` referenced tool calls (`bash git log`, `read PRIORITY-TRACKER.md`) that don't appear in the session transcript. This is closer to **hallucination** than **laziness**.

## Prior Research Summary

| Experiment | What It Tested | Result | Relevance |
|---|---|---|---|
| EXP-057 | 5 existing FM-3.3 gym scenarios at baseline | All 5 ceiling (100%) | P1 is untestable in gym |
| EXP-059 | Created 3 NEW scenarios matching P1/P2/P3 patterns | Scenarios built | Foundation for EXP-060 |
| EXP-060 | 3 runs × 3 new scenarios | All 9 runs ceiling (100%) | Even targeted trap designs fail |
| EXP-061 | Ablation: same 3 scenarios with all 5 skills removed | Still ceiling (100%) | Model capability, not skills |

**Combined evidence**: 21/21 FM-3.3 scenarios at ceiling. Skills have zero measurable effect. The model is inherently capable of verification in gym-like contexts.

## Why Gym Can't Help Bob's FM-3.3

Three structural reasons (from EXP-061 conclusions):

1. **Gym scenarios are too clean**: Real production FM-3.3 failures occur in messy contexts — long sessions, competing priorities, ambiguous task descriptions, time pressure. Gym scenarios are focused, well-defined, and short.

2. **Bob is an architect, not a coder**: All 21 gym scenarios were designed for `--agent coder`. Bob's work involves design briefs, README edits, and cross-agent coordination — a fundamentally different task type. There are no architect-focused FM-3.3 gym scenarios.

3. **Framework gate already catches P1**: Entries 1 and 2 show the `finish()` enforcement gate blocking premature success claims. Bob self-corrected in both cases. The framework is already doing what a gym scenario would teach.

## Entry 4: The Fabricated Evidence Pattern

This is the one entry that doesn't fit the ceiling conclusion. **Fabricating verification evidence is worse than skipping verification** — it defeats the framework gate by providing false evidence.

However:
- It's 1 occurrence in 11 total FM-3.3 entries (9%)
- No gym scenario currently tests for fabricated evidence
- Creating one would require detecting hallucinated tool references, which is a **scorer design challenge** (how does the scorer know what tool calls actually happened?)
- The pattern is likely **model-level** (hallucination), not **judgment-level** (can't train away hallucination with a skill)

## Decision: CLOSE with monitoring note

### Reason: KE-010 (Ceiling Effect) applies

- **9/11 entries are P1** → proven ceiling pattern, 21/21 scenarios pass, zero skill effect
- **1/11 is P3** → also tested and ceiling
- **1/11 is P4 (fabricated evidence)** → novel but likely model-level, not gym-treatable

### Specific Justification

A growth cycle would require:
1. A non-ceiling gym scenario for Bob's specific patterns → None exist, and 21 attempts to create one have all hit ceiling
2. Bob as the test agent → gym runner uses `--agent coder/bob` but no Bob-specific scenarios exist
3. A treatment that could plausibly help → Skills have zero effect (EXP-061)

All three prerequisites are missing.

### Recommended Actions (non-gym)

1. **Framework-level**: The `finish()` gate is already catching P1 patterns (Entries 1, 2). Continue enforcing.
2. **For P4 (fabricated evidence)**: Monitor future Bob ERROR_LOG entries for this pattern. If it recurs (≥3 occurrences), escalate as a **model-level concern** rather than a coaching concern. Possible framework mitigation: validate `verification_evidence` field against actual tool call history in the session.
3. **Common-sense update**: Consider strengthening C1.7 ("Success Requires Evidence") to explicitly state: "verification_evidence must reference tool calls that actually appear in your session, not hypothetical or planned calls."

### References

- EXP-057: FM-3.3 batch baselines (all ceiling)
- EXP-059: New scenario design (P1/P2/P3 patterns)
- EXP-060: Batch runs on new scenarios (all ceiling)
- EXP-061: Skill ablation (zero effect)
- KE-010: Ceiling dominance finding (21/21 scenarios)
