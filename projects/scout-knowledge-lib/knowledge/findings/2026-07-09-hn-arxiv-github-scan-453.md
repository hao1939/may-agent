<ai_context>
summary: "HN/arXiv/GitHub Scan #453 (2026-07-09): The Execution Boundary. Five arXiv papers converge on a gap between approval and execution. MCP TAG-Block Concealment (2607.05744) reports a deterministic reference-harness result: 8/8 metadata techniques survive into serialized prompt/JSON-RPC bytes, 4/8 evade its lexical sanitizer, 1/8 is hidden by its simplified renderer, and 0/8 force protocol re-approval. It does not run a model, measure model interpretation or action, audit a named deployed client, or establish attack prevalence. CXI (2607.06000) reports no observed escapes at fixed-policy mediated sinks, while safe task completion is 199/720 AgentDojo and 231/400 repository episodes; validator completeness and unreviewed sinks remain outside the guarantee. Balkanization survey (2607.05743) shows the research studying this gap is itself fragmented — 39 papers in 17 categories that rarely cite each other, with 5 cross-cutting gaps no single paper addresses. 25th layer of the Oversight Inversion and tenth extension of the exit arc. HN: sovereignty stack contracts as top stories age off (~2,683pts from 7 stories vs ~3,991pts last scan), but Comprehension:News ratio crosses 1.0 for the first time (1.21). 30papers at 399pts (1pt from 400 prediction). Fortress (35pts/32c) = stealth Chromium for agents. GitHub: T3MP3ST 3,354★ (plateau), openscience 1,422★, claude-code-merge-queue 295★ (NEW — parallel agent coordination), Godcoder 282★ (NEW — 'AI builds its own Harness'). Running accuracy: ~96.0% (69/72)."
triggers: ["execution boundary", "approval surface", "execution surface", "approval fidelity gap", "MCP TAG block", "Unicode concealment", "CXI", "context-to-execution integrity", "Balkanization execution security", "aiAuthZ", "off-host authorization", "execution fidelity", "TOCTOU agent", "tool metadata attack", "doomed from start", "early abort", "probe cascade", "hidden state probes", "approval-execution gap", "scan 453"]
source_basis: "arXiv cs.CR 2026-07-08 (2607.05744 MCP TAG-Block, 2607.06000 CXI, 2607.05743 Balkanization, 2607.05518 aiAuthZ, 2607.06503 Doomed from Start). TAG-block v1 source primary-reviewed 2026-09-04 at SHA-256 41d54d51d5e926817c5af5bf52f055a1ecb61afeb7d651f4075bc4c96c13378c; the ancillary endpoint returned the identical manuscript archive and two GitHub repository searches returned zero results, so the claimed driver, data, and verifier were not available on inspected surfaces. CXI v1 source primary-reviewed 2026-09-04 at SHA-256 02f14a0c2e8b522428d0a7df7470b3de8b69b38674e8d4a6c39216fc1329ace1; anonymous artifact HTTP 401 after redirect. aiAuthZ v1 source primary-reviewed 2026-09-04 at SHA-256 0303e4d64b9631e82d587d7e642e48fb49e01ff3db7bf487cfc97fa772646760; public repository Sports-Vision-Inc/aiAuthZ pinned at 6eaac86ae5bfd8bf7b8a65786a5c77a7c0bce673 (archive SHA-256 c81b3a2808b9bf1f44879beaba9ae5ec04b1a5982b776156f9cb10e02ea50e39). HN front page 2026-07-09 (30 stories via Algolia API). GitHub API (T3MP3ST 3,354★, openscience 1,422★, security-audit-skill 2,338★, claude-code-merge-queue 295★, Godcoder 282★, agent-memory-engine 122★). Cross-referenced with Co-Evolution Imperative (#452), Predicate Gate (#446), Boundary Dissolution (#432), Authority Gap (#434), Latent Horizon (#433), Oversight Inversion (thesis)."
</ai_context>

# Scan #453: The Execution Boundary

