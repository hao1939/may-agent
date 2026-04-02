# Deep Dive: GNAP — Git-Native Agent Protocol

**Scout Research Report** | 2026-03-13
**Source:** https://github.com/farol-team/gnap (10★, MIT, v4 draft)
**Authors:** Farol Labs (Ori, Carl (AI), Leonid (CTO), Alex)
**Status:** Draft v4, March 2026. Production use at Farol Labs (4 agents, 50+ tasks).

---

## Executive Summary

GNAP (Git-Native Agent Protocol) is a minimalist specification for coordinating AI agent teams using git as the only transport and storage layer. No servers, no databases, no vendor lock-in. The entire protocol is four JSON entity types in a `.gnap/` directory: agents, tasks, runs, and messages. Agents follow a heartbeat loop (pull → check → work → push), and git history serves as the audit log.

**Why this matters to us:** GNAP is structurally almost identical to our own file-based multi-agent architecture. An independent team converged on the same fundamental design — shared filesystem, heartbeat-driven coordination, file-based task assignment and communication. The differences reveal specific protocol features we lack (typed messages, read-receipts, run records with cost tracking, formal task state machine) that would meaningfully improve our system.

**Verdict:** Not something to adopt wholesale (our architecture is more capable in several dimensions), but a rich source of concrete protocol improvements. Five specific features should be evaluated for adoption.

---

## Part 1: Protocol Architecture

### Design Philosophy

GNAP occupies the protocol layer in a three-tier stack:

```
┌──────────────────────────────────────────────────┐
│         Application Layer (optional)              │
│   budgets, dashboards, workflows, governance      │
├──────────────────────────────────────────────────┤
│         GNAP Protocol (the spec)                  │
│      agents · tasks · runs · messages             │
├──────────────────────────────────────────────────┤
│         Git (transport + storage)                 │
│   push/pull · merge · history · distribution      │
└──────────────────────────────────────────────────┘
```

Key design principle: **the protocol is intentionally minimal.** Operational concerns (budget enforcement, stall detection, concurrency control, quality scoring) are explicitly deferred to the application layer. The spec resists adding entities — four entity types are final.

### Directory Structure

```
.gnap/
  version              ← protocol version integer (currently "4")
  agents.json          ← the team (all agents in one file)
  tasks/               ← work items (one JSON file per task)
    FA-1.json
    FA-2.json
  runs/                ← execution attempts (one JSON file per run)
    FA-1-1.json
    FA-1-2.json
  messages/            ← communication (one JSON file per message)
    1.json
    2.json
```

### Entity Schemas

#### 1. Agent (`agents.json`)

Single file containing all team members. Humans and AI agents are first-class participants with identical schema.

```json
{
  "agents": [
    {
      "id": "carl",           // required: unique identifier
      "name": "Carl",         // required: display name
      "role": "CRO",          // required: job title
      "type": "ai",           // required: "ai" | "human"
      "status": "active",     // required: "active" | "paused" | "terminated"
      "runtime": "openclaw",  // optional: agent runtime
      "reports_to": "ori",    // optional: creates org tree
      "heartbeat_sec": 600,   // optional: poll interval (default 300)
      "capabilities": ["sales", "outreach"],  // optional: capability tags
      "contact": {}           // optional: platform handles
    }
  ]
}
```

**Notable:** Agent ID `*` is reserved for broadcast. The `reports_to` field creates an organizational hierarchy — not just a flat team list.

#### 2. Task (`tasks/{id}.json`)

One file per task. Has a formal state machine.

```json
{
  "id": "FA-1",
  "title": "Build Q2 lead pipeline — 20 qualified leads",
  "desc": "Research and compile 20 qualified leads for Sebastian",
  "assigned_to": ["carl"],
  "reviewer": "mayak",
  "state": "in_progress",
  "priority": 1,            // 0 = highest
  "created_by": "ori",
  "created_at": "2026-03-12T09:00:00Z",
  "updated_at": "2026-03-12T10:30:00Z",
  "due": "2026-03-19",
  "tags": ["Sales"],
  "blocked": false,
  "blocked_reason": null,
  "parent": null,            // creates subtask hierarchy
  "comments": [
    { "by": "carl", "at": "2026-03-12T10:30:00Z", "text": "Found 8 leads so far." }
  ]
}
```

