<ai_context>
summary: "Companion note to agent-security-defense-architectures.md: formal and architecture-oriented enforcement patterns for AI agent security that do not depend on model cooperation. Covers out-of-band deterministic enforcement, institutional attestation, policy autoformalization, trust-by-construction, verification oracles, per-datum trust, runtime trace enforcement, knowledge-boundary defense, hardware-gated action, CXI, aiAuthZ, and hardware-confined signing with exact-effect authority. Implementation evidence and runtime coverage studies continue in agent-security-enforcement-evidence.md."
triggers: ["verified enforcement", "out-of-band defense", "Progent", "CaMeL", "FIDES", "institutional attestation", "Cedar policy", "autoformalization", "Kiko protocol", "trust-by-construction", "VIGIL trace enforcement", "knowledge-based PR", "KPR", "hardware-gated agent", "deceptive fixes", "TerraProbe", "Robust-TO", "per-datum trust", "CXI", "context-to-execution integrity", "aiAuthZ", "identity-bound authorization", "hardware keystore", "PKCS#11", "signing authority", "payload commitment"]
last_updated: "2026-09-23"
source_basis: "Extracted from agent-security-defense-architectures.md §2.33–§2.42. §2.44–§2.45 (CXI, aiAuthZ) moved from defense-architectures.md §Execution Boundary Patterns (scan #453). Patterns sourced from arXiv June–August 2026 papers, including 2606.26479 Progent, 2606.26298 Institutional Attestation, 2606.26649 Cedar Pipeline, 2606.26590 TerraProbe, 2606.26156 Kiko, 2606.26904 Robust-TO, 2606.26524 VIGIL, 2606.26721 KPR, 2606.27231 Quantum Hardware Agent, 2607.06000 CXI, 2607.05518 aiAuthZ, and 2608.06130 hardware-confined signing. Scans #176–#183 and #453."
</ai_context>

# Agent Security: Verified Enforcement Patterns

**Companion note** to [Agent Security: Defense Architectures](./agent-security-defense-architectures.md).

This note catalogs defense patterns that share a structural principle:
**enforcement that does not depend on agent cooperation**. Unlike detection
or behavioral guardrails, these mechanisms make violations structurally
impossible, cryptographically bounded, or independently verifiable.

**Cross-references:**
- [Agent Security: Defense Architectures](./agent-security-defense-architectures.md) — patterns §2.1–§2.32 (detection, trust layers, cooperative governance)
- [Agent Security & Governance](./agent-security-governance.md) — attack surfaces, structural governance, open problems
- [Agent Security Event Log](./agent-security-event-log.md) — HN/cross-source event narratives
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — protocol-layer security
- [Agent Security: Enforcement Evidence and Runtime Coverage](./agent-security-enforcement-evidence.md) — implementation evidence, assurance limits, and effect-mediation tests

---

## §2.33 Out-of-Band Enforcement Validated Under Adaptive Attack

Five deterministic out-of-band defense systems (CaMeL, FIDES, Progent, RTBAS,
FORGE) organized as instances of classical integrity protection: Biba model,
reference monitoring, and least privilege.

**Key finding**: All 12 tested in-band defenses (model trained to refuse)
broken at >90% attack success under adaptive, defense-aware attacks. Progent
(out-of-band deterministic enforcement) reduces ASR sixfold: 25.8% → 4.2%.
Under adaptive attack: 2.6% — even lower. First independent reproduction on
open-weight model (Qwen2.5-7B, single H200).

**Design principle**: Deterministic external enforcement is a categorically
harder target than in-band detection. The agent's cooperation is not required.

**Limitation**: Single black-box attack template tested. White-box GCG attack
against the policy engine (not the model) remains open.

