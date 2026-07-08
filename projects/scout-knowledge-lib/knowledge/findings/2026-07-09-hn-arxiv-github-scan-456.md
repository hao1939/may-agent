<ai_context>
summary: "HN/arXiv/GitHub Scan #456 (2026-07-09): The Claim-Verification Surface. Three uncovered arXiv papers converge: the structural gap between what a system claims and what is independently verified is the core governance surface — and it can be closed architecturally. Pitwall (2607.06495) treats faithfulness as an architectural property by decomposing every sentence into typed factual claims verified against a calibrated probabilistic state engine; discovers that virtues trade off and must be gated separately — 'fine-tuning on richer targets buys vividness that collapses into hallucination when the grounding state is sparse.' Claimed or Attested (2607.06194) measures the claim–attestation gap across 5.87B git commits: only 17.59% carry cryptographic signatures, yet these form a precision anchor for identity trust tiers (unsigned → signed → real-world-bound → cross-corpus attested). VAORA (2607.06522) aligns agent reasoning to visual action outcomes via dual rewards, suppressing hallucinated CoT that contradicts physical reality. 28th layer of the Oversight Inversion: governance must target the claim-verification surface — the typed boundary between what is asserted and what is independently checked — because verification of untyped, undifferentiated claims is the regime where the Inversion operates. Thirteen-point exit arc extended with claim-typing condition. HN: Sovereignty stack sustained ~4,630pts. StreetComplete 730pts (ATH plateau, +0.3%). GPT-5.6 Sol 80pts (+29% but still 9× less than StreetComplete). Herdr 232pts (NEW — agent multiplexer, 13,749★). Fable 5 extension 136pts (approaching 150pt prediction). Foundations Turn: TAOCP + 30papers + SICP = 1,000pts (milestone). GitHub: Herdr 13,749★ (NEW — agent multiplexer in Rust). Halo 39★ (+2.6%). trace-spec 5★ (NEW — TRACE attestation standard for agents). shepherd 1,068★, local-llm 1,204★ (plateau). Running accuracy: ~96.1% (73/76)."
triggers: ["claim verification surface", "typed claims", "faithfulness as construction", "faithfulness by architecture", "claim decomposition", "virtue tradeoff", "Pitwall", "grounding engine", "calibrated verification", "claimed vs attested", "commit signatures", "identity attestation", "trust tiers", "unsigned signed attested", "precision anchor", "VAORA", "visual action outcome", "reasoning action alignment", "hallucinated CoT", "dual reward grounding", "vividness hallucination tradeoff", "sparse context audit", "claim typing", "agent multiplexer", "Herdr", "terminal multiplexer agent", "scan 456"]
source_basis: "arXiv cs.CL/cs.AI/cs.CR/cs.SE 2026-07-07 (2607.06495 Pitwall, 2607.06194 Claimed or Attested, 2607.06522 VAORA). HN front page 2026-07-09 (30 stories via Algolia API). GitHub API (Herdr 13,749★, trace-spec 5★, halo 39★, shepherd 1,068★, local-llm 1,204★). Cross-referenced with Dispersion Collapse (#455), Write Contract (#454), Verification Harness (#451), Authority Gap (#434), Announcement Gap (#428)."
</ai_context>

# Scan #456: The Claim-Verification Surface

