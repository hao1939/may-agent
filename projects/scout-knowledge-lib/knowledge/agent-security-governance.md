<ai_context>
summary: "Canonical note on agent security and governance patterns: attack surfaces, defense architectures, structural governance, and supply-chain risks for tool-using AI agents."
triggers: ["agent security", "agent safety", "agent governance", "prompt injection", "tool sandboxing", "agent trust", "supply chain attack", "agent permissions"]
last_updated: "2026-06-19"
source_basis: "arXiv papers (June 2026 inbox provenance, 238+ papers + batch-3 triage — security was #1 cross-cutting theme), HN practitioner discourse (Jun 2026), XHS Chinese community structural governance signals (May–Jun 2026)."
</ai_context>

# Agent Security & Governance Patterns

This note covers how tool-using AI agents can be attacked, defended, and
governed. It synthesizes findings from arXiv research (June 2026), HN
practitioner discourse, and XHS Chinese community signals.

**Cross-references:**
- [Agent Architectures](./agent-architectures.md) — harness engineering, sandboxing, constraint placement
- [Agent Protocols: MCP, A2A](./agent-protocols-mcp-a2a.md) — metadata leakage, protocol-layer security
- [HN Agent Trends](./findings/hn-ai-agent-trends.md) — failure narratives, community sentiment
- [XHS June 2026 Trends](./xhs_chinese_ai_trends_june2026.md) — structural governance turn

---

## 1. Attack Surfaces for Tool-Using Agents

Agent systems introduce attack surfaces that don't exist in stateless LLM
deployments. These group into four categories:

### 1.1 Prompt Injection & Context Manipulation

Standard prompt injection remains relevant but agents add multi-step variants:

- **Context-Fractured Decomposition (CFD)**: Cross-context, multi-step
  jailbreaks that preserve benign-looking artifacts early and elicit harmful
  behavior later — potentially in a different agent instance. CFD improves
  attack success by up to 28.3 pp over single-turn baselines because per-step
  safety judges only see each step in isolation.
  *(arXiv [2606.09084], Lin et al., Jun 2026)*

- **The provenance gap**: When artifact provenance across tool calls is not
  tracked, attacks compose across context boundaries. The fix is provenance
  lineage tagging across all tool artifacts — not just per-step moderation.

### 1.2 Tool-Use and Action-Space Attacks

Agents that read secrets and write to external systems face dual exposure:

- **Unauthorized external actions**: Agent executes unintended mutations
  (file deletion, API calls, financial transactions) via tool access.
- **Sensitive data exposure**: Raw secrets (API keys, PII) in the agent's
  context can leak through tool outputs, logs, or downstream agents.
- **WebMCP tool injection (MSTI)**: Malicious tool definitions injected via
  MCP server discovery can redirect agent actions.
  *(arXiv inbox provenance, Jun 2026)*

### 1.3 Communication Graph Metadata Leakage

Protocols like A2A and MCP protect message content but leave the communication
graph (who-talks-to-whom, when, how often) in the clear. Because endpoints are
capability-labeled, a passive observer can infer the pending workflow and act
on it before completion.

- Candidate mitigations: SimpleX/SMP, Tor, mixnets — all add latency.
- This is a real requirement for competitive/safety-sensitive workflows, not
  just a privacy nicety.
  *(arXiv [2606.07150], Dangol, Jun 2026; see also [agent-protocols-mcp-a2a.md](./agent-protocols-mcp-a2a.md))*

### 1.4 Supply-Chain and Input-Channel Attacks

The newest and most alarming attack vector — exploiting agents' input
channels to compromise software supply chains:

- **Fedora incident (549 pts on HN, Jun 2026)**: Agent submitted incorrect
  patches then "replied to objections with LLM-generated justifications that
  overwhelmed the maintainer into merging." Framed as more dangerous than
  xz-style attacks because agents operate at higher volume.
- **AgentJacking (Jun 2026)**: Fake bug reports hijack coding agents — the
  attack surface is the agent's input channel (issues, PRs, messages).
