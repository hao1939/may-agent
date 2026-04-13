# EXP-152 Phase 2 Design — Targeted Fork-Scenario Pairing

**Date**: 2026-04-13  
**Author**: Bob  
**Status**: VALIDATED — EXECUTING (simplified to 2 conditions, see §11.2)  
**Predecessor**: Phase 1 (45 trials, **ALL INVALID** — see §11)  
**Phase 1 Analysis**: `agents/bob/workspace/research/exp152-phase1-analysis.md`

> ⚠️ **VALIDATION FINDING** (2026-04-13 16:22 UTC): context.md content is NOT injected
> into the system prompt. The `no-rbe-v2` and `no-verify-v2` forks produce **identical
> prompts** (hash `7142d869c737`). The "Verify with evidence" context.md line removal
> in `no-verify-v2` has zero effect. Phase 2 is now a **2-condition experiment**:
> production (all skills) vs no-verify-after-edit (skill removed), using `no-rbe-v2`
> fork for both scenarios. See §11.2 for details.

> ⚠️ **CRITICAL BUG FOUND** (2026-04-13): The gym-runner.ts lab fork overlay mechanism
> used `cpSync` which MERGES directories rather than replacing them. This means
> Phase 1 skill removals NEVER took effect — removed skill files survived from production.
> Fix applied in `test/gym/gym-runner.ts` line 173: pre-remove target subdirectories
> before overlay copy. All Phase 1 results should be discarded.
> See §11 for details.

---

## 1. Design Summary

Phase 2 addresses the three weaknesses identified in Phase 1:

