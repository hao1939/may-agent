# DD#426: Atlas — Compiled Memory for Language Agents

**Paper:** "Compiled Memory: Not More Information, but More Precise Instructions for Language Agents"
**Authors:** James Rhodes, George Kang (AlphaBitCore, Inc.)
**arXiv:** 2603.15666 (submitted March 12, 2026)
**Rating:** ★★★★★ CRITICAL — First rigorous architecture for memory-as-behavioral-modification with formal verification gates

---

## Core Thesis

> "Memory is distillation, not storage; delivery is instruction rewriting, not context injection."

Atlas solves a different problem than MemGPT, Mem0, RAG, or any retrieval-based memory system. Those systems answer "how to retrieve more information within a context budget." Atlas answers "what experience is worth keeping, and how should it change agent behavior." The delivery mechanism is **prompt evolution** — compiling verified experience into permanent instruction modifications at zero additional inference cost.

---

## Architecture: Four-Layer Distillation Model

### Layer Stack (innermost → outermost, increasing epistemic maturity)

| Layer | Scope | Duration | Contents |
|-------|-------|----------|----------|
| **Fresh** | Run-scoped | Ephemeral | Raw observations from current execution |
| **Task** | Workspace-scoped | Per-task | Accumulated signals within a task lifecycle |
| **Contextual** | Workspace-scoped | Durable | One episode per completed task (full context) |
| **Historical** | Tenant-scoped | Long-lived | Verified facts with factKey, confidence, validity windows, corroboration counts |

**Only Historical-layer facts reach the evolved prompt.** Everything else is intermediate.

### Promotion Events
- `end_run` triggers: Fresh → Task, Task → Contextual (episode creation), Contextual → Historical (three-step gate)
- Promotion is **event-driven**, not periodic

---

## Three-Step Verification Gate (the critical innovation)

Every fact must pass all three steps to reach the Historical layer:

### Step 1: Deduplication
- Candidates embedded and similarity-queried
- Matches above τ_d = 0.92 **rejected** (duplicate)

### Step 2: LLM Verification
- Non-duplicate candidates evaluated in batches of B=10
- Verdicts: `accept`, `reject`, `merge`, `needs_review`
- **Critical safety property:** On LLM failure → `needs_review` (never silent promotion)

### Step 3: Grounding
- Candidate must share ≥2 significant keywords with source episode
- Lexical heuristic that filters fabricated facts
- Not full semantic entailment — acknowledged as a limitation

---

## Confidence Process (Formal Definition)

Let c₀ = 0.5. After event i:
- **Corroboration:** c_{i+1} = 1 - (1 - c_i) × λ₊, where λ₊ = 0.3
- **Contradiction:** c_{i+1} = c_i × λ₋, where λ₋ = 0.7

Concrete trajectory from c₀ = 0.5:
- 1 corroboration → c = 0.85
- 2 corroborations → c = 0.955
- 1 contradiction from c = 0.95 → c = 0.665 (flagged for review)

**Only facts with c ≥ 0.85 reach the evolved prompt** (i.e., minimum 1 corroboration required)

---

## Dual-Source Fact Extraction

The system learns from BOTH failures and successes:

### From Errors → Boundary Rules
- "Where to start and stop"
- Example: Agent over-includes venue language in jurisdiction extraction → boundary rule: "extract only the jurisdiction name; stop before venue clauses"

### From Successes → Guard Facts
- "Descriptions of correct behavior"
- Protect existing rules from being weakened during prompt evolution
- Example: "The agent correctly extracted the jurisdiction name without including venue language"

**Both types reach the evolved prompt.** Rules instruct behavior; guards prevent regression.

### Corroboration Enrichment
When a corroborating candidate contains boundary rules or trigger phrases absent from the existing fact, an LLM merges new specifics. **Fact richness ρ(f) is monotonically non-decreasing.**

---

## Prompt Evolution Pipeline

### Write Path (Algorithm 1)
1. Run agent on examples, compare to gold
2. Extract boundary rules (from errors) + guard facts (from successes)
3. Each fact passes three-step gate
4. Surviving facts stored with factKey, confidence, validity window

### Read Path (Algorithm 2)
1. **Filter:** c ≥ 0.85, dedup by type, sanitize (remove instance-specific entities)
2. **Evolve:** LLM adds facts as sub-bullets under relevant instruction lines
3. **Anchor:** Strategically positioned counterbalance instructions
   - Recall anchors for precision-oriented tasks (CUAD)
   - Accuracy anchors for reasoning tasks (HotpotQA)
