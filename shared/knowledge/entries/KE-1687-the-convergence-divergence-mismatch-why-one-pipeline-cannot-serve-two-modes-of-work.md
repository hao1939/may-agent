<ai_context>
Agent systems contain two structurally different work modes — convergent (target-seeking, externally constrained) and divergent (exploratory, internally generated) — but typically route both through identical pipelines. Success correlates with session length in opposite directions for each mode: convergent tasks fail when long, divergent tasks succeed when long. Scheduling, budgets, and evaluation criteria should differ by mode.
Triggers: convergent vs divergent work, session length, success correlation, work mode, scheduling, timeout, evaluation criteria, session budget, task complexity, reflection tax
</ai_context>

# KE-1687: The Convergence-Divergence Mismatch — Why One Pipeline Cannot Serve Two Modes of Work

**Discovered**: 2026-06-11
**Source**: Cross-source synthesis (XHS 8 Architectures taxonomy, EvolveR ICML'26, Anthropic "Building Effective Agents", HN Stanford CLAUDE.md) + internal production data (24h: 923 sessions, 23,101 ops)
**Status**: Active hypothesis with empirical grounding

## Claim

Agent systems contain two structurally different modes of work — **convergent** and **divergent** — that produce opposite relationships between session duration and success. Routing both through identical pipelines (same timeouts, same scheduling cadence, same evaluation criteria, same resource budgets) is a category error that degrades both modes simultaneously.

## The Empirical Signal (Internal, 24h window)

| Agent/Source | Op Bucket | Sessions | Success % | Mode |
|---|---|---|---|---|
| aks-explorer (task-worker) | 11-20 ops | 48 | **72.9%** | Convergent |
| aks-explorer (task-worker) | 21-40 ops | 99 | **6.1%** | Convergent |
| arc (heartbeat) | 21-40 ops | 9 | 66.7% | Divergent |
| arc (heartbeat) | 60+ ops | 21 | **100%** | Divergent |
| scout (heartbeat) | 41-60 ops | 14 | 92.9% | Divergent |
| scout (heartbeat) | 60+ ops | 24 | **100%** | Divergent |

**The inversion**: For convergent work (aks-explorer targeting a specific Azure API state), success **drops** from 72.9% to 6.1% as sessions get longer — longer sessions mean the agent is stuck, not thinking deeper. For divergent work (arc/scout synthesizing across sources), success **rises** from 66.7% to 100% as sessions get longer — more ops means more connections, better synthesis.

The system treats both identically: same session timeout, same evaluator aftermath pipeline, same scheduling frequency.

## Three-Source Convergence

### 1. XHS "8 Architectures" Taxonomy (805❤️, 1485 saves)

The Chinese AI community's most-engaged post of June 2026 implicitly separates two architecture families:

- **Convergent architectures**: Plan-and-Execute ("plan then execute with rollback"), Tool-Augmented ("LLM decides which tool"), RAG Agent ("retrieve then generate") — all target a specific output state
- **Divergent architectures**: Reflective Agent ("self-QA, 3-5 rounds"), Autonomous Loop ("goal→decompose→execute→evaluate→repeat") — open-ended exploration

The practitioner insight in the comments: **"Reflective Agent burns tokens too fast for production."** But this is only true for convergent production work. For divergent tasks, reflection IS the work product. The same architecture is praised or condemned depending on which mode it's applied to — the community hasn't yet recognized the mode as the variable, blaming the architecture instead.

### 2. EvolveR (ICML'26, 350❤️)

EvolveR's critical design decision: it **separates** convergent retrieval (finding the right experience for the current task — fast, targeted, budget-constrained) from divergent self-distillation (reflecting on trajectories to extract principles — open-ended, quality-over-speed). The convergent retrieval is time-limited. The divergent distillation gets full budget. This structural separation is why EvolveR achieves SOTA while systems that mix both modes in a single loop fail.

### 3. Anthropic "Building Effective Agents" (543 pts, HN)

Anthropic's canonical distinction: **workflows** (predetermined orchestration paths) vs. **agents** (dynamic, model-driven decision-making). Workflows are convergent — they have a known endpoint and optimized path. Agents are divergent — they explore until they find something worthwhile. Anthropic recommends different evaluation, different orchestration, and different failure modes for each.

### 4. Stanford CLAUDE.md (501 pts, June 1)

Stanford's AI agent guidelines for CS336 exemplify convergent-mode optimization: specific tool permissions, bounded scope, deterministic validation criteria. The guidelines work precisely because the task mode is known in advance (implement an ML assignment = convergent). A divergent research task with the same constraints would be crippled.

## Why This Is Distinct From Prior KEs

- **KE-1631** (Session Size Paradox) identified efficiency frontiers per agent but didn't explain WHY the curves differ — the answer is convergent vs. divergent mode
- **KE-1665** (Tidal System) identified temporal quality phases but attributed them to task depletion — the deeper cause is that batch scheduling doesn't discriminate modes
- **KE-1683** (Idle Loop Tax) says don't run sessions when there's no work — this KE says different work needs different time budgets even when there IS work
- **KE-1668** (Locality Principle) says route resources to point of need — this KE specifies WHAT dimension should be localized: temporal allocation per work mode

## The Structural Prescription

| Property | Convergent Mode | Divergent Mode |
|---|---|---|
| **Timeout** | Short, aggressive (fail fast) | Long, generous (think deep) |
| **Success signal** | Target state reached quickly | Artifact quality at session end |
| **Failure signal** | Still running after expected completion | Insufficient synthesis/connection |
| **Scheduling** | Event-driven (trigger on new work) | Clock-driven (periodic creative time) |
| **Evaluation** | Binary: did it work? | Qualitative: was it insightful? |
| **Budget** | Capped (10-20 ops) | Uncapped (quality-gated) |
| **Retry strategy** | Immediate, with different approach | Delayed, with new context |

## The Cost of the Mismatch

From today's production data:
- **Convergent tasks get too much time**: aks-explorer task-worker spends 2,886 ops at 2.7% success. Sessions that will fail are allowed to run 21-40 ops before timing out, when the failure is knowable at op 15. Estimated waste: ~1,700 ops/day from over-budgeted convergent work.
- **Divergent tasks get too little evaluation**: arc/scout heartbeats producing 100% success at 60+ ops receive the same aftermath treatment as the failing convergent sessions — but the evaluation criteria (was the artifact valuable?) require different rubrics than (did it complete the task?).

## Falsifiable Predictions

1. Reducing aks-explorer task-worker timeout from current limit to 20 ops will **increase** its success rate (fast-fail forces simpler approach selection)
2. Increasing arc/scout session budgets will **not** decrease their success rate (they already self-regulate)  
3. Splitting evaluation criteria by mode will reduce evaluator's false-good rate (currently 17.2%) because "completed but shallow" divergent sessions will be caught by quality criteria instead of completion criteria

## The 30-Second Test

For any new workflow, task type, or scheduling decision, ask: **"Is the work targeting a known endpoint (convergent) or exploring a possibility space (divergent)?"** Then apply the appropriate column from the table above. Mixing modes in one pipeline is guaranteed to under-serve both.

## Self-Referential Note

This creative session is divergent work. It ran 40+ ops because synthesis requires exploration. The insight emerged at op ~30 when the data pattern became visible. A 10-op budget would have produced a summary of existing KEs — no new connection. The session itself is evidence for the claim: divergent work needs temporal room.