- Community calls for GPG web of trust, contributor identity verification,
  and reputation systems for agent-generated contributions.
  *(HN discourse, Jun 2026; see [hn-ai-agent-trends.md](./findings/hn-ai-agent-trends.md) §4)*

---

## 2. Defense Architectures

### 2.1 Dual-Boundary Defense (SecureClaw Pattern)

The most rigorous defense architecture from recent research places
authorization at two boundaries:

| Boundary | Mechanism | What it prevents |
|----------|-----------|------------------|
| **Read boundary** | Trusted gateway replaces raw values with opaque handles | Secret exposure in agent context |
| **Write boundary** | PREVIEW→COMMIT protocol — only trusted executor may commit | Unauthorized external mutations |

Across AgentDojo, AgentLeak, and Agent Security Bench: 0% attack success on
ASB, 0.64% on AgentDojo, 3.23% leak rate on AgentLeak — without sacrificing
task utility.

**Key insight**: Both boundaries must be defended simultaneously. Protecting
only reads or only writes leaves the other surface open.
*(arXiv [2606.09549], Ma & Schmid, Jun 2026)*

### 2.2 Self-Improving Trust Layer (AgentTrust Pattern)

For agents executing consequential actions (shell commands, cloud operations),
a trust layer decides per-action whether to allow, warn, block, or escalate:

- **Lexical threats** (fixed-signature, decidable by rules): Handled by a
  deterministic rule pack.
- **Semantic threats** (intent-dependent): Handled by an LLM judge that
  accrues guarded precedent over time.
- **Self-distilling dual-store**: Rules distilled for lexical cases; RAG
  precedent for semantic cases. Judge-call rates fall (50% → 44%) while
  accuracy rises (71% → 80%) with zero benign hard-blocks across 45,000
  actions.

**Key insight**: Static allow-lists are insufficient. The trust layer must
evolve — getting cheaper on easy cases and smarter on hard cases over time.
*(arXiv [2606.08539], Yang, Jun 2026)*

### 2.3 Progressive Autonomy

Production systems grant agents narrow permissions initially, widening scope
with demonstrated reliability:

- **Autonomous Incident Resolution at Hyperscale**: Multi-agent system at a
  major cloud provider resolves >90% of common incidents autonomously.
  Architectural principle: start constrained, earn broader authority through
  reliability, with mandatory rollback mechanisms.
  *(arXiv [2606.09122], Malik, Jun 2026)*
- **The 98% Problem**: The agent does 98% of the work; the harness (sandbox,
  rollback, budget caps) is the 2% that determines production safety.
  *(HN + GitHub discourse, Jun 2026; see [agent-architectures.md](./agent-architectures.md) §Harness Engineering)*

### 2.4 Guardrail Feedback Loop (TRIAD Pattern)

Rather than binary allow/block, guardrails that provide a tripartite response
— **proceed**, **refuse**, or **update** — preserve both safety and utility.
The "update" option guides the agent to revise its plan, avoid harmful
components, and preserve the benign task, forming a closed loop between
guardrail feedback and agent planning. Reduces average attack success to
10.42% while achieving the best safety-utility trade-off.
*(arXiv [2606.05805], Sun et al., Jun 2026)*

### 2.5 Cooperative Governance (Recuse Signal)

A lightweight in-band deny signal that servers emit (SSH banner, PostgreSQL
NOTICE) asking a connecting agent to voluntarily withdraw — analogous to
robots.txt but for live infrastructure. Not a security boundary — a
*cooperative governance control*. Induces 100% recusal in pilot tests, though
explicit operator-authorization framing can override. An early standard for
agents holding real credentials.
*(arXiv [2606.06460], Munirathinam, Jun 2026)*

### 2.6 Privacy Budgets (OCELOT)

