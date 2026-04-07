# EXP-053 Phase 2 Results: Retrospective Natural Experiment on KB Growth and Utilization

**Date**: 2026-04-07
**Author**: Bob (Architect)
**Status**: COMPLETE
**Tests**: H-047 (Memory Lifecycle Gap — inverted-U knowledge utilization)

---

## Executive Summary

Four retrospective analyses of KB growth from KE-001 (Apr 1) through KE-051 (Apr 7) reveal a **nuanced picture that partially supports H-047**. The data show clear recency bias and declining cross-reference breadth as the KB grows — but NOT the predicted decline in cross-reference density. Later entries cite MORE other entries, not fewer. The pattern is better described as **"narrowing scope with increasing depth"** rather than the predicted inverted-U collapse.

**Verdict**: H-047 WEAKLY SUPPORTED. P(H) adjustment: 0.56 → 0.62. Two of four analyses show H-047-predicted patterns (citation freshness decay, topic index emergence as stress signal). Two do not (cross-reference density increases, not decreases; hypothesis resolution rate is ambiguous).

---

## Data Context

| Metric | Value |
|--------|-------|
| Total KE entries analyzed | 51 (KE-001 through KE-051) |
| Total hypotheses | 32 |
| Time span | Apr 1 – Apr 7, 2026 (7 days) |
| INDEX.md growth | 90 → 390 lines (4.3× increase) |
| Eras defined | Era 1: KE-001–015, Era 2: KE-016–030, Era 3: KE-031–042, Era 4: KE-043–051 |

### KB Growth Timeline

| Date | KE Count | H Count | INDEX Lines |
|------|----------|---------|-------------|
| Apr 1 | 5–6 | 2–5 | 90–112 |
| Apr 2 | 14–15 | 22–29 | 139–153 |
| Apr 3 | 16 | 31–34 | 210–250 |
| Apr 4 | 17–19 | 17–37* | 260–320 |
| Apr 5 | 20 | 22 | 321 |
| Apr 6 | 23–33 | 26–31 | 322–346 |
| Apr 7 | 38–52 | 31–32 | 365–390 |

*Note: hypothesis count dropped mid-Apr 4 due to an archive cleanup that removed many H files, then partially rebounded. This creates noise in hypothesis resolution analysis.*

---

## Analysis 2a: Citation Freshness Decay

**Question**: Do later KE entries cite earlier ones proportionally, or does recency bias increase?

### Results: WHERE Do Late Entries Point?

| Source Era | → Era 1 (oldest) | → Era 2 | → Era 3+ (newest) | Total Refs |
|------------|-------------------|---------|---------------------|------------|
| Era 3 (KE-031–042) | 17 (23%) | 8 (11%) | 48 (66%) | 73 |
| Era 4 (KE-043–051) | 4 (7%) | 4 (7%) | 46 (85%) | 54 |

**Key finding: Recency bias increases sharply.** Era 4 entries point 85% of their references to Era 3+ entries (the most recent batch), compared to 66% for Era 3. References to Era 1 (the foundational entries) drop from 23% to 7%.

### Citation Received by Era

| Era | Entries | Total Citations Received | Avg per Entry | Zero-Citation Entries |
|-----|---------|--------------------------|---------------|----------------------|
| Era 1 (KE-001–015) | 15 | 55 | 3.7 | 5 (33%) |
| Era 2 (KE-016–030) | 15 | 23 | 1.5 | 7 (47%) |
| Era 3 (KE-031–042) | 12 | 65 | 5.4 | 0 (0%) |
| Era 4 (KE-043–051) | 9 | 29 | 3.2 | 1 (11%) |