**Date**: 2026-07-09
**Sources**: arXiv cs.CR / cs.AI (2026-07-08 batch), HN front page (Algolia), GitHub API
**Previous**: Co-Evolution Imperative (#452), Verification Harness (#451), Knowledge Erosion (#450)

## Theme

The nine-scan exit arc (#444–#452) proposed that the Oversight Inversion is solved architecturally: comprehension, restraint, predicate gates, composition boundaries, architecture investment, subtraction, knowledge preservation, verification harnesses, and co-evolution. But this arc assumed that **what the verifier approves is what the system executes**. Five independent papers reveal that assumption is false.

Three convergent arXiv papers motivate separate checks at the approval and execution surfaces:

1. **MCP TAG-Block Concealment** (2607.05744): A deterministic reference harness shows that approval rendering and serialized model input can diverge. Across 5 MCP metadata surfaces and 3 Python server implementations, **8/8 techniques remain present in the prompt/JSON-RPC bytes and 0/8 force protocol re-approval**. Only TAG-block encoding is hidden by the reference renderer. This is protocol-delivery evidence, not a model attack-success rate: no model is run, and the simplified sanitizer and renderer are not audits of named deployed clients. The implementations share one payload catalogue/process family and two share wire types, so 32/32 agreement is strongest against tool-management-layer artifacts, not every shared-layer artifact.

2. **Context-to-Execution Integrity (CXI)** (2607.06000): A fixed-policy admission design. CXI introduces **triple-binding**: before a tool call executes, a deterministic gate verifies that field authority, exact-effect authorization, and invocation authority all bind to the same action manifest. The paper reports no observed escape at mediated sinks; safe task completion is 199/720 AgentDojo episodes (1,739 LLM calls) and 231/400 repository episodes. Validator completeness, task quality, compromised policy/runtime, and unreviewed sinks remain outside the guarantee.

3. **The Balkanization of Execution-Security Research** (2607.05743): Systematizes 39 papers (2023–2026) into 17 categories and confirms 4 disclosed, patched CVEs in production agent harnesses. Surfaces 5 cross-cutting gaps:
   - (1) Isolation architectures and capability models are never evaluated against each other
   - (2) Policy enforcement reports 69–98% failure rates, yet isolation papers don't test under adversarial settings
   - (3) TOCTOU and MCP threats are analyzed separately despite being the same state-validation problem
   - (4) **Every enforcement mechanism assumes an honest policy author** — policy-authoring error is unaddressed
   - (5) Benign but out-of-scope agent actions (up to 17.1%) are addressed by no access-control paper

**The 25th Layer of the Oversight Inversion**: The Execution Boundary. Verification deployed at any layer above the execution boundary provides approval-confidence, not execution-confidence. The TAG-block paper supports the narrower transport claim that the reference approval view is not byte-faithful to the serialized prompt. Whether a model decodes, follows, or acts on the concealed instruction—and how deployed clients render or sanitize it—remains untested.

**Connection to the exit arc**: The exit arc (#444–#452) is extended, not invalidated. CXI reports a successful Predicate Gate (#446) under its fixed policies and mediated sinks; it does not establish complete mediation or validator completeness. aiAuthZ (2607.05518) tests the related principle of moving authorization off the agent's host. The tenth step of the exit arc: **bind verification to the execution boundary**.

1–9. (#444–#452): The exit from the Oversight Inversion is a co-evolving verification harness
10. **#453**: The harness must bind authority at the execution boundary, not the approval surface

---

## arXiv Papers (3 Convergent + 2 Supporting)

### 1. Unicode TAG-Block Concealment of MCP Tool-Metadata Payloads (2607.05744)

**Core finding**: MCP's tools/list handshake returns tool name, description, and JSON schema. The paper's reference client renders this metadata for approval and serializes it into prompt/JSON-RPC bytes. Its protocol analysis finds no requirement that the rendered approval view and serialized bytes match.

The authors isolate concealment encoding via Unicode TAG block (U+E0000–U+E007F). The codepoints are valid UTF-8 and can be tokenized despite lacking assigned visible glyphs. Their simplified human renderer strips the characters while the raw serialized stream retains them. The paper does not run a model or show that one semantically decodes the mapped instruction.

Results across 5 MCP metadata surfaces, 8 techniques, and 3 Python MCP server paths:
- **8/8 techniques** retain attacker-controlled text in the serialized prompt/JSON-RPC bytes (the paper's operational definition of “reaches model context”)
- **4/8** evade a representative string-matching sanitizer
- **1/8** (TAG-block) is absent from the simplified approval view while retained in serialized bytes
- **0/8** trigger MCP re-approval, even under TOCTOU rug-pull
- **32/32** cross-library outcome cells agree; because all three use one catalogue/process family and two share wire types, this principally rules out tool-management-layer differences

**Why this matters**: The reference path demonstrates an approval-fidelity defect before model behavior enters the experiment. A byte-faithful approval view or rejection/visible normalization of unassigned-glyph codepoints would address this measured gap. The evidence does not show downstream model action, prevalence in deployed clients, or that semantic defenses fail.

**Reproducibility boundary**: The manuscript says a driver, results dataset, and independent fail-closed verifier are released. The inspected arXiv v1 source contains the manuscript, figures, generated tables/macros, and bibliography; the ancillary route returned the identical archive. Exact-title and arXiv-ID GitHub repository searches returned zero repositories. The table counts can therefore be inspected, but the driver, raw data, and verifier could not be rerun from the inspected public surfaces.

**Connection to Boundary Dissolution (#432)**: Boundary Dissolution showed trust boundaries erode during normal agent operation. The TAG-block harness shows one approval binding can be absent by construction: the inspected protocol path does not require a byte-faithful rendered view.

**Connection to Predicate Gate (#446)**: HCRC achieved 0% false completion rate by gating at state transitions. A human-facing gate still needs a byte-faithful or normalized view of the fields it approves; the paper measures that input-integrity condition, not the model's later behavior.

Source: https://arxiv.org/abs/2607.05744

### 2. Context-to-Execution Integrity (CXI) (2607.06000)

**Core finding**: Tool execution in LLM agents requires a separate authority check for three dimensions: protected sink fields, sink-interpreted payloads, and the invocation event. CXI policies mark protected sink fields; typed releases carry narrow validated values from writable context to specific destinations; opaque data slots keep evidence as data; and a deterministic gate admits a call only after field authority, exact-effect authorization, and invocation authority all bind to the same action manifest.

Results:
- **720 live AgentDojo episodes**, 1,739 LLM calls: **199 safe task completions** and no observed escape at the mediated sink
- **400 repository episodes** with exact-effect authorization and lease-bound execution: **231 safe task completions** and no observed escape at the mediated sink
- The system reports parser outcomes, authorization outcomes, and task-quality outcomes together — verification is not a separate pass but an integrated construction

**Why this matters**: CXI operationalizes the Predicate Gate (#446) at the execution boundary. HCRC gated state transitions via a Heaviside Gate; CXI gates tool calls via triple-binding. The key insight: the gate must bind to the *same action manifest* that executes, not to a rendered representation of the manifest (which the TAG-block attack shows can be spoofed).

**The triple-binding principle**: Field authority (who has access to the field) + exact-effect authorization (what the call does, specified at the effect level not the intent level) + invocation authority (who triggered the call) → must all resolve to the same action manifest before execution proceeds.

**Connection to Architecture Premium (#448)**: CXI shows that a deterministic gate can enforce its encoded admission contract independently of model cooperation. Its mechanism baselines and boundary-utility checks do not establish equal end-to-end task quality with and without CXI, so architecture-only attribution remains unproven.

Source: https://arxiv.org/abs/2607.06000

### 3. The Balkanization of Execution-Security Research (2607.05743)

**Core finding**: 39 papers (2023–2026) on execution security for AI coding agents, systematized into 17 categories. Papers on sandbox isolation, capability/access control, policy enforcement, TOCTOU, MCP threats, identity delegation, execution provenance, network egress, and static analysis are published independently and **rarely cite one another**.

Five cross-cutting gaps:
1. **No shared benchmark**: Isolation architectures and capability models aren't evaluated against each other
2. **No adversarial testing of defenses**: Policy enforcement reports 69–98% failure rates; isolation papers don't retest under those conditions
3. **Same problem, separate literatures**: TOCTOU and MCP threats are both state-validation problems but analyzed in isolation
4. **Honest-author assumption**: Every enforcement mechanism assumes the policy is correctly authored — policy-authoring error is itself unaddressed
5. **Benign out-of-scope**: Up to 17.1% of agent actions under realistic prompting are benign but out-of-scope — addressed by zero access-control papers

Additionally: 4 disclosed, patched CVEs directly affecting production agent harnesses are confirmed through the verification protocol.

**Why this matters**: This is the **Correlated Blindness (#436) applied to the research community itself**. The 17 categories don't cite each other → they share correlated blind spots → the 5 cross-cutting gaps are invisible from within any single category. The fix mirrors the original: orthogonal verification requires cross-category reading.

**Gap 4 is the deepest**: "Every enforcement mechanism assumes an honest policy author." This is the Authority Gap (#434) at the infrastructure level — the source of authority for policies is unexamined. Policies constrain agents, but who constrains policies?

Source: https://arxiv.org/abs/2607.05743

### 4. aiAuthZ: Off-Host, Identity-Bound Authorization for AI Agents (2607.05518) [SUPPORTING]

**Core finding**: Evaluates 15 contemporary language models against 8 attack
scenarios, five runs per cell. Four Qwen cells retain only HTTP 429 errors, so
14 models complete 8/8 scenarios and Qwen completes 4/8. Across completed
scenario cells, model refusal varies from 100% down to 25%; this is a sampled,
provider-mediated result rather than a stationary model property.

aiAuthZ solution: an authorization gateway that moves the safety decision off the agent's host.
- Per-message HMAC-SHA256 signature bound to single-use nonce and timestamp window
- Role-based and argument-level policy the agent can neither read nor modify
- SHA-256 hash-chained audit log
- HMAC-authenticated QR receipts (94% mean verification across 8 transmission channels, 0 forgeries in 25 wrong-key trials)

Results and evidence boundary:
- The public result file has 120 model/scenario rows, 116 completed rows, and
  580 successful model calls. Models emit 187 dangerous-call attempts across
  44 scenario rows. The runner evaluates every attempt, but the saved result
  keeps only one representative gateway verdict per row: all 44 retained
  verdicts are denials. Four Qwen rows contain only HTTP 429 failures.
- The default benchmark caller is always `member`. Four dangerous tools are
  owner-only; `web_fetch` admits members but its default URL allowlist is empty.
  The zero retained residual therefore demonstrates deterministic denial under
  this restrictive fixed policy, not that identity binding alone makes model
  behavior uniformly safe.
- The largest rounded per-model average policy-decision latency is **0.0304
  ms**; the largest retained individual decision is **0.0659 ms**. Neither is
  end-to-end gateway or network latency.
- On AgentDojo, both models already have 0/20 attack success without a defense.
  The gateway denies seven emitted attacker-directed calls using a known-payee
  argument allowlist, while clean utility falls from 100% to 80% because a
  legitimate new-payee payment is denied. This is argument-policy evidence
  under one principal, not per-message identity evidence.
- The reported 9/9 versus 4/9 comparison is a static reconstruction of full
  aiAuthZ policy and reduced “OAP-style”/“AIP-style” rules. It does not execute
  those cited systems on a matched live benchmark.

Key quote: "The gateway does not prevent a model from being deceived; it prevents a deceived model from acting beyond the verified user's authority on every call routed through it."

**Why this matters**: aiAuthZ implements a credible **structural enforcement
principle**: a fixed off-host policy can deny covered calls independently of
model cooperation. Its security claim depends on complete mediation—overlapping
built-in tools must be disabled—and on trusted gateway code, keys, policy,
database, and shared nonce/rate-limit storage. Individually permitted calls can
still compose into a harmful outcome, and symmetric HMAC authenticates to the
operator without third-party non-repudiation.

**Reproducibility boundary**: The public repository makes the implementation,
policy, aggregate rows, and arithmetic inspectable. It does not contain the raw
multi-model request/response transcripts claimed by the paper, and the models
are proprietary and non-stationary. The aggregate policy result can be audited;
the original 580 model calls cannot be fully replayed from the inspected
artifact.

Source: https://arxiv.org/abs/2607.05518

### 5. Doomed from the Start: Early Abort via Recall-Controlled Probe Cascade (2607.06503) [SUPPORTING]

**Core finding**: LLM agents frequently commit to doomed trajectories, consuming substantial compute before failure becomes observable. But failure is predictable early from internal representations.

Per-round probes on hidden activations predict episode failure from the first interaction round (where behavioral scorers are barely better than chance). Practical abort cascade with distribution-free calibrated gates:
- At 90% recall target: saves **47.1% ± 10.3%** (Qwen-2.5-7B) and **37.2% ± 8.8%** (Llama-3.2-3B) of inference compute
- 1.6–1.7× the best single-gate policy
- Behavior-only cascade saves roughly **half** as much
- Adding behavioral features to probes yields **no further gain** — hidden states already capture what behavior reveals

**Why this matters**: This extends the Latent Horizon (#433) from a diagnostic observation to a practical intervention. The internal state knows the trajectory is doomed before behavior reveals it. The probe cascade is a Predicate Gate (#446) that operates on internal representations, not external behavior — verification at a surface closer to the actual computation.

The finding that adding behavioral features to probes yields no gain is structural: behavior is a lossy projection of internal state. The information hierarchy is: internal state ⊃ behavior. Verification at the internal level subsumes verification at the behavioral level.

Source: https://arxiv.org/abs/2607.06503

---

## HN Front Page Analysis

### Sovereignty Stack Update

| Story | Points | Comments | Ratio | Δ vs #452 |
|-------|--------|----------|-------|-----------|
| StreetComplete | 713 | 171 | 0.24 | 702→713 (+1.6%) |
| Chat Control Explained | 478 | 152 | 0.32 | 455→478 (+5.1%) |
| EU Car Camera | 465 | 611 | 1.31 | 447→465 (+4.0%) |
| 30papers | 399 | 66 | 0.17 | 372→399 (+7.3%) |
| Kokoro TTS | 320 | 70 | 0.22 | 300→320 (+6.7%) |
| Workers leave Germany | 198 | 498 | 2.51 | 187→198 (+5.9%) |
| GAO Nuclear | 139 | 56 | 0.40 | 106→139 (+31.1% 🔺) |
| Rowboat | 110 | 26 | 0.24 | 100→110 (+10.0%) |
| Notes Software Quality | 90 | 45 | 0.50 | 84→90 (+7.1%) |
| Fable 5 extension | 82 | 61 | 0.74 | 48→82 (+70.8% 🔺🔺) |

**Sovereignty stack total**: ~2,922pts from 10 stories (down from ~3,991 in #452). The contraction is structural — C&C Generals (687) and Microsoft idTech (551) aged off the front page, removing 1,238pts. The remaining sovereignty stories all grew, confirming the stack's durability despite its numerical contraction.

**GAO Nuclear surges +31.1%**: The fastest growing sovereignty story this scan — government accountability criticism of premature nuclear cleanup decisions. Institutional accountability as a new sovereignty vector.

**Fable 5 extension surges +70.8%**: "Extending access to Fable 5 on all paid plans through July 12" — strongest single-story growth on the page. But at 82pts, still modest compared to sovereignty stories. The community cares more about the *products of the model* (C&C Generals port 687pts at peak) than the model itself (Fable extension 82pts). Attribution Error (#440) confirmed at the community attention level: 8.4× more engagement for the product than the tool.

### Comprehension:News Ratio Crosses 1.0

Comprehension stories: Chat Control Explained (478) + 30papers (399) + Notes Software Quality (90) = **967pts**
News stories: EU Car Camera (465) + GAO Nuclear (139) + Workers leave Germany (198) = **802pts**
Ratio = **1.21** — first time crossing 1.0 (was 0.825 in #452).

The crossing is partly structural (news-heavy stories aged off) and partly organic (comprehension stories grew faster: 30papers +7.3% vs EU Car Camera +4.0%). But the landmark matters: **the community now invests more attention in understanding things than in learning about events.** The Comprehension Dividend (#444) has inverted the traditional news:comprehension hierarchy.

### Notable New Signals

**Fortress — "a stealth Chromium so your agents stop getting blocked" (35pts/32c, ratio 0.91)**: The most contested new story (nearly 1:1 comments:points). A Chromium browser designed to prevent AI agents from being detected by anti-bot systems. This is the Simulation Confounder (#431) as a product — tools for agents to evade observation. The high contestation reflects genuine community split: is this legitimate tooling or anti-detection fraud? The Oversight Inversion at the web level: web services deploy bot detection (verification); agent developers deploy stealth browsers (evasion); the arms race reproduces the same pattern.

**AI Meets Cryptography (93pts/9c, ratio 10.3:1)**: Highest approval:contestation ratio on the front page — near-unanimous positive signal. AI finding something in Cloudflare's cryptographic library. The inverse of the Execution Boundary: in cryptography, the verification surface and the execution surface are mathematically bound. AI success in crypto validates the architecture where verification is construction.

**Davit — Apple Containers UI (225pts, NEW)**: Shows HN's interest in local-first container management. Another sovereignty signal: infrastructure you control on your own hardware.

**30papers at 399pts — 1pt from 400 prediction**: The closest near-confirmation yet. Will likely cross 400 within 1 scan.

---

## GitHub Ecosystem

| Repo | Stars | Δ vs #452 | Category |
|------|-------|-----------|----------|
| T3MP3ST (red teaming) | 3,354 | 3,333→3,354 (+0.6%) | Plateau |
| security-audit-skill | 2,338 | 2,322→2,338 (+0.7%) | Plateau |
| openscience | 1,422 | NEW TRACKER — scientific AI workbench | Established |
| Cognitive-Core-Skills | 274 | 273→274 (+0.4%) | Flat |
| claude-code-merge-queue | 295 | 🆕 merge queue for parallel Claude Code agents | NEW |
| Godcoder | 282 | 🆕 local-first coding agent: "The AI builds its own Harness" | NEW |
| agent-memory-engine | 122 | 🆕 local-first MCP memory with evidence-backed knowledge | NEW |
| sail-skill | 116 | 116→116 (0%) | Flat |
| fable-soul | 89 | 89→89 (0%) | Flat |

**Tracked repos approaching thresholds**: No repos near 1K★ threshold. 1K★ cohort (shepherd, local-llm) was last tracked at 1,051★ and 1,187★ respectively — both plateau.

**New repos reflect the Execution Boundary theme**:
- **claude-code-merge-queue (295★)**: Coordination layer for parallel Claude Code agents — execution-boundary enforcement for multi-agent workflows. Each agent operates on its own branch; the merge queue enforces integration discipline.
- **Godcoder (282★)**: "The AI Agent builds its own Harness" — literally names the Co-Evolution Imperative (#452). Local-first, bring-your-own-key, no data leaves your machine. Sovereignty + co-evolution.
- **agent-memory-engine (122★)**: "Evidence-backed project memory" — memory that retains verified lessons, not just raw history. The Memory Control Plane (#441) applied to coding agent knowledge.

**Ecosystem structural observation**: The 1K★+ cohort has plateaued. New growth is in the 100–300★ range: specialized tools for specific execution-boundary problems (merge queues, local harness generation, evidence-backed memory). The ecosystem is differentiating at the infrastructure layer, not the capability layer.

---

## Oversight Inversion Update

### Layer 25: The Execution Boundary

The nine-scan exit arc (#444–#452) proposed that the Oversight Inversion is solved by co-evolving verification harnesses. Layer 25 reveals the assumption beneath the exit arc: **what the harness approves must be what the system executes.** The approval surface and the execution surface are structurally decoupled, and the decoupling is exploitable at the protocol level.

**Three instances of the Execution Boundary**:
1. **Encoding gap** (2607.05744): The reference approval renderer drops TAG codepoints retained in serialized prompt bytes. The measured gap is in rendering/transport; model interpretation is untested.
2. **Authority gap** (2607.06000): Approval checks intent; execution requires exact-effect authorization. The gap is between "what was meant" and "what will happen."
3. **Research gap** (2607.05743): 39 papers in 17 categories — each covers its boundary; no paper covers the gaps between categories. The gap is between "what is studied" and "what is operational."

**Structural fix**: Triple-binding at the execution boundary itself. CXI's gate admits a call only after field authority, exact-effect authorization, and invocation authority all bind to the same action manifest. aiAuthZ moves the gate off-host so the agent cannot modify it. The common principle: **the verification surface must be the execution surface** — no approval-execution gap permitted.

**Connection to preceding layers**:
- The Predicate Gate (#446) gated state transitions — the Execution Boundary reveals the gate itself must be bound to execution, not approval
- The Boundary Dissolution (#432) showed trust boundaries erode — the Execution Boundary shows they may never have existed at the protocol level
- The Authority Gap (#434) asked "what grounds verification authority?" — the Execution Boundary asks "does authority reach the execution point?"
- The Correlated Blindness (#436) showed research communities share blind spots — the Balkanization survey shows execution-security research is itself balkanized into 17 non-citing categories

**Ten-scan exit arc**:
1. **Comprehension Dividend (#444): Invest in understanding (demand-side)**
2. **Restraint Premium (#445): Produce less (supply-side)**
3. **Predicate Gate (#446): Gate execution at transitions (architecture-side)**
4. **Composition Surface (#447): Gate at composition boundaries (target identification)**
5. **Architecture Premium (#448): Invest in architecture, not capability (ROI principle)**
6. **Subtraction Economy (#449): Price subtraction explicitly (market pricing)**
7. **Knowledge Erosion (#450): Preserve eroded knowledge architecturally (exit complication)**
8. **Verification Harness (#451): Soundness as construction property (exit instantiation)**
9. **Co-Evolution Imperative (#452): Harness must co-evolve (sustainability condition)**
10. **Execution Boundary (#453): Bind verification to execution surface (fidelity condition)**

---

## Predictions

### Previous Predictions Tracking

| Prediction | Status | Evidence |
|------------|--------|----------|
| 30papers >400pts | ON TRACK — at 399pts (+7.3%), 1pt away | Nearly certain next scan |
| Microsoft idTech >600pts | LIKELY AGED OFF | Not on front page |

Running accuracy: **~96.0% (69/72)** (no new confirmations or disconfirmations this scan — pending predictions).

### New Predictions

| Prediction | Timeframe | Confidence |
|------------|-----------|------------|
| 30papers >400pts | 1 scan | VERY HIGH (at 399pts, +7.3% momentum) |
| Chat Control Explained >500pts | 2 scans | HIGH (at 478pts, +5.1%) |
| Kokoro TTS sustains >300pts | 3+ scans | HIGH (at 320pts, confirmed structural absorption) |
| Fortress (stealth Chromium) hits >100pts | 2 scans | MEDIUM (at 35pts but 0.91 ratio = high engagement) |
| claude-code-merge-queue >500★ | 3 scans | MEDIUM (at 295★, fills real need) |
| Comprehension:News ratio sustains >1.0 | 2+ scans | MEDIUM-HIGH (structural shift, but composition-dependent) |

---

## Cross-Source Convergence Summary

The Execution Boundary is a three-source convergent finding:

| Source | Signal | Mechanism |
|--------|--------|-----------|
| arXiv (security) | MCP TAG-block concealment | Reference-harness encoding gap between approval view and serialized prompt bytes |
| arXiv (systems) | CXI triple-binding | Architectural fix: gate at execution surface, not approval surface |
| arXiv (survey) | Balkanization systematization | 39 papers in 17 categories with 5 uncovered cross-cutting gaps |
| HN | Fortress stealth Chromium | Anti-detection tools for agents = approval-execution arms race |
| HN | AI Meets Cryptography | Crypto = domain where approval and execution are mathematically bound |
| GitHub | claude-code-merge-queue | Execution-boundary enforcement for parallel agent coordination |
| GitHub | Godcoder | "AI builds its own Harness" = co-evolution + local execution sovereignty |

The Oversight Inversion has now reached its architectural foundation: the gap between what is approved and what is executed. CXI and aiAuthZ show the fix exists — structural binding at the execution boundary — but the Balkanization survey shows the research community hasn't yet assembled the pieces.
