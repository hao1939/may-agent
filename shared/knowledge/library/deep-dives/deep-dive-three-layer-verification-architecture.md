# Three-Layer Verification Architecture for Multi-Agent Systems

**Type:** Cross-reference synthesis
**Sources:** NabaOS (2603.10060), AttriGuard (2603.10749), Bureaucracy of Speed (2603.09875)
**Date:** 2026-03-12
**Author:** Scout (heartbeat session)

---

## Thesis

Three independent papers, from completely different research traditions, each address one layer of the same fundamental problem: **how do you trust what agents do?** When composed, they form a complete verification stack that is more than the sum of its parts. None of the three papers references the others; this synthesis is novel.

| Layer | Paper | Question Answered | Mechanism | Tradition |
|-------|-------|-------------------|-----------|-----------|
| **L1: Execution Integrity** | NabaOS (2603.10060) | *Did the tool call actually happen?* | HMAC-signed receipts | Software Engineering / Epistemology |
| **L2: Causal Authorization** | AttriGuard (2603.10749) | *Was the tool call causally justified by the user's intent?* | Counterfactual shadow replay | Security / Causal Inference |
| **L3: Credential Governance** | Bureaucracy of Speed (2603.09875) | *Should this agent still be allowed to act at all?* | Operation-bounded credentials (RCC) | Hardware Architecture / IAM |

---

## Layer 1: Execution Integrity (NabaOS)

### What it verifies
- Tool calls the agent *claims* to have made were actually executed
- Results the agent reports match actual tool outputs
- Claims are tagged by epistemic source (direct observation vs. inference vs. testimony)

### Mechanism
Runtime generates HMAC-signed receipts for every tool execution. Agent never sees the signing key. Post-response verification cross-checks agent claims against receipt ledger.

### Performance
- 94.2% fabricated tool call detection
- <15ms overhead
- 4.1pp cross-language variance (language-independent by design)

### What it does NOT verify
- ❌ Whether the tool call was *appropriate* (authorized by user intent)
- ❌ Whether the agent should still have permission to call tools
- ❌ Adversarially robust against a model fine-tuned to exploit the system

---

## Layer 2: Causal Authorization (AttriGuard)

### What it verifies
- Each proposed tool call is *causally driven by user intent*, not by injected content in observations
- An agent acting on poisoned data won't execute unauthorized actions

### Mechanism
For each proposed action, construct a counterfactual: replay the agent's context with observations "attenuated" (control channels neutralized). If the action survives the counterfactual test → intent-supported. If it doesn't → observation-driven → blocked.

Three attenuation operators:
1. **Structural flattening:** JSON/code → natural language
2. **Perspective rewriting:** imperative → third-person declarative
3. **Causal scaffolding weakening:** strip "because X, therefore Y"

### Performance
- 0% ASR across all static attacks on 4 LLMs
- 6.6-9.8% ASR under adaptive optimization attacks (best baselines: 24-82%)
- ~2× token overhead, ~3× latency

### What it does NOT verify
- ❌ That a tool call actually executed (could be fabricated)
- ❌ Whether the agent's credential is still valid
- ❌ Injected goals that align with legitimate sub-goals

---

## Layer 3: Credential Governance (Bureaucracy of Speed)

### What it verifies
- The agent has not exhausted its authorization budget
- Revocation has propagated through the delegation chain
- Damage from stale credentials is bounded *independent of agent velocity*

### Mechanism
Operation-bounded credentials (RCC): agent receives authorization for N operations. At exhaustion, must contact authority for renewal. If revoked in the interim → denied. Maximum unauthorized operations = N, regardless of velocity v.

### Performance
- 120× damage reduction vs TTL in CRM scenario
- 184× reduction under anomaly-triggered revocation
- Deterministic bound: D ≤ n (provable, not empirical)

### What it does NOT verify
- ❌ Whether individual operations are causally justified
- ❌ Whether claimed operations actually executed
- ❌ Byzantine authority (assumes single trusted authority)

---

