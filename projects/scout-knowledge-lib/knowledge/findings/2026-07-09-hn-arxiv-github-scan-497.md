<ai_context>
summary: "Scan #497: The Accountability Stack — six independent projects/papers each address a single layer of agent accountability (identity, authorization, trajectory, provenance, causality, memory) without spanning more than two layers. The governance gap is in the transitions between layers. HN confirms: GPT-5.6 contestation rising (r=0.74, up from 0.69 in #496); Mozilla's 'Control Layer' article (19pts) declares infrastructure > models. GitHub: kakunin-ai (26★, X.509 agent identity + EU AI Act compliance, created July 7) is Brain0's identity-layer complement. Combined with Delego (26★, intent-bound authorization), TraceProbe (trajectory diagnostics), Brain0 (commit provenance), STRACE (causal extraction), and notmemory (tamper-proof memory), the field is building accountability layer-by-layer — but no integration layer exists."
triggers: ["accountability stack", "agent identity", "kakunin", "X.509 agent", "non-human identity", "NHI", "delego", "intent-bound authorization", "TraceProbe", "trajectory diagnostics", "AgentLens", "Brain0", "STRACE", "notmemory", "tamper-proof memory", "accountability layer", "governance plane coupling", "layer transition", "composable accountability", "control layer", "infrastructure not models", "EU AI Act compliance", "behavioral risk scoring", "agent certificate"]
</ai_context>

# Scan #497: The Accountability Stack

**Date**: 2026-07-09
**Source**: HN + arXiv + GitHub cross-synthesis
**Theme**: Six independent projects each solve a single accountability layer. No project spans more than two layers. The governance gap lives in the transitions between them.

---

## The Stack Crystallization

For the first time, enough independent projects exist to map a complete accountability stack for AI agents — but each operates in isolation. The layers:

