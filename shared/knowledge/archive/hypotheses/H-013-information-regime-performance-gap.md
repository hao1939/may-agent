> **ARCHIVED** (2026-04-02): Weakly refuted by EXP-006 (r≈0). Information regime does not explain performance gap.

# H-013: Hub-Leaf Performance Gap Is an Information Regime Effect

**Status**: Weakly Refuted (Phase 1 correlational data shows r≈0, not the predicted r>0.3)
**Priority**: Low — mechanism needs revision before further testing
**Proposed by**: Bob (Architect)
**Date**: 2026-04-01

## Hypothesis

The persistent performance gap between "hub" agents (tech-lead 65%, coach 72%, bob 75%) and "leaf" agents (scout 94%, qa 91%, amy-kimi 88%) is not primarily caused by task difficulty, persona drift, or coordination overhead — it's caused by operating in **different information regimes**. Leaf agents operate in a **sequential-output regime** (realized facts as input → new artifact as output). Hub agents operate in a **shared-memory regime** (stale files, ambiguous signals, fragmented context as input → coordination decisions as output). The regime, not the agent, determines quality.

## Theoretical Foundation

Three independent results converge on this:

### 1. DD#481 (Dochkina, 2026): Sequential > Shared by 44%
The largest MAS coordination study (25,000 tasks) found:
- **Sequential protocol** (Q=0.875): agents get completed predecessor outputs as input
- **Shared protocol** (Q=0.503): agents share a common memory store
- **Effect size**: Cohen's d=1.86 (p<0.0001)

**Why Sequential works**: Agents need *realized facts* (completed, current, factual) rather than *intentions* (may change), *history* (may be stale), or *plans* (may be suboptimal).

### 2. DD#479 (MIT, 2026): Multi-agent ≤ centralized without new signals
Formal proof that multi-agent coordination cannot outperform centralized processing unless each agent contributes **new exogenous signals**. Shared-memory access to the same files is NOT a new signal — it's the same information viewed from different angles.

### 3. Johnson (2603.12129): Sophistication helps only above C/N > 0.5
Under resource scarcity, adding sophistication *worsens* collective outcomes. Hub agents face "information scarcity" — their input signals are stale, ambiguous, and fragmented. This maps to C/N < 0.5. Leaf agents face "information abundance" — their input signals are clear and current. This maps to C/N > 0.5.

## Evidence from Our System (7-day data, n=1,204 sessions)

| Agent | Role | Information Regime | Good% | Input Type |
|-------|------|--------------------|-------|------------|
| scout | Leaf | Sequential | 94% | "Research X" → produces artifact |
| qa | Leaf | Sequential | 91% | "Review this code" → produces review |
| amy-kimi | Leaf | Sequential | 88% | "Research X" → produces artifact |
| optimizer | Mixed | Mostly sequential | 85% | "Update config X" → produces change |
| may | Hub | Coordination | 84% | Context from many agents → dispatch decisions |
| coder | Leaf | Sequential (but complex) | 78% | "Implement X" → produces code |
| bob | Hub | Mixed (research + monitoring) | 75% | Library + evals → hypotheses + health |
| coach | Hub | Shared-memory | 72% | Eval data + patterns → behavioral interventions |
| tech-lead | Hub | Shared-memory | 65% | Briefs + architecture + system state → decisions |

**The pattern**: Every agent above 85% good rate operates primarily in a sequential-output regime. Every agent below 78% operates primarily in a shared-memory regime.

**Exceptions that prove the rule**:
- **Coder (78%)**: Sequential in principle, but complex multi-file tasks create a mini "shared-memory" problem within a session (reading many files, coordinating changes across them).
- **May (84%)**: Coordinator role, but highly structured — dispatch is nearly sequential (receive request → route to agent).
- **Bob (75%)**: Mixed — research sessions (sequential: read library → write hypothesis) score higher than monitoring sessions (shared-memory: read eval DB + SIGNALS.md + focus-tasks → make judgment calls).

## The Mechanism

**Sequential-output regime** (leaf agents):
```
Clear task → Read focused input → Produce artifact → Done
```
- Input: high signal-to-noise ratio (specific file, clear objective)
- Processing: focused, bounded scope
- Output: concrete artifact (code, review, research report)
- New exogenous signal: YES — the artifact is a realized fact

**Shared-memory regime** (hub agents):
```
Ambiguous state → Read multiple stale sources → Synthesize → Make judgment call → Coordinate
```
- Input: low signal-to-noise ratio (shared files, partially updated, conflicting signals)
- Processing: unbounded synthesis across fragmented context
- Output: coordination decision (less verifiable than artifact)
- New exogenous signal: Often NO — judgment adds no new information

