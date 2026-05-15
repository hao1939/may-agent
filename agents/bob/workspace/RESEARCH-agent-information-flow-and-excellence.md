# Deep Research: Agent Information Flow & Excellence Mechanics

**Author**: Bob (Architect)  
**Date**: 2026-04-11  
**Session**: s_1775899748649_1337  

---

## Q1: What Do Agents Actually Read Each Turn?

### The Complete Information Flow (traced from source code)

When an agent session starts, information arrives in **two containers**:

#### Container 1: System Prompt (stable, cached)

The system prompt is wrapped in `<system_instructions>` tags (P84) and assembled in `resolveSystemPrompt()`:

| Order | Component | Source | Bob HB Size | Purpose |
|-------|-----------|--------|-------------|---------|
| 1 | **SOUL.md** | `agents/bob/SOUL.md` | 6,079 bytes | Identity, role, methodology, constraints |
| 2 | **common-sense.md** | `agents/shared/common-sense.md` | 2,937 bytes | Shared behavioral rules for all agents |
| 3 | **Skills** | `agents/bob/skills/*.md` (recursive) | 23,196 bytes | 7 skill files: README, cross-reference-source-code, knowledge-base-navigation, read-before-edit, verify-after-edit, verify-context-claims, tool-interface-protocol/SKILL |
| 4 | **Runtime Environment** | Generated | ~300 bytes | Paths, workspace, "don't re-read" list |
| 5 | **Available Tools** | Generated from tool list | ~200 bytes | Exact tool names to prevent hallucination |

**Total system prompt for Bob: ~32.5 KB** (~8,100 tokens)

This prompt is **identical across sessions** — by design (P147 KV-Cache Discipline). All volatile data goes in Container 2.

#### Container 2: First User Message (volatile, per-session)

The first user message is assembled in `buildSessionContext()` + dispatch logic. It's the concatenation of:

```
[Session Context]  ← buildSessionContext()
---
[Few-Shot Examples] ← routeFewShotExamples() (if matched)
---
[Task Text]  ← the actual assignment
```

Session Context includes, in order:

| Order | Component | Source | Typical Size | Purpose |
|-------|-----------|--------|-------------|---------|
| 1 | **Session ID + Time** | Generated | ~100 bytes | Session identity |
| 2 | **Recent Task History** | `getRecentDigests()` — up to 10 digests | ~1-3 KB | What happened recently (structured: what, outcome, files) |
| 3 | **Cross-Agent Digests** | `getCrossAgentDigests()` — max 3 | ~0.5-1 KB | What OTHER agents changed in files THIS agent cares about |
| 4 | **Unresolved Items** | `getUnresolvedDigests()` | ~0-0.5 KB | Past sessions that left things open |
| 5 | **Active Recall Warnings** | `runActiveRecall()` — scans ERROR_LOG.jsonl | ~0-0.5 KB | Recent failures to avoid repeating |
| 6 | **Last Checkpoint** | `readLatestCheckpointForAgent()` | ~0-0.3 KB | Resume state from interrupted work |
| 7 | **context_files** | From agent definition | varies | Extra files loaded per agent config |
| 8 | **context.md** | `agents/bob/context.md` | 2,976 bytes | Persistent accumulated knowledge |
| 9 | **Knowledge Routing** | `routeKnowledge()` — heartbeat only | ~0-1 KB | Relevant KB entry pointers (H-043) |

**Total session context for Bob heartbeat: ~5-9 KB** (~1,500-2,500 tokens)

#### Container 3: Task Text

For a heartbeat, this is the full `heartbeat.md` (7,792 bytes / ~2,000 tokens) prepended with `[heartbeat]` marker and `## Injected: heartbeat.md`.

For delegated work sessions, this is the task description from the dispatcher.

#### Container 4: Few-Shot Examples (conditional)

Only injected for `coder` and `optimizer` agents (Phase 1). Bob never gets few-shot injection. Max 2 examples, max 3,000 token budget. Delivered in the task message (positional privilege — EXP-095/096).

### Total Cold-Start Input for Bob Heartbeat

| Component | Bytes | Tokens (est.) |
|-----------|-------|---------------|
| System prompt | ~32,500 | ~8,100 |
| Session context | ~5,000-9,000 | ~1,500-2,500 |
| Task (heartbeat.md) | ~7,800 | ~2,000 |
| **Total** | **~45-49 KB** | **~12-13K tokens** |