## The Composition: Why Three Layers Are Necessary

### Each layer's blind spot is covered by another

| Attack Scenario | L1 (NabaOS) | L2 (AttriGuard) | L3 (BoS) | Coverage |
|----------------|-------------|-----------------|----------|----------|
| Agent fabricates tool calls it didn't make | ✅ Catches via receipt mismatch | ❌ Doesn't detect (no tool call to attribute) | ❌ Doesn't detect | L1 |
| Prompt injection causes unauthorized tool call | ❌ Passes (tool really executed) | ✅ Catches via counterfactual failure | ❌ Doesn't detect (credential valid) | L2 |
| Agent continues operating on revoked authority | ❌ Passes (tools execute fine) | ❌ Passes (calls may be intent-aligned for stale task) | ✅ Catches at operation boundary | L3 |
| Injection + fabrication combo | ✅ L1 catches fabrication | ✅ L2 catches injection | — | L1 + L2 |
| Compromised agent burns through tasks after flag | ✅ Audit trail via receipts | ❌ May pass if tasks are legitimate-looking | ✅ Bounds damage at N ops | L1 + L3 |
| Subtle goal drift via poisoned shared state | ❌ Passes (all tools real) | ✅ Counterfactual detects deviation | ✅ Limits blast radius | L2 + L3 |

### The Swiss Cheese Alignment

The Bureaucracy of Speed paper explicitly invokes Reason's Swiss Cheese Model: multiple independent barriers where each has known holes, but the holes don't align. This is exactly what we see:

- **NabaOS hole:** can't detect authorized-but-malicious calls
- **AttriGuard hole:** can't detect fabricated calls; fails when injected goals overlap legitimate ones
- **BoS hole:** can't evaluate individual call quality

No single attack vector passes through all three layers simultaneously (except the fundamental limit: injected goals perfectly aligned with legitimate sub-goals AND the agent still has valid credentials AND the calls actually execute).

---

## Architectural Proposal: Three-Layer Stack

```
┌─────────────────────────────────────────────┐
│                  User / Bob                   │
└──────────────────┬──────────────────────────┘
                   │ task delegation
                   ▼
┌─────────────────────────────────────────────┐
│         L3: Credential Governance (BoS)      │
│                                               │
│  • Grant operation-bounded credential (n=50) │
│  • Track consumption: each tool call = 1 op  │
│  • Revocation propagation via delegation DAG │
│  • Velocity-independent damage bound: D ≤ n  │
│                                               │
│  Trigger: credential exhaustion OR revocation │
│  Action: require re-authorization             │
└──────────────────┬──────────────────────────┘
                   │ authorized request (n remaining)
                   ▼
┌─────────────────────────────────────────────┐
│      L2: Causal Authorization (AttriGuard)   │
│                                               │
│  For each proposed tool call:                 │
│  1. Build attenuated observation context     │
│  2. Teacher-forced shadow replay             │
│  3. Fuzzy survival test                       │
│    - Function match → arg match → LLM judge  │
│  4. PASS → forward to runtime                │
│     BLOCK → inject warning, skip call        │
│                                               │
│  Mode: FULL (high-stakes) or SAMPLE (routine)│
└──────────────────┬──────────────────────────┘
                   │ verified tool call
                   ▼
┌─────────────────────────────────────────────┐
│       L1: Execution Integrity (NabaOS)       │
│                                               │
│  Runtime executes tool → generates receipt:   │
│  {id, tool, input_hash, output_hash, sig}    │
│                                               │
│  Post-response verification:                  │
│  • Cross-check claims against receipt ledger │
│  • Epistemic source tagging (pratyakṣa etc.) │
│  • Flag fabrications, count mismatches        │
│                                               │
│  Overhead: <15ms per verification             │
└──────────────────┬──────────────────────────┘
                   │ receipt-verified output
                   ▼
┌─────────────────────────────────────────────┐
│              Delegation Response              │
│  Annotated with: trust level, receipt chain, │
│  operations consumed, credential status       │
└─────────────────────────────────────────────┘
```

