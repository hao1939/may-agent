# Memory Redesign Brief

**Author:** Optimizer | **Date:** 2026-03-17 | **Status:** Proposal  
**Requested by:** Hao (via May [req:d3fda8d3])

---

## 1. Executive Summary

The current agent memory system is a patchwork of 7 independent mechanisms that evolved organically. Despite a Phase 1 deduplication (60KB→25KB, 59% reduction) and Phase 2 automated graduation handler, the architecture has fundamental problems: lessons don't change behavior, memory.jsonl grows unbounded, checkpoints are unused, and there's no feedback loop from evaluations to memory. This brief proposes a unified 3-tier memory architecture that solves these problems.

---

## 2. Current State — The 7 Memory Mechanisms

| # | Mechanism | Location | Injected Into | Writeable By | Purpose |
|---|-----------|----------|---------------|-------------|---------|
| 1 | **LESSONS.md** (per-agent) | `agents/{name}/LESSONS.md` | System prompt (static) | Agent + Coach | Behavioral corrections |
| 2 | **shared/LESSONS.md** | `agents/shared/LESSONS.md` | System prompt (static) | Optimizer + Coach | Cross-agent conventions |
| 3 | **memory.jsonl** | `.state/memory/{name}.jsonl` | First user message (last N) | System (auto) | Session history / context |
| 4 | **Checkpoints** | `.state/checkpoints/` | First user message (latest) | Agent (tool) | Mid-session state save |
| 5 | **Active Recall (P110)** | `.state/evaluations/` → computed | First user message (if triggered) | System (auto from evals) | Failure pattern warnings |
| 6 | **knowledge/ files** | `agents/{name}/knowledge/` | System prompt (INDEX.md only) | Agent | Domain knowledge |
| 7 | **Evaluator lessons** | Parsed from eval output | *Nowhere* (dead path, line 496) | Evaluator | Unused — was supposed to feed lessons |

### Current Sizes (as of this session)

| File | Size |
|------|------|
| shared/LESSONS.md | 4,079 bytes |
| Agent LESSONS.md total (12 agents) | ~15KB total, each under 2KB ✅ |
| memory.jsonl total | 31,214 lines across all agents |
| memory.jsonl largest: may.jsonl | 3,521 lines |
| Checkpoints dir | Empty (0 files) |
| Evaluations | 13,598 files |

---

## 3. Problems Identified

### Problem 1: Lessons Don't Change Behavior (Critical)

**Evidence:** The original Hao-initiated investigation (first memory.jsonl entry) found May had 9 LESSONS about "don't guess paths / don't use `find /`" yet the behavior persisted across 4+ sessions with efficiency declining from 0.60 to 0.15. The structural fix (injecting project root into system prompt) worked; the lessons didn't.

**Root cause:** LESSONS.md is loaded as part of the system prompt — a wall of text that competes with SOUL.md, DOMAIN.md, TOOLS.md, and knowledge/INDEX.md for attention. The LLM treats it as background context, not as binding constraints. Adding more lessons = more noise, less signal.

**Data:** After deduplication, the system has:
- 7 universal conventions in shared/LESSONS.md (C22-C40)
- 2-6 agent-specific lessons per agent
- Graduation comments tracking ~40+ lessons that were moved to structural homes

The lessons that *work* are the ones that got graduated to structural locations (heartbeat.md steps, TOOLS.md rules, cron handlers). The ones that remain in LESSONS.md are, by definition, the ones that haven't been effective enough to justify structural placement — or are actively failing.

### Problem 2: memory.jsonl Grows Unbounded

**Evidence:** May's memory.jsonl has 3,521 lines. Optimizer's has 941. Only the last N entries (default 20, configurable via `memoryLimit`) are injected into sessions, meaning 3,501 of May's entries are dead weight on disk. No compaction, no archival, no cleanup.

**Impact:** Minimal on runtime (only last N loaded), but the file grows forever. More importantly, the 20-entry window is an arbitrary cutoff — it doesn't capture *important* historical context, just *recent* context. An agent that had a critical breakthrough 50 sessions ago will never see it again.

### Problem 3: Checkpoints Are Unused

**Evidence:** `.state/checkpoints/` directory is empty despite the checkpoint tool being deployed to 7 agents. No agent has ever called `checkpoint()` in production.

**Root cause:** The tool exists but no convention, lesson, or heartbeat step tells agents *when* to use it. Convention C22 says "persist progress markers" but doesn't mention the checkpoint tool specifically. The tool is infrastructure without adoption.

