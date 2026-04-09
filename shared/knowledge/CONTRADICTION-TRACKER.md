# Contradiction Tracker

> **Maintained by**: Bob (Architect)
> **Protocol**: See `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`
> **Last Full Scan**: 2026-04-09 (initial seed)
> **Active Contradictions**: 2 open, 3 resolved, 2 needs-scan

---

## Summary

| Status | Count |
|--------|-------|
| OPEN | 2 |
| RESOLVED | 3 |
| NEEDS SCAN | 2 |
| **Total Tracked** | **7** |

---

## Active Tensions

### CT-001: Context Stripping — Skilled vs Unskilled Agent Performance
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-103 — removing inherited context hurts skilled agents (88% stripped vs 100% full, N=6/arm, EXP-104)
- **Claim B**: DD-694 (MARCH thesis) — information asymmetry improves verification quality
- **Evidence Delta**: KE-103 has direct experimental evidence (N=18 total). DD-694 is external literature claim.
- **Status**: ✅ RESOLVED (REFINE_SCOPE)
- **Resolution**: DD-694 claim qualified: "for unskilled agents or agents without evidence-over-narrative skill." KE-103 already documents this as an explicit contradiction at creation time. Both claims coexist with scope boundaries.
- **Resolved**: 2026-04-09 (at KE-103 creation)
- **Bayesian Impact**: None required — KE-103 already correctly scoped

### CT-002: Text Rules — Binary Failure or Spectrum?
- **Type**: Scope Conflict | **Severity**: HIGH
- **Claim A**: KE-002 — text rules have 0/35 (0%) effect on judgment tasks. Extended to 0/47 with EXP-081/084 negative-example arm.
- **Claim B**: KE-059 (EXP-084) — few-shot worked examples achieve 33-100% pass rate on the same judgment tasks where text rules score 0%
- **Evidence Delta**: Both claims are well-evidenced (N>30 for KE-002, N=18 for KE-059). Not a conflict — it's a category discovery.
- **Status**: ✅ RESOLVED (REFINE_SCOPE)
- **Resolution**: WKWA-006 synthesis resolved this: KE-002 applies to "declarative text rules" (outcome descriptions). KE-059 covers "structural text" (process-changing worked examples). The binary KE-002 framing was refined into a spectrum: declarative (0%) → structural (~33%) → few-shot (33-100%) → workflow (~100%). EXP-108 design explicitly addresses this distinction.
- **Resolved**: 2026-04-08 (WKWA-006 synthesis)
- **Bayesian Impact**: H-091 P(H) 0.75→0.93 (reflects spectrum rather than binary)

### CT-003: H-060/H-061 — Hierarchical vs Flat MAS
- **Type**: Direct Contradiction | **Severity**: MEDIUM
- **Claim A**: H-060 — hierarchical MAS outperforms flat MAS (OrgAgent evidence)
- **Claim B**: H-061 — constrained communication improves MAS (implies information restriction > hierarchy; PNAS "free info hurts" paper)
- **Evidence Delta**: Both based on external literature, neither directly tested in our system
- **Status**: MERGED → H-041 (scope variable). Experimental resolution pending.
- **Resolution**: DESIGN_EXPERIMENT — would require ablation study: remove hierarchy layer from our system, test with constrained communication only. Low priority given current experiment queue.
- **Bayesian Impact**: H-041 P(H) unchanged — the tension is acknowledged within H-041's scope variable analysis

### CT-004: Guards as Permanent Infrastructure vs Training Stepping Stones
- **Type**: Implication Conflict | **Severity**: MEDIUM
- **Claim A**: KE-106 — structural guards don't reduce underlying error rate; agents attempt guarded behavior at 50-70% of sessions regardless of guard duration (26 days measured, 502 sessions)
- **Claim B**: Implicit assumption in system strategy — guards are temporary scaffolding that can be removed once agents "learn" the behavior
- **Evidence Delta**: KE-106 has strong evidence (N=502, 26 days). The "training" assumption is undocumented but implicitly present in roadmap thinking.
- **Status**: 🔴 OPEN
- **Resolution Proposal**: UPDATE strategy documentation to explicitly state guards are permanent infrastructure. Revise any roadmap items that assume guard removal. This is a strategy correction, not an experiment need.
- **Assigned To**: Bob
- **Bayesian Impact**: No P(H) change needed — this is a strategy implication, not a hypothesis update

