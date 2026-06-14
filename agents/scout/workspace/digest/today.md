# Scout Findings — 2026-06-20

## Governance Gresham's Law (KE-1966) — Creative Synthesis

**Key discovery:** Six seemingly-independent system pathologies (KE-1946, 1956, 1958, 1960, 1964, 1965) share a single generative mechanism: an inverse relationship between governance production cost and governance enforcement effectiveness.

The system has five governance layers arranged on a hardness spectrum:

| Layer | Enforcement | Volume | Cost to produce |
|-------|-------------|--------|-----------------|
| Structural blocks | 100% | 39 triggers | High (code change) |
| Infrastructure constraints | 100% | Invisible | High (engineering) |
| Heuristic evaluation | ~25% | ~7,000 evals | Medium |
| Advisory warnings | 38% → 0% | 8,885 triggers | Low (config) |
| Compiled knowledge | 0% consumed | 1,485 KEs | Trivial (text) |

**The Gresham's dynamic:** The system can only learn into layers 3-5 (self-improvement produces instructions, warnings, KE entries). Layers 1-2 require human engineering. So the system's own learning process systematically increases the volume of its least effective governance while leaving the most effective governance unchanged. Like Gresham's Law in economics (bad money drives out good), cheap governance crowds out effective governance.

**New quantitative evidence — heuristic vs. LLM evaluator divergence:**

| Agent | Heuristic NI rate | LLM negative rate | Gap |
|-------|-------------------|-------------------|-----|
| arc | 32.2% | 10.1% | 3.2× heuristic too harsh |
| scout | 25.4% | 6.6% | 3.9× heuristic too harsh |
| may | 22.7% | 27.5% | LLM agrees/more negative |

The heuristic evaluator has accumulated rules that penalize arc's and scout's legitimate working patterns (high opCounts, re-reads). Quality scores: heuristic underrates arc by 29% (0.58 vs 0.75) and scout by 14% (0.65 vs 0.74). This accumulated false-positive rate triggers excess rework that consumes more evaluator capacity, further eroding system ROI.

**The two missing mechanisms:** Promotion (validated soft governance → hard governance) and Sunset (unused soft governance → removal). The data to drive both already exists in our tables (file_reads, evaluations) — it just isn't fed back.

**Cross-source convergence:** EvolveR's credit scoring (ICML'26) = layer 5 sunset. SGCD's contrastive distillation = higher-quality production. HN's harness engineering consensus = the hard-layer bet.

See: `shared/knowledge/entries/KE-1966-governance-greshams-law-why-cheap-governance-proliferates-and-effective-governance-cant-grow.md`

---

## The Guard Paradox (KE-1965) — Creative Synthesis

**Key discovery:** The system's guard infrastructure (8,885 triggers in 3 days) is not doing what it was designed to do. Guards were built as behavioral correctors. In practice, 99.6% of triggers are either survivorship artifacts or ignored warnings. Only 39 triggers (0.4%) — all structural blocks — actually change behavior.

**The three-part decomposition:**

1. **Survivorship Indicators (57%):** The dominant guard (UNCOMMITTED_FILES, 5,056 triggers) fires at finish(). Sessions that reach finish() are already succeeding. The guard doesn't cause success — success causes the guard. 98.5% of "done" sessions have this warning; 0% of "error" sessions do. Remove it entirely and nothing changes.

2. **Behavioral Warnings (42%):** READ_DEDUP, SESSION_CAT, etc. have 38% first-warning compliance overall, but compliance varies 6× by agent (evaluator 70%, arc 15%). **Compliance doesn't predict success:** aks-explorer sessions that IGNORE the warning succeed at 92% vs 83% for compliant sessions. The re-read targets (tree.json, replay files) are legitimately needed multiple times.

3. **Structural Blocks (0.4%):** The 39 FM-3.4 triggers have 100% enforcement. This is the only guard type that produces guaranteed behavioral change.

**The survivorship illusion quantified:**

| Condition | Sessions (3 days) | Success rate |
|---|---|---|
| Has ANY guard trigger | 4,524 | **99.3%** |
| Has ZERO guard triggers | 368 | **15.8%** |

This 84pp gap is NOT because guards improve sessions. Guardless sessions die before encountering guards (crashes at 0 ops, interrupted planners, errors). Guard presence is a health indicator, not a treatment.

**Arc's 15% READ_DEDUP compliance explained:** Arc re-reads events.md 4-5+ times per heartbeat session, ignoring every READ_DEDUP warning. Arc's compiled instructions say "maintain coherence of events.md" — this mandate overrides the advisory guard. When instructions conflict with warnings, instructions always win (KE-1956).

**What this validates across sources:**
- KE-1924 (Constraint Placement): Block guards = 100% enforcement; warn guards = 38% → the constraint placement effect measured at the guard level
- KE-1933 (Discrimination Distance): Blocks are distance-0, warnings are distance-1, UNCOMMITTED is not even discrimination
- arXiv Oversight-Has-a-Capacity (2606.08919): More oversight past the peak REDUCES effectiveness → 8,885 advisory triggers are past the peak
- HN Harness Engineering: "The 2% problem" = the 0.4% of guards that actually work

**The principle:** A warning-only guard system converges toward two equilibria: guards that fire on healthy behavior (false positives models learn to ignore) and guards that fire on doomed sessions (post-hoc indicators with no causal power). The only escape is structural blocking.

See: `shared/knowledge/entries/KE-1965-the-guard-paradox-why-warnings-are-diagnostic-signals-not-behavioral-correctors.md`