1. **Scenario-guard mismatch** → Each fork tested against a scenario that specifically exercises the removed guard's failure mode
2. **SOUL.md confound** → New forks created WITHOUT SOUL.md (matching production coder's configuration)
3. **Wrong skill removals** → Surgical removal of only the targeted artifact, verified by exact diff

### Conditions

| Condition | Lab Fork | Description |
|-----------|----------|-------------|
| **Production** | none | Standard coder agent — all skills, context, no SOUL.md |
| **no-rbe-v2** | `coder-exp152-no-rbe-v2` | Production MINUS read-before-edit guard (SOUL.md absent, verify-after-edit.md skill removed) |
| **no-verify-v2** | `coder-exp152-no-verify-v2` | Production MINUS verification guards (SOUL.md absent, verify-after-edit.md skill removed, "Verify with evidence" context entry removed) |

Dropping `no-path` (showed no directional signal in Phase 1, and the path-specific scenarios have extreme baselines).

## 2. Phase 1 Confound Analysis

### 2.1 SOUL.md Confound (CRITICAL)

**Finding**: Production coder has **no SOUL.md file** (only `.bak`/`.original` backups). The archetype SOUL.md (`agents/_archetypes/coder/SOUL.md`) is NOT inherited at runtime because `archetypeDir` was removed from SubagentDefinition per Hao directive. The `resolveSystemPrompt()` in `src/lib/manager.ts` (line 464) loads SOUL.md directly from `agentDir` — for production coder, that's `agents/coder/SOUL.md` which doesn't exist.

Phase 1's lab forks ALL had SOUL.md files (derived from the archetype). This means Phase 1 lab forks were **additions** (full SOUL.md + context + skills minus one guard) compared to production (no SOUL.md + context + skills). The 24 lines of SOUL.md content (identity, methodology, 8 skill references, 5 constraints) is a massive uncontrolled addition.

**Fix**: Phase 2 forks will NOT include SOUL.md. Fork content = production coder files only, with targeted removal.

### 2.2 Wrong Skill Removed in no-rbe (MODERATE)

**Finding**: `no-rbe` fork removed `requirements-conflict-analysis.md` (a reasoning skill unrelated to read-before-edit) instead of `verify-after-edit.md` (which encodes "read a file before editing" behavior).

**Evidence**: Production coder has no `read-before-edit.md` skill file — that knowledge is in Bob's skills, not coder's. The coder's read-before-edit behavior comes from:
1. `verify-after-edit.md` skill (mentions reading back after edits)  
2. `context.md` — no explicit read-before-edit entry, but SOUL.md had a skill bullet

Since production coder has no SOUL.md and no `read-before-edit.md` skill, the actual read-before-edit guidance comes entirely from the `verify-after-edit.md` skill file (which says to read files after editing to verify).

**Fix**: `no-rbe-v2` removes `verify-after-edit.md` from skills/ (the only coder artifact encoding edit-related behavioral guidance).

### 2.3 Overly Broad Removal in no-verify (MODERATE)

**Finding**: `no-verify` removed ALL skill files, not just verification-related ones. This conflates verification removal with general skill removal.

**Fix**: `no-verify-v2` removes ONLY `verify-after-edit.md` skill + "Verify with evidence, not narrative" context entry. All other skills remain.

Note: `no-rbe-v2` and `no-verify-v2` overlap in removing `verify-after-edit.md`. The distinction is:
- `no-rbe-v2`: removes verify-after-edit.md only (tests edit discipline loss)
- `no-verify-v2`: removes verify-after-edit.md + "Verify with evidence" context entry (tests both edit discipline AND verification mindset loss)

This creates a partial dose-response: no-rbe-v2 removes one artifact, no-verify-v2 removes two. If both show degradation but no-verify-v2 shows MORE degradation, that's additive evidence for H-108.

## 3. Lab Fork Specifications

### 3.1 Fork: `coder-exp152-no-rbe-v2`

**Exact files:**
```
agents/.lab/coder-exp152-no-rbe-v2/
├── context.md          # IDENTICAL to agents/coder/context.md
└── skills/
    ├── README.md                          # IDENTICAL to production
    ├── efficient-file-reading.md          # IDENTICAL to production  
    ├── requirements-conflict-analysis.md  # IDENTICAL to production
    └── structured-plan-writing.md         # IDENTICAL to production
```

**What's different from production**: `verify-after-edit.md` removed from skills/  
**What's identical to production**: context.md, all other skills, NO SOUL.md  
**No agent.json** — production's agent.json survives the overlay, so extends still applies (but since archetypeDir is not used by resolveSystemPrompt, this just preserves tool config).

### 3.2 Fork: `coder-exp152-no-verify-v2`

**Exact files:**
```
agents/.lab/coder-exp152-no-verify-v2/
├── context.md          # Production MINUS "Verify with evidence" line
└── skills/
    ├── README.md                          # IDENTICAL to production
    ├── efficient-file-reading.md          # IDENTICAL to production  
    ├── requirements-conflict-analysis.md  # IDENTICAL to production
    └── structured-plan-writing.md         # IDENTICAL to production
```

**What's different from production**: 
1. `verify-after-edit.md` removed from skills/
2. "Verify with evidence, not narrative" line removed from context.md Operational Knowledge section

**What's identical to production**: all other skills, all other context.md content, NO SOUL.md

### 3.3 Production Baseline

```bash
scripts/gym-run.sh <scenario> --agent coder
```

No lab fork. Uses production coder as-is: no SOUL.md, all 5 skills, full context.md.

## 4. Scenario Selection

### 4.1 For no-rbe-v2: Edit-Heavy Scenario

**Primary**: `convention-verify-edit` (87.9% baseline, N=33)

This scenario requires setting status of all users to "ARCHIVED" in a `data/` directory by editing multiple files. The `convention-verify-edit` scorer checks that the agent verified each edit after making it. Removing the `verify-after-edit.md` skill should directly impact this behavior.

**Concern**: 87.9% baseline is above ideal range (30-70%). But the 12% failure rate means there IS variance to detect. With the guard removed, if the rate drops to ~65%, that's a detectable 23pp effect with N=20.

**Backup**: `read-before-edit` (4.3% baseline, N=23). The floor effect makes this unsuitable as a primary, BUT it could be used as a **convention check** supplementary measure: even if agents fail the product checks, do they read-before-edit MORE with the skill present?

**Alternative consideration**: `edit-precision` — need to check baseline.

### 4.2 For no-verify-v2: Verification-Heavy Scenario

**Primary**: `contradictory-requirements-ext-3unrelated` (54.5% baseline, N=11)

This scenario presents contradictory requirements plus 3 unrelated externalization gates. It's ideal because:
- 54.5% baseline is in the sweet spot (30-70%)
- The task requires accurate output that must be verified
- The unrelated gates test whether the agent can manage multi-step verification
- Removing "Verify with evidence" context entry should reduce careful output checking

### 4.3 Control Scenario (Both Conditions)

`cascading-error` (100% baseline, N=10) or similar high-baseline scenario where edit discipline and verification are not the bottleneck. If all conditions score ~100%, that confirms the guard removals don't globally degrade performance — they only affect guard-relevant tasks.

## 5. Sample Size

### Per-cell targets

| Cell | Scenario | N |
|------|----------|---|
| Production × convention-verify-edit | edit-heavy | 20 |
| no-rbe-v2 × convention-verify-edit | edit-heavy | 20 |
| Production × contradictory-req-ext-3un | verify-heavy | 20 |
| no-verify-v2 × contradictory-req-ext-3un | verify-heavy | 20 |
| Production × cascading-error (control) | control | 10 |
| no-rbe-v2 × cascading-error (control) | control | 10 |
| no-verify-v2 × cascading-error (control) | control | 10 |

**Total**: 110 trials  
**Estimated cost**: 110 × $0.10 = ~$11  
**Sequential stopping**: After N=10 per cell, compute interim p-values. Stop early if any comparison reaches p<0.01 (strong evidence) or p>0.50 (futility).

### Power

With N=20 per cell:
- Detectable effect size (one-tailed α=0.05, 80% power): ~25pp difference
- For convention-verify-edit (87.9% baseline): can detect drop to ~63%
- For contradictory-req (54.5% baseline): can detect drop to ~30%

These are large effects, but H-108 predicts that targeted guard removal on guard-relevant tasks should produce large effects. If the effect is <25pp, we'll see a directional trend even if not significant — and the error recurrence analysis (§6) provides an additional, more sensitive measure.

## 6. Error Recurrence Analysis (Primary Discriminator)

The key H-108 prediction is not just "performance drops" but "the SPECIFIC error the guard prevents recurs." This is a more powerful test than overall pass/fail.

### 6.1 For no-rbe-v2

**Target error**: edit() calls without a preceding read() of the same file path.

**Measurement**: From gym run transcripts, extract all tool call sequences. For each edit(path, ...) call, check if a read(path) or bash("cat <path>") occurred earlier in the session. Count violations.

**H-108 prediction**: no-rbe-v2 has MORE edit-without-read violations than production.

### 6.2 For no-verify-v2

**Target error**: finish() without post-write read-back of modified files.

**Measurement**: From gym run transcripts, extract the sequence between the last write/edit call and the finish() call. Check if the agent read back the modified file. Count violations.

**H-108 prediction**: no-verify-v2 has MORE unverified finishes than production.

### 6.3 Analysis

For each error type, use:
1. **Count comparison**: Mann-Whitney U test (not normally distributed)
2. **Binary comparison**: Fisher's exact test (any violation yes/no)
3. **Rate comparison**: Total violations / total edit calls (Poisson regression)

The error recurrence analysis can detect effects even when overall pass/fail doesn't change — an agent might pass the scenario but make MORE violations along the way (compensating via other means).

## 7. Procedure

### Step 1: Create Lab Forks (30 min)

```bash
# Create no-rbe-v2
mkdir -p agents/.lab/coder-exp152-no-rbe-v2/skills
cp agents/coder/context.md agents/.lab/coder-exp152-no-rbe-v2/context.md
cp agents/coder/skills/README.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/efficient-file-reading.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/requirements-conflict-analysis.md agents/.lab/coder-exp152-no-rbe-v2/skills/
cp agents/coder/skills/structured-plan-writing.md agents/.lab/coder-exp152-no-rbe-v2/skills/
# Note: verify-after-edit.md NOT copied — this is the removal

# Create no-verify-v2
mkdir -p agents/.lab/coder-exp152-no-verify-v2/skills
cp agents/coder/context.md agents/.lab/coder-exp152-no-verify-v2/context.md
# Edit context.md to remove "Verify with evidence, not narrative" line
cp agents/coder/skills/README.md agents/.lab/coder-exp152-no-verify-v2/skills/
cp agents/coder/skills/efficient-file-reading.md agents/.lab/coder-exp152-no-verify-v2/skills/
cp agents/coder/skills/requirements-conflict-analysis.md agents/.lab/coder-exp152-no-verify-v2/skills/
cp agents/coder/skills/structured-plan-writing.md agents/.lab/coder-exp152-no-verify-v2/skills/
# Note: verify-after-edit.md NOT copied — this is the removal
```

### Step 2: Validate Forks (3 trials)

Run 1 trial per condition to confirm no infrastructure errors:
```bash
scripts/gym-run.sh convention-verify-edit --agent coder
scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2
scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-verify-v2
```

### Step 3: Run Main Experiment (~110 trials)

Run in interleaved blocks (5 per condition, cycle through):
```bash
# Block 1: N=5 each
for i in {1..5}; do
  scripts/gym-run.sh convention-verify-edit --agent coder &
  scripts/gym-run.sh convention-verify-edit --agent coder --lab coder-exp152-no-rbe-v2 &
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder &
  scripts/gym-run.sh contradictory-requirements-ext-3unrelated --agent coder --lab coder-exp152-no-verify-v2 &
  wait
done

# Interim check after N=10
# If strong signal → continue to N=20
# If no signal → consider stopping (futility)
```

### Step 4: Error Recurrence Analysis

After trials complete, analyze transcripts for guard-specific error patterns.

### Step 5: Write Results

Update EXP-152 design.md status, H-108 P(H), create KE entry.

## 8. Decision Rules

| Result | Action | H-108 Update |
|--------|--------|-------------|
| no-rbe-v2 < Production on convention-verify-edit (p<0.05) AND error recurrence confirmed | **H-108 SUPPORTED** for read-before-edit guard | P(H) → 0.70 |
| no-verify-v2 < Production on contradictory-req (p<0.05) AND error recurrence confirmed | **H-108 SUPPORTED** for verification guard | P(H) → 0.70 |
| Both supported | **H-108 STRONGLY SUPPORTED** | P(H) → 0.80 |
| No significant effects AND no error recurrence | **H-108 WEAKENED** | P(H) → 0.35 |
| Directional trends (p 0.05-0.20) with error recurrence | **Suggestive but underpowered** | P(H) → 0.55, consider Phase 3 |
| Control scenario unaffected (no global degradation) | Confirms specificity | Supports H-108 mechanism |

## 9. Differences from Phase 1

| Aspect | Phase 1 | Phase 2 |
|--------|---------|---------|
| SOUL.md | Forks had SOUL.md, production didn't | Forks match production (no SOUL.md) |
| Skill removal | Removed wrong skill (requirements-conflict-analysis) | Removed targeted skill (verify-after-edit) |
| Scenario | General task (kb-discovery-baseline-126) | Guard-specific scenarios |
| no-verify scope | Removed ALL skills + context entry | Removed only verify-after-edit + context entry |
| Error analysis | Binary pass/fail only | Pass/fail + error recurrence analysis |
| Control scenario | None | cascading-error (high-baseline control) |
| no-path | Included | Dropped (no signal, extreme baselines) |

## 10. Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| convention-verify-edit ceiling (87.9%) | Error recurrence provides sensitivity even at ceiling. If guard removal drops to ~70%, that's still detectable at N=20. |
| contradictory-req baseline unstable (N=11) | Phase 2 production runs will also serve as additional baseline estimation. If actual baseline differs from 54.5%, adjust interpretation. |
| Lab fork overlay interacts unexpectedly | ~~Validate forks before main experiment. Compare assembleEffectivePrompt hash between conditions.~~ **FOUND**: overlay bug meant forks had identical prompts. Fixed by pre-removing target subdirs. Validated with prompt hash comparison: production=`46ffe2beb315`, forks=`7142d869c737`. |
| LLM API variance | Interleaved blocking design controls for temporal API changes. |

## 11. Lab Fork Overlay Bug (CRITICAL)

### Discovery

During Phase 2 validation, all 3 trial conditions produced **identical prompt hashes** (`46ffe2beb315`). This means the lab fork overlay was not changing the effective system prompt.

### Root Cause

`test/gym/gym-runner.ts` line 173 used `cpSync(labDir, agentTarget, { recursive: true })` to overlay the lab fork onto the sandboxed agent. Node.js `cpSync` with `recursive: true` **merges** directories: it copies files from source to destination but does NOT delete files in destination that don't exist in source.

Result: Production agent's `skills/verify-after-edit.md` survived every overlay because the lab forks simply didn't include it — they expected the file's absence to mean deletion, but cpSync doesn't work that way.

### Impact on Phase 1

**ALL Phase 1 results are invalid.** Every lab fork (`no-path`, `no-rbe`, `no-verify`) had:
- All 5 production skills intact (removals didn't take effect)  
- SOUL.md **added** (Phase 1 forks included SOUL.md, production didn't)

Phase 1 was testing "production + SOUL.md" vs "production", not "production - guard" vs "production". The null results make perfect sense: adding SOUL.md to a system that already has skill files has minimal marginal effect.

### Fix

Applied to `test/gym/gym-runner.ts`:

```typescript
// Before overlay: remove agent subdirectories that the fork replaces,
// so cpSync doesn't merge (e.g., fork's skills/ fully replaces agent's skills/).
const agentTarget = join(gymAgents, opts.agentName);
for (const entry of readdirSync(labDir, { withFileTypes: true })) {
  if (entry.isDirectory()) {
    rmSync(join(agentTarget, entry.name), { recursive: true, force: true });
  }
}
cpSync(labDir, agentTarget, { recursive: true });
```

Logic: For each directory in the lab fork, delete the corresponding directory in the target BEFORE copying. This ensures the fork's `skills/` directory completely replaces the production `skills/` directory (4 files, not 5).

### Validation After Fix

| Run | Condition | Prompt Hash | Status |
|-----|-----------|-------------|--------|
| 804 | Production (pre-fix, baseline) | `46ffe2beb315` | ✅ |
| 806 | no-rbe-v2 (pre-fix, BROKEN) | `46ffe2beb315` | ⚠️ Same as production! |
| 828 | no-rbe-v2 (post-fix) | `7142d869c737` | ✅ Different from production |
| 831 | no-verify-v2 (post-fix) | `7142d869c737` | ✅ Different from production |

Note: no-rbe-v2 and no-verify-v2 have the same prompt hash because `context.md` is NOT injected into the system prompt at all. The `resolveSystemPrompt()` function loads context.md via `getAgentDir()` but in the gym runner's sandboxed environment, context.md content does not appear in `system_instructions`. Verified by querying `gym_prompts` table: neither production nor lab fork prompts contain context.md content like "Verify with evidence" or "Operational Knowledge".

### Coach's no-path Trials

Any trials Coach ran with the `no-path` fork before this fix are also invalid. Need to notify Coach.

## 11.2 Context.md Not In System Prompt (found during Phase 2 validation)

**Date**: 2026-04-13 16:22 UTC

**Finding**: Production coder's `context.md` contains "Verify with evidence, not narrative" (line 29), but this text does NOT appear in the gym system prompt. Verified by:

1. Querying `gym_prompts` table for production hash `46ffe2beb315`
2. Searching for "Verify with evidence", "KE-093", "fabricate", "Operational Knowledge", "What You Know" — all absent
3. Both lab forks (no-rbe-v2 and no-verify-v2) produce identical prompt hash `7142d869c737`

**Root Cause**: The gym runner creates a sandboxed agents directory. The `resolveSystemPrompt()` function (manager.ts:643-654) loads context.md from `getAgentDir(def)`, but in the gym oneshot mode, context.md content is apparently injected separately from the system_instructions block (possibly as a conversation context or not at all in oneshot mode).

**Impact**: The originally-planned 3-condition design (production, no-rbe-v2, no-verify-v2) collapses to 2 conditions. The no-rbe-v2 and no-verify-v2 forks are identical.

**Resolution**: Phase 2 proceeds as a **2-condition experiment**:
- **Condition A**: Production (all skills including verify-after-edit.md)
- **Condition B**: No-verify-after-edit (using `coder-exp152-no-rbe-v2` fork — verify-after-edit.md skill removed)

The core H-108 test remains valid: does removing a behavioral guard (verify-after-edit skill) cause the guarded error to recur on guard-relevant scenarios?

**Sample Size Adjustment**: No change needed. The 110-trial plan already had 20 per cell for production vs fork on each scenario. We just lose the dose-response analysis (1 removal vs 2 removals).

**Future Work**: Investigate why context.md isn't in the gym prompt. If it's a gym-specific issue, production agents may still benefit from context.md. If context.md is genuinely never loaded, that's a separate finding worth documenting (relates to KE-011: knowledge files are passive).
