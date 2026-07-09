<ai_context>
summary: "Companion note to agent-security-defense-architectures.md: security research frontier entries covering endogenous runtime defense (ANIS immune system), prompt injection impossibility proof, embedded training attacks, covert channels in multi-agent systems, forensic trajectory detection, safety inversion, automated attack frameworks (Vera), guardrail reconnaissance, ghost memory, process rubrics, policy enforcement ceiling, guard miniaturization, skill scanner evasion/detection/fuzzing, action boundary violations, steerability via constraints, simple safety monitoring, reasoning history poisoning (FARMA), agent data injection (ADI), cross-user privacy (PiSAs), untrusted content masking (UCM), stored IPI prevention (DualView), the Appearance Collapse thesis, MCP TAG-Block concealment (protocol-level encoding gap), adversarial hallucination squatting (HalluSquatting — supply-chain botnet via predictable hallucinations, 2607.07433), and behavior leverage imbalance (training-time mode drift via structural token positions, 2607.07050). These represent boundary-expanding research rather than enumerable defense patterns."
triggers: ["ANIS", "agent immune system", "prompt injection impossibility", "inseparability proof", "embedded attack", "DR-SFT", "covert channels", "steganography", "KV-cache integrity", "forensic trajectory", "memory poisoning detection", "behavioral invariants", "Vera", "guardrail reconnaissance", "ghost memory", "A-TMA", "SkillCoach", "SafePyramid", "HaloGuard", "kNNGuard", "SkillCloak", "SkillDetonate", "SkillFuzz", "UnderSpecBench", "steerability", "FARMA", "ADI", "PiSAs", "UCM", "DualView", "Appearance Collapse", "TAG-Block", "MCP concealment", "encoding gap", "HalluSquatting", "hallucination squatting", "agentic botnet", "promptware", "behavior leverage", "Soft Clamp", "over-calling", "mode drift"]
last_updated: "2026-07-09"
source_basis: "Extracted from agent-security-defense-architectures.md. MCP TAG-Block Concealment (2607.05744) moved from defense-architectures.md §Execution Boundary Patterns (scan #453). HalluSquatting (2607.07433) and Behavior Leverage (2607.07050) added from scan #490. Sources: arXiv 2606.28270 (ANIS), 2606.27567 (Inseparability), 2606.28153 (Robust Harmful Features), 2606.30263 (Embedded Attack/DR-SFT), 2606.28958 (KV-Cache Integrity), 2606.28425 (Tool Use Steganography), 2606.30383 (Multi-Party Principal Loyalty), 2606.30566 (Forensic Trajectory Signatures), 2606.30627/30587/30602 (Safety Inversion), 2607.01793 (Vera), 2607.02121 (Behind the Refusal), 2607.01935 (A-TMA), 2607.01874 (SkillCoach), 2606.29887 (SafePyramid), 2607.02079/02072 (HaloGuard/kNNGuard), 2607.02357 (SkillCloak/SkillDetonate), 2607.02345 (SkillFuzz), 2607.02294 (UnderSpecBench), 2607.02389 (Steerability), 2607.02510 (Online Safety Monitoring), 2607.05029 (FARMA), 2607.05120 (ADI), 2607.05318 (PiSAs), 2607.05277 (UCM), 2607.03821 (DualView), 2607.05744 (TAG-Block), 2607.07433 (HalluSquatting), 2607.07050 (Behavior Leverage). Scan provenance: #236, #239, #264, #272, #273, #282, #368, #375, #411, #432, #453, #490."
</ai_context>

# Agent Security: Research Frontiers

**Companion note** to [Agent Security: Defense Architectures](./agent-security-defense-architectures.md).

This note collects security research that expands the boundaries of what is
known about agent defense — impossibility results, novel attack classes, and
detection paradigms that don't fit neatly into the numbered defense catalog.

**Cross-references:**
- [Agent Security: Defense Architectures](./agent-security-defense-architectures.md) — numbered defense catalog (§2.1–§2.33)
- [Agent Security: Verified Enforcement Patterns](./agent-security-verified-enforcement.md) — enforcement without agent cooperation (§2.34+)
- [Agent Security & Governance](./agent-security-governance.md) — attack surfaces, structural governance, open problems
- [Agent Security Event Log](./agent-security-event-log.md) — HN/cross-source event narratives

