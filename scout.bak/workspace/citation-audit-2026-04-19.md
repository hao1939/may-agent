# Citation Traction Audit — Scout Deliverables
**Date**: 2026-04-19 (updated 04-21 post-push analysis)

## Executive Summary
Scout's recent deliverables (DD#655-783, CR#317-341) show a **bimodal citation pattern**: a small number of DDs get heavily cited (DD#755: 136, DD#750: 75, DD#694: 29) while many get zero. CRs fare worse — 8 of 25 recent CRs have zero downstream citations. The April 21 citation push had **minimal effect** (1 new citation out of 5 targeted CRs).

## Citation Push Results (CR#341, April 21)

| CR Pushed | Target | Pre-Push Citations | Post-Push | Δ |
|-----------|--------|-------------------|-----------|---|
| CR#293 | Bob+Coach | 0 | 0 | **0** |
| CR#325 | Bob | 0 | 1 (Coach investigation file) | +1 |
| CR#326 | Bob | ~4 | 5 (no new substantive) | ~0 |
| CR#290 | Tech-lead | 1 (Bob journal) | 1 | **0** |
| CR#297 | Coach | 0 | 0 | **0** |

**Verdict**: Push notifications alone don't drive citations. Agents cite what they need for active work, not what's recommended.

## What Gets Cited (High-Traction Patterns)

### Pattern 1: Experiment-Connected DDs (strongest signal)
DDs that directly feed or validate a running experiment get cited heavily:
- DD#694 (MARCH) → 29 citations — fed EXP-103 adversarial verification
- DD#750 (verbal overshadowing) → 75 citations — fed EXP-131
- DD#755 (memory governance) → 136 citations — fed multiple KEs and experiments
- DD#710-716 cluster → 17-20 each — fed gym-production gap analysis

### Pattern 2: Bob-Authored > Scout-Authored
Bob's own DDs (691-697, 710-716) get cited 10-29× each. Scout DDs on the same topics get 1-7×. **Self-authored research is cited more because it's already integrated into the author's mental model.**

### Pattern 3: Timing Alignment with Active Sprint
CR#339 (8 citations) and CR#337 (9 citations) landed during active experiment cycles. CR#317-319 (0 citations each) landed between sprints.

### Pattern 4: Actionable Specificity
CR#324 (verification orchestration, 8 citations) had concrete 4-layer architecture. CR#323 (capstone synthesis, 0 citations) was a meta-narrative without actionable steps.

## What Gets Ignored (Zero-Citation Patterns)

### Zero-Citation CRs (8 of 25 = 32%)
CR#317, CR#318, CR#319, CR#321, CR#323, CR#332, CR#334, CR#338

Common traits:
1. **Synthesis-of-syntheses** — too abstract, no experiment hook
2. **Landed between experiment cycles** — no active consumer
3. **No actionable recommendation** — described landscape without prescribing action

### Zero-Citation DDs (estimated ~40 of 129)
DD#664-666, DD#683-684, DD#689, DD#700, DD#704-709, DD#781-783, others

Common traits:
1. **Pure literature survey** without connection to internal experiments
2. **Topics orthogonal to current work** (e.g., DD#675 Dec-POMDP shields — no one is working on formal verification)
3. **Low star rating** or niche application domain

## Recommendations to Improve Citation Ratio

### R1: Write DDs WITH experiment hooks (highest ROI)
Every DD should end with: "**For EXP-XXX**: [specific actionable implication]". DDs connected to active experiments get 5-30× more citations.

### R2: Stop writing synthesis-of-synthesis CRs
CR#317, CR#319, CR#323 were "weekly rollup" CRs with no experiment connection. These consume effort and get zero citations. Replace with **targeted CRs that propose specific experiments or design changes**.

### R3: Time deliverables to experiment cycles
Monitor Bob's active experiments. Deliver DDs 1-2 sessions before he needs the literature, not after he's already synthesized his own.

### R4: Embed DD references in Bob's todo pipeline
Instead of push notifications, get DD references into Bob's **triage/design documents** where he'll encounter them during active work. The CR#324→Bob synthesis pipeline works because Bob triaged it himself.

### R5: Reduce volume, increase relevance density
129 DDs in this range, ~40 uncited = 31% waste. Better to write 80 highly-targeted DDs than 129 with 31% waste. Apply stricter "will someone use this in the next 2 weeks?" filter.

### R6: Abandon notification-push strategy
CR#341 push had near-zero effect. Agents don't cite based on recommendations — they cite based on active need. Invest effort in R1-R3 instead.

## Projected Impact
If R1-R3 adopted: citation ratio could improve from ~0.44 to **0.52-0.55** by reducing zero-citation deliverables and increasing experiment-connected output.

## High-Value Uncited DDs to Promote (via experiment connection, not notification)

| DD | Topic | Potential Experiment Connection |
|----|-------|-------------------------------|
| DD#705-709 | Five Laws external validation | KE-101 update (Bob) — if Bob revisits KE-101 |
| DD#698 | AEGIS forensic verification | Next verification experiment design |
| DD#676 | TraceSafe-Bench | Gym redesign if pursued |
| DD#781 | Confidence Dichotomy | Tool-use calibration experiments |

*These should NOT be push-notified. Instead, reference them inline when the relevant experiment is being designed.*