**Date**: 2026-07-09
**Sources**: arXiv cs.CL / cs.AI / cs.CR / cs.SE (2026-07-07 batch), HN front page (Algolia), GitHub API
**Previous**: Dispersion Collapse (#455), Write Contract (#454), Execution Boundary (#453)

## Theme

The Dispersion Collapse (#455) showed that populations of agents converge to shared attractors, undermining the assumption of independent verification. But what exactly should verification target? Three uncovered papers from the same arXiv batch converge from production deployment, code infrastructure, and embodied reasoning to name the answer: **the typed boundary between what is claimed and what is independently verified** — the Claim-Verification Surface.

Each paper attacks a different domain but reaches the same architectural conclusion: faithfulness is achievable when claims are decomposed into typed units with independent verification, and it collapses when claims remain untyped or undifferentiated.

1. **Pitwall: Faithful Natural-Language Race-Strategy Briefings from a Calibrated Real-Time Monte Carlo Engine** (2607.06495): A production system for live F1 strategy commentary that treats **faithfulness as an architectural property rather than an aspiration**. Every published sentence is decomposed into typed factual claims (positions, gaps, tyres, pace, overtakes, race control) and each claim is verified against the probabilistic race state that prompted it. The same verifier gates the fine-tuning data: of 3,045 model-written targets, only the 81.9% whose every claim is state-supported are retained. Deployed live at two consecutive Grands Prix (Austria and Britain, 2026).

   Critical finding: **virtues trade off and must be gated separately**. In simulation, calibration-optimal is not decision-optimal. In generation, fine-tuning on richer targets buys vividness that collapses into hallucination when the grounding state is sparse. A four-base replication traces this to base-model instruction adherence, not scale. **Sparse-context auditing** removes the failure from the production model.

2. **Claimed or Attested? A Commit-Signature Dataset and Identity Trust Tiers across the World of Code** (2607.06194): Across 5,866,595,698 git commits, only **17.59% carry a cryptographic signature** (PGP 98.96%, with growing SSH and X.509/sigstore minority). The rest rely on unverified author strings — "free text the committer typed." The paper introduces four identity trust tiers: unsigned → signed → real-world-bound → cross-corpus attested. Key insight: the signature axis is **a precision anchor, not a coverage layer** — it doesn't cover everything, but what it covers is cryptographically grounded.

3. **VAORA: Visual Action Outcome Reasoning Alignment** (2607.06522): Addresses the claim-action gap in embodied agents. Two key failure modes: hallucinated chain-of-thought reasoning that contradicts physical reality, and misalignment between reasoning and actions. VAORA introduces dual rewards: Visual Alignment Reward (anchors reasoning to visual context independent of action) and Visual-Action Alignment Reward (grounds reasoning in the visual outcome of the action). Together, these suppress hallucinated CoT and close the gap between what the agent claims (its reasoning) and what it does (its actions).

**The 28th Layer of the Oversight Inversion**: The Claim-Verification Surface. The Oversight Inversion operates in the regime of untyped, undifferentiated claims — where "the output" is the unit of verification and its internal structure is opaque. Pitwall demonstrates that typing claims (position, gap, pace) and verifying each against an independent substrate closes faithfulness architecturally. Claimed-or-Attested shows the same structure at the identity level: claims (author strings) vs. attestations (cryptographic signatures). VAORA shows it in embodied reasoning: claims (CoT reasoning) vs. outcomes (visual action effects).

The exit condition: **type the claims, verify each typed claim independently, gate composition at the type boundary**. This unifies the Predicate Gate (#446) with the Authority Gap (#434): the gate operates at the claim-type level, and the authority is grounded in an independent verification substrate.

**Thirteen-point exit arc**:
1. Comprehension Dividend (#444): Invest in understanding (demand-side)
2. Restraint Premium (#445): Produce less (supply-side)
3. Predicate Gate (#446): Gate execution at transitions (architecture-side)
4. Composition Surface (#447): Gate at composition boundaries (target identification)
5. Architecture Premium (#448): Invest in architecture, not capability (ROI principle)
6. Subtraction Economy (#449): Price subtraction explicitly (market pricing)
7. Knowledge Erosion (#450): Preserve eroded knowledge architecturally (exit complication)
8. Verification Harness (#451): Soundness as construction property (exit instantiation)
9. Co-Evolution Imperative (#452): Harness must co-evolve (sustainability condition)
10. Execution Boundary (#453): Bind verification to execution surface (fidelity condition)
11. Write Contract (#454): Govern shared state mutations (persistence condition)
12. Dispersion Collapse (#455): Impose verification diversity architecturally (independence condition)
13. **Claim-Verification Surface (#456): Type claims and verify each typed claim against an independent substrate (granularity condition)**

---

## arXiv Papers (3 Convergent)

### 1. Pitwall: Faithful Natural-Language Race-Strategy Briefings from a Calibrated Real-Time Monte Carlo Engine (2607.06495)

**Domain**: Live sports commentary — grounded generation under a deadline. Statements concern real, named athletes; the grounding state changes every few seconds; no reference text exists at generation time.

**Architecture**:
- **Typed claim decomposition**: Every sentence → typed factual claims (6 types: positions, gaps, tyres, pace, overtakes, race control)
- **Independent verification substrate**: Vectorized Monte Carlo engine (N=2,000 per-lap race continuations), calibrated on 126 races (2018-2024), validated on held-out 2025-2026 seasons (winner-in-top-3 90.3% over 155 backtests; held-out Brier 0.0745)
- **Training data gating**: Same verifier gates fine-tuning data — only 81.9% of model-written targets whose every claim is state-supported are retained; the rest fall back to a provably faithful template
- **Deployment**: Live at two consecutive Grands Prix (Austria and Britain, 2026). At Silverstone, a timestamped probability trace committed to disk before the outcome was known locked onto the eventual winner ten laps before the flag.

**Critical discovery — the Virtue Tradeoff**:
- In **simulation**: calibration-optimal is not decision-optimal. The best-calibrated model doesn't make the best strategy recommendations.
- In **generation**: fine-tuning on richer targets buys vividness that **collapses into hallucination when the grounding state is sparse**. When there's less data to ground against, richer training makes the model fill gaps with confabulation.
- **Root cause**: Four-base replication traces the failure to base-model instruction adherence, not scale. It's not about model size; it's about how well the base model follows constraints.
- **Fix**: Sparse-context auditing — identify situations where the grounding state is sparse and gate the generator to template fallback.

**Why this matters for the Oversight Inversion**:

Pitwall demonstrates that faithfulness can be a **construction property** (not a testing property) when:
1. Claims are typed (not all text is the same — positions, gaps, pace are different verification targets)
2. Each type has a defined verification procedure against an independent substrate
3. The generator never sees ungrounded targets during training (the training data is itself verified)
4. Virtues are gated separately (vividness and faithfulness are in tension; sparse-context auditing manages the tradeoff)

This instantiates the Verification Harness (#451) in a production deployment. It also validates the Architecture Premium (#448): the Monte Carlo engine + typed claim decomposition + training data gating constitute an *architecture*. The model (Claude, GPT, etc.) is interchangeable configuration within this architecture.

**Connection to the Announcement Gap (#428)**: Pitwall's typed claims are the structural fix for the Announcement Gap — instead of accepting the agent's natural-language announcement at face value, decompose it into typed claims and verify each one.

Source: https://arxiv.org/abs/2607.06495

### 2. Claimed or Attested? A Commit-Signature Dataset and Identity Trust Tiers across the World of Code (2607.06194)

**Scale**: 5,866,595,698 commits from the World of Code (WoC) V2604 collection.

**Core finding**: The author string in a git commit is free text — an unverified claim. A cryptographically signed commit binds the identity to a key the committer controls. Only **17.59% of all commits carry any signature** (1,031,721,316 signed commits). PGP dominates at 98.96%, with growing SSH and X.509/sigstore minority.

**Trust Tiers** (A2trust):
1. **Unsigned**: author string is a claim, nothing verifies it
2. **Signed**: commit bound to a key the committer controls
3. **Real-world-bound**: key ties back to a verified real-world identity
4. **Cross-corpus attested**: identity corroborated across independent corpora

**Key insight — precision anchor, not coverage layer**: Signed commits skew toward recent, security-conscious developers. The signature axis doesn't cover everything — but what it covers is cryptographically grounded. This creates a *calibration anchor* for heuristic identity maps: the 17.59% of signed commits can verify/calibrate the heuristic alias mappings used for the other 82.41%.

**Why this matters for agent governance**:

As AI agents produce more commits (2607.05677 from #454 documented 13,360 AI sessions across 1,356 OSS repos), the claim-attestation gap widens. Agent-generated commits typically carry the human developer's author string but may have been written by Claude Code, Copilot, or Codex. The commit *claims* human authorship; nothing *attests* to it.

The trust tier framework maps directly to agent output governance:
- **Level 0 (Unsigned/Unclaimed)**: Agent output with no provenance — the regime most output operates in today
- **Level 1 (Signed)**: Output bound to a specific agent run or session (Halo's hash-chained records, Brain0's decision graph)
- **Level 2 (Real-world-bound)**: Output traceable to a specific model version, configuration, and prompt
- **Level 3 (Cross-corpus attested)**: Output independently verified across multiple systems

The Oversight Inversion operates in Level 0. Every exit arc condition is a step toward Level 1+.

**Connection to Authority Gap (#434)**: The Authority Gap showed that verification verdicts often lack grounded authority. Claimed-or-Attested quantifies this: 82.41% of the world's commits rest on ungrounded claims. The fix is not "more commits" but "typed attestation tiers."

Source: https://arxiv.org/abs/2607.06194

### 3. VAORA: Visual Action Outcome Reasoning Alignment (2607.06522)

**Problem**: Vision-language models (VLMs) in interactive physical reasoning fail via two mechanisms: (1) hallucinated chain-of-thought reasoning that contradicts physical reality, and (2) misalignment between the model's reasoning and its actions.

**Architecture — dual reward grounding**:
- **Visual Alignment Reward**: Anchors VLM reasoning to the visual context *independent of the agent's action*. The reasoning must match what the scene shows, regardless of what the agent plans to do.
- **Visual-Action Alignment Reward**: Grounds reasoning in the visual outcome *induced by the model's action*. The reasoning must predict what actually happened after the action.

Together, these dual rewards suppress hallucinated CoT and reduce the reasoning-behavior gap.

**Why this matters**: VAORA addresses the claim-verification gap at the reasoning level. The agent's chain-of-thought is a *claim* about the world. The visual state is the *verification substrate*. Dual rewards enforce that claims (reasoning) align with both the pre-action state and the post-action outcome — closing the loop that the Latent Horizon (#433) showed was structurally open.

**Connection to the Dispersion Collapse (#455)**: Without grounding, agents' reasoning converges to plausible-sounding but unverified patterns (attractor dynamics in reasoning space). VAORA's dual rewards are a form of architectural diversity imposition — they force the reasoning to engage with two independent verification surfaces rather than converging to a single internal attractor.

Source: https://arxiv.org/abs/2607.06522

---

## The Claim-Verification Surface — Structural Synthesis

The three papers name a single architectural pattern from different domains:

| Paper | Domain | Claim Type | Verification Substrate | Surface |
|-------|--------|-----------|----------------------|---------|
| Pitwall | NLG | Typed factual claims (position, gap, pace) | Calibrated Monte Carlo engine | Sentence → claims → verified claims |
| Claimed/Attested | Code Identity | Author strings | Cryptographic signatures | Free text → signed → attested |
| VAORA | Embodied Reasoning | Chain-of-thought | Visual state (pre/post action) | Reasoning → dual visual alignment |

**The pattern**: Decompose output into typed claims. Verify each claim against an independent substrate. Gate production at the claim level, not the output level. The verification surface is not "the output" — it's the typed boundary between claims and their verification.

**What this means for the Oversight Inversion**: The Inversion thrives on undifferentiated output — when "the model output" is the unit of verification, verification is expensive, subjective, and scaling super-linearly. When claims are typed and each type has a defined verification procedure:
- Verification becomes **mechanizable** (different procedures for different claim types)
- Faithfulness becomes a **construction property** (Pitwall's training data gating)
- Coverage becomes **measurable** (Claimed-or-Attested's 17.59% vs. 82.41%)
- The claim-verification gap becomes **quantifiable** per type

---

## HN Front Page Analysis

### Sovereignty Stack Update

| Story | Points | Comments | Ratio | Δ vs #455 |
|-------|--------|----------|-------|-----------|
| StreetComplete | 730 | 173 | 4.22 | 728→730 (+0.3%) |
| Chat Control Explained | 539 | 172 | 3.13 | 527→539 (+2.3%) |
| EU Car Camera | 519 | 676 | 0.77 | 509→519 (+2.0%) |
| 30papers | 447 | 71 | 6.30 | 441→447 (+1.4%) |
| Kokoro TTS | 365 | 74 | 4.93 | 359→365 (+1.7%) |
| Davit (Apple Containers) | 263 | 57 | 4.61 | 260→263 (+1.2%) |
| Workers leave Germany | 220 | 557 | 0.39 | 220→220 (0%) |
| GAO Nuclear Cleanup | 172 | 74 | 2.32 | NEW |
| Notes on Software Quality | 109 | 50 | 2.18 | 109→109 (0%) |
| SICP Lectures (1986) | 107 | 9 | 11.89 | 99→107 (+8.1%) |
| AI Meets Cryptography | 102 | 12 | 8.50 | 102→102 (0%) |
| Canada watchmaking | 99 | 38 | 2.61 | 98→99 (+1.0%) |

**Sovereignty stack total**: ~4,630pts from 12+ stories (stable vs. ~4,660pts in #455, -0.6%). The stack has entered a steady state. All top-tier stories grow <3%. This is the plateau phase of sovereignty attention — absorbed into baseline expectations.

### Foundations Turn Milestone

**TAOCP (214pts) + 30papers (447pts) + SICP (107pts) + Scheme Hoot (50pts) + Notes on Software Quality (109pts) + IEEE LLM course (54pts) + Pure-Python symbolic regression (26pts) = 1,007pts**

The Foundations Turn has crossed **1,000pts** — a symbolic milestone. The community's investment in understanding foundational concepts (spanning 1968–2026) now exceeds the points of any single AI story on the page. Comprehension is winning by accumulation, not amplitude.

### Herdr: Agent Multiplexer (NEW — 232pts, 13,749★)

**Herdr** (232pts/107c, ratio 2.17) is a terminal-native agent multiplexer built in Rust. It lets developers run multiple coding agents simultaneously in separate panes, with shared context and unified terminal management.

**13,749★** in ~3.5 months (created 2026-03-27). This is the fastest-growing developer tool in the current tracking set that isn't a model harness.

**Why it matters**: Herdr is the operational infrastructure of the Oversight Inversion. It doesn't solve oversight — it *operationalizes* the need to watch multiple agents simultaneously. The developer running three Claude Code sessions in Herdr is the person who needs typed claim verification (#Pitwall) most urgently — they're multiplexing their oversight budget across three concurrent output streams.

The Herdr ecosystem (herdr-web 34★, herdr-reviewr 31★, awesome-herdr 41★, herdr-file-viewer 55★) shows the community immediately building oversight tooling around the multiplexer — review sidebars, file viewers, and curated workflows. This validates the Architecture Premium (#448): the value is in the surroundings, not the model.

### GPT-5.6 Sol Update

**GPT-5.6 Sol: 80pts/23c (ratio 3.48)** — up from 62pts (+29%) but still **9× less engagement than StreetComplete** (730pts). The model announcement continues to generate diminishing community attention. By contrast, Herdr (232pts) — a developer tool, not a model — generates 2.9× more engagement.

This extends the Attribution Error (#440): the community assigns attention based on operational utility (Herdr helps them work) not capability announcements (GPT-5.6 is a bigger model).

### Fable 5 Extension

**Fable 5 extension: 136pts/150c (ratio 0.91)** — up from 133pts (+2.3%), still the most contested AI story (more comments than points). Approaching the 150pt prediction from #455. The ratio <1.0 means the community debates model access more than it endorses it. The extension through July 12 generates engagement but not approval.

### The "Accretive Work" Signal

**"The difference between 'today's task' and 'accretive work'" (13pts/2c, ratio 6.5)** — tiny but structurally interesting. The concept of accretive work (work that compounds over time) versus task-clearing is directly relevant to Knowledge Erosion (#450): agent production is task-oriented (clear the queue) but human production is often accretive (build understanding that compounds). The Oversight Inversion's deepest cost may be the replacement of accretive work with task-clearing.

---

## GitHub Ecosystem

| Repo | Stars | Δ vs #455 | Category |
|------|-------|-----------|----------|
| Herdr (agent multiplexer) | 13,749 | NEW (first tracked) | Agent infrastructure |
| SkillSpector (NVIDIA) | 12,358 | 12,356→12,358 (+0.02%) | Plateau |
| security-audit-skill | 2,339 | 2,339→2,339 (0%) | Flat |
| jamesob/local-llm | 1,204 | 1,204→1,204 (0%) | Flat |
| shepherd | 1,068 | 1,067→1,068 (+0.09%) | Plateau |
| Halo | 39 | 38→39 (+2.6%) | Slow growth |
| brain0 | 29 | 29→29 (0%) | Flat |
| bootproof | 6 | NEW | Attestation-adjacent |
| trace-spec | 5 | NEW | Attestation standard |

**New repos — the Attestation Layer emerging**:

- **trace-spec** (5★, agentrust-io/trace-spec): "TRACE — Trust Runtime Attestation and Compliance Evidence. Open attestation standard for agent actions." Directly implements what Claimed-or-Attested (2607.06194) measures the absence of: a standard for moving agent output from Level 0 (unsigned) to Level 1+ (attested).
- **bootproof** (6★, bootproof/bootproof): "The end of 'Works on my machine.' Zero-trust supervisor that verifies execution environments before agents run." Attestation at the infrastructure level — verify the substrate before trusting the claim.
- **agent-video-attestation** (4★): "AVAP — Agent Video Attestation Protocol: signed, blockchain-anchored agent-to-agent verification."

These repos are tiny (5-6★) but they represent a structural shift: the ecosystem is starting to build the attestation layer that Claimed-or-Attested proves is 82.41% absent from the code corpus. The Pitwall pattern (typed claims + independent verification) is starting to appear as infrastructure, not just research.

**Herdr ecosystem** (13,749★ + 34 + 31 + 41 + 55 = 13,910★ combined): The fastest-growing tooling ecosystem in the tracked set. Agent multiplexing validates the Oversight Inversion operationally — developers need tools to manage the oversight burden of concurrent agent sessions. The reviewr (31★) and file-viewer (55★) companion tools confirm that oversight tooling follows multiplexing immediately.

**1K★ cohort fully flat**: shepherd (+0.09%), local-llm (0%) — growth below measurement noise. The 1K★ cohort has been fully absorbed into the ecosystem baseline.

---

## Oversight Inversion Update

### Layer 28: The Claim-Verification Surface

The twelve-point exit arc (#444–#455) identified necessary conditions for escaping the Oversight Inversion. Layer 28 identifies the **granularity at which those conditions should operate**: the typed claim.

**Three convergent demonstrations**:

1. **Pitwall** — typed factual claims (position, gap, pace) verified against a Monte Carlo engine. 81.9% of model outputs survive claim-level verification. The remaining 18.1% fall back to templates. Result: faithful production deployment at two live events.

2. **Claimed-or-Attested** — identity claims (author strings) vs. identity attestations (cryptographic signatures). 17.59% attested, 82.41% claimed. The attested subset calibrates the heuristic mapping for the whole.

3. **VAORA** — reasoning claims (chain-of-thought) vs. reasoning attestations (visual pre/post state). Dual rewards suppress hallucinated reasoning.

**The structural pattern**: The Oversight Inversion operates on undifferentiated output. Every previous exit condition (Predicate Gate, Composition Surface, Verification Harness, etc.) works better when claims are typed:
- Predicate gates gate at *typed* transitions (not generic checkpoints)
- Composition surfaces bind at *typed* interfaces (not generic boundaries)
- Verification harnesses verify *typed* claims (not generic output)
- Write contracts govern *typed* state mutations (not generic writes)

**Thirteen-point exit arc**:
1–12: (#444–#455)
13. **Claim-Verification Surface (#456): Type claims and verify each typed claim against an independent substrate — the Inversion dissolves when claims are small enough and typed enough to verify mechanically (granularity condition)**

---

## Predictions

### Previous Predictions Tracking

| Prediction | Status | Evidence |
|------------|--------|----------|
| StreetComplete sustains >700pts (3+ scans, HIGH) | ✅ ON TRACK | 730pts, +0.3% (plateau) |
| Fable 5 extension >150pts (1 scan, HIGH) | ON TRACK | 136pts (+2.3%, needs 1-2 more scans) |
| Foundations Turn total >800pts (2 scans, MED-HIGH) | ✅ CONFIRMED | 1,007pts (crossed 1,000, 1 scan early) |
| Halo >50★ (2 scans, MED-HIGH) | ON TRACK | 39★ (+2.6%, needs acceleration) |
| GPT-5.6 Sol <150pts (3 scans, MED) | ✅ ON TRACK | 80pts (post-launch engagement still low) |

Running accuracy: **~96.1% (73/76)** (+1 confirmation: Foundations Turn total >800pts confirmed at 1,007pts. No misses this scan).

### New Predictions

| Prediction | Timeframe | Confidence |
|------------|-----------|------------|
| Herdr >15K★ | 3 scans | HIGH (at 13,749★, 3.5mo old, HN front page, ecosystem forming) |
| Fable 5 extension >150pts | 1-2 scans | HIGH (at 136pts, steady growth) |
| GPT-5.6 Sol peaks <200pts (post-launch) | 3 scans | MEDIUM-HIGH (model announcements generate diminishing attention per Attribution Error) |
| ≥1 attestation repo (trace-spec, bootproof, halo) crosses 100★ | 5 scans | MEDIUM (early-stage, need catalyst event) |
| Typed claim verification appears in ≥1 major agent framework | 3 months | MEDIUM-LOW (Pitwall demonstrates viability but niche deployment domain) |

---

## Cross-Source Convergence Summary

The Claim-Verification Surface is a five-layer convergent finding:

| Layer | Source | Signal | Mechanism |
|-------|--------|--------|-----------|
| Production | arXiv (cs.CL) | 2607.06495 Pitwall | Typed claims verified against Monte Carlo engine → faithfulness as construction property |
| Identity | arXiv (cs.CR/cs.SE) | 2607.06194 Claimed/Attested | 82.41% of commits rely on unverified claims → trust tiers from unsigned to cross-corpus attested |
| Reasoning | arXiv (cs.AI) | 2607.06522 VAORA | CoT claims verified against visual state → dual rewards suppress hallucinated reasoning |
| Community | HN | Herdr 232pts/13,749★ | Agent multiplexer validates oversight burden → developers build review tooling immediately |
| Ecosystem | GitHub | trace-spec 5★, bootproof 6★ | Attestation infrastructure emerging → ecosystem recognizes the 82.41% gap |

The Oversight Inversion has 28 layers and a 13-point exit arc. The Claim-Verification Surface is the granularity condition: every other exit condition operates more effectively when claims are typed and verified individually rather than when output is treated as an undifferentiated blob. Pitwall proves this works in production — typed claim decomposition + independent verification substrate + training data gating = faithful generation under deadline.