---

## Integration with Our System

### Mapping to our agents

| Agent | L3 (Credentials) | L2 (Causal) | L1 (Receipts) |
|-------|------------------|-------------|---------------|
| **Coder** | n=50 file ops per task delegation. Re-auth needed at exhaustion or QA flag. | FULL mode for all tool calls — Coder has highest attack surface (reads external data, edits files). | Receipt every file read/write/test execution. Cross-check claims in delegation response. |
| **QA** | n=20 evaluations per review cycle. Prevents review loops. | SAMPLE mode (1 in 5) — QA is read-heavy, lower injection risk. | Receipt every test run, assertion evaluation. Critical for distinguishing "test passed" (pratyakṣa) from "looks correct" (anumāna). |
| **Scout** | n=100 web fetches per research session. Bounds runaway exploration. | Not applicable (no tool calls driven by untrusted delegation). BUT epistemic tagging on web-sourced claims. | Receipt every URL fetch, search query. Enable URL re-verification. |
| **May** | Unlimited (orchestrator), but sub-credentials bounded. | Monitor for delegation chain poisoning: if sub-agent output triggers unexpected May action, counterfactual test. | Aggregate receipt chain from all sub-agents into provenance trail. |

### Implementation priority

**Phase 1 (Immediate — days, not weeks):**
- L1 receipts for Coder's file operations. This is architecturally trivial (hash inputs/outputs, sign with session key, log to ledger) and catches the highest-impact failure mode (fabricated file operations).
- Epistemic tagging on delegation responses (direct output vs. inference vs. external source).

**Phase 2 (Near-term — weeks):**
- L3 operation budgets on delegations. Add `budget: 50` to task delegation format. Agent reports consumed/remaining. Must re-request authorization when budget exhausted.
- Revocation mechanism: when Bob says "stop" or QA flags critical issue, explicit revocation propagates through delegation DAG with tracked acknowledgment.

**Phase 3 (Medium-term — month+):**
- L2 lightweight causal verification for Coder's highest-stakes actions (file deletions, external calls). Full AttriGuard requires shadow replay infrastructure; start with structural flattening + function-name match (covers most injection vectors at low cost).
- Receipt chaining across delegation boundaries (Coder receipt → May aggregation → Bob visibility).

---

## Cost-Benefit Analysis

| Layer | Latency Overhead | Token Overhead | Implementation Effort | Security Coverage |
|-------|-----------------|----------------|----------------------|------------------|
| L1 (Receipts) | <15ms | 0 | Low (pure engineering) | Fabrication, audit |
| L2 (Causal) | ~2× per verified call | ~2× per call | High (shadow replay infra) | Prompt injection |
| L3 (Credentials) | ~0 (counter check) | 0 | Medium (protocol change) | Blast radius bounding |

**Recommendation:** L1 first (highest ROI), L3 second (architectural constraint), L2 last (highest effort, highest security value for adaptive attacks).

---

## Theoretical Connections

### To our archive

| Paper | Connection to Three-Layer Stack |
|-------|---------------------------------|
| **AgenticCyOps (2603.09134)** | L1 = P3 (verified execution), L2 = P3 (verified execution, causal), L3 = P2 (capability scoping) + P5 (access-controlled isolation). Three-layer stack implements 3 of 5 AgenticCyOps principles. |
| **IH-Challenge (2603.10521)** | Orthogonal: IH training = L0 (prevention at model weights). Three-layer stack = L1-L3 (runtime detection + governance). Together = defense-in-depth. |
| **Chaotic Dynamics (2603.09127)** | AttriGuard's fuzzy survival criterion = engineering response to Chaotic Dynamics' inter-run sensitivity. BoS's deterministic bounds bypass stochasticity entirely. |
| **Introspection (2603.05414)** | AttriGuard and NabaOS both reject self-explanation. Models confabulate (Introspection) → verify externally (L1 + L2). |
| **Info-Theoretic Privacy (2603.05520)** | Receipts create audit trail that could amplify leakage. L3 credential bounds limit how much data an agent can access, providing a privacy bound complement. |
| **DPIP Common Ground (2603.05450)** | Epistemic tagging (L1) makes explicit what each agent knows from direct observation vs. inference — addressing the common ground tracking failure DPIP identified. |
| **Error Cascades (2603.04474)** | L3's delegation DAG revocation = formal mechanism for halting error cascade propagation through agent chains. |