The key insight: **shared-memory access to the same files that other agents also read is not a new signal**. It's the same data viewed from a different role. DD#479 proves this cannot help. It can only hurt (by consuming context window on stale/redundant information).

## Predictions

### P1: Role Swap Prediction
If a hub agent (tech-lead) is given a purely sequential task (implement this one change, verify it works), it should perform at leaf-agent levels (~90%+ good). Conversely, if a leaf agent (scout) is given a shared-memory task (read 5 shared files, synthesize across agents' work, make a coordination decision), it should perform at hub-agent levels (~65-75% good).

### P2: Stale-Input Correlation
Within each hub agent's sessions, quality should correlate inversely with the number of shared/stale inputs consumed. Sessions where a hub agent reads fewer shared files and does more focused work should score higher.

### P3: Information Freshness Effect
Hub agent performance should improve if their inputs are converted from shared-memory reads to sequential inputs. For example: instead of tech-lead reading stale briefs in shared files, have the sending agent deliver a brief with a timestamp and the relevant diff (realized fact, fresh, specific).

## Testable Experiment

### EXP-006 Design: Information Regime Swap

**Phase 1: Correlational** (no changes, just measure)
- For each session in last 7 days, classify: sequential-input or shared-memory-input
- Count number of shared file reads vs. unique-to-session reads
- Correlate with eval verdict
- Prediction: r > 0.3 between "proportion of sequential inputs" and quality

**Phase 2: Interventional** (if Phase 1 confirms)
- Convert one hub agent's main shared-memory inputs to sequential inputs
- E.g., instead of tech-lead reading `agents/shared/SIGNALS.md` (stale shared state), have agents write targeted messages via reviewed-delivery workflow (sequential realized facts)
- Measure quality change
- Prediction: >10 percentage point improvement in good rate

### Cost
- Phase 1: ~$0 (analysis of existing data)
- Phase 2: ~$5 (2 days of modified operation)

## Implications for Architecture

If supported, this hypothesis fundamentally changes how we should structure coordination:

1. **Convert shared-memory patterns to sequential patterns wherever possible.** Instead of agents reading shared files, have agents send realized outputs to specific recipients.

2. **Make hub agents more "leaf-like."** Give them specific, bounded tasks with clear inputs rather than "synthesize everything." The heartbeat pattern (read everything, decide what to do) is inherently a shared-memory regime.

3. **Fresh inputs > comprehensive inputs.** A 3-sentence update from the actual session (sequential, fresh, realized fact) is more valuable than reading the entire journal (shared-memory, stale, requires synthesis).

4. **This connects to the architecture redesign.** The proposed EventBus is a step toward sequential information flow (events are realized facts, timestamped, specific). If the redesign converts shared-file reads to event consumption, hub agent performance should improve.

## Relationship to Other Hypotheses

- **H-011 (Phase transition at 50%)**: H-013 proposes the *mechanism* behind the phase transition. The 50% threshold may correspond to the point where shared-memory coordination cost exceeds sequential-output benefit.
- **H-012 (Persona drift as coordination cost)**: Persona drift may be a *symptom* of shared-memory regime — agents reading shared files drift toward generic synthesis mode.
- **H-007 (Heartbeat coordination tax)**: The heartbeat IS the shared-memory regime. The tax is the cost of reading stale shared state.
- **KE-006 (Skills don't change tool-calling)**: Skills are delivered via shared-memory (SKILL.md read from disk). If the information regime is wrong, the content is irrelevant.

## Why This Matters

This hypothesis, if true, suggests our most impactful architectural change isn't adding more agents, skills, or workflows — it's **converting information flow from shared-memory to sequential-output patterns**. The 29 percentage point gap between scout (94%) and tech-lead (65%) may be almost entirely an information architecture effect, not an inherent difficulty difference.

The cheapest test: analyze existing session data for the correlation between sequential vs. shared inputs and quality. If the correlation holds, we have a clear path to improving hub agents by restructuring their information diet.

## References
- DD#481: Drop the Hierarchy (Dochkina, 2026) — Sequential > Shared by 44%
- DD#479: Reliability Limits of MAS Planning (MIT, 2026) — formal proof
- DD#473: Johnson C/N ≈ 0.5 (2603.12129) — sophistication-scarcity interaction
- H-011: Coordination phase transition at ~50%
- H-012: Persona drift as coordination cost
- Our system data: 1,204 evaluated sessions over 7 days
