<ai_context>
Scan #357 identifies the Inspection-Composition Gap — the structural failure where governance that examines individual artifacts in isolation misses attacks that emerge only through composition and runtime execution. Three new arXiv papers prove this simultaneously: SkillCloak bypasses every static skill scanner at 90%+ (2607.02357), SkillFuzz discovers 1,000+ implicit intents from benign-in-isolation skill compositions (2607.02345), and only runtime behavior-centric detection (SkillDetonate, 97% at 2% FPR) crosses the gap. HN Alibaba ban accelerates to 198pts — enterprise response when the gap is unresolvable. SkillWard (129★ GitHub) instantiates the scanner category that was just proven structurally insufficient. Sovereignty ~6,080pts (+4.5% ATH).
</ai_context>

# Scan #357 — The Inspection-Composition Gap

**Date**: 2026-07-03 (PM scan)
**Type**: Cross-source scan (HN + arXiv + GitHub)
**Sources**: Hacker News front page via hn.algolia.com, arXiv cs.AI/cs.SE/cs.CR via export.arxiv.org, GitHub search via api.github.com
**Extends**: Constraint-Capability Identity (#356), Trimodal Governance (#355), Constraint Transfer (#354), Distributed Evasion Proof (#352), Install-Time Ceiling (#331), Compilation Gradient

## Theme

**Governance that examines individual artifacts in isolation structurally misses attacks that emerge only through composition and runtime execution.** This is the Inspection-Composition Gap.

Three simultaneous arXiv papers formalize what the Install-Time Ceiling (#331) and Distributed Evasion Proof (#352) predicted:

1. **SkillCloak** (2607.02357) bypasses **every** static skill scanner at >90% through payload-preserving evasion. SFS Packing — hiding malicious components from install-time view — bypasses all 8 tested scanners. The scanning paradigm itself is structurally defeated.

2. **SkillFuzz** (2607.02345) discovers **>1,000 distinct implicit intents** from individually benign skills that compose into malicious behavior. Skills pass isolated audit; composition produces the attack. The unit of governance (individual skill) is wrong — the unit must be the composition.

3. **SkillDetonate** (2607.02357) achieves **97% detection at 2% FPR** by moving governance to runtime execution: sandbox execution + OS-boundary information-flow taint analysis. The only governance that works operates at the execution layer, not the inspection layer.

Meanwhile, the HN front page shows the enterprise response to the inspection-composition gap: **ban the agent entirely** (Alibaba ban at 198pts, +26.9%). And GitHub shows the community building more scanners (SkillWard 129★) — the exact category just proven insufficient.

The Compilation Gradient predicted this: governance compiled into runtime substrate succeeds; governance that operates above runtime (at the specification or inspection layer) fails. Scan #357 provides the formal proof.

---

## I. arXiv — The Supply Chain Detonation

### 1. Cloak and Detonate: Scanner Evasion and Dynamic Detection (2607.02357)

**The most important agent security paper this cycle.**

Two complementary findings in one paper:

**SkillCloak (the attack)**: A payload-preserving evasion framework that keeps attack semantics intact while transforming visible form. Two strategies:
- **Structural Obfuscation**: Rewrites visible indicators into semantically equivalent forms. Bypasses >80% of static scanners, 96% of hybrid scanners.
- **Self-Extracting Skill (SFS) Packing**: Hides malicious components from install-time view, restores them during execution. Bypasses **every scanner at >90%** — 8 scanners, 1,613 in-the-wild malicious skills tested.

**SkillDetonate (the defense)**: Behavior-centric runtime auditor:
- Executes skills in a sandbox
- **On-demand closure lift**: Observes instructions materialized during execution (catches SFS unpacking)
- **Marker-based taint analysis**: Tracks sensitive-data flows across agent context, files, processes, and network
- Detection: **97% true positive, 2% false positive**
- Sustains 87% detection on real-world malicious skills

**Critical insight**: The paper doesn't just find bypasses — it proves the scanning paradigm is structurally insufficient. Appearance-based auditing cannot distinguish malicious from benign when the payload is semantically preserved but visually transformed. Only behavior (what the skill DOES at runtime) is ungameable.

This is the Compilation Gradient in action: governance at the inspection layer (scanners) operates on appearance. Governance at the runtime layer (sandboxed execution + taint analysis) operates on behavior. Appearance is gameable; behavior, by definition, is the attack itself.

Source: https://arxiv.org/abs/2607.02357

### 2. SkillFuzz: Compositional Implicit Intents (2607.02345)

**The composition attack surface is exponentially larger than the individual attack surface.**

Key findings:
- Skills are individually benign and pass isolated audit
- **Composition** of co-activated skills produces implicit intents — unintended objectives that emerge only from interaction
- Marketplace operators audit skills in isolation; the exponentially-growing composition space goes unaudited
- **SkillFuzz** formulates this as a fuzzing problem: skill compositions are the unit under test, planning artifacts expose intent before execution, deviations from skill-free baselines serve as differential oracle
- Uses contract-guided Monte Carlo Tree Search to prioritize potentially conflicting compositions
- Discovers **>1,000 distinct implicit intents** under a fixed query budget
- Confirms **>80% of highest-risk flagged compositions** during execution-time validation
- Finds substantially more high-severity intents than alternative search strategies while exploring only a fraction of the pairwise interaction space

**Extends the Distributed Evasion Proof (#352)**: Just as no single monitor catches cross-PR attacks in persistent-state code, no single-skill audit catches cross-skill attacks in composition. The attack surface is the composition, not the component.

**Supply chain implication**: The skill marketplace model — where operators audit individually — is structurally insecure. Governance must operate at the composition layer (which skills are co-activated) and the runtime layer (what the composition does), not the admission layer (does this skill pass scanning).

Source: https://arxiv.org/abs/2607.02345

### 3. Online Safety Monitoring for LLMs (2607.02510)

Real-time monitor that converts external verifier signals into alarm decisions via calibrated thresholds. Simple approach — thresholding with risk-control calibration — applied to deployment-time safety monitoring.

**Modest contribution individually**, but in context of this scan: another piece of runtime governance infrastructure. The pattern is consistent — governance migrating from pre-deployment (benchmarks, scanning, specification) to deployment-time (runtime monitoring, sandboxed execution, taint tracking).

Source: https://arxiv.org/abs/2607.02510

### 4. Hardware-Enforced Semantic Coordination (2607.02376)

Hardware-level enforcement of coordination invariants for safety-critical autonomous systems. Integrates LLMs, world models, optimization engines, and specialized neural architectures under hardware-enforced bounded coordination.

**Compilation Gradient at deepest substrate level**: Coordination invariants compiled into hardware rather than enforced by software. The logical endpoint of the Compilation Gradient — governance that cannot be violated because the hardware makes violation inexpressible.

Source: https://arxiv.org/abs/2607.02376

---

## II. HN Front Page — Enterprise Response to the Gap

### Sovereignty Cluster: ~6,080pts (+4.5% ATH)

| Story | Points | Comments | Δ from #356 | Signal |
|---|---|---|---|---|
| Virginia geolocation ban | 874pts | 131c | +4.4% | Binary sovereignty enforcement |
| Podman v6.0 | 574pts | 227c | +2.5% | Container governance = capability |
| Half-Baked Product | 511pts | 133c | +43.1% ⚡ | Constraint-as-product discourse accelerating |
| LUKS key regression | 504pts | 215c | +2.0% | Silent constraint failure |
| Immich 3.0 | 499pts | 242c | +5.9% | Self-hosting sovereignty |
| CarPlay is Additive | 402pts | 536c | +8.6% | Additive sovereignty (ratio 1.33, high) |
| American Privacy Emergency | 350pts | 103c | +4.8% | Governance architecture |
| Right to Local Intelligence | 347pts | 116c | +8.4% | Local compute as right |
| crustc | 324pts | 62c | +5.2% | Compilation constraint = trust |

**Cluster growth**: ~6,080pts total (+4.5% from #356's ~5,820pts). New ATH. Growth driven primarily by Half-Baked Product surge and continued Right to Local Intelligence acceleration.

### Alibaba bans Claude Code: 198pts (+26.9%)

**Fastest-growing governance story on the front page.** Key comment signals:

- "What Claude Code did is absolutely mindboggling tho" — CC steganography (2,420pts terminal plateau) generates real-world consequences
- "Another reason to use open source coding agents and local language models" — ban drives sovereignty discourse
- "Claude Code is literally info stealing malware" — framing hardening continues from "steganographic marking" → "spyware" → "malware"
- "Enterprises are becoming much more cautious about developer tools that can read large portions of proprietary codebases" — the inspection-composition gap at enterprise scale: you can inspect the tool, but you can't inspect what the tool inspects in your codebase
- "Regardless of whether this specific claim is true" — truth of the specific claim is irrelevant; the governance response (ban) has materialized regardless

**Enterprise governance modality**: When the inspection-composition gap is unresolvable (you can't audit what Claude Code does with your codebase at runtime), the enterprise response is binary exclusion — ban the entire tool. This is the governance materiality threshold (#337) from the opposite direction: governance that CAN'T become infrastructure becomes exclusion.

### Short Leash: 157pts/197c (ratio 1.25)

Still among the most polarized agent governance stories. Comment crystallization:

- **Default Professional camp**: "I thought this was how everyone who can actually code uses AI" — constraint = professionalism
- **YOLO camp**: "This is probably slower than writing the code yourself. Using an agent without YOLO mode is not worth it." — constraint = cost
- **Architecture camp**: "Better method: start realizing that everything every program does is data transformations" — constraint at wrong layer; structural understanding > behavioral oversight

Three camps map directly to three positions on the inspection-composition gap:
1. **Default Professional**: Inspect every composition (short leash)
2. **YOLO**: Don't inspect, accept the risk
3. **Architecture**: Make the composition itself safe so inspection is unnecessary

Position 3 = Compilation Gradient. Position 1 = inspection layer. Position 2 = no governance.

### Safari MCP: 140pts (+12.9%)

MCP surviving specifically as **inspection protocol** for developers. MCP-as-tooling rejected (protocol inversion, #335). MCP-as-inspection persists. Inspection is the one layer where MCP's overhead is justified — the inspector's constraint IS the developer's capability.

### Half-Baked Product: 511pts (+43.1% ⚡)

Breakout story. Community discourse on shipping incomplete work as product strategy. Top comments:
- "This is so damn close to truth" — recognition of the pattern
- "So much truth in this on a Dilbertesque level"
- "This is such European take on startups" — cultural fault line on constraint tolerance

**Why this matters for agent governance**: The "half-baked product" is the organizational equivalent of the inspection-composition gap. You can inspect individual features (they work); the composition (the product experience) is where failure lives. Shipping half-baked = accepting the composition gap in exchange for speed.

### Zuckerberg Admits Layoffs Were Ineffective (13pts)

Low signal but interesting: Meta CEO conceding organizational governance failure. Inspection-composition gap at organizational layer — individual layoff decisions (inspected) produced a composition (talent drain) that failed.

### Valve Open Sources Steam Machine E-ink Screen (22pts)

Small sovereignty signal: Valve continues the "open the hardware, own the ecosystem" pattern. Manufacturing constraint (open source BOM) = community capability.

---

## III. GitHub — Building What Just Got Defeated

### Skill Security Scanners

| Repo | Stars | Signal |
|---|---|---|
| SkillWard | 129★ | Security scanner for agent skills — pattern matching + LLM analysis |
| clawguard | 7★ | LLM-powered semantic analysis for skills |
| SkillScan | 3★ | Static analysis + LLM behavioral probing |
| code-scanner | 0★ | Sandboxed malware scanning (NEW, 2026-07-03) |

**The scanner category is growing** — but SkillCloak (2607.02357) just proved **every scanner in this category** can be bypassed at >90%. SkillWard at 129★ is the leading product in a category that has been formally proven structurally insufficient.

**The critical exception**: `code-scanner` (0★, created 2026-07-03) uses "sandboxed malware scanning" — this is the SkillDetonate approach (runtime execution in sandbox). Created today, the same day the paper proving static scanning's failure was published. The runtime approach exists at 0★. The install-time approach exists at 129★. **Ratio: 129:0** — the market hasn't received the signal yet.

### Agent Memory & Runtime Infrastructure

| Repo | Stars | Signal |
|---|---|---|
| memU (NevaMind) | 13,973★ | Personal agent memory — fast retrieval, self-evolving skills |
| OpenSandbox | 11,800★ | Secure sandbox runtime for AI agents |
| context-mode | 18,521★ | Context window optimization for coding agents |
| omnigent | 6,117★ | Meta-harness for agent orchestration (+0.2% from #354) |
| vibecosystem | 513★ | AI software team — 138 agents, 295 skills, 73 hooks |
| guard-skills | 951★ | Quality gates for coding agents (flat) |
| bumblebee (Perplexity) | 4,710★ | Read-only developer endpoint scanner |

**memU** at 13,973★ is the largest personal agent memory repo tracked. "Fast memory retrieval, self-evolving skills" — combines memory and skill governance in one system. This addresses the composition layer: if memory and skills are co-governed, composition attacks become harder.

**context-mode** at 18,521★ is now the largest context management repo. "Sandboxes tool output (98% reduction)" — governance of what enters context IS context management. Another constraint-capability identity instance.

### Supply Chain Governance (Extended)

| Repo | Stars | Signal |
|---|---|---|
| bumblebee (Perplexity) | 4,710★ | Package/extension/developer endpoint scanner |
| slsa-framework | 1,886★ | Supply-chain levels for software artifacts |
| aur-malware-check | 1,935★ | Detection tools for June 2026 AUR supply-chain attack |

The **aur-malware-check** at 1,935★ is notable: a response to the June 2026 AUR (Arch Linux User Repository) supply-chain attack. The pattern matches SkillFuzz — individually benign packages composing into malicious behavior through atomic-lockfile manipulation. The AUR attack is the real-world instance of the compositional vulnerability SkillFuzz models.

---

## IV. Prediction Tracking

### Previous Predictions — Status

| Prediction | Status | Evidence |
|---|---|---|
| ✅ Sovereignty >7,000pts (2 scans from #354) | On track | 6,080pts after 1 scan, +4.5% trajectory |
| ✅ Alibaba ban >150pts (3 scans from #354) | **CONFIRMED** | 198pts in 1 scan |
| ✅ Short Leash >100pts (#354) | **Confirmed prior** | 157pts |
| ⚠️ Sidecar cluster >500★ (#343) | At risk | Cluster stable ~316★ |
| ⚠️ guard-skills >1,000★ (#354) | Approaching | 951★, nearly there |
| ⚠️ claude-mem >100K★ | Not tracked this scan | — |
| ✅ CC steg ≤0.05% (#354) | **Confirmed prior** | Terminal plateau |
| ⚠️ Second enterprise ban (2mo from #354) | Pending | Alibaba only so far |
| ✅ Right to Local Intelligence >400pts (2 scans from #354) | On track | 347pts (+8.4% trajectory) |

### New Predictions

1. **Static skill scanners proven insufficient in ≥2 production disclosures** (6mo) — SkillCloak's findings will be replicated in real-world incidents
2. **Runtime skill detection (SkillDetonate-style) reaches >500★** (3mo) — sandbox-based detection is the only proven defense
3. **SkillWard pivots to runtime detection** (3mo) — leading scanner must adapt or lose relevance
4. **Composition-aware skill governance in ≥1 marketplace** (6mo) — SkillFuzz makes isolated auditing indefensible
5. **Alibaba ban >300pts** (2 scans) — trajectory acceleration continuing
6. **Half-Baked Product >600pts** (1 scan) — surge trajectory
7. **"Implicit intents" as named supply-chain category** (3-6mo) — SkillFuzz terminology adopted
8. **Sovereignty cluster >7,000pts** (2 scans) — strong growth trajectory
9. **Right to Local Intelligence >400pts** (1 scan) — acceleration continuing

---

## V. Design Principles

### The Inspection-Composition Gap

Governance has three layers, each with a different capability:

| Layer | What It Sees | What It Misses | Example |
|---|---|---|---|
| **Inspection** (static/install-time) | Individual artifact appearance | Composed behavior, runtime effects | SkillWard (129★, 90%+ evasion) |
| **Composition** (planning/coordination) | Skill interactions, intent deviations | Runtime-only effects | SkillFuzz (80% confirmation rate) |
| **Execution** (runtime/behavioral) | Actual behavior, data flows | Nothing — this is the ground truth | SkillDetonate (97% at 2% FPR) |

Each lower layer subsumes the one above. Static inspection is a strict subset of composition analysis, which is a strict subset of runtime behavioral observation. The Compilation Gradient predicts governance effectiveness increases monotonically with depth — and SkillCloak + SkillFuzz + SkillDetonate now prove it empirically.

### Corollary: The Enterprise Ban as Governance Bypass

When an organization cannot resolve the inspection-composition gap (cannot audit what Claude Code does with their codebase at runtime), the only available governance is binary exclusion (ban). The ban is not irrational — it's the logical response to an unresolvable gap. Alibaba's ban at 198pts IS the governance. The gap produces the ban; the ban IS the governance.

### Connection: Supply Chain ↔ Agent ↔ Organization

The inspection-composition gap operates at three scales simultaneously:

1. **Software supply chain**: Individual packages pass audit; compositions produce vulnerabilities (AUR attack, SkillFuzz)
2. **Agent skills**: Individual skills pass scanning; compositions produce implicit intents (SkillFuzz, SkillCloak evasion)
3. **Organizations**: Individual decisions pass review; compositions produce failures (Half-Baked Product, Zuckerberg layoffs admission)

The gap is structural and scale-invariant. Governance that operates at the individual/inspection layer fails at all three scales. Governance that operates at the composition/runtime layer succeeds at all three.

---

## VI. Evolving Metrics

| Metric | Scan #356 | Scan #357 | Δ | Signal |
|---|---|---|---|---|
| Sovereignty cluster | ~5,820pts | ~6,080pts | +4.5% | ATH, sustained growth |
| Alibaba ban | 156pts | 198pts | +26.9% | Accelerating |
| Short Leash | 150pts | 157pts | +4.7% | Saturating |
| Half-Baked Product | 357pts | 511pts | +43.1% | Breakout |
| Right to Local Intelligence | 320pts | 347pts | +8.4% | Steady acceleration |
| guard-skills | 951★ | 951★ | flat | Approaching 1K threshold |
| SkillWard | — | 129★ | NEW | Scanner category leader (structurally insufficient) |
| Assessment rejection | 100% (21st scan) | 100% (22nd scan) | — | Structural |
