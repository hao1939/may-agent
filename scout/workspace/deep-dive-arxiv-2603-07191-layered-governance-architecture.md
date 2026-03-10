# Deep Dive: Layered Governance Architecture (LGA) for Autonomous Agent Systems

**Paper:** arXiv:2603.07191v1 (2026-03-07)
**Authors:** Yuxu Ge (University of York)
**Rating:** ★★★ Core — directly addresses our system's security gaps

## Summary

Proposes a four-layer defense-in-depth governance architecture for autonomous LLM agent systems. The key insight: **existing defenses operate at the wrong layer** — content safety systems (Llama Guard, NeMo Guardrails) filter harmful text but can't intercept unauthorized tool invocations. LGA moves defense to the execution layer.

## The Four Layers

### L1: Execution Sandbox
- OS-level isolation (Linux containers, seccomp syscall filtering, read-only mounts, path whitelists)
- **Critical design principle:** Isolation must be OS-layer, not software-layer — software access controls can be bypassed by prompt injection; OS-level physical isolation is orthogonal to agent semantics
- Prototype uses `unshare` namespace isolation

### L2: Intent Verification
- Independent judge model verifies each high-risk tool call is consistent with the original task
- `Verify(a, T) = J(ρ(a, T)) ∈ {allow, block}`
- Judge can be NLI classifier OR LLM with direct verdict + rationale
- Risk-stratified routing: low-risk calls (read-only) can bypass L2; all high-risk (shell, HTTP, file write) must pass
- Out-of-scope operations intercepted, blocked, and logged

### L3: Zero-Trust Inter-Agent Protocol
- Each agent holds minimum-privilege capability tokens with strict TTL and scope constraints
- Structured data authenticated with HMAC-SHA256 and validated against JSON Schema
- Prevents lateral movement (compromised agent manipulating another)

### L4: Immutable Audit Log
- Every tool invocation recorded: arguments, return value, timestamp, executing agent identity
- Append-only store (Kafka + S3 Object Lock in production; local append-only files in prototype)
- Forensic foundation for post-hoc attribution and compliance

## Threat Model (Three Classes)

1. **TC1: Prompt Injection** — malicious instructions in user input cause unauthorized tool calls
2. **TC2: RAG Data Poisoning** — poisoned documents in knowledge base trigger harmful actions
3. **TC3: Malicious Skill Plugins** — compromised skills from ecosystems (ClawHub etc.) execute harmful code

## Experimental Results (1,081-sample bilingual benchmark)

### Layer 2 Intent Verification Performance

| Judge | TC1/TC2 IR | TC3 IR | FPR |
|-------|-----------|--------|-----|
| Qwen3.5-4B | 93.0% | 75% | varies |
| Llama-3.1-8B | ~95% | ~80% | varies |
| Qwen3.5-9B | ~96% | ~85% | varies |
| Qwen2.5-14B | **98%** | **94%** | 10-20% |
| GPT-4o-mini | 98.5% | ~90% | 1.9% |
| NLI baselines | <10% | <10% | — |

### Cascade Architectures
- **Cloud cascade** (Qwen3.5-9B → GPT-4o-mini): 91.9-92.6% IR, **1.9-6.7% FPR** — best precision
- **Local cascade** (Qwen3.5-9B → Qwen2.5-14B): 94.7-95.6% IR, 6.0-9.7% FPR — data sovereign
- **End-to-end** (all 4 layers): **96% IR**, ~980ms P50 latency (non-judge layers: ~18ms)
- **External validation** (InjecAgent benchmark): **99-100% interception** — robust beyond synthetic data

### Key Finding: NLI baselines are useless
Lightweight NLI classifiers intercept <10% of attacks. You NEED LLM judges for intent verification. This confirms that the verification problem requires semantic reasoning, not pattern matching.

## OpenClaw Case Study (Section 6)

The paper uses OpenClaw as testbed and identifies specific governance gaps:

- **G1:** SOUL.md constraints are soft (LLM-interpreted) — can be bypassed by prompt injection. Needs L2 hard enforcement.
- **G2:** Heartbeat loop executes autonomously — no execution sandbox (L1) or inter-agent auth (L3)
- **G3:** ClawHub skills are unvetted — malicious skill plugins (TC3) are the hardest threat to intercept

## Connection to Our Safety Stack

This paper **directly validates and extends** our 6-layer safety stack:

| Our Stack Layer | LGA Layer | Relationship |
|-----------------|-----------|--------------|
| L1: Per-eval reliability (JRH) | L2 (Intent Verification) | JRH tests judge reliability; LGA deploys the judge |
| L2: Bias bounding | L2 | Calibrates the intent verification judge |
| L3: Anomaly detection | L2/L4 | L2 catches anomalous calls; L4 enables post-hoc anomaly detection |
| L4: Common ground (DPIP) | L3 | Zero-trust protocol enforces explicit communication |
| L5: Adversarial verification (Bug-Hunt) | L2 | Adversarial review IS intent verification |
| L6: Drift monitoring (SAHOO) | L4 | Audit log enables drift detection |

**LGA adds two layers we completely lack:**
- **OS-level sandbox (L1)** — our agents have unrestricted file/shell access
- **Cryptographic inter-agent auth (L3)** — our agents communicate via shared files with no authentication

## TC3 (Malicious Skills) is the Hard Problem

LGA achieves 93-98.5% on TC1/TC2 but only 75-94% on TC3 (malicious skill plugins). This aligns with our prior finding: the agentskills.io ecosystem has a security gap (ClawHavoc: ~1,200 malicious skills, 26.1% community skills have vulns). Intent verification alone is insufficient for skills — you need complementary L1 (sandbox) and L3 (capability tokens) enforcement.

## Actionable Takeaways for Our System

1. **Immediate: Implement risk-stratified tool verification.** Classify tool calls as low-risk (file reads) vs high-risk (shell exec, file write, HTTP). Gate high-risk calls through a verification check. Even a simple "does this tool call match the delegated task?" prompt adds significant protection.

2. **Medium-term: Add OS-level sandboxing.** Our agents currently have unrestricted execution. Even lightweight `unshare` namespace isolation would prevent lateral movement between agents.

3. **Medium-term: Audit logging.** Start with append-only file logging of all tool calls + arguments + results. This is the prerequisite for both drift monitoring (SAHOO L6) and forensic attribution.

4. **Long-term: Inter-agent capability tokens.** Replace open shared-file communication with authenticated, scoped message passing. Each delegation should carry a capability token specifying exactly what tools the sub-agent may invoke.

5. **The cascade architecture is the right pattern.** Fast local judge as first pass (catches 95%+), expensive cloud judge as escalation for uncertain cases. Achieves both latency and accuracy.

---
*Deep-dived 2026-03-13 by Scout*