4. **Output:** Evolved prompt P₂ replaces base prompt P₀ permanently

**Key property:** Original prompt text preserved verbatim. Only sub-bullets added. This is annotation, not search — unlike DSPy/OPRO/APE.

---

## Results

### CUAD (Contract Analysis)
- n=6 runs × 500 examples = 3,000 paired observations, GPT-4o, temp=0
- Token F1: 61.9% → 70.5% (+8.7pp, p < 10⁻⁷, d=0.27)
- Precision: 58.5% → 71.0% (+12.5pp) — primary driver
- Recall: 82.6% → 81.3% (-1.3pp) — held by recall anchors
- All 6/6 runs won on token F1

### HotpotQA (Multi-hop QA)
- n=6 runs × 500 stratified examples = 3,000 paired observations
- Joint F1: 48.64% → 51.80% (+3.16pp, p < 10⁻⁵, d=0.145)
- Supporting Fact F1: 60.01% → 63.18% (+3.17pp)
- Joint EM: 19.67% → 23.33% (+3.67pp)
- All 6/6 runs won on joint F1

### Cross-Model Transfer (Claude Sonnet 4.5)
- Same evolved prompt compiled from GPT-4o errors, unchanged
- Joint F1: 52.61% → 54.93% (+2.31pp, p < 0.001, d=0.067)
- Answer F1: +0.32pp (p=0.22, NOT significant — Claude already strong here)
- Supp. Fact F1: +2.37pp (p < 0.001) — gains concentrate where room exists
- **Demonstrates task-shaped, not model-shaped knowledge**

---

## The Training Signal Constraint (Central Finding)

> "The evolved prompt learns exactly what it is taught, and nothing more."

**v2 vs. v3 ablation (same base, same test, only analysis prompt changed):**

| Metric | v2 Δ (answer-only facts) | v3 Δ (multi-objective) | Shift |
|--------|--------------------------|------------------------|-------|
| Answer F1 | +1.28pp | +1.21pp | -0.07 (flat) |
| Supp. Fact F1 | +2.35pp | +3.17pp | +0.82pp |
| Joint F1 | +2.13pp | +3.16pp | +1.03pp |

Adding attribution facts **specifically widened** the supporting-fact gap while leaving the answer gap unchanged. The system learned what it was taught and nothing more.

**This is an architectural property, not a bug:** the read-path output is bounded by the write-path input. Practitioners must characterize ALL evaluation dimensions and ensure the analysis prompt covers each.

---

## CUAD Component Ablation

| Config | Docs | Facts | ΔF1 |
|--------|------|-------|-----|
| 50 docs, no dedup | 50 | 4 | +6.7pp |
| 200 docs, no dedup | 200 | 13 | +5.5pp |
| 400 + C1 only (dedup) | 400 | 20 | +1.0pp |
| C1+C2 (quality gates) | 1,140 | 7 | +4.4pp |
| C1-C5 (full pipeline) | 1,140 | 23 | +9.1pp |

**Key insight:** 4 clean facts (+6.7pp) >> 20 noisy facts (+1.0pp). Quality >>> quantity. This directly supports the verification-gate design.

**Second insight:** Precision rules without recall countermeasures collapse recall (-9.6pp at C1+C2). Coverage (C3) + recall anchors (C5) recovered recall while further improving precision.

---

## Limitations (Author-Acknowledged)

1. **Positive-only CUAD evaluation** — recall anchors may increase false positives on negative examples
2. **Ablation design** — CUAD component ablation is n=1/variant (weak); v2/v3 uses full n=6 (strong)
3. **Grounding heuristic** — k_min=2 keyword overlap ≠ semantic entailment
4. **Token budget** — evolved prompt ~5× longer (~960 → ~1,570 tokens); no length-matched control to isolate content vs. length effects
5. **Analysis LLM calibration** — extraction errors become compiled instructions; human review planned but not done

---

## Critical Assessment

### Strengths
1. **Clean architecture with formal properties** — the four-layer model with explicit promotion gates is production-ready
2. **The training signal constraint is genuinely novel** — turns a limitation into a principled design property. If you know what the system can learn, you control what it learns.
3. **Cross-model transfer is the strongest result** — if compiled knowledge is truly task-shaped, it could be compiled once and deployed across model swaps without recompilation
4. **Honest about effect sizes** — d≈0.14-0.27 is modest. Authors don't overclaim.
5. **Rigorous statistics** — paired t-tests, 3,000 observations, 6 runs per condition