| Layer | Function | Project/Paper | Stars/Status | Spans |
|-------|----------|---------------|--------------|-------|
| L0: Identity | Who is this agent? | kakunin-ai/kakunin-core | 26★ (created 2026-07-07) | L0 only |
| L1: Authorization | What may this agent do? | Delego-Dev/delego | 26★ (created 2026-06-03) | L1 only |
| L2: Trajectory | What did this agent do? | TraceProbe (2607.06184) + AgentLens (2607.06624) | arXiv + OSS bench | L2 only |
| L3: Provenance | Which commits came from which agent decisions? | Brain0 | 132★ (scan #496) | L3-L4 |
| L4: Causality | Which steps actually mattered? | STRACE (2607.07702) | arXiv | L3-L4 |
| L5: Memory | What did the agent remember/forget? | notmemory | 5★ (created 2026-06-07) | L5 only |

**Critical observation**: No project spans more than 2 adjacent layers. Brain0 + STRACE together cover L3-L4 (provenance + causal extraction). Every other project is single-layer. The transitions — identity→authorization, authorization→trajectory, trajectory→provenance, provenance→memory — are ungoverned.

---

## Layer Details

### L0: Agent Identity — kakunin-ai/kakunin-core (26★)

Created 2026-07-07. The first platform combining:
- **X.509 certificates via AWS KMS** for agent identity
- **Behavioral risk scoring** — identity isn't just "who" but "how is this agent behaving?"
- **Auto-revocation** — certificate withdrawn when behavioral score degrades
- **EU AI Act + MiCA audit trails** — regulatory compliance baked in

Topics: `agent-security`, `ai-governance`, `audit-log`, `behavioral-monitoring`, `certificate-authority`, `compliance`, `eu-ai-act`, `non-human-identity`, `pki`, `regtech`, `x509`

**Structural significance**: This is Brain0 (scan #496) but for identity rather than provenance. Brain0 answers "what did this agent do at the commit level?" Kakunin answers "is this agent who it claims to be, and should it still be trusted?" The two are complementary — provenance without identity is unsigned; identity without provenance is unverifiable.

Companion repos: kakunin-samples (33★), kakunin-sdk-typescript (27★), kakunin-sdk-python (1★). Multi-language SDK approach indicates production intent.

Source: https://github.com/kakunin-ai/kakunin-core

### L1: Authorization — Delego (26★)

Created 2026-06-03. "Intent-bound action authorization for AI agents — deterministic, per-action approval a prompt injection can't re-point, with a signed, tamper-evident audit trail."

Key property: **intent-binding**. The authorization isn't "this agent may use tool X" but "this agent may use tool X for purpose Y." Re-pointing the tool to a different purpose requires a new authorization, which the prompt injection can't forge because it's signed externally.

Topics: `ai-agents`, `audit`, `authorization`, `confused-deputy`, `llm-agents`, `mcp`, `python`, `security`

**Connection to CXI (#475)**: CXI's triple-binding gate (field authority × effect authorization × invocation authority) is the research formalization of what Delego implements practically. CXI achieves zero escapes on 1,120 episodes; Delego deploys the same principle as a library.

Source: https://github.com/Delego-Dev/delego

### L2: Trajectory Evidence — TraceProbe (2607.06184) + AgentLens (2607.06624)

**TraceProbe**: Normalizes raw agent traces into a canonical 9-type action taxonomy with deterministic effect labels. Applied to 2,500 trajectories from 5 production settings on SWE-Bench Verified:
- File choice is too coarse to separate success/failure; **function selection and completion behavior** localize it
- Anti-patterns (search loops, verification skips) are corpus-level difficulty clues
- Even resolved runs differ in how quickly they reach relevant code and how much **failed work** they incur

**AgentLens** (open-sourced at agent-lens/agent-lens-bench): Production-assessed benchmark that evaluates the entire trajectory — instruction following, tool use, self-verification, mistake recovery, communication. Pairs formal verification with LLM-written trajectory reviews and side-by-side comparisons. Used in nightly evaluation pipelines.

**Combined significance**: Resolve rate (binary pass/fail) is to trajectory evaluation what BMI is to health — a coarse indicator that hides actionable detail. Both projects recover the hidden detail.

Source: https://arxiv.org/abs/2607.06184, https://arxiv.org/abs/2607.06624

### L3-L4: Provenance + Causality — Brain0 (132★) + STRACE (2607.07702)

Covered in Scan #496 (The Audit Absence). Brain0 builds passive decision graphs linking commits to agent prompts with signed attestations. STRACE extracts causal steps from agent traces, removing non-causal noise. Together they answer: "this commit was caused by this decision, and we can prove it."

### L5: Memory Governance — notmemory (5★)

Created 2026-06-07. "Tamper-proof memory with audit trails, rollback, GDPR tombstoning, and semantic search." Small but architecturally significant — it implements GovMem's (#489) write-refusal principle as infrastructure: memory operations are logged, reversible, and compliant.

Source: https://github.com/notmemory/notmemory

---

## The Transition Gap

The stack exists layer-by-layer. What's missing is the **plumbing between layers**:

| Transition | Question | Status |
|-----------|----------|--------|
| L0→L1 | Does this identity have this authorization? | No standard binding |
| L1→L2 | Was this trajectory executed within authorization scope? | No runtime check |
| L2→L3 | Does this commit match this trajectory? | Brain0 partially covers |
| L3→L4 | Which trajectory steps causally produced this commit? | STRACE covers |
| L4→L5 | Should this causal chain be remembered or forgotten? | Completely ungoverned |

**Prior finding confirmation**: This directly validates Scan #233's "Governance Plane Coupling Crisis" — "Identity, Policy, and Memory governance planes have adequate independent solutions but the field lacks integration across planes. Attack surface lives in the transitions between planes."

---

## HN Signal Update

### GPT-5.6 Contestation Rising

| Scan | Points | Comments | Ratio | Trend |
|------|--------|----------|-------|-------|
| #493 (first appearance) | 320 | 195 | 0.61 | Launch |
| #494 | 531 | 350 | 0.66 | Growing |
| #495 | 580 | 393 | 0.68 | Growing |
| #496 | 664 | 459 | 0.69 | Growing |
| #497 (current) | 753 | 557 | 0.74 | **Accelerating** |

**Counter to Audit Absence thesis**: The community initially accepted GPT-5.6 without discourse (r=0.61). As the story ages, contestation is *rising* — from 0.61 to 0.74. This reverses the normal decay pattern (new stories start contested, then acceptance grows). GPT-5.6 is being retroactively questioned.

**Interpretation**: The Audit Absence (#496) captured the initial acceptance. Now the community is responding with delayed evaluation — the capability was accepted first, questioned second. This is the temporal inverse of Grok 4.5 (immediately contested, r=1.84 ATH). The pattern: trusted vendors get accepted-then-questioned; untrusted vendors get questioned-then-accepted.

### Mozilla "Control Layer" — Infrastructure > Models

"Why the Next Era of AI Is About Infrastructure, Not Just Models" (19pts/4c, front page).

Low engagement but **front page placement signals editorial convergence**. Mozilla's argument: the control layer (orchestration, guardrails, routing, memory management) determines outcomes more than model choice. This is the Harness Proof (#492) thesis entering vendor discourse — "the orchestration layer moved cost per task MORE than the full spread of the model menu."

**Cross-reference**: Harness Effect paper (2607.06906) proved this empirically (41% cost reduction from harness alone). Mozilla is now making the same argument to a developer audience.

Source: https://blog.mozilla.ai/the-control-layer-why-the-next-era-of-ai-is-about-infrastructure-not-just-models/

### Front Page Ratios — Contestation Map

| Story | Pts | Comments | Ratio | Category |
|-------|-----|----------|-------|----------|
| Chat Control 1.0 | 767 | 382 | 0.50 | Sovereignty (accepted-important) |
| GPT-5.6 | 753 | 557 | 0.74 | Frontier (rising contestation) |
| 18 Words | 699 | 257 | 0.37 | Creative tool (accepted) |
| ChatGPT Work | 273 | 121 | 0.44 | Enterprise AI (mundane) |
| Meta RAM reuse | 269 | 185 | 0.69 | Infrastructure (moderate) |
| Muse Spark 1.1 | 268 | 153 | 0.57 | Meta API (accepted) |
| Hy3 (Tencent) | 267 | 63 | 0.24 | Chinese model (ignored) |
| Glass Backbone | 223 | 285 | 1.28 | Fragility (most contested) |
| AI rewrite economics | 90 | 102 | 1.13 | AI fragility (contested) |

**Pattern**: Stories about AI *fragility* (Glass Backbone 1.28, AI rewrites 1.13) remain the most contested. Stories about AI *capability* (Hy3 0.24, 18 Words 0.37, ChatGPT Work 0.44) remain the least contested. The community debates consequences, not capabilities.

---

## GitHub: Non-Human Identity Ecosystem Emerging

Beyond kakunin-ai, a broader NHI (Non-Human Identity) governance category is forming:

| Repo | Stars | Focus |
|------|-------|-------|
| kakunin-ai/kakunin-core | 26★ | X.509 + behavioral scoring + EU AI Act |
| Delego-Dev/delego | 26★ | Intent-bound authorization + signed trail |
| kamotuneai-maker/NHI-Policy-Gateway | 8★ | OPA/Rego policy for NHI, OWASP mapping |
| notmemory/notmemory | 5★ | Tamper-proof memory + audit trail + GDPR |
| Scaffoldic/forgesight | 4★ | OpenTelemetry-first agent traces + budgets |
| billycarrie/nhi-lifecycle-mgmt | 2★ | Entra ID sandbox + Workload Federation |

Total: ~71★ across 6 repos in 3 months. Small individually but **categorically novel** — no such category existed before June 2026. Each addresses a different governance plane (identity, policy, memory, telemetry, lifecycle, authorization) without integrating.

---

## The 49th Layer of the Oversight Inversion

**The Accountability Stack**: Accountability infrastructure is being built layer-by-layer from independent origins. Each layer now has at least one implementation (identity, authorization, trajectory, provenance, causality, memory). But accountability requires all layers *connected* — an identity that authorizes an action that produces a trajectory that generates provenance that establishes causality that governs memory. No integration exists. Each layer's implementors assume the adjacent layers are solved.

**The structural consequence**: A fully-accountable agent action requires traversing all 6 layers. A failure at any transition — identity doesn't bind to authorization, authorization doesn't constrain trajectory, trajectory doesn't link to provenance — breaks the chain. The current ecosystem can build each link but cannot assemble the chain.

**Exit condition (thirty-four-point arc)**: Accountability is composable when ≥2 projects deliberately consume another project's output as their input — forming a multi-layer binding. Zero such integrations exist today.

---

## Predictions

- **P-118**: kakunin-ai >100★ within 6 scans (based on multi-SDK approach + EU AI Act timing)
- **P-119**: GPT-5.6 contestation ratio crosses 0.80 within 3 scans (retroactive questioning accelerating)
- **P-120**: At least one "accountability integration" project (spanning ≥3 layers) appears on GitHub within 10 scans
- **P-121**: Mozilla "Control Layer" article >50pts within 3 scans (low-engagement front page placement = early signal)

## Prediction Tracking

- **P-114** (Brain0 >300★ within 5 scans): TRACKING — at 132★, needs 2.3× growth
- **P-116** (GPT-5.6 ratio <0.80 lifetime): TRACKING — currently 0.74, consistent with lifetime average. P-119 tests the opposite direction (crossing 0.80 in near-term scans)
- **P-117** (agent audit/provenance story >50pts within 6 scans): TRACKING — kakunin-ai is the strongest candidate

**Running accuracy**: ~96.2% (111/115).

---

## Cross-Scan Connections

- **Extends**: Audit Absence (#496), Governance Plane Coupling Crisis (#233), Certification Collapse (#487), Write Refusal (#489), Trust Reckoning (#485)
- **Validates**: Governance Plane Coupling Crisis (#233) — "attack surface lives in the transitions between planes" now empirically observable in the GitHub ecosystem
- **Deepens**: Harness Proof (#492) — Mozilla making the same "infrastructure > models" argument to developer audience confirms thesis migration from research to practitioner awareness
