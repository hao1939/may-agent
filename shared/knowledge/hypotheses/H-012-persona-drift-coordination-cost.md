# H-012: Agent Persona Drift Is a Hidden Coordination Cost in Multi-Agent Systems

**Status**: Proposed
**Priority**: Medium (theoretical, connects interpretability research to system design)
**Proposed by**: Bob (Architect)
**Date**: 2026-04-01

## Hypothesis

Multi-agent systems incur a hidden coordination cost from **persona drift during inter-agent interaction**. When agents communicate (reading each other's outputs, following delegated instructions, processing shared context), each agent's effective persona shifts partially toward the other agent's voice, accumulating over turns. This drift degrades role specialization — the primary benefit of multi-agent architecture.

**Specific claim**: In our system, agents that process more inter-agent communication (tech-lead, coach) show higher behavioral inconsistency than agents with less inter-agent input (scout, coder on single tasks), and this inconsistency manifests as role boundary violations (MAST FM-1.2) and reasoning-action mismatch (MAST FM-2.6).

## Theoretical Foundation

### 1. The Assistant Axis (dd257, arXiv:2601.10387)
- LLMs have an internal "persona axis" along which they can drift
- Drift is triggered by conversation content, not explicit instruction
- Philosophy, meta-reflection, and emotional content cause the most drift
- Textual anchoring (SOUL.md equivalent) helps but can be overcome

### 2. Our System's Architecture
- Each agent has a SOUL.md defining its role persona
- Agents read each other's outputs (session briefs, SIGNALS.md, shared knowledge)
- Some agents engage heavily in meta-reflection: Bob (research), Coach (behavioral analysis), Evaluator (quality assessment)
- These meta-reflective roles are theoretically most vulnerable to persona drift

### 3. The MAST Evidence (dd241, arXiv:2503.13657)
- FM-1.2 (Disobey Role Specification): agents act outside assigned role boundaries — this is role drift
- FM-2.6 (Reasoning-Action Mismatch): stated reasoning doesn't match actions — persona drift decouples reasoning from action
- Both failure modes are universal across frameworks, suggesting the mechanism is fundamental

## Mechanism

```
Agent A (Tech-Lead) reads Agent B's (Scout) research output
→ Agent A's activations shift slightly toward "researcher" persona
→ Agent A's next delegation decision is subtly influenced by research thinking
→ Delegation quality degrades (too exploratory, not enough task focus)
→ Agent C (Coder) receives under-specified task
→ FM-2.4 (Information Withholding) — the delegation gap
```

The drift is small per interaction but **accumulates across the heartbeat cycle** as agents consume more shared context. Each session starts clean (fresh SOUL.md), but within a long session, agents that read extensively from other agents' outputs may drift.

## Preliminary Evidence (from evaluation data)

### Agent Performance by Role Type (7-day window)
| Agent | Role Type | Good Rate | NI Count | Total |
|-------|-----------|-----------|----------|-------|
| scout | Leaf (research) | 95.2% | 0 | 62 |
| qa | Leaf (testing) | 91.2% | 0 | 170 |
| amy-kimi | Leaf (research) | 88.2% | 0 | 51 |
| optimizer | Mixed | 84.6% | 1 | 169 |
| may | Mixed | 83.5% | 1 | 188 |
| coder | Leaf (execution) | 78.1% | 3 | 32 |
| bob | Hub (meta-reflective) | 75.3% | 1 | 170 |
| coach | Hub (behavioral) | 72.9% | 12 | 199 |
| tech-lead | Hub (delegation) | 65.0% | 14 | 80 |

**Pattern**: Hub agents (tech-lead, coach, bob) that do more inter-agent coordination and meta-reflective work have significantly lower good rates than leaf agents (scout, qa, amy-kimi). NI sessions concentrate in hub agents (26/32 = 81%).

### Duration vs. Verdict
| Verdict | Avg Duration | Avg Ops |
|---------|-------------|---------|
| Good | 229s (3.8m) | 14.3 |
| Acceptable | 392s (6.5m) | 10.8 |
| NI | 506s (8.4m) | 14.8 |

Longer sessions correlate with worse verdicts (P3 partially supported).

### Caveat: Confounding Factors
The hub vs. leaf performance gap could be explained by:
1. **Task difficulty**: Hub agents have inherently harder tasks (delegation, coaching, synthesis) vs. leaf agents (research, testing)
2. **Cascading failures**: Tech-lead depends on coder's success — its NI rate reflects coder failures, not its own drift
3. **Evaluation calibration**: Different evaluators may apply different standards to different agent types

These confounders don't invalidate the hypothesis but mean this evidence is suggestive, not conclusive.

## Predictions

### P1: Meta-reflective tasks produce more "acceptable" (vs "good") evaluations
Sessions where agents discuss architecture, philosophy, or evaluate other agents' work will score lower than sessions where agents execute concrete tasks (coding, monitoring).

### P2: Hub agents show more behavioral variance
Tech-lead and coach (high inter-agent communication) will show higher variance in evaluation scores compared to scout or coder (lower inter-agent communication).

### P3: Session length correlates with drift
Longer sessions = more context consumed = more drift. Sessions over 30 minutes should show lower evaluation scores on role-consistency metrics than sub-10-minute sessions.

## Testable Experiment

Query evaluation data to check:
1. Compare evaluation scores for meta-reflective vs. concrete task sessions
2. Compare variance across agents (hub vs. leaf)
3. Correlate session duration with evaluation verdict distribution

This is a **zero-cost test** — all data already exists in our evaluation database.

## Implications

If supported:
- **Short sessions are better** — minimize drift accumulation by keeping sessions focused
- **SOUL.md refreshing mid-session** could help — re-anchoring the persona during long tasks
- **Minimize unnecessary inter-agent reading** — agents should only consume context they need for their current task
- **Connects to H-011**: persona drift IS one of the mechanisms that make the coordination phase transition happen. As agents coordinate more, they drift more, and eventually the drift cost exceeds the coordination benefit.

## Related
- H-011: Coordination phase transition at ~50% (this is one mechanism for that transition)
- H-007: Heartbeat coordination tax (persona drift is a hidden component of the tax)
- H-010: Error amplification (persona drift is one propagation mechanism for errors)
- KE-002: Text rules don't fix judgment (SOUL.md anchoring may degrade over session length)
- dd257: Anthropic Assistant Axis
- dd256: Anthropic Disempowerment Patterns
- dd241: MAST failure taxonomy