This is still lean. A Gemini 3 Pro context window is ~1M tokens. Bob starts with ~1% utilized. But the skill files alone (23KB) are the largest single component — worth noting for the skill-stack-ceiling discussion (KE-110).

### Bob's Skill Portfolio — H-100 in Miniature

Bob's 7 skill files (23KB) are all **process-discipline** content, not domain knowledge:

| Skill | Size | Type | H-100 Category |
|-------|------|------|----------------|
| cross-reference-source-code | 4.2KB | "grep before editing config" | **Guard-like** (process sequence) |
| knowledge-base-navigation | 4.9KB | "ls before reading unfamiliar dirs" | **Guard-like** (process sequence) |
| read-before-edit | 2.7KB | "read() before every edit()" | **Guard-like** (process sequence) |
| verify-after-edit | 2.2KB | "verify writes took effect" | **Guard-like** (process sequence) |
| verify-context-claims | 4.3KB | "verify context claims before trusting" | **Guard-like** (process sequence) |
| tool-interface-protocol | 4.8KB | "use native tools, not bash" | **Guard-like** (process sequence) |
| README | 0.1KB | placeholder | N/A |

**Every single skill is a process-discipline rule** — "do X before Y" or "verify Z after W." None are content knowledge (no "how to analyze papers" or "how to write hypotheses"). This is a real-world instance of H-100's prediction: the skills that persist in the system prompt are guards disguised as skills. Content knowledge has already been internalized or is delivered via the task message.

### The Guard Pipeline (Behavioral Enforcement Layer)

Before any tool call reaches execution, it passes through **10 guards** (`composeGuards()` in `createAgent()`):

1. **EmptyArgsGuard** — rejects tool calls with empty/missing arguments
2. **ToolSchemaGuard** — validates arguments match tool schema
3. **PathHallucinationGuard** — intercepts bash commands with hallucinated file paths (EXP-132)
4. **CompletenessGuard** — agent-specific completeness checks (optimizer FM-2.2, EXP-115)
5. **FinishGuard** — prevents premature finish without verification (FM-3.3, EXP-123)
6. **CommitGuard** — prevents commits of untested/broken code (coder, EXP-110)
7. **VerificationDepthGuard** — blocks superficial verification at finish time
8. **ReadDedupGuard** — prevents re-reading the same file repeatedly
9. **SessionReadGuard** — prevents reading from other sessions' directories
10. **ScrapeDedupGuard** — prevents re-scraping the same URL

These guards are the **permanent infrastructure** layer predicted by H-100 (Skill-Guard Divergence). They enforce process discipline that agents cannot internalize across session boundaries.

---

## Q2: Where Does Quality Come From? The Production Quality Anatomy

### Quality Distribution (from evaluations DB)

The system's quality scores follow a **tri-modal distribution** (KE-112, EXP-109):

| Quality Score | Count | % |
|---------------|-------|---|
| 4-5 (high) | 11,088 | 60.9% |
| 2-3 (moderate) | 3,562 | 19.6% |
| 0-1 (low) | 3,521 | 19.3% |

Verdict distribution: 9,455 good (52%), 6,212 acceptable (34%), 2,501 skipped (14%), 3 needs_improvement.

### The Three Sources of Quality

Based on 133 experiments and production observational data:

