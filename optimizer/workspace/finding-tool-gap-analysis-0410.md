# Finding: Tool Gap Analysis — Multi-Step Bash Patterns

**Date:** 2026-04-10  
**Mode:** B — Tool Gap Analysis  
**Status:** Complete

## Summary

65.1% of all tool calls across 883 sessions (13,825 of 17,906 total) are bash commands. 202 sessions (22.9%) have >20 bash calls, and 150 sessions have >80% bash. The dominant bash→bash transition pattern occurs 9,155 times — meaning agents routinely chain 5-50+ consecutive bash calls to accomplish tasks that could be served by purpose-built tools.

## Methodology

- Analyzed receipts.jsonl across 883 sessions in `agents/.state/sessions/history/`
- Extracted 13,825 bash commands and categorized by pattern
- Identified multi-step sequences using bigram/trigram analysis of tool call chains
- Sampled commands from the 30 highest-bash sessions to identify specific repeated patterns

## Top 5 Multi-Step Bash Patterns

### Pattern 1: Session Archaeology (Est. 15-25 ops/session, ~187 sessions)

**What:** Agents list sessions, loop through meta.json to find diverse agents, then tail/grep session.jsonl files to extract tool call patterns or outcomes.

**Typical sequence (15-25 bash calls):**
```
ls -t .state/sessions/history/ | head -30
for s in s_xxx s_yyy s_zzz; do cat .state/sessions/history/$s/meta.json | grep agent; done
tail -100 .state/sessions/history/$s/session.jsonl | head -100
grep -o '"toolName":"[^"]*"' .state/sessions/history/$s/receipts.jsonl
# ... repeat for 5-10 sessions
```

**Affected agents:** optimizer (72 high-bash sessions), coach (56), tech-lead (44)  
**Frequency:** 187 sessions with "Phase 1"/"DISCOVER"/"Scan sessions" tasks  
**Estimated savings:** 10-15 ops per session → **1,870–2,805 ops total**

**Proposed tool:** `session-query` — Single call that accepts filters (agent, date range, task pattern) and returns structured session summaries with tool usage stats, outcomes, and task descriptions. No need to iterate meta.json files manually.

---

### Pattern 2: Status Dashboard / Heartbeat Orientation (Est. 10-20 ops/session, ~200+ sessions)

**What:** Every heartbeat session starts with 5-15 bash calls to orient: check bulletin, journal tail, git log, error logs, pending requests, recent workflows. Tech-lead sessions average 41 consecutive bash calls in the worst case.

**Typical sequence (10-20 bash calls):**
```
cat agents/shared/bulletin.md | tail -40
cat agents/X/workspace/journal.md | tail -80
git log --oneline -5
ls -t .state/workflows/ | head -5
cat .state/workflows/wr_xxx.json | head -40
for agent in coder optimizer amy; do count=$(wc -l < agents/$agent/ERROR_LOG.jsonl); echo "$agent: $count"; done
tail -20 agents/coach/workspace/experiments.jsonl
cat agents/tech-lead/workspace/focus-tasks.md
```

**Affected agents:** tech-lead (130 bash runs of 5+), coach (205 bash runs of 5+), optimizer (163)  
**Frequency:** Nearly every heartbeat session (~350+ sessions)  
**Estimated savings:** 8-15 ops per session → **2,800–5,250 ops total**

**Proposed tool:** `agent-status` — Returns a structured status snapshot: recent commits, error counts per agent, active workflows, bulletin contents, journal tail, pending requests. One call replaces 10-15.

---

### Pattern 3: File Discovery & Catalog (Est. 8-15 ops/session, ~300+ sessions)

**What:** Agents use `ls`, `find`, `cat`, `wc` in chains to discover what files exist, read their contents, and count items. This is the single largest category: `ls` (2,528 calls, 18.3%), `cat` (1,529, 11.1%), `find` (1,071, 7.7%).

**Typical sequence (8-15 bash calls):**
```
ls agents/gym/scenarios/
find agents/gym/scenarios -name "*.json" -maxdepth 2
cat agents/gym/scenarios/X/scenario.json
cat agents/gym/scenarios/X/task.md
# repeat for 3-5 scenarios
ls agents/shared/skills/
for dir in agents/shared/skills/*/; do name=$(basename $dir); echo $name; done
```

**Affected agents:** All agents, especially coder (118 bash runs of 5+) and coach (205)  
**Frequency:** Appears in 300+ sessions  
**Estimated savings:** 5-10 ops per session → **1,500–3,000 ops total**

