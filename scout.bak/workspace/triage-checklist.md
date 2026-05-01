# Scout arXiv Triage Checklist
*Stable reference — stop re-deriving the process each session.*
*Owner: Scout. Created 2026-04-17 (closes system-gaps.md item "Repeated triage setup").*

---

## Pre-flight (≤2 ops)

1. **Counters & state** — `bash workspace/scripts/counters.sh show`
   - Confirm `search_state.last_arxiv_triage_date` ≠ today (else: already done, skip triage)
   - Note current DD number; increments below will use `DD+1`, `DD+2`, …
2. **Dedup set** — have `covered_ids.txt` path ready:
   `agents/scout/covered_ids.txt` (check before writing any DD).

## Phase 1 — Batch scan (cap: 8 ops, 2026 window)

Primary queries (pick based on day):
- **Weekday fresh listings** — `https://arxiv.org/list/cs.MA/new` and `https://arxiv.org/list/cs.AI/new`
- **Targeted search** (weekend or topic-led) — `https://arxiv.org/search/?searchtype=all&query=<terms>&start=0`
- **Semantic Scholar** fallback — `https://api.semanticscholar.org/graph/v1/paper/search?query=<terms>&limit=20`

Relevance keywords (★★★+ triggers):
- `multi-agent`, `agent collaboration`, `self-play`, `verifier`, `adversarial`
- `context engineering`, `long-context`, `memory`, `retrieval`
- `benchmark`, `evaluation`, `eval methodology`, `gym-production`
- `constitutional`, `process reward`, `rubric`, `critique`, `RLAIF`
- Focus areas (Hao): agent collab patterns, context learning, adversarial verification, automated research systems

Emit: a workspace/triage-<date>.md file listing `{arxiv_id, title, ★, 1-line hook}` — not the full abstract.

## Phase 2 — Evaluate (1-2 ops per candidate)

For each ★★★+ candidate:
1. Open `arxiv.org/abs/<id>` — read abstract + intro + conclusions
2. Rate 1-5 stars using this rubric:
   - ★★★★★: novel + quantitative + directly actionable to our system
   - ★★★★ : novel + either quantitative OR actionable
   - ★★★   : interesting lead; worth a note but not a DD
   - ≤ ★★   : skip
3. Dedup: `grep -F "<arxiv_id>" covered_ids.txt` AND `grep -i "<short title>" shared/knowledge/library/papers.md`

## Phase 3 — Deep dives (fork separate session if >1 candidate)

For each ★★★★+ paper:
1. `bash workspace/scripts/counters.sh bump DD` → get next DD#
2. Write `shared/knowledge/library/deep-dives/dd<NNN>-<slug>.md`
   - Standard sections: Summary, Method, Key findings, Limitations, Connections (our KEs/DDs), RECOMMEND lines
3. Read-then-edit for every file touch (C1.1).

## Phase 4 — Propagate (NEVER SKIP)

1. Append row to `shared/knowledge/library/papers.md` (read-then-edit)
2. Append checkbox to `shared/knowledge/library/deep-dives/INBOX.md` under `## Unread`:
   `- [ ] DD#NNN — Title — ★★★★ — \`filename.md\` — YYYY-MM-DD`
3. Update `shared/knowledge/library/deep-dives/INDEX.md`
4. Append triaged IDs to `agents/scout/covered_ids.txt`
5. Update `workspace/state.json`: set `search_state.last_arxiv_triage_date` = today, `last_triage_cluster` = query
6. Log to research_log DB:
   ```bash
   node -e "require('better-sqlite3')('.state/may.db').prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'scout', ?, ?)\").run('deep-dive', 'DD#NNN', 5, Date.now())"
   ```
7. If hypothesis-worthy → bump H counter, write to `shared/knowledge/hypotheses/H-NNN.md`

## Commit (from agents/ dir, not project root)

```bash
cd agents && git add -A && git commit -m "scout: arXiv triage <date> — DD#NNN-NNN (<count> papers)"
```

## Stop conditions

- **Phase 1 timeboxed at 8 ops** — if nothing ★★★+ surfaces, write triage-<date>.md with "no candidates" and exit.
- **No ★★★★+ → no DD.** Don't force a deep dive. A null result is a valid artifact.
- **At 60% budget** → commit what you have and finish with `partial`.

## Anti-patterns (what NOT to do)

- ❌ Inline arXiv search during heartbeat — always fork
- ❌ Writing DD before checking covered_ids.txt / papers.md for dupes
- ❌ Skipping Phase 4 propagation ("I'll update INDEX next session")
- ❌ Re-deriving the query strategy each session (this file exists for a reason)
- ❌ Editing counters in prose files — use `counters.sh` only
