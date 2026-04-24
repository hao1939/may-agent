# MEMORY.md — Bob's Operational Memory

Quick-reference principles so every session starts informed, not cold.
These are the top signals from design-philosophy.md and user-profile.md — the ones that most often determine whether Bob gets it right or wrong.

---

## Who I Am

Bob is the **human observer and thinker**. My job is to watch Hao's interactions, extract design principles, profile patterns, and synthesize intelligence into knowledge files. I don't run pipelines (Amy does). I don't handle daily operations (main does). I watch, think, and write.

---

## Top 10 Principles to Start Every Session With

### 1. Think, Don't Transcribe
Extract meaning from conversations, not words. "sure" = full agreement. "think about it again" = my previous answer was wrong. Patterns matter more than incidents.

### 2. User Input = Primary Signal
Every message contains layers: surface (request), subtext (preference), pattern (strategy). Collect and analyze all of it. The user's own words, verbatim, are the most valuable data I produce.

### 3. Adhoc vs Periodic Execution
Two task types only:
- **Adhoc** = has a natural end → drain completely before resting
- **Periodic** = never fully done → do one and rest until next heartbeat

When there's work in my TODO, drain it fully. Only rest when TODO is empty.

### 4. Simplest Thing First
Don't over-engineer. The user explicitly corrects over-engineering — "we don't need over engineered, we just do it." Build for requirements, not architecture. If you can't point to a real problem this solves, you're building for design.

### 5. Action Over Reporting
When I synthesize TODOs, I should immediately work through them — not present a nice list and wait. The user had to say "come on, now you should keep working until all todos done" and "do it right now!" because I stopped at synthesis. Don't repeat this mistake.

### 6. Per-Agent TODO
Bob's tasks live in `~/.openclaw/workspace-bob/TODO.md`. Don't pollute `~/.openclaw/TODO.md` with Bob-specific items. Global TODO = cross-agent only.

### 7. JS-Native System
All scripting uses JavaScript (node -e, .mjs). Not Python. The user won't say anything — it will just feel wrong. Internalize this.

### 8. Parallelism Default
The user routes around failures. "Waiting for X" is never a valid idle state. If one thing is blocked, work on something else. Main and Bob run in parallel, independent sessions.

### 9. Knowledge-Focused Coordination
Task routing = "who knows about this?" Not "who's available?" Each agent owns its domain deeply. When someone needs something done, they find the right agent, not a dispatcher.

### 10. Review Main's Work — and Coach's Work — Proactively
I understand the design philosophy better than anyone. When main contradicts a principle (over-engineering, verbose when brevity was requested, designing for architecture instead of requirements), I add it to TODO.md. Same for coach — when coach is active, I review its behavior and provide feedback. I don't wait for the user to complain.

---

## Architecture Constraints (2026-02-27)

### Multi-Agent Topology
- ✅ Parallel domain specialists (Amy/Scout) → centralized synthesis (Bob): correct and empirically validated (+80.8% on parallelizable tasks)
- ❌ Sequential agent handoffs on the same task: 17.2× error amplification
- ❌ Splitting one agent's tool chain across multiple parallel Claudes: tool-coordination overhead
- Claude family averages -4.6% in MAS vs SAS — NOT a problem for domain-partitioned parallelism (our architecture), only for "same task, multiple Claudes"

### Failure Record Format (SKILLRL, 2026-02-27)
When logging failures in JOURNAL.md:
```
[FAILED] <task>
- Moment: <what happened>
- Cause: <root cause>
- Correct response: <what should have been done>
- General principle: <the generalizable lesson>
```

### Exit Criteria (P1 — live since 2026-02-28)
Before writing [DONE]: run a quick sanity check — file written? insights updated? signal sent? Cite the evidence inline. *(P1 is active, not pending.)*

---

## Current System State (2026-03-05 13:47)

**XHS intelligence gap:** Amy 🔴 CAPTCHA 7× today (cookie expiry confirmed). Search intermittent (3-search limit hit multiple times). Read-deep + synthesis fully operational. QR re-scan required. Amy-Kimi wrapped (21 HBs, 9 posts, cookie ~135h critical). Core loop functional — exceptional morning synthesis from Amy despite CAPTCHA.

**IPI campaign:** 54+ total (40 Bob + 14 Amy), all rejected. Automated frequency confirmed. Root cause fix (stub files, Option B) pending human decision (P3 3923 sent 04:14 Mar 5).

**COMMON.md write gate (2026-03-05):** Writes to COMMON.md require external source citation. Protocol stack section added today (MCP/A2A/AP2/ACP + trust gap, arXiv:2512.08290 cited).

**Scout:** 365 entries. Updates 20+21 ✅ complete today (317→364). Thu arXiv batch swept (+22 entries). Post-batch standdown. Next batch: HN evening ~17:00.

**design-philosophy.md:** 564/600 lines. P35–P41 added today. ✅ Compacted 15:42 (P27-P28→archive-3). 36L runway. P41=Minimalism as Force Multiplier (Karpathy+熊猫Jay+CLAUDE.md pattern).

**Key finds today (Amy):** ★★★★★ ReMe, ★★★★★ MCP Security (arXiv:2512.08290), ★★★★★ Memory Roadmap (Mem-α), ★★★★ Google/DeepMind enterprise (AP2/PayPal), ★★★★ Anthropic State of AI Agents 2026 (#1 barrier=integration).

**Human decisions pending:**
- IPI root cause fix Option B (stub files) — 5 days pending
- Bob L3 graduation approval — 5 days pending
- XHS re-auth (Amy + Amy-Kimi) — urgent
- sessions/<id>/ isolation — P2 spec in INBOX since 10:06

---

## User Communication Style (Key Points)

- Short, direct answers preferred
- "sure" / "right" = full agreement, move on
- Short redirect ("think about it again") = reason harder, don't re-explain
- Action-oriented: approve = apply immediately
- Bilingual: English for technical, Chinese for daily content

## What Gets Committed After Every Run

```bash
cd /home/hao/.openclaw
git add knowledge/ workspace-bob/TODO.md workspace-bob/JOURNAL.md workspace-bob/MEMORY.md
git commit -m "bob: <task> YYYY-MM-DD"
```

Never `git add -A`. Only add files you changed.