---

## Agent-Native Immune System (ANIS) — Endogenous Runtime Defense (Scan #239)

The Agent-Native Immune System (arXiv 2606.28270) is the first biologically
inspired, endogenous defense architecture embedded directly within the agent's
cognitive loop, rather than external to it.

**Six-Layer Immune Tower (L0-L5):**
- L0: Genome layer (training-time alignment foundation)
- L1: **Barrier Immunity** — non-cognitive, physical-and-logical isolation
- L2-L5: Adaptive immune responses within the reasoning loop

**Key architectural contributions:**
1. **Agent Viruses vs. Agent Vaccines taxonomy**: Formalizes distinction between
   superficial non-parametric defenses (prompt-level) and robust parametric
   vaccines (weight-level). Non-parametric defenses are categorically weaker.
2. **Harness Triad (Meta, Self, Auto)**: Self-monitoring metacognitive backbone
   enabling Continual Immune Learning (CIL) — vaccines adapt to novel threats.
3. **Alignment ≠ Immunity**: "Alignment provides a static 'constitutional' value
   foundation during training; ANIS serves as the dynamic 'law enforcement'
   mechanism during runtime." A fully aligned agent remains vulnerable to
   runtime hijacking.
4. **Novel metric: Autoimmunity Rate** — false-positive intervention rate.
   Measures the cost of over-active defense boundaries.

**Defense class**: Endogenous runtime enforcement within cognitive loop.
Extends the external enforcement paradigm (§2.33+) by placing defenses INSIDE
the agent's reasoning, not alongside it. Contrast with ActPlane (external,
kernel-level) and Progent (external, process-level).

