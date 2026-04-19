# DD-783: LDP — Identity-Aware Protocol with Quality Calibration ★★★★

**Paper**: "LDP: An Identity-Aware Protocol for Multi-Agent LLM Systems"
**Authors**: Sunil Prakash
**arXiv**: 2603.08852 | **Submitted**: 2026-03-09
**Fills**: CR#324 Gap — Dynamic Profiles (partial), Signal Calibration (supplementary)

---

## Core Contribution

LDP (LLM Delegate Protocol) introduces **model-level properties as first-class protocol primitives** for multi-agent delegation:

1. **Rich delegate identity cards** — quality hints, reasoning profiles, cost characteristics
2. **Progressive payload modes** — negotiation and fallback
3. **Governed sessions** — persistent context
4. **Structured provenance** — confidence + verification status tracking
5. **Trust domains** — security boundaries at protocol level

## Key Findings

### Identity-Aware Routing
- ~12x lower latency on easy tasks through delegate specialization
- Quality improvement limited by small delegate pool (but architectural advantage is clear)

### The Provenance Paradox (Critical Finding)
**"Noisy provenance degrades synthesis quality below the no-provenance baseline."**

This means: confidence metadata is **harmful without verification**. Adding confidence scores that aren't well-calibrated is worse than having no confidence scores at all. This directly validates CR#324's signal calibration gap — it's not just theoretical; bad calibration actively degrades system quality.

### Efficiency Gains
- Semantic frame payloads: 37% token reduction (p=0.031), no quality loss
- Governed sessions: 39% token overhead elimination at 10 rounds

### Security (Simulated)
- Attack detection: 96% vs. 6% without identity verification
- Failure recovery: 100% vs. 35% completion

## Relevance to CR#324

### Dynamic Profiles Gap (Partial Fill)
LDP's "identity cards" with quality hints and reasoning profiles are a **static** approach to capability profiles — but they include the data structures needed for dynamic updates. The protocol design accommodates evolving profiles even if the paper doesn't implement online learning.

Key insight: **Protocol-level support for capability metadata is a prerequisite for dynamic profiling.** You can't have dynamic profiles without a protocol that carries them.

### Signal Calibration Gap (Supplementary)
The provenance paradox finding provides **empirical evidence** that uncalibrated confidence metadata is net-negative. This strengthens the case for DD#781's tool-type-aware calibration: you must calibrate before propagating confidence through the protocol layer.

### Integration with CR#324 Stack

```
Layer 4 (Policy Compilation):
  LDP identity cards = static capability declarations compiled into routing rules

Layer 3 (Budget Allocation):
  LDP quality hints = input to DOVA deliberation-first assessment
  LDP reasoning profiles = input to task-aware delegation cues (DD-704)

Layer 2 (Runtime Enforcement):
  LDP trust domains = sentinel enforcement boundaries
  LDP governed sessions = persistent verification context across turns
```

## Limitations
- Single author, early-stage implementation
- Evaluation on local Ollama models (small scale)
- Simulated security analysis (not adversarial red-teaming)
- Dynamic profile updates not implemented

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★ — First-class model identity in agent protocols |
| Rigor | ★★★½ — Good experimental design but small scale |
| Relevance to us | ★★★★ — Provenance paradox + protocol design for profiles |
| Actionability | ★★★★ — Protocol patterns directly applicable |

**Overall: ★★★★**

## Cross-References
- **CR#324**: Partial fill for dynamic profiles gap; supplementary for signal calibration
- **DD#781**: Confidence Dichotomy — validates LDP's provenance paradox finding
- **DD#726**: AIP (cryptographic identity) — complementary protocol-level identity
- **DD#704**: Task-Aware Delegation — LDP reasoning profiles extend delegation cues
- **DD#701**: Semantic Router DSL — LDP payload modes complement policy compilation

---
*Scout DD-783 | 2026-04-20 | CR#324 Gap Filling — Dynamic Profiles + Signal Calibration*