**Proposed tool:** `project-catalog` — Returns structured inventory of key directories (scenarios, skills, agent workspaces) with file counts, last-modified dates, and content previews. Parametric: `project-catalog scenarios` or `project-catalog skills`.

---

### Pattern 4: Git Archaeology (Est. 5-10 ops/session, ~120+ sessions)

**What:** Agents chain `git log` → `git show` → `git diff` to understand recent changes. QA does this every heartbeat to find unreviewed commits. Tech-lead checks recent activity. Total: 189 `git log` + 113 `git show` + 59 `git diff` = 361 git commands.

**Typical sequence (5-10 bash calls):**
```
git log --oneline -20
git show --name-only --oneline f136ac3
git show --stat f136ac3
git diff --name-only f136ac3..HEAD
git show f136ac3 --patch --max-count=1
```

**Affected agents:** QA (33 bash runs of 5+), tech-lead (130), optimizer  
**Frequency:** ~120 sessions  
**Estimated savings:** 3-7 ops per session → **360–840 ops total**

**Proposed tool:** `git-summary` — Returns recent commits with author, files changed, and diff stats in one call. Accepts parameters: `since`, `author`, `path`, `count`. Eliminates the log→show→diff chain.

---

### Pattern 5: Error Log Aggregation (Est. 3-8 ops/session, ~100+ sessions)

**What:** Agents iterate over agent ERROR_LOG.jsonl files using for-loops, then parse with `jq` or `grep` to count errors by pattern, agent, or time range.

**Typical sequence (3-8 bash calls):**
```
for f in agents/*/ERROR_LOG.jsonl; do echo "$f: $(wc -l < $f)"; done
cat agents/coder/ERROR_LOG.jsonl | tail -30
cat agents/evaluator/ERROR_LOG.jsonl | jq -r '.error' | sort | uniq -c | sort -rn
tail -50 agents/coach/workspace/experiments.jsonl | jq -c '{id, agent, scenario, result}'
```

**Affected agents:** coach (primary), tech-lead, optimizer  
**Frequency:** ~100 sessions  
**Estimated savings:** 2-5 ops per session → **200–500 ops total**

**Proposed tool:** `error-summary` — Returns error counts by agent, pattern, and time range. Accepts `--agent`, `--since`, `--pattern` filters. One call replaces the for-loop + tail + jq chain.

---

## Aggregate Impact Estimate

| Pattern | Sessions | Ops/Session Saved | Total Ops Saved |
|---------|----------|-------------------|-----------------|
| Session Archaeology | 187 | 10-15 | 1,870–2,805 |
| Status Dashboard | 350+ | 8-15 | 2,800–5,250 |
| File Discovery | 300+ | 5-10 | 1,500–3,000 |
| Git Archaeology | 120+ | 3-7 | 360–840 |
| Error Log Aggregation | 100+ | 2-5 | 200–500 |
| **Total** | | | **6,730–12,395** |

Against 17,906 total tool calls, converting these patterns to purpose-built tools could eliminate **37–69% of all ops**.

## Per-Agent Bash Breakdown

| Agent | Sessions | Total Ops | Bash Ops | Bash % |
|-------|----------|-----------|----------|--------|
| coach | 150 | 4,036 | 2,925 | 72.5% |
| tech-lead | 78 | 2,633 | 1,825 | 69.3% |
| optimizer | 121 | 4,511 | 3,048 | 67.6% |
| coder | 213 | 2,816 | 1,832 | 65.1% |
| qa | 89 | 827 | 523 | 63.2% |
| bob | 76 | 1,674 | 840 | 50.2% |
| scout | 24 | 441 | 214 | 48.5% |
| may | 116 | 784 | 364 | 46.4% |

## Priority Recommendation

1. **Status Dashboard tool** (highest impact: 2,800–5,250 ops, hits every heartbeat)
2. **Session Query tool** (high impact: 1,870–2,805 ops, hits all research sessions)
3. **Project Catalog tool** (moderate impact: 1,500–3,000 ops, broad usage)
4. **Git Summary tool** (moderate impact: 360–840 ops, focused usage)
5. **Error Summary tool** (lower impact: 200–500 ops, but easy to build)

## Data Sources

- 883 sessions from `agents/.state/sessions/history/` (March 20-23, 2026)
- 17,906 total tool calls, 13,825 bash (65.1%)
- Receipt-based analysis (receipts.jsonl) for tool sequence patterns
- Command-level extraction from session.jsonl for pattern categorization
