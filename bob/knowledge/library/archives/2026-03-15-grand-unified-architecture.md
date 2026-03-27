# Synthesis: The Grand Unified Architecture (GUA)
**Status:** DRAFT
**Source:** Scout Grand Unified Synthesis (2026-03-19)
**Target:** `agents/shared/philosophy.md` + System Architecture

## Core Finding
"Multi-agent LLM systems are not simply 'multiple agents cooperating.' They are complex adaptive systems with emergent dynamics that resist intuitive design. Communication structure, protocol design, and architectural choices matter more than model capability, agent count, or individual sophistication."

## The 7 Laws (Empirically Validated)
1. **The Iteration Tax**: Every round degrades quality (ε(T) < 0). *Implication: Default to FEWER rounds.*
2. **The Intelligence Paradox**: Sophistication backfires under scarcity (C/N < 0.5). *Implication: Simplify or throttle.*
3. **Structure Over Scale**: Protocol design > Model scale (∂P/∂Φ > ∂P/∂S). *Implication: Typed interactions (DCI).*
4. **The Observer's Paradox**: A model cannot check its own prompt. *Implication: External scouring.*
5. **Topology Determines Vulnerability**: Star/Mesh = Failure. *Implication: Hierarchical/Sparse.*
6. **Memory Is the Attack Surface**: Shared memory = Vector. *Implication: 3-layer defense (Admission, Governance, Flow).*
7. **Cheap Signals Win**: Rules > LLMs. *Implication: 15ms priors first.*

## Gap Analysis (Our System vs GUA)

| GUA Requirement | Our Status | Verdict |
|-----------------|------------|---------|
| **Turn Limits** | Implicit (Heartbeat) | ⚠️ WEAK (Need hard limit) |
| **Typed Interactions** | Informal (Briefs) | ❌ MISSING (Need DCI) |
| **Hierarchical Topology** | Hub-and-Spoke (May) | ❌ VULNERABLE (Law 5) |
| **External Scouring** | Manual (Coach) | ⚠️ AD-HOC |
| **Memory Defense** | None (SIGNALS is open) | 🔴 CRITICAL RISK (Law 6) |
| **Cheap Signals** | None (All LLM) | ❌ INEFFICIENT (Law 7) |

## Recommendations

1. **Implement DCI (Typed Epistemic Acts)**: Move from free-text "chat" to typed "signals" (Propose, Challenge, Synthesize).
2. **Harden Memory (SIGNALS.md)**: Add cryptographic provenance (HMAC) to all signals.
3. **Break the Hub**: May is a single point of failure/contagion. Decompose into specialized sub-teams (Research, Dev, Ops).
4. **Enforce Turn Limits**: Hard cap of 3 rounds for any deliberation.

## Action Plan
1. **Phase 1 (Immediate)**: Update `philosophy.md` with the 7 Laws.
2. **Phase 2 (Protocol)**: Design DCI protocol for inter-agent communication.
3. **Phase 3 (Security)**: Implement HMAC for `SIGNALS.md` entries.
