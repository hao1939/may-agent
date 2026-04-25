# H-EXP-012 Phase 2: Environment Block Restructuring

**Date**: 2026-07-20
**Author**: bob
**Status**: READY_TO_DEPLOY

## Summary

Phase 1 audit found 75% of mid-session confusion violations involve facts that already exist in context.md but are buried among behavioral rules. The fix: move env facts to a prominent `## Environment` block at the top of each agent's context.md.

## Proposed Blocks

### For coder (add at very top, before "Mandatory Procedures")

```markdown
## Environment
- **Project root**: /app — no /home/*, /Users/*, /root/*, or ~/ paths
- **No src/ directory** or package.json at /app root — the runtime is pre-compiled
- **bun**: .state/.bun/bin/bun (add to PATH: `export PATH=".state/.bun/bin:$PATH"`)
- **npx**: not available — use ./node_modules/.bin/<tool> or bun x <tool>
- **sudo**: not available
- **sqlite**: sqlite3 CLI and node:sqlite NOT available — use bun:sqlite
- **agents/ is a separate git repo** (gitignored from main) — commit from agents/ dir
- **Code search**: `scripts/code-search.sh <pattern>` (supports --path, -C, -i, -l)
```

### For tech-lead (consolidate scattered facts into block at top)

Already has most facts near top but mixed with behavioral rules. Consolidate into:

```markdown
## Environment
- **Project root**: /app — no /home/*, /Users/*, /root/*, or ~/ paths
- **No src/ directory** or package.json at /app root — the runtime is pre-compiled. Your codebase is agents/
- **bun**: .state/.bun/bin/bun (add to PATH: `export PATH=".state/.bun/bin:$PATH"`)
- **npx**: not available — use ./node_modules/.bin/<tool> or bun x <tool>
- **sudo**: not available
- **sqlite**: sqlite3 CLI and node:sqlite NOT available — use bun:sqlite via `bun -e "..."`
- **Build check**: cd agents && npx tsc --noEmit
- **agents/ is a separate git repo** — commit from agents/ dir
- **Code search**: `scripts/code-search.sh <pattern>`
- **Gym runner**: scripts/gym-run.sh <scenario> --agent coder
```

### For coach (consolidate into block at top)

```markdown
## Environment
- **Project root**: /app — no /home/*, /Users/*, /root/*, or ~/ paths
- **No src/ directory** or package.json at /app root — the runtime is pre-compiled
- **bun**: .state/.bun/bin/bun (add to PATH: `export PATH=".state/.bun/bin:$PATH"`)
- **npx**: not available — use ./node_modules/.bin/<tool> or bun x <tool>
- **sqlite**: sqlite3 CLI not available — use `bun -e "import {Database} from 'bun:sqlite'; ..."`
- **agents/ is a separate git repo** — use git add from agents/ dir
- **Gym runner**: scripts/gym-run.sh <scenario> --agent <name>
- **Gym batch**: scripts/gym-batch.sh (--variants, --trials N, --tier/--category)
- **Gym scenarios**: agents/gym/scenarios/
- **ERROR_LOG files**: agents/*/ERROR_LOG.jsonl (NOT .state/error-log.jsonl)
```

## Deployment Plan

For each agent:
1. Add `## Environment` block at the very top of context.md
2. Remove the now-duplicated individual env facts from where they were scattered
3. Keep all behavioral rules in place — only restructure env facts

## Measurement

After deployment, track in next 10 evaluated sessions:
- Count tool calls wasted on path discovery, wrong directory, tool availability
- Compare to H-EXP-012 Phase 1 baseline
- Success: ≥40% reduction in env confusion waste
