# Skills & Workflows Quality Audit

**Date**: 2025-01-27  
**Auditor**: Coach  
**Scope**: All shared and agent-specific skills and workflows

---

## Executive Summary

The system has **47 shared skills** (directories) + **6 standalone .md skills** + **7 archived skills**, and **18 shared workflow files**. Quality is mixed: strong documentation exists (LIBRARY.md, REGISTRY.md) but there are significant gaps between what's documented and what's on disk, many skills have no evidence of effectiveness, and only 3 of 18 workflow files are documented in the registry.

**Key findings:**
1. **Registry rot**: REGISTRY.md lists `master-worker.ts` as deleted ("dead code, zero consumers") but it's still on disk with **38 import references** — the most-imported workflow after `project.ts`
2. **15 undocumented workflow files** on disk not mentioned in the registry
3. **33 of 47 shared skills** (~70%) have no agent deployment — they exist but nobody uses them
4. **Proven skills not deployed**: Skills marked ✅ proven in LIBRARY.md (evidence-over-narrative, verify-before-finish, obstacle-pivot as workflows) lack systematic deployment
5. **read-before-edit deployed to 4 agents with ZERO production improvement** (KE-023) — still deployed

---

## Workflows Assessment

### Shared Workflows (18 files on disk)

| File | Registry Status | Import Count | Verdict |
|------|----------------|-------------|---------|
| `project.ts` (50KB, 929 lines) | ✅ Documented | 747 | **Core engine.** Heavily used. |
| `master-worker.ts` (23KB) | ❌ Listed as DELETED | 38 | **Registry lie.** Most-used after project.ts. Registry says "dead code, zero consumers" — false. |
| `heartbeat-data.ts` (17KB) | ✅ Documented (helper) | 10 | **Active.** All heartbeats import it. |
| `health-check.ts` (7KB) | ❌ Not in registry | 23 | **Undocumented but heavily used.** |
| `dispatch-validator.ts` (3KB) | ❌ Not in registry | 10 | **Undocumented but used.** |
| `retry-wrapper.ts` (7KB) | ❌ Not in registry | 12 | **Undocumented but used.** |
| `implement-and-verify.ts` (8KB) | ✅ Documented ("85% of usage") | 0 | **Registry claim false?** Zero imports found. May be invoked by name string. |
| `project-cache.ts` (6KB) | ❌ Not in registry | 8 | **Undocumented but used.** |
| `master-worker-cached.ts` (7KB) | ❌ Not in registry | 5 | **Undocumented variant.** |
| `circuit-breaker.ts` (5KB) | ❌ Not in registry | 5 | **Undocumented but used.** |
| `master-worker-with-health-check.ts` (5KB) | ❌ Not in registry | 1 | Low usage. |
| `master-worker-resilient.ts` (9KB) | ❌ Not in registry | 1 | Low usage. |
| `workflow-runner.ts` (8KB) | ❌ Not in registry | 2 | Infrastructure. |
| `budget-checkpoint.ts` (3KB) | ❌ Not in registry | 2 | Infrastructure. |
| `project-helpers.ts` (5KB) | ❌ Not in registry | 3 | Helper module. |
| `fewshot-inject-helpers.ts` (6KB) | ✅ Documented (helper) | 1 | Low usage. |
| `verify-wrap.ts` (1KB) | ✅ Documented | 0 | **Dead code.** Zero imports. |
| `metrics-collector.ts` (4KB) | ❌ Not in registry | 0 | **Dead code.** Zero imports. |

**Workflow Issues:**
- **REGISTRY.md is dangerously stale.** Only 3 of 18 files documented. 12 files added since last audit with zero registry entries.
- `master-worker.ts` has 3 variant files (cached, resilient, with-health-check) — unclear which to use when.
- `verify-wrap.ts` and `metrics-collector.ts` are dead code (0 imports).
- `implement-and-verify.ts` claims "85% of all workflow usage" but has 0 static imports — needs investigation.

### Agent-Specific Workflows