### Problem 4: Evaluator → Lesson Pipeline Is Broken

**Evidence:** `evaluator.ts` line 496: `// Note: result.lessons is still parsed and returned in EvaluatorResult, but we no longer write to knowledge/lessons.md (dead path — nobody loads it). Lesson management is handled by Coach's Growth Cycle via LESSONS.md.`

The evaluator produces lessons per session but they go nowhere. The Coach's Growth Cycle is supposed to pick them up, but it reads evaluation *scores*, not evaluation *lessons*. There's a gap: evaluations produce behavioral insights → they're parsed → they're discarded.

### Problem 5: Active Recall Is Narrow

**Evidence:** Active Recall (P110) only triggers for agents that have *evaluation failures* with specific failure mode codes. It injects warnings like "⚠️ RECALL: optimizer failed 3 days ago due to FM-2.6". This only covers evaluated sessions with coded failures — a small subset of all learning opportunities.

### Problem 6: No Feedback From Memory to Structure

The current flow is one-directional:
```
Evaluation → Coach → LESSONS.md → (hope the LLM reads it)
```

What's missing:
```
Evaluation → Automated pattern detection → Structural fix (heartbeat/tool/handler)
```

The lessons-graduation handler I built automates *cleanup* (removing stale/duplicate lessons) but doesn't automate *promotion* (turning proven lessons into structural changes).

---

## 4. Proposed Architecture — 3-Tier Memory

### Tier 1: Working Memory (per-session, volatile)
**What:** Session context injected into the first user message.  
**Contains:** Last N memory.jsonl entries, latest checkpoint, active recall warnings, pending tasks from request DB.  
**Lifecycle:** Rebuilt fresh each session. Nothing persists here.  
**Change from current:** No change needed — this works well.

### Tier 2: Behavioral Memory (LESSONS.md → rename to RULES.md)
**What:** Active behavioral constraints that must be followed.  
**Contains:** Only entries that have *proven* effectiveness (measured by eval improvement after adoption).  
**Lifecycle:** Max 10 entries per agent. Strict graduation: if an entry hasn't demonstrably reduced its target failure mode within 2 weeks, it gets deleted (not promoted — deleted). If it works, it gets promoted to Tier 3.  
**Key change:** Rename LESSONS.md to RULES.md to signal these are *mandatory constraints*, not *suggestions*. Reduce max entries. Add effectiveness tracking per rule.

**Format change:**
```markdown
# Rules (mandatory behavioral constraints)

## R1: Tool Argument Schema — bash takes command, read takes path
- **Target failure:** FM-2.5 (tool schema errors)
- **Added:** 2026-03-10
- **Last observed failure:** 2026-03-15 (5 days ago)
- **Effectiveness:** Reduced FM-2.5 from 8/20 sessions → 2/20 sessions
```

### Tier 3: Structural Memory (code, configs, handlers)
**What:** Proven patterns encoded in infrastructure so the agent doesn't need to *remember* them.  
**Contains:** Heartbeat steps, tool guards, cron handlers, system prompt sections, agent.json config.  
**Lifecycle:** Permanent until the pattern changes. Maintained by tech-lead/coder.  
**Key change:** Formalize the graduation pipeline from Tier 2 → Tier 3 with automation.

### The Pipeline

```
Session runs → Evaluation scores it → Active Recall flags recurrences
                                            ↓
                                    Coach adds Rule (Tier 2)
                                            ↓
                              Automated tracking: did FM-X decrease?
                                     ↓                    ↓
                                   YES                    NO
                                     ↓                    ↓
                         Graduate to Tier 3         Delete after 2 weeks
                         (structural fix)           (lesson didn't work)
```

---

## 5. Concrete Implementation Plan

### Phase 1: Memory Hygiene (immediate, low risk)

1. **memory.jsonl compaction** — Add a cron handler that:
   - Runs daily
   - For each agent, keeps last 100 entries, archives the rest to `memory/{name}-archive-{date}.jsonl`
   - Preserves entries marked as "important" (entries with `completed` items or `newItems`)
   
2. **Checkpoint adoption** — Add to each agent's heartbeat.md:
   ```
   After completing a significant step, call checkpoint() with a summary.
   ```
   But honestly, this is unlikely to change behavior (Problem 1). Better: auto-checkpoint on every `finish()` call — make it infrastructure, not behavioral.

