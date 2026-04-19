# KE-199b: Low-Threshold Causal-Pointer Model — Any Causal Pointer Bridges Recognition→Execution

**Created**: 2026-04-18 by Bob
**Supersedes**: KE-199 (deprecated 2026-04-18 — built on contaminated EXP-168 arms 2–3)
**Source**: EXP-168 `results-addendum.md` (post-contamination controls) + H-166-revised
**Confidence**: ★☆☆☆ (REFUTED by EXP-177 — see below)
**Connects**: H-166-revised, KE-195 (production-displacement), KE-196 (displacement-difficulty moderation), H-165 (production-provision interference), EXP-177 (pending confirmatory), EXP-179 (difficulty-adaptive guard validation)

---

## Finding (Revised)

For cascading-bug scenarios (cascading-fix-trap-v2), the 0% → ~100% jump observed in EXP-168 is **real but the threshold is LOW**: any causal pointer to the root-cause mechanism (e.g., a single sentence naming the problem area) is sufficient to bridge recognition → execution. A complete expert analysis (F1) is not required.

This **replaces** KE-199's "step-function / all-or-nothing" model. There is no execution cliff; the recognition-to-execution bridge works once the agent has *any* causally-framed pointer at the intended bug.

## Clean-Environment Evidence

After the coder-contamination fix to `cascading-fix-trap-v2` scenario files (gym repo commit `b75d0a223`, reverting pre-solves in `grades.js`/`penalties.js`), controls run from checkpoint `s_1776358364254_320`:

| Arm | Hint Content | EXP-168 (contaminated) | Clean-env control | Delta |
|-----|--------------|------------------------|--------------------|-------|
| Base | none | 0% (0/56) | **0/3 pass** | — |
| Arm F (moderate) | "Pipeline ordering wrong + boundary bug exists" | 0% (0/10) | **10/10 pass (100%)** | **+100pp** |
| Arm E (full F1) | complete analysis + exact fix | 100% (15/15) | **5/5 pass** | unchanged |

The decisive cell is arm F: the *identical* moderate-hint string inverts 0% → 100% in a clean environment. Arm E's stability rules out a "clean env alone" reading at this N, though the small base cell (N=3) is itself not conclusive. Exact source: `experiments/EXP-168/results-addendum.md` (Post-Fix Control Data table).

## ⚠️ EXP-177 RESOLUTION (2026-04-19)

**All open questions are now RESOLVED. The low-threshold model is REFUTED.**

EXP-177 (80 runs, 4 arms × 2 scenarios × 10 trials) results:
- Pooled: BASE 30%, LEXICAL 20%, PARAPHRASE 30%, PLACEBO 15%. No arm significantly different from any other.
- S2 LEXICAL **hurt** performance: 60% base → 10% with hint (50pp negative transfer).
- S1 LEXICAL replication failure: 10/10 → 3/10 (70pp drop from the arm F result that motivated this KE).

**Open questions resolved:**
1. **A-ENVCLEAN** — PARTIALLY SUPPORTED for S2 only. S2 BASE=60% (consistent with ≥40%), but S1 BASE=0%. Pooled 30% is ambiguous. Clean env helps for some scenarios but is not a general explanation.
2. **A-LEXICAL** — REFUTED. LEXICAL at 20% invalidates ≥80% prediction. Keyword match does not reliably help.
3. **H-166-revised** — REFUTED. P updated from 0.75 → ≤0.15. The "any causal pointer ≥80%" model is wrong.
4. **Placebo null** — PLACEBO at 15% (lowest arm). Authoritative text without causal content does not help.

**The 10/10 arm F finding that motivated this KE was a small-N fluke** (see KE-287). KE-199b's core claim — that any causal pointer bridges recognition → execution at ceiling — is false.

See KE-286 (hint interventions unreliable) and KE-287 (small-N instability) for the full analysis.

## What This Invalidates

- **KE-199 (original)**: "F1 is all-or-nothing"; "0→0→0→100% step function"; "no lite version works"; "F1 cannot be cheapened" — all **refuted** by the arm-F reversal. KE-199 deprecation banner points here.
- **H-166 (original, high-threshold binary)**: P lowered 0.70 → 0.10 in H-166's reassessment section.
- **KE-199's three mechanisms** (cascade cliff, premature solver mode from partial hints, execution-bridge gap): over-fitted to the contamination artifact. Moderate hints do not visibly misfire in clean-env runs.

## Design Implication

Content-first guards need only **problem identification**, not a full fix. A one-sentence causal pointer ("the pipeline ordering is wrong and there is a boundary bug") performs at ceiling — indistinguishable from a complete expert analysis on this scenario.

This inverts KE-199's "invest in high-quality complete analyses" guidance. Cheap, terse causal pointers are competitive with expensive F1-style write-ups. For automated guard pipelines, the cost curve for hint quality **flattens dramatically** above the "names the mechanism" threshold.

## Connection to H-165 / KE-195 / KE-196 / EXP-179

The low-threshold finding fits cleanly into the **anchoring-vs-displacement** frame established by H-165 and confirmed by EXP-166:

- **KE-195 (production-displacement)**: self-production destroys F1 benefit (C=100% → D=7%). Anchoring to provided content works; producing one's own analysis over it does not.
- **KE-196 (difficulty moderation)**: displacement is visible on hard tasks, invisible on easy ones.
- **KE-199b (this)**: on the same hard scenario, *minimal* anchoring content is already enough. The guard doesn't need to deliver a lot of content — it needs to deliver content and not ask the agent to reproduce it.

Combined reading: **the effective guard is (a) causally framed + (b) small + (c) not followed by self-production.** Size is cheap; shape and absence of displacement are what matter.

**EXP-179** (difficulty-adaptive content-first guard validation) should read this KE as its floor-condition: if moderate hints already hit ceiling on cascading-fix-trap-v2, EXP-179's "graduated content" arms must be tested on a scenario where the low-threshold model *doesn't* already saturate — otherwise the difficulty-adaptation signal is masked by ceiling.

## Boundary Conditions

- Demonstrated (so far) on cascading-fix-trap-v2 only.
- Controls are small-N (base 0/3, arm E 5/5, arm F 10/10); EXP-177 is the N=20+ confirmatory run.
- Holds specifically for causally-framed pointers. Non-causal authoritative text (placebo) is untested — EXP-177 PLACEBO arm addresses this.
- Generalization to single-bug / non-cascading scenarios is out of scope for this KE (tracked as H-166 P2 and separate experiments).

---

*Filed by Bob (Architect) — 2026-04-18. Replaces KE-199.*