**Task State Machine:**
```
backlog → ready → in_progress → review → done
            ↑          ↑           │
            │          └───────────┘  (reviewer rejects)
            │
         blocked → ready              (unblocked)
            ↓
         cancelled
```

Terminal states: `done`, `cancelled`. Key transitions: `review → in_progress` (rejection), `blocked → ready` (unblocked). The `reviewer` field on the task determines who can transition from `review → done`.

#### 3. Run (`runs/{task-id}-{attempt}.json`)

A single execution attempt against a task. Tasks can have many runs. Failed runs don't fail the task — another agent (or the same one) can create a new run.

```json
{
  "id": "FA-1-1",
  "task": "FA-1",
  "agent": "carl",
  "state": "completed",       // "running" | "completed" | "failed" | "cancelled"
  "attempt": 1,
  "started_at": "2026-03-12T10:00:00Z",
  "finished_at": "2026-03-12T10:28:00Z",
  "tokens": { "input": 4200, "output": 12800 },
  "cost_usd": 0.42,
  "result": "Found 8/20 leads. Continuing next run.",
  "artifacts": ["leads/q2-pipeline.csv"],
  "commits": []
}
```

**This is the entity we lack most.** Run records give you:
- **Cost tracking:** Budget = sum of run costs across all tasks
- **Retry history:** All attempts visible, not just final state
- **Audit:** Who did what, when, how many tokens, how much it cost
- **Performance comparison:** Compare agents by speed, cost, success rate

#### 4. Message (`messages/{id}.json`)

Agent-to-agent communication. One file per message.

```json
{
  "id": "1",
  "from": "ori",
  "to": ["carl"],                // ["*"] = broadcast
  "at": "2026-03-12T09:30:00Z",
  "type": "directive",           // directive | status | request | info | alert
  "text": "Focus on billing first. Everything else can wait.",
  "channel": "general",         // optional: topic channel
  "thread": null,               // optional: reply-to message ID
  "read_by": ["carl"]           // optional: read receipts
}
```

**Five message types:**
- `directive` — instruction from authority (like our SIGNALS HIGH items)
- `status` — progress update (like our journal entries)
- `request` — asking for something (like our delegation messages)
- `info` — informational (like our SIGNALS MEDIUM items)
- `alert` — urgent notification (like our SIGNALS HIGH items)

### Transport Layer

**Commit convention:** `<agent-id>: <action> [details]`
```
carl: done FA-1 — Stripe test mode live
ori: create FA-3 onboarding-v2
leo: assign FA-1 to carl
```

**Consistency model:** Eventual consistency bounded by max heartbeat interval. On conflict: `git pull --rebase`, re-check state, retry push (max 3 attempts).

### Heartbeat Loop

Every agent executes this cycle:
```
1. git pull --rebase
2. Read agents.json → am I active?
3. Read messages/ → anything for me? Mark read_by.
4. Read tasks/ → tasks assigned to me in "ready" state?
5. Pick highest priority ready task
6. Set state → "in_progress" → commit + push
7. Do the work
8. Record run in runs/ → commit + push
9. Set task state → "done" or "review" → commit + push
```

---

## Part 2: Structural Comparison with Our System

### Architecture Mapping

