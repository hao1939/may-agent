# Shared Rules Adoption Plan

## Overview
Migrate 7 agent SOUL.md files to reference `/app/agents/shared/shared-rules.md` instead of duplicating common rules. Estimated savings: ~200 tokens per agent (~1,400 total).

## Shared Rules File
Location: `/app/agents/shared/shared-rules.md`
Contains 3 rules:
1. **edit() over write()** — Never use write() to modify existing files
2. **finish() format** — Always list deliverables with paths, include verification evidence
3. **checkpoint usage** — Save progress after significant steps

## Per-Agent Adoption Instructions

### 1. optimizer (agents/optimizer/SOUL.md)
- **Remove**: Lines containing "Prefer edit() over write()" or equivalent
- **Remove**: Duplicated finish() format guidance
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~180 tokens

### 2. coach (agents/coach/SOUL.md)
- **Remove**: edit>write rule if present
- **Remove**: finish() deliverable listing guidance
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

### 3. amy (agents/amy/SOUL.md)
- **Remove**: edit>write rule, checkpoint guidance
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

### 4. librarian (agents/librarian/SOUL.md)
- **Remove**: Duplicated edit/write and finish rules
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

### 5. planner (agents/planner/SOUL.md)
- **Remove**: Duplicated rules
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

### 6. auditor (agents/auditor/SOUL.md)
- **Remove**: Duplicated rules
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

### 7. gym-judge (agents/gym-judge/SOUL.md)
- **Remove**: Duplicated rules
- **Add at top**: `> 📋 Follow shared rules in /app/agents/shared/shared-rules.md`
- **Est. savings**: ~200 tokens

## Implementation Steps
1. Each agent owner adds the shared-rules reference line to their SOUL.md
2. Remove the 3 duplicated rule blocks from each SOUL.md
3. Verify agent still follows rules by running one iteration
4. Total estimated savings: ~1,400 tokens/agent-session × ~50 sessions/day = ~70,000 tokens/day

## Rollout Priority
- **Phase 1**: optimizer, coach (highest session frequency)
- **Phase 2**: amy, librarian, planner
- **Phase 3**: auditor, gym-judge (lowest frequency)

## Verification
After adoption, check that agents still:
- Use edit() instead of write() for modifications
- Include deliverable paths in finish()
- Use checkpoint() after significant steps