| Agent | Workflow | Status |
|-------|----------|--------|
| All agents | `*-heartbeat.ts` (~59 lines each) | ✅ Active, standardized |
| Coach | `growth-cycle.ts` (386 lines) | ✅ Active |
| Coach | `training-sprint.ts` (301 lines) | Status unclear |
| Optimizer | `investigate-and-fix.ts` (338 lines) | ✅ Active |
| Tech-lead | `verified-coder.ts` (178 lines) | Status unclear |

---

## Skills Assessment

### Shared Skills Library (47 directories)

**Deployed to agents (14 skills, ~30%):**

| Skill | Deployed To | Evidence | Quality |
|-------|-------------|----------|---------|
| evidence-over-narrative | bob, coach, optimizer, scout, tech-lead | ✅ Proven as workflow (EXP-268) | ⚠️ Deployed as text file, proven only as workflow |
| closing-the-loop | amy, amy-kimi, coach, tech-lead | None | ⚪ Untested |
| creating-projects | amy, amy-kimi, coach, tech-lead | None | ⚪ Untested |
| know-when-blocked | amy, bob, coder, tech-lead | None | ⚪ Untested |
| obstacle-pivot | amy, bob, coder, tech-lead | ✅ Proven as workflow (EXP-013: 0→100%) | ⚠️ Deployed as text, proven only as workflow |
| plan-once-amend | amy, bob, coder, tech-lead | Partial (structured-plan-writing tested) | ⚠️ Related skill tested, this one not directly |
| reading-metrics | amy, amy-kimi, coach, tech-lead | None | ⚪ Untested |
| state-check-before-action | amy, bob, coder, tech-lead | None | ⚪ Untested |
| verification | amy, bob, coder, tech-lead | None | ⚪ Untested |
| materialize-findings-concise | scout | ✅ Proven (EXP-022: 52→78%) | ✅ Good |
| prerequisite-gap-protocol | optimizer | None | ⚪ Untested |
| growth-cycle | coach | Related to workflow | ⚠️ Workflow tested, skill doc unclear |
| skill-lifecycle | coach (knowledge ref) | None | ⚪ Untested |

**NOT deployed (33 skills, ~70%):**

These exist in `agents/shared/skills/` but are not copied to any agent:
`agent-coordination`, `agent-growth`, `agent-gym`, `baseline-before-change`, `budget-before-act`, `build-activation-verification`, `cli-coding`, `coder-edit-discipline`, `contradiction-detection`, `delegation-verification`, `deliverable-integrity`, `document-collaboration`, `error-handling`, `evaluator-scoring`, `file-safety`, `handoff`, `helping-others`, `idempotent-work-detection`, `knowledge-sharing`, `l3-delegation-metrics`, `materialize-intermediate-findings`, `patterns`, `post-fix-review`, `progressive-work-persistence`, `prototype-skill-package`, `request-triage-memoization`, `structured-plan-writing`, `task-compliance`, `test-integrity-check`, `test-mock-awareness`, `tool-discipline`, `verification-consistency`, `web-scraping`, `working-in-projects`

### Agent-Specific Skills (not in shared library)

| Agent | Unique Skills | Notes |
|-------|--------------|-------|
| scout | find-before-read, search-governance, knowledge-dedup-check, verify-quantitative-claims | 4 unique, no gym evidence |
| coder | convention-compliance, diagnosis-before-action, multi-file-discovery-completeness, task-instruction-compliance | From .lab/coder-verify-gate fork |
| optimizer | batch-processing, read-only-finish-protocol, deliverable-checklist | Specialized |
| bob | cross-reference-source-code, gym-execution-checklist, knowledge-base-navigation, persistent-task-workflow, `diagnosis-before-action.md.demoted` | Note: one skill is **demoted** |
| tech-lead | finish-before-cleanup, post-delivery-readback-verification | 2 unique |
| may | blocked-capability-escalation (directory) | 1 unique |
| evaluator | Multiple `.cjs` files (anonymize-transcript, challenge-agent, etc.) | These are **scripts**, not skills — mislabeled |
| qa | generate-test-case | 1 unique |