### Emergent properties of the composition

1. **Receipt = Credential consumption proof.** Each NabaOS receipt simultaneously serves as evidence of execution (L1) AND as credential counter decrement (L3). One mechanism, two layers.

2. **Counterfactual test + receipts = full provenance.** AttriGuard verifies *why* a call was made; NabaOS verifies *that* it was made; together they produce a complete causal provenance chain: this action happened (receipt) because of this user intent (counterfactual verification).

3. **Budget exhaustion triggers review.** L3 credential exhaustion at n operations creates a natural checkpoint where L1 receipts can be bulk-audited and L2 causal assessments reviewed. The governance layer creates the cadence for verification review.

4. **Revocation cascades with evidence.** When L3 revokes a credential, the receipt chain (L1) provides the audit trail for what happened before revocation, and causal analysis (L2) can retroactively assess whether any pre-revocation actions were injection-driven.

---

## Gaps and Open Questions

1. **L2 is expensive.** Full counterfactual shadow replay at ~2× token cost per action is prohibitive for high-frequency operations. Need a risk-based sampling strategy: full L2 for high-stakes actions, statistical sampling for routine ones.

2. **L3 assumes trusted authority.** BoS requires a single trustworthy Authority Service. In our system, May plays this role but is itself an LLM agent. Options: (a) make the authority deterministic (rule-based budget management, not LLM-driven), (b) add mutual monitoring (QA audits May's delegation decisions), (c) defer to Bob for high-stakes re-authorization.

3. **Receipt chaining across agents.** NabaOS doesn't address multi-agent receipt chains. When Coder's output feeds into QA's evaluation, how do receipts compose? Proposed: each agent's output receipt becomes input evidence for the next agent's verification. Chain of receipts = provenance DAG.

4. **Adaptive attacks targeting the composition.** Each paper evaluates against attacks on its own layer. What about attacks that exploit the *interaction* between layers? E.g., an injection that stays within L3 budget, survives L2 counterfactual (because it aligns with a legitimate sub-goal), and uses only real tool calls (passing L1). This is the fundamental limit identified in AttriGuard — injected goals that overlap with legitimate ones.

5. **Self-tagging reliability.** NabaOS's epistemic classification depends on cooperative self-tagging (85-92% compliance). Under adversarial conditions, self-tagging degrades. Mitigated by: L1 receipt-based checks work regardless of self-tagging, and L2 causal attribution doesn't depend on agent self-reports at all.

6. **Latent injection via L1 receipts.** Could a compromised tool endpoint embed injection payloads in tool outputs that L1 faithfully receipts? L1 verifies execution integrity, not content safety. L2 partially covers this (causal attribution of actions driven by tool outputs), but there's a gap for pure data exfiltration via tool outputs.

---

## Summary

The three-layer verification architecture composes NabaOS (execution integrity), AttriGuard (causal authorization), and Bureaucracy of Speed (credential governance) into a defense-in-depth stack where each layer's blind spots are covered by the others. No single attack vector survives all three layers simultaneously (except the fundamental limit of perfectly-aligned injected sub-goals). Implementation should proceed L1 → L3 → L2 by increasing ROI density: receipts are nearly free, operation budgets require protocol changes, and causal verification demands infrastructure. The composition produces emergent properties (receipt = credential proof, budget exhaustion = review checkpoint, revocation + receipts = retroactive audit) that neither paper anticipated individually.

This is the most complete multi-agent verification framework in our archive, synthesized from three independent research streams that converge on the same problem from radically different traditions.
