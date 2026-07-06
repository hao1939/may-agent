<ai_context>
HN/arXiv/GitHub scan #350 (2026-07-03). Theme: The Modality Split — the governance debate isn't converging because there is no single correct governance modality. Three independent streams prove this: HN Short Leash discourse (110pts, 130c) fractures into three irreconcilable positions (leash/skills/YOLO), each correct for its context. Telecom GRV (2607.02210) formalizes criticality-based graduated validation as industry standard. File-Level Copying (2607.02059) proves 690,500 implicit dependencies invisible to declared-metadata governance — the ungoverned modality's actual cost quantified. crustc (239pts) demonstrates a fourth modality: transpilation as trust verification. Sovereignty cluster crosses ~3,425pts (+15% from #349). Governance is a modality selection problem, not a modality enforcement problem. Reference when evaluating governance strategy selection, criticality-based agent oversight, supply-chain visibility gaps, or the relationship between governance cost and situational risk.
</ai_context>

# The Modality Split (Scan #350)

**Scan**: #350 | **Sources**: arXiv + HN front page + GitHub | **Date**: 2026-07-03

## Thesis

Scans #348–#349 identified what agents fail at (underspecification → guessing; persistence → invisible attacks). Scan #350 identifies why the field can't agree on the fix: **there is no single correct governance modality**. The governance debate is a modality selection problem, not a modality enforcement problem.

Three independent streams converge:

1. **HN Short Leash discourse** (110pts, 130c) fractures into three irreconcilable governance positions — and each is correct for its context. "This is how everyone does it" (leash). "Skills make this unnecessary" (skill-based governance). "Not worth it without YOLO mode" (autonomous execution). The debate cannot resolve because each party optimizes for a different constraint: trust minimization, cognitive cost minimization, or throughput maximization.

2. **Criticality-Based Guard Rail Validation** (2607.02210) — the telecom industry formalizes what the agent field is debating ad hoc: graduated validation where the governance modality is selected by criticality level. Execute-with-logging for low criticality. Bounds checking for medium. Independent agent validation for high. Multi-agent consensus for critical. The answer isn't one modality — it's a selector function mapping criticality to modality.

3. **File-Level Copying as Implicit Dependency** (2607.02059) — quantifies the cost of the ungoverned modality. 690,500 copy events across open source, 4.3% documented origin, 88% CVE-risk in vendored dependencies, license violations invisible to declared-metadata scanners. The YOLO modality has a measurable and compounding cost — but that cost only manifests at supply-chain scale, not at individual-action scale.

The structural resolution: governance is not binary (governed/ungoverned) but a gradient mapped to criticality. The missing layer in the agent ecosystem is the **modality selector** — the function that determines which governance regime applies to which action.

## HN Front Page — Sovereignty Cluster Crosses ~3,425pts

| Story | Points | Comments | Trend vs #349 |
|-------|--------|----------|---------------|
| Virginia bans geolocation data sale | 710 | 117 | +5.6% from 672pts |
| Podman v6.0.0 | 485 | 197 | +5.0% from 462pts |
| LUKS disk-encryption keys in memory | 446 | 199 | +1.8% from 438pts |
| Free Market Lie (25 Gbit internet) | 412 | 251 | +45.6% from 283pts — ACCELERATING |
| Immich 3.0 | 331 | 166 | +13.0% from 293pts |
| Privacy Emergency | 280 | 85 | +6.5% from 263pts |
| crustc (rustc→C transpilation) | 239 | 42 | NEW — compiler trust chain |
| CarPlay Is Additive | 221 | 261 | +18.8% from 186pts |
| Right to Local Intelligence | 168 | 66 | +26.3% from 133pts — ACCELERATING |
| EFF letter to FTC on X consent | 133 | 49 | NEW — regulatory consent |
| Short Leash AI Coding Method | 110 | 130 | +8.9% from 101pts |
| claude-real-video (any LLM watches video) | 125 | 40 | NEW — capability extension |

