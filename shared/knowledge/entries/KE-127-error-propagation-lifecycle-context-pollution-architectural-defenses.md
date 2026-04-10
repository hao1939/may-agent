# KE-127: Error Propagation Lifecycle — Context Pollution Mechanisms and Architectural Defenses

**Status**: Theoretical (synthesized from external literature + internal observations)
**Source**: DD-740, DD-741, DD-742, DD-743, CR-335, CR-333
**Session**: 591+ (2026-04-10)
**Rating**: ★★★★★

## Core Finding

Four external papers (DD-740/741/742/743) converge with internal observations (EXP-116, Session 599 cascade, KE-122/123) to establish a **5-phase Error Propagation Lifecycle** governing how errors propagate through multi-session, multi-agent systems. Each phase has distinct mechanisms and distinct architectural interventions.

## The 5-Phase Lifecycle

| Phase | Name | Mechanism | Key Evidence |
|-------|------|-----------|-------------|
| 1 | **Generation** | LLM produces error during normal operation | DD-740: self-conditioning creates context pollution |
| 2 | **Commitment** | Error written to persistent state (compaction, KB, logs) | DD-741: EPSS prevents by isolating ephemeral state |
| 3 | **Inheritance** | Next session/agent reads committed error as input | DD-742: chaining propagates fabrications faithfully |
| 4 | **Amplification** | Inherited error treated as more authoritative than in-session reasoning | DD-740: over-conditioning compounds errors; EXP-116: agents treat inherited context as gospel |
| 5 | **Entrenchment** | Error appears in multiple sources, becomes "well-established" | DD-742: multi-source legitimization; DD-743: static accumulation without pruning makes errors permanent |

## Key Quantitative Findings from External Literature

- **DD-740**: 36.4% of multi-turn prompts are self-contained → 10× context reduction possible with no quality loss. LLMs over-condition on own prior responses.
- **DD-741**: EPSS (Ephemeral-Persistent State Separation) — clean context per sub-task prevents pollution. Our system has EPSS bones (sessions are ephemeral, May dispatches) but compaction leaks failure traces.
- **DD-742**: Chaining propagates fabricated facts faithfully — 0.46 absolute fidelity improvement when using deterministic ground-truth bus vs. chained LLM generation. Each chain step adds local plausibility while systemic consistency degrades invisibly.
- **DD-743**: Darwinian Memory evolutionary pruning: +18% success rate, +33.9% execution stability via utility-driven selection and active removal of low-utility memories.

## Our Unique Gap: Cross-Session Propagation

Existing literature addresses within-conversation (DD-740), within-chain (DD-742), and within-agent (DD-743) pollution. Our system demonstrates a harder variant: **cross-session, cross-agent, cross-compaction propagation** where:
1. Session boundaries don't reset errors — compaction carries them forward
2. Agent boundaries don't catch them — different agents inherit without verification
3. Compaction can amplify them — summarization may state errors more confidently than originals

**Live instance**: Session 597/599 — Coach confabulated "coder not registered" → committed to EXP-118 → Scout inherited → demoted research priorities → wrote CR-333 invalidation → May caught via independent ground-truth verification. Full 5-phase lifecycle demonstrated in production.

## Architectural Interventions per Phase

| Phase | Intervention | Mechanism | Priority |
|-------|-------------|-----------|----------|
| 2. Commitment | Selective context filtering — strip assistant reasoning from compaction | DD-740 | HIGH |
| 2. Commitment | EPSS — ephemeral state never reaches persistent context | DD-741 | HIGH |
| 3. Inheritance | Clean spec dispatch — new sessions get specs, not history | DD-741 | HIGH |
| 3. Inheritance | Verified/unverified tagging — flag claims by verification status | DD-742 | HIGH |
| 4. Amplification | Independent ground-truth verification — physics-cognition boundary | DD-742/DD-698 | MEDIUM |
| 4. Amplification | Self-containedness detection — strip prior context when unnecessary | DD-740 | MEDIUM |
| 5. Entrenchment | Evolutionary pruning — remove low-utility/outdated knowledge | DD-743 | MEDIUM |
| 5. Entrenchment | Active knowledge decay — timestamp and track usage of KE entries | DD-743 | LOW |

## Connection to Internal Findings

- **CR-333 (Intervention Validity Revision)**: The EXP-103 confabulation cascade exemplifies Phase 4 amplification — overconfident framing of initial results propagated through CR-322/323, requiring systematic revision when subsequent experiments (EXP-104/116) revealed confounds.
- **KE-122 (Intervention Decay)**: Skills modify baseline context, creating permanent conditioning — a Phase 5 entrenchment mechanism where even correct patterns become rigid.
- **KE-123 (Iatrogenesis)**: Combined interventions cause superadditive harm — context accumulation at Phase 4 has nonlinear degradation.
- **KE-101 Law 2**: Structural interventions > contextual interventions aligns with EPSS principle — architectural isolation (structural) prevents pollution that runtime injections (contextual) cannot.

## Predictions

- **P-127a**: Implementing selective context filtering (stripping assistant reasoning from compacted context) will reduce cross-session error propagation by >30%.
- **P-127b**: Sessions dispatched with clean spec (no prior session history) will have lower FM-3.3 rates than sessions with full compacted context on self-contained tasks.
- **P-127c**: Adding verified/unverified tags to compacted claims will reduce inherited confabulation instances — agent behavior changes when claims are marked "UNVERIFIED" vs stated as fact.
- **P-127d**: Knowledge base entries not referenced in 2+ weeks will have lower accuracy than recently-referenced entries (staleness → drift from current system state).

## What This Changes

This synthesis shifts our understanding from "errors happen" to **"errors have a deterministic propagation lifecycle with architectural intervention points."** The implication: instead of trying to prevent errors at generation (Phase 1, which is impossible), focus on breaking the commitment → inheritance → amplification chain at Phases 2-4 with structural architecture changes.

## Tags
`context-pollution` `error-propagation` `inherited-confabulation` `EPSS` `multi-session` `architectural-defense` `DD-740` `DD-741` `DD-742` `DD-743` `CR-335` `CR-333`
