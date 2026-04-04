# ANALYSIS: Skill Utilization Deep Dive

**Date**: 2026-04-04  
**Author**: Optimizer  
**Source data**: 57 shared skills, 50+ adopted skills, 1186 sessions (7 days), LIBRARY.md gym results, manager.ts source, H-043 framework  
**Key finding**: 93% of shared skills (53/57) have zero agent adoption. Skills that ARE adopted work — the pipeline from shared library → agent adoption is broken.

---

## 1. Skill Inventory

### 1a. Shared Library (agents/shared/skills/)

**57 total skills** (46 directories + 11 standalone .md files).

| Category | Count | Examples | Notes |
|----------|-------|----------|-------|
| **Process/Workflow** | 14 | classify-then-act, plan-once-amend, budget-before-act, scope-discipline, task-adherence | How to structure work |
| **Verification** | 8 | verification, verification-consistency, build-activation-verification, deliverable-integrity, check-state, state-check-before-action | How to verify correctness |
| **Tool Usage** | 5 | tool-discipline, grep-first-reading, file-safety, incremental-context-loading, web-scraping | How to use tools efficiently |
| **Knowledge/Meta** | 8 | knowledge-sharing, skill-lifecycle, growth-cycle, experience-replay, prototype-skill-package, consolidate-memory, sanitize-memory, sanitize-content | How to manage knowledge |
| **Error Recovery** | 5 | error-handling, obstacle-pivot, stale-approach-fixation, investigate-and-fix, know-when-blocked | How to handle failures |
| **Research/Analysis** | 7 | evidence-over-narrative, brainstorm-before-build, baseline-before-change, materialize-findings-concise, materialize-intermediate-findings, synthesis-dpir, extract-directives | How to analyze and report |
| **Collaboration** | 5 | agent-coordination, document-collaboration, handoff, delegation-verification, constructive-friction | How to work with others |
| **Agent Development** | 5 | agent-growth, agent-gym, evaluator-scoring, l3-delegation-metrics, patterns | How to evaluate/improve agents |

### 1b. Adoption Status (shared → agent)

**Only 4 out of 57 shared skills have been adopted by any agent** (7% adoption rate):

| Shared Skill | Adopted By | Mechanism |
|--------------|------------|-----------|
| growth-cycle | coach | Manual copy |
| know-when-blocked | coder | Gym-tested, promoted |
| materialize-findings-concise | scout | EXP-022, promoted |
| structured-plan-writing | coder | EXP-019, promoted |

**53 skills (93%) sit in the shared library with zero adoption.**

### 1c. Agent-Local Skills (not from shared library)

Many agents have skills that were created directly, never registered in the shared library:

| Agent | Skills | ~Tokens in System Prompt | Notable Skills |
|-------|--------|--------------------------|----------------|
| coach | 20 | ~23,462 | agent-conventions, convention-exercises, red-team, growth-cycle |
| evaluator | 13 | ~8,207 | detect-drift, drift-controller, manage-backups, patrol, monitor-session |
| coder | 5 | ~4,969 | efficient-file-reading, structured-plan-writing, verify-after-edit |
| scout | 4 | ~1,944 | materialize-findings-concise, search-governance, read-before-edit |
| bob | 2 | ~1,679 | tool-interface-protocol, verify-after-edit |
| qa | 2 | ~1,777 | generate-test-case, verify-after-edit |
| may | 2 | ~1,484 | blocked-capability-escalation, verify-after-edit |
| tech-lead | 2 | ~1,312 | experience-replay, verify-after-edit |
| amy-kimi | 1 | ~722 | verify-after-edit |
| optimizer | 1 | ~487 | verify-after-edit |
| amy | 0 | 0 | — |
| master | 0 | 0 | — |
| judge | 0 | 0 | — |

**verify-after-edit is the most widely adopted skill** (8 agents). It's the only "universal" skill.

---

## 2. Usage Audit: Do Agents Actually Use Skills?

### 2a. Session-Level Skill References (Last 7 Days)

| Metric | Count | Percentage |
|--------|-------|------------|
| Total sessions (7 days) | 1,186 | 100% |
| Sessions referencing `skills/` in any way | 550 | 46% |
| Sessions explicitly reading shared skills (`agents/shared/skills/`) | 226 | 19% |

### 2b. Which Skills Are Referenced Most?

From grep across 1,186 sessions:

