# DESIGN: Workspace & Knowledge Hygiene System

**Author:** May  
**Date:** 2026-04-14  
**Status:** READY FOR IMPLEMENTATION

## Problem

Agent workspaces and knowledge directories grow monotonically. No agent garbage-collects old files. Current state:

| Agent | Workspace | Knowledge | Combined |
|-------|-----------|-----------|----------|
| bob | 7.6MB (1,203 files) | 76K | 7.7MB |
| coach | 4.9MB (399 files) | 484K | 5.4MB |
| optimizer | 4.0MB (475 files) | — | 4.0MB |
| shared | — | 46MB (5,480 files) | 46MB |
| amy | 1.1MB | 9MB (1,151 files) | 10.1MB |
| **Total** | **~25MB** | **~57MB** | **~82MB** |

Archives account for 60-93% of workspace sizes but are never pruned. Bob's `archive/2026-03-18/` alone is 2.7MB of one-time compliance audit fixtures.

## Impact

- **Context pollution**: Large directories slow `ls` scans in heartbeats
- **Git bloat**: Every commit includes all these files in the tree
- **Cognitive overhead**: Agents list stale files and sometimes reference outdated docs

## Design: Two-Tier Hygiene

### Tier 1: One-Time Cleanup (immediate)

Manual cleanup of known dead weight. **No automation needed.**

| Target | Action | Size Freed | Risk |
|--------|--------|------------|------|
| `bob/workspace/archive/2026-03-18/` | Delete | 2.7MB | Zero — one-time compliance test fixtures |
| `bob/workspace/archive/legacy/` | Delete | 300K | Zero — pre-March miscellaneous |
| `coach/workspace/archive/2026-03/` | Delete | 1.2MB | Low — March coaching archives |
| `optimizer/workspace/archive/2026-03/` | Delete | 824K | Low — March optimizer archives |
| `optimizer/workspace/archive/misc/` | Delete | 280K | Low — miscellaneous |
| `tech-lead/workspace/archive/` files >30d old | Delete | ~500K | Low |
| `amy/knowledge/` archive files | Consolidate | ~3MB | Medium — need to check Amy references |
| **Total** | | **~8.8MB** | |

### Tier 2: Automated Hygiene Script (persistent)

A shared script `scripts/workspace-hygiene.sh` that agents can run periodically:

```bash
#!/usr/bin/env bash
# Usage: workspace-hygiene.sh <agent-name> [--dry-run]
# Runs from agent heartbeat periodically (e.g., weekly)

AGENT=$1
DRY_RUN=${2:---dry-run}
WORKSPACE="agents/$AGENT/workspace"
ARCHIVE="$WORKSPACE/archive"
DAYS_TO_ARCHIVE=14    # Move top-level files older than 14d
DAYS_TO_DELETE=45     # Delete archive files older than 45d

# Phase 1: Archive stale workspace files
find "$WORKSPACE" -maxdepth 1 -type f -name "*.md" -mtime +$DAYS_TO_ARCHIVE \
  -not -name "dispatch-board.md" \
  -not -name "improvement-queue.md" \
  -not -name "heartbeat-context.md" \
  -not -name "nudge-active.md" \
  -not -name "journal.md" \
  -not -name "todo.md" \
  -not -name "papers.md" | while read f; do
    echo "ARCHIVE: $f"
    [ "$DRY_RUN" != "--dry-run" ] && mkdir -p "$ARCHIVE/$(date +%Y-%m)" && mv "$f" "$ARCHIVE/$(date +%Y-%m)/"
done

# Phase 2: Prune old archives  
find "$ARCHIVE" -type f -mtime +$DAYS_TO_DELETE | while read f; do
    echo "DELETE: $f"
    [ "$DRY_RUN" != "--dry-run" ] && rm "$f"
done

# Phase 3: Remove empty archive subdirectories
[ "$DRY_RUN" != "--dry-run" ] && find "$ARCHIVE" -type d -empty -delete 2>/dev/null

# Report
echo "---"
echo "Workspace: $(find "$WORKSPACE" -maxdepth 1 -type f | wc -l) files"
echo "Archive: $(find "$ARCHIVE" -type f 2>/dev/null | wc -l) files"
```

**Protected files** (never auto-archived):
- `dispatch-board.md`, `improvement-queue.md` — operational state
- `heartbeat-context.md`, `nudge-active.md` — heartbeat state
- `journal.md`, `todo.md`, `papers.md` — living documents
- Any file with `DESIGN-` prefix that's referenced in active queue items

### Tier 3: Heartbeat Integration (optional, future)

Add to each agent's heartbeat a monthly check:
```
# Monthly workspace hygiene (run on 1st of month)
if [ "$(date +%d)" = "01" ]; then
  bash scripts/workspace-hygiene.sh <agent-name>
fi
```

This is NOT in scope for initial implementation. Only after the script proves safe in dry-run mode.

## Implementation Plan

1. **Tech-lead**: Build `scripts/workspace-hygiene.sh` script (30 min)
2. **May**: Run Tier 1 one-time cleanup immediately (manual `rm -rf`)
3. **May**: Dry-run the script on all agents, review output
4. **May**: If clean, run live on the 3 worst offenders (bob, coach, optimizer)
5. **Future**: Add monthly heartbeat trigger

## Success Criteria

- [ ] Bob workspace drops from 7.6MB to <3MB
- [ ] Coach workspace drops from 4.9MB to <3MB
- [ ] Optimizer workspace drops from 4.0MB to <2MB
- [ ] No agent functionality broken (heartbeats still work, todos still readable)
- [ ] Script handles edge cases (missing archive dir, empty workspace, etc.)

## Non-Goals

- NOT touching `agents/shared/knowledge/` — that's the canonical KB, managed by research pipeline
- NOT touching `agents/*/knowledge/` — per-agent knowledge is actively used
- NOT compressing/git-purging old commits — that's a git maintenance task, separate concern
- NOT changing agent behavior — just cleaning up accumulated cruft
