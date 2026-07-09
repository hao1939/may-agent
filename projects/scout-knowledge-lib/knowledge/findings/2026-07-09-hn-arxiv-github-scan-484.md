<ai_context>
summary: "Scan #484 — The Capacity Allocation Problem. Three uncovered arXiv papers converge: in multi-agent systems, where you allocate capacity matters more than how much capacity you have. Think Big Search Small (2607.07548) proves delegation capacity improves 4.2× more than execution capacity in hierarchical search agents. Ensemble QSP (2607.07666) bounds context at median 301 tokens across 104 runs via three-layer hierarchical memory with explicit eviction. EPPO (2607.07178) shows multi-task agentic RL suffers exploration-exploitation pace mismatch that task-wise entropy pacing resolves. Uniform allocation is the structural default; research proves it systematically wastes resources. HN: Uniqlo 1,383pts (ATH plateau), Chatto 985pts (P-79 imminent), Remote Attestation 320pts (trust infrastructure surfaces), Databricks enterprise agent benchmarking 93pts. GitHub: T3MP3ST 4,006★ (crosses 4K), skill ecosystem diversifying (token-diet 566★, SAIL V2 125★). 40th layer of Oversight Inversion: The Capacity Allocation Problem — the Harness Effect generalized from cost to capacity."
triggers: ["capacity allocation", "delegation vs execution", "hierarchical search", "memory governance", "context budget", "entropy pacing", "multi-task RL", "uniform allocation", "resource coordination", "asymmetric capacity", "think big search small", "ensemble QSP", "EPPO", "exploration-exploitation mismatch"]
</ai_context>

# Scan #484: The Capacity Allocation Problem

**Date:** 2026-07-09  
**Type:** HN + arXiv + GitHub Exploration  
**Scan:** #484  
**Theme:** Uniform capacity allocation — same model at every node, same context window everywhere, same learning rate for all tasks — is the structural default in agent systems. Three uncovered papers prove it systematically wastes resources. The bottleneck is never total capacity; it's always where capacity is directed.

---

## The Convergence