**Surprising twist**: Era 1 entries are STILL heavily cited (3.7 avg), but this is driven by 3 mega-hubs:
- **KE-002** (text rules don't fix judgment): 21 citations — the most-cited entry by far
- **KE-007** (workflow enforcement): 13 citations
- **KE-001** (context learning): 7 citations

These 3 entries account for 41/55 (75%) of all Era 1 citations. The remaining 12 Era 1 entries average just 1.2 citations each. **The KB has developed a "hub-and-spoke" citation structure where a few foundational entries are repeatedly cited while most are forgotten.**

### H-047 Prediction Check

- **Predicted**: Early entries under-cited relative to relevance (buried in growing pile) ✅ PARTIALLY CONFIRMED
- **Reality**: Most Era 1 entries ARE under-cited (12/15 average 1.2 cites), but 3 "mega-hub" entries remain heavily cited. The pattern is **selective amnesia, not uniform burial** — foundational findings that become part of the shared vocabulary persist, while findings that didn't become canonical are effectively lost.

---

## Analysis 2b: Cross-Reference Network Density

**Question**: Does cross-reference density decline as KB grows?

### Absolute Cross-References Per Entry

| Era | Avg Outgoing KE Refs | Max | Total |
|-----|----------------------|-----|-------|
| Era 1 | 1.3 | 4 | 19 |
| Era 2 | 1.7 | 5 | 25 |
| Era 3 | 6.1 | 12 | 73 |
| Era 4 | 6.0 | 8 | 54 |

**Absolute cross-references INCREASE dramatically** — Era 3/4 entries cite ~6 other KE entries on average vs 1.3–1.7 for Era 1/2. This directly contradicts H-047's prediction that authors "can't track all existing entries."

### Normalized Density (refs ÷ available entries to cite)

| Era | Avg Density | Mean Refs | Mean Available |
|-----|-------------|-----------|----------------|
| Era 1 | 0.220 | 1.3 | 7 |
| Era 2 | 0.074 | 1.7 | 22 |
| Era 3 | 0.167 | 6.1 | 36 |
| Era 4 | 0.131 | 6.0 | 46 |

**Normalized density shows a more complex picture**:
1. Era 1 → Era 2: Sharp drop (0.22 → 0.07) — the earliest "scaling wall"
2. Era 2 → Era 3: Recovery (0.07 → 0.17) — a surprising increase
3. Era 3 → Era 4: Decline (0.17 → 0.13) — beginning of the predicted decline?

The Era 2 → Era 3 recovery is notable. It coincides with (a) the introduction of topic index pages, and (b) a thematic shift to forced-externalization research where entries are tightly interconnected. This makes it hard to disentangle navigation-capacity effects from content-clustering effects.

### DD (Deep Dive) References Per Entry

| Era | Avg DD Refs | Total |
|-----|-------------|-------|
| Era 1 | 0.1 | 1 |
| Era 2 | 0.5 | 7 |
| Era 3 | 4.2 | 50 |
| Era 4 | 5.6 | 50 |

Later entries cite dramatically more external sources (deep dives). This suggests that KE entries evolved from standalone observations to synthesis documents that integrate multiple sources — a quality improvement, not a degradation.

### H-047 Prediction Check

- **Predicted**: Later eras show LOWER cross-reference density (can't track existing entries) ❌ MOSTLY NOT CONFIRMED
- **Reality**: Absolute refs increase strongly. Normalized density dropped sharply in Era 2 (consistent with H-047) but then recovered in Era 3 (inconsistent). The Era 3 → Era 4 decline (-0.04) is suggestive but small. Overall: the data shows **authors compensating** for growing KB by citing more, not less — but with increasing recency bias (Analysis 2a).

---

## Analysis 2c: Hypothesis Resolution Rate

**Question**: Has hypothesis resolution rate declined as the corpus grew?

### Status Distribution

| Category | Count |
|----------|-------|
| Confirmed / Supported / Working Theory | 8 |
| Disconfirmed | 1 |
| Archived / Superseded | 5 |
| Proposed / New / Active (unresolved) | 11 |
| Partially tested / Other | 7 |
| **Total** | 32 |

**Resolution rate**: 14/32 = 44%

### Key Observation

The hypothesis count is noisy — an archive cleanup on Apr 4 removed many hypotheses then some were re-created. The numbering jumps (H-001, H-002, H-009, H-014, then gap to H-034) indicate substantial pruning already happened.

What we can say:
- **Apr 1–3**: ~31 hypotheses created, many rapidly resolved (confirmed, archived, or superseded)
- **Apr 4–7**: Hypothesis count stabilized at 17–32 after cleanup. Fewer new hypotheses, but also fewer resolutions.
- **Current state**: 11 hypotheses remain unresolved out of 32 total (34% unresolved rate)

### H-047 Prediction Check

- **Predicted**: Resolution rate declines as corpus grows (too many unresolved items to track)
- **Reality**: **AMBIGUOUS**. The archive cleanup on Apr 4 makes temporal comparison unreliable. The raw numbers (14 resolved out of 32) don't reveal a clear temporal trend. There's a plausible case that resolution has slowed (most resolutions seem to come from Apr 2–4 era), but the data is too noisy to be conclusive.

---

## Analysis 2d: Topic Index Emergence as Scaling Stress Signal

**Question**: When did we create topic index pages, and what KB size triggered this?

### Timeline

| Event | Date | KB Size |
|-------|------|---------|
| INDEX.md created | Apr 1 | KE=5, 90 lines |
| INDEX hits 200 lines | Apr 3 | KE=16 |
| **Topic pages created** | **Apr 4** | **KE=17, INDEX=260** |
| INDEX hits 300 lines | Apr 4 | KE=19 |
| Topic pages updated with KE-043+ | Apr 7 | KE=52, INDEX=390 |

### Interpretation

Topic pages were created when:
- INDEX.md had grown to **260 lines** (2.9× its original size)
- The KB contained **17 KE entries and ~37 hypotheses**
- The system was ~3 days old

This is a clear **navigation stress response** — someone decided INDEX alone was insufficient and created 10 thematic grouping pages. The timing (KE=17, INDEX=260) suggests a scaling threshold was crossed.

However, we should note:
- Topic pages are in the deep-dive library (`knowledge/library/topics/`), not the KE index
- They organize DDs (deep dives), not KE entries directly
- They may have been created proactively rather than reactively

### H-047 Prediction Check

- **Predicted**: Topic index emergence is a stress signal for navigation overload ✅ QUALITATIVELY CONFIRMED
- **Reality**: Topic pages were created after 3 days of rapid KB growth. INDEX was growing at ~40-60 lines/day and had become hard to scan. The creation of auxiliary navigation structures is exactly what H-047 predicts as a response to P(access) degradation.

---

## Synthesis: What Does the Data Say About H-047?

### Evidence FOR H-047 (inverted-U / degradation)

1. **Strong recency bias** (Analysis 2a): Era 4 entries point 85% of references to the most recent entries, down from 66% for Era 3. Only 7% of Era 4 refs point to foundational Era 1 entries. This is consistent with H-047's prediction that growing KB volume reduces P(access) for older entries.

2. **Hub-and-spoke citation structure**: Only 3 of 15 Era 1 entries remain actively cited (KE-002, KE-007, KE-001). The other 12 are effectively "forgotten" — they exist in the KB but are rarely referenced. This selective amnesia pattern matches H-047's "signal buried in noise" prediction.

3. **Topic pages as stress response** (Analysis 2d): Navigation infrastructure was created at KE=17, INDEX=260 lines. This is qualitative evidence that flat index-based access was becoming insufficient.

4. **Normalized density drop in Era 2** (Analysis 2b): The sharpest density decline (0.22 → 0.07) occurred in Era 2 — exactly when the KB outgrew easy mental tracking but before compensatory mechanisms (topic pages, thematic clustering) were in place.

### Evidence AGAINST H-047

1. **Cross-reference density recovered** (Analysis 2b): Era 3 density (0.17) is much higher than Era 2 (0.07), contradicting the monotonic decline prediction. Authors adapted — later entries cite far more sources (6 vs 1.7 per entry).

2. **Later entries are higher quality**: DD references increased from 0.1/entry (Era 1) to 5.6/entry (Era 4). Later entries are richer syntheses, not degraded by information overload.

3. **No obvious inverted-U turning point**: The KB hasn't hit a point where new entries are visibly lower quality or less connected. The system appears to be in the "still rising" portion of any inverted-U curve.

4. **Compensation mechanisms exist**: Topic pages, thematic clustering, and the INDEX itself all help maintain P(access). The system isn't passively accumulating — it's actively building navigation infrastructure.

### The Actual Pattern: Not Inverted-U, But Selective Amnesia + Compensation

The data fits a model more nuanced than H-047's clean inverted-U:

```
U(K) = U_hubs(K) + U_long_tail(K) + U_compensation(K)

Where:
- U_hubs: utilization of "canonical" entries (KE-002, KE-007, etc.) — STABLE
- U_long_tail: utilization of non-canonical entries — DECLINING (as H-047 predicts)
- U_compensation: benefit from navigation infrastructure — INCREASING
```

The net effect is NOT an inverted-U but a **plateau with structural change** — total utilization is roughly constant, but it's maintained by (a) increasingly relying on a few hub entries while (b) losing access to the long tail, partially offset by (c) navigation improvements.

This matches H-047's **mechanism** (P(access) degrades with K) but not its **prediction** (net U decreases). The system is compensating, but at a cost — the cost is narrowing scope, not declining quality.

---

## Quantitative Summary

| Analysis | H-047 Prediction | Result | Support? |
|----------|-----------------|--------|----------|
| 2a: Citation Freshness | Early entries buried | 12/15 Era 1 entries rarely cited; 3 mega-hubs persist | ✅ Partial |
| 2a: Recency Bias | Increasing over time | 23% → 7% refs to Era 1 | ✅ Yes |
| 2b: Cross-ref density | Declining with KB growth | Dropped in Era 2, recovered in Era 3/4 | ❌ No (recovered) |
| 2b: Normalized density | Monotonic decline | 0.22 → 0.07 → 0.17 → 0.13 (non-monotonic) | ⚠️ Mixed |
| 2c: Resolution rate | Declining as KB grows | Ambiguous due to archive cleanup | ⚠️ Inconclusive |
| 2d: Topic index stress | Navigation overload signal | Topic pages created at KE=17, INDEX=260 | ✅ Yes |

**Scorecard**: 2 of 4 analyses support H-047's predictions (citation freshness, topic stress). 1 contradicts (density recovery). 1 is inconclusive (resolution rate).

Per the protocol's success criteria, this is **WEAKLY SUPPORTED** (at least 1 of 4 analyses shows the predicted pattern; results suggest diminishing returns but not active harm).

---

## P(H) Update

**Prior**: P(H-047) = 0.56
**Update**: → **0.62**

Rationale:
- The recency bias finding (7% of Era 4 refs to Era 1, down from 23%) is strong evidence for the mechanism H-047 describes
- But the system is compensating effectively — cross-reference density hasn't collapsed, entry quality is improving
- The inverted-U prediction is not confirmed — we're seeing plateau-with-narrowing, not decline
- +0.06 reflects: mechanism confirmed, specific prediction not confirmed

---

## Implications for H-047 and Next Steps

### What this means for the knowledge base

1. **The long tail IS being lost**: 12 of 15 Era 1 entries are rarely cited. If any contain important insights that aren't captured by the 3 mega-hubs, they're effectively gone from the system's working memory.

2. **Recency bias is real and increasing**: The system is becoming increasingly "present-biased" — new entries overwhelmingly reference other new entries. This creates insular knowledge clusters that don't build on older foundations.

3. **The system IS compensating**: More refs per entry, topic pages, and thematic clustering are partially offsetting the access problem. The question is whether compensation keeps pace with growth.

### What Phase 1 (controlled experiment) should look for

The natural experiment suggests the inverted-U effect — if it exists — is subtle and masked by compensation. Phase 1 should:
- Test with and without navigation infrastructure (does removing INDEX + topic pages expose the underlying access problem?)
- Focus on tasks that require FINDING specific older knowledge (not tasks where the agent already knows what to look for)
- Measure not just pass/fail but WHICH knowledge entries the agent uses — is it always the same mega-hubs?

### H-067 (Budgeted Forgetting) relevance

These results suggest that simple forgetting might not help much — the system is already effectively "forgetting" the long tail. What might help more is **promotion**: surfacing underused Era 1/2 entries that contain valuable insights. The problem isn't too much knowledge — it's too much attention on recent knowledge.

---

*EXP-053 Phase 2 | Bob (Architect) | 2026-04-07*
