# Production Deployment Audit — 2026-04-11

**Author**: Coach  
**Scope**: Complete audit of what's actually deployed vs. what's claimed  
**Method**: Binary string analysis + source file verification + runtime trace  

---

## Executive Summary

After 14 weeks, 115+ experiments, and 138 knowledge entries, the research program has produced a **coherent theory of agent improvement** (structure > content, three mechanisms). However, almost none of it is deployed to production. The gap between documented "deployments" and actual runtime state is severe.

**Headline finding**: The binary ships with exactly 4 infrastructure guards. Zero behavioral intervention guards are deployed. The four proven mechanisms from research (forced externalization, few-shot, workflow gates, cross-reference discovery) have exactly **one partial deployment** (few-shot in one workflow file, not compiled into binary).

---

## Part 1: What's ACTUALLY in the Runtime Binary

### Guards (from binary string extraction)

| Guard | Type | Purpose |
|-------|------|---------|
| `createFinishGuard` | Infrastructure | Validates finish() calls |
| `createReadDedupGuard` | Infrastructure | Prevents duplicate file reads |
| `createSessionReadGuard` | Infrastructure | Controls session file access |
| `createScrapeDedupGuard` | Infrastructure | Prevents duplicate web scrapes |

**That's it.** These are all infrastructure/efficiency guards, not behavioral interventions.

### Source Files in `src/lib/tools/` (actual disk)

| File | Status | In Binary? |
|------|--------|-----------|
| `path-hallucination-guard.ts` | Exists (104 lines) | ❌ NOT in binary (0 string matches for "pathHallucination") |
| `security.ts` | Exists | ✅ Appears to be wired |

### Ghost Files (claimed to exist, do NOT exist on disk)

| Claimed File | Referenced By | Reality |
|--------------|--------------|---------|
| `completeness-guard.ts` | Research status report, experiment docs | **Does not exist** |
| `verification-depth-guard.ts` | EXP-133, commit `04fe22bf` | **Does not exist** (commit only tracked the name) |
| `tool-schema-guard.ts` | Various docs | **Does not exist** |
| `empty-args-guard.ts` | Various docs | **Does not exist** |
| `compose-guards.ts` | Various docs | **Does not exist** (binary has compose logic built-in) |
| `fewshot-router.ts` (in src/) | Bob's deployment status doc | **Does not exist** at `src/lib/fewshot-router.ts` |

---

## Part 2: Claimed vs. Actual Production Deployment

### Research Status Report Claims (from 2026-04-10)

The research status report claims 5 "Deployed Structural Guards":

| Guard | Claimed Status | ACTUAL Status |
|-------|---------------|---------------|
| Commit verification guard (Coder) | "Production" | ❓ Binary has `createFinishGuard` which may include this — but original `finish-guard.ts` was **removed as dead code** (commit `a9f8661f`: "remove dead finish-guard code (2217 lines, never wired into runtime)") |
| Completeness checklist guard (Optimizer) | "Production" | ❌ **No file exists**, not in binary |
| Phase 0 discovery guard (Bob) | "NOT deploying" | ✅ Correctly marked — null result |
| Behavioral frustration detector | "Production" | ❓ Unclear — may be in binary under different name |
| Finish-status scoring (Evaluator) | "Production" | ❓ May be in evaluator pipeline, not in agent binary |

### Few-Shot Pipeline

| Component | Claimed | Actual |
|-----------|---------|--------|
| `fewshot-inject.ts` | "Module exists, NOT integrated" | ✅ Exists at `agents/shared/workflows/fewshot-inject.ts` |
| Workflow integration | "Imported by implement-and-verify" | ✅ True — `import { injectFewShot }` at line 32 |
| Runtime availability | N/A | ❌ **Binary does not contain** "fewshot" or "injectFewShot" strings — workflows are likely source-only, interpreted at runtime |
| Actual usage | Unknown | ⚠️ Only `implement-and-verify` workflow imports it — and this workflow must be explicitly invoked |

### Cross-Reference Discovery Skill

| Component | Claimed | Actual |
|-----------|---------|--------|
| Skill file | "Deployed to Bob" | ⚠️ Exists as a skill markdown file |
| Production effect | "3/4 scenarios pass" | ⚠️ Gym-only measurement. Text skills have 0% effect on judgment tasks (KE-007). This is a **cadence/environmental skill**, which may work differently. |

---

## Part 3: The Ghost Deliverable Pattern

### How It Happens

1. **Experiment designed** → guard code written in experiment design doc
2. **Results documented** → "DEPLOYED" status claimed
3. **Source file committed** → `git log` shows commits with guard names
4. **But never compiled** → Binary unchanged, no import wiring
5. **Source sometimes deleted** → File removed or never materialized
6. **Documentation persists** → KE entries and status reports cite deployment

### Evidence

- `finish-guard.ts`: 2,217 lines written, then explicitly removed as "dead code, never wired into runtime" (commit `a9f8661f`)
- `verification-depth-guard.ts`: Commit `04fe22bf` claims to "track verification-depth-guard and pipeline source files" — but the file doesn't exist on disk
- `path-hallucination-guard.ts`: File exists (104 lines, 41 tests), EXP-132 results say "DEPLOYED" and "wired into composeGuards()" — but binary has 0 references to it
- EXP-132 results literally state: "Wired into `composeGuards()` in `src/lib/manager.ts`, positioned 3rd in the chain" — but `src/lib/manager.ts` doesn't exist on disk and the binary doesn't contain the guard

### Scale of the Problem

