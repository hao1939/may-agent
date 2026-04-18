# Finding: Over-Intervention Audit — Per-Agent Skill Stack Analysis

**Date**: 2026-04-13
**Mode**: B (Efficiency Deep Dive)
**Motivation**: KE-123 proved combining 2+ behavioral interventions degrades performance by 12-15pp. KE-025 proved more context files hurt performance. This audit identifies agents at risk of over-intervention.

## Executive Summary

Every agent receives at least **3 behavioral intervention layers**: (1) skill files in their `skills/` directory, (2) behavioral directives in `context.md`, and (3) the identical "Operational Knowledge" block duplicated across 6 agents. The most concerning pattern is the **"verify evidence" triple-stack**: 6 agents receive the KE-093 warning in context.md AND `evidence-over-narrative.md` skill file AND `verify-after-edit.md` — three interventions all addressing the same behavior from different angles. Per KE-123, this is exactly the pattern that causes -12pp degradation.

---

## System-Wide Patterns

### Pattern 1: "Operational Knowledge" Duplication (6 agents)
An identical 3-line block appears in context.md of bob, coach, coder, optimizer, scout, tech-lead:
```
- Never stack behavioral interventions (KE-123)
- Few-shot examples harm discovery tasks (KE-133)
- Verify with evidence, not narrative (KE-093)
```
**Irony**: The very block that warns "never stack interventions" is itself part of a stack — agents receiving this block also get `evidence-over-narrative.md` skill files, creating the exact pattern it warns against.

### Pattern 2: Evidence/Verification Overlap
The "trust evidence over narrative" behavior is addressed by **up to 4 separate interventions** on some agents:
1. `verify-after-edit.md` skill (9 agents)
2. `evidence-over-narrative.md` skill (5 agents: bob, coach, optimizer, scout, tech-lead)
3. `verify-context-claims.md` skill (1 agent: bob)
4. KE-093 line in "Operational Knowledge" block (6 agents)

For Bob specifically, that's **4 overlapping interventions** addressing the same core behavior: "verify with evidence."

### Pattern 3: Context.md Bloat
| Agent | context.md items | Skill files | Total interventions |
|-------|-----------------|-------------|-------------------|
| **may** | **40** | 4 | **44** |
| bob | 26 | 7 | 33 |
| tech-lead | 28 | 4 | 32 |
| scout | 24 | 5 | 29 |
| coach | 20 | 5 | 25 |
| optimizer | 18 | 4 | 22 |
| qa | 14 | 3 | 17 |
| evaluator | 11 | 6 | 17 |
| coder | 8 | 3 | 11 |

May has **44 total intervention points** — nearly 4x the minimum (coder at 11). Per KE-025 (instruction overhead paradox), every additional instruction creates attention dilution and potential failure modes.

---

## Per-Agent Analysis

### 🔴 Bob — RED ZONE (7 skills, 26 context items = 33 total)