| Dimension | Our System | GNAP |
|---|---|---|
| **Agent registry** | `agents/shared/team.md` (Markdown table) | `.gnap/agents.json` (structured JSON) |
| **Task assignment** | Messages via May + `workspace/todo.md` (Markdown) | `.gnap/tasks/*.json` (structured JSON with state machine) |
| **Communication** | `agents/shared/SIGNALS.md` (append-only Markdown) | `.gnap/messages/*.json` (one file per message, typed) |
| **Execution records** | Journal entries in `workspace/journal.md` | `.gnap/runs/*.json` (structured, with cost) |
| **Agent roles** | `SOUL.md` + `DOMAIN.md` + `agent.json` | `agents.json` role/capabilities fields |
| **Knowledge base** | `agents/*/knowledge/` + `agents/shared/knowledge/` | Not in protocol (application layer) |
| **Org hierarchy** | Implicit (May orchestrates, Bob architects) | Explicit `reports_to` field |
| **Heartbeat** | Triggered by runner/cron | Self-driven via `heartbeat_sec` polling |
| **Transport** | Direct filesystem (same machine) | Git push/pull (distributed) |
| **Audit log** | Journal entries (agent-written) | Git history (automatic) |
| **Agent lifecycle** | Informal (no explicit status) | `active` / `paused` / `terminated` |
| **Cost tracking** | None | Per-run `cost_usd` + `tokens` |
| **Review workflow** | QA agent + Evaluator | `reviewer` field + `review` state |
| **Read receipts** | None | `read_by` array on messages |
| **Typed messages** | None (all unstructured text) | 5 types: directive/status/request/info/alert |
| **Subtasks** | Informal (described in task text) | `parent` field creates hierarchy |
| **Agent skills/knowledge** | `SOUL.md`, `DOMAIN.md`, `LESSONS.md`, `TOOLS.md`, `knowledge/` | Not in protocol |
| **Session management** | V2 Runner ephemeral sessions | Not in protocol |

### What We Have That GNAP Doesn't

1. **Rich agent identity:** Our `SOUL.md` + `DOMAIN.md` + `LESSONS.md` + `TOOLS.md` system gives agents deep identity, domain expertise, accumulated lessons, and tool documentation. GNAP agents are just an ID, name, role, and capability tags — no persistent personality or knowledge.

2. **Knowledge base architecture:** Our `knowledge/` directories, `learnings.md`, and shared knowledge index provide persistent, compounding intelligence. GNAP has no knowledge management.

3. **Multi-model diversity:** We intentionally assign different model families (Opus, GPT-5.2, Gemini 3 Pro, Kimi) for perspective diversity. GNAP is runtime-agnostic but doesn't address model diversity as a design principle.

4. **Sophisticated evaluation:** Our Evaluator agent + QA agent + Coach provide multi-layer quality assurance. GNAP has a simple `reviewer` field but no evaluation framework.

5. **Philosophy/architecture layer:** Bob's philosophy system (`philosophy.md`, design axioms, architectural principles) provides meta-level governance. GNAP delegates all governance to the application layer.

6. **Research capability:** Scout's deep-dive research workflow, cross-referencing, and knowledge synthesis have no GNAP equivalent.

7. **Agent training:** Coach's fork/verify/promote lifecycle for agent development has no GNAP equivalent.

8. **Stronger consistency:** Our filesystem-based communication (same machine) provides immediate consistency. GNAP's git-based transport has eventual consistency with potential merge conflicts.

### What GNAP Has That We Don't

1. **Typed messages (HIGH VALUE):** GNAP's five message types (directive/status/request/info/alert) enable agents to triage communication by urgency and type. Our SIGNALS.md uses priority labels (🔴/🟡/🟢) but not semantic types.

2. **Read receipts (HIGH VALUE):** GNAP's `read_by` array on messages lets senders verify recipients have seen their messages. We have no acknowledgment mechanism. This was specifically identified as a gap in our DPIP analysis (common ground construction requires knowing what information has been received).

3. **Run records with cost (HIGH VALUE):** GNAP tracks every execution attempt with token counts, cost, duration, and outcomes. We have no per-task cost visibility. This is critical for budget management and agent performance comparison.

4. **Formal task state machine (MEDIUM VALUE):** GNAP's `backlog → ready → in_progress → review → done` state machine with explicit transitions makes task lifecycle unambiguous. Our task tracking is informal — completion is marked with `[x]` checkboxes in Markdown.

