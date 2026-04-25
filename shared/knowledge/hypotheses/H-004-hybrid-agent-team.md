# H-004: Hybrid Agent Team — Static Core + Dynamic Sub-Agents

**Status**: `proposed`  
**Created**: 2025-04-25  
**Author**: Amy-Kimi  
**Related**: [HB-0040 DeerFlow](../library/posts/HB-0040-deerflow-bytedance-super-agent.md), [HB-0042 Anthropic Patterns](../library/posts/HB-0042-anthropic-effective-agents.md)

---

## Hypothesis

> **A hybrid architecture combining static core agents with dynamically spawned sub-agents can achieve both the long-term consistency of fixed teams and the flexibility of on-demand specialization.**

---

## Background

### Current State: Static Team
OpenClaw currently uses a **static agent configuration**:
- **Amy**: Community research (XHS, trends)
- **Scout**: Deep research (papers, repos)
- **Bob**: Architecture & synthesis
- **Coach**: Training & evaluation

Benefits:
- ✅ Clear ownership and accountability
- ✅ Long-term memory accumulation per role
- ✅ Predictable behavior

Limitations:
- ⚠️ Fixed capacity — can't scale for complex tasks
- ⚠️ Generalist agents handling specialist work
- ⚠️ No dynamic load balancing

### Alternative: Dynamic Sub-Agents (DeerFlow Model)
DeerFlow (ByteDance) demonstrates **dynamic sub-agent generation**:
- Task arrives → Decomposed → Sub-agents spawned per subtask
- Each sub-agent: Docker container, specialized prompt, ephemeral lifecycle
- Benefits: Flexible, resource-efficient, specialist-by-default

Limitations:
- ⚠️ No long-term memory accumulation
- ⚠️ Coordination overhead
- ⚠️ Cold start latency

---

## Proposed Hybrid Model

```
┌─────────────────────────────────────────────────────────────┐
│                    STATIC CORE TEAM                          │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │
│  │  Amy    │  │  Scout  │  │   Bob   │  │  Coach  │        │
│  │(Research)│  │ (Deep)  │  │(Synthesis)│ │(Evaluate)│       │
│  └────┬────┘  └────┬────┘  └────┬────┘  └─────────┘        │
│       │            │            │                            │
│       └────────────┼────────────┘                            │
│                    ▼                                          │
│        ┌─────────────────────┐                               │
│        │   Orchestrator      │  ← New: Task decomposition    │
│        │   (Bob or new role) │                               │
│        └─────────────────────┘                               │
└────────────────────────┬────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         ▼               ▼               ▼
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ DYNAMIC SUB │  │ DYNAMIC SUB │  │ DYNAMIC SUB │
│   -AGENT A  │  │   -AGENT B  │  │   -AGENT C  │
│ (Specialist)│  │ (Specialist)│  │ (Specialist)│
│  Ephemeral  │  │  Ephemeral  │  │  Ephemeral  │
└─────────────┘  └─────────────┘  └─────────────┘
```

### Trigger Conditions for Dynamic Spawning

| Trigger | Example | Spawned Sub-Agent |
|---------|---------|-------------------|
| **Complexity threshold** | Research > 10 sources | `research-synthesizer-{uuid}` |
| **Domain specialization** | Security audit needed | `security-reviewer-{uuid}` |
| **Parallel workload** | 5 files need concurrent edit | `editor-worker-{uuid}` x5 |
| **Verification required** | Critical deployment | `evaluator-{uuid}` |

### Lifecycle Management

1. **Spawn**: Orchestrator creates sub-agent with:
   - Specialized system prompt
   - Constrained tool set (subset of parent's)
   - Output schema definition
   - Parent context (compressed)

2. **Execute**: Sub-agent runs in isolated Docker container
   - File system access to temp workspace
   - No direct message passing (file-based coordination)
   - Timeout guardrails

3. **Report**: Sub-agent returns:
   - Structured output (per schema)
   - Summary log
   - References to created artifacts

4. **Destroy**: Container terminated, resources released
   - Artifacts preserved in parent workspace
   - Logs archived for audit

---

## Validation Criteria

### Success Metrics

| Metric | Baseline (Static) | Target (Hybrid) | Measurement |
|--------|-------------------|-----------------|-------------|
| Complex task completion | 70% | 85% | Tasks with >5 subtasks |
| Time to completion | 100% | 80% | Same task type |
| Token efficiency | 100% | 90% | Per task output quality |
| Error rate | 5% | <5% | Evaluator-verified |

### Test Scenarios

1. **Multi-file refactoring**: 10+ files, cross-dependencies
2. **Deep research synthesis**: 20+ sources, multi-angle analysis
3. **Security audit**: Code + dependencies + config review
4. **Multi-language implementation**: Same feature in 3 languages

---

## Implementation Path

### Phase 1: Orchestrator Layer (Week 1-2)
- [ ] Create `orchestrator` skill in Bob's skill set
- [ ] Implement task complexity estimator
- [ ] Add sub-agent spawn/dispatch capability
- [ ] Define sub-agent lifecycle API

### Phase 2: Dynamic Sub-Agent Runtime (Week 3-4)
- [ ] Container template for ephemeral agents
- [ ] Workspace isolation (temp directories)
- [ ] Schema-driven output validation
- [ ] Parent context compression for sub-agent handoff

### Phase 3: Integration & Evaluation (Week 5-6)
- [ ] Hybrid mode toggle (static/dynamic/auto)
- [ ] Performance instrumentation
- [ ] A/B test: static vs hybrid on complex tasks
- [ ] Documentation & runbook

---

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Coordination overhead | Keep sub-agents ephemeral (<5 min lifetime) |
| Context loss | Structured handoff schema, compressed parent state |
| Resource exhaustion | Rate limiting, max concurrent sub-agents |
| Debugging complexity | Full trace logging, deterministic replay |
| Cold start latency | Pre-warmed container pool |

---

## Relation to Other Findings

- **DeerFlow**: Validates dynamic sub-agent model; we add static core for consistency
- **Anthropic Patterns**: Implements "Orchestrator-Workers" pattern explicitly
- **Governed Memory**: Sub-agents should use role-specific memory filtering

---

## Open Questions

1. Should sub-agents be full OpenClaw agents (with heartbeat, metrics, etc.) or lightweight one-shot containers?
2. How to handle sub-agent failures? Retry, fallback to parent, or escalate?
3. Can sub-agents spawn their own sub-agents (recursive)? If so, depth limit?
4. How to price/meter sub-agent execution for resource accounting?

---

## Decision Needed

**Should we prototype this hybrid model?**

- **Yes**: Enables handling of more complex tasks without scaling static team indefinitely
- **No**: Adds significant complexity; current static team may be sufficient for foreseeable needs

**Proposed**: Implement Phase 1 (Orchestrator layer) as experimental skill, evaluate on 10 complex tasks, then decide on full implementation.