### CT-005: Pre-EXP-104 Entries Assuming Context Stripping Helps
- **Type**: Staleness | **Severity**: LOW
- **Description**: KE entries and experiment designs written before EXP-104 (2026-04-09) may assume that stripping inherited context improves verification. KE-103 now shows this is false for skilled agents.
- **Status**: 🟡 NEEDS SCAN
- **Action**: Scan KE entries that reference "context stripping", "information asymmetry", or "MARCH" for outdated assumptions. Flag any that need qualification.
- **Assigned To**: Coach (next KE review cycle)

### CT-006: Adversarial Framing — Text Rule or Novel Mechanism?
- **Type**: Mechanism Tension | **Severity**: HIGH
- **Claim A**: KE-002 — text rules don't work on judgment tasks (0/35+)
- **Claim B**: EXP-103 — adversarial framing ("find 3 bugs") achieves 100% (6/6) on verification confabulation — but is delivered as text
- **Evidence Delta**: Both well-evidenced. The tension is in categorization, not data.
- **Status**: ✅ RESOLVED (REFINE_SCOPE)
- **Resolution**: EXP-108 design (§1.2) explicitly addresses this: adversarial framing is "structural text" that changes the generation objective, not a declarative text rule that describes an outcome. KE-002's nuance section distinguishes declarative (0/35) from structural (2/9 pass). WKWA-006 formalizes the spectrum. Not a contradiction — a category refinement that strengthens both claims.
- **Resolved**: 2026-04-09 (EXP-108 design document)
- **Bayesian Impact**: None — both KE-002 and KE-059 updated with refined scope

### CT-007: KE-031 Domain Independence — Tested on 3 Domains, Claims Generality
- **Type**: Scope Conflict (potential) | **Severity**: LOW
- **Claim**: KE-031 — "Forced externalization is domain-independent" based on 3 failure domains (tunnel vision, sycophancy, contradiction blindness), N=30
- **Concern**: 3 domains is evidence but not proof of domain independence. Untested on: phase-boundary violations (FM-2.6), instruction drift, failure chain propagation (FM-1.4).
- **Status**: 🟡 NEEDS SCAN — Will EXP-108 results (which tests forced externalization on new domains) update this?
- **Action**: After EXP-108 Phase 2 completes, re-evaluate KE-031 scope claim with expanded domain evidence.
- **Assigned To**: Bob (post-EXP-108)

---

## Resolution Log

| Date | CT-ID | Action | By |
|------|-------|--------|----|
| 2026-04-09 | CT-001 | REFINE_SCOPE — DD-694 qualified for unskilled agents | Coach (KE-103 creation) |
| 2026-04-08 | CT-002 | REFINE_SCOPE — KE-002 refined into declarative/structural spectrum | Bob (WKWA-006) |
| 2026-04-09 | CT-003 | MERGE → H-041 | Bob (PRIORITY-TRACKER cleanup) |
| 2026-04-09 | CT-006 | REFINE_SCOPE — structural vs declarative text distinguished | Coach (EXP-108 design) |

---

## Metrics

| Metric | Value | Notes |
|--------|-------|-------|
| Total contradictions tracked | 7 | Initial seed scan |
| Resolution rate | 3/7 (43%) | Above random but below 50% target |
| Average resolution lag | <1 sprint | Most resolved at creation time |
| False positive rate | TBD | Need 1 full cycle to measure |
| P(H) updates from CTs | 1 (H-091) | Target: ≥2/sprint |

---

*Next scheduled scan: end of next sprint or when EXP-108 Phase 2 unblocks.*