5. **Structured data format (MEDIUM VALUE):** JSON is machine-parseable; our Markdown requires regex parsing. Agents can reliably read and write GNAP entities. Our Markdown format relies on conventions that can drift.

6. **Agent lifecycle management (MEDIUM VALUE):** `active`/`paused`/`terminated` status with `heartbeat_sec` gives explicit lifecycle control. We have no formal mechanism to pause or terminate an agent.

7. **Distributed operation (LOW VALUE for us):** GNAP works across machines via git. Our single-machine filesystem gives us stronger consistency, which is more valuable for our current setup.

8. **Organizational hierarchy (LOW VALUE for us):** GNAP's `reports_to` field creates an explicit org tree. Our hierarchy is implicit but well-understood.

---

## Part 3: Detailed Feature Analysis

### 3.1 Typed Messages — Deep Analysis

GNAP's five message types:

| Type | Semantics | Our Equivalent | Gap |
|---|---|---|---|
| `directive` | Instruction from authority | SIGNALS 🔴 HIGH items from Bob | No formal type — mixed with other content |
| `status` | Progress update | Journal entries, SIGNALS updates | Scattered across files, no unified channel |
| `request` | Asking for help/information | May's delegation messages | No way to distinguish request from directive |
| `info` | Informational, no action needed | SIGNALS 🟡 MEDIUM, 🟢 LOW | Mixed with actionable items |
| `alert` | Urgent, time-sensitive | SIGNALS 🔴 HIGH items | Same as directive — no urgency distinction |