3. **Auto-checkpoint on finish()** — In `manager.ts`, when `finish()` is called, automatically write a checkpoint from the finish data. No agent behavioral change needed.

### Phase 2: LESSONS.md → RULES.md Effectiveness Tracking (medium risk)

1. **Add effectiveness metadata** — Each rule gets:
   - Target failure mode (FM-X.Y code)
   - Date added
   - Baseline failure rate (at time of addition)
   - Current failure rate (updated by automated scan)

2. **Automated effectiveness scan** — New cron handler (`rule-effectiveness.ts`):
   - Runs daily
   - For each rule with a target FM code, counts recent eval failures matching that code
   - Compares to baseline
   - If no improvement after 14 days → marks rule for deletion
   - If significant improvement → marks rule for graduation to structural fix

3. **Rule cap** — Enforce max 10 rules per agent. If at cap, oldest ineffective rule gets deleted before a new one is added.

### Phase 3: Close the Evaluator → Memory Loop (medium risk)

1. **Evaluator lesson capture** — Instead of discarding parsed lessons, write them to a staging file: `.state/eval-lessons/{agent}.jsonl`

2. **Lesson triage handler** — New cron handler that:
   - Reads staged eval lessons
   - Groups by failure mode
   - If same FM appears 3+ times → auto-drafts a Rule for Coach to review
   - If FM already has a Rule → increments the counter (data for effectiveness tracking)

### Phase 4: Kill Dead Paths (cleanup)

1. **Remove `knowledge/lessons.md`** from evaluator write path (already dead, just remove the parser)
2. **Remove memory-sanitizer JOURNAL.md/MEMORY.md patterns** (these files don't exist — the sanitizer checks for files that were never created)
3. **Archive old memory.jsonl backup files** (optimizer-save.jsonl, various `-c4X` files are stale experiment artifacts)

---

## 6. What NOT to Do

1. **Don't add more lessons to LESSONS.md.** The evidence shows lessons don't change behavior. Every new lesson should be challenged: "Can this be a structural fix instead?"

2. **Don't build a complex knowledge graph.** The current knowledge/ directory system works fine for domain knowledge. The problem is *behavioral* memory, not *factual* memory.

3. **Don't increase memoryLimit.** More history in the context window doesn't help — agents don't meaningfully use even 20 entries. The entries need to be *better*, not *more*.

4. **Don't build a vector database.** The scale doesn't justify it (31K total entries across all agents). Simple JSONL with grep is sufficient.

---

## 7. Success Metrics

| Metric | Current | Target | How to Measure |
|--------|---------|--------|----------------|
| Lessons that demonstrably reduce target FM | Unknown (no tracking) | >50% of active rules | Automated effectiveness scan |
| Time from eval failure → structural fix | Weeks (manual Coach cycle) | <3 days (automated pipeline) | Track graduation timestamps |
| Stale lessons in LESSONS.md | ~40% (estimated) | 0% (auto-deleted after 14 days) | Graduation handler report |
| Checkpoint adoption | 0% | N/A (auto-checkpoint on finish) | Count checkpoint files |
| memory.jsonl disk usage | 31K lines, growing | Capped at 100/agent | Compaction handler metrics |

---

## 8. Priority Order

1. **Phase 1.3: Auto-checkpoint on finish()** — highest ROI, zero behavioral change needed, pure infra
2. **Phase 1.1: memory.jsonl compaction** — hygiene, prevents unbounded growth
3. **Phase 2.2: Automated effectiveness scan** — the key insight: measure whether rules work
4. **Phase 3: Evaluator → memory loop** — closes the biggest architectural gap
5. **Phase 2.1: RULES.md rename + metadata** — signaling change, moderate effort
6. **Phase 4: Dead path cleanup** — low priority, low impact

---

## 9. Open Questions for Hao

1. **Rename LESSONS.md → RULES.md?** This is a semantic change that requires updating every agent's file, the system prompt loader, the sanitizer, the graduation handler, and the evaluator. The benefit is clearer signaling. Worth the churn?

2. **Rule effectiveness threshold.** What counts as "working"? Proposal: if target FM rate drops by ≥30% within 14 days. Is that reasonable?

3. **Should checkpoint() be auto-invoked on finish(), or should we train agents to use it?** My recommendation is auto-invoke (infra > behavioral), but it removes agent agency over what to checkpoint.

4. **Evaluator lesson quality.** The evaluator-generated lessons vary in quality. Should we trust them enough to auto-stage as Rules, or require Coach review first?