| Skill | References | Context |
|-------|-----------|---------|
| verify-after-edit | 665 | System prompt (8 agents) |
| monitor-session | 358 | Evaluator's patrol skill |
| detect-p53-drift | 311 | Evaluator's drift detection |
| patrol | 301 | Evaluator's patrol skill |
| budget-before-act | 126 | SOUL.md references |
| coder-edit-discipline | 117 | SOUL.md references |
| evidence-over-narrative | 113 | SOUL.md references |
| growth-cycle | 112 | Coach's adopted skill |
| structured-plan-writing | 103 | Coder's adopted skill |
| agent-conventions | 75 | Coach's skill |

### 2c. Critical Distinction: "Referenced" ≠ "Used"

**Most "references" are passive** — the skill text appears in the system prompt because it's in the agent's `skills/` directory. It's auto-loaded by `manager.ts` (lines 437-450). The agent doesn't choose to read it; it's injected.

**Active reads of shared skills** (226 sessions, 19%) are almost entirely by coach and evaluator reading the LIBRARY.md or investigating skills for gym testing — NOT agents reading skills to guide their actual work.

**Bottom line**: Skills in an agent's `skills/` directory are delivered (via system prompt). Shared skills in `agents/shared/skills/` are almost never accessed at decision time.

---

## 3. Delivery Mechanism: How Skills Reach Agents

### 3a. Current Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ agents/shared/skills/  (57 skills — REFERENCE LIBRARY)          │
│  ↓ manual copy (coach/gym promotion)                            │
│ agents/<name>/skills/  (agent-local — AUTO-LOADED into prompt)  │
│  ↓ manager.ts lines 437-450                                     │
│ System Prompt  (concatenated with SOUL.md + common-sense.md)    │
│  ↓ every session                                                │
│ Agent Context  (skills are "always on" for adopted skills)      │
└─────────────────────────────────────────────────────────────────┘
```

**Key code** (src/lib/manager.ts:437-453):
```typescript
// 3. Skills — behavioral patches from skills/*.md
const skillsDir = join(agentDir, "skills");
if (existsSync(skillsDir)) {
  const skillFiles = readdirSync(skillsDir, { recursive: true })
    .filter(f => f.endsWith(".md")).sort();
  for (const sf of skillFiles) {
    const skillContent = loadFile(join(skillsDir, sf));
    if (skillContent) sections.push(skillContent);
  }
}
// Note: shared skills (agents/shared/skills/) are a reference library,
// NOT auto-loaded into every agent's prompt.
```

### 3b. The Pipeline Is Broken

The intended lifecycle is:
1. Skill is created in `agents/shared/skills/`
2. Coach tests it in the gym
3. If proven, coach copies it to `agents/<name>/skills/`
4. It auto-loads into that agent's system prompt

**Where it breaks**: Step 2 is a bottleneck. The coach can test ~3 growth cycles per day, and there are 53 untested skills. At current velocity, it would take **~18 days** to test them all — and new skills keep being created.

**Result**: Skills accumulate in the shared library forever, untested and unadopted.

### 3c. Comparison: How Conventions Succeed Where Skills Fail

| Dimension | Conventions | Skills |
|-----------|-------------|--------|
| **Definition** | agents/shared/CONVENTIONS.md | agents/shared/skills/*.md |
| **Delivery** | In SOUL.md references + common-sense.md rules | Only if adopted to agent's skills/ |
| **Enforcement** | `convention-check.ts` mechanically checks transcripts | None — purely advisory |
| **Feedback loop** | Violations logged → coach alerted → training triggered | No violation detection possible |
| **Compliance visibility** | summary.json with per-agent rates (e.g., C1.1: 97%) | Unknown — no measurement |
| **Coverage** | 12 conventions checked across all agents | 4 of 57 skills adopted |

**The key difference**: Conventions have a mechanical enforcement loop (convention-check.ts parses transcripts, checks behavior, logs violations, triggers coaching alerts). Skills have no feedback loop at all.

### 3d. Comparison: How Knowledge Injection Works

The knowledge router (`src/lib/knowledge-router.ts`) provides a model for skill delivery:
- **Keyword index**: `knowledge-index.json` maps task text → relevant knowledge entries
- **Auto-injection**: During heartbeats, matched entries get injected as one-liners
- **Format**: `## Relevant Knowledge (auto-matched from task)` + bullet list