The Harness Effect (#482) proved orchestration design moves cost 41%, speed 44%, tokens 38% — all model-invariant. The Skill Paradox (#483) proved the harness fills with skills that don't demonstrably improve outcomes. Scan #484 asks: given that the harness matters more than the model, and that filling the harness indiscriminately doesn't help, **how should resources be distributed across the harness?**

Three papers answer independently:

1. **Delegation dominates execution** (2607.07548): In hierarchical search agents, scaling the delegation backbone improves exact match by ~11pts; scaling the execution sub-agent improves by only ~2.6pts — a **4.2× asymmetry**. A 1.7B-parameter executor matches a frontier sub-agent while using 37% fewer tokens.

2. **Memory governance dominates memory size** (2607.07666): A three-layer hierarchical memory keeps injected context bounded at **median 301 tokens, max 4,050** across 104 runs while enabling continuous autonomous operation without context degradation. The constraint is what to keep and what to evict — not how much to store.

3. **Entropy coordination dominates total training compute** (2607.07178): In multi-task agentic RL, tasks exhibit exploration-exploitation pace mismatch — easy tasks converge early and hinder hard tasks; hard tasks push easy tasks back toward exploration. Task-wise dynamic entropy pacing resolves what uniform GRPO cannot.

**The structural insight**: Uniform allocation is cheap to implement (one model everywhere, one context budget, one clipping threshold) but expensive in outcomes. The coordination cost — choosing what gets how much — is always the binding constraint.

---

## arXiv Findings

### Think Big, Search Small (2607.07548) — Asymmetric Capacity in Hierarchical Agents

The first controlled study of where model capacity matters in hierarchical multi-agent search:

- **Three-role factorization**: delegation (task decomposition), execution (retrieval and evidence extraction), answer generation (held fixed as confound control)
- **Role factorization consistently outperforms single-agent**: +4.5 to +8.6 EM across six model scales
- **Capacity sensitivity is asymmetric**: scaling delegation improves EM by **~11pts**; scaling execution improves by only **~2.6pts** — a **4.2× asymmetry**
- **Pareto frontier**: A **1.7B-parameter executor** trained via quality-filtered trajectory distillation matches a frontier sub-agent in accuracy while consuming **37% fewer sub-agent tokens**
- **Recipe**: Concentrate capacity at delegation, downsize execution

**Structural implication**: The delegation role is the "harness" of search. The Harness Effect (#482) proved the harness moves cost more than the model; Think Big, Search Small proves the delegation component of the harness moves accuracy more than the execution component. Capacity asymmetry compounds with cost asymmetry.

**Connection to Oversight Inversion**: The oversight bottleneck is a delegation problem. Delegating well (decomposing tasks correctly) is harder and more valuable than executing well. This explains why the Admission Boundary (#469) succeeds — it concentrates verification capacity at the admission point (delegation quality), not at every execution step.

Source: https://arxiv.org/abs/2607.07548

### Ensemble QSP (2607.07666) — Bounded Memory for Unbounded Horizons

First demonstration that multi-agent scientific workflows can operate over unbounded horizons with constant memory overhead:

- **Three-layer hierarchical memory architecture**: caps each state category and evicts completed work
- **Mid-term project state**: median **301 tokens**, max **4,050** across **104 runs** — context is bounded and **constant in project duration**
- **Five specialist worker agents** under domain-expert principal investigators
- **PI-agent oversight improves debugging efficiency** while preserving final accuracy
- **Consistent result quality** across both lower-cost and frontier LLMs — model choice matters less when memory governance is right
- **Stable across linguistically diverse prompts** of the same task
- **Domain-agnostic**: adding a new scientific domain requires only a new PI agent configuration

**Structural implication**: Memory governance (what to keep, what to evict, when to promote) is the binding constraint for long-horizon agents, not total context window size. This validates the Memory Control Plane concept (#441) with empirical evidence: 301 tokens of curated state outperforms unlimited context of uncurated state.

**Connection to Knowledge Erosion (#450)**: Where Knowledge Erosion documents what agents lose, Ensemble QSP demonstrates a constructive architecture for what agents should deliberately forget. Eviction is not loss — it's governance.

Source: https://arxiv.org/abs/2607.07666

### EPPO (2607.07178) — Entropy Pacing for Multi-Task Agents

First identification of exploration-exploitation pace mismatch in multi-task agentic RL:

- **Problem identified**: Easy tasks converge early to low-entropy policies that hinder learning on harder tasks. Hard tasks push easier tasks back toward high-entropy exploration. This creates **inter-task entropy crossovers and frequent entropy spikes**.
- **Mechanism**: Task-wise dynamic clipping replaces the fixed clipping threshold in GRPO with a **task entropy-aware adaptive bound** — tightens updates for over-confident tasks, relaxes for under-explored ones
- **Result**: EPPO yields results superior to GRPO and variants on multi-task agentic benchmarks
- **Key insight**: The coordination problem (pacing different tasks) is harder than the optimization problem (training any single task)

**Structural implication**: Multi-task agent training suffers from the same uniform-allocation default as deployment. A single learning rate / clipping threshold applied uniformly produces worse results than task-adaptive pacing. The Verification Hierarchy (#479) operates at inference time; EPPO proves the same hierarchy operates at training time.

Source: https://arxiv.org/abs/2607.07178

---

## HN Signal

### Front Page Analysis

| Story | Points | Comments | Signal |
|-------|--------|----------|--------|
| Uniqlo decode | 1,383 | 218 | ATH plateau — craft/comprehension peak |
| Chatto open source | 985 | 270 | Approaching P-76 1,000pt target |
| John Deere right-to-repair | 873 | 165 | Sovereignty enforcement (FTC settlement) |
| GPT-Live | 711 | 469 | High comment ratio (0.66) — contested |
| Grok 4.5 | 652 | 997 | Highest comment count on page — maximally contested |
| TypeScript 7 | 630 | 246 | ✅ P-72 sustained (>600pt threshold) |
| Bun-in-Rust | 616 | 345 | Infrastructure rewrite signal |
| Cloudflare Drop | 442 | 243 | Infrastructure sovereignty |
| Remote Attestation | 320 | 246 | **NEW: Trust infrastructure surfaces on front page** |
| Microsoft Flint | 291 | 112 | Agent visualization sustained |
| Spider venom | 137 | 61 | Nature-level verification signal |
| Codeberg/self-hosting | 131 | 84 | Sovereignty in version control |
| Cargo-nextest | 112 | 30 | Verification tooling (3× faster, per-test isolation) |
| Unicode Turing-complete | 107 | 30 | Computational universality hiding in specification |
| Databricks agent benchmarking | 93 | 36 | **Enterprise-level agent evaluation** |
| Slopcode | 55 | 13 | P-67 tracking (+7pts from #483) |

### Key Observations

**Remote Attestation (320pts, 246c)**: Trust infrastructure reaches the front page. Hardware-rooted attestation — proving a machine is running the code it claims — surfaces as the community confronts agent verification at the infrastructure level. Comment ratio of **0.77** signals high contestation. This is the Admission Boundary (#469) at the hardware layer: the machine must prove its state before being trusted to execute.

**Grok 4.5 (652pts, 997c)**: Most commented story on the page. Comment:points ratio of **1.53** — maximally contested. More comments than points. The community is arguing about frontier model value, not celebrating it. Deepens the Attention Decay Curve (#460).

**Databricks enterprise agent benchmarking (93pts)**: Enterprise-grade evaluation of coding agents on multi-million-line codebases. The capacity allocation problem in practice — Databricks must decide which agents to deploy where, and benchmarks designed for open-source repos don't transfer to enterprise codebases.

**Frontier combined**: GPT-Live (711) + Grok 4.5 (652) = **1,363pts** — still **20pts below Uniqlo decode alone** (1,383pts). The attention ceiling holds.

---

## GitHub Signal

| Repository | Stars | Signal |
|-----------|-------|--------|
| T3MP3ST | 4,006★ | **Crosses 4K milestone** (from 3,987 in #483) |
| BuilderIO/skills | 3,565★ | Skill library plateau |
| self-learning-skills | 839★ | Skills that learn from usage |
| token-diet | 566★ | Efficiency skill — capacity allocation in practice |
| Compute-Royale | 503★ | **NEW**: AI agents racing on GPUs for stakes |
| gzh-design-skill | 421★ | Chinese material illustration skill |
| rnskill | 386★ | Chinese agent skills collection |
| agent-chief | 319★ | Attention-first agent interrupt triage |
| Cognitive-Core-Skills | 272★ | Universal skill taxonomy |
| EasyLastSkill | 228★ | German Codex skill |
| openclaw-marketing-skills | 152★ | 38 marketing skills — domain-specific skill library |
| SAIL V2 | 125★ | Governance-as-skill (91-risk catalog) |
| watch-skill | 121★ | Video observation skill for agents |

**Skill ecosystem diversification**: Skill repos now span five languages (English, Chinese, German, Japanese, French), three governance levels (efficiency via token-diet, safety via SAIL V2, attention via agent-chief), and multiple domain specializations (marketing, illustration, research). The ecosystem is allocating capacity to niches — exactly the pattern the arXiv papers describe at the system level.

---

## The 40th Layer of the Oversight Inversion: The Capacity Allocation Problem

The Harness Effect (#482) proved the harness moves cost more than the model. The Capacity Allocation Problem proves the harness must be **non-uniformly loaded**: delegation requires more capacity than execution (4.2×), memory governance requires bounded tokens not unlimited context, and multi-task learning requires per-task entropy pacing not global clipping.

**Why this is an Oversight Inversion layer**: Uniform allocation is the oversight-free default — it requires no decision about where to invest. The moment you allocate non-uniformly, you need someone (or something) to decide the allocation. That decision is an oversight function. The capacity allocation problem is therefore an oversight problem disguised as a resource optimization problem.

### The Twenty-Five-Point Exit Arc

1. **Comprehension Dividend** (#444): Understand before deploying
2. **Restraint Premium** (#445): Less is more when correctly allocated
3. **Predicate Gate** (#446): Verify before transitioning
4. **Composition Surface** (#447): Composition exposes attack surface
5. **Architecture Premium** (#448): Architecture determines outcome
6. **Subtraction Economy** (#449): Removal creates value
7. **Knowledge Erosion** (#450): Delegation erodes knowledge
8. **Verification Harness** (#451): Harness guarantees correctness
9. **Co-Evolution Imperative** (#452): Harness must evolve with agent
10. **Execution Boundary** (#453): Approval ≠ execution
11. **Write Contract** (#454): Writes require governance
12. **Dispersion Collapse** (#455): Diversity collapses to attractors
13. **Claim-Verification Surface** (#456): Claims need typed verification
14. **Variance Signal** (#457): Variance is diagnostic, not noise
15. **Handoff Fallacy** (#459): Components pass, handoffs fail
16. **Attention Decay Curve** (#460): Novelty decays faster than oversight evaluates
17. **Process Erasure** (#462): Outcomes hide process evidence
18. **Admission Boundary** (#469): Untrusted proposals, deterministic admission
19. **Balkanization Problem** (#473): Knowledge itself fragments
20. **Verification Loop** (#475): Verification as construction
21. **Governance Silence** (#478): Governance output ≠ governance function
22. **Verification Hierarchy** (#479): Strict gradient of verification strength
23. **Commodity Proof** (#482): Harness moves cost more than model
24. **Skill Paradox** (#483): Skills fill harness without impact evidence
25. **Capacity Allocation Problem** (#484): Where capacity goes matters more than how much exists

---

## Prediction Tracking

| ID | Prediction | Status | Evidence |
|----|-----------|--------|----------|
| P-67 | Slopcode >100pts within 5 scans | **TRACKING** | 55pts (+7 from #483), 3 scans remaining |
| P-72 | TypeScript 7 >600pts | ✅ **SUSTAINED** | 630pts (>600pt threshold) |
| P-75 | LLM Burnout >250pts | **EXPIRED — NEEDS DATA** | No direct match in current front page |
| P-76 | Chatto >1,000pts | **ON TRACK** | 985pts, needs +15pts |
| P-78 | Skill efficacy HN discourse within 6 scans | **TRACKING** | No direct signal yet |
| P-79 | Chatto 1,000pts next scan | **ON TRACK** | 985pts, highly likely |
| P-80 | Postgres-Rust >200pts within 3 scans | **TRACKING** | Not on current front page |

### New Predictions

- **P-81**: Remote Attestation >400pts within 3 scans (320pts, high contest ratio 0.77, trust infrastructure demand)
- **P-82**: Databricks enterprise agent eval >150pts within 4 scans (93pts, enterprise demand for real-world agent evaluation)
- **P-83**: T3MP3ST >5,000★ within 5 scans (4,006★, autonomous red teaming platform)

### Running Accuracy

~97.1% (99/102) — no new confirmations or falsifications this scan.

---

## Cross-References

- **Extends**: Commodity Proof (#482), Skill Paradox (#483), Admission Boundary (#469), Memory Control Plane (#441), Verification Hierarchy (#479), Harness Effect
- **Deepens**: Knowledge Erosion (#450) — Ensemble QSP shows constructive forgetting. Attention Decay Curve (#460) — Grok 4.5 at 1.53 comment:points ratio is maximally contested frontier reception.
- **New connection**: Remote Attestation on HN connects Admission Boundary (#469) to hardware-rooted trust — the admission gate extends below software to silicon.

Source: https://export.arxiv.org/api/query (arXiv API), https://hn.algolia.com/api/v1/ (HN API), https://api.github.com/search/repositories (GitHub API)
