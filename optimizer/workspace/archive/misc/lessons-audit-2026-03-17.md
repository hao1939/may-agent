# LESSONS.md Cross-Agent Audit — 2026-03-17

**Auditor**: Optimizer
**Date**: 2026-03-17 22:45 CST
**Files Reviewed**: 14 (shared + 13 agent-specific)
**Total Lines**: ~650+ across all files

---

## 1. DUPLICATE ENTRIES — Same Lesson Replicated Across Agents

These identical or near-identical lessons appear in 3+ agent LESSONS.md files. They should be consolidated into `agents/shared/LESSONS.md` and deleted from individual files.

### 1.1 Promise-Deliver-Report (C40) — DUPLICATED IN 8 AGENTS
**Found in**: optimizer, bob, may, evaluator, scout, tech-lead, coder (7 individual + shared reference)
**Evidence**: Each file contains an identical block starting with "Every heartbeat/task MUST follow this 3-step pattern" with the same Promise → Deliver → Report structure, same anti-patterns list.
**Recommendation**: 
- ✅ Graduate to `agents/shared/LESSONS.md` as a universal convention (it's already partially there in optimizer's version)
- Delete individual copies from all 7 agent files
- **Token savings**: ~200 tokens × 7 agents = ~1,400 tokens saved per context load

### 1.2 Claim-as-Record / Evidence Discipline (C26) — DUPLICATED IN 7 AGENTS
**Found in**: optimizer, bob, scout, tech-lead, amy, amy-kimi, evaluator
**Evidence**: Near-identical blocks about "Every substantive claim must cite the tool call or output that proves it" with the same anti-patterns. Minor tailoring per agent (e.g., Amy-Kimi cites "scrape_webpage" while evaluator cites "agents.list()").
**Recommendation**:
- ✅ Graduate core C26 rule to `agents/shared/LESSONS.md` (keep the universal version)
- Allow agents to keep 1-2 AGENT-SPECIFIC examples (not the full block)
- **Token savings**: ~150 tokens × 6 agents = ~900 tokens saved

### 1.3 Escalation Protocol (C23) — DUPLICATED IN 4 AGENTS
**Found in**: bob, scout, tech-lead, optimizer (in optimizer it's within the larger block)
**Evidence**: Same 4-tier escalation ladder (Self-fix → Peer consult → Supervisor report → Human escalation) with identical descriptions.
**Recommendation**:
- ✅ Already partially in optimizer's LESSONS.md. Move to `agents/shared/LESSONS.md`
- **Token savings**: ~120 tokens × 3 = ~360 tokens saved

### 1.4 Handoff Protocol (C24) — DUPLICATED IN 5 AGENTS
**Found in**: bob, tech-lead, evaluator, coder, amy
**Evidence**: Same block about "Always use agents.send() for async cross-agent work" with testable expectations. Bob's version also includes the obsolete "handoff() tool no longer exists" note.
**Recommendation**:
- ✅ Graduate to `agents/shared/LESSONS.md`
- Delete individual copies
- **Token savings**: ~100 tokens × 4 = ~400 tokens saved

### 1.5 Resource Awareness / 3-3-3 Budget (C25) — DUPLICATED IN 3 AGENTS
**Found in**: optimizer, tech-lead, amy
**Evidence**: Same "3 reads max, 3 retries max, 30% output reserve" pattern.
**Recommendation**:
- ✅ Graduate to `agents/shared/LESSONS.md`
- **Token savings**: ~150 tokens × 2 = ~300 tokens saved

### 1.6 Safe File Appending (C30) — DUPLICATED IN 2 AGENTS
**Found in**: bob, amy-kimi
**Evidence**: Same "never write() an append-only file" rule with identical anti-patterns.
**Recommendation**:
- ✅ Graduate to `agents/shared/LESSONS.md`
- **Token savings**: ~100 tokens × 1 = ~100 tokens saved

### 1.7 Progress Tracking (C22) — DUPLICATED IN 3 AGENTS
**Found in**: optimizer, evaluator, tech-lead
**Evidence**: Same multi-step progress marker pattern.
**Recommendation**:
- ✅ Graduate to `agents/shared/LESSONS.md`
- **Token savings**: ~120 tokens × 2 = ~240 tokens saved

---

## 2. STALE / OBSOLETE ENTRIES — Should Be Deleted

### 2.1 Bob's "Correct TODO Path" — GRADUATED but not cleaned
**File**: agents/may/LESSONS.md
**Issue**: Still lists `~~🔴 **Correct TODO Path**~~ → **GRADUATED**` with strikethrough but the entry occupies space. Same for "Correct SIGNALS.md Path" and "Use handoff() for Cross-Agent Work".
**Action**: Delete graduated entries from May's file (they're just taking up context space).

