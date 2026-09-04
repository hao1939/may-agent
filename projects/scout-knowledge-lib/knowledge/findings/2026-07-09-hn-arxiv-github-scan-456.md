<ai_context>
summary: "HN/arXiv/GitHub Scan #456 (2026-07-09), partly qualified. Pitwall's typed gates are extraction/ontology bounded. Claimed or Attested (2607.06194v1) counts 1.032B/5.867B commits with signature markers, not verified identities: two platform keys carry 95.9% of author-key associations, only 0.74% of canonical authors reach the person-key tier, and 39/398 sampled person keys yield a retrievable matching email. The paper's raw co-signature 'gold' is confounded by shared keys; only 9,036/32,192 fan-out-two disagreements have another corroborating signal. Its claimed bundle/code are absent behind a TODO locator. VAORA remains pending primary review. HN/GitHub counters remain discovery signals."
triggers: ["claim verification surface", "typed claims", "faithfulness as construction", "faithfulness by architecture", "claim decomposition", "virtue tradeoff", "Pitwall", "grounding engine", "calibrated verification", "claimed vs attested", "commit signatures", "identity attestation", "trust tiers", "unsigned signed attested", "precision anchor", "VAORA", "visual action outcome", "reasoning action alignment", "hallucinated CoT", "dual reward grounding", "vividness hallucination tradeoff", "sparse context audit", "claim typing", "agent multiplexer", "Herdr", "terminal multiplexer agent", "scan 456"]
source_basis: "arXiv cs.CL/cs.AI/cs.CR/cs.SE 2026-07-07 (2607.06495 Pitwall, 2607.06194 Claimed or Attested, 2607.06522 VAORA). Pitwall 2607.06495v1, related 2606.09376v2, and Claimed or Attested 2607.06194v1 sources primary-reviewed 2026-09-04. Related artifact vectrayx/precision-is-not-faithfulness@a1caae7858f4152b3be616ba68d00334fc7bcdab inspected; Pitwall's repository and Claimed or Attested's promised bundle/code were not attributable. HN front page and GitHub counters are historical discovery observations. Cross-referenced with Dispersion Collapse (#455), Write Contract (#454), Verification Harness (#451), Authority Gap (#434), Announcement Gap (#428)."
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

2. **Claimed or Attested?** (2607.06194v1): Detects a signature header in
   1,031,721,316/5,866,595,698 commits (17.59%). This is exact marker presence,
   not full signature or identity verification. Two platform keys carry 95.9%
   of author-key associations; only 465,398/62,579,994 canonical authors
   (0.74%) reach the paper's person-key tier. A 398-key sample retrieves 78
   public keys and finds 39 user-id emails matching the author string. Treat
   the axis as provenance evidence with explicit trust levels, not a binary
   identity attestation.

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

### 2. Claimed or Attested? A Commit-Signature Dataset and Identity Trust Tiers across the World of Code (2607.06194v1)

**Population and extraction**: The paper scans all 128 commit-table shards in
World of Code V2604. It finds a canonical `gpgsig` marker and family banner in
1,031,721,316/5,866,595,698 commits (17.59%): 98.96% PGP, 1.02% SSH, and
0.02% X.509/sigstore. Three SHA-space shards range 17.53--17.65%, and strict
versus loose markers agree within 0.01 percentage points. These checks support
header detection. They do not cryptographically validate each signature,
recover its signer, or prove that signer is the author named in the commit.

**Platform-key confound**: A commit signature binds an object to a key; it need
not bind the author field to the human who holds that key. Across 44,871,077
author-key associations, GitHub's web-flow key covers 30,440,944 authors and a
second platform key covers 12,592,731—95.9% together. A fan-out threshold of 50
removes 2,651 shared keys and leaves 583,360 candidate person keys, but the
threshold is heuristic and the paper does not report a held-out classifier
validation.

**The proposed alias gold is conditional**: The paper initially calls raw
co-signature pairs “cryptographic alias gold.” Its own fan-out-two triage shows
otherwise. Of 32,192 pairs the alias map leaves apart, only 9,036 (28.1%) have
a corroborating email/name/domain signal; 23,156 (71.9%) are two people sharing
one key and are correctly separate. Thus a low-fan-out key is evidence to
investigate, not a same-person guarantee. The reported fan-out-stratified map
“recall” cannot by itself calibrate identity accuracy, and map precision is not
reported.

**Trust tiers, qualified**: Among 62,579,994 canonical authors, 30,638,625 are
T0 unsigned (49.0%), 31,475,971 are T1 platform-signed only (50.3%), and only
465,398 reach T2 person-key (0.74%). The 966 scholarly T3 authors are described
as a subset but not represented as a separate row in the exhaustive tier
table. A PGP user-id email, a key registered to a GitHub account, or an OIDC
subject binds a key to an account or asserted address; it is not automatically
a verified real-world person.

