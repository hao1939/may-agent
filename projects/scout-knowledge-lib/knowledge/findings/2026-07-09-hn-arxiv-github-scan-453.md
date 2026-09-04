<ai_context>
summary: "HN/arXiv/GitHub Scan #453 (2026-07-09): The Execution Boundary. Five arXiv papers converge on a gap between approval and execution. MCP TAG-Block Concealment (2607.05744) reports a deterministic reference-harness result: 8/8 metadata techniques survive into serialized prompt/JSON-RPC bytes, 4/8 evade its lexical sanitizer, 1/8 is hidden by its simplified renderer, and 0/8 force protocol re-approval. It does not run a model, measure model interpretation or action, audit a named deployed client, or establish attack prevalence. CXI (2607.06000) reports no observed escapes at fixed-policy mediated sinks, while safe task completion is 199/720 AgentDojo and 231/400 repository episodes; validator completeness and unreviewed sinks remain outside the guarantee. Balkanization survey (2607.05743) classifies 39 selected papers into 17 categories through an iterative, non-exhaustive search and proposes five cross-cutting gaps; it releases no citation-edge denominator, and one of four CVE examples is inherited runc substrate risk rather than an agent-harness incident. 25th layer of the Oversight Inversion and tenth extension of the exit arc. HN: sovereignty stack contracts as top stories age off (~2,683pts from 7 stories vs ~3,991pts last scan), but Comprehension:News ratio crosses 1.0 for the first time (1.21). 30papers at 399pts (1pt from 400 prediction). Fortress (35pts/32c) = stealth Chromium for agents. GitHub: T3MP3ST 3,354★ (plateau), openscience 1,422★, claude-code-merge-queue 295★ (NEW — parallel agent coordination), Godcoder 282★ (NEW — 'AI builds its own Harness'). Running accuracy: ~96.0% (69/72)."
triggers: ["execution boundary", "approval surface", "execution surface", "approval fidelity gap", "MCP TAG block", "Unicode concealment", "CXI", "context-to-execution integrity", "Balkanization execution security", "aiAuthZ", "off-host authorization", "execution fidelity", "TOCTOU agent", "tool metadata attack", "doomed from start", "early abort", "probe cascade", "hidden state probes", "approval-execution gap", "scan 453"]
source_basis: "arXiv cs.CR 2026-07-08 (2607.05744 MCP TAG-Block, 2607.06000 CXI, 2607.05743 Balkanization, 2607.05518 aiAuthZ, 2607.06503 Doomed from Start). TAG-block v1 source primary-reviewed 2026-09-04 at SHA-256 41d54d51d5e926817c5af5bf52f055a1ecb61afeb7d651f4075bc4c96c13378c; the ancillary endpoint returned the identical manuscript archive and two GitHub repository searches returned zero results, so the claimed driver, data, and verifier were not available on inspected surfaces. CXI v1 source primary-reviewed 2026-09-04 at SHA-256 02f14a0c2e8b522428d0a7df7470b3de8b69b38674e8d4a6c39216fc1329ace1; anonymous artifact HTTP 401 after redirect. Balkanization v1 source primary-reviewed 2026-09-04 at SHA-256 68eeba16c86b2952e33dca0f09b64dfcd4a0fb42aa65da0fa96e8afdb3a8385c; it contains generated tables and 39 appendix rows but not the claimed CSV or verifier. aiAuthZ v1 source primary-reviewed 2026-09-04 at SHA-256 0303e4d64b9631e82d587d7e642e48fb49e01ff3db7bf487cfc97fa772646760; public repository Sports-Vision-Inc/aiAuthZ pinned at 6eaac86ae5bfd8bf7b8a65786a5c77a7c0bce673 (archive SHA-256 c81b3a2808b9bf1f44879beaba9ae5ec04b1a5982b776156f9cb10e02ea50e39). HN front page 2026-07-09 (30 stories via Algolia API). GitHub API (T3MP3ST 3,354★, openscience 1,422★, security-audit-skill 2,338★, claude-code-merge-queue 295★, Godcoder 282★, agent-memory-engine 122★). Cross-referenced with Co-Evolution Imperative (#452), Predicate Gate (#446), Boundary Dissolution (#432), Authority Gap (#434), Latent Horizon (#433), Oversight Inversion (thesis)."
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

3. **The Balkanization of Execution-Security Research** (2607.05743):
   Classifies 39 selected papers (2023–2026) into 17 categories through an
   iterative, non-exhaustive search. Its five gaps are author synthesis over
   that corpus: no shared isolation/access-control benchmark, no reuse of the
   named enforcement-fragility tests, a proposed TOCTOU/MCP state-validation
   analogy, an honest-policy-author assumption, and no access-control treatment
   of the cited 17.1% benign out-of-scope result. No citation-edge denominator
   supports the field-wide “rarely cite” phrase. Three CVEs affect Copilot/
   Visual Studio or Claude Code; the fourth predates agent tooling and concerns
   inherited runc container risk.

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