### Standalone .md Skills (in shared/skills root)

`DELIVERY-GUIDE.md`, `growth-cycle.md`, `sanitize-content.md`, `sanitize-memory.md`, `transient-skill.md` — unclear if these are active or orphaned.

---

## Critical Issues

### 🔴 P0: Registry is Lying

`REGISTRY.md` claims `master-worker.ts` was deleted as "dead code, zero consumers." It has **38 import references** — the second most-imported file. The registry was last audited 2026-04-21 but has not kept up with additions. **15 of 18 files are undocumented or misrepresented.**

**Action**: Full registry reconciliation needed immediately.

### 🔴 P0: Deployment Without Evidence

Multiple skills deployed to agents have **zero gym evidence** of effectiveness:
- `closing-the-loop` → 4 agents, untested
- `know-when-blocked` → 4 agents, untested  
- `reading-metrics` → 4 agents, untested
- `verification` → 4 agents, untested
- `state-check-before-action` → 4 agents, untested

These consume context window tokens with no proven benefit.

### 🟡 P1: Proven-as-Workflow Deployed-as-Text

LIBRARY.md explicitly documents that `evidence-over-narrative` and `obstacle-pivot` work **only as workflow enforcement** and fail as text injection. Yet they're deployed to 5+ agents as text `.md` files. This is known to be ineffective.

### 🟡 P1: read-before-edit Still Deployed Despite Proven Failure

KE-023 documents declining compliance after deployment. Scout dropped from 75% to 24%. Four agents still have this skill deployed. The LIBRARY.md itself notes "NO measurable improvement" and "Gym ≠ production."

### 🟡 P1: 70% of Shared Skills Unused

33 of 47 shared skill directories are not deployed to any agent. Many may be valuable but are sitting idle. Some (like `structured-plan-writing`, proven in EXP-019) should be deployed.

### 🟡 P1: Dead Workflow Code

`verify-wrap.ts` and `metrics-collector.ts` have zero imports and should be deleted or archived.

### 🟢 P2: Evaluator "Skills" Are Scripts

The evaluator's skills/ directory contains `.cjs` files — executable scripts, not markdown skill documents. This is a category confusion that could mislead audits and tooling.

---

## What's Actually Working Well

1. **LIBRARY.md is excellent** — the "Works When / Fails When / Gym Evidence" columns are high-quality. This is the gold standard for skill documentation.
2. **Heartbeat standardization** — all agents use `genericHeartbeat` from `heartbeat-data.ts`, clean pattern.
3. **`project.ts`** — clearly the core workflow engine, heavily used (747 refs), well-documented.
4. **Gym-tested skills have clear results** — when tested, the evidence is rigorous (A/B results, sample sizes, effect sizes).
5. **Archive hygiene** — 7 untested/ceiling skills were properly archived with documentation.

---

## Recommendations

1. **Registry reconciliation** (P0): Update REGISTRY.md to reflect all 18 files on disk. Correct the master-worker.ts lie.
2. **Audit deployed-untested skills** (P0): Either gym-test `closing-the-loop`, `know-when-blocked`, `reading-metrics`, `verification`, `state-check-before-action` or remove them from agents.
3. **Remove proven-ineffective deployments** (P1): Remove `read-before-edit` text files from scout, tech-lead, bob, may. Either implement as workflow gate or accept it doesn't work.
4. **Fix text-vs-workflow mismatch** (P1): Don't deploy `evidence-over-narrative` and `obstacle-pivot` as text when they're proven to only work as workflows.
5. **Deploy proven-but-idle skills** (P1): `structured-plan-writing` is proven (EXP-019: 7/8→8/8) and only deployed to coder. Consider broader deployment.
6. **Clean dead code** (P2): Delete `verify-wrap.ts`, `metrics-collector.ts`.
7. **Recategorize evaluator scripts** (P2): Move `.cjs` files out of skills/ into a scripts/ directory.