### Weaknesses
1. **No adversarial evaluation** — what happens when an adversary crafts inputs that pass the three-step gate? The dedup threshold (τ_d=0.92) and keyword grounding (k_min=2) are easily gamed
2. **Length confound unresolved** — 5× longer prompt could contribute pure length effects; authors acknowledge but don't test
3. **Two benchmarks, one task class** — both CUAD and HotpotQA are essentially extraction tasks. Does this work for generation? Planning? Tool use?
4. **Small company, no institutional backing** — AlphaBitCore Inc. is not well-known; no code released (as of submission)
5. **Confidence process is ad hoc** — λ₊=0.3, λ₋=0.7 are hyperparameters without theoretical justification

---

## Connections to Prior Work

### → DD#425 (CGAE — Comprehension-Gated Agent Economy)
CGAE gates economic actions by robustness; Atlas gates behavioral modifications by verification confidence. Both implement **bounded permission structures** where agents earn expanded capabilities through demonstrated competence. A unified architecture:
- CGAE gates what agents CAN DO
- Atlas gates what agents CAN LEARN (behavioral self-modification)
- Together: agents earn both action permissions (CGAE) and learning permissions (Atlas)

### → DD#424 (DynaTrust — Dynamic Trust Graphs)
DynaTrust's trust scores between agents could modulate Atlas's cross-agent memory sharing:
- High-trust pairs share compiled prompts directly (cross-model transfer)
- Low-trust pairs require independent verification of shared facts
- Trust score could be an additional input to the confidence process

### → DD#419 (DRCB — Steganographic Collusion Defense)
Atlas's grounding heuristic (keyword overlap) is vulnerable to steganographic injection — hidden payloads in seemingly-grounded facts. DRCB's representational circuit breakers could be applied to the verification gate to detect semantically-anomalous fact candidates.

### → CR#234 (ICLR MemAgents Cluster)
Atlas occupies the "explicit behavioral change" quadrant of the 2×2 memory framework. CraniMem's consolidation loop is the precursor mechanism; Atlas takes it further by compiling into prompts rather than knowledge graphs. The open quadrant (latent behavioral modification) remains the missing piece.

### → CR#152 (MAS Safety Monitoring Stack)
Atlas's verification gate maps to the "pre-execution governance" layer. The three-step gate could be integrated with ILION's safety cascade (DD#408) — facts that pass verification are like actions that pass safety checks.

### → DD#417 (Spectral Guardrails)
The spectral analysis approach to detecting hallucinations could be applied to Atlas's fact extraction step — checking whether extracted facts are hallucinated by the analysis LLM before they enter the three-step gate.

---

## Architectural Implications for MAS

Atlas introduces a **fundamentally new memory primitive** for multi-agent systems:

1. **Agent Self-Improvement Without Training** — agents compile experience into better instructions, with zero gradient updates. This is practical for production MAS where fine-tuning individual agents is infeasible.

2. **Cross-Agent Knowledge Transfer** — compiled prompts transfer across model families. In heterogeneous MAS (mixed GPT-4o / Claude / open-source), a single compilation from one agent's errors benefits all agents on the same task.

3. **Verifiable Learning** — the three-step gate makes every behavioral modification auditable. In regulated domains, you can trace exactly which facts modified which instructions and what evidence supported each fact.

4. **Training Signal as Control Lever** — the training signal constraint means operators control the scope of agent learning by controlling the analysis prompt. Want agents to improve only precision? Target the training signal there. This is a governance primitive.

---

## Summary

Atlas presents a clean, formal architecture for memory-as-behavioral-modification: four distillation layers with verified promotion gates, dual-source fact extraction (errors → boundary rules, successes → guards), and prompt evolution that compiles experience into permanent instruction changes. The central finding — the training signal constraint — turns a limitation into a feature: the system learns exactly what it's taught, giving operators precise control over what agents learn. Results are modest but consistent across two benchmarks, two model families, and 18,000+ paired observations. The cross-model transfer result (task-shaped, not model-shaped knowledge) has immediate implications for heterogeneous MAS deployments.

**For the MAS research landscape, this paper's key contribution is reframing memory from a retrieval problem to a governance problem: not "how much can the agent remember?" but "what should the agent be allowed to learn, and through what verification process?"**
