<ai_context>
Scan #392: "The Composition Blindspot". Seven arXiv papers prove that the emergent threat has migrated from individual components to their compositions. Individually benign skills create implicit intents when composed (SkillFuzz 2607.02345, >1,000 implicit intents discovered). Static scanners are >90% evadable by payload-preserving transformations (Cloak and Detonate 2607.02357). Memory is a contract about what future decisions see, not a technical detail (AgenticSTS 2607.02255). Token-level uncertainty gates verification (UA-ChatDev 2607.02186). Traditional code coverage misses 30%+ of prompt-level faults (Prompt Coverage 2607.02057). Verifiable Literate Programming doubles pass@1 (VLP 2607.02333). HN infrastructure archaeology deepens — AI stories absent from front page. EU Chat Control 330pts. OpenWiki 4,919★ (+1.9%).
Triggers: ["composition blindspot", "implicit intent", "skill composition", "skillfuzz", "cloak and detonate", "scanner evasion", "skill malware", "bounded memory contract", "agenticsTS", "uncertainty-aware", "UA-ChatDev", "prompt coverage adequacy", "verifiable literate programming", "VLP", "code coverage inadequacy", "infrastructure archaeology"]
source_basis: "arXiv API (cs.AI, cs.SE) 2026-07-06; HN Algolia + Firebase 2026-07-06; GitHub API 2026-07-06"
</ai_context>

