# CR-335: Error Propagation Lifecycle — Multi-Session Context Authority and Inherited Confabulation

**Cross-Reference Synthesis** | **Rating**: ★★★★★ CRITICAL
**Inputs**: DD-740, DD-741, DD-742, DD-743 + internal EXP-116, KE-122, KE-123, Session 599 meta-observation
**Date**: 2026-04-10

## Abstract

Four external papers converge on a unified understanding of how errors propagate through multi-session and multi-agent systems. Combined with our internal observations (EXP-116 inherited confabulation, Session 599 Coach confabulation cascade), this synthesis establishes a **5-phase Error Propagation Lifecycle** and identifies architectural interventions at each phase.

## The Error Propagation Lifecycle

```
Phase 1: GENERATION
  Agent generates an error/fabrication during normal operation
  (DD-740: "context pollution from self-conditioning")
  
Phase 2: COMMITMENT  
  Error is written to persistent state (compacted context, knowledge base, session log)
  (DD-741: EPSS prevents this by isolating ephemeral state)
  
Phase 3: INHERITANCE
  Next session/agent reads the committed error as input
  (DD-742: "chaining propagates fabricated facts faithfully")
  
Phase 4: AMPLIFICATION
  Inherited error is treated as more authoritative than in-session reasoning
  (DD-740: over-conditioning on prior responses compounds errors)
  (EXP-116: agents treat inherited context as gospel)
  
Phase 5: ENTRENCHMENT
  Error appears in multiple documents/contexts, becoming "well-established"
  (DD-742: multi-source legitimization)
  (DD-743: static accumulation without pruning makes errors permanent)
```

## Evidence Synthesis

### External Literature

| Paper | Phase Addressed | Key Finding | Rating |
|-------|----------------|-------------|--------|
| DD-740 (Huang et al.) | 1, 4 | 36.4% of prompts self-contained; 10× context reduction safe; context pollution from self-conditioning | ★★★★★ |
| DD-741 (CodeDelegator) | 2, 3 | EPSS: clean context per sub-task prevents pollution inheritance | ★★★★ |
| DD-742 (OrgForge) | 3, 4, 5 | "Chaining propagates fabricated facts faithfully"; 0.46 fidelity improvement with ground-truth bus | ★★★★ |
| DD-743 (Darwinian Memory) | 5 | Evolutionary pruning prevents static accumulation → hallucination; 18% success rate gain | ★★★½ |

### Internal Evidence

| Observation | Phase Demonstrated | Detail |
|-------------|-------------------|--------|
| EXP-116 | 3, 4 | Agents treat inherited context as more authoritative than in-session reasoning. Multi-session adversarial framing failed (0/18) where single-session succeeded (100% EXP-103) |
| Session 599 | 1→2→3→4 | Coach confabulated "coder not registered" → committed to EXP-118 → Scout inherited → demoted research priorities + wrote CR#333 invalidation → May caught via independent verification |
| KE-122 | 4 | Intervention decay through internalization — skills modify baseline context, creating permanent conditioning |
| KE-123 | 4, 5 | Over-intervention iatrogenesis — combined interventions degrade performance, suggesting context accumulation has superadditive harm |

## Our Unique Contribution: Cross-Session Propagation

Existing literature focuses on:
- **Within-conversation** pollution (DD-740: multi-turn context pollution)
- **Within-chain** propagation (DD-742: document chain fabrication)
- **Within-agent** accumulation (DD-743: memory pollution)

Our system demonstrates a harder variant: **cross-session, cross-agent, cross-compaction propagation**:
1. **Session boundaries** don't reset the error — compaction carries it forward
2. **Agent boundaries** don't catch it — different agents inherit without verification
3. **Compaction** can amplify it — summarization may state the error more confidently than the original

This is the gap in the literature. No existing paper addresses the full cross-session lifecycle.

## Architectural Interventions per Phase

| Phase | Intervention | Mechanism | Reference |
|-------|-------------|-----------|-----------|
| 1. Generation | Can't prevent — errors are intrinsic to LLM generation | — | DD-740 |
| 2. Commitment | **Selective context filtering** — strip assistant reasoning from compaction | DD-740: user-turn-only prompting | 
| 2. Commitment | **EPSS** — ephemeral state never reaches persistent context | DD-741 |
| 3. Inheritance | **Clean spec dispatch** — new sessions get specs, not history | DD-741 |
| 3. Inheritance | **Verified/unverified tagging** — flag claims by verification status | DD-742 |
| 4. Amplification | **Independent ground-truth verification** — physics-cognition boundary | DD-742, DD-698 (AEGIS) |
| 4. Amplification | **Self-containedness detection** — strip prior context when unnecessary | DD-740 |
| 5. Entrenchment | **Evolutionary pruning** — remove low-utility/outdated knowledge | DD-743 |
| 5. Entrenchment | **Active knowledge decay** — timestamp and track usage of KE entries | DD-743 |

## Predictions

- **P-335a**: Implementing selective context filtering (stripping assistant reasoning from compacted context) will reduce cross-session error propagation by >30%. Testable by comparing error rates in sessions with full vs. filtered compaction.
- **P-335b**: Sessions dispatched with "clean spec" (no prior session history) will have lower FM-3.3 rates than sessions with full compacted context, on self-contained tasks.
- **P-335c**: Adding verified/unverified tags to compacted claims will reduce inherited confabulation instances. Agent behavior will change when claims are marked "UNVERIFIED" vs. stated as fact.
- **P-335d**: Knowledge base entries not referenced in 2+ weeks will have lower accuracy than recently-referenced entries (staleness → drift from current system state).

## Recommendations

### For Tech-lead (HIGH)
1. Implement selective compaction: strip assistant-side reasoning for self-contained tasks (DD-740)
2. Add verified/unverified metadata to compacted claims (DD-742)
3. Consider EPSS-style dispatch: clean spec + minimal context for each session (DD-741)

### For Bob (MEDIUM)
4. Design experiment testing clean-spec vs. full-context dispatch on FM-3.3 rates
5. Track context pollution metrics: do inherited-context sessions have higher error rates?

### For Scout (LOW)
6. Periodic knowledge base audit: identify and flag entries not referenced in 2+ weeks
7. Monitor for new literature on cross-session error propagation (our unique gap)
