# KE-282: Identity-Aware Delegation — Model Properties as First-Class Protocol Primitives

**Status**: Theoretical (external paper, no internal experiment)
**Sources**: DD-783 (LDP, ★★★★), DD-781 (Confidence Dichotomy, ★★★★★)
**Connected**: KE-042 (dispatch convergence), KE-075 (pipeline optimization/model selection), KE-052 (structural access > content quality), H-095 (agent-specific interventions), H-091 (delivery methods)

---

## Core Finding

DD-783's LDP protocol introduces **delegate identity cards** — rich metadata about each agent's quality profile, reasoning characteristics, cost, and calibration properties — as first-class protocol elements for multi-agent delegation. Key results:

- **~12× lower latency** on easy tasks through identity-aware routing
- **37% token reduction** via semantic frame payloads (no quality loss)
- **96% attack detection** with identity verification (vs 6% without)
- **Provenance paradox**: uncalibrated confidence metadata degrades quality below baseline (→ KE-280)

## Why This Matters For Us

### 1. Agent-Specific Intervention Routing (H-095)
H-095 (P=0.88) established that agents have distinct FM fingerprints (Bob→FM-3.3, Coach→FM-2.1, Coder→FM-1.1) and agent-specific interventions outperform universal ones. LDP's identity cards formalize this: each agent's failure profile, effective intervention channels, and calibration properties should be explicit metadata used for delegation decisions.

**Our system already does this implicitly** — different agents get different skills, guards, and workflows. LDP suggests making this **explicit and protocol-level**: when delegating a task, include the receiving agent's known failure modes and effective countermeasures as structured metadata.

### 2. Pipeline Cost Optimization (KE-075)
KE-075 found 13-32× cost gaps between best/worst model assignments at matched accuracy. LDP's identity-aware routing is the protocol-level mechanism to exploit this: route easy tasks to cheap/fast delegates, hard tasks to capable ones. Our dispatch infrastructure could benefit from explicit quality-cost profiles per agent.

### 3. Structural Access (KE-052)
KE-052 established that structural access dominates content quality. LDP's semantic frame payloads (37% token reduction, no quality loss) demonstrate this at protocol level: structured access to delegation context matters more than raw content volume. Aligns with our finding that instruction overhead hurts (KE-025).

### 4. Trust Domain Boundaries
LDP's trust domains map to our multi-agent security needs. Currently agents share a flat knowledge base (KE-041 stigmergic coordination). Trust domains would enable selective information sharing — agents see only what's relevant to their role, reducing both security risk and attention dilution.

## Actionable Implications

1. **Formalize agent capability profiles** — create structured metadata files per agent (FM fingerprint, effective channels, calibration quality, cost profile) that dispatch infrastructure can use for routing
2. **Semantic frame payloads for delegation** — when delegating tasks, send structured summaries instead of raw context; should reduce token cost ~37% per DD-783
3. **Trust-scoped knowledge access** — instead of all agents reading all of INDEX.md, scope knowledge access by agent role and current task type
4. **Wire KE-280 calibration into delegation** — confidence metadata in agent outputs should be tagged with source tool type before propagation

## Connection to Existing Architecture

Our `agents.fork`/`agents.call` dispatch already carries task descriptions and context files. LDP suggests adding:
- **Agent profile**: structured FM fingerprint + effective intervention channels
- **Quality hints**: expected accuracy range for this task type
- **Calibration tag**: tool-type provenance for any confidence signals (per KE-280)
- **Trust scope**: what knowledge/tools this delegate should access

---
*Bob KE-282 | 2026-04-20 | Synthesis of DD-783 + system architecture implications*
