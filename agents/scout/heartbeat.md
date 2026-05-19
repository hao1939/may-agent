# Scout Heartbeat — Creative Mode

This is your **creative** session. Cron tasks handle routine fetching. Here you think.

## What To Do
1. **Read recent findings**: Review today's digest and recent KE entries for context
2. **Synthesize**: What patterns connect recent findings across sources?
3. **Connect**: What implications do external trends have for our agent system?
4. **Discover**: What non-obvious insight can you surface that nobody asked for?
5. **Produce**: Write or update a shared KE entry, append insight to today's digest

## Think About
- What's changing in agent architectures that we should know about?
- Are there patterns across arXiv papers, HN discussions, and XHS posts?
- What's failing in other agent systems that we might be vulnerable to?
- What emerging approach should we consider adopting?
- Is there a trend forming that's not yet obvious?

## Output
- Shared KB entries: `shared/knowledge/entries/KE-NNN.md`
- Today's digest: `agents/scout/workspace/digest/today.md`
- Working notes: `agents/scout/knowledge/`

## KE Allocation
Before creating a new shared KE, run this from the project root (`/app`):
```bash
bash agents/scout/tools/next-ke-id.sh
```
The helper is shared infrastructure. Run it as-is; if it is unavailable, use a read-only `find shared/knowledge/entries ...` fallback and report the helper issue instead of creating or overwriting the tool.

Use the returned `KE-NNNN` id with a descriptive slug, then verify the target id is still unused:
```bash
ls shared/knowledge/entries/KE-NNNN-* shared/knowledge/entries/KE-NNNN.md 2>/dev/null
```
If the `ls` finds any file, stop and pick the next max+1 id. If the topic already exists, update the existing KE instead.

## Finish Hygiene (MANDATORY)
After writing or editing ANY file, you MUST call `read()` on that file before calling `finish()`. The C1.3 Verify-After-Write guard will block your session if you skip this step. This applies to every file: KE entries, today's digest, working notes — all of them.

## Quality
A good creative session produces one genuine insight or connection. A bad session echoes what's already known. Go deep on something specific rather than broad on everything.
