<ai_context>
summary: "HN/arXiv/GitHub Scan #456 (2026-07-09), partly qualified. Pitwall (2607.06495v1) specifies ten typed claim classes and verifier gates, but extractor/ontology coverage bounds any faithfulness guarantee. Its 2,494 admitted generations and 551 template fallbacks support construction-time filtering; its vividness/sparsity and four-base results are an uncounted qualitative audit. The related 2606.09376v2 artifact directly admits that out-of-schema entity/causal inventions can score perfectly, and its public repository disagrees with the arXiv archive on the prompt ablation. Two-race operation and 13 unique Silverstone rows establish feasibility, not calibration or publication-wide faithfulness. Claimed or Attested and VAORA remain pending primary review. HN/GitHub counters remain discovery signals."
triggers: ["claim verification surface", "typed claims", "faithfulness as construction", "faithfulness by architecture", "claim decomposition", "virtue tradeoff", "Pitwall", "grounding engine", "calibrated verification", "claimed vs attested", "commit signatures", "identity attestation", "trust tiers", "unsigned signed attested", "precision anchor", "VAORA", "visual action outcome", "reasoning action alignment", "hallucinated CoT", "dual reward grounding", "vividness hallucination tradeoff", "sparse context audit", "claim typing", "agent multiplexer", "Herdr", "terminal multiplexer agent", "scan 456"]
source_basis: "arXiv cs.CL/cs.AI/cs.CR/cs.SE 2026-07-07 (2607.06495 Pitwall, 2607.06194 Claimed or Attested, 2607.06522 VAORA). Pitwall 2607.06495v1 source and related Precision Is Not Faithfulness 2606.09376v2 source primary-reviewed 2026-09-04; related public artifact vectrayx/precision-is-not-faithfulness@a1caae7858f4152b3be616ba68d00334fc7bcdab inspected and six dependency-free verifier tests reproduced. Pitwall's claimed project repository was not attributable from its source or the author's four public repositories. HN front page 2026-07-09 (30 stories via Algolia API). GitHub counters are historical discovery observations. Cross-referenced with Dispersion Collapse (#455), Write Contract (#454), Verification Harness (#451), Authority Gap (#434), Announcement Gap (#428)."
</ai_context>

# Scan #456: The Claim-Verification Surface