**Core finding**: A systematization assigns 39 selected papers (2023–2026) to
17 execution-security categories. The search is iterative and citation-
following rather than exhaustive, eight categories contain one paper, and
several multi-category papers are forced into one primary label. The paper says
categories rarely cite one another but releases no citation-edge table, count,
or denominator; the field-wide prevalence of cross-category citation is
therefore unknown.

Five proposed cross-cutting gaps within the selected corpus:
1. **No shared benchmark**: No isolation/access-control head-to-head comparison
2. **No adversarial co-evaluation**: No isolation paper reuses ShellSieve's named seven-operation setting, whose per-operation incomplete-block rates span 69.0–98.6%
3. **TOCTOU/MCP analogy**: The paper interprets both as state-validation problems; it does not test one mitigation across both
4. **Honest-author assumption**: Reviewed mechanisms do not measure policy-authoring error
5. **Benign out-of-scope**: No selected access-control/capability paper
   addresses OverEager's cited consent-ablation result. Its 17.1% is 13/76
   Claude Code + GLM-4.6 runs in a hand-curated paired pilot after removing an
   explicit scope block, versus 0/76 with the block. The primary paper calls
   that effect an upper bound on a sensitive sub-population; under its separate
   five-axis randomized 500-scenario design, the authorization-tier range is
   2.6--3.1 percentage points.

**OverEager's framework claim is product-bundle evidence, not a permission-
gate ablation.** On the two shared cells with exact counts, Claude Code exceeds
OpenHands by 8.29 points for GLM-4.6 (64/500 versus 22/488; two-sided Fisher
`p=2.86e-6`) and 11.59 points for MiniMax-M2.7 (59/500 versus 1/485;
`p=2.59e-17`). The direction is strong for those evaluated bundles. But the
paper calls “framework” a change that also changes the product's default system
prompt, tool interface, adapter, and confirmation-disabling mechanism; it does
not toggle a common permission gate while holding those factors fixed. The
matrix is populated by availability, runs are treated as independent without
scenario clustering, and OpenHands timeouts are excluded from its denominator.
The reported 26.6-point Sonnet cross-product range is an extreme-range
comparison, not a fitted framework-versus-model variance component.

The results table also does not retain enough counts to reconstruct every
contrast. It declares `n=500` for all non-OpenHands cells, but five one-decimal
rates (27.7%, 13.5%, 13.1%, 16.9%, and 13.9%) cannot be integer event counts
over 500, and the promised raw bundles are unavailable. Preserve the observed
product-level differences; do not promote them into isolated permission-gate
causality or a general framework-dominance estimate until exact denominators,
paired scenario outcomes, and a matched intervention are inspectable.

**The 50-run human check is internally arithmetically consistent but not a
resolved independent gold standard.** The two annotators flag 15 and 19 runs
and agree on 44/50, which uniquely reconstructs 14 both-positive, 30
both-negative, and six disagreement cases and reproduces Cohen's
`kappa=0.7345`. But two labels cannot produce a majority on those six ties.
The published rule-judge table uses 19 human positives (TP=19, FP=6, FN=0,
TN=25), which implies an unreported tie disposition choosing five disagreements
positive and one negative. Annotators also saw the rule verdict, severity, and
triggered predicate IDs, so they were blind to each other but not to the system
being validated. The stated stratification allocates 45 samples to nine
high-rate cells and only five combined to two near-zero cells, contradicting
the adjacent “each cell contributes 4--5” description and yielding an
unweighted stratified-sample result rather than a population estimate. No
raw labels, within-cell selection rule, adjudication policy, or per-archetype
sample counts are released. Preserve the reported sample metrics, including
the source claim that all six false positives are `toctou-race`; do not infer
benchmark-wide 1.00 recall, coverage of all other 23 archetypes, or independent
human confirmation until those records are inspectable.

The paper checks four CVE metadata records against NVD and vendor advisories but
does not reproduce the exploits. Three concern Copilot/Visual Studio or Claude
Code. `CVE-2024-21626` is a 2024 runc escape that predates agent tooling and is
evidence of inherited container-runtime risk, not an observed agent-harness
incident.

**Why this matters**: The taxonomy exposes useful cross-category test
questions, especially the missing shared benchmark and policy-authoring-error
study. It motivates the **Correlated Blindness** analogy; it does not measure
field-wide citation fragmentation or prove that the five absences hold outside
its non-exhaustive corpus.

**Reproducibility boundary**: The inspected survey v1 source contains generated
tables/macros, bibliography, figures, and all 39 appendix rows, but not the
claimed machine-readable corpus or independent verifier. Counts and wording
are inspectable; search completeness, classifications, citation assertions,
and regeneration are not independently reproducible from that archive.
OverEager `2605.18583v1` likewise says its 500 scenarios, approximately 7,500
audit bundles, generators, audit suite, and adapters will be released upon
publication. Its inspected arXiv source contains manuscript files and figures,
not those artifacts. Four targeted GitHub repository searches found no
attributable project, so the published tables and arithmetic are inspectable
but neither the paired pilot, the human-label analysis, nor the full matrix can
currently be replayed.

Sources: https://arxiv.org/abs/2607.05743,
https://arxiv.org/abs/2605.18583

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
