# Documentation Inventory

Generated: 2025-04-29

## Summary
- **Total agents with agent.json**: 12
- **Agents with docs (context.md or equivalent)**: 12
- **Coverage**: 100% ✅ (target: 80%)

## Agent Documentation Matrix

| Agent | agent.json | context.md | DOMAIN.md | SOUL.md | README.md |
|-------|-----------|------------|-----------|---------|-----------|
| amy | ✅ | ✅ | ✅ | ✅ | ❌ |
| amy-kimi | ✅ | ✅ | ✅ | ✅ | ❌ |
| bob | ✅ | ✅ | ❌ | ✅ | ❌ |
| coach | ✅ | ✅ | ✅ | ✅ | ✅ |
| evaluator | ✅ | ✅ | ✅ | ✅ | ❌ |
| judge | ✅ | ✅ | ✅ | ✅ | ❌ |
| master | ✅ | ✅ | ✅ | ✅ | ❌ |
| may | ✅ | ✅ | ✅ | ✅ | ❌ |
| optimizer | ✅ | ✅ | ✅ | ✅ | ❌ |
| qa | ✅ | ✅ | ✅ | ✅ | ❌ |
| scout | ✅ | ✅ | ❌ | ✅ | ❌ |
| tech-lead | ✅ | ✅ | ✅ | ✅ | ❌ |

## Additional Documentation

### Non-agent docs (archetypes)
- `_archetypes/coach/SOUL.md`
- `_archetypes/coder/SOUL.md`
- `_archetypes/scout/SOUL.md`

### Shared/infrastructure docs
- `agents/README.md`
- `agents/shared/README.md`
- `agents/shared/escalations/README.md`
- `agents/shared/may-agent-docs/README.md`
- `agents/shared/skills/README.md`
- `agents/environment/README.md`
- `agents/gym/README.md`
- `agents/knowledge-base/README.md`

### Project outputs (this project)
- `outputs/architecture-guide.md` — system architecture overview
- `outputs/agent-quick-reference.md` — agent role quick reference
- `outputs/agent-onboarding-guide.md` — onboarding guide for new agents
- `outputs/workflow-docs.md` — workflow documentation
- `outputs/doc-gen-script.md` — doc generation script docs
- `outputs/docs-inventory.md` — this file

## Notes
- `architect/` has context.md but no agent.json (archetype, not a running agent)
- `coder/` has context.md but no agent.json (archetype-based)
- All 12 agents with agent.json have at least context.md