**Skills deployed:**
1. `read-before-edit.md` — tool-choice habit
2. `verify-after-edit.md` — tool-choice habit
3. `evidence-over-narrative.md` — behavioral (9.9KB!)
4. `cross-reference-source-code.md` — task-specific method
5. `knowledge-base-navigation.md` — task-specific method
6. `verify-context-claims.md` — behavioral (verification)
7. `tool-interface-protocol/` — tool-choice habit (don't use bash for checkpoint/finish)

**Overlapping pairs:**
- `evidence-over-narrative` ↔ `verify-context-claims` ↔ KE-093 context line: All three say "verify claims with tool output before trusting them." Triple-stack on the same behavior.
- `verify-after-edit` ↔ `evidence-over-narrative`: Both require running verification after changes. Overlap on "check your work with tools."
- `knowledge-base-navigation` ↔ context.md line "Knowledge base paths are nested 3-4 levels deep: always ls the parent directory": Both instruct the same "ls before reading" pattern.

**Red zone reason:** 4 overlapping verification interventions + `knowledge-base-navigation.md` backup file (5.5KB dead weight) + 26 context.md items. Most at-risk agent for KE-123 iatrogenic effects.

**Recommendation:** Remove `verify-context-claims.md` (subsumed by `evidence-over-narrative`). Remove `knowledge-base-navigation.md.backup-exp095` (dead file). Consider removing the KE-093 "Operational Knowledge" line since `evidence-over-narrative.md` is already deployed.

---

### 🟡 Coach — CAUTION (5 skills, 20 context items = 25 total)

**Skills deployed:**
1. `verify-after-edit.md` — tool-choice habit
2. `evidence-over-narrative.md` — behavioral (verification)
3. `consolidate-memory.md` — task-specific method (memory consolidation)
4. `log-error.md` — formatting standard (JSONL error logging)
5. `red-team/` — task-specific procedure (security exercises)

**Overlapping pairs:**
- `evidence-over-narrative` ↔ KE-093 context line: Same behavior addressed twice.

**Assessment:** Mostly clean. `consolidate-memory.md` and `red-team/` are role-specific procedures, not behavioral interventions — they describe WHAT to do, not HOW to behave. `log-error.md` is a formatting standard. The only true overlap is the evidence verification double-coverage.

**Recommendation:** Remove KE-093 line from "Operational Knowledge" if `evidence-over-narrative.md` is retained. `consolidate-memory.md` may be internalized — test by removing and checking if behavior holds (KE-122 lifecycle).

---

### 🟡 May — CAUTION (4 skills, 40 context items = 44 total, but different profile)

**Skills deployed:**
1. `read-before-edit.md` — tool-choice habit
2. `verify-after-edit.md` — tool-choice habit
3. `verify-before-finish.md` — tool-choice habit (C1.7)
4. `blocked-capability-escalation/` — decision procedure

**Overlapping pairs:**
- `verify-after-edit` ↔ `verify-before-finish`: Both are about verifying work. `verify-after-edit` = "read back after write/edit." `verify-before-finish` = "must have a verification tool call in last 5 before finish()." These are related but address different timing (immediate vs. final). **Low overlap — both should stay.**
- `read-before-edit` ↔ `verify-after-edit`: Complementary — before vs. after. Not overlapping.

**Red zone reason:** 40 context.md items is the highest across all agents. This is the biggest KE-025 risk — not from skills (which are lean) but from context.md instruction debt. Many items are environmental facts (acceptable) but the behavioral items stack up.

**Recommendation:** Audit context.md for items that can be removed (redundant, internalized, or no longer relevant). May does NOT have `evidence-over-narrative.md` or the "Operational Knowledge" block — her lower skill count may partially offset the context bloat.

---

### 🟡 Scout — CAUTION (5 skills, 24 context items = 29 total)

**Skills deployed:**
1. `read-before-edit.md` — tool-choice habit
2. `verify-after-edit.md` — tool-choice habit
3. `evidence-over-narrative.md` — behavioral (verification)
4. `materialize-findings-concise.md` — task-specific work pattern
5. `search-governance.md` — task-specific search method

**Overlapping pairs:**
- `evidence-over-narrative` ↔ KE-093 context line: Same behavior, two channels.
- `materialize-findings-concise` ↔ context.md "INVESTIGATION WORK PATTERN" in coder: Scout has this as a skill, coder has a similar pattern in context.md. Cross-agent inconsistency, but not an overlap within scout.

**Assessment:** Role-specific skills (`search-governance`, `materialize-findings-concise`) are well-suited — scout is a researcher who searches and writes findings. The verification double-stack is the only concern.

**Recommendation:** Remove KE-093 Operational Knowledge line (already has `evidence-over-narrative.md`). Evaluate `search-governance.md` for internalization (active since Mar 16 — is it still needed?).

---

### 🟢 Tech-Lead — OK (4 skills, 28 context items = 32 total)

**Skills deployed:**
1. `read-before-edit.md` — tool-choice habit
2. `verify-after-edit.md` — tool-choice habit
3. `evidence-over-narrative.md` — behavioral (verification)
4. `experience-replay.md` — task-specific method (check errors before work)

**Overlapping pairs:**
- `evidence-over-narrative` ↔ KE-093 context line + KE-093 explicit line: Triple-stack. Tech-lead has both the "Operational Knowledge" block AND a separate `**KE-093**: Evidence-over-narrative` line in context.md.

**Assessment:** Skills themselves are clean and role-appropriate. `experience-replay.md` is unique and task-relevant. The triple-stacking of KE-093 is the concern.

**Recommendation:** Remove the explicit KE-093 context.md line (already covered by skill + Operational Knowledge). Consider removing the Operational Knowledge KE-093 line too since the full skill file is deployed.

---

### 🟢 QA — OK (3 skills, 14 context items = 17 total)

**Skills deployed:**
1. `read-before-edit.md` — tool-choice habit
2. `verify-after-edit.md` — tool-choice habit
3. `generate-test-case.md` — role-specific method

**Overlapping pairs:** None. QA does NOT have `evidence-over-narrative.md` or the "Operational Knowledge" block. Clean stack.

**Assessment:** Minimal and appropriate. Only concern: `read-before-edit` has 61.4% compliance despite deployment — the skill isn't working (confirms prior finding that deployment ≠ adoption).

**Recommendation:** No removals needed. Address the `read-before-edit` compliance gap through a different mechanism (convention check enforcement rather than more text).

---

### 🟢 Evaluator — OK (6 skills but mostly code, 11 context items = 17 total)

**Skills deployed:**
1. `monitor-session.cjs` + `monitor-session.md` — code-enforced session monitoring
2. `score.md` — scoring rubric
3. `patrol.cjs` + `patrol.md` — code-enforced patrol
4. `detect-drift.cjs` + `detect-drift/` — code-enforced drift detection
5. `delegation-metrics.cjs` + `delegation-metrics.md` — code-enforced metrics
6. Various others: `challenge-agent.cjs`, `manage-backups.cjs/md`, etc.

**Assessment:** Evaluator's "skills" are mostly **code tools**, not behavioral interventions. They define WHAT evaluator does (monitor sessions, detect drift, score agents), not HOW to behave. This is Channel 1 enforcement (code), not Channel 3 (behavioral text injection). These don't carry KE-123 over-intervention risk.

**Recommendation:** No changes needed. Evaluator has the cleanest behavioral intervention profile — almost all interventions are structural/code-based.

---

### 🟢 Coder — OK (3 skills, 8 context items = 11 total)

**Skills deployed:**
1. `verify-after-edit.md` — tool-choice habit
2. `efficient-file-reading.md` — tool-choice habit (gym-proven 6/8→8/8)
3. `structured-plan-writing.md` — planning quality (gym-proven 7/8→8/8)

**Overlapping pairs:** None. Both gym-proven skills are distinct (one about reading, one about planning). No verification triple-stack since coder lacks `evidence-over-narrative.md`.

**Assessment:** The leanest behavioral stack. Both unique skills are gym-proven. This is the model to emulate.

**Recommendation:** No changes. Coder demonstrates that a lean, targeted, gym-proven skill set works.

---

### 🟢 Optimizer — OK (4 skills, 18 context items = 22 total)

**Skills deployed:**
1. `verify-after-edit.md` — tool-choice habit
2. `evidence-over-narrative.md` — behavioral (verification)
3. `deliverable-checklist.md` — code-enforced workflow (convention check blocks finish without it)
4. `batch-processing.md` — task-specific method

**Overlapping pairs:**
- `evidence-over-narrative` ↔ KE-093 context line: Same behavior, two channels.
- `batch-processing.md` is generic and low-value — no gym evidence, no specific trigger conditions.

**Assessment:** `deliverable-checklist.md` is the gold standard — it's enforced by convention checks, not just text. `batch-processing.md` is the weakest skill — vague, untested, and generic.

**Recommendation:** Remove `batch-processing.md` (no evidence of value, generic content that doesn't change behavior). Remove KE-093 context line since `evidence-over-narrative.md` is deployed.

---

## Priority Actions (Ranked)

### P0: Remove Verification Triple-Stacks
For agents with both `evidence-over-narrative.md` AND the KE-093 "Operational Knowledge" line (bob, coach, optimizer, scout, tech-lead): remove the KE-093 line from context.md. The 9.9KB skill file already covers this behavior comprehensively. Having both is the exact stacking pattern KE-123 warns against.

**Affected agents:** bob, coach, optimizer, scout, tech-lead (5 agents)
**Tokens saved:** ~50 tokens × 5 agents × every session = ~250 tokens/session system-wide

### P1: Remove Bob's Redundant Skills
- Delete `verify-context-claims.md` — fully subsumed by `evidence-over-narrative.md`
- Delete `knowledge-base-navigation.md.backup-exp095` — dead backup file (5.5KB of waste)

**Tokens saved:** ~2,700 tokens per Bob session

### P2: Remove Generic/Untested Skills
- Delete optimizer's `batch-processing.md` — generic, no gym evidence, no triggers
- Evaluate scout's `search-governance.md` for internalization (active 28+ days)
- Evaluate coach's `consolidate-memory.md` for internalization (active 29+ days)

### P3: Audit May's context.md
May has 40 context.md items — highest across all agents. A targeted audit should identify items that are:
- Redundant (covered by skills or other items)
- Internalized (behavior holds without the item)
- Environmental facts that could be moved to a smaller ENV section

---

## Overlap Matrix

| Behavior | verify-after-edit | evidence-over-narrative | verify-context-claims | KE-093 context | read-before-edit |
|----------|:-:|:-:|:-:|:-:|:-:|
| "Read back after editing" | ✓ | partial | — | — | — |
| "Trust tool output over claims" | — | ✓ | ✓ | ✓ | — |
| "Verify before trusting context" | — | ✓ | ✓ | partial | — |
| "Read before modifying" | — | — | — | — | ✓ |

**Red cells (≥2 skills covering same behavior):** evidence-over-narrative + verify-context-claims + KE-093 all cover "trust tool output over claims." This is the primary triple-stack.

---

## Data Sources
- Agent `skills/` directories (inventory above)
- Agent `context.md` files (behavioral item counts)
- Agent `SOUL.md` files (skill references)
- KE-123: Over-intervention iatrogenesis evidence
- KE-122: Intervention decay/internalization lifecycle
- KE-025: Instruction overhead paradox
- Prior audit: `finding-skills-adoption-audit-0412.md`
