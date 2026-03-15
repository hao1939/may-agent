# Skill: Memory Consolidation

**Status:** TESTED (Bob-approved H579, refinement applied)
**Owner:** Coach
**Source:** Bob brief (`agents/bob/workspace/brief-memory-consolidation.md`)
**Purpose:** Compress append-only logs (journals, error logs) into durable knowledge, archive raw data, reduce context rot.

---

## Trigger Conditions

Run this skill when ANY of:
1. An agent's `workspace/journal.md` exceeds 500 lines
2. An agent's `ERROR_LOG.jsonl` exceeds 100 entries
3. Periodic: every 50 heartbeats (check `workspace/periodic-tasks.md`)

## Input

- `agents/{agent}/workspace/journal.md`
- `agents/{agent}/ERROR_LOG.jsonl`

## Process

### Step 1: Survey
```bash
wc -l agents/*/workspace/journal.md agents/*/ERROR_LOG.jsonl 2>/dev/null | sort -rn | head -20
```
Pick the largest file. Process ONE agent per consolidation run (avoid token explosion).

### Step 2: Extract Durable Facts
Read the target file. For each section/entry, classify:
- **DURABLE FACT**: Something true about the system that won't change soon (e.g., "P53 blocks bash commands containing SOUL.md", "Optimizer's bash({}) is infrastructure truncation, not behavioral")
- **RESOLVED INCIDENT**: A one-time issue that was fixed (e.g., "H516: evaluator session-ID confusion fixed by excluding self-evaluation")
- **NOISE**: Routine heartbeat entries, timestamps without insights, WIP notes

Rules:
- Extract ONLY facts with lasting value
- Each fact must be 1-2 sentences, atomic
- Include the source heartbeat number for traceability
- Do NOT fabricate or generalize beyond what the text says

### Step 3: Deduplicate Against Existing Knowledge
Before writing any extracted fact, select 2-3 **high-entropy keywords** from the fact (e.g., specific heartbeat numbers like 'H516', protocol names like 'P53', unique filenames, or error codes). Do NOT use generic stopwords like 'error', 'session', 'agent', or 'fixed'.
```bash
grep -l "H516" agents/{agent}/knowledge/*.md agents/shared/knowledge/*.md
grep -l "P53" agents/{agent}/knowledge/*.md agents/shared/knowledge/*.md
```
If the fact already exists in knowledge files, SKIP IT.

### Step 4: Update Knowledge
Write durable facts to the appropriate location:
- Agent-specific facts → `agents/{agent}/knowledge/consolidated-{date}.md`
- System-wide facts → `agents/shared/knowledge/strategies.md`

Format:
```markdown
## Consolidated from {agent} journal ({date})

- **[H{num}]** Fact text here.
- **[H{num}]** Another fact here.
```

### Step 5: Archive Raw Content
```bash
# Copy journal to archive first (safety)
cp agents/{agent}/workspace/journal.md agents/{agent}/knowledge/library/archives/{date}-journal.md

# Verify archive exists and matches
wc -l agents/{agent}/knowledge/library/archives/{date}-journal.md

# Only then truncate active journal to last 50 lines
tail -50 agents/{agent}/workspace/journal.md > /tmp/journal-tail.md
cp /tmp/journal-tail.md agents/{agent}/workspace/journal.md
```

### Step 6: Verify
1. Confirm archive file exists and has content: `wc -l agents/{agent}/knowledge/library/archives/{date}-journal.md`
2. Confirm new journal has 50 or fewer lines: `wc -l agents/{agent}/workspace/journal.md`
3. Confirm knowledge file has new entries: `tail -5 agents/{agent}/knowledge/consolidated-{date}.md`

### Step 7: Post Receipt
Write a consolidation receipt to `agents/shared/bulletin.md`:
```markdown
**[{date}] Memory Consolidation — {agent}**
- Source: journal.md ({N} lines → {M} lines)
- Extracted: {X} durable facts
- Archived to: knowledge/library/archives/{date}-journal.md
- Skipped (dedup): {Y} facts already in knowledge
```

## Output

- Archived journal in `knowledge/library/archives/`
- New knowledge entries in `knowledge/consolidated-{date}.md`
- Fresh journal.md with 50 or fewer lines
- Bulletin receipt

## Safety Rules

1. **NEVER delete without archiving first** — always `cp` then verify the archive exists before clearing
2. **Idempotent** — running twice should not duplicate knowledge entries (Step 3 dedup)
3. **Atomic facts only** — no narratives, no speculation, no summaries-of-summaries
4. **Preserve last 50 lines** — always keep recent context in the active journal

## Anti-Patterns

- Do not archive everything without extracting knowledge (just moving files accomplishes nothing)
- Do not extract too many facts (more than 20 per run means your threshold is too low)
- Do not delete journal.md without archiving first
- Do not write facts that are already in LESSONS.md, conventions.md, or knowledge files
