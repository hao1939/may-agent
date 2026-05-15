# Knowledge Entry Quality Audit — H-182 Baseline

**Date**: 2026-06-20
**Auditor**: Bob
**Sample**: 30 entries from `agents/shared/knowledge/entries/` (KE-001 through KE-335)
**Total entries in corpus**: 352
**Purpose**: Establish false-positive/noise baseline for H-182 (verified lesson gates)

---

## Summary

| Category | Count | % |
|----------|-------|---|
| CORRECT | 19 | 63% |
| STALE | 2 | 7% |
| MISLEADING | 2 | 7% |
| VAGUE | 7 | 23% |

**Noise rate (STALE + MISLEADING + VAGUE)**: 37% of sampled entries are not immediately useful as-is.

---

## Category Definitions

- **CORRECT**: Actionable, accurate, well-evidenced, appropriately scoped
- **STALE**: Was true when written but has been superseded or falsified
- **MISLEADING**: Contains claims that are incorrect or could cause harmful decisions
- **VAGUE**: Too generic, incomplete, or unfalsifiable to drive action

---

## Detailed Classifications

### CORRECT (19)

| Entry | Title | Why Correct |
|-------|-------|-------------|
| KE-001 | Context learning works for environmental knowledge only | A/B tested, N=6, 100% consistent, clear scope |
| KE-002 | Text rules don't fix judgment failures | N=32+, strongly verified, scope caveat preserved |
| KE-003 | Rich delegation context reduces wasted ops by 47% | Quantified, verified, limitations noted |
| KE-006 | Skills targeting reasoning don't change tool-calling | Clear mechanism explanation, extends KE-002 |
| KE-007 | Structural interventions are the only reliable behavioral interventions | 56+ experiments, contradiction-resolved |
| KE-013 | Task boundedness drives delegated session quality | N=116 sessions, 49.4pp gap |
| KE-014 | Bash quote splitting bypass | Concrete security finding, patched |
| KE-015 | Decision topology predicts workflow effectiveness | ρ=0.95, 8/8 production predictions |
| KE-019 | Sycophancy requires materialization gates (L5) | 0%→100%, consistent |
| KE-020 | Agent capability adoption requires explicit wiring | 0/30 discovery across 3 resource types |
| KE-021 | Skill effectiveness: process > knowledge > judgment | Strongly verified, clear hierarchy |
| KE-024 | Dispatcher heartbeat pattern | 94% cost reduction, verified |
| KE-032 | Forced externalization via write OR read pathway | Ablation study, verified |
| KE-036 | Behavioral frustration detection must be verification-gated | 50% FP without gating, clear design principle |
| KE-064 | Execution crowding — analysis trap | N=10/arm, clear mechanism |
| KE-176 | Selective skill compliance by deviation cost | 10/10 consistent pattern |
| KE-213 | Bottom-up isolation investigation method | Clear methodology, practically useful |
| KE-215 | Question-framing triggers metric reaction | N=88, 0%→100% |
| KE-239 | Cognitive-executive separation provides 98.9-100% safety | Strong external evidence, clear connection to Law 2 |

### STALE (2)

| Entry | Title | Why Stale |
|-------|-------|-----------|
| **KE-027** | Deployed skills produce compound ceiling shifts | **Explicitly FALSIFIED** by EXP-041 ablation study. Entry retains the original claim in the title and body before noting falsification. A reader scanning titles would get the wrong conclusion. Should be archived or retitled. |
| **KE-005** | QA rubber-stamps — 14% issue detection | Data from 2026-03-29 (earliest sprint). QA role, evaluation system, and metrics have been overhauled multiple times since. The 14% vs 27% comparison is almost certainly no longer representative. |

### MISLEADING (2)

| Entry | Title | Why Misleading |
|-------|-------|----------------|
| **KE-099** | Adversarial framing bypass for verification confabulation | Originally claimed +75-89pp effect from adversarial framing. **Own confound note** states confidence dropped to LOW — a skill deployment (not the framing) likely caused the improvement. But the title still says "Adversarial Framing Bypass" as if it works. A reader who doesn't read the confound warning will adopt a disproven technique. |
| **KE-204** | Form-function gap (agents reproduce structure without substance) | Near-duplicate of KE-198 with identical claims. Having two entries with slightly different framing creates a false sense of convergent evidence. Additionally, the "prediction" section extrapolates from a synthetic social network to our production system without empirical validation — could lead to over-engineering collaboration guards. |

### VAGUE (7)

| Entry | Title | Why Vague |
|-------|-------|-----------|
| **KE-308** | Diversity collapse / structural coupling | **Incomplete template** — still contains `<Title — what we learned>` placeholder and `<data, experiment result, or observation>` stub. Zero evidence provided. |
| **KE-316** | Information asymmetry as verification primitive | **Incomplete template** — same template placeholders. One-sentence finding, no evidence. |
| **KE-317** | Geometric semantic consensus (radial/Fréchet) | **Incomplete template** — same issue. |
| **KE-040** | Memory architecture convergence | Theoretical synthesis of 4 papers. No actionable claim — "memory is the primary scaling axis" is not falsifiable without specifying what memory investment to make. |
| **KE-047** | Agent harness architecture convergence | Claims "10 structural subsystems" but is a literature survey, not an empirical finding. No testable prediction. Useful as a reference but not as a lesson. |
| **KE-153** | Observability tax design implications | Synthesizes DD-750 but the actionable content ("visible reasoning trace is not the reasoning itself") is too abstract to drive a specific design decision. |
| **KE-325** | Disagreement architecture — five-layer stack | Framework description, not a finding. No evidence from our system. Would need experimental validation to be actionable. |

---

## Patterns Observed

### 1. Incomplete Templates Are the Worst Offenders
KE-308, KE-316, KE-317 are literal template stubs that were committed without being filled in. These are pure noise — they contain placeholder text like `<data, experiment result, or observation>`.

### 2. Falsified Entries Aren't Clearly Marked
KE-027 says "FALSIFIED" in the status field but the *title* still reads as if the finding is true. KE-099 has a confound warning but the title is still assertive. Both would mislead a reader scanning entry titles.

### 3. Literature Surveys Masquerade as Findings
KE-040, KE-047, KE-153, KE-325 are paper summaries or theoretical frameworks, not empirical findings from our system. They're useful as references but shouldn't be in the same namespace as verified findings.

### 4. Duplicate Entries (KE-198 / KE-204, KE-213 / KE-310)
At least two pairs cover the same topic with overlapping content, inflating the apparent evidence base.

---

## H-182 Baseline Metrics

For verified lesson gates, these numbers define what we're trying to improve:

| Metric | Value |
|--------|-------|
| **Noise rate** | 37% (11/30 entries are STALE, MISLEADING, or VAGUE) |
| **Template stub rate** | 10% (3/30 are incomplete templates) |
| **Falsified-but-not-archived rate** | 7% (2/30 are known-bad but still in active corpus) |
| **Duplicate rate** | 7% (2 duplicate pairs in 30 entries) |
| **Pure accuracy rate** | 63% (19/30 are correct and actionable) |

**Target for H-182**: Reduce noise rate from 37% to <10% via automated quality gates at lesson commit time.

---

## Recommended Immediate Actions (Pre-H-182)

1. **Archive KE-027 and KE-099** — both are explicitly falsified/confounded
2. **Complete or delete KE-308, KE-316, KE-317** — template stubs add zero value
3. **Merge KE-198↔KE-204 and KE-213↔KE-310** — eliminate duplicates
4. **Separate literature surveys from empirical findings** — different namespace or tag
