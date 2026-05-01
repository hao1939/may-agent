# Scout Reference

### Dispatch Protocol
- **LOOKING** (inline OK): read todo.md, check git log, read pending tasks
- **DOING** (must fork): any scrape_webpage, any fetch, any external research

### Phase Structure for Work Sessions

**Deep dive lifecycle:**

| Phase | What | Gate to next phase |
|-------|------|--------------------|
| **1. Triage** | Scan sources, filter candidates, pick top 1-3 papers/repos | Candidate list with ★ ratings written |
| **2. Dive** | Read full paper/repo, extract key findings, note limitations | Raw notes captured in workspace/ |
| **3. Synthesize** | Write deep dive (DD#XXX) or cross-reference (CR#XXX) | DD/CR written to library/deep-dives/ |
| **4. Propagate** | Update INDEX.md, papers.md/repos.md, write RECOMMEND lines, log to research_log | Library updated, actionable items dispatched |

**Phase rules:**
- Checkpoint between phases. If running long after Phase 2, checkpoint raw notes and finish.
- Write as you go — each phase produces a written artifact.
- Phase 1 cap: 8 ops. If a paper doesn't look ★★★★+ in 2 ops, skip it.
- Never skip Phase 4 — a deep dive that doesn't update INDEX.md is invisible.
- After writing a DD/CR, append a checkbox entry to `agents/shared/knowledge/library/deep-dives/INBOX.md`.

**Multi-paper triage phases:**

| Phase | What | Gate |
|-------|------|------|
| **1. Batch scan** | Scrape listings, filter by relevance | Raw paper list with ★ ratings |
| **2. Evaluate** | Read abstracts, classify, identify ★★★★+ | Final candidate list |
| **3. Deep dives** | Write DD for each ★★★★+ paper | DDs written |
| **4. Propagate** | Update INDEX, covered_ids.txt, papers.md | All library files updated |

### Work Session Templates

**Daily arXiv triage (weekday):**
```
[WORK SESSION] Triage <day> arXiv batch — cs.MA and cs.AI
Objective: Identify high-signal papers, write deep dives for ★★★★+.
Read: workspace/todo.md, covered_ids.txt
Output: Deep dives to library/deep-dives/, papers to library/papers.md
Sources: arXiv cs.MA/new, cs.AI/new
```

**Weekend synthesis:**
```
[WORK SESSION] Weekend synthesis — connect this week's deep dives
Objective: Write CR#XXX synthesizing the week's most important findings.
Read: library/deep-dives/INDEX.md, workspace/todo.md
Output: CR#XXX to library/deep-dives/
```

**Targeted research:**
```
[WORK SESSION] Research lead: <topic>
Objective: Find and evaluate papers/repos on <topic>. Write DD if ★★★★+.
```

**Deep dive enrichment:**
```
[WORK SESSION] Enrich DD#XXX — full source code analysis
Objective: Add implementation details, ecosystem analysis, actionable lessons.
```

**Hypothesis writing:**
```
[WORK SESSION] Write hypothesis H-XXX: <title>
Objective: Formalize observation into testable hypothesis with predictions.
```

### Research Log
After producing artifacts, log to `.state/may.db`:
```bash
node -e "require('better-sqlite3')('.state/may.db').prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'scout', ?, ?)\").run('deep-dive', 'DD#NNN', null, Date.now())"
```
Types: `deep-dive`, `hypothesis`, `triage`, `knowledge-entry`.

### Workflow Selection
| Work type | Workflow |
|-----------|----------|
| Deep dive → written finding | `workflow.run('verify-wrap', task)` |
| Multi-paper triage | `workflow.run('parallel-research', ...)` |
| Synthesis → document | `workflow.run('verify-wrap', task)` |

### Safety: Read-then-Edit
1. `read()` the target file to find exact insertion point
2. `edit()` using exact text from step 1 as `oldText`
3. For `write()` of new files: immediately `read()` back to verify

---

## Bob — `agents/bob/reference.md`

### Quick vs Must-Fork Tasks

**Quick inline (OK without forking):**
- Responding to a simple question from another agent
- Updating todo.md with a brief note
- Reading a single experiment result and noting the takeaway
- Marking a hypothesis as verified/refuted (if evidence is clear)

**Must-fork (always dispatch):**
- Writing or revising a hypothesis (H-XXX.md)
- Synthesizing across multiple knowledge entries or experiments
- Deep-dive analysis connecting library material to system problems
- Bayesian scoring or hypothesis corpus maintenance
- Reviewing and connecting new library additions
- Writing knowledge entries (KE-XXX.md)
- Any task requiring >5 tool calls

### Workflow Selection

| Work type | Workflow |
|-----------|----------|
| Single focused work session | `workflow.run('verify-wrap', task)` |
| 2+ independent research questions | `workflow.run('parallel-research', JSON.stringify({threads: [...]}))` |
| Multi-iteration research project | `workflow.run('persistent-task', ...)` |

**parallel-research example:**
```javascript
workflow.run("parallel-research", JSON.stringify({
  threads: [
    { label: "H-091 validation", task: "Analyze EXP-097/098 for H-091. Write to workspace/h091-analysis.md" },
    { label: "Cost model update", task: "Survey recent sessions for cost distribution. Update KE-060*.md" },
    { label: "Gym review", task: "Compare gym scores before/after training. Write to workspace/gym-review.md" }
  ],
  synthesisPrompt: "Cross-reference findings to assess research ROI.",
  defaultAgent: "bob"
}))
```

### Persistent Tasks
Check `agents/bob/workspace/projects/` for files with Status: active/paused.
- **active**: resume with `workflow.run("persistent-task", "project: <path>\nagent: bob\ngoal: <from file>")`
- **paused**: read and decide to resume or cancel
- **blocked**: read blocker, dispatch fix, then resume

### Work Session Templates

**Hypothesis writing:**
```
[WORK SESSION] Write hypothesis H-070: <title>
Objective: Formalize observation into testable hypothesis.
Read: workspace/todo.md, relevant experiments, existing hypotheses
Output: agents/shared/knowledge/hypotheses/H-070.md
Questions: What metric confirms/refutes? Predicted effect size? Who tests?
```

**Knowledge synthesis:**
```
[WORK SESSION] Synthesize <topic> from DD#501-504
Objective: Connect deep-dives to current system problems.
Read: relevant DDs, KEs
Output: agents/shared/knowledge/synthesis/<topic>.md
```

**Experiment result processing:**
```
[WORK SESSION] Process EXP-025 results
Objective: Convert results into KEs and hypothesis updates.
Read: results-final.md, related hypotheses
Output: Update H-XXX status, write KE-XXX if warranted
```

### Research Log
```bash
export PATH=".state/.bun/bin:$PATH"
bun -e "import{Database}from'bun:sqlite';const db=new Database('.state/may.db');db.prepare(\"INSERT INTO research_log (type, ref, agent, rating, created_at) VALUES (?, ?, 'bob', ?, ?)\").run('experiment', 'EXP-XXX', 3, Date.now())"
```

### Key Principles
- Independent judgment — reject requests lacking evidence, push back on bad designs
- Tech-lead is peer, not subordinate — review their proposals, let them challenge yours
- See `agents/shared/protocols/escalation.md` for disagreement resolution

---

## Optimizer — `agents/optimizer/reference.md`

### Quick vs Must-Fork Tasks

**Quick inline (OK without forking):**
- Updating todo.md with a brief note
- Acknowledging a dispatch
- Checking a single metric from checkpoint data

**Must-fork (always dispatch):**
- Multi-query DB analysis (Session Archaeology)
- Tool gap analysis requiring file reads
- Skill/technique scouting with multiple file reads
- Workflow health checks with multiple queries
- ANY building, coding, or experimentation
- Reading experiment results and writing findings

### Exploration Mode Details

**Mode A: Session Archaeology** — Dig into recent sessions, find pain points, identify automation opportunities. Query session DB for patterns: high-op sessions, error clusters, repeated tool sequences.

**Mode B: Tool Gap Analysis** — Find multi-step bash patterns that should be tools. Look for repeated command sequences across agents that could be consolidated.

**Mode C: Skill & Technique Scouting** — Review scout findings (deep-dives, papers), compare high/low performing sessions, identify techniques worth adopting.

**Mode D: Workflow Health** — Check workflow adoption, success rates, overhead. Use `workflow.run('investigate-and-fix', task)` — don't just write a finding, fix it.

### Workflow Selection

| Work type | Workflow |
|-----------|----------|
| Investigation → fix | `workflow.run('investigate-and-fix', task)` |
| Building a tool/skill | `workflow.run('implement-and-verify', task)` |
| Analysis / finding | `workflow.run('verify-wrap', task)` |
| Multi-question analysis | `workflow.run('parallel-research', JSON.stringify({...}))` |

### Finding Conversion — Dispatch, Don't Just Log

**Problem**: Only ~7% of findings become deployed fixes.

**Rule**: When analysis produces a finding with a concrete fix, **fork a tech-lead or coder session with the fix details BEFORE the cycle ends.** Don't just write the finding — dispatch it.

Template:
```
If finding has a concrete fix:
  → agents.fork('tech-lead', `[FIX] <title>\nFinding: <what's wrong>\nFile: <path>\nFix: <exact change>\nEvidence: <how to verify>`)
  → Note in todo.md: "Dispatched: <finding> → tech-lead (<date>)"
```

### Cross-Cycle Dispatch
```
agents.message({ agent: "tech-lead", message: "Finding: [summary]. Fix: [action]. Files: [paths]. Evidence: [what you measured]." })
```
- Every dispatch must be concrete
- Don't use for things fixable in <3 ops
- For system-scope changes, route through May

### Rules for Building (in forked sessions)
- Always measure before AND after — no baseline = no evidence
- One improvement per session — don't stack changes
- Write results to knowledge base: experiments/ for experiments, entries/ for findings

### Monthly Code Hygiene
