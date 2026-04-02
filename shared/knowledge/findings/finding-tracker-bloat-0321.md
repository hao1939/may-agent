# Finding: Common-Sense Tracker Bloat — 50KB File Driving ~300KB/Session Context Waste

**Date**: 2026-03-21T01:12  
**Severity**: High — affects Coach's #1 cost driver (common-sense-verify sessions)

## Problem

`agents/coach/workspace/common-sense-tracker.md` is **50,116 bytes** — the single largest workspace file actively read/edited every session.

### Evidence (session s_1774051616443_174, 553KB total)
- **4 read() calls** on the tracker (~200KB input context)
- **3 edit() calls** on the tracker (~150KB input context, as tool results include surrounding context)
- **1 compact status read** (4.9KB) — barely used
- Total tracker-related context: **~350KB of a 553KB session** (63%)
- Tracker was read in **12 of 21 recent sessions** across Coach

### Root Cause

The tracker has grown to include **full session-level evidence** for all 41 items. Each row includes:
- Specific session IDs
- Quoted agent behaviors (sometimes multi-paragraph)
- Multiple dates of re-verification
- Cross-references to other items

Example: Item 2.3 (Verify after acting) alone is **~2,500 bytes** of evidence text.

### The Compact Status Exists But Is Underused

`agents/coach/workspace/common-sense-status.md` (4.9KB) was built specifically to replace full-tracker reads. But Coach still reads the full tracker in 4 of 5 verify sessions.

**Why**: Coach needs to EDIT the tracker (adding new evidence), which requires reading the full file first. The compact status only helps with *which item to verify next*, not with *recording results*.

## Proposed Fix: Split Tracker into Index + Evidence Archives

### Current structure (1 file, 50KB)
```
common-sense-tracker.md = index table + full evidence for ALL 41 items
```

### Proposed structure (1 index + N evidence files)
```
common-sense-tracker.md = index table only (~3KB)
  | Item | Status | Last Verified | Summary |
  
common-sense-evidence/
  cs-1.1-acknowledge.md = full evidence for item 1.1
  cs-2.3-verify-after-acting.md = full evidence for item 2.3
  ... (one per item that has evidence)
```

### Benefits
- Coach reads **3KB index** instead of 50KB tracker at session start
- Only reads the **specific evidence file** for the item being verified (~1-3KB each)
- Edits are to a small file, not the full tracker
- **Estimated savings**: ~300KB/session × 5 sessions/day = **~1.5MB/day**

### Implementation
This is a Coach-owned file, so Coach or May should execute the split. Optimizer recommends:
1. Create `agents/coach/workspace/common-sense-evidence/` directory
2. Extract each item's evidence into its own file
3. Reduce tracker to a summary table (item, status, date, 1-line summary)
4. Update Coach heartbeat/cron to reference the new structure

## Alternative: Instruct Coach to Use Compact Status First

Simpler fix: modify the `common-sense-verify` cron task to say:
- "Read `common-sense-status.md` first to pick your target item"
- "Only read the full tracker AFTER picking your item, and use `offset`/`limit` to read just that item's row"

This avoids any file restructuring but still saves ~200KB/session by avoiding full-file reads.
