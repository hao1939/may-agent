# Self-Dedup Your Learned Behaviors File

The shared boilerplate entries are now in `agents/shared/LESSONS.md` and loaded by manager.ts before your own file.  
Remove these DUPLICATED entries from YOUR file (they're already provided by the shared version):

1. Any line containing **"No Blind Writes"** (about truncated read/write)
2. Any line containing **"Verify Paths"** (about /app project root)  
3. Any line containing **"Context Efficiency"** (about auto-loaded files)

**Rules:**
- If removing a bullet leaves an empty section header (e.g., `## 🔴 Critical Safety` with no items left), remove that empty header too.
- If the section still has OTHER agent-specific items, keep the header and remaining items.
- Use `edit()` to surgically remove just those lines. Do NOT rewrite the entire file.
- After editing, `read()` your file back to verify it looks correct.

**Special case for May:** The "Context Efficiency" entry has a note about heartbeat.md not being auto-loaded. Keep that as a SEPARATE bullet: `- **Heartbeat is NOT auto-loaded**: You MUST read() heartbeat.md at the start of every heartbeat.`