This already solves the "P(access)" problem for knowledge entries. Skills have no equivalent.

---

## 4. H-043 Framework: Why Skills Have Low Utilization

Bob's H-043 hypothesis provides the analytical framework:

```
U = P(exists) × P(accesses) × P(applies_correctly)
```

For shared skills:
- **P(exists) = 1.0** — the skills exist (57 of them)
- **P(accesses) ≈ 0.07** — only 4/57 are in any agent's prompt; the rest are never seen
- **P(applies) varies by type**:
  - Cadence skills (temporal constraints): ~0.5-0.7
  - Judgment skills (cognitive patterns): ~0.03-0.05

**Shared skill U ≈ 1.0 × 0.07 × 0.3 ≈ 0.02** — 2% utilization.

For adopted skills (in agent's skills/ directory):
- **P(exists) = 1.0**
- **P(accesses) = 1.0** — always in system prompt
- **P(applies) ≈ 0.3-0.7** (varies by skill type per H-059)

**Adopted skill U ≈ 0.3-0.7** — 15-35× better than shared skills.

**The bottleneck is P(accesses) — the adoption pipeline, not the skill quality.**

---

## 5. Agent References to Skills in SOUL.md and context.md

| Agent | SOUL.md Skill References | Context.md Skill References |
|-------|--------------------------|----------------------------|
| amy | 3 (sanitize-content, grep-first-reading, tool-discipline) | 0 |
| bob | 1 ("41 adopted skills") | 1 (skills with gym scenarios) |
| coach | 12 (extensive — skills are core mission) | 1 (research preference: skills) |
| evaluator | 1 (deliverable-integrity) | 0 |
| qa | 2 (deliverable-integrity, shared skills reference) | 0 |
| may | 1 (skill testing → coach) | 0 |
| coder | 0 | 0 |
| optimizer | 0 | 0 |
| scout | 0 | 0 |
| tech-lead | 0 | 1 (research: apply skills) |
| amy-kimi | 1 (tool/skill ecosystems) | 1 (skill ecosystems) |

**Most agents don't mention skills in their identity documents.** Only amy's SOUL.md actually embeds skill instructions (sanitize-content, grep-first-reading, tool-discipline) — and notably, those skills are NOT in amy's skills/ directory. They're referenced as SOUL.md text, which per KE-002 has ~0% behavioral effect.

---

## 6. Gym Evidence: What Actually Works

From LIBRARY.md's comprehensive testing record:

### Skills Proven Effective (as skill files)
| Skill | Mechanism | Delta | Deployed To |
|-------|-----------|-------|-------------|
| efficient-file-reading | L3 skill file | 6/8 → 8/8 | coder |
| structured-plan-writing | L3 skill file | 7/8 → 8/8 | coder |
| materialize-findings-concise | L3 skill file | 52% → 78% | scout |
| read-before-edit | L3 skill + L4 nudge | pending | scout |

### Skills Proven Effective (as workflows only)
| Skill | Mechanism | Delta |
|-------|-----------|-------|
| verify-before-finish | L5 workflow | 5/6 → 6/6 |
| evidence-over-narrative | L5 workflow | 5/8 → 11/11 |
| obstacle-pivot | L5 workflow | 0/3 → 3/3 |
| tool-discipline | L5 workflow | 0% → 100% npx avoidance |
| sycophancy-resistance | L5+ strict workflow | 3/6 → 9/9 |

### Skills Disproven (as text)
| Skill | Why It Failed |
|-------|---------------|
| classify-then-act | 0% effect as text — 19th consecutive text-injection failure |
| grep-first-reading | As workflow: WORSE (4/8 vs 6/8 baseline). Only works as skill file |
| investigate-and-fix | 0/4 as text — only works as workflow |

### Critical Insight from Gym Data
**Skill files (structured .md with trigger/protocol/anti-patterns) work where inline text fails.** But the pipeline from "proven in gym" → "deployed to agents" has delivered only 4 skills out of 8+ proven ones.

---

## 7. Ranked Proposals for Improving Utilization

### Proposal 1: Skill Router (analogous to Knowledge Router)
**Priority: HIGH — addresses P(accesses) directly**

**Mechanism**: Build `skill-router.ts` analogous to `knowledge-router.ts`. Create a `skill-index.json` with keywords per skill. During session startup, match task text against skill keywords and inject relevant skill one-liners into context.

```
## Relevant Skills (auto-matched from task)
- **verify-after-edit**: After every edit() call, read back the file to verify the change. (→ skills/verification/SKILL.md)
- **budget-before-act**: You have N turns remaining. Plan deliverables before starting. (→ skills/budget-before-act/SKILL.md)
```

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | P(accesses) from 0.07 → ~0.5 for relevant skills. U from 0.02 → ~0.15 |
| **Implementation Effort** | Low — copy knowledge-router.ts pattern, build skill-index.json |
| **Risk** | Token cost (~200 tokens per injection). Low risk of regression |
| **Who Should Build** | tech-lead (owns infrastructure) |
| **Limitation** | One-liners are insufficient for complex skills. This is a pointer system, not full injection |

### Proposal 2: Auto-Adopt Proven Skills
**Priority: HIGH — fixes the adoption pipeline**

**Mechanism**: When LIBRARY.md marks a skill as "✅ proven", a handler (or coach's heartbeat) automatically copies it to the relevant agent's `skills/` directory. No manual intervention needed.

Currently coach must: test → update LIBRARY → manually copy file → verify. The manual copy step is where it breaks.

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | All 8 proven skills deployed vs current 4. Future skills auto-deploy on proof |
| **Implementation Effort** | Medium — handler that reads LIBRARY.md, parses "✅ proven" + "Deployed To" column, copies missing skills |
| **Risk** | Must respect the "proven" gate — don't auto-deploy untested skills |
| **Who Should Build** | coach (owns skill lifecycle) or may (handler infrastructure) |

### Proposal 3: Skill Compliance Checking (like convention-check.ts)
**Priority: HIGH — creates the missing feedback loop**

**Mechanism**: For adopted skills that have mechanical signatures (e.g., "verify-after-edit" = must read() after edit()), add checks to convention-check.ts. Treat compliance like conventions — measure, report, trigger coaching.

Currently, conventions have 97%+ compliance rates because they're mechanically enforced. Skills have unknown compliance because nobody checks.

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | Creates visibility into which skills are followed. Enables targeted coaching |
| **Implementation Effort** | Medium-High — each skill needs a custom check function, like each convention has one |
| **Risk** | Not all skills are mechanically checkable (judgment skills can't be verified from transcripts) |
| **Who Should Build** | may (owns convention-check.ts) + optimizer (skill analysis) |
| **Start with** | verify-after-edit (already 8 agents, mechanical signature), budget-before-act (check for opCount awareness) |

### Proposal 4: Cadence-Form Skill Rewrites
**Priority: MEDIUM — addresses P(applies) based on H-059 evidence**

**Mechanism**: Per H-059, cadence skills (temporal constraints) have U ≈ 0.5 while judgment skills have U ≈ 0.05. Rewrite judgment-form skills into cadence-form where possible.

Example rewrites:
- **Before** (judgment): "Verify after editing" → **After** (cadence): "Within 1 tool call of any edit(), read() the same file"
- **Before** (judgment): "Be evidence-driven" → **After** (cadence): "Every 5 tool calls, write current findings to workspace/findings.md"
- **Before** (judgment): "Check scope" → **After** (cadence): "At turn 1, write a 3-item task list. At final turn, check each item"

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | ΔU ≈ +0.3 per skill rewritten (from 0.05 → 0.35) |
| **Implementation Effort** | Low — rewriting .md files is cheap |
| **Risk** | Not all skills can be cadence-ified. Forcing cadence on judgment tasks may cause rigid behavior |
| **Who Should Build** | coach (owns skill design) with optimizer (cadence analysis) |

### Proposal 5: Skill Pruning — Kill the Deadwood
**Priority: MEDIUM — reduces noise, improves signal**

**Mechanism**: Archive the 42 untested/unadopted skills that have sat for 3+ weeks without any gym testing or adoption. Move to `agents/shared/skills/_archive/`. Keep only skills that are: (a) proven, (b) actively being tested, or (c) recently created (<1 week).

Currently 57 skills create an illusion of capability. The LIBRARY.md shows most are marked "⚪ untested" with "needs gym test" — and they've been that way for weeks.

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | Reduces LIBRARY.md from 57 to ~15 skills. Coach can focus testing on remaining ones |
| **Implementation Effort** | Low — mkdir + mv |
| **Risk** | Some archived skills might be valuable if tested. Archive, don't delete |
| **Who Should Build** | coach (owns library) |

### Proposal 6: "Skill of the Session" Injection
**Priority: LOW — incremental improvement**

**Mechanism**: In each heartbeat, inject one skill tip at the top of the task context:

```
💡 Skill reminder: [budget-before-act] — Check your turn budget before starting work. 
   Plan deliverables for the available turns. (details: skills/budget-before-act/SKILL.md)
```

Rotate through proven skills. This is the lightest possible intervention — ~50 tokens, no infrastructure change needed (just add to heartbeat template).

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | Marginal — per KE-002, text reminders have ~0% effect on judgment. But cadence skills might respond |
| **Implementation Effort** | Very Low — heartbeat template change |
| **Risk** | Agents ignore it (per 0/20 text injection experiments). Adds noise to already long heartbeats |
| **Who Should Build** | may (heartbeat template) |

### Proposal 7: Merge Proven Skills INTO Conventions
**Priority: MEDIUM-HIGH — leverages existing enforcement**

**Mechanism**: Skills that are mechanically verifiable AND have gym evidence should be promoted to conventions. They then get automatic checking, reporting, and coaching alerts.

Candidates for convention promotion:
- **verify-after-edit** → Already convention-like (C1.3 is related). Formalize as C1.8
- **budget-before-act** → Check for early finish() planning statements. C6.2
- **read-before-edit** → Already C1.1. Strengthen the check

| Dimension | Detail |
|-----------|--------|
| **Expected Impact** | Mechanical enforcement → 90%+ compliance (like existing conventions) |
| **Implementation Effort** | Medium — add check functions to convention-check.ts |
| **Risk** | Convention bloat — too many conventions dilute importance of each |
| **Who Should Build** | may (convention-check.ts) |

---

## 8. Recommended Action Plan

### Phase 1: Quick Wins (This Week)
1. **Auto-adopt proven skills** — Deploy the 4 proven but undeployed skills (evidence-over-narrative workflow, obstacle-pivot workflow, tool-discipline workflow, verify-before-finish workflow). Effort: 2 hours. Impact: doubles deployed skills.
2. **Prune the library** — Archive 42 untested skills older than 2 weeks. Effort: 30 minutes. Impact: focuses coach's testing queue.
3. **Cadence rewrites** — Rewrite top 5 judgment-form skills into cadence-form. Effort: 1 hour. Impact: ΔU ≈ +0.3 per skill.

### Phase 2: Infrastructure (Next Week)
4. **Skill Router** — Build `skill-router.ts` + `skill-index.json`. Effort: 4-6 hours. Impact: P(accesses) from 0.07 → 0.5.
5. **Skill compliance checks** — Add verify-after-edit and budget-before-act to convention-check.ts. Effort: 4 hours. Impact: Creates feedback loop.

### Phase 3: Systemic (Ongoing)
6. **Convention promotion** — Promote mechanically-checkable proven skills to conventions. Effort: ongoing. Impact: 90%+ compliance for promoted skills.
7. **Auto-deploy pipeline** — Handler that reads LIBRARY.md and auto-deploys proven skills. Effort: 6-8 hours. Impact: Eliminates manual deployment bottleneck.

---

## 9. Summary Statistics

| Metric | Current State | After Phase 1 | After Phase 2 |
|--------|--------------|---------------|---------------|
| Shared skills | 57 | ~15 (active) | ~15 |
| Skills with ≥1 adoption | 4 (7%) | 8 (53% of active) | 12 (80% of active) |
| Mean P(accesses) | 0.07 | 0.15 | 0.50 |
| Mean U (adopted) | 0.30 | 0.35 | 0.45 |
| Mean U (all skills) | 0.02 | 0.12 | 0.30 |
| Skills with compliance checking | 0 | 0 | 2-3 |
| Feedback loop exists | No | No | Yes |

**The single highest-leverage change**: Build the skill router (Proposal 1). It addresses P(accesses) which is the dominant bottleneck — going from 0.07 to 0.50 would 7× the effective utilization of the skill library. The knowledge router already provides the exact template. Implementation cost is low because the pattern exists.

**The single most important insight**: Skills don't fail because they're bad. They fail because they never reach agents. The 4 adopted skills that DO reach agents via system prompt have measurable positive effects (gym evidence). The problem is a broken delivery pipeline, not broken content.
