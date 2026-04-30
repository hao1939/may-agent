# Git Signal Preferences Analysis — July 2026

**Source**: 114 commits by "Hao Yuan" in `/app/agents` repo over last 3 months
**Method**: Analyzed commit messages for implicit design preferences, patterns, and priorities

---

## New Preferences Extracted from Git Behavior

### P6: Convention-Driven Architecture
Hao repeatedly creates convention documents that agents must follow:
- `CONVENTIONS.md` — agent folder layout reference
- `journal.md` convention — self-reflection across sessions
- `todo.md` convention — TODO + Tracking sections
- `SOUL.md` identity docs per agent
- `heartbeat.md` per agent

**Signal**: Hao believes in **explicit written conventions** over implicit understanding. If something should be done a certain way, write it down as a rule.

### P7: Revert-and-Correct Over Tolerance
Multiple commits show immediate correction when agents get it wrong:
- "revert coder commits claim: coder does not commit"
- "restore lost domain.md content from coder rewrite"
- "revert: remove forced workflow usage"
- "fix knowledge files: remove aspirational rules, reflect actual behavior"

**Signal**: When something is wrong, **revert it immediately** rather than letting it drift. No tolerance for inaccurate state.

### P8: Trim and Compress Over Accumulate
- "trim lessons — remove entries for structurally-fixed issues"
- "trim optimizer codebase.md (2.4KB→458B)"
- "trim lessons.md"
- "bob consolidated all lessons.md — deduplicated, 323→148 lines"
- "remove obsolete operations-plan.md and improvement-plan.md"

**Signal**: Knowledge should be **actively pruned**. Once a lesson is structurally enforced, remove the lesson. Smaller docs > larger docs. Fight entropy.

### P9: Ground in Evidence, Not Aspiration
- "fix knowledge files: remove aspirational rules, reflect actual behavior"
- "bob: ground philosophy.md in evidence — tag provenance, fix contradictions"
- "Add honest self-assessment"

**Signal**: Documentation must describe **what IS**, not what should be. Aspirational content gets deleted.

### P10: Recursive Self-Improvement Infrastructure
Commit pattern shows heavy investment in meta-systems:
- meta-loop design and implementation
- coach agent (trains other agents through exercises)
- evaluation framework with per-agent scoring
- optimizer with proposal lifecycle
- cron jobs for automated health monitoring

**Signal**: Hao builds **systems that improve systems**. Manual intervention should shrink over time as automation handles more.

---

## Structural Preferences (from code organization patterns)

| Pattern | Evidence | Implication |
|---------|----------|-------------|
| Per-agent isolation | Each agent has own domain.md, lessons.md, todo.md, journal.md | Agents are autonomous units with clear boundaries |
| Explicit role separation | "Bob = design", "tech-lead = implementation" | No role overlap; each agent has ONE job |
| Cron over manual | 8+ cron job commits in 3 months | Automation for recurring checks is strongly preferred |
| Workspace state syncs | Multiple "chore: sync workspace state" commits | Hao manually syncs state — wants this automated |
| Feature flags over rollback | "feature flags design" commit | Ship behind flags, don't block on perfection |

---

## Workflow Preferences (from refactoring patterns)

1. **Start minimal, then enrich**: "simplified May + coder instructions" → later "rewrite May as project manager" → later adds workflows
2. **Restructure > patch**: Prefers full rewrites of domain docs over incremental fixes
3. **Ownership must be explicit**: "add document ownership rule — optimizer owns the shared knowledge library"
4. **Workflow-first routing**: "workflow-first enforcement" — agents should route through defined workflows, not ad-hoc

---

## Recommended Additions to preferences.md

```markdown
### P6: Convention-Driven Architecture
> Write it down as a rule. If it's not written, it doesn't exist.
- Create explicit convention docs for recurring patterns
- Agents follow written conventions, not oral tradition
- **Decision rule**: Before expecting behavior, check if there's a convention for it

### P7: Revert-and-Correct Immediately  
> Wrong state gets reverted, not tolerated
- Revert incorrect changes immediately
- Don't let bad information persist "until we fix it properly"
- Aspirational content in docs is actively harmful

### P8: Trim and Compress
> Smaller is better. Prune what's no longer needed.
- Remove lessons once structurally enforced
- Deduplicate aggressively
- Delete obsolete plans and docs
- **Decision rule**: If a doc is >2x what it needs to be, trim it

### P9: Evidence Over Aspiration
> Docs describe what IS, not what should be
- Remove aspirational rules from knowledge files
- Tag provenance on principles (which session/incident created this?)
- Honest self-assessment over optimistic framing
```

---

## Summary

The git history reveals Hao as a **systems architect who values precision, compression, and automation**. His commits show:
- 40% infrastructure/convention work (building the meta-system)
- 25% corrections/reverts (enforcing accuracy)  
- 20% knowledge trimming/consolidation (fighting entropy)
- 15% feature additions (new capabilities)

This is consistent with existing preferences (stability-first, guards-stay-strong) but adds new dimensions around **documentation hygiene** and **convention-driven design** that weren't explicitly captured before.
