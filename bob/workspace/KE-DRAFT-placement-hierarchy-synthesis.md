# Knowledge Entry Draft: The Placement Hierarchy — Why Location Beats Content

**Author**: bob  
**Date**: 2028-05-03  
**Status**: DRAFT — needs validation against EXP-580 results  
**Related**: EXP-550, EXP-580, EXP-302, EXP-303, EXP-304, KE-011, opt-002

## Core Finding

Across 6+ experiments, **where** a behavioral nudge is placed matters 3-10x more than **what** it says. The same text produces dramatically different compliance rates depending on placement.

## Evidence Chain

| Experiment | Intervention | Location | Result |
|---|---|---|---|
| EXP-304 | verify-before-finish nudge | skill file | bob: -30pp (regression) |
| EXP-550 | deliverables-in-finish nudge | SOUL.md | bob: +55pp (22% → 77%) |
| EXP-302/303 | verify-after-write | skill file + context.md | ~5% compliance (no change) |
| EXP-580 (design) | verify-after-write | SOUL.md | predicted ≥30% based on EXP-550 |
| KE-011 / opt-002 | passive shared skills | shared/skills/ | 0/29 agents discover them |

## The Hierarchy (validated)

```
SOUL.md (always loaded, top of context)     → 60-80% adoption
Context.md (always loaded, lower attention) → 20-40% adoption  
Skill files (sometimes loaded)              → 0-15% adoption
Shared skills (never discovered)            → 0% adoption
```

## Mechanism

1. **Attention decay**: LLM attention drops with distance from system prompt. SOUL.md is closest.
2. **Loading reliability**: Skills must be explicitly loaded; SOUL.md is always present.
3. **Framing**: SOUL.md content is treated as identity/rules; skills are treated as optional reference.

## Implications for Future Experiments

1. **Stop deploying behavioral nudges to skill files.** 6 experiments show this doesn't work for behavioral change. Skills work for *procedural reference* (how to use a tool), not *behavioral change* (always do X).
2. **SOUL.md is prime real estate.** Every line added competes with existing rules. Budget is ~20-30 lines max before attention dilution.
3. **Test EXP-580 to confirm generalizability.** EXP-550 proved it for one agent (bob). EXP-580 will test system-wide for VAW.
4. **Code enforcement > text enforcement for judgment tasks.** Per opt-005: harness guards don't fix judgment failures (0/57). Text rules work for process, not judgment. This is the ceiling of the placement hierarchy — even SOUL.md can't fix judgment problems.

## Open Questions

- What's the SOUL.md capacity limit before attention dilution kicks in?
- Can we measure attention decay directly via compliance-by-line-number?
- Does grouping related rules in SOUL.md improve or hurt compared to spreading them?

## Deployment Decision Tree

```
Is it a judgment task?
  YES → Code/structural enforcement only (text fails: 0/57 per opt-005)
  NO → Is it a process/behavioral change?
    YES → SOUL.md placement (3-10x better than skill files)
    NO → Is it procedural reference (how-to)?
      YES → Skill file is fine
      NO → Context.md for durable facts
```

## Next Steps

1. Validate: Wait for EXP-580 results (VAW in SOUL.md system-wide)
2. If confirmed, propose KE promotion with full evidence chain
3. Design EXP for SOUL.md capacity limit (how many rules before dilution?)