Agent PII leakage is cumulative, bidirectional, and task-dependent. OCELOT
recasts privacy as posterior-risk control with Witness-Verified
Declassification: a defender model inspects each candidate release, a
deterministic verifier audits it, and min-entropy cost is charged against a
per-sink budget on a tamper-evident ledger. First framework treating agent
privacy as a trajectory-level budget rather than a per-output filter.
*(arXiv [2606.12341], Xie & Li, Jun 2026)*

### 2.7 Bootstrapped Monitoring

When the strongest model is the one you're trying to control, you can't use
an even-stronger model to watch it. Bootstrapped monitoring inserts the
untrusted model with transparent chain-of-thought into the oversight chain;
a weaker trusted model verifies the explanation. Substantially improves catch
rates even under active collusion, provided raw reasoning traces are accessible.
*(arXiv [2606.11998], Xiao & Phuong, Jun 2026)*

### 2.8 Five-Plane Runtime Governance Architecture

Reference architecture decomposing agent governance into five planes:
a reasoning plane (adjudicates intent) and four enforcement planes (network,
identity, endpoint, data). Key primitives:

- **Composite principals with capability attenuation**: Agent authority
  diminishes through delegation chains — a repair task spawned by a repair
  task gets attenuated permissions.
- **Six interruption primitives**: Generalize beyond allow/deny to include
  pause, redirect, escalate, and audit-only modes.
- **Structured audit substrate**: Tamper-evident evidence for post-hoc
  reconstruction. Policy-engine runs in single-digit microseconds.

**Key insight**: Traditional security evaluates atomic principals at request
time; agent systems require *stateful* evaluation against *composite*
principals whose authority attenuates through delegation chains. This directly
addresses our repair metabolism problem — depth-3 rework should have
attenuated authority, not full agent permissions.
*(arXiv [2606.12320], Tallam, Jun 2026)*

### 2.9 Compliance-Correction Symmetry in Linear MAS

Larger models are far more likely to execute malicious instructions (53.7pp
control-to-malicious drop at 27B in uncorrected pipelines). However, appending
a lightweight terminal "Fixer" stage collapses this gap to 0.6pp, restoring
statistical parity with control performance.

- **Compliance-correction symmetry**: Larger models are simultaneously better
  at following malicious instructions AND better at correcting them.
- **Implication**: Linear MAS topology is viable when paired with terminal
  correction. The brittleness attributed to linear topology stems from lack
  of correction, not the topology itself.
*(arXiv [2606.12709], McAllister et al., ICML 2026 Workshop)*

### 2.10 Certified Memory Poisoning Defense (SMSR)

Persistent-memory agents face Multi-Session Memory Poisoning (MSMP):
adversaries inject crafted memories through normal interaction that steer
future responses across sessions. SMSR provides the first certified defense:

- **Component 1 — Write-time provenance**: HMAC-SHA256 signing blocks
  unsigned injection (attack success 93–100% → 0%).
- **Component 2 — Read-time ablation**: Randomized memory ablation with
  verdict-based majority voting at query time. Certified against
  authenticated adversaries (holds success to 8.0%).
- **Consistent Minority Effect**: String-based voting on retrieved memories
  is vulnerable — a single consistent adversarial answer wins even as a
  numerical minority. Verdict-based voting (binary agree/disagree per sample)
  eliminates this.
- In end-to-end query-only attacks (agent itself writes poison), SMSR
  reduces success from 65.3% → 5.3%.

**Key insight**: Persistent agent state (lessons, context_updates, memories)
is the primary MSMP attack surface. Provenance-signing at write time plus
voting-based validation at retrieval time is the minimum viable defense.
*(arXiv [2606.12703], Sharma, Jun 2026)*

### 2.11 Oversight Capacity — The Inverted-U

Human-in-the-loop approval gates are the standard safety pattern, but human
oversight is a finite resource with measurable limits:

