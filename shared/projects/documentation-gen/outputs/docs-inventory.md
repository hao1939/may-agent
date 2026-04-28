# Documentation Inventory

Generated: 2025-01-27

## Summary
- **Total agents found**: 14 (amy, amy-kimi, bob, coach, coder, evaluator, may, optimizer, qa, scout, tech-lead, architect, master, judge)
- **Agents with context.md**: 11 (amy, amy-kimi, bob, coach, coder, evaluator, may, optimizer, qa, scout, tech-lead)
- **Agents with README**: 1 (coach)
- **Agents with NO docs**: 3 (architect, master, judge)

## Existing Documentation

### Top-Level
| File | Location |
|------|----------|
| README.md | `/app/agents/README.md` |
| CONVENTIONS.md | `/app/agents/CONVENTIONS.md` |

### Agent-Level READMEs
| Location | Status |
|----------|--------|
| `/app/agents/README.md` | ✅ exists |
| `/app/agents/coach/README.md` | ✅ exists |
| `/app/agents/shared/README.md` | ✅ exists |
| `/app/agents/environment/README.md` | ✅ exists |
| `/app/agents/knowledge-base/README.md` | ✅ exists |
| `/app/agents/gym/README.md` | ✅ exists |
| `/app/agents/.lab/README.md` | ✅ exists |

### Agent context.md Files
| Agent | Has context.md | Has README |
|-------|---------------|------------|
| amy | ✅ | ❌ |
| amy-kimi | ✅ | ❌ |
| bob | ✅ | ❌ |
| coach | ✅ | ✅ |
| coder | ✅ | ❌ |
| evaluator | ✅ | ❌ |
| may | ✅ | ❌ |
| optimizer | ✅ | ❌ |
| qa | ✅ | ❌ |
| scout | ✅ | ❌ |
| tech-lead | ✅ | ❌ |
| architect | ❌ | ❌ |
| master | ❌ | ❌ |
| judge | ❌ | ❌ |

### Workflows (shared)
| File | Documented |
|------|-----------|
| master-worker.ts | inline only |
| project.ts | inline only |
| implement-and-verify.ts | inline only |
| circuit-breaker.ts | inline only |
| budget-checkpoint.ts | inline only |
| heartbeat-data.ts | inline only |
| verify-wrap.ts | inline only |
| fewshot-inject-helpers.ts | inline only |
| project-helpers.ts | inline only |

## Gaps Identified

### Critical (no docs at all)
1. **architect** — no context.md, no README
2. **master** — no context.md, no README
3. **judge** — no context.md, no README

### Major (missing README)
4. 10 agents have context.md but no README explaining purpose, config, usage
5. **All 9 workflows** lack standalone documentation — only inline comments

### Minor
6. No centralized "how agents communicate" doc
7. No workflow usage guide (when to use which workflow)
8. No configuration reference doc

## Coverage Metrics
- Agent doc coverage: 11/14 = **79%** (context.md only)
- Agent full coverage: 1/14 = **7%** (context.md + README)
- Workflow doc coverage: 0/9 = **0%** (no standalone docs)
- Overall system doc coverage: **~30%**