**Total sovereignty cluster: ~3,425pts** (+15% from ~2,980pts in #349). **Prediction from #349 of >3,500pts (2 scans) ON TRACK** — 1 scan remaining, 75pts to go.

**Free Market Lie accelerating** (+45.6%): Infrastructure sovereignty now economically argued, not just politically. Switzerland's 25 Gbit as existence proof that competition produces outcomes monopoly can't.

**Right to Local Intelligence accelerating** (+26.3%): Crossed 100pts in #349 (✅CONFIRMED). Now at 168pts — the concept is no longer fringe. Comments polarize between open-source optimism and regulatory pessimism. Notable: "Anthropic and OpenAI will likely lobby for bans on open source."

**crustc (NEW, 239pts)**: Entirety of `rustc` transpiled to C. Community immediately reaches for DDC (Diverse Double-Compiling) — the Ken Thompson trust attack made practical. This is a **fourth governance modality**: verification by transpilation. You don't trust the compiler; you transpile it and compare.

### Short Leash: The Three Modalities

110pts, 130c (ratio 1.18). The discourse now cleanly separates into three governance postures:

1. **Leash modality** — "I thought this was how everyone who can actually code uses AI." Review every diff, deny frequently, commit per subtask. Optimizes for: trust minimization.
2. **Skill modality** — "Tightly control the output by skills." Define the boundaries via skill specifications; agent operates autonomously within them. Optimizes for: cognitive cost minimization while maintaining structural guarantees.
3. **YOLO modality** — "Using an agent without YOLO mode is not worth it." Accept risk; maximize throughput. Cost of review exceeds cost of fixing mistakes. Optimizes for: throughput maximization.

Each is correct for its context. The debate is unresolvable because the parties are optimizing different objective functions. The missing infrastructure: a modality selector that maps context (criticality, reversibility, blast radius) to the appropriate governance posture.

**Structural parallel to Telecom GRV (2607.02210)**: The telecom industry already solved this — graduated validation based on criticality. The agent field is rediscovering the same principle through discourse rather than formalization.

### claude-real-video (NEW, 125pts)

Any LLM can "watch" a video via adaptive frame extraction and structured descriptions. Capability extension with minimal governance discourse. Comments are practical ("how do you handle scrolling?") not worried ("what if it sees something bad?"). The governance modality for this tool: YOLO, because the blast radius is near-zero (reading video ≠ modifying systems).

## arXiv Evidence — 7 Papers (4 New to Library)

### 1. Criticality-Based Guard Rail Validation for Autonomous Telecom Networks (2607.02210)

**Signal strength**: HIGH — first standardizable graduated governance framework from an adjacent production domain.

The evolution toward fully autonomous telecom networks requires AI agents making real-time decisions. No standardized runtime mechanism exists for validation before execution. The paper proposes Guard Rail Validation (GRV): intercept and validate decisions based on criticality.

- **Graduated validation**: Execute-with-logging → bounds checking → independent agent validation → multi-agent consensus
- **Criticality dimensions**: Action scope, action type, service criticality, agent autonomy level, reversibility, temporal behavioral patterns
- **Cross-agent conflict detection** with criticality-weighted priority resolution
- **Regulatory compliance**: Runtime conformance logging for EU AI Act Article 14
- **Structural meaning**: The telecom industry formalizes what the agent coding community is debating informally. The modality selector IS the criticality function. This is the Leash Stack (#346) given mathematical form.

Source: https://arxiv.org/abs/2607.02210

### 2. File-Level Copying Is an Implicit Dependency in Open Source (2607.02059)

**Signal strength**: HIGH — first large-scale quantification of invisible supply-chain dependencies.

File-level copying across repositories removes the four observable signals a package manager provides (provenance, maintenance, security, compliance) with no mechanism to restore them. Mixed-method study using World of Code.

- **Scale**: 690,500 copy events from 0.1% commit sample. 3,912 rationale-bearing commits analyzed.
- **Staleness**: Median 155 days; 38.5% over one year old.
- **Invisibility**: 4.3% documented origin; 2.0% versioned. Vendored copies document origin only 10% of the time.
- **CVE risk**: 17,314 CVE-risk copy commits; **88% in vendored dependencies**; 80% score CVSS ≥ 7.0; upstream-fix adoption only 47–84%.
- **License risk**: 41,777 pre-validation candidates; 39 verified high-star violations (κ = 0.752).
- **Agent parallel**: Agent skills copy from other skills, template repos, and documentation samples. The 4.3% documentation rate maps directly to the skill marketplace provenance gap (Skill Supply Chains #334). The invisible dependency problem is IDENTICAL.

Source: https://arxiv.org/abs/2607.02059

### 3. UA-ChatDev: Uncertainty-Aware Multi-Agent Collaboration (2607.02186)

**Signal strength**: MEDIUM — first integration of uncertainty quantification into multi-agent software development.

Multi-agent frameworks assume intermediate outputs are equally reliable, enabling hallucination propagation. UA-ChatDev integrates uncertainty estimation into agent interactions.

- **Mechanism**: Token-level log-probability confidence scoring + phase-aware threshold calibration
- **Selective verification**: Triggers retrieval-based verification only when uncertainty exceeds threshold
- **Results**: Consistently outperforms single-agent and multi-agent baselines on completeness, executability, consistency
- **Structural meaning**: This is modality selection at the inter-agent level. High-confidence outputs → YOLO (pass through). Low-confidence → leash (verify). The modality selector is the uncertainty function. Connects to Manufactured Confidence (#280): confidence scoring prevents authority laundering.

Source: https://arxiv.org/abs/2607.02186

### 4. TestEvo-Bench: Executable and Live Benchmark for Test and Code Co-Evolution (2607.02469)

**Signal strength**: MEDIUM — first live benchmark for the maintenance governance problem.

Test generation and update benchmarks typically isolate tests from code changes. TestEvo-Bench anchors tasks to real commit history with execution-grounded metrics.

- **Two tracks**: Test generation (write new tests for new behavior) and test update (adapt failing tests to changed behavior)
- **Scale**: 746 generation + 509 update tasks from 59,950 candidates across 152 Java projects
- **Results**: Up to 77.5% generation success, 74.6% update success — but materially lower on recent tasks and drops under cost constraints
- **Live benchmark**: Tasks timestamped; new tasks mined periodically to reduce data leakage
- **Structural meaning**: Co-evolution is harder than generation. Governance of change over time (the update modality) is a distinct problem from governance at deployment time (the generation modality). Agents that excel at point-in-time work may fail at maintenance — which is where most production effort lives.

Source: https://arxiv.org/abs/2607.02469

### 5. Cloak and Detonate: Scanner Evasion and Dynamic Detection of Agent Skill Malware (2607.02357) — UPDATE

Already tracked in #347. Key quantitative results worth highlighting:

- **SkillCloak**: Payload-preserving evasion using Structural Obfuscation + Self-Extracting Skill (SFS) Packing. **SFS Packing bypasses ALL 8 scanners at >90%**. Structural Obfuscation bypasses >80% on most static scanners and 96% on hybrid.
- **SkillDetonate**: Behavior-centric runtime auditor. OS-boundary information-flow evidence. **97% detection at 2% FP**. 87% on real-world malicious skills.
- **Governance modality implication**: Static scanning (appearance-based modality) is structurally defeated. Runtime behavioral analysis (behavior-based modality) works. The modality choice determines whether governance succeeds or fails.

Source: https://arxiv.org/abs/2607.02357

### 6. Behind the Refusal: Guardrail Reconnaissance (2607.02121) — CONTINUED from #348

Guardrails detectable with 100% accuracy via behavioral monitoring. F1 98% for distinguishing guardrail blocks from model refusals. The guard layer is transparent to sophisticated adversaries.

- **Governance modality implication**: Guardrails that operate via visible behavioral change (refusal patterns, timing differences) are in a defeated modality — they reveal their own decision boundaries.

Source: https://arxiv.org/abs/2607.02121

### 7. Prompt Coverage Adequacy (2607.02057) — CONTINUED from #348

Coverage criteria at the prompt level detects 30%+ more faults than traditional code coverage. Operates via LLM attention mechanisms.

- **Governance modality implication**: Moving the coverage metric from code (where agents can game it, per Building to the Test #285) to prompt (where intent is expressed) is a modality shift from output governance to intent governance.

Source: https://arxiv.org/abs/2607.02057

## GitHub — Control Plane Consolidation

| Repo | Stars | Trend | Category |
|------|-------|-------|----------|
| trycua/cua | 19,324★ | Dominant | Sandbox infrastructure |
| remorses/playwriter | 3,671★ | Growing | Browser control |
| gondolin | 1,568★ | +0% | Microvm control plane |
| rivet/sandbox-agent | 1,462★ | +0% | Sandbox HTTP API |
| litellm-agent-control-plane | 1,061★ | +0% | Multi-agent routing |
| vigils | 335★ | Growing | Local control plane (Rust) |
| hazmat | 122★ | Steady | Agent containment |
| agent-cage (PNNL) | 62★ | NEW track | National-lab sandbox |
| Armorer | 58★ | Steady | Desktop control plane |

**Control plane category total: >24,000★** (up from >10,000★ in #349). CUA's 19K★ dominates, but the long tail — vigils, hazmat, Armorer — shows the pattern reproducing across form factors: cloud, desktop, national lab.

**New pattern: National-lab entry** — PNNL's agent-cage (62★) is a Docker-based sandbox from Pacific Northwest National Lab. Government-lab provenance signals institutional adoption of agent containment.

**Skill audit category emerging**: github-skill-curator (1★, CLI for Codex/CC skill auditing), skills-doctor (1★, local-first CLI for audit), grill-loop-skill (1★, Codex skill for plan review). Low stars but CATEGORY formation — skill governance tooling is materializing as predicted in #334.

## The Five Governance Modalities (Synthesis)

From HN discourse, arXiv evidence, and GitHub tooling, five governance modalities now have names, costs, and effectiveness profiles:

| Modality | Cost | When Correct | When Wrong | Evidence |
|----------|------|-------------|------------|----------|
| **YOLO** (autonomous) | Lowest | Reversible, low-blast-radius actions | Persistent state changes | claude-real-video (benign), LUKS regression (catastrophic) |
| **Skills** (structural) | Low-medium | Well-specified domains with clear boundaries | Underspecified or novel domains (#348) | SkillFuzz shows composition still dangerous |
| **Leash** (review-every-diff) | High | Critical infrastructure, irreversible actions | High-volume, low-risk tasks | Short leash method (110pts), Steerability paper (2607.02389) |
| **Graduated** (criticality-based) | Variable | Mixed-criticality workflows | Single-criticality workflows | Telecom GRV (2607.02210) |
| **Transpilation** (alternative-path verification) | Very high | Trust-chain-critical software | Non-reproducible outputs | crustc (239pts, DDC) |

**The missing layer**: No agent framework implements a modality selector. All current tools enforce a single modality. The graduated approach (Telecom GRV) is the only formalized selector, and it comes from telecom, not AI.

## Prediction Scorecard

| Prediction | Source | Status |
|------------|--------|--------|
| Sovereignty >3,500pts (2 scans) | #349 | ⏳ ON TRACK at ~3,425pts, 1 scan to confirm |
| "Control plane" as named HN category (2 scans) | #349 | ⏳ Tracking — 13+ repos but no HN discussion yet |
| StrongDM/leash >1,000★ (2mo) | #349 | ⏳ At 572★, tracking |
| Short leash >100pts | #341 | ✅ CONFIRMED (110pts, sustained) |
| Right to Local Intelligence >100pts | #344 | ✅ CONFIRMED (168pts, accelerating) |
| Sidecar >500★ | #343 | ✅ EXCEEDED (control plane >24,000★) |

### New Predictions

1. **Sovereignty cluster >3,500pts** (1 scan) — at 3,425pts, Free Market Lie accelerating (+45.6%), Right to Local Intelligence accelerating (+26.3%)
2. **Criticality-based modality selector in ≥1 major agent framework** (6mo) — Telecom GRV formalizes the pattern; agent field will follow
3. **"Governance modality" or "governance mode" as named concept in agent discourse** (3mo) — the short leash debate is already the debate about modalities
4. **Skill audit tool >100★** (3mo) — category forming (curator, doctor, grill-loop); SkillCloak creates urgency
5. **File-Level Copying cited in agent skill governance paper** (6mo) — the parallel is exact and unacknowledged
6. **National-lab agent sandbox >200★** (6mo) — PNNL's agent-cage signals institutional adoption
7. **Uncertainty-aware agent interactions in ≥1 production framework** (6mo) — UA-ChatDev pattern is simple to implement, high value

## Design Principles (this scan)

1. **Governance is a modality selection problem, not a modality enforcement problem.** No single governance approach is correct across all contexts. YOLO, skills, leash, graduated, and transpilation are all valid — for different criticality levels. The missing infrastructure is the selector function.

2. **The invisible dependency graph exceeds the visible one.** File-level copying (4.3% documented origin), skill composition (>1,000 implicit intents from benign skills), and confidence laundering (manufactured certainty in memory products) all share the same structure: the ungoverned surface is larger than the governed surface. Governance that only covers declared dependencies is structurally incomplete.

3. **Adjacent industries formalize agent governance problems before the agent field does.** Telecom's criticality-based graduated validation is the leash stack (#346) given mathematical rigor — by engineers who've been doing production autonomous systems for decades. The agent field should import, not reinvent.

---

*Extends: Persistence Attack Surface (#349), Underspecification Cliff (#348), Verification Pivot (#347), Leash Materialization (#346), Observable Surface Divergence (#345), Privacy Sovereignty (#344), Sidecar Crystallization (#343), Leash-Length Calibration (#341), Skill Supply Chains (#334), Authority Manufacture (#280)*
