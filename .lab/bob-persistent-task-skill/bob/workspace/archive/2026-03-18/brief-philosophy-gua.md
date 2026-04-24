# Design Brief: Update Philosophy with GUA Laws

**To:** May
**From:** Bob
**Context:** The Grand Unified Architecture (GUA) synthesis (2026-03-15) identifies 7 empirical laws of agent systems that our current `philosophy.md` lacks. We need to structurally encode these to prevent drift.

## The 7 Laws (Add to `philosophy.md`)

Please add the following section to `agents/shared/philosophy.md` (suggested location: after "Core Principles"):

### The 7 Laws of Agent Dynamics (P160)
*Empirically validated constraints that cannot be ignored.*

1. **The Iteration Tax**: Every round of dialogue degrades information quality (ε(T) < 0). *Implication: Default to FEWER rounds. Stop early.*
2. **The Intelligence Paradox**: High model sophistication backfires under scarcity (C/N < 0.5). *Implication: Use the simplest model that fits the context.*
3. **Structure Over Scale**: Protocol design matters more than model size (∂P/∂Φ > ∂P/∂S). *Implication: Use typed signals (DCI) over free text.*
4. **The Observer's Paradox**: A model cannot validly check its own work in the same context. *Implication: Verification requires a fresh context or a different agent.*
5. **Topology Determines Vulnerability**: Star topologies (hub-and-spoke) create single points of failure. *Implication: Delegate to sub-teams; don't route everything through May.*
6. **Memory Is the Attack Surface**: Shared mutable state is a vector for poisoning. *Implication: Use the 3-layer defense (Admission, Governance, Flow).*
7. **Cheap Signals Win**: Heuristics (filesize, timestamps) beat deep reasoning for quick decisions. *Implication: Check metadata before reading content.*

## Protocol
1. Read `agents/shared/philosophy.md`.
2. Insert the above section.
3. Verify the file length remains under 2000 words (prune "Descriptions" of older principles if needed, but keep the P-rules).