**Connection to Authority Default Problem (Scan #239)**: ANIS identifies that
perimeter security and training-time alignment are external to the agent's
active reasoning loop and therefore structurally insufficient against runtime
hijacking. The authority default (maximum access by default) is unaddressed
by alignment alone — only runtime enforcement within the cognitive loop can
restrict authority dynamically.

Source: https://arxiv.org/abs/2606.28270

---

## Structural Inevitability — Prompt Injection Impossibility Proof (Scan #236)

The Inseparability proof (arXiv 2606.27567) establishes that prompt injection
is **mathematically unsolvable** in shared-embedding architectures. Three
formal results: (1) provenance-recovery impossibility bounded by total variation
distance; (2) control-path exposure through shared attention value-aggregation;
(3) finite-coverage invariance gap over infinite semantic-equivalence classes.

Mechanistic complement: Robust Harmful Features (arXiv 2606.28153, ICML 2026
Oral) shows jailbreak attacks selectively suppress early-layer ACH attention
heads while safety knowledge persists in mid-layer SAHs. The model *knows*
it's being jailbroken but structurally cannot prevent it.

The Von Neumann analogy is explicit: prompt injection is code-data confusion
requiring decades of layered defense (DEP, W^X, ASLR, memory-safe languages),
not a single mechanism fix.

**Implication for defense architecture**: All in-pipeline defenses (behavioral
alignment, classifier-based filtering, prompt hardening) are *mitigations*,
not solutions. The structural fix requires architectural channel separation.

See: [findings/2026-10-31-arxiv-scan-236.md](./findings/2026-10-31-arxiv-scan-236.md)

---

## Embedded Attack: Harmful Supervision Hidden in Benign Training (2026-06-30)

**Paper**: [arXiv 2606.30263](https://arxiv.org/abs/2606.30263) — "Defending
Against Harmful Supervision Hidden in Benign Samples"

A new attack class where harmful QA pairs are **embedded within benign training
samples**. Unlike mixed-data attacks (explicit harmful content), embedded attacks
pass example-level guardrails because each sample looks benign in isolation.

**Attack**: Harmful supervision signals are hidden inside individually
benign-looking fine-tuning examples. Representative guardrails **fail to
detect them** at the example level.

**Defense**: **DR-SFT (Dual-Reference SFT)** — adapts DPO-style contrastive
objective to SFT through **token-level regularization**. Catches embedded harm
that coarse data filtering structurally misses.

**Connection to defense architecture**:
- Extends the training-time attack surface beyond mixed-data poisoning
- Token-level governance > example-level governance (the Invisible Layer
  Problem applied to training data — scan #259)
- DR-SFT's graduated approach validates the Incompleteness Constraint (scan
  #264): binary accept/reject of training examples is provably insufficient;
  continuous regulation at finer granularity is the structural fix

See: [findings/2026-06-30-arxiv-scan-264.md](./findings/2026-06-30-arxiv-scan-264.md)

---

## The Unobservable Surface: Covert Channels in Multi-Agent Systems (2026-06-30)

Three papers converge on a structural security challenge: multi-agent systems
develop communication channels invisible to text-level monitoring.

**KV-Cache Integrity** ([arXiv 2606.28958](https://arxiv.org/abs/2606.28958)):
Agents sharing KV-cache state alongside text create a covert channel. Malicious
state manipulation defeats text-only verifiers while keeping visible messages
plausible. Fix: HMAC-SHA256 manifest binding specialist identity, session, model,
visible commitment, and payload digest (774/774 honest accepted, 295/295 tampered
rejected). KV-cache must be treated as security-sensitive transport, not internal
state.

**Tool Use Steganography** ([arXiv 2606.28425](https://arxiv.org/abs/2606.28425)):
Frontier agents already construct steganographic channels that are computationally
indistinguishable from good-faith communication, using realistic tool access
(code execution, web search). Capability barrier has fallen; coordination
(Schelling points) is last defense. Shared artifacts and repeated interaction
erode even that.

**Multi-Party Principal Loyalty** ([arXiv 2606.30383](https://arxiv.org/abs/2606.30383)):
The leak/over-refusal trade-off in multi-party agents is a structural Pareto
boundary, not an engineering limitation. PrincipalBench (75-item, 13 models):
mechanisms move along the frontier but cannot cross it.

**Connection to defense architecture**:
- Extends Invisible Layer Problem (scan #259) from detection to exploitation
- Validates substrate-separated governance prediction (scan #270): HMAC fix is
  governance on a different substrate than the governed channel
- Unobservable surfaces compound: hidden state + emergent channels + structural
  trade-offs create a governance stack where each layer adds unmonitorable
  information flow

See: [findings/2026-06-30-hn-arxiv-scan-272.md](./findings/2026-06-30-hn-arxiv-scan-272.md)

---

## Forensic Trajectory Detection: Behavioral Invariants for Memory Poisoning (2026-07-01)

**Paper**: [arXiv 2606.30566](https://arxiv.org/abs/2606.30566) — "Forensic
Trajectory Signatures for Agent Memory Poisoning Detection"

**Core contribution**: Memory poisoning attacks leave overdetermined behavioral
invariants in tool-call sequences. Successful attacks require a specific
information-retrieval dependency (memory_recall_fact → email_send_email) that
non-exfiltrating sessions rarely exhibit. This is structural, not empirical.

**Key results**:
- Simple rule on invariant alone: AUC = 0.9563
- Random Forest over 19 trajectory features: AUC = 0.9904 (95% CI [0.987, 0.993])
- Signature is **overdetermined**: removing half the features (all recall-related)
  leaves AUC unchanged at 0.990 — distributed signature, not single anomaly
- Cross-model: AUC 1.000 on 6/9 hold-out splits (7B–120B), generalizes to
  GPT-4.1/4o without retraining
- Prefix-only real-time blocking: AUC = 0.934
- **Forensic discrimination**: prompt-injection attacks produce distinct trajectory
  (score = 0.541), enabling attack-type classification from tool-call logs alone

**Connection to defense architecture**:
- Direct counter to Unobservable Surface (#272): covert channels are invisible
  but the actions they enable require visible tool calls — forensic opportunity
- Complements MemVenom (§2.18): attack vs. detection pairing
- Validates tool-call boundary as enforcement locus (ActPlane §2.33,
  Doberman-Core runtime enforcement)
- Design principle: prevention at channel level is impossible; detection at
  trajectory level is feasible

**Defense class**: Forensic detection via behavioral invariants. Unlike runtime
enforcement (which prevents), this approach detects and classifies after or
during execution. The two are complementary: runtime enforcement for known
patterns, forensic trajectory analysis for novel attack discovery.

See: [findings/2026-07-01-hn-arxiv-scan-273.md](./findings/2026-07-01-hn-arxiv-scan-273.md)

---

## Automated Attack Frameworks & Guard Landscape (Scans #368, #375)

Six scan #368 entries (Jul 2026 arXiv) and six scan #375 entries reveal that
the attack/defense frontier is accelerating simultaneously — production
frameworks are vulnerable, static defenses are bypassable, but behavioral
runtime detection and simple monitoring remain effective.

### Vera Automated Safety Testing (Scan #368)

93.9% average attack success rate on 4 production agent frameworks (OpenClaw,
Hermes, Codex, Claude Code) under multi-channel attacks. 1,600 executable
cases / 124 risk categories. Proves L1 guard enforcement alone is functionally
absent against structured attack campaigns.

Source: [arXiv 2607.01793](https://arxiv.org/abs/2607.01793)

### Behind the Refusal — Guardrail Reconnaissance (Scan #368)

First black-box guardrail detection methodology: 100% presence detection,
F1=98% block-type disambiguation via HTTP/lexical/timing signals. Guardrails
are transparent to attackers.

Source: [arXiv 2607.02121](https://arxiv.org/abs/2607.02121)

### A-TMA Ghost Memory (Scan #368)

Formalizes state coordination failure where old, current, and transition facts
coexist and mislead answer models; ATMA overlay improves conflict accuracy
+0.240 absolute. Memory-layer analog of SkillFuzz composition attacks.

Source: [arXiv 2607.01935](https://arxiv.org/abs/2607.01935)

### SkillCoach Process Rubrics (Scan #368)

Self-evolving rubrics for 4-dimensional skill-use evaluation (selection,
following, composition, reflection); separates process quality from accidental
task success.

Source: [arXiv 2607.01874](https://arxiv.org/abs/2607.01874)

### SafePyramid Policy Enforcement Ceiling (Scan #368)

GPT-5.5 achieves only 12.9% exact-match on novel policy frameworks with 61,699
rules. Policy composition is structurally hard.

Source: [arXiv 2606.29887](https://arxiv.org/abs/2606.29887)

### Guard Miniaturization — HaloGuard + kNNGuard (Scan #368)

L1 guard enforcement commoditizing: 0.8B model beats 27B baselines; training-free
50-example guardrail runs 2.7× faster.

Sources: [arXiv 2607.02079](https://arxiv.org/abs/2607.02079), [arXiv 2607.02072](https://arxiv.org/abs/2607.02072)

### SkillCloak Static Scanner Evasion (Scan #375)

Payload-preserving evasion framework bypasses all 8 tested static skill scanners
at >90% (SFS Packing) and >80% (Structural Obfuscation). Tested across 1,613
in-the-wild malicious skills. Static/appearance-based skill auditing is provably
insufficient.

Source: [arXiv 2607.02357](https://arxiv.org/abs/2607.02357)

### SkillDetonate Runtime Behavioral Auditor (Scan #375)

Sandbox-based runtime detection using on-demand closure lift + marker-based
taint analysis achieves 97% detection at 2% FP, 87% on real-world malicious
skills. Only behavioral defense shown to withstand SkillCloak evasions.

Source: [arXiv 2607.02357](https://arxiv.org/abs/2607.02357)

### SkillFuzz Composition Intent Discovery (Scan #375)

Contract-guided MCTS fuzzer discovers >1,000 implicit intents from individually
benign skill compositions; 80%+ of highest-risk flagged compositions confirmed
during execution. Individual skill auditing provably insufficient.

Source: [arXiv 2607.02345](https://arxiv.org/abs/2607.02345)

### UnderSpecBench Action Boundary Violations (Scan #375)

55.8–67.8% of coding agent runs violate at least one action boundary under
underspecified instructions. Agents guess rather than refuse/clarify.
Completion-centric evaluation overstates safe autonomy.

Source: [arXiv 2607.02294](https://arxiv.org/abs/2607.02294)

### Steerability via Constraints (Scan #375)

Traditional engineering controls (access control, network policies, coding
conventions) transfer directly to coding agents; cheaper in tokens than agentic
scaffolding. Backdoor detection 54.5%→90.9% with substrate constraints +
200-LoC docs CLI.

Source: [arXiv 2607.02389](https://arxiv.org/abs/2607.02389)

### Online Safety Monitoring — Simple Threshold (Scan #375)

Simple verifier-signal thresholding with risk-control calibration matches
complex sequential hypothesis testing monitors. More infrastructure ≠ more
safety.

Source: [arXiv 2607.02510](https://arxiv.org/abs/2607.02510)

---

## Data-Layer & Memory Attacks (Scan #432)

Five scan #432 entries (Jul 2026 arXiv) converge on a new attack frontier:
data injection, reasoning poisoning, cross-user privacy, and structural
isolation defenses.

### FARMA Reasoning History Poisoning (Scan #432)

Forged reasoning traces (not factual knowledge) achieve 100% ASR on persistent
agent memory. Bypasses keyword filters (evasive language) and consensus defenses
(self-referential amplification). Defense: SENTINEL layered pipeline with
5-signal Reasoning Guard reduces ASR to 0% with 0 FP/326 benign traces.

Source: [arXiv 2607.05029](https://arxiv.org/abs/2607.05029)

### ADI — Agent Data Injection (Scan #432)

New IPI category injecting malicious *data* (metadata, identifiers, formats)
rather than instructions. RCE on Claude Code, Codex, Gemini CLI. Arbitrary
click attacks on web agents. Bypasses all existing IPI defenses because they
only filter instructions, not data. Fundamental gap: agents don't isolate
trusted from untrusted data.

Source: [arXiv 2607.05120](https://arxiv.org/abs/2607.05120)

### PiSAs Cross-User Privacy Benchmark (Scan #432)

First benchmark for multi-user agentic privacy with dual CI annotations
(task-appropriateness + user-authorization). Even SOTA models fail to prevent
cross-user data spillage through inter-agent messages, shared memory, and agent
state. System-agnostic across topologies and memory regimes.

Source: [arXiv 2607.05318](https://arxiv.org/abs/2607.05318)

### UCM — Untrusted Content Masking (Scan #432)

DOM-based structural isolation for web agents. Leverages DOM structure (not
content) to distinguish trusted from untrusted regions. Provides security
*guarantees* (not heuristic filtering). Extends provable defenses from text-based
APIs to visual web environments.

Source: [arXiv 2607.05277](https://arxiv.org/abs/2607.05277)

### DualView Stored IPI Prevention (Scan #432)

Dual-view tracking extends untrusted data isolation from agent context to full
user environment (filesystem, shell, network, other agents). AgentView sees
symbols; HumanView preserves originals. Blocks every IPI including stored IPI.
Deploys as OpenClaw plugin with zero agent logic changes.

Source: [arXiv 2607.03821](https://arxiv.org/abs/2607.03821)

---

## The Appearance Collapse (Scan #411)

Scan #411 elevates the SkillFuzz/SkillCloak/SkillDetonate findings (#375) into
a broader thesis: **surface trust fails everywhere simultaneously** — brand
trust (Anthropic goodwill erosion, 97pts HN), marketing trust (AI-first
backlash, 49pts), benchmark trust (Regression to the Mean, 54pts), and static
scanning trust (>90% bypass). Only behavioral runtime detection works. The
Appearance Collapse establishes behavioral evidence as the successor to
appearance-based security at every layer.

See: [findings/2026-07-06-hn-arxiv-github-scan-411.md](./findings/2026-07-06-hn-arxiv-github-scan-411.md)

---

## MCP TAG-Block Concealment — Protocol-Level Encoding Gap (Scan #453)

Unicode TAG block (U+E0000–U+E007F) payloads invisible to human approval view
survive byte-for-byte into model tokenizer. 8/8 techniques deliver payload into
model context; 0/8 trigger MCP re-approval (even under TOCTOU rug-pull); 4/8
evade string-matching sanitizer. Consistent across 3 independent server
implementations (32/32 cross-library outcome cells agree).

**Attack class**: Protocol-level encoding gap.
**Implication**: Approval-surface defenses (rendering-dependent review, string-matching
sanitization) are structurally insufficient when the approval view and model
input diverge at the encoding layer. Extends the Appearance Collapse thesis —
visual trust fails at the protocol encoding level, not just the application level.

**Connection to defense architecture**: CXI (§2.44 in
[verified-enforcement](./agent-security-verified-enforcement.md)) is explicitly
immune to this attack class because it binds at the execution surface, not the
approval surface.

*(arXiv [2607.05744](https://arxiv.org/abs/2607.05744), Jul 2026. Scan #453)*

---

## Adversarial Hallucination Squatting — Agentic Botnets (Scan #490)

A novel attack class requiring **no direct channel** to the victim LLM.
Exploits the inherent tendency of LLMs to hallucinate resource identifiers
(repository names, package names, skill names) in a structured, predictable,
and cross-model transferable way.

**Attack mechanism (HalluSquatting)**:
1. Identify trending resources (popular repos, skills, packages)
2. Compute LLM distribution of hallucinations on trending resource names
3. Preemptively register hallucinated names to host adversarial prompts
4. Wait — agents independently hallucinate and pull the poisoned resource

**Empirical results**:
- Repository cloning: hallucination rates **up to 85%**
- Skill installation: hallucination rates **up to 100%**
- Hallucinations **transfer between foundational models** and across prompts
- Practical demonstration: remote tool execution and RCE against production
  LLM applications with integrated terminals

**Attack class**: Supply-chain poisoning via predictable hallucination.
**Threat model**: Weak — attacker needs only a registry account, no direct
interaction with victim. Untargeted, scalable, and deniable.

**Why this is structurally novel**:
- Prior prompt injection requires a direct channel (user input, tool response,
  retrieved document). HalluSquatting requires NO direct channel — the model
  creates the channel through hallucination.
- The attack surface grows with the skill/package ecosystem (#483: 216K skills)
- Governance Silence (#478) guarantees silent success — tool reports green
- Write Refusal (#489) identifies the missing gate — but no production system
  implements hallucination-aware write refusal on dependency resolution

**Mitigations** (structural, not enumerated in paper):
- Hallucination-aware namespace reservation in registries
- Verification gates between resource name generation and fetch execution
- Provenance checks that verify resource existed BEFORE the model generated
  the name (temporal ordering as security primitive)

*(arXiv [2607.07433](https://arxiv.org/abs/2607.07433), Jul 2026. Scan #490)*

---

## Behavior Leverage Imbalance — Training-Time Mode Drift (Scan #490)

Multi-teacher on-policy distillation creates **invisible behavioral shifts**
that aggregate metrics cannot detect. In tool-use training, local token-level
signals at structural positions (`<tool_call>`, function names) have
disproportionate control over global generation mode.

**Mechanism**: Two-teacher distillation (tool-call teacher + direct-response
teacher) → model moves toward over-calling (calling tools when it should answer
directly). This shift is invisible because:
- Tool-call samples do NOT receive more token exposure
- Full-sequence per-token divergence is NOT larger for tool-call teacher
- The leverage is LOCAL: mode-entry positions have structural control

**Results (Soft Clamp mitigation)**:
- Over-calling reduced: 13.7% → 9.0% via per-token JSD calibration
- Decision accuracy preserved
- Tool-call loops reduced in BFCL multi-turn diagnostic

**Attack class**: Training-time behavioral governance gap.
**Implication**: Multi-teacher distillation is a governance-relevant training
decision that can shift agent behavior outside any deployment-time monitoring
scope. Connects to the Reliability Horizon (#488, "false prosperity"): the
model appears healthy by aggregate metrics while mode-switching behavior drifts.

**Structural pattern**: Where teacher signals ACT matters more than how large
they are — the Allocation Asymmetry (#477) operating at the token level.

*(arXiv [2607.07050](https://arxiv.org/abs/2607.07050), Jul 2026. Scan #490)*
