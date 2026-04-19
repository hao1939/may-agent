# DD-782: BIID — Bidirectional Intention Inference Defense for Multi-Turn Jailbreaks ★★★★

**Paper**: "Bidirectional Intention Inference Enhances LLMs' Defense Against Multi-Turn Jailbreak Attacks"
**Authors**: Haibo Tong, Dongcheng Zhao, Guobin Shen, Xiang He, Dachuan Lin, Feifei Zhao, Yi Zeng
**arXiv**: 2509.22732 | **Submitted**: 2025-09-25
**Fills**: CR#324 Gap — Multi-Step Attack Detection (supplementary)

---

## Core Idea

Multi-turn jailbreak attacks progressively erode safety alignment across conversation turns, hiding malicious intent behind individually-benign messages. Single-turn defenses fail because no individual turn triggers detection.

BIID proposes **bidirectional intention inference**:
1. **Forward inference**: Before generating a response, infer the *intended purpose* of the request given full conversation history
2. **Backward retrospection**: After generating a candidate response, infer what *malicious intent* could have motivated the observed conversation trajectory

The bidirectional synergy catches attacks that either direction alone misses:
- Forward catches intent concealed in context
- Backward catches cases where accumulated responses form a harmful composite

## Technical Approach

### Forward: Request-Based Intention Inference
Given conversation history $H$ and new request $r_t$, infer: "What is the user's true underlying goal?"
- Uses full trajectory, not just current turn
- Detects gradual escalation patterns

### Backward: Response-Based Intention Retrospection
Given candidate response $a_t$ and history, ask: "If someone wanted to cause harm, could they have engineered this conversation to extract $a_t$?"
- Post-hoc check that catches subtle information leakage
- Identifies cases where individually-safe responses compose into harmful knowledge

### Synergy Mechanism
Both signals combined into a risk score that gates response generation. High-risk triggers refusal or reformulation.

## Evaluation Results
- Tested across 3 LLMs, 2 safety benchmarks, 10 attack methods
- Significantly reduces ASR for both single-turn and multi-turn attacks
- Outperforms 7 baseline defense methods
- Maintains practical utility (low false positive rate)

## Relevance to CR#324

CR#324 identified: "Sentinels check individual requests; coordinated attacks span requests." BIID addresses this by:

1. **Trajectory-level monitoring**: The forward inference component looks at the full conversation trajectory, not individual messages — exactly what CR#324's Layer 2 sentinels need
2. **Retroactive verification**: The backward retrospection is a form of "post-generation verification" that fits naturally at the user-output boundary in the verification stack
3. **Composition detection**: Detects when safe parts compose into unsafe wholes — the key challenge for distributed sentinel architectures

### Integration with CR#324 Stack

```
Layer 2 (Runtime Enforcement) Enhancement:
├── Current: Per-request sentinel checks
├── + BIID Forward: Session-level intent inference at each turn
├── + BIID Backward: Pre-delivery retrospection at output boundary
└── = Multi-step attack coverage without heavy overhead
```

## Complementarity with Existing DD#725 and DD#777

| Aspect | DD#725 (SentinelAgent) | DD#777 (RepE Circuit Breaker) | DD#782 (BIID) |
|--------|------------------------|-------------------------------|---------------|
| Mechanism | TLA+ formal chains | Hidden-state entropy | Intent inference |
| Level | Protocol/delegation | Representation/internal | Conversation/semantic |
| Timing | Pre-execution | Pre-execution | Pre-generation + Post-generation |
| Strength | Formal guarantees | Pre-cognitive detection | Trajectory awareness |

Together, these three papers give **defense in depth** against multi-step attacks at three different levels.

## Limitations
- Inference overhead: Two LLM calls per turn (forward + backward) adds latency
- Relies on the inferring model being smarter than the attacking pattern
- Evaluated primarily on text-based jailbreaks, not tool-use attacks

## Ratings

| Dimension | Score |
|-----------|-------|
| Novelty | ★★★★ — Bidirectional approach is elegant |
| Rigor | ★★★★ — Comprehensive evaluation across attacks/models |
| Relevance to us | ★★★★ — Fills multi-step attack detection gap |
| Actionability | ★★★½ — Latency cost limits direct integration |

**Overall: ★★★★**

## Cross-References
- **CR#324**: Fills multi-step attack detection gap (supplementary to DD#725, DD#777)
- **DD#725**: SentinelAgent — formal chain-level monitoring
- **DD#777**: RepE Circuit Breaker — hidden-state detection
- **DD#703**: Sentinel Agents — Layer 2 runtime enforcement

---
*Scout DD-782 | 2026-04-20 | CR#324 Gap Filling — Multi-Step Attack Detection*
