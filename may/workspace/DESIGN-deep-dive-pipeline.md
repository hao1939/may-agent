# DESIGN: Deep-Dive Pipeline — Scout → Bob Research Flow

**Author:** May  
**Date:** 2026-04-14  
**Status:** Ready for implementation  
**Directive:** Hao (fix deep-dives system)

## Problem

Scout produces research deep-dives (DD#NNN) that Bob needs to consume.
The current system has 3 problems:
1. **Three locations** — `shared/knowledge/library/deep-dives/` (1514 files, canonical), `shared/deep-dives/` (5 files, rogue), and `shared/deep-dives/processed/` (unknown)
2. **No notification mechanism** — Bob must scan a 1514-file directory to find new items. `postboard_brief.md` was abandoned March 30.
3. **No priority/relevance signal** — All DDs look equal. Bob can't tell which are actionable vs. archive.

## Design

### Principle: One Location, One Queue, One Consumer

**One canonical location**: `agents/shared/knowledge/library/deep-dives/` (already exists, already has 1514 files). Delete the rogue `agents/shared/deep-dives/` folder.

**One queue**: `agents/shared/knowledge/library/deep-dives/INBOX.md` — a simple Markdown file that Scout appends to when producing new DDs. Bob reads and marks items as processed.

**One consumer model**: Bob reads INBOX.md in heartbeat, picks items to synthesize, marks them done.

### INBOX.md Format

```markdown
# Deep-Dive Inbox

New deep-dives for Bob to review. Scout appends, Bob processes.

## Unread
- [ ] DD#758 — Title — ★★★★★ — `DD-758-filename.md` — 2026-04-14
- [ ] CR#330 — Title — ★★★★ — `CR-330-filename.md` — 2026-04-14

## Processed (last 20)
- [x] DD#757 — Title — processed 2026-04-13 → KE-130
- [x] DD#756 — Title — processed 2026-04-13 → skipped (not relevant)
```

### Changes Required

#### 1. Delete rogue location
- Delete `agents/shared/deep-dives/` entirely (5 files are already in the library or can be moved)
- Move any unique files to `agents/shared/knowledge/library/deep-dives/` first

#### 2. Create INBOX.md
- Create `agents/shared/knowledge/library/deep-dives/INBOX.md`
- Seed it with the unchecked items from Scout's `todo.md` (DD#411, DD#424, DD#516, DD#517, CR#283, H-068)

#### 3. Update Scout's workflow
- **Scout heartbeat.md**: Replace "write to postboard_brief.md" with "append to INBOX.md"
- **Scout context.md**: Add "After writing a DD, append an entry to `agents/shared/knowledge/library/deep-dives/INBOX.md`"
- **Scout SOUL.md**: No change needed (already says write to library)
- **Delete postboard_brief.md** — replaced by INBOX.md

#### 4. Update Bob's workflow
- **Bob heartbeat.md**: In the "Skim new library items" step, change to: "Check `agents/shared/knowledge/library/deep-dives/INBOX.md` for unchecked items. Pick the highest-starred ones to process."
- **Bob context.md**: Add "New deep-dives arrive in `agents/shared/knowledge/library/deep-dives/INBOX.md`. Check this instead of scanning the full directory."

#### 5. Standing order
- Already added ORDER-004 for design docs. No new standing order needed — the inbox pattern is specific to scout→bob flow.

### What This Does NOT Change
- DD numbering convention (stays DD#NNN)
- DD file format (stays as-is)
- Where DDs are stored (stays in library/deep-dives/)
- Scout's research process
- Bob's synthesis/hypothesis process

### Migration
1. Check if the 5 files in `shared/deep-dives/` are already in the library. If not, move them. If yes, delete.
2. Move `shared/deep-dives/processed/` contents to library if unique.
3. Delete `shared/deep-dives/` entirely.
4. Create INBOX.md with current unprocessed items from scout todo.md.
5. Update scout heartbeat, scout context, bob heartbeat, bob context.
6. Delete scout/postboard_brief.md.

### Success Criteria
- `agents/shared/deep-dives/` no longer exists
- `agents/shared/knowledge/library/deep-dives/INBOX.md` exists with unread items
- Scout's heartbeat mentions INBOX.md (not postboard)
- Bob's heartbeat mentions INBOX.md
- Scout's next DD write also appends to INBOX.md
- Bob's next heartbeat checks INBOX.md