**Sampled verification and uncertainty**: Of 398 random candidate person keys,
78 are retrievable from the Ubuntu keyserver (19.6%; Wilson 95% interval
16.0--23.8%). Of those, 39 user-id emails match the signed author string (50.0%;
39.2--60.8%), or 39/398 of the whole sample (9.8%; 7.3--13.1%). Thirty-seven
differ and two expose no user-id. This calibrates keyserver/email reachability;
it neither validates all commit signatures nor bounds a “residual forgery
rate,” because the unretrieved population and meaning of mismatches remain
unresolved.

**Artifact boundary**: The five-file arXiv source contains prose, references,
and figures only. Its availability section says the data and replication code
are released but still names `TODO/woc-commit-signatures-v2604` and a DOI “to be
minted.” At `2026-09-04T07:10:32Z`, an unauthenticated exact-title GitHub
repository search returned one non-author result; two Hugging Face dataset
searches returned empty arrays. No released row, extractor, parser, or
replication script was attributable, so the full-corpus counts and key graph
cannot be independently reproduced from the claimed package.

**Why this matters for agent governance**:

As AI agents produce more commits (2607.05677 from #454 documented 13,360 AI sessions across 1,356 OSS repos), the claim-attestation gap widens. Agent-generated commits typically carry the human developer's author string but may have been written by Claude Code, Copilot, or Codex. The commit *claims* human authorship; nothing *attests* to it.

The tier framework usefully separates evidence levels, but does not map directly
to agent-output semantics. A signed byte sequence, a session/model binding, a
human identity, and independent correctness evidence are different claims and
need separate verifiers.

**Connection to Authority Gap (#434)**: The 17.59% result quantifies signature-
marker prevalence in one global corpus, not grounded author identity. The
durable lesson is to type provenance levels explicitly and avoid promoting
marker presence into key control, account binding, person identity, or content
correctness.

Source: https://arxiv.org/abs/2607.06194v1

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
| Claimed/Attested | Code provenance | Author strings | Signature marker → key/account evidence | Free text → marker present → candidate key → qualified binding |
| VAORA | Embodied Reasoning | Chain-of-thought | Visual state (pre/post action) | Reasoning → dual visual alignment |

**The pattern**: Decompose output into typed claims, verify each extracted claim
against an authority-bearing substrate, and gate composition. The gate covers
only claims the extractor sees and types the ontology represents.

**What this means for the Oversight Inversion**: The Inversion thrives on undifferentiated output — when "the model output" is the unit of verification, verification is expensive, subjective, and scaling super-linearly. When claims are typed and each type has a defined verification procedure:
- Verification becomes **mechanizable** (different procedures for different claim types)
- Faithfulness becomes a **conditional construction target** (Pitwall's gates,
  bounded by extraction, ontology, and state authority)
- Signature-marker prevalence becomes **measurable** (17.59% vs. 82.41% in WoC
  V2604); verified author identity remains a much smaller, qualified subset
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

- **trace-spec** (5★, agentrust-io/trace-spec): "TRACE — Trust Runtime Attestation and Compliance Evidence. Open attestation standard for agent actions." It proposes agent-action attestation infrastructure. Claimed-or-Attested supplies adjacent commit-signature prevalence evidence, not a measurement of this standard's absence or adoption.
- **bootproof** (6★, bootproof/bootproof): "The end of 'Works on my machine.' Zero-trust supervisor that verifies execution environments before agents run." Attestation at the infrastructure level — verify the substrate before trusting the claim.
- **agent-video-attestation** (4★): "AVAP — Agent Video Attestation Protocol: signed, blockchain-anchored agent-to-agent verification."

These repos are tiny (5-6★) discovery signals for attestation-adjacent
infrastructure. They do not establish a structural shift, and Claimed-or-
Attested's 82.41% unsigned share does not measure whether an attestation layer
is absent from the corpus. The stronger retained pattern is that typed claims
need claim-specific evidence rather than a generic “signed” label.

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

2. **Claimed-or-Attested** — 17.59% of commits carry a signature marker, but
platform keys dominate and only 0.74% of canonical authors reach the candidate
person-key tier. Marker, key, account, and person bindings must remain separate.

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
| Provenance | arXiv (cs.CR/cs.SE) | 2607.06194v1 Claimed/Attested | 17.59% signature-marker presence; person/account binding is sparse and heuristic |
| Reasoning | arXiv (cs.AI) | 2607.06522 VAORA | CoT claims verified against visual state → dual rewards suppress hallucinated reasoning |
| Community | HN | Herdr 232pts/13,749★ | Agent multiplexer validates oversight burden → developers build review tooling immediately |
| Ecosystem | GitHub | trace-spec 5★, bootproof 6★ | Small historical discovery signals for attestation-adjacent infrastructure; no adoption inference |

The Claim-Verification Surface is the granularity condition: typed units make
mechanical checks possible, while extractor recall, ontology coverage, and
substrate authority determine what the gate actually proves. Pitwall supports
this conditional design discipline; it does not prove complete faithful
generation under deadline.