**1. Content Knowledge (Skills — Channel 3)**
- What the agent knows about how to approach a task
- Delivered via: SOUL.md, skills/*.md, few-shot examples, knowledge routing
- Evidence: EXP-084-097 show few-shot matched examples take scenarios from 0% → 100%
- Lifecycle: **Internalizes** — EXP-104 found skills eliminated confabulation pre-experiment
- Boundary: Actively harmful on discovery tasks (EXP-117/120/130), ceiling at 5-skill stack (KE-110)

**2. Process Discipline (Guards — Channel 2)**
- Forced structural enforcement of procedures the agent would skip
- Delivered via: `beforeToolCall` guard pipeline, forced externalization workflows
- Evidence: EXP-110 (commit guard +51pp recovery), EXP-115 (completeness +100pp), EXP-123 (verification +29.5pp for Bob)
- Lifecycle: **Permanent** — FM-3.3 attempt rate increased from 27% → 70% over 26 days (KE-106)
- Mechanism: Recovery, not prevention. Guards catch and force correction.

**3. Structural Access (Context — Channel 1)**
- Whether the agent has the right information available when making decisions
- Delivered via: cross-reference injection, environmental setup, multi-session handoffs
- Evidence: EXP-079 (cross-reference +100pp, largest single-intervention effect), EXP-083 (generalized across domains)
- Lifecycle: **Architectural** — depends on scenario design and infrastructure
- Key insight: KE-052 (Structural Access Thesis) — access constraints dominate content quality

### The Channel Hierarchy (H-098, confirmed)

| Channel | Mechanism | Scope | Production Status |
|---------|-----------|-------|-------------------|
| **Ch2: Structural Guards** | `beforeToolCall` hooks, forced gates | Process discipline | 4 guards deployed (finish, commit, completeness, path hallucination) |
| **Ch1: Context Injection** | Task-message content, cross-refs | Information access | Knowledge router (heartbeat only), cross-agent digests |
| **Ch3: Behavioral Examples** | Few-shot, skills/*.md | Content knowledge | Coder/optimizer only; harmful on discovery tasks |

**Ch2 is dominant**: It works on ALL task types, never harms, and handles the most common failure mode (FM-3.3 verification skip, which is 80% of Bob's FM-Heavy Worker sessions).

---

## Q3: What's the Agent Collaboration Architecture?

### Inter-Agent Communication Channels

Agents communicate through **four mechanisms**:

1. **File System (Primary)** — Shared knowledge base (`agents/shared/knowledge/`), experiment files, INDEX.md
2. **Cross-Agent Digests** — Structured summaries of recent sessions, filtered by file-overlap relevance
3. **Subagent Dispatch** — Parent agents fork child sessions with task descriptions + context
4. **Request Tracking DB** — Tracked requests with status, enabling async coordination

### The Dispatch Pattern

```
Heartbeat (periodic wake-up)
  └─ Triage: scan todo.md, periodic-tasks.md, inbox, recent activity
  └─ Decision: what's the highest-value work?
  └─ Fork: subagent.dispatch() with structured task + context
       └─ Child session runs to completion
       └─ Result captured in digests
  └─ Brief: update last-heartbeat-brief.md
```

Bob dispatches to:
- **Coach** — experiment execution, gym runs
- **Coder/Tech-Lead** — code implementation via implement-and-review workflow
- **Self** — work sessions for KB integration, hypothesis authoring, synthesis

### What Cross-Agent Digests Actually Contain

`getCrossAgentDigests()` looks for sessions by OTHER agents that modified files this agent recently touched. Limited to 3 digests in a 2-hour window. This means:

- Bob sees when Coach ran an experiment and modified results files
- Coach sees when Bob updated hypothesis trackers
- May sees when any agent modified code she deployed

The filter is **file-overlap-based**, not topic-based. An agent working on an unrelated file in the same directory won't appear.

### Unresolved Items: The Continuity Bridge

`getUnresolvedDigests()` surfaces sessions that ended with `status: 'partial'` or `status: 'blocked'`. This creates a continuity mechanism — if Bob's last session was interrupted, the next heartbeat sees what was left unfinished.

---

## Q4: The Excellence Profile — What Separates Top Sessions from Bottom?

### Top Sessions (quality ≥ 4.5)

From evaluation data, top sessions share:
- **Clear task scope** — single deliverable, well-defined success criteria
- **Low tool waste** — productive calls >> wasted calls
- **Result delivered** — actual artifact produced, not just analysis reported
- **Convention compliance** — proper finish() with evidence, proper file operations

### Bottom Sessions (quality < 0.3)

Bottom sessions exhibit:
- **FM cascades** — one failure mode triggers subsequent ones (FM-2.1 → FM-3.3 cascade, KE-115)
- **Tool spirals** — repeated failed tool calls (EXP-099 Archetype 1)
- **Verification theater** — claiming verification without actually checking (FM-3.3b)
- **Scope explosion** — taking on more than the task requires (FM-2.2/2.6)

### Agent-Specific Failure Signatures (KE-115, EXP-113)

| Agent | Dominant FM | Rate in FM-Heavy Sessions | Primary Mechanism |
|-------|------------|--------------------------|-------------------|
| **Bob** | FM-3.3 (verification skip) | 80% | Discovery-mode optimism — assumes correctness |
| **Coder** | FM-3.3 (verification skip) | 75% | Coding momentum — finishes without testing |
| **Coach** | FM-2.1 (approach error) | 55% | Strategic misread — wrong tool/method choice |
| **Optimizer** | FM-2.2 (incomplete) + FM-3.3 | 51% + 57% | Missing requirements + verification skip |

### The Dose-Response Cliff

EXP-113 found a **cliff at FM ≥ 4**: sessions with 4+ failure modes have near-zero quality. Below 4 FMs, quality degrades linearly. This means **preventing the 3rd FM is more important than preventing the 1st** — the system can tolerate 1-2 failures but collapses beyond 3.

---

## Q5: System State Assessment — Where Are We?

### Research Maturity

| Metric | Value | Assessment |
|--------|-------|------------|
| Experiments completed | 133 | Extensive — covering skills, guards, channels, production |
| Hypotheses tracked | 34 (17 high-confidence, 13 archived) | Rich theoretical framework |
| Knowledge entries | ~140+ | Deep knowledge base |
| Production guards deployed | 4 (finish, commit, completeness, path) | Core safety net established |
| Research velocity | ~10 EXP/day at peak | High but decelerating (expected) |

### The Frontier: What's Left to Learn

1. **Production Quality Measurement** (CR-339 Priority #1): Are gym improvements translating to production? Only EXP-123 has production evidence. Most of our 133 experiments are gym-only. The gym-production gap (EXP-107) is structural and may mean many findings don't generalize.

2. **Discovery Task Boundary** (H-099, confirmed): All three channels fail on discovery tasks. 5 interventions tested (EXP-117/120/121/122/126/130), all null or harmful. Creative inference is a fundamentally different capability.

3. **Skill-Guard Divergence** (H-100, proposed): Whether skills truly internalize and guards truly remain permanent is the key question for system architecture. If confirmed, the investment strategy changes: build more guards, fewer skills.

4. **Scaling the Guard Portfolio**: Currently 4 guards for ~10 known failure modes. The guard architecture (beforeToolCall hooks) scales well technically but each guard needs experimental validation before deployment.

### Architectural Insights

1. **The system prompt is a feature, not a bug**: At ~9.5KB, Bob's system prompt is compact. The decision to move volatile data to the first user message (P147) was correct — it enables KV-cache hits and keeps the "personality" stable.

2. **Positional privilege is real and binary**: EXP-095/096 proved that content in the system prompt is categorically different from content in the task message. Skills/few-shot examples MUST be in the task message to work. The system prompt is for identity and rules only.

3. **Guards are the highest-ROI investment**: They work across task types, don't harm discovery, accumulate (4 guards stack without interference), and handle the most common failure modes. Each deployed guard has shown +15-100pp recovery improvement.

4. **The file system is the right memory**: Cross-agent digests, knowledge routing, and checkpoint injection all use files as the coordination substrate. No vector DB, no embedding search — just structured markdown with keyword routing. This is consistent with "Simplest Thing That Works."

5. **The evaluator is a separate intelligence layer**: Post-session evaluation by a different model creates a feedback loop. But the evaluation itself has known biases (H-054, RIFT correlation r=0.81) and the jury is still out on whether it drives real improvement vs. Goodhart's Law (optimizing for eval scores rather than actual quality).

---

## Synthesis: The Agent Excellence Equation

```
Agent Quality = f(Content Knowledge, Process Discipline, Structural Access)

Where:
  Content Knowledge = SOUL + skills + few-shot  (Ch3, internalizable)
  Process Discipline = guards + forced-ext       (Ch2, permanent infrastructure)
  Structural Access  = context injection + xref  (Ch1, architectural)
```

The three factors are **not additive** — they interact:
- Content Knowledge × Process Discipline: Skills teach WHAT, guards enforce WHEN. Together they close the analysis-action gap (EXP-070/071/092).
- Content Knowledge × Discovery: Actively harmful. Few-shot and checklists displace exploration (EXP-117/130).
- Process Discipline × Complexity: Guards fail at high complexity (EXP-100). There's a ceiling.
- Structural Access × Everything: When the right information is available, most other interventions become unnecessary (EXP-079/083/104).

**The deepest insight**: Quality is not primarily about making agents smarter. It's about **preventing the failure cascade** (keep FM count < 4) and **ensuring information access** (structural access thesis, KE-052). The agent is already capable — the system's job is to prevent it from failing, not to make it succeed.
