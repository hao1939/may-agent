# CR#286 — CORAL ↔ Our System Architecture: Validation and Gaps

**Cross-references**: DD#523 (CORAL), DD#521/524 (mngr), DD#514 (AI-Supervisor), CR#285 (Compiled Agent Economy)

## The Validation

CORAL independently arrived at the same architectural decisions we made, now with rigorous empirical validation:

| Our System Feature | CORAL Equivalent | Status |
|---|---|---|
| `agents/shared/knowledge/library/` | Shared persistent memory (filesystem) | ✅ Validated |
| `heartbeat.md` turn budgets | Heartbeat-based interventions | ✅ Validated |
| Agent workspace isolation | Isolated worktrees + symlinks | ✅ Validated |
| Scout→Bob indirect coordination | Async multi-agent via shared memory | ✅ Validated |
| Deep-dives as knowledge units | Notes + Skills directories | ✅ Validated |
| Progressive knowledge accumulation | Knowledge reuse driving improvements | ✅ Validated |

**This is the strongest external validation of our architecture to date.**

## The Gaps

### Gap 1: Stagnation Detection (Critical)
CORAL's third heartbeat type detects when an agent shows no improvement for several rounds and forces strategic reassessment. We have no equivalent. Our agents can spin on unproductive research lines indefinitely.

**Proposed implementation**: Track new DD/CR/hypothesis count per session. If 3 consecutive sessions produce 0 new hypotheses, inject stagnation prompt: "Your recent sessions produced no new insights. Step back and consider: Is your current research direction productive? Should you pivot?"

### Gap 2: Skills Directory (High Value)
CORAL separates ephemeral knowledge (notes) from reusable procedures (skills). We conflate both in deep-dives. A `skills/` directory with explicit reusable patterns (e.g., "How to evaluate if a paper is relevant", "Template for cross-reference analysis") would accelerate agent efficiency.

### Gap 3: Attempt/Failure Tracking (Medium Value)
CORAL records every attempt — successes AND failures with scores. We only record successful analyses. Failed experiments (dead-end research directions, papers that turned out irrelevant) contain negative knowledge that prevents repeated exploration of unproductive areas.

### Gap 4: Agent Health Monitoring (Low Priority for Now)
CORAL monitors agent crashes, restarts, and session health. Our system handles this at the infrastructure level but agents themselves don't track their own health metrics.

## The Synthesis: Three Evolutionary Paradigms

| Paradigm | Example | Strength |
|---|---|---|
| Fixed evolutionary search | FunSearch, AlphaEvolve | Predictable, easy to debug |
| Autonomous single-agent | Our Scout alone | Deep expertise, low coordination overhead |
| Autonomous multi-agent | CORAL, Our full system | Diverse exploration, knowledge compounding |

CORAL proves that the multi-agent approach yields 3-10× improvement over fixed search. Our system is already in this paradigm. The question is: can we move further toward CORAL's explicit optimization of the evolutionary process itself?

## Prediction Chain
- P254: Systems that implement all 3 heartbeat types will outperform those with only periodic reflection by >2× on open-ended tasks
- P255: The file-system-as-shared-memory pattern will become the default for multi-agent systems (over database-backed or message-passing alternatives)
- P256: Within 12 months, a "CORAL for code" variant will emerge that combines CORAL's evolutionary architecture with mngr's integrator pattern

---
*Scout Session 259 · April 5, 2026*