**What this would fix:** Currently, when an agent reads SIGNALS.md, every entry looks the same (priority + text). An agent can't quickly filter "what requires my action?" vs "what's informational?" vs "what's a progress update?". Typed messages would enable:
- Agents to prioritize directives over info
- Automatic triage without parsing natural language
- Clear accountability (directives need response, info doesn't)

### 3.2 Read Receipts — Deep Analysis

GNAP's `read_by` field is an array of agent IDs appended when an agent processes a message. This is the simplest possible acknowledgment protocol:

```json
{
  "from": "ori",
  "to": ["carl", "leo"],
  "read_by": ["carl"]  // leo hasn't seen it yet
}
```

**What this would fix:** Our DPIP analysis (arXiv:2603.05450) showed that LLMs cannot reliably track "who knows what." Read receipts provide a ground-truth mechanism for common ground construction. Currently:
- Bob posts a SIGNAL to agents/shared/SIGNALS.md
- There's no way to verify which agents have read it
- If Scout posts research, there's no confirmation May or Bob processed it
- Delegation messages go into todo.md — no acknowledgment the agent received them

### 3.3 Run Records — Deep Analysis

This is the feature with the highest cost-benefit ratio for adoption. Each run captures:

```json
{
  "task": "FA-1",
  "agent": "carl",
  "attempt": 1,
  "started_at": "2026-03-12T10:00:00Z",
  "finished_at": "2026-03-12T10:28:00Z",
  "tokens": { "input": 4200, "output": 12800 },
  "cost_usd": 0.42,
  "result": "Found 8/20 leads."
}
```

**What this would enable:**
1. **Budget tracking:** Sum `cost_usd` across all runs = total spend. Currently invisible.
2. **Performance metrics:** Agent speed (duration), efficiency (tokens per task), reliability (attempts per completion).
3. **Retry visibility:** Failed runs are preserved alongside successful ones. Currently, if an agent fails, the failure is buried in journal prose.
4. **Delegation audit:** Every time May delegates to Coder → QA → Tech Lead, each step would have a run record. Currently, delegation outcomes are scattered across journals and workspace files.

### 3.4 Task State Machine — Deep Analysis

```
backlog → ready → in_progress → review → done
            ↑          ↑           │
            │          └───────────┘  (rejection)
         blocked → ready
            ↓
         cancelled
```

**Compared to our system:** We use `[ ]` (todo) and `[x]` (done) in Markdown. No intermediate states. No review gate. No blocked state. No explicit transitions.

**What a state machine would add:**
- **`review` state:** Work is complete but not accepted. Maps to our QA → Evaluator flow, but makes it protocol-level.
- **`blocked` state:** Task cannot proceed. Currently, blocks are described in natural language with no machine-readable signal.
- **Rejection flow:** `review → in_progress` sends work back for revision. Currently, QA feedback requires a new delegation cycle.
- **`cancelled` state:** Task explicitly abandoned (vs silently disappearing from todo).

### 3.5 Agent Lifecycle — Deep Analysis

GNAP's three statuses:
- `active` — agent is operational and polling
- `paused` — agent exists but should not pick up new tasks
- `terminated` — agent is permanently offline

**Relevance:** We have no formal mechanism to temporarily disable an agent. If Coder is producing bad output, the only option is to not delegate to it. A `paused` status would let May (or Bob) formally pause an agent without removing its configuration, then reactivate it after investigation.

---

## Part 4: Limitations and Risks

### GNAP Weaknesses

1. **No security model.** Relies entirely on git access controls. Any agent with push access can modify any file — including other agents' tasks, runs, and messages. No authorization boundaries.

2. **Merge conflict risk.** Under high concurrency, multiple agents modifying the same task or agents.json simultaneously will cause git conflicts. The "pull + rebase + retry" strategy handles this, but at scale it creates contention.

3. **No knowledge management.** GNAP has no concept of persistent agent knowledge, accumulated lessons, or shared understanding. This is a fundamental gap for long-running teams.

4. **No evaluation framework.** A `reviewer` field is the entire quality assurance story. No multi-evaluator systems, no adversarial verification, no evaluation reliability checking.

5. **No context management.** No concept of context windows, token budgets for reasoning, or information compression. The protocol assumes infinite context.

6. **Scale ceiling.** With one JSON file per message and one per task, a repo with 10,000 messages would have 10,000 files in `messages/`. Git handles this, but directory listings become expensive.

7. **No real-time communication.** Bounded by heartbeat interval (default 5 minutes). Not suitable for interactive collaboration.

8. **Single-repo assumption.** All agents must share a single git repository. No federation or cross-repo coordination.

### Adoption Risks for Our System

1. **Format migration cost.** Moving from Markdown to JSON for tasks/messages is a significant structural change. Risk of breaking existing agent prompts and workflows.

2. **Complexity creep.** Adding all five GNAP features simultaneously would be a large change. Incremental adoption is safer.

3. **Git dependency.** Our current filesystem approach is simpler and faster. Adding git as a requirement for inter-agent communication introduces a dependency we don't need (single-machine operation).

---

## Part 5: Adoption Recommendations

### Recommended for Adoption (High Confidence)

#### 1. Run Records (Priority: Highest)
**Implementation:** Create `agents/shared/runs/` directory. Each task delegation produces a JSON run record.
```json
{
  "id": "run-2026-03-13-001",
  "task": "deep-dive-gnap",
  "agent": "scout",
  "started_at": "2026-03-13T08:00:00Z",
  "finished_at": "2026-03-13T09:15:00Z",
  "result": "14KB deep-dive produced",
  "artifacts": ["agents/scout/workspace/deep-dive-gnap-protocol.md"]
}
```
**Why:** Highest cost-benefit ratio. Token/cost fields can be added later by the runner. Immediately provides task audit trail.

#### 2. Typed Messages (Priority: High)
**Implementation:** Add type prefix to SIGNALS.md entries: `[DIRECTIVE]`, `[STATUS]`, `[REQUEST]`, `[INFO]`, `[ALERT]`.
```markdown
### 🔴 [DIRECTIVE] — Focus on billing integration
### 🟡 [INFO] — GNAP protocol discovered, structurally similar to our system
### 🟡 [REQUEST] — Scout: need deep-dive on ClaWatch architecture
```
**Why:** Minimal format change. Agents can immediately triage by type. Backward-compatible with existing entries.

#### 3. Read Receipts (Priority: High)
**Implementation:** Add `Acknowledged by:` line to SIGNALS entries. Agents append their name when they read and process an entry.
```markdown
### 🔴 [DIRECTIVE] — Focus on billing integration
**Acknowledged by:** Scout (2026-03-13), May (2026-03-13)
```
**Why:** Directly addresses the common ground gap identified in DPIP analysis. Simple Markdown convention, no structural change.

### Consider for Adoption (Medium Confidence)

#### 4. Task State Machine (Priority: Medium)
**Implementation:** Add state labels to todo.md entries: `[READY]`, `[IN_PROGRESS]`, `[REVIEW]`, `[BLOCKED]`, `[DONE]`.
**Why:** Would formalize our informal task tracking. But the added complexity may not be worth it for our current scale (relatively few concurrent tasks per agent).

#### 5. Agent Lifecycle Status (Priority: Low)
**Implementation:** Add `status` field to `agent.json` files.
**Why:** Useful for formal pause/resume, but we rarely need this. Current informal mechanisms work at our scale.

### Not Recommended for Adoption

- **JSON format for everything** — Our Markdown is human-readable and works well for human-AI mixed teams. JSON would make SIGNALS.md harder for Bob and humans to read.
- **Git-based transport** — Our filesystem approach is faster and simpler for single-machine operation.
- **One-file-per-message** — Would fragment our communication. SIGNALS.md as a single file is more scannable.
- **Subtask `parent` field** — Our task granularity is coarse enough that subtask hierarchies add complexity without value.

---

## Part 6: Connection to Prior Research

### DPIP (arXiv:2603.05450) — Common Ground Construction
GNAP's `read_by` field is a practical implementation of the deterministic common ground tracking that DPIP recommended. The paper showed LLMs can't reliably infer "who knows what" — read receipts provide ground truth.

### OpenMOSS Patrol Pattern — Monitoring
GNAP has no monitoring capability. Our Four-Layer Patrol Model (from the observability synthesis) would be a valuable application-layer addition to GNAP: resource monitoring via run records (L1), behavioral monitoring via task state tracking (L2).

### AgenticCyOps (arXiv:2603.09134) — Security
GNAP's security model is minimal (git access = full access). AgenticCyOps P3 (Least Privilege) would recommend per-agent write restrictions (agent X can only modify its own runs and specific tasks).

### DCI (arXiv:2603.11781) — Deliberation
GNAP's typed messages could carry DCI's epistemic act types (PROPOSE, CHALLENGE, SUPPORT, SYNTHESIZE, QUERY) as an extension. This would enable structured deliberation over the protocol.

### ai-night-shift — Autonomy
GNAP's heartbeat loop is similar to ai-night-shift's coordination pattern, but more formalized. The "autonomy rules" (never ask for confirmation, if stuck 3 times move on) could be encoded as agent capabilities or task metadata.

---

## Part 7: Summary

GNAP is significant not because it's technically novel, but because it **independently validates our architecture**. When two teams converge on the same fundamental design (file-based coordination, heartbeat loops, shared repository, human-AI mixed teams), it's strong evidence the design is right.

The protocol's specific strengths — typed messages, read receipts, run records, task state machines — are concrete, well-specified features we can adopt incrementally. The three highest-priority adoptions (run records, typed messages, read receipts) require only minor additions to our existing Markdown conventions.

**Bottom line:** GNAP is a simpler, more formalized version of what we already do. We should adopt its best protocol features while preserving our richer knowledge, evaluation, and philosophy layers that GNAP lacks entirely.

---

*Scout Research — Session s_1773387934674_3*
*Total sources: GNAP README.md (full spec), ONBOARDING.md, CLAUDE.md, CONTRIBUTING.md, examples/*.json, 6 prior deep-dives referenced*
