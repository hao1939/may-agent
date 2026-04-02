# H-014: The Performance Gap Is a Delegation Quality Problem, Not an Information Regime Effect

**Status**: Partially Supported (EXP-007 Phase 1 complete — core claim confirmed, mechanism refined)
**Priority**: High — directly addresses the system's biggest quality gap
**Proposed by**: Bob (Architect)
**Date**: 2026-04-01

## Hypothesis

The persistent performance gap between "hub" and "leaf" agents is primarily caused by **session kind** — specifically, the quality degradation that occurs when agents are called as workflow substeps (kind=call) versus operating autonomously (kind=job). Agents receiving **delegated context** (predecessor outputs, structured multi-step instructions) perform significantly worse than when they operate with **their own context** (heartbeat, cron, self-directed work), except when the delegated task has a clear, bounded scope with unambiguous evaluation criteria.

## Key Data (7-day, 1,204 sessions)

| Agent | Call Good% | Job Good% | Gap | Call n | Job n |
|-------|-----------|-----------|-----|--------|-------|
| optimizer | 38.5% | 89.3% | **-50.8 pp** | 13 | 150 |
| coach | 42.2% | 81.3% | **-39.1 pp** | 45 | 150 |
| tech-lead | 33.3% | 66.7% | **-33.4 pp** | 6 | 72 |
| coder | 83.3% | — | baseline | 30 | — |
| QA | **100%** | 89.9% | **+10.1 pp** | 22 | 139 |

**Critical observation**: QA is the only agent that performs *better* on call sessions. All hub agents perform dramatically worse.

## Why QA Succeeds at Call Sessions

QA's call tasks have three properties the others lack:
1. **Clear scope**: "Review this code" — single artifact, bounded task
2. **Unambiguous criteria**: The review rubric is established; success is deterministic
3. **No synthesis required**: QA doesn't need to integrate predecessor output with system state — the code IS the input

## Why Hub Agents Fail at Call Sessions

Coach/optimizer/tech-lead call tasks require:
1. **Interpreting predecessor context**: They receive structured output from a previous workflow step that may be ambiguous, incomplete, or wrong
2. **Making judgment calls**: "Diagnose this error pattern" or "Plan a training sprint" requires open-ended reasoning
3. **Maintaining workflow coherence**: Their output feeds the next step, creating pressure to be compatible with the chain's expectations rather than genuinely correct

This is exactly the **Action Selection × Belief Tracking coupling** from the Information Self-Locking paper (arXiv:2603.12109):
- **Weak BT**: The agent may not correctly interpret the predecessor's structured output (e.g., "Sprint Plan: Status: done (14m47s)..." — is this good context or noise?)
- **Weak AS**: Poor interpretation → poor decisions about what to do next
- **Coupling**: The predecessor's output quality determines both what the agent knows AND what it can do

## Theoretical Support

### 1. Error Cascades (arXiv:2603.04474)
Workflow chains are exactly the "chain topology" where errors propagate. The Risk Criterion R = βρ(A)/δ predicts amplification. In a sequential workflow:
- β (infection rate) is high — each step takes predecessor output as trusted context
- ρ(A) scales with chain length
- δ (self-correction) is low — agents don't independently verify predecessor claims

**Prediction**: Longer workflow chains should have worse quality on later steps.

### 2. Intelligence Paradox (arXiv:2603.12129)
Under "capacity scarcity" (C/N < 0.5), sophistication worsens outcomes. Call sessions create artificial scarcity: the agent's capacity is constrained by the predecessor's framing, the workflow's expectations, and the injected context. The same agent operating autonomously faces "capacity abundance" — full freedom to read what they want, decide what to do, and produce what they think is best.

### 3. H-013 Refutation (EXP-006)
H-013 predicted information regime (measured by file access patterns) would explain the gap. It didn't (r ≈ 0). H-014 proposes the missing variable: **session kind** (call vs job) is the actual causal factor. The "information regime" is not about which files you read but about **who chose what you'd read** — the agent (job) or a workflow (call).

## Predictions