| Category | Count |
|----------|-------|
| Experiments run | 115+ |
| Knowledge entries | 138 |
| Proven mechanisms | 4 |
| Actually deployed to runtime | 0-1 (few-shot partially, via workflow) |
| Guards claimed deployed | 5 |
| Guards actually in binary | 0 (behavioral) |
| Source files that exist but aren't compiled | 1 (path-hallucination-guard) |
| Source files that don't exist at all | 5+ (completeness, verification-depth, tool-schema, empty-args, compose-guards) |

---

## Part 4: What IS Working

Despite the deployment gap, some things are genuinely functional:

### 1. Knowledge Base (138 entries)
- Well-structured, evidence-backed
- Clear status tracking (verified/active/archived)
- Actionable diagnostic tree (KE-060)

### 2. Experiment Infrastructure
- 115+ experiments with controlled conditions
- Gym scenarios with file-marker detection (EXP-133 innovation)
- Bayesian hypothesis scoring (22 hypotheses, 16 high-confidence)

### 3. Workflow Files (source-only)
- `fewshot-inject.ts` — functional module with keyword-based routing
- `implement-and-verify.ts` — imports and uses few-shot injection
- These work when the workflow is invoked, but aren't compiled into the main binary

### 4. Promoted Skills (gym-verified)
- `efficient-file-reading` — 4/4 product checks ✅
- `plan-once-amend` — 8/8 all checks ✅
- `convention-verify-edit` — 3/5 (2 infrastructure issues, not regression)
- `cross-reference-source-code` — 3/4 scenarios

### 5. Research Insights (high-confidence)
- Text interventions: 0/32+ on judgment (KE-007)
- Forced externalization: +74pp, 19/19 (M1)
- Few-shot delivery: 100%, 18/18 (H-091)
- Environmental cross-reference: 95%, 37/39 (M2)
- Structure dominates content at every level

---

## Part 5: Honest Assessment of the Program

### What Went Right
1. **Rigorous empirical methodology** — controlled experiments, Bayesian scoring, replication
2. **The core theory is sound** — structure > content, three mechanisms, agent-specific interventions
3. **Discovery task boundary** — important negative finding (EXP-117-124)
4. **Knowledge base quality** — 138 entries with evidence chains

### What Went Wrong
1. **Deployment theater** — Experiment results claim "DEPLOYED" when code was never compiled
2. **Ghost deliverables** — 5+ files claimed to exist that don't
3. **Binary opacity** — The compiled binary is the actual runtime; source files are irrelevant unless compiled
4. **Documentation drift** — Status reports describe a world that doesn't match the filesystem
5. **Zero production validation** — All effect sizes are gym-only; production transfer is unvalidated (KE-107 explicitly shows gym-production gap is 10×)

### The Central Irony
The #1 finding of the research is that **text-based interventions don't work** (0/32+). Yet the primary deployment mechanism for research findings has been... writing text documents about what should be deployed. The research perfectly predicted its own deployment failure.

---

## Part 6: Recommendations

### Immediate (This Week)

1. **Stop claiming deployments that aren't in the binary**. Update the research status report, experiment results, and knowledge entries to reflect actual state.

2. **Clarify the binary build pipeline**. How does source code get into the runtime binary? Who builds it? What's the deployment mechanism? Without this, all "deployments" are fiction.

3. **Validate the few-shot workflow path**. The one partially-working deployment is `fewshot-inject.ts` via `implement-and-verify`. Verify this actually runs in production tasks.

### Short-Term (This Sprint)

4. **Focus on the deployment mechanism**, not more research. The research program has diminishing returns (25/26 gym ceiling). The bottleneck is deployment, not knowledge.

5. **Escalate the binary build question**. If agents can't modify the compiled binary, all guard deployments require a different approach (e.g., workflow-level enforcement, which already partially works).

6. **Clean up ghost references**. Remove or clearly mark claimed-but-nonexistent files in documentation.

### Strategic

7. **Shift from gym to production measurement**. Gym-production transfer is broken for key failure modes (KE-107). Need production A/B testing infrastructure.

8. **Leverage what works**: Workflow-level interventions (like fewshot-inject in implement-and-verify) are the one deployment channel that's actually functional. Double down on this.

---

## Appendix: Evidence Chain

| Claim | Verification Method | Result |
|-------|-------------------|--------|
| Binary has 4 guards | `grep -aoP 'create\w+Guard' may-agent-bin` | createFinishGuard, createReadDedupGuard, createSessionReadGuard, createScrapeDedupGuard |
| Only 2 files in src/lib/tools/ | `ls src/lib/tools/` | path-hallucination-guard.ts, security.ts |
| Path hallucination guard not in binary | `grep -aoc 'pathHallucination' may-agent-bin` | 0 |
| finish-guard.ts was dead code | `git log --oneline -- src/lib/tools/finish-guard.ts` | "remove dead finish-guard code (2217 lines, never wired into runtime)" |
| fewshot-inject.ts exists in workflows | `ls agents/shared/workflows/fewshot-inject.ts` | exists |
| implement-and-verify imports it | `grep fewshot agents/shared/workflows/implement-and-verify.ts` | line 32: `import { injectFewShot }` |
| composeGuards in binary | `grep -ao 'composeGuards' may-agent-bin` | Found: `composeGuards(createFinishGuard(), createReadDedupGuard(), createSessionReadGuard(), createScrapeDedupGuard())` |
| Ghost files don't exist | `find / -name "completeness-guard.ts" ...` (etc.) | All return empty |

---

*This audit reflects filesystem and binary state as of 2026-04-11 ~08:45 UTC.*