### 2.2 QA's LESSONS.md is EMPTY (fully graduated)
**File**: agents/qa/LESSONS.md
**Status**: "_(None — all lessons graduated to structural homes.)_" — Clean. No action needed.

### 2.3 Coach's "Growth Cycle Completion" — Marked GRADUATED but still present
**File**: agents/coach/LESSONS.md
**Issue**: Entry says "✅ GRADUATED H612" but the full text (10+ lines) is still in the file. Should be moved to Graduated section and truncated.
**Action**: Move to graduated section as one-liner.

### 2.4 Bob's "No Re-Cancellation Waste (C20)" — Likely obsolete
**File**: agents/bob/LESSONS.md (May's lessons)
**Issue**: References cancelling "14 stale sessions" from `system_status` active listings. If session management has changed (request DB replaces SIGNALS.md), this may be outdated.
**Action**: Verify if still relevant; if not, delete.

### 2.5 Tech-Lead's "The Bob-TechLead GAN" — Duplicated concept
**File**: agents/tech-lead/LESSONS.md
**Issue**: Already in tech-lead's SOUL.md as a core principle. Should be graduated.
**Action**: Graduate to tech-lead's SOUL.md if not already there; delete from LESSONS.md.

---

## 3. CONFLICTING ENTRIES — Inconsistencies Between Agents

### 3.1 Handoff mechanism inconsistency
**Bob** says "handoff() tool no longer exists" and "Write-Before-Send Sequencing" warns about batching write+handoff
**Other agents** correctly reference agents.send() only
**Tech-lead** still references old `handoff()` patterns in C24
**Resolution**: Standardize all references to agents.send() only. Remove all handoff() references.

### 3.2 Escalation protocol slight variants
**Bob**: 4-tier with "write to May's todo or use handoff"
**Scout**: 4-tier with "write to May's todo or use handoff" 
**Tech-lead**: 4-tier with `agents.send("may", ...)`
**Resolution**: Standardize on `agents.send("may", ...)` version (correct current mechanism).

---

## 4. GRADUATION CANDIDATES — Lessons That Should Move to Structure

### 4.1 C40 (Promise-Deliver-Report) → agents/shared/LESSONS.md
**Justification**: Universal across all agents, identical content, meets graduation criteria (present 2+ weeks, in 8+ agents).

### 4.2 C26 (Claim-as-Record) → agents/shared/LESSONS.md  
**Justification**: Universal, near-identical, already in optimizer's shared reference.

### 4.3 C23 (Escalation Protocol) → agents/shared/LESSONS.md
**Justification**: Universal safety rule, identical 4-tier ladder.

### 4.4 C24 (Handoff Protocol) → agents/shared/LESSONS.md
**Justification**: Universal operational rule about agents.send().

### 4.5 C25 (3-3-3 Budget) → agents/shared/LESSONS.md
**Justification**: Universal resource management rule.

### 4.6 C22 (Progress Tracking) → agents/shared/LESSONS.md
**Justification**: Universal multi-step task discipline.

---

## 5. AGENT-SPECIFIC LESSONS WORTH KEEPING

These are genuinely agent-specific and should NOT be consolidated:

| Agent | Lesson | Why Keep |
|-------|--------|----------|
| Coach | Learning Filter (Partial vs Total Failures) | Coach-specific failure classification |
| Evaluator | Scoring Protocol (Truncation Awareness) | Evaluator-specific scoring rules |
| Evaluator | Self-Reference Prevention | Evaluator-specific session ID trap |
| Scout | Context Budget (72K hard ceiling) | Scout-specific scrape limits |
| Scout | Verify Claims With Tool Calls | Scout-specific research verification |
| Tech-Lead | Three Rules (no cd, bash requires command, no agent.json in bash) | Tech-lead-specific coding rules |
| Tech-Lead | TSC Verification rules | Tech-lead-specific build verification |
| Tech-Lead | health-check.sh usage (C36-FIX) | Tech-lead-specific operational |
| Coder | P104 Calibration (false-positive refusals) | Coder-specific security work |
| Coder | Error Handling (AgentMessage.isError) | Coder-specific API knowledge |
| Amy-Kimi | Urgency-Override Resistance | Amy-Kimi-specific red team protection |
| Amy-Kimi | XHS Operations | Amy-Kimi-specific domain rules |
| Amy | Task Ledger Integrity | Amy-specific task tracking |
| Amy | ENOENT Is Data, Not Nothing | Amy-specific error recovery (C28) |
| May | Dispatch Before Health Checks | May-specific priority ordering |
| May | C44 Tool Schema Pre-Flight | May-specific (though potentially universal) |
| Bob | Idempotent Handoffs (C27) | Bob-specific duplicate prevention |
| Bob | Idempotent Self-Work (C28) | Bob-specific re-verification prevention |
| Master | Tool Availability | Master-specific constraint |

---

## 6. TOKEN SAVINGS ESTIMATE

If all recommended consolidations are performed:
- **Duplicates removed**: ~3,700 tokens saved across system prompts
- **Stale entries cleaned**: ~500 tokens saved
- **Total**: ~4,200 tokens reclaimed across all agents' context windows

This is significant — it's equivalent to freeing up a full SOUL.md worth of context for each agent that currently carries 4+ duplicate lessons.

---

## 7. RECOMMENDED ACTIONS

### Priority 1 — Consolidate to shared/LESSONS.md (HIGH IMPACT)
1. Add C40, C26, C23, C24, C25, C22, C30 to `agents/shared/LESSONS.md`
2. Delete duplicate entries from individual agent LESSONS.md files
3. Each agent keeps only agent-specific examples (1-2 lines max per convention)

### Priority 2 — Clean up stale graduated entries (MEDIUM IMPACT)
1. Delete graduated entries from May, Coach, Bob that still show full text
2. Truncate graduated sections to single-line summaries

### Priority 3 — Fix inconsistencies (LOW IMPACT but important)
1. Standardize all handoff references to agents.send()
2. Standardize escalation protocol to agents.send("may", ...) version
3. Remove all handoff() tool references

### Priority 4 — May's LESSONS.md review
May's file is the largest (180+ lines) and has the most graduated-but-not-deleted entries. It would benefit most from cleanup.

---

## 8. RESEARCH CONNECTIONS

Scout's research library provides theoretical backing for these recommendations:
- **CR#189 (Experience Infrastructure Problem)**: Four bottlenecks — our LESSONS.md duplication is a form of "experience fragmentation" (Bottleneck 2)
- **DD#316 (Structured Distillation)**: 11× token reduction via structured memory — our consolidation achieves a smaller but real version of this
- **CR#162 (Memory-Diversity Lifecycle)**: Argues for diverse memory types — LESSONS.md should be temporary staging, not permanent storage (which our graduation system intends but doesn't enforce)
- **DD#233 (AutoSkill)**: Experience-driven learning — our convention system (C-numbers) is an early form of skill codification

**Key insight from research**: The graduation lifecycle is the right architecture, but enforcement is weak. 5 of 7 duplicate conventions have been "active" for 3+ days without graduation, violating the "2 weeks" deadline. The real fix is automated graduation checking (e.g., optimizer periodic task that flags overdue entries).
