# H-083: CORAL Heartbeat Mechanisms for Multi-Agent Coordination

**Status**: ARCHIVED — Resolved (no evidence gathered, untested theoretical proposal)
**Date**: 2026-04-06  
**Source**: CORAL paper (arXiv:2604.01658)

## Hypothesis

Implementing CORAL-style heartbeat interventions (Reflect/Consolidate/Pivot) in our multi-agent system will improve exploration efficiency and prevent local optima stagnation.

## CORAL's Three Heartbeats

| Heartbeat | Trigger | Action | Our Equivalent |
|-----------|---------|--------|----------------|
| **Reflect** | After each evaluation | Analyze attempt, write to notes/ | Post-session summary |
| **Consolidate** | Every 10 evaluations | Synthesize learnings into skills/ | Weekly insights synthesis |
| **Pivot** | 5 evaluations without improvement | Switch exploration direction | Task reassignment |

## Key Insights from CORAL

1. **Indirect Coordination**: Agents don't communicate directly - they read/write shared memory (attempts/, notes/, skills/)
2. **Information Field**: Shared memory creates a "field" that guides agent exploration
3. **No Central Scheduler**: AgentManager only manages lifecycles, not task allocation
4. **Knowledge Diffusion**: Good techniques spread naturally through shared memory

## Proposed Implementation

### 1. Enhanced Shared Memory Structure
```
shared/knowledge/
  attempts/     # What we've tried (raw findings)
  notes/        # Reflections and insights
  skills/       # Reusable techniques
  patterns/     # Emerging coordination patterns
```

### 2. Agent Self-Organization
- Agents read shared memory at session start
- Agents decide their own direction based on "information field"
- Agents write findings back to shared memory

### 3. Pivot Detection
- Track improvement velocity per research thread
- Auto-trigger thread switch after N sessions without progress
- Suggest new directions based on gaps in attempts/

## Success Metrics

- [ ] Diversity of exploration directions (measure via topic clustering)
- [ ] Knowledge reuse rate (how often skills/ are referenced)
- [ ] Time to convergence on promising directions
- [ ] Reduction in redundant work across agents

## Test Plan

1. **Phase 1**: Implement structured attempts/ logging
2. **Phase 2**: Add automated Consolidate triggers (weekly)
3. **Phase 3**: Add Pivot detection and auto-recommendation
4. **Phase 4**: Measure against baseline (current system)

## Related Work

- CORAL paper (arXiv:2604.01658)
- Our current heartbeat.md design (already has Reflect-like structure)
- Bulletin system (indirect communication infrastructure)

## Questions to Answer

1. How do we measure "improvement" in research context?
2. What's the right threshold for Pivot triggers?
3. How do we prevent all agents from pivoting to the same direction?
4. Can we implement git worktree-like isolation for agents?

---

**Next Step**: Review with tech-lead for implementation feasibility
