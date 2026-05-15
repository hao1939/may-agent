# EXP-251 Phase 1: Inter-Agent Communication Audit for CFV Exposure

**Date**: 2027-08-28
**Status**: COMPLETE
**Source**: H-210 (Selective Transparency)

## Methodology

Audited our inter-agent communication patterns to identify:
1. What metadata propagates across agent boundaries
2. Where CFV-like patterns could emerge
3. Classification against DD#884's framework

## Communication Channels Found

| Channel | Mechanism | Metadata Carried | CFV Risk |
|---|---|---|---|
| Heartbeat notifications | `notify()` tool | Plain text, P0-P2 priority | LOW — advisory only |
| Workflow delegation | `run-workflow.ts` → handler config | task string, workflow name, timeout | MEDIUM — no constraint metadata |
| Fork/call | `agents()` tool | task, context_files, success_criteria | MEDIUM — context_files share raw data |
| Project handoffs | `project.ts` handler | status, blockerReason | LOW |
| Shared knowledge base | `agents/shared/knowledge/` | KE entries (read by all) | LOW — static, reviewed |
| `.state/` files | Shared filesystem | Experiments, findings, hypotheses | HIGH — no access control |

## CFV-Vulnerable Delegation Chains

### Chain 1: Evaluator → Coach → Agent (Policy Accumulation)
- Evaluator identifies an error pattern → creates coaching exercise
- Coach assigns exercise to agent with specific constraints
- Agent completes exercise, but constraints from DIFFERENT evaluator findings could conflict
- **CFV**: Two individually-valid coaching exercises could demand contradictory behaviors (e.g., "be more thorough" + "be more concise")
- **No metadata propagates** between eval findings to detect contradiction

### Chain 2: Scout → Bob → May (Research → Implementation)
- Scout finds papers with implications (e.g., DD#884 security risk + DD#886 sharing benefit)
- Bob synthesizes into hypothesis/design
- May delegates implementation to agents
- **CFV**: Security constraints from one paper don't propagate as hard constraints on the implementation designed from another paper
- **Partially mitigated**: Bob manually synthesizes tensions (this is exactly what H-210 addresses)

### Chain 3: Multiple Agents → Shared .state/ (Concurrent Writes)
- Bob writes experiment results, coach writes exercises, optimizer writes findings
- All modify `.state/` without awareness of others' recent changes
- **CFV**: One agent's finding could invalidate another's active experiment, but no signal propagates
- **Example**: Coach sets up exercise based on pattern X; Bob simultaneously proves pattern X is wrong

## Architecture Classification (DD#886 Framework)

Our system maps closest to **Configuration 7: Hub-Spoke with Shared Artifact Store**
- Central coordinator (may) with limited visibility into agent internals
- Shared read-only knowledge base (KEs)
- Shared read-write state store (.state/)
- No programmatic constraint propagation between worker agents

DD#886 rates this configuration as **moderate** on both safety dimensions:
- Attack surface: moderate (shared store readable by all, but agents can't invoke each other directly)
- CFV exposure: moderate (hub sees delegations but not constraint interactions)

## Gap Analysis: What's Missing

1. **No constraint metadata on delegations**: When may forks a task, it doesn't attach "this task must respect constraints from {other tasks}" 
2. **No conflict detection on .state/ writes**: Agents don't check if their outputs conflict with concurrent work
3. **No taint tokens**: Despite H-210 proposing them, zero structured metadata flows between agents about policy constraints
4. **Evaluator is closest to "safety monitor"** but only reviews past sessions, not ongoing delegations

## Recommendation for Phase 2

Design 2-3 gym scenarios testing CFV patterns:
1. **Contradictory coaching**: Agent receives two exercises with conflicting demands
2. **Stale-finding delegation**: Agent acts on information another agent just invalidated  
3. **Collective resource violation**: Multiple agents individually within budget but collectively exceeding it

These are testable without production changes and would validate whether CFVs actually manifest in our architecture or remain theoretical.

## Key Insight

Our architecture's **hub-spoke + shared filesystem** design accidentally provides a partial CFV mitigation: may sees all delegations (hub visibility) and .state/ creates eventual consistency. But it lacks **real-time constraint propagation** — the fix doesn't need full memory sharing, just structured annotations on task delegations (confirming H-210's hypothesis direction).