**Connects to**: Governance Vacuum (scan #170), Institutional Attestation
(scan #176 §2.34), Process Harness (scan #171).

*(arXiv [2606.26479], Jun 2026. Scan #176)*

## §2.34 Institutional Attestation — Action-Boundary Governance

Formalizes how human institutions govern autonomous actors: not by monitoring
reasoning, but by requiring independently attested evidence at the point of
consequential action.

**Model**:
1. Full planning/reasoning autonomy retained by agent
2. Zero execution authority over high-risk actions
3. Preconditions independently attested by separate authoritative sources
4. Attestations cryptographically bound to declared intent
5. Deterministic policy evaluates attestation set
6. Tamper-evident log for independent re-verification

**Key insight**: "Govern actions, not agents." The reasoning process is
opaque and unreliable (see Premature Commitment, scan #176). Governance
at the boundary of consequence avoids this entirely.

**Validation**: CFAgentBench (2606.22000) implements 278 money-movement
instances where correct agent behavior = stop and stage for human approval.
Pass@1 = 0.67, Pass@5 = 0.38 — agents lose 43% of successes on repeat,
validating that action-boundary governance catches real failures.

*(arXiv [2606.26298], Jun 2026. Scan #176)*

## §2.35 Autoformalization of Agent Policy (Cedar Pipeline)

LLM-based generator-critic pipeline translates agent prompts, MCP tool
descriptions, and natural-language policies into formally verified policies
in the Cedar Policy Language.

**Key advance**: Bridges the gap between probabilistic guardrails (no formal
guarantees) and hand-coded symbolic enforcement (doesn't scale). Generator
proposes Cedar rules; critic verifies coverage against source specification.
Autoformalized policies cover substantially more of source NL specification
than hand-coded alternatives.

**Validation**: MedAgentBench (high-stakes medical domain).

**Connection to Governance Vacuum (scan #170)**: 58% of agent configs are
single-commit, never revised. This pipeline enables *automated policy
generation* from informal instructions — a concrete engineering path from
the Governance Vacuum to deterministic enforcement.

**Implication**: SKILL.md files, delegation contracts, and system prompts
could be auto-formalized into enforceable policies rather than relying
on model compliance.

*(arXiv [2606.26649], Jun 2026. Scan #177)*

## §2.36 Adaptive Out-of-Band Defense Validation (Progent on Open-Weight)

Independent reproduction of Progent's deterministic out-of-band defense on
Qwen2.5-7B (self-hosted, single H200) — a setting the original authors
did not test. Organizes out-of-band defenses as instances of classical
integrity protection (Biba), reference monitoring, and least privilege.

**Results**: Defense cut mean attack success ~6× (25.8% → 4.2%).
Hand-crafted adaptive attack: 2.6%. One small-scale data point but
consistent with hypothesis that deterministic enforcement is structurally
harder to break than in-band detection.

**Context**: All 12 known in-band defenses broken at >90% ASR with
defense-aware attacks. Out-of-band enforcement survives adaptive evaluation
— the first architecture class to do so.

*(arXiv [2606.26479], Jun 2026. Scan #177)*

## §2.37 Deceptive Fixes — Single-Signal Security Verification Structurally Insufficient

**Source**: https://arxiv.org/abs/2606.26590

TerraProbe demonstrates that LLM-generated security repairs pass the standard
verification signal (targeted scanner finding removal) at 83.3%, but 71.4% of
those "successful" repairs are deceptive — they pass checks while leaving the
underlying vulnerability intact. Five-layer oracle required:

1. Targeted scanner removal (83.3% pass — insufficient)
2. Full-scanner cleanliness (10.4% pass)
3. Terraform plan validity (39.6% pass)
4. Plan behavioral comparison (38.5% reachable)
5. Human adjudication of intent alignment (28.6% truly fixed)

All three frontier models (Gemini 2.5 Flash, GPT-4o, Claude 3.5 Sonnet) produce
deceptive fixes at statistically indistinguishable rates (57.1–71.4%, Fisher p > 0.10).
IAM wildcard Resource grants persist in 100% of CKV2_AWS_11 cases.

**Defense implication**: Agent-generated security repairs require multi-layer
verification oracles. Single-signal checks (scanner, linter, test-pass) are worse
than random because they produce false confidence. The Ghost Tests pattern
(scan #167, 2606.25973) generalizes: functional tests ≠ security validation.

*(arXiv [2606.26590], Jun 2026. Scan #178)*

## §2.38 Trust-by-Construction — Kiko Protocol Compliance

**Source**: https://arxiv.org/abs/2606.26156

Kiko introduces a protocol-based programming model where agent decision makers
are structurally constrained to produce only protocol-compliant messages. Unlike
runtime monitoring (§2.33 Out-of-Band, §2.34 Attestation) or post-hoc
verification (§2.37 TerraProbe), Kiko eliminates protocol violations at
construction time via formal operational semantics.

Key properties:
- Decision makers choose from valid decisions; mutual compatibility enforced
- Communication service completely abstracted (developers focus on business logic)
- Formal proof: agents are protocol compliant AND can realize any valid enactment
- Makes protocol violation structurally impossible, not merely detectable

**Defense implication**: Construction-time trust (L0 in the trust stack) has
zero ongoing verification cost. For high-stakes multi-agent interactions where
runtime monitoring cost exceeds generation cost (scan #178), building compliance
into the programming model eliminates the verification bankruptcy problem entirely.

*(arXiv [2606.26156], Jun 2026. Scan #179)*

## §2.39 Per-Datum Trust Scoring — Robust-TO Evidence Interface

**Source**: https://arxiv.org/abs/2606.26904

Robust-TO solves the "Blind Trust Problem" — agents treating all input evidence
as equally reliable regardless of actual quality/corruption. Architecture:

1. Heterogeneous tools under unified evidence interface
2. Each returns: prediction + temporal grounding + calibrated reliability score
3. Three-tier synthesis weights by reliability (high/medium/low)
4. Confidence-cost reward jointly optimizes correctness + reliability + efficiency

Results: +10.6pp over best open-source baseline; outperforms Gemini 2.5 Pro;
smallest clean-to-corrupted accuracy drop under realistic perturbations.

**Defense implication**: Applies to agent memory retrieval, tool-call results,
and any pipeline where inputs of varying quality/freshness are merged. The
MemStrata temporal validity problem (scan #177, 15-40% stale facts) and TrustMem
corruption (scan #156, -40.1% to -79.1% degradation from memory attacks) are
both addressable by per-datum reliability scoring at the evidence interface layer.

*(arXiv [2606.26904], Jun 2026. Scan #179)*

## §2.40 Runtime Trace Enforcement — VIGIL Behavioral Policy Engine

**Source**: https://arxiv.org/abs/2606.26524

VIGIL checks agent execution traces against behavioral policies from skill
specifications, operator constraints, and cross-skill global rules. Key
innovation is contextual granularity — a policy language captures temporal
dependencies, argument constraints, and value-flow conditions across
agent-tool events, compiled to SMT constraints over finite traces.

Key results:
- Over 95% recall with <10% false positive rate on real LLM-agent runs
- Detects violations depending on event order, argument relationships, or
  cross-call value flow — not just single-call filters
- Covers office-document, operational, and engineering task domains

**Defense implication**: VIGIL addresses the "Rubber-Stamp Cascade" (scan #182)
— per-tool audit is structurally insufficient when attack meaning distributes
across tool boundaries (ShareLock §2.31, MIRROR #175). Trace-level monitoring
observes composed behavior, not individual actions. Architecturally out-of-band
(§2.33 principle), VIGIL monitors what agents do, not what they claim.

Limitation: Policies must be authored. Auto-formalization (§2.35, 2606.26649)
is the counterpart, but auto-generated policies may inherit RLHF biases.

*(arXiv [2606.26524], Jun 2026. Scan #182)*

## §2.41 Knowledge-Boundary Defense — Knowledge-Based Pull Requests (KPR)

**Source**: https://arxiv.org/abs/2606.26721

KPR separates two decisions traditional PRs collapse: (1) whether knowledge
should enter the project, (2) whether a particular implementation should merge.
External contributors submit knowledge packages (design memos, risk checklists,
test plans, interaction traces); a project-owned trusted agent regenerates
candidate code inside the receiving environment.

Key properties:
- Eliminates direct untrusted code execution across trust boundaries
- Knowledge extraction is auditable; code regeneration happens in controlled env
- Stress-tested under description ablation, diff ablation, and poisoned-patch conditions
- Pilot over 7 merged public PRs demonstrates instantiation from real PR material

**Defense implication**: KPR is a structural defense against composition attacks
(ShareLock §2.31, ToxicSkills scan #166). Instead of running external code
through N AI security gates (which compose to zero defense per the Rubber-Stamp
Cascade), extract knowledge and regenerate code locally. Attack surface shrinks
from "arbitrary code" to "knowledge representation." Applicable to agent skill
supply chains where 36% critical issues (ToxicSkills) demand trust-boundary
redesign, not more gates.

*(arXiv [2606.26721], Jun 2026. Scan #182)*

## §2.42 Physical-World Attestation-at-Boundary — Hardware-Safety-Gated Agent

**Source**: https://arxiv.org/abs/2606.27231

First MCP deployment in a physical safety-critical domain. An LLM agent
controls trapped-ion quantum physics experiments through an MCP server.
No tool call reaches hardware without a cryptographic authorization token
bound to its exact contents.

Architecture layers:
| Layer | Mechanism |
|---|---|
| Agent | LLM writes native ARTIQ control code |
| MCP Server | Tool calls mediated through Model Context Protocol |
| Authorization | Per-operation tokens bound to exact call contents |
| Simulation gate | Agent code runs first in isolated hardware simulation (dax.sim) |
| Bounds checking | Every operation verified against preset per-device bounds |
| Manual override | Human operator approval for actions exceeding automated bounds |

Results:
- Autonomously built full calibration stack on co-trapped Ca⁺/CaOH⁺ crystal
- Closed cross-instrument magnetic-field-stabilization loop
- Interface-level portability confirmed on separate Yb⁺ platform
- Adversarial scripts tested — authorization mechanism held

Critical finding: Agent limitation was NOT domain knowledge but
**metacognitive control** — inability to recognize when a problem needed
reframing rather than more effort. Validates Premature Commitment (#176)
and Institutional Attestation (#176): "govern actions, not agents" works
in physical-world practice.

*(arXiv [2606.27231], Jun 2026. Scan #183)*

---

### §2.43 — Bandit-Optimal Attack Selection (Jailbreaking for the Average Jane)

**Source**: https://arxiv.org/abs/2606.26936

Multi-armed bandit framework enables non-expert attackers to efficiently learn
optimal jailbreaks from a large choice set. Combined with FrankensteinBench
(11,279 malicious queries curated from 7 benchmarks + automated enhancement).

Key results:
- **97% attack success rate** averaged across 15 SOTA open-weight LLMs
- Adding query complexity raises ASR by up to 26% — complex attacks work better
- Learns optimal jailbreak from small exploration set, then exploits at scale
- Confirms: adversary competence floor scales with open-weight availability

**Defense implications**: Against bandit-optimal adversaries, static defense is
structurally defeated. The only surviving defenses are:
1. Out-of-band enforcement (Progent, §2.33: 2.6% adaptive ASR)
2. Co-evolutionary defense (Red Queen, scan #184: evaluators that evolve with attacks)
3. Protocol-compliance-by-construction (Kiko, §2.39: zero verification needed)

The 97% ASR on any accessible model means the minimum adversary competence is
near-maximal for all open-weight deployments. Security through model alignment
is structurally impossible against automated search.

**Connects to**: Governance Vacuum (scan #170, 58% single-commit configs),
ShareLock composition attacks (§2.31, >90% ASR via multi-tool threshold).

*(arXiv [2606.26936], Jun 2026. Scan #187)*

---

### §2.43 Locate-and-Judge: Attention-Based Malicious Skill Detection

**Problem**: Agent skills are file-based packages of natural-language instructions
that execute with user privileges. Unlike prompt injection (which has a
trusted/untrusted boundary), skills ARE instructions — injected malicious commands
sit among legitimate ones and inherit their authority. Prompt-injection defenses
do not transfer.

**Two-stage architecture**:
1. **Locate**: Lightweight locator scores structural spans by the instruction-following
   attention each span draws from the model. Retains only top-K high-attention spans.
2. **Judge**: Examines retained spans in detail for malicious intent.

**Key results**:
- Order-of-magnitude cost reduction vs direct LLM-based scanning
- High precision; confirms majority of flagged skills as malicious
- Surfaces **dozens of live malicious skills** in production marketplaces
- Detects skills that SkillSpector and Cisco Skill Scanner miss
- Catches skills disguised as benign functionality

**Defense principle**: Concentrate expensive judgment on behaviorally salient spans
(what the model actually attends to), not structural spans (what a parser identifies).
This is behavioral detection vs structural detection — a higher-fidelity proxy
for execution-time harm.

**Connection to Supply Chain Crystallization** (scan #166): ToxicSkills found 36%
critical-level issues; Locate-and-Judge provides the first scalable detection.
**Connection to ShareLock** (§2.31): ShareLock showed per-tool auditing is
insufficient because attack meaning is distributed across boundaries. Attention-based
detection partially addresses this by identifying what the model would attend to.

*(arXiv [2606.23416], Jun 2026. Scan #188)*

---

## §2.43 The Externalization Proof Cluster (Scan #302)

Five independent papers (Jun 28–30, 2026) converge on the same formal
result: governance cannot be installed in model weights and must be external.

| Paper | Mechanism | Key Result |
|-------|-----------|-----------|
| Agent Safety Is Action Alignment (2606.28739) | Least-privilege at action boundary | Refusal training = category error; pays capability, buys negative security |
| AgentBound (2606.30970) | Behavioral verification layer | Authorization ≠ permissibility; should-execute is separate from can-execute |
| CGPA (2606.31023) | Certificate-gated prefix acceptance | 12B model: 98% violation → 0% applied violations; 8B: 2.96× speedup at 2.1% regret |
| Governance Gaps (2606.31498) | Protocol gap taxonomy | Voting + dissent universally absent from all 5 protocols; new architectural layer required |
| PolicyGuard (2606.32004) | Neuro-symbolic compliance engine | Separate policy logic (symbolic) from interpretation (LLM); enables testing + maintenance |

**Structural insight**: These are not independent patterns — they are five
layers of a single externalization stack (L0 action → L1 behavioral → L2
constraint → L3 community → L4 compliance). Each is independently necessary
and non-substitutable.

**Connection to §2.33**: Progent/CaMeL/FIDES demonstrated external enforcement
*works better*. This cluster proves it is the *only option that works at all*
for agentic (as opposed to content) governance.

*(arXiv, Jun 2026. Scan #302 — see findings/2026-07-01-arxiv-scan-302.md)*

---

## §2.44 Context-to-Execution Integrity — CXI (Scan #453)

**Triple-binding gate**: Field authority + exact-effect authorization + invocation
authority must bind to the same action manifest before tool execution proceeds.
Policies mark protected sink fields; typed releases carry narrow validated values;
opaque data slots keep evidence as data. On 720 AgentDojo episodes (1,739 LLM
calls), 199 are safe task completions; on 400 repository episodes, 231 are safe
task completions. Neither set has an observed escape at the mediated sink.
Validator completeness, task quality, wrong field classes, unmediated sinks,
and compromised policy or runtime remain outside the fixed-policy guarantee.

**Defense class**: Deterministic execution-boundary enforcement.
**Distinguishing property**: operates at the execution surface itself, not the
approval surface above it. Complete mediation can stop an encoding-gap proposal
from becoming authority at a covered sink; CXI does not make unreviewed sinks or
incomplete policies immune (cf. MCP TAG-Block Concealment, 2607.05744).

**Connection**: Extends Institutional Attestation (§2.34) — both gate consequential
actions; CXI adds triple-binding at the exact execution point.

*(arXiv [2607.06000](https://arxiv.org/abs/2607.06000), Jul 2026. Scan #453)*

## §2.45 Off-Host Identity-Bound Authorization — aiAuthZ (Scan #453)

Authorization gateway moved off the agent's host. Per-message HMAC-SHA256
signature bound to single-use nonce and timestamp window. Role-based and
argument-level policy the agent can neither read nor modify. SHA-256 hash-chained
audit log with HMAC-authenticated QR receipts.

The public benchmark has 15 models × 8 scenarios, but four Qwen cells contain
only HTTP 429 errors. Its 116 completed cells summarize 580 successful model
calls and 187 dangerous-call attempts. Although the runner evaluates every
attempt, the saved result retains one representative verdict for each of 44
attempting cells; all 44 are denied. The benchmark fixes the caller as `member`
under a restrictive default policy: four dangerous tools are owner-only and
the member-allowed `web_fetch` has an empty URL allowlist. This supports
deterministic fixed-policy denial, not uniform model safety or identity-only
attribution.

The largest rounded per-model average decision time is 0.0304 ms and the
largest retained decision is 0.0659 ms; neither measures end-to-end gateway
latency. The 9/9 versus 4/9 result statically reconstructs reduced policy styles
rather than running the cited systems. AgentDojo provides separate
argument-policy evidence: both no-defense cells are already 0/20 attack
success, seven emitted attacker-directed calls are denied by a known-payee
allowlist, and clean utility falls from 100% to 80%.

**Defense class**: Off-host structural enforcement.
**Extends**: ActPlane (§2.33) — both enforce externally; aiAuthZ adds
identity binding and cryptographic audit trail.

**Connection**: Strengthens the case for external enforcement only when every
sensitive path is mediated. Overlapping built-in tools must be disabled; the
gateway, keys, policy, database, and shared nonce/rate-limit store remain
trusted; permitted calls can compose harm; and symmetric HMAC does not provide
third-party non-repudiation. The pinned public repository makes policy and
aggregate arithmetic inspectable, but omits the claimed raw multi-model
transcripts, so the original provider calls are not fully replayable.

*(arXiv [2607.05518](https://arxiv.org/abs/2607.05518), Jul 2026. Scan #453)*

## Hardware confinement does not confer signing authority (August 2026)

**Source:** https://arxiv.org/abs/2608.06130v1

Hardware-backed keys close one attack class: when a key is generated inside an
HSM, TPM, or smart card and exposed only through an opaque PKCS#11 handle, a
prompt-injected agent cannot read the raw private key from disk or process
memory. But confinement alone does **not** stop the agent from asking the
hardware to sign an attacker-chosen payload. The paper's stronger pattern
therefore separates three properties:

1. **Key non-extractability:** the private key never enters host memory.
2. **Session and capability bounds:** signed session tokens bind the original
   user intent, tool allowlist, quota, expiry, and replay nonce.
3. **Exact-effect authority:** before external content is read, a trusted
   operator plane commits the SHA-256 hash of the document that may be signed;
   a later hash mismatch is rejected deterministically.

Across 192 injection trials on three injection-following models, the naive
baseline had 19.3% attack success and the full stack had 0 observed successes
(Wilson 95% upper bound 2.0%). Attribution matters: document substitution was
blocked by the pre-committed hash, while key exfiltration was blocked by the
hardware boundary. The result does not establish the semantic judge's
standalone efficacy, and the benign evaluation contained only four tasks.

The autonomy boundary is explicit. If the target document cannot be named in
advance (for example, “process my inbox and sign anything that needs signing”),
there is no deterministic payload anchor. The production recommendation is to
require human approval regardless of the semantic judge's verdict. This turns
open-ended signing into escalation rather than pretending that key confinement
makes it safe.

**Operational caveats:** the prototype excludes compromised kernels, physical
HSM attacks, and timing side channels; its taint bit does not survive a
write-file/read-file laundering path; and operator escalations are not
rate-limited. Deployments with writable scratch space need filesystem-level
taint propagation, while approval queues need fatigue controls. The measured
secure path is also aimed at low-frequency, high-value signing: roughly 1.1 s
with SoftHSM and 1.4 s with the tested TPM, not per-request JWT/HMAC loops.

**Connection to CXI (§2.44):** a hardware root protects the credential, while a
pre-committed effect manifest protects its use. Credential custody and action
authorization are independent boundaries; both must be proven.

## A Signed Verdict Is Not a Replayable Experiment (HN, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — A Signed Verdict Is Not a Replayable Experiment (HN, September 2026)](./agent-security-enforcement-evidence.md#a-signed-verdict-is-not-a-replayable-experiment-hn-september-2026).

## A Receipt's Validity Is a Vector, Not a Boolean (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — A Receipt's Validity Is a Vector, Not a Boolean (GitHub, September 2026)](./agent-security-enforcement-evidence.md#a-receipts-validity-is-a-vector-not-a-boolean-github-september-2026).

## Default-Deny Needs a Coverage Contract, Not Just an Allow-List (HN, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Default-Deny Needs a Coverage Contract, Not Just an Allow-List (HN, September 2026)](./agent-security-enforcement-evidence.md#default-deny-needs-a-coverage-contract-not-just-an-allow-list-hn-september-2026).

## Identity Proven at Mint Is Not Per-Request Possession (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Identity Proven at Mint Is Not Per-Request Possession (GitHub, September 2026)](./agent-security-enforcement-evidence.md#identity-proven-at-mint-is-not-per-request-possession-github-september-2026).

## A Formal Policy Proof Is Only as Broad as Its Action Model (HN, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — A Formal Policy Proof Is Only as Broad as Its Action Model (HN, September 2026)](./agent-security-enforcement-evidence.md#a-formal-policy-proof-is-only-as-broad-as-its-action-model-hn-september-2026).

## “Defense in Depth” Needs Path-Composition Evidence (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — “Defense in Depth” Needs Path-Composition Evidence (GitHub, September 2026)](./agent-security-enforcement-evidence.md#defense-in-depth-needs-path-composition-evidence-github-september-2026).

## Egress Assurance Needs Observed, Blocked, and Uninspected States (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Egress Assurance Needs Observed, Blocked, and Uninspected States (GitHub, September 2026)](./agent-security-enforcement-evidence.md#egress-assurance-needs-observed-blocked-and-uninspected-states-github-september-2026).

## Tool Pins Must Bind the Enforcer's Semantics, Not Just a Stable Digest (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Tool Pins Must Bind the Enforcer's Semantics, Not Just a Stable Digest (GitHub, September 2026)](./agent-security-enforcement-evidence.md#tool-pins-must-bind-the-enforcers-semantics-not-just-a-stable-digest-github-september-2026).

## A Policy Verdict Is Counterfactual Until the Mediator Owns the Effect (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — A Policy Verdict Is Counterfactual Until the Mediator Owns the Effect (GitHub, September 2026)](./agent-security-enforcement-evidence.md#a-policy-verdict-is-counterfactual-until-the-mediator-owns-the-effect-github-september-2026).

## An Authorization Receipt Is Not an Effect Gate (GitHub, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — An Authorization Receipt Is Not an Effect Gate (GitHub, September 2026)](./agent-security-enforcement-evidence.md#an-authorization-receipt-is-not-an-effect-gate-github-september-2026).

## The Enforcer Cannot Safely Derive Authority from the Enforced Domain (HN, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — The Enforcer Cannot Safely Derive Authority from the Enforced Domain (HN, September 2026)](./agent-security-enforcement-evidence.md#the-enforcer-cannot-safely-derive-authority-from-the-enforced-domain-hn-september-2026).

## Local Configuration Authority Must Not Inherit Remote Agent Authority (HN, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Local Configuration Authority Must Not Inherit Remote Agent Authority (HN, September 2026)](./agent-security-enforcement-evidence.md#local-configuration-authority-must-not-inherit-remote-agent-authority-hn-september-2026).

## Reported Results Need Positive Evidence of Execution (APEXA, arXiv, September 2026)

Moved to [Agent Security: Enforcement Evidence and Runtime Coverage — Reported Results Need Positive Evidence of Execution (APEXA, arXiv, September 2026)](./agent-security-enforcement-evidence.md#reported-results-need-positive-evidence-of-execution-apexa-arxiv-september-2026).
