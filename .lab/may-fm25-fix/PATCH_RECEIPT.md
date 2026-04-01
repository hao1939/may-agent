# Patch Receipt: may-fm25-fix

**Agent**: may
**Error**: FM-2.5 (TOOL_MISUSE / TOOL_SCHEMA_ERROR) — 6 occurrences in 7 days
**Root Cause**: Existing guards in SOUL.md and LESSONS.md are declarative ("don't do it") but lack a structural pre-flight checklist at the point of action (heartbeat). The 3 sub-patterns:
1. `bash({})` — empty command parameter (3 occurrences)
2. `read({command:...})` — schema confusion, using read with bash's parameter (1 occurrence)
3. Tool error left unrecovered — no follow-up after failed command (2 occurrences)

**Patch**: Added `## 🔴 TOOL CALL PRE-FLIGHT (FM-2.5 — mandatory)` section to heartbeat.md (8 lines) with:
- 3-point checklist: bash→command, read→path, error→act
- Mnemonic for recall: "bash=command, read=path, errors=act"
- Placed just before Rules section so it's seen every heartbeat

**File Changed**: `heartbeat.md` (+8 lines)
**Why This Works**: Previous guards were in SOUL.md (read once) and LESSONS.md (not always consulted). The heartbeat is read EVERY session, making this guard inescapable. The checklist is actionable (3 specific checks) rather than aspirational ("don't make schema errors").

**Status**: READY_FOR_PROMOTION
**Created**: 2026-03-21T08:10:00Z
