# Scout Reference

### No Inline Research Rule
Do NOT call scrape_webpage, fetch arXiv, search GitHub/HN, or do ANY research in heartbeats. Even "just one quick search" snowballs — a recent session hit 78 ops (vs normal 6-16) because inline arXiv research exploded into 39 scrape_webpage calls.

- **LOOKING** = read todo.md, check git log, read pending tasks → OK inline
- **DOING** = any scrape_webpage, any fetch, any external research → MUST be forked

### Phase Structure for Deep Dives

| Phase | What | Gate to next phase |
|-------|------|--------------------|
| **1. Triage** | Scan sources, filter candidates, pick top 1-3 papers/repos | Candidate list with ★ ratings written |
| **2. Dive** | Read full paper/repo, extract key findings, note limitations | Raw notes captured in workspace/ |
| **3. Synthesize** | Write deep dive (DD#XXX) or cross-reference (CR#XXX) | DD/CR written to library/deep-dives/ |
| **4. Propagate** | Update INDEX.md, papers.md/repos.md, write RECOMMEND lines, log to research_log | Library updated, actionable items dispatched |

Phase rules:
- Checkpoint between phases. If running long after Phase 2, checkpoint raw notes and finish.
- Write as you go — each phase produces a written artifact.
- Phase 1 cap: 8 ops. If a paper doesn't look ★★★★+ in 2 ops, skip it.
- Never skip Phase 4. A deep dive that doesn't update INDEX.md is invisible to the team.
- After writing a DD/CR, append a checkbox entry to `agents/shared/knowledge/library/deep-dives/INBOX.md`.

### Multi-Paper Triage Phases

| Phase | What | Gate |
|-------|------|----|
| **1. Batch scan** | Scrape arXiv/HN listings, filter by relevance | Raw paper list with initial ★ ratings |
| **2. Evaluate** | Read abstracts, classify, identify ★★★★+ candidates | Final candidate list in workspace/ |
| **3. Deep dives** | Write DD for each ★★★★+ paper | DDs in library/deep-dives/ |
| **4. Propagate** | Update INDEX.md, covered_ids.txt, papers.md, dispatch RECOMMENDs | All library files updated |

### Work Session Templates

**Daily arXiv triage:**
```
[WORK SESSION] Triage arXiv batch — cs.MA and cs.AI
Objective: Identify high-signal papers, write deep dives for ★★★★+.
Read: workspace/todo.md, covered_ids.txt
Output: Deep dives to library/deep-dives/, papers to library/papers.md
Sources: arXiv cs.MA/new, cs.AI/new
```

**Weekend synthesis:**
```
[WORK SESSION] Weekend synthesis — connect this week's deep dives
Objective: Write CR#XXX synthesizing week's most important findings.
Read: library/deep-dives/INDEX.md, workspace/todo.md
Output: CR#XXX to library/deep-dives/
```

**Targeted research:**
```
[WORK SESSION] Research lead: <topic>
Objective: Find and evaluate papers/repos on <topic>. Write DD if ★★★★+.
If nothing meets threshold, note in todo.md and exit.
```

**Deep dive enrichment:**
```
[WORK SESSION] Enrich DD#XXX — full source code analysis
Objective: Add implementation details, ecosystem analysis, actionable lessons.
Clone or scrape actual repo — don't rely on README alone.
```

**Hypothesis writing:**
```
[WORK SESSION] Write hypothesis H-XXX: <title>
Objective: Formalize observation into testable hypothesis with predictions.
Include falsifiable predictions. Tag which agent should test it.
```

### Workflow Routing

| Work type | Workflow |
|-----------|----------|
| Deep dive → written finding | `workflow.run('verify-wrap', task)` |
| Multi-paper triage | `workflow.run('parallel-research', JSON.stringify({...}))` |
| Synthesis → actionable document | `workflow.run('verify-wrap', task)` |

### Research Log
Log every artifact to `.state/may.db`:
```bash
node -e "require('better-sqlite3')('.state/may.db').prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'scout', ?, ?)\").run('deep-dive', 'DD#NNN', null, Date.now())"
```
Types: `deep-dive`, `hypothesis`, `triage`, `knowledge-entry`.

### Safety: Read-then-Edit
Every file modification must follow: read() → edit() with exact oldText. For write() of new files: immediately read() back to verify.
