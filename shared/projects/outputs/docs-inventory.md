# Documentation Inventory

Generated: 2025-01-28

## Summary
- **Total agents with agent.json**: 13 (amy, amy-kimi, bob, coach, coder, evaluator, judge, master, may, optimizer, qa, scout, tech-lead)
- **Agents with context.md**: 13/13 = **100%**
- **Additional agent dir (no agent.json)**: architect (has context.md only)

## Agent Documentation Matrix

| Agent | agent.json | context.md | SOUL.md | DOMAIN.md | LESSONS.md | TOOLS.md | README.md | Other docs |
|-------|-----------|------------|---------|-----------|------------|----------|-----------|------------|
| amy | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, periodic-tasks, reference |
| amy-kimi | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session |
| architect | ❌ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | — |
| bob | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ❌ | heartbeat, journal, last-session, reference, todo, log, ERROR_LOG |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | heartbeat, last-session, reference, todo, ERROR_LOG |
| coder | — | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | last-session |
| evaluator | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, periodic-tasks, INDEX, ERROR_LOG |
| judge | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | last-session |
| master | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, ERROR_LOG |
| may | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, conversation-state, ERROR_LOG |
| optimizer | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, config, reference, periodic-tasks, ERROR_LOG |
| qa | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session |
| scout | ✅ | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | heartbeat, journal, last-session, reference, todo, signals, INBOX |
| tech-lead | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | heartbeat, last-session, reference, ERROR_LOG |

## Coverage Metrics

| Metric | Count | Percentage |
|--------|-------|------------|
| context.md coverage | 14/14 | **100%** |
| SOUL.md coverage | 12/14 | 86% |
| DOMAIN.md coverage | 10/14 | 71% |
| LESSONS.md coverage | 9/14 | 64% |
| TOOLS.md coverage | 10/14 | 71% |
| README.md coverage | 1/14 | 7% |

## Non-Agent Documentation

### Top-Level
| File | Location |
|------|----------|
| README.md | `/app/agents/README.md` |
| CONVENTIONS.md | `/app/agents/CONVENTIONS.md` |

### Shared
| File | Location |
|------|----------|
| README.md | `/app/agents/shared/README.md` |
| bulletin.md | `/app/agents/shared/bulletin.md` |
| common-sense.md | `/app/agents/shared/common-sense.md` |
| db-schema.md | `/app/agents/shared/db-schema.md` |
| federation.md | `/app/agents/shared/federation.md` |
| knowledge-essentials.md | `/app/agents/shared/knowledge-essentials.md` |
| standing-orders.md | `/app/agents/shared/standing-orders.md` |

### Support Directories with READMEs
- `/app/agents/environment/README.md`
- `/app/agents/gym/README.md`
- `/app/agents/knowledge-base/README.md`

## Remaining Gaps
1. **README.md**: Only coach has one (1/14). Low priority — context.md serves the primary role.
2. **architect**: Minimal agent dir (context.md only, no agent.json). May be an archetype, not a runtime agent.
3. **coder**: Has context.md but no SOUL/DOMAIN/TOOLS — minimal config.
4. **Workflow docs**: 9 workflow files in shared/ have inline comments only; no standalone docs.