**Date**: 2026-07-09
**Sources**: arXiv cs.CL / cs.AI / cs.CR / cs.SE (2026-07-07 batch), HN front page (Algolia), GitHub API
**Previous**: Dispersion Collapse (#455), Write Contract (#454), Execution Boundary (#453)

## Theme

The Dispersion Collapse (#455) motivated measuring verifier independence rather
than assuming it. What exactly should verification target? Three papers from the
same arXiv batch suggest the typed boundary between a claim and its checking
substrate. They study different populations and authorities, so this is a useful
architectural synthesis, not three independent replications of one result.

Each paper motivates a different typed verification surface. Whether those
surfaces have sufficient extraction coverage and authority remains an empirical
question in each domain.

1. **Pitwall** (2607.06495v1): Specifies ten claim classes and checks extracted
   claims against live structured state. The corpus retains 2,494/3,045 model
   generations and uses 551 template fallbacks. This supports typed admission
   and publication gates, but the paper's admission rule says at least one
   checkable and zero contradicted claims; it does not explicitly require zero
   unverifiable claims. Coverage is therefore a precondition, not a proven
   construction-wide guarantee. Its richer-target sparsity failure and four-base
   comparison are a qualitative deployment-shaped audit with no probe count or
   repeated-run uncertainty.

2. **Claimed or Attested? A Commit-Signature Dataset and Identity Trust Tiers across the World of Code** (2607.06194): Across 5,866,595,698 git commits, only **17.59% carry a cryptographic signature** (PGP 98.96%, with growing SSH and X.509/sigstore minority). The rest rely on unverified author strings — "free text the committer typed." The paper introduces four identity trust tiers: unsigned → signed → real-world-bound → cross-corpus attested. Key insight: the signature axis is **a precision anchor, not a coverage layer** — it doesn't cover everything, but what it covers is cryptographically grounded.

3. **VAORA: Visual Action Outcome Reasoning Alignment** (2607.06522): Addresses the claim-action gap in embodied agents. Two key failure modes: hallucinated chain-of-thought reasoning that contradicts physical reality, and misalignment between reasoning and actions. VAORA introduces dual rewards: Visual Alignment Reward (anchors reasoning to visual context independent of action) and Visual-Action Alignment Reward (grounds reasoning in the visual outcome of the action). Together, these suppress hallucinated CoT and close the gap between what the agent claims (its reasoning) and what it does (its actions).

**The 28th Layer of the Oversight Inversion, qualified**: Claim typing reduces
an opaque output into mechanically checkable units. It does not close
faithfulness unless extraction covers every asserted claim, the ontology models
the relevant kinds of error, and the substrate has adequate authority.

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

## arXiv Papers (3 Distinct Evidence Paths)

### 1. Pitwall: Faithful Natural-Language Race-Strategy Briefings from a Calibrated Real-Time Monte Carlo Engine (2607.06495v1)

**Domain**: Live sports commentary — grounded generation under a deadline. Statements concern real, named athletes; the grounding state changes every few seconds; no reference text exists at generation time.

**Architecture and denominators**: The schema has ten classes: leader,
position, gap-to-leader, battle, pace, tyre, safety-car, lap-number, overtake,
and position-change. A deterministic extractor sees only 0--2 of the 4--15
asserted facts in free-form outputs; an LLM extractor sees 8--15. The latter is
still a fallible model, so the verifier checks extracted claims, not necessarily
every claim in a sentence. The paper reports 36 claim tests but releases neither
their code nor results.

The fine-tuning corpus has 3,045 targets: 2,494 model generations admitted and
551 template fallbacks. The stated rule requires at least one checkable claim
and zero contradicted claims after two retries. That is useful admission
control, but the method text does not explicitly reject every unverifiable
claim. The stronger abstract phrase “every claim is state-supported” therefore
needs code or per-target verdicts to reconcile.

**Virtue tradeoff, bounded**: Two Qwen2.5-3B adapters share a base and differ in
targets. The template-trained adapter is terse (28--52 tokens) and the rich-
target adapter is vivid on dense contexts but invents drivers, gaps, and tyres
on sparse inputs. Llama-3.2-1B and Mistral-7B reproduce sparse inventions;
Phi-4-mini uses generic non-checkable language. This is an informative
qualitative audit, but no probe count, output ledger, run variation, or matched
quantitative score is reported. It supports a sparse-context release gate; it
does not isolate “instruction adherence” as a measured causal variable.

**Deployment boundary**: The paper reports end-to-end use at Austria and
Britain. Its Silverstone table contains 13 unique two-minute polls over laps
39--52 after removing a duplicate lap-51 sample. Locking onto the winner from
lap 42 is a prospective feasibility trace, not calibration evidence; the paper
explicitly calls the 14 raw polls anecdotal. The claimed JSONL trace, experiment
logs, engine, verifier, and tests are not in the arXiv archive.

**Related artifact and contradiction**: The cited companion `2606.09376v2`
defines coverage against a derived oracle and explicitly reports that an
out-of-schema teammate/title-fight invention can receive perfect supported
fraction. This is the central limit on “faithfulness by architecture”:
unextracted entity or causal claims are invisible. The related repository
`vectrayx/precision-is-not-faithfulness@a1caae7858f4152b3be616ba68d00334fc7bcdab`
passes six dependency-free verifier tests and exposes ten strategy claim types.
It is not the Pitwall implementation. Its checked-in prompt-ablation table also
differs materially from the arXiv v2 archive: the archive says mean recall falls
0.60→0.47, whereas the repository says four of five models improve and Gemini
falls 0.27→0.08. Version-specific conclusions must therefore stay bound to the
artifact cited.

**Why this matters for the Oversight Inversion**:

Pitwall supplies a candidate **construction discipline**: type claims, define a
check per type, gate training and publication, and audit sparse contexts. The
guarantee remains conditional on extractor coverage, ontology coverage, state
quality, and a reconciled admission rule. Those conditions should be measured
before calling faithfulness architectural or independent.

**Connection to the Announcement Gap (#428)**: Pitwall supplies a candidate
mechanism: decompose an announcement into typed claims and check each extracted
claim. It cannot detect claims outside the extractor or ontology.

Sources: https://arxiv.org/abs/2607.06495v1,
https://arxiv.org/abs/2606.09376v2,
https://github.com/vectrayx/precision-is-not-faithfulness/tree/a1caae7858f4152b3be616ba68d00334fc7bcdab

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

The three papers suggest a shared architectural pattern from different domains;
only Pitwall and its related artifact were primary-reviewed in this cycle:

| Paper | Domain | Claim Type | Verification Substrate | Surface |
|-------|--------|-----------|----------------------|---------|
| Pitwall | NLG | Ten typed factual classes | Structured race state / probabilistic engine | Sentence → extracted claims → checked claims; extraction and ontology remain coverage limits |
| Claimed/Attested | Code Identity | Author strings | Cryptographic signatures | Free text → signed → attested |
| VAORA | Embodied Reasoning | Chain-of-thought | Visual state (pre/post action) | Reasoning → dual visual alignment |

**The pattern**: Decompose output into typed claims, verify each extracted claim
against an authority-bearing substrate, and gate composition. The gate covers
only claims the extractor sees and types the ontology represents.

**What this means for the Oversight Inversion**: The Inversion thrives on undifferentiated output — when "the model output" is the unit of verification, verification is expensive, subjective, and scaling super-linearly. When claims are typed and each type has a defined verification procedure:
- Verification becomes **mechanizable** (different procedures for different claim types)
- Faithfulness becomes a **conditional construction target** (Pitwall's gates,
  bounded by extraction, ontology, and state authority)
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

**Three candidate surfaces; only Pitwall primary-reviewed here**:

1. **Pitwall** — ten typed classes are checked against structured race state;
81.9% of generated targets are admitted and 18.1% use templates. The gate is
coverage-limited, and two live events support feasibility rather than complete
faithfulness.

2. **Claimed-or-Attested** — identity claims (author strings) vs. identity attestations (cryptographic signatures). 17.59% attested, 82.41% claimed. The attested subset calibrates the heuristic mapping for the whole.

3. **VAORA** — reasoning claims (chain-of-thought) vs. reasoning attestations (visual pre/post state). Dual rewards suppress hallucinated reasoning.

**The structural pattern**: The Oversight Inversion operates on undifferentiated output. Every previous exit condition (Predicate Gate, Composition Surface, Verification Harness, etc.) works better when claims are typed:
- Predicate gates gate at *typed* transitions (not generic checkpoints)
- Composition surfaces bind at *typed* interfaces (not generic boundaries)
- Verification harnesses verify *typed* claims (not generic output)
- Write contracts govern *typed* state mutations (not generic writes)

**Thirteen-point exit arc**:
1–12: (#444–#455)
13. **Claim-Verification Surface (#456): Type claims, measure extractor and
ontology coverage, and verify each visible claim against an authority-bearing
substrate (granularity condition)**

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
| Typed claim verification appears in ≥1 major agent framework | 3 months | MEDIUM-LOW (Pitwall suggests feasibility in a niche domain; its implementation is unavailable) |

---

## Cross-Source Convergence Summary

The Claim-Verification Surface is a five-layer synthesis with different
evidence strengths:

| Layer | Source | Signal | Mechanism |
|-------|--------|--------|-----------|
| Production | arXiv (cs.CL) | 2607.06495v1 Pitwall | Typed gates plus live feasibility; extraction and ontology bound coverage |
| Identity | arXiv (cs.CR/cs.SE) | 2607.06194 Claimed/Attested | 82.41% of commits rely on unverified claims → trust tiers from unsigned to cross-corpus attested |
| Reasoning | arXiv (cs.AI) | 2607.06522 VAORA | CoT claims verified against visual state → dual rewards suppress hallucinated reasoning |
| Community | HN | Herdr 232pts/13,749★ | Agent multiplexer validates oversight burden → developers build review tooling immediately |
| Ecosystem | GitHub | trace-spec 5★, bootproof 6★ | Attestation infrastructure emerging → ecosystem recognizes the 82.41% gap |

The Claim-Verification Surface is the granularity condition: typed units make
mechanical checks possible, while extractor recall, ontology coverage, and
substrate authority determine what the gate actually proves. Pitwall supports
this conditional design discipline; it does not prove complete faithful
generation under deadline.
