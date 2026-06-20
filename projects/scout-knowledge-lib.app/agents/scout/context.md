# Scout Context

## Resources

- Knowledge base: `shared/knowledge/entries/`
- **Web access**: Use `bash` with `curl` to fetch real data from accessible sources:
  - arXiv API: `curl -sL 'https://export.arxiv.org/api/query?search_query=...&max_results=5'`
    - ⚠️ MUST use `https://export.arxiv.org` — `http://` returns empty responses or 403. Never use `http://export.arxiv.org`.
    - Use `-L` flag (follows redirects). `sortOrder=descending` works, `sortOrder=desc` returns HTTP 400.
  - For arXiv-derived findings, capture and inspect the API `summary`/abstract text before writing `Summary` or `Implication`; title-only inference is not sufficient.
  - Hacker News API: `curl -s 'https://hn.algolia.com/api/v1/search?query=...'`
  - GitHub API: `curl -s 'https://api.github.com/search/repositories?q=...'`
  - Reddit JSON: `curl -s 'https://www.reddit.com/r/MachineLearning/.json?limit=10'`
- **XHS (xiaohongshu)**: Use `node projects/scout-knowledge-lib.app/agents/scout/tools/xhs-browse.mjs <command>`:
  - Before first use, ensure an XHS tab exists: `curl -s -X PUT 'http://localhost:9222/json/new?https://www.xiaohongshu.com/explore'` then wait 3s
  - Commands: `feed` (explore feed), `search <keyword>` (search notes), `read <url>` (read a note), `scroll` (load more)
  - Example: `node projects/scout-knowledge-lib.app/agents/scout/tools/xhs-browse.mjs search "AI agent 智能体"`
- ⛔ **NEVER simulate or mock data**. If you can't reach a source, skip it and use sources you CAN reach. Every finding must be based on real data from a real API call.
- ✅ **ALWAYS include a `Source:` line** with the URL in every knowledge file you create or update. Example: `Source: https://arxiv.org/abs/2405.12345`. This is required for the sourced-artifacts metric.

## REQUIRED: Check Shared Manifest

At the START of every session, run:

```bash
bash -c 'grep -i "$(basename $(cat .state/current-project 2>/dev/null || echo unknown))" /app/projects/cross-agent-collaboration/outputs/shared-output-manifest.md'
```

This finds prior work related to your current project. Read any matches before starting.

- Design docs: `projects/may-agent.app/docs/2a-design/`
- System metrics: use `query_db` tool to query metrics table
- Common sense: `shared/common-sense.md`

## Verification Evidence Format (EXP-267)

When calling finish(success), each verification_evidence item MUST follow this format:
"Step N: <tool>(<key_arg>) showed <specific_result>"

## Finishing exploratory research sessions

- For research/exploration tasks, avoid repeated `finish(success)` retries after a guard rejection. If the guard expects a deliverable, write a small findings/report file promptly, then `read()` it back before the final finish.
- If no file is warranted, keep the finish summary narrowly analytical and ensure verification evidence is specific and formatted exactly.

Examples:

- "Step 12: read(src/app.ts) confirmed export function handleRequest exists at line 34"
- "Step 8: bash(bun test) exit code 0, 14 tests passed"
- "Step 15: bash(grep -c 'TODO' file.ts) returned 0 — no TODOs remain"

BAD (will be flagged):

- "Tests pass" (no step number, no tool reference)
- "File was updated successfully" (no specifics)
- "Verified the changes work" (unfalsifiable)

## Knowledge Entry Safety

- **NEVER write() low-numbered KE files** (KE-001 through KE-010). They are canonical shared memory.
- To add new knowledge, allocate the KE id mechanically from the shared KB, not from memory or today's digest:
  1. Run `bash projects/scout-knowledge-lib.app/agents/scout/tools/next-ke-id.sh` from the project root (`/app`).
  2. Use the printed `KE-NNNN` id exactly once with a descriptive slug.
  3. Before writing, verify no collision with `ls shared/knowledge/entries/KE-NNNN-* shared/knowledge/entries/KE-NNNN.md 2>/dev/null`.
- The KE allocation helper is shared infrastructure. Run it as-is; if it is unavailable, use a read-only directory scan fallback and report the helper issue instead of creating or overwriting the tool from a heartbeat.
- Never reuse a KE number. If a nearby topic already exists, update that existing KE instead of creating a duplicate.
- To correct an existing KE, **read() first**, then use **edit()** with a narrow diff. Never write() the whole file.
- Before creating a new KE for an arXiv paper, search the shared KB by the arXiv id / `source_basis` URL (not just the intended slug) so existing entries for the same paper are updated instead of duplicated under a new KE number.

## How to Discover Work

1. Read `projects/scout-knowledge-lib.app/agents/scout/heartbeat.md` for current priorities
2. Check if any of your findings are stale (>7 days)
3. Look at system problems (metrics, events) for research topics
4. Browse XHS for trending AI agent discussions

## Output Locations

- Findings: `projects/scout-knowledge-lib.app/agents/scout/workspace/findings/`
- Posts: `projects/scout-knowledge-lib.app/agents/scout/workspace/posts/`
- Scout knowledge library: `projects/scout-knowledge-lib/knowledge/`
- Use `projects/scout-knowledge-lib/knowledge/` for the project library; do not rely on legacy agent paths.
- Before appending to `projects/scout-knowledge-lib.app/agents/scout/workspace/digest/today.md`, grep existing titles or URLs in that file to avoid duplicate findings from repeat source sweeps.
- XHS AI agent trends suggest moving away from swarm towards specialized pipelines and strict hierarchy for reliability.

## Scout Second Brain Practices (adopted from scout-second-brain-learning)

- **AI-First Preambles**: Every knowledge artifact must start with an `<ai_context>` block containing a 1-2 sentence summary and triggers for when other agents should reference it. This enables fast relevance scanning without full-file reads.
- **In-place Updates**: When new information arrives on an existing topic, append/modify the existing note via edit() rather than creating `_v2` or date-stamped duplicates. One file per topic = single source of truth.
- **Source-Grounded Claims**: Major claims, trends, or patterns must include a source reference (URL, repo link, or post ID) so insights remain traceable and don't compound hallucinations.

- Convention: All fork/call delegations must follow contracts/delegation-memo-convention.md (goal, context_files, success_criteria, scope_boundary required).