### P1: Call-quality correlation with task clarity
Within call sessions, quality should correlate with task clarity:
- Clear, bounded tasks (review code, run test) → high quality
- Open-ended judgment tasks (diagnose pattern, plan sprint) → low quality
- **Measurable**: Classify call tasks by specificity; predict quality from classification

### P2: Workflow chain position effect
In multi-step workflows, later steps should perform worse than earlier steps:
- Step 1 (receives clean input from orchestrator) → reasonable quality
- Step 3+ (receives accumulated predecessor context) → degraded quality
- **Measurable**: Track step position in workflows; correlate with verdict

### P3: Delegation context format matters
If delegation quality is the issue, improving the format of delegated context should help:
- Current: Dump predecessor output as context
- Proposed: Extract only verified claims, tag confidence, provide original request alongside
- **Measurable**: A/B test context format for coach/optimizer call sessions

### P4: QA-like structuring helps other agents
Converting coach/optimizer call tasks from open-ended ("diagnose this") to structured ("check these 3 specific things") should improve their call quality toward QA levels.
- **Measurable**: Redesign one workflow's delegation format; compare before/after

## Connection to Existing Knowledge

| Entry | Connection |
|-------|-----------|
| KE-003 | Rich delegation context reduces ops by 47% — supports P3 |
| KE-007 | Workflow enforcement is the only reliable intervention — but H-014 shows workflows ALSO create quality problems when delegation is poor |
| KE-011 | Knowledge files are passive in oneshot mode — call sessions ARE oneshot mode |
| H-006 | Delegation asymmetry by sender-receiver pair — H-014 is the mechanism |
| H-007 | Heartbeat coordination tax — H-014 reframes: the tax is worse in call sessions than heartbeat sessions |
| H-010 | Error amplification scales with sophistication — H-014 shows the amplification channel is delegation chains |

## Experimental Design: EXP-007

### Phase 1: Observational (Cost: $0)
1. Classify all call sessions by task type: bounded-artifact vs open-judgment
2. For multi-step workflows, track step position
3. Compute quality × task-type and quality × step-position correlations
4. **Pass threshold**: Bounded-artifact call sessions >80% good; open-judgment <60% good

### Phase 2: Interventional (Cost: ~$3)
1. Pick one workflow (training-sprint) with worst call quality
2. Redesign delegation format: extract atomic claims from predecessor, tag confidence, include original objective
3. Run 20 sessions with new format, 20 with old
4. **Pass threshold**: >15 pp improvement in call session quality

### Phase 3: Structural (Cost: ~$5)
1. Convert open-judgment call tasks to bounded-artifact format where possible
2. E.g., instead of "Diagnose this error pattern" → "Check if [specific pattern] matches, return yes/no with evidence"
3. Run for 2 days, measure change
4. **Pass threshold**: Call quality within 15pp of job quality for modified workflows

## Implications

If H-014 is supported:

1. **Don't blame agents for workflow failures** — the delegation format is the problem, not the agent
2. **Redesign delegation protocols** — atomic claims, confidence tags, original context
3. **Keep judgment in autonomous sessions** — don't delegate open-ended reasoning via workflow calls
4. **Convert delegated judgment to delegated verification** — "check this specific thing" instead of "figure out what's wrong"
5. **This explains why KE-003 worked** — rich delegation context compensated for exactly this problem

## Why This Matters

The hub-leaf performance gap is one of the largest quality issues in our system. H-013 proposed an information regime explanation; it was refuted. H-014 proposes a simpler, more actionable explanation: **workflow delegation degrades quality for judgment tasks but not for verification tasks**. If true, the fix is in delegation design, not agent architecture — much cheaper and faster to implement.

## References
- EXP-006 Phase 1 results (H-013 refutation)
- arXiv:2603.12109 (Information Self-Locking in RL)
- arXiv:2603.04474 (Error Cascades in Multi-Agent Collaboration)
- arXiv:2603.12129 (Intelligence Paradox in Agent Collectives)
- KE-003 (Rich delegation context reduces ops by 47%)
- KE-007 (Workflow enforcement is the only reliable intervention)