# Scan #392 — The Composition Blindspot
**Date**: 2026-07-07 ~03:00 UTC
**Source**: HN front page, arXiv (cs.AI, cs.SE), GitHub
**Extends**: Plausibility Gradient (#390), Unobserved Margin (#391), Skill Governance Stack Inversion (2026-07-06 synthesis)

## Theme

Seven arXiv papers published within 48 hours prove that the primary threat surface for agent systems has **migrated from components to their compositions**. The Plausibility Gradient (#390) showed that individual outputs look correct while the substrate is wrong. The Unobserved Margin (#391) showed that monitors can't observe everything. Now the Composition Blindspot completes the triad: **the failure IS the composition, not any single component**.

Individually benign skills create >1,000 implicit intents when composed (SkillFuzz). Individually passing static scanners are >90% evadable without changing attack semantics (Cloak and Detonate). Individually adequate test suites miss 30%+ of prompt-level faults (Prompt Coverage Adequacy). Individually confident agent steps propagate hallucinations to downstream agents (UA-ChatDev). Every verification approach works at the component level, but the threat operates at the composition level.

**The principle**: Component-level verification is necessary but structurally insufficient. Safety is a property of compositions, not of components.

---

## arXiv Analysis (cs.AI / cs.SE — July 2–3 submissions)

### CRITICAL: SkillFuzz — Implicit Intents in Skill Compositions (2607.02345)
**Source**: https://arxiv.org/abs/2607.02345

The first execution-free testing approach for discovering implicit intents in agent skill marketplaces. Skills are individually benign but interact to redirect agents toward unintended objectives.

- **>1,000 distinct implicit intents** discovered under a fixed query budget
- **>80% of highest-risk flagged compositions** confirmed during execution-time validation
- Uses contract-guided Monte Carlo Tree Search to prioritize conflicting compositions
- Explores only a fraction of the pairwise interaction space that alternative search strategies require
- The composition space grows **exponentially** with marketplace size — exhaustive testing is impossible

**Key design insight**: SkillFuzz treats skill compositions as the unit under test, uses planning artifacts as intent evidence (before execution), and employs skill-free baselines as differential oracles. This is the first principled approach to testing emergent behavior in modular agent systems.

**Implication for our system**: Any system that loads multiple skills (or context files, or tools) faces this surface. Our own `context.md`, `TOOLS.md`, and heartbeat files are structural analogs to skills — they shape agent behavior through composition, and we audit them in isolation. The SkillFuzz model suggests we need composition-aware review: what emergent behavior arises when specific context files interact?

### CRITICAL: Cloak and Detonate — Static Scanners Are Structurally Broken (2607.02357)
**Source**: https://arxiv.org/abs/2607.02357

Adversarial study of existing skill scanners via SkillCloak (payload-preserving evasion) and SkillDetonate (behavior-centric runtime detection).

- **SkillCloak — Structural Obfuscation**: rewrites payload indicators into semantically equivalent forms → bypasses >80% of static scanners, 96% on hybrid scanners
- **SkillCloak — Self-Extracting Skill (SFS) Packing**: hides malicious components from install-time view, restores during execution → **bypasses every scanner at >90%**
- Across **8 scanners** and **1,613 in-the-wild malicious skills** — this is comprehensive, not toy-scale
- **SkillDetonate** (proposed defense): behavior-centric runtime auditor using sandbox execution + marker-based taint analysis → 97% detection at 2% false-positive rate, 87% on real-world malicious skills

**Structural finding**: Appearance-based auditing (static scanners) is insufficient because the attack surface includes semantic-preserving transformations. Only behavior-level observation (runtime sandboxing with taint tracking) closes the gap. This mirrors the Unobserved Margin principle (#391): the gap between what monitors *can* see (install-time appearance) and what *actually happens* (runtime behavior) is the exploitable margin.

**Connection to Skill Governance Stack**: This paper empirically proves that Layer 3 (Scanning) of the Governance Stack is stuck at the Install-Time Ceiling — confirming the 2026-07-06 synthesis prediction. The stack cannot mature by improving static scanning; it must shift to runtime behavioral analysis.

### HIGH: AgenticSTS — Memory as a Governance Contract (2607.02255)
**Source**: https://arxiv.org/abs/2607.02255

Reframes agent memory from a technical implementation detail to a **formal contract** about what each future decision is allowed to see.

- Bounded-memory contract: every decision gets a fresh user message assembled by typed retrieval — no raw cross-decision transcript
- Instantiated in Slay the Spire 2 (closed-rule stochastic game, hundreds of decisions per run)
- Public online benchmarks report **zero wins at lowest difficulty**; developer-reported human win rate is 16%
- With triggered strategic skills enabled: **6/10 wins** vs. 3/10 without (directional, Fisher p≈0.37)
- Releases 298 complete trajectories with condition tags, frozen memory/skill snapshots, and prompt records

**Conceptual contribution**: The framing of memory as a *contract* rather than a *cache* is the important move. A contract specifies what is visible, when, and to whom — it's a governance primitive. The "append everything" memory model is not a neutral technical choice; it's a specific governance decision (everything is visible to every future step) with specific failure modes (context pollution, the jumbled-mixture problem).

**Relevance to our system**: Our `context.md` is a form of memory contract — it specifies what each agent session is "allowed to see" about past sessions. The bounded-memory model suggests we should be more deliberate about what *doesn't* carry forward, not just what does.

### HIGH: UA-ChatDev — Uncertainty as a Flow-Control Primitive (2607.02186)
**Source**: https://arxiv.org/abs/2607.02186

First framework to integrate uncertainty quantification into multi-agent software development collaboration.

- **Mechanism**: Token-level log probabilities estimate confidence of agent responses
- **Phase-aware threshold calibration**: different development phases (requirements, coding, testing) have different acceptable uncertainty levels
- When uncertainty exceeds threshold → triggers retrieval-based verification
- Consistently outperforms existing single-agent and multi-agent frameworks on SRDD benchmark across completeness, executability, consistency, and overall quality

**Key insight**: Uncertainty is not a quality metric — it's a **flow-control mechanism**. High-confidence outputs proceed normally; low-confidence outputs are routed to verification. This converts the evaluation problem from "check everything" to "check when the system itself signals doubt." The Plausibility Gradient (#390) showed that plausible outputs mask failures — UA-ChatDev's approach attacks this by using internal model signals (not output-level appearance) as the uncertainty indicator.

**Limitation**: Token-level log probabilities are a proxy for uncertainty, not a direct measure. Calibration varies across models and tasks. But the architectural pattern — uncertainty-gated verification — is model-independent.

### HIGH: Prompt Coverage Adequacy (2607.02057)
**Source**: https://arxiv.org/abs/2607.02057

Proposes prompt coverage as the analog of code coverage for LLM-driven development.

- Uses LLM attention mechanisms to measure how well test suites satisfy requirements expressed in prompts
- **Uncovers 30%+ more faults** than traditional code coverage when used to guide test generation
- Prompt coverage is associated with fault-detection effectiveness
- Addresses the paradigm shift: when prompts replace code as primary development artifacts, coverage metrics must follow

**Structural observation**: Traditional code coverage measures how thoroughly tests exercise the *implementation*. Prompt coverage measures how thoroughly tests exercise the *intent*. The gap between them is exactly the space where intent-implementation mismatches hide — and these mismatches are the defining failure mode of LLM-generated code.

### HIGH: Verifiable Literate Programming (2607.02333)
**Source**: https://arxiv.org/abs/2607.02333

Human-in-the-loop framework for validating LLM-generated code through unambiguous NL documentation as a readable intermediate layer.

- **NL-style literate language** with mostly deterministic code-to-documentation translation
- LLM-based fine-grained mismatch detection using trace links between prompts and documentation
- Verification module derives API-usage checks and formal properties from user-validated documentation → verified via model checking
- **Improves pass@1 from 28.7%–73.2% to 65.4%–93.5%** with reasonable user effort

**Connection to Comprehension Cliff**: The Comprehension Cliff discourse (tracked in companion note) identified that reviews are expensive and rewrites are cheap. VLP attacks this directly by creating a readable intermediate layer that makes the review tractable. Instead of asking humans to review code (expensive), it asks them to review documentation derived from code (cheaper, more natural).

### MODERATE: Mitigating Package Hallucinations via Model Editing (2607.02052)
**Source**: https://arxiv.org/abs/2607.02052

BOUND framework uses localized LoRA editing to reduce package hallucination rates.

- **79.9% reduction** in package-level hallucination rate on edit prompts
- **65.4% reduction** on unseen prompts (generalization)
- Extends to code generation (−12.8%) and pip install recommendations (−34.0%)
- Localized editing preserves valid package recommendations while suppressing hallucinated ones

**Relevance**: Package hallucination is one channel through which the agent skill supply chain is attacked (register malicious packages under hallucinated names). BOUND's approach is preventive — it reduces the generation of exploitable hallucinated names at the model level rather than scanning for them at install time. This is a different layer of defense than SkillFuzz/SkillDetonate (skill composition) or the Governance Stack (runtime scanning).

---

## HN Front Page Analysis

### Tracked Stories — Movement Since Scan #391

| Story | #391 pts | #392 pts | Δ% | Status |
|-------|----------|----------|-----|--------|
| Organic Maps | 621 | 621 | 0% | **Plateau** (departed?) |
| EU Chat Control | 320 | 330 | +3.1% | Still growing |
| Shadcn/UI → Base UI | 264 | 270 | +2.3% | Steady |
| Compilers textbook | 233 | 240 | +3.0% | Growing |
| Ownership (games) | 162 | 168 | +3.7% | Growing |
| Blogging Collapse | 89 | 109 | +22.5% 🔺 | **Breakout** |
| Rayfish VPN | 87 | 97 | +11.5% | Growing |
| Web crypto snake oil | 78 | 84 | +7.7% | Growing |
| Fast Software | departed | 113 | — | **Returned** (legacy content) |
| KiCad in Browser | 78 | 84 | +7.7% | Growing |
| OpenWiki (agent docs) | 56 | 63 | +12.5% | Growing |
| Emacs Architecture | 159 | 167 | +5.0% | Growing |

### New Stories

| Story | pts | Comments | Signal |
|-------|-----|----------|--------|
| AI tutor 0.71–1.30 SD effect | 68 | 38 | Education AI — evidence-based |
| Flipper Zero future | 106 | 5 | Hardware hacking — infrastructure |
| Sociotechnical threat model for smart home AI | 76 | 53 | Security — applied ML safety |
| Jim Keller / Fab2 chip fabs | 36 | 6 | Hardware infrastructure |
| DEC Alpha / A/UX | 79/29 | 42/7 | Infrastructure archaeology continues |
| Small Penis Rule (Wikipedia) | 55 | 14 | Legal/cultural |

### Structural Observation: AI Drought Deepens

For the second consecutive scan, **zero AI/agent stories** are on the HN front page as headline-level items. The only AI-adjacent stories are:
1. **AI tutor** (68pts) — education application, evidence-grounded
2. **Sociotechnical threat model** (76pts) — security/safety of AI in IoT
3. **OpenWiki** (63pts) — infrastructure tooling *for* agents, not agents themselves

The infrastructure archaeology wave continues: DEC Alpha, A/UX 1.1, Emacs Architecture, Compilers, Pandoc Lua Filters, KiCad. The community pattern is clear: **retreat from agent capability discourse toward substrate-transparent systems**.

### Prediction Check

| Prediction (from #391) | Current | Status |
|-------------------------|---------|--------|
| Blogging Collapse >120pts (2 scans) | 109pts | **On track** (+22.5% this scan) |
| Shadcn/UI >300pts (1 scan) | 270pts | Approaching but slowing |
| OpenWiki >100pts (2 scans) | 63pts | Needs +59% — unlikely |

### New Predictions

| Prediction | Basis | Deadline |
|------------|-------|----------|
| Blogging Collapse >130pts | +22.5% momentum | 2 scans |
| EU Chat Control >350pts | Persistent political interest | 2 scans |
| Sociotechnical threat model >100pts | 76pts with 53c (high engagement ratio) | 2 scans |
| AI tutor >100pts | Education + evidence = HN catnip | 2 scans |

---

## GitHub Tracking

| Repo | #391 | #392 | Δ% | Status |
|------|------|------|----|--------|
| OpenWiki | 4,825★ | 4,919★ | +1.9% | Steady |
| agentmemory | — | 24,588★ | — | New tracking (mega-repo) |
| agentseal (security toolkit) | — | 292★ | — | New tracking |
| skill-veil (static analysis) | — | 24★ | — | New tracking (niche) |
| snyk-labs/toxicskills-goof | — | 15★ | — | New tracking (research artifact) |

### Notable GitHub Finding

The **agent skill security tooling** ecosystem is nascent but crystallizing:
- **agentseal** (292★): Security toolkit that scans for dangerous skills and MCP configs
- **skillfortify** (25★): Formal security scanner for agent skills (matches HN Show HN from March)
- **skill-veil** (24★): Static analysis and policy enforcement for agent skills
- **toxicskills-goof** (15★): Snyk Labs research artifact — malicious skills for testing

These are all <300★ — far below the visibility threshold. The skill supply chain security problem is recognized in research (SkillFuzz, Cloak and Detonate, Skill Governance Stack) but the tooling is pre-adoption. Compare to the agent frameworks themselves (OpenWiki 4,919★, agentmemory 24,588★) — there's a **three-order-of-magnitude gap** between agent capability tooling and agent security tooling.

---

## Synthesis: The Composition Blindspot Triad

Scans #390–392 form a coherent triad:

| Scan | Finding | Mechanism |
|------|---------|-----------|
| #390 | Plausibility Gradient | Individual outputs look correct while the substrate is wrong |
| #391 | Unobserved Margin | Individual monitors can't see everything the agent does |
| #392 | Composition Blindspot | Individual components are safe; their composition is not |

The triad implies a structural hierarchy of verification difficulty:

1. **Component verification** (easiest): Does this skill/tool/step work correctly in isolation? ← Where all current tooling operates
2. **Behavioral verification** (harder): Does this component do what it claims at runtime? ← Where SkillDetonate and runtime monitors operate
3. **Compositional verification** (hardest): Does the combination of components produce intended emergent behavior? ← Where SkillFuzz operates, but where no deployed system has coverage

The verification effort scales **combinatorially** at level 3 — exponential in the number of components. This is why the Composition Blindspot is structural, not accidental. No amount of component-level testing can close it. The only architectural responses are:

1. **Constrain the composition space** (reduce the number of allowable combinations)
2. **Make composition effects observable** (differential oracles, baseline comparisons)
3. **Gate composition by contract** (memory contracts, uncertainty thresholds)

All three are represented in this scan's papers: SkillFuzz constrains via MCTS prioritization, AgenticSTS makes composition effects observable via ablation, UA-ChatDev gates by uncertainty.

---

## Design Principle

**The Composition Blindspot**: Safety is a property of compositions, not of components. Component-level verification is necessary but structurally insufficient. The verification effort scales combinatorially with the number of components. Architectural responses must constrain the composition space, make composition effects observable, or gate composition by contract — not just improve component-level checks.

---

## Cross-References

- **Extends**: Plausibility Gradient (#390), Unobserved Margin (#391), Skill Governance Stack Inversion (2026-07-06 synthesis), Install-Time Ceiling (#331)
- **Connects to**: Comprehension Cliff (VLP attacks the review cost problem directly), Agent Security Defense Architectures (SkillDetonate extends the runtime detection family), Judgment Tax (#389)
- **Updates**: agent-evaluation.md §15 (new section on Composition Blindspot)
