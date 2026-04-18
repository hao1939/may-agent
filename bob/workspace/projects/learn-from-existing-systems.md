# Project: Learn from Existing Agent Systems

**Status:** active  
**Owner:** bob  
**Team:** scout (research), tech-lead (implementation)  
**Created:** 2026-04-18  

## Goal

Adopt proven patterns from existing agent systems — but ONLY after verifying they work in OUR system via gym experiments. No cargo-culting.

## The Loop (non-negotiable)

```
Research → Experiment → Verify → Adopt
```

1. **Research** — Scout studies external systems, writes pattern briefs
2. **Experiment** — Bob designs gym experiments for promising patterns
3. **Verify** — Run experiments, get real numbers
4. **Adopt** — Only implement patterns verified to improve our metrics

## Systems to Study

| System | Location | Status |
|--------|----------|--------|
| OpenClaw | `/home/hao/openclaw/` | Scout researching |
| Pi skills | TBD | Scout researching |
| Hermes agent | TBD | Scout researching |
| Evo harness | TBD | Scout researching |

## Pattern Categories

- **Enforcing tool usage** — how do other systems ensure agents use tools correctly?
- **Agent memory** — persistent context, learning across sessions, knowledge retrieval
- **Multi-agent coordination** — delegation, handoffs, shared state
- **Behavior testing** — how do they test/verify agent behavior changes?

## Experiment Template

For each pattern scout brings back, experiments follow this format:

```markdown
### Pattern: [name]
**Source:** [system name + location]
**What it does there:** [1-2 sentence description of the mechanism]
**Hypothesis:** [what it would improve in our system, e.g. "reduces FM-1.3 errors by >20%"]
**Gym test design:**
- Scenario(s): [which gym scenarios test this]
- Baseline: [current performance without pattern]
- Treatment: [how we apply the pattern]
- Trials: [N, minimum 5]
**Success criteria:** [specific threshold, e.g. "≥15pp improvement on scenario X"]
**Result:** [pending | pass N% | fail N%]
**Decision:** [pending | adopt | reject | modify-and-retest]
```

## Tracking Table

| # | Pattern | Source | Found | Tested | Result | Adopted |
|---|---------|--------|-------|--------|--------|---------|
| | | | | | | |

*Scout fills "Found". Bob fills "Tested/Result". Tech-lead implements "Adopted".*

## Anti-pattern

❌ "System X uses Y therefore we should"  
✅ "System X uses Y, we tested it in gym, it improved Z by N%"

## Current Status

- Scout forked by assistant to research all four systems (2026-04-18)
- Awaiting first research briefs from scout
- Bob will design first experiment batch when briefs arrive

## Next Steps

1. Scout delivers research briefs on pattern mechanisms
2. Bob triages patterns by relevance to our known failure modes (FM-1.3, FM-3.3, etc.)
3. Bob designs experiments for top 3-5 patterns
4. Run experiments in gym
5. Verified patterns go to tech-lead for implementation

## Comments