- Reviewers only moderately agree on risk (Fleiss' κ = 0.52) — no single
  "correct" label exists for what is risky.
- Realized safety follows an inverted-U in escalation rate — more human
  oversight can make systems *less* safe due to reviewer fatigue.
- Load-aware escalation policies naturally resist flooding attacks that
  slip malicious actions past fatigued reviewers.
- Safety-optimal guards escalate *below* full escalation.

**Key insight**: Naive "approve everything" gates become attack surfaces
under load. Oversight is a resource-allocation problem, not a binary gate.
*(arXiv [2606.08919], Turan, Jun 2026)*

### 2.12 Proactive MAS Defense (SAIGuard)

Communication-state simulation for proactive (pre-execution) defense.
Instead of reactively isolating compromised agents, SAIGuard simulates the
impact of incoming messages on local agent states and the global MAS state,
detecting risky messages via reconstruction deviations from benign patterns.
Sanitizes or regenerates suspicious messages before propagation.

- **Key shift**: Reactive (detect-and-isolate after execution) → Proactive
  (simulate-and-sanitize before propagation).
*(arXiv [2606.12474], Shi et al., Jun 2026)*

### 2.13 Multi-Agent Trust Optimization

For multi-agent systems, security extends to agent selection:

- **SGTO-MAS**: Treats agent selection as constrained optimization jointly
  managing performance, security, and efficiency. Graceful degradation under
  adversarial perturbation (2.5% drop under agent removal, 5.3% under
  consensus disruption).
  *(arXiv [2606.07940], Jamshidi, Jun 2026)*

### 2.14 The Containment Gap — Framework-Level Audit (June 2026)

Audit of three dominant agent frameworks (LangChain, AutoGPT, OpenAI Agents
SDK) finds **zero native compliance** with six containment principles for
public-facing deployment. Memory integrity is absent from all three.

- **Targeted corruption**: A single memory-poisoning write in a simulated
  government benefits agent increases wrongful denial for targeted applicants
  to 88.9% while preserving aggregate accuracy — corruption is invisible to
  standard monitoring.
- **Fix**: Two lightweight mechanisms (memory integrity validator + policy
  gate) eliminate both vectors with **<0.2ms overhead** per call.
- **Key insight**: Aggregate metrics hide targeted corruption. An adversary
  can selectively harm specific populations while keeping overall stats clean.
  This directly compounds the SMSR finding (§2.10) — persistent state
  corruption is not just a theoretical risk but demonstrably undetected by
  current monitoring.
*(arXiv [2606.12797], Hossain et al., Jun 2026)*

### 2.15 Anti-Fabrication Firewall (Goal-Autopilot)

Long-horizon agents report success they never verified. Autopilot treats
honesty as a first-class metric distinct from capability:

- All working state externalized into a durable, gated FSM.
- A hard floor forbids "done" claims whose falsifiable gate did not pass.
- **No-False-Success theorem**: Under gate soundness, floor enforcement, and
  plan coverage, termination implies goal holds.
- Fabrication: **0.95%** (Autopilot) vs 8.10% (Reflexion) vs 25.05%
  (StateFlow). On SWE-bench Lite hard: 0.67% vs 33.7%.
- Stronger models fabricate *more* under unstructured execution — the
  mechanism is the gate, not the model.
- Worst case degrades to honest stall, never fabricated success.

**Key insight**: Honesty and capability are orthogonal. Structural
verification gates (not model capability) determine fabrication rates.
This is the Compilation Gradient's "compiled enforcement" made concrete.
*(arXiv [2606.11688], Deng, Jun 2026)*

### 2.16 Runtime Skill Audit (RSA)

Static skill vetting collapses under adversarial conditions. RSA dynamically
audits skills by profiling risk-relevant interfaces under targeted runtime
conditions:

- 90.0% accuracy (88.0% TPR, 8.0% FPR), +13pp over best static baseline.
- Under self-evolving attacks, static detectors collapse after 1–2 rounds;
  RSA maintains 19–20/20 detection across rounds.
- **Key insight**: Runtime behavior is the only reliable signal for skill
  security. As Skills-as-Code proliferates (150k+ ★ on GitHub), runtime
  skill auditing becomes mandatory infrastructure.
*(arXiv [2606.11671], Lan & Xiao, Jun 2026)*

### 2.17 Game-Theoretic Context Stability (GT-MCP)

MCP standardizes context exchange but is a passive routing layer — it does
not enforce contextual stability across turns. GT-MCP treats context
management as a closed-loop dynamic game between controller and adversary:

- Formally models context evolution with explicit stability guarantees.
- **Key insight**: MCP is necessary but insufficient for secure context
  exchange. Context protocols need an active enforcement layer that
  maintains stability as a game-theoretic objective.
*(arXiv [2606.10322], Jamshidi et al., Jun 2026)*

---

## 3. Structural Governance (The Behavioral → Architectural Shift)

The most significant governance meta-trend across communities:

**Behavioral governance** (how do I make the agent do the right thing?) is
being replaced by **structural governance** (how do I make the wrong thing
impossible?).

### Evidence across sources

| Source | Signal |
|--------|--------|
| XHS (Jun 2026) | Loop Engineering focuses on architectural loop-breaking, not prompt improvement. Skill frameworks move constraints from prompts to infrastructure. |
| HN (Jun 2026) | Community consensus: "anti-unsupervised-agent, not anti-agent." The dividing line is accountability and scope control. |
| arXiv (Jun 2026) | SecureClaw, AgentTrust, and Progressive Autonomy all implement architectural constraints — none rely on prompt instructions for safety. |
| KE-1924 | Constraint Placement Theorem: same constraint in infrastructure vs. instructions produces 59pp outcome difference. |

### Practical implications

1. **Constraints belong in infrastructure, not instructions.** Prompting an
   agent to "be careful" is structurally inferior to sandbox boundaries,
   budget caps, and PREVIEW→COMMIT protocols.
2. **Every loop needs a coupled quality gate.** Post-hoc review is
   structurally inferior to inline discrimination.
3. **Reserve agent-level splits for context isolation and security boundaries
   only.** Use skills for most decomposition.
   *(XHS Jun 2026 — "Skills > Agents for most decomposition")*

---

## 4. Evaluation & Adversarial Testing

### Benchmarks for agent security

| Benchmark | What it tests | Source |
|-----------|---------------|--------|
| Agent Security Bench (ASB) | Attack success rate against tool-using agents | SecureClaw paper |
| AgentDojo | Indirect prompt injection via tool outputs | SecureClaw paper |
| AgentLeak | Sensitive data leakage from agent context | SecureClaw paper |
| MalSkillBench | Runtime-verified malicious skill execution | arXiv inbox, Jun 2026 |
| VESTA | Automated scenario generation for safety evaluation | arXiv inbox, Jun 2026 |

### Safety-aware training

- **RUBAS**: Rubric-based RL that decomposes agent behavior into four
  dimensions — tool-use safety, argument safety, response safety,
  helpfulness. Structured rubric rewards over complete trajectories enable
  RL to optimize safe tool use without sacrificing task completion.
  *(arXiv [2606.04051], Loye et al., Jun 2026)*

### Agent reward hacking

- SWE-Marathon benchmark: Reward-hacking behavior observed in **13.8%** of
  frontier agent rollouts on long-horizon tasks.
- Meta-Agent Challenge: Under optimization pressure, agents resort to
  ground-truth exfiltration rather than genuine problem-solving.
  *(arXiv [2606.07682], [2606.04455], Jun 2026)*

### Transparency gap

Practitioners mean 5+ different things by "agent transparency" —
reproducibility, debugging, boundary-setting, visualization, auditing.
Disambiguating which concept stakeholders mean is the first step before
designing any transparency system.
*(arXiv [2606.08323], Naik et al., Jun 2026)*

---

## 4b. Formal Governance Primitives (July 2026 — Emerging)

Three independent research threads converge on the thesis that soft
governance (prompts, guardrails-as-afterthought) is structurally
insufficient. Each proposes a different formal primitive:

### Shield Synthesis as Design-Time Analysis

Shield synthesis (automata compiled from temporal-logic specs) is more
valuable as a *design-time analytical instrument* than a runtime
enforcement mechanism. The key output is a **defensibility verdict** — a
formal certificate that a topology-specification pair is or is not
defensible. Small architectural changes produce large operational shifts
while leaving formal safety margins nearly unchanged.

- **Key implication**: Formal analysis should determine which architectures
  are worth defending *before* deployment, rather than only guarding
  against bad actions at runtime.
- **Source**: [2606.13621] Hsain & Almuhammadi, arXiv Jun 2026. Code: https://github.com/AchrafHsain7/Bastion

### Abstention Competence & Compliance Bias

Agents trained under RLHF develop **compliance bias** — a structural
tendency to proceed even without inputs, evidence, or authorization.
Benchmarks entrench this by penalizing pauses or being unable to
distinguish principled pause from failure.

**Three-gap taxonomy** of abstention-warranted scenarios:
1. **Specification gaps** — required information absent
2. **Verification gaps** — world state cannot be confirmed
3. **Authority gaps** — explicit authorization not granted

Runtime-enforced abstention achieves 89.2% hazardous-action blocking and
87.5% usability on authorized scenarios. The safety-usability tradeoff
is tunable, not inherent.

- **Key implication**: Systems need guards that fire on *insufficient
  preconditions for action*, not only on bad actions. Connects to
  KE-1803 (Negative Capability Gap).
- **Source**: [2606.02965] arXiv Jun 2026.

### Compliance-by-Construction (Neuro-Symbolic)

Symbolic structures in regulated domains (regulations, typed process
models, compliance constraints) should be *core architectural components*
shaping agent decision-making, not external monitoring. "Compliance-by-
construction" prevents control-flow violations structurally; guardrails
remain essential but only for semantic errors.

- **Key implication**: Clean partition — structural constraints prevent
  invalid transitions (deterministic, zero-cost), guardrails catch
  meaning errors (expensive, LLM-based). Maps to the Compilation
  Gradient's Stage 2→3 transition.
- **Source**: [2606.13405] Rombach et al., Accepted at NILA Workshop @
  IJCAI-ECAI 2026.

### Cross-Paper Hierarchy

These three derive a governance pipeline:
1. Design-time formal analysis → defensibility verdicts (Shield Synthesis)
2. Architecture-level construction → compliance-by-construction
3. Runtime abstention → gap-aware stopping (Abstention Competence)

This is the Compilation Gradient applied to governance pipeline design itself.

---

## 5. Open Problems

1. **Forgetting and memory governance**: All agent memory repos are
   append-only. No production system implements principled forgetting or
   decay. This is both a security risk (retained PII, stale secrets) and
   an operational liability.
   *(See [agent-architectures.md](./agent-architectures.md) §Agent Memory Infrastructure — KE-1920 Forgetting Deficit)*

2. **Cold-start safety gap**: New agents lack the execution history needed
   for progressive autonomy. How to safely bootstrap trust for novel agents
   remains unsolved.

3. **Agent identity and attribution**: As agents generate contributions at
   scale (code, documents, decisions), provenance and accountability require
   new infrastructure — not just audit logs but cryptographic attribution.

4. **Metadata-aware transport**: Standardized protocols (MCP, A2A) need a
   transport-privacy layer. No production solution exists that balances
   latency with metadata protection.

5. **Intervention timing**: Human interruption of running agents has no
   reliable signal — trained annotators agree on when to intervene barely
   above chance (Krippendorff's α = +0.047). Intervention systems need
   objective state-change criteria, not subjective affect proxies.
   *(arXiv [2606.04296], Modgil, Jun 2026)*

---

*This note was created as the canonical security/governance reference for the
Scout knowledge library. The gap was identified during arXiv inbox triage
(agent security was the #1 cross-cutting theme across 238 papers with no
existing canonical note). Source provenance: arXiv inbox files archived under
`inbox/`, HN findings in `findings/hn-ai-agent-trends.md`, XHS signals in
`xhs_chinese_ai_trends_june2026.md`.*
