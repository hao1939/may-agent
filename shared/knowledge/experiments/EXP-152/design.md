# EXP-152: Guard Artifacts as Environmental Memory — Removal Degrades Performance

**Status**: COMPLETE — INCONCLUSIVE (88 trials, 3 scenarios, all ceiling effects)  
**Hypothesis**: H-108 (Guard Artifacts as Environmental Memory Externalization)  
**Predecessor**: EXP-151 (Difficulty Threshold — provided calibration data + medium-bucket learnings), EXP-142 (Agent-Specific Guard Calibration)  
**Created**: 2026-04-13  
**Completed**: 2026-04-13  
**Priority**: Tier 2 — tests novel theoretical prediction derived from DD-755/DD-756 synthesis  
**Results**: [Phase 1](interim-results-phase1.md) | [Phase 2](phase2-results.md) | [KE-170](../../entries/KE-170-skill-redundancy-ceiling-effect.md)  
**Key Finding**: Skills encoding behaviors the LLM already does naturally are redundant. P(H-108) updated 0.50 → 0.45. Successor: EXP-153.

---

## 1. Research Question

Do guard/governance artifacts function as environmental memory that reduces downstream cognitive load? Specifically: does removing context entries that encode accumulated failure knowledge (guards, skills, context.md facts) cause agents to **re-exhibit the failures those artifacts were designed to prevent**?

This is a direct test of H-108's core claim: guards serve a dual function — (1) safety enforcement on the producing agent, and (2) environmental memory for the same or downstream agents. Removing them eliminates function (2) even when function (1) may no longer be needed.

## 2. Hypothesis Under Test

**H-108** predicts:
- **P-108a** (Primary): Removing guard artifacts from agent context degrades performance on tasks where those guards encode accumulated failure knowledge
- **P-108e** (Secondary): The degradation is strongest for medium-difficulty tasks (connecting to H-107's difficulty threshold)

### Specific Mechanism Being Tested

Context.md entries, skill files, and active_recall injections are **environmental artifacts** in the DD-755 sense — observing them guarantees a specific prior interaction occurred (the failure that prompted their creation). By the Artifact Reduction Theorem, these artifacts provably reduce the internal capacity requirements for agents to avoid those same failures. Removing them forces agents to rediscover failure modes from scratch, consuming capacity that was previously externalized.

## 3. Experimental Design

### 3.1 Design Type

**2 × 3 mixed design**:
- **Factor A — Guard Condition** (between-subjects, 3 levels): Full Context / Targeted Removal / Baseline Minimal
- **Factor B — Task Type** (within-subjects, 2 levels): Guard-Relevant / Guard-Irrelevant (control)

### 3.2 Guard Conditions

| Condition | Description | Implementation |
|-----------|-------------|----------------|
| **Full Context** | Production configuration — all guards, skills, context.md entries present | `scripts/gym-run.sh <scenario> --agent coder` (standard) |
| **Targeted Removal** | Production configuration MINUS specific guard artifacts relevant to the scenario being tested | Custom lab fork: `coder-exp152-targeted` — identical to production but with specific skill/context entries excised |
| **Baseline Minimal** | No guards, no skills, minimal context — the EXP-151 `coder-minimal-exp096` fork | `scripts/gym-run.sh <scenario> --agent coder --lab coder-minimal-exp096` |

**Key distinction**: Targeted Removal preserves all guards/context EXCEPT the ones directly encoding failure knowledge for the specific task. This isolates the environmental memory effect from general overhead reduction. If H-108 is correct, Targeted Removal should perform **worse** than Full Context on guard-relevant tasks (losing specific memory) but **equal or better** on guard-irrelevant tasks (reduced overhead without memory loss).

### 3.3 Task Selection Strategy

We need scenarios where:
1. A known guard/skill/context entry encodes specific failure knowledge
2. The failure mode is empirically documented (we know what errors occur without the guard)
3. The scenario is available in the gym with functional scoring
4. Baseline performance is in the **medium range** (40–80%) to avoid ceiling/floor effects (per EXP-151 Phase 1 learnings: Easy bucket hit 100% ceiling, Hard bucket hit 0% floor — neither discriminated)

### 3.4 Selected Scenarios — Guard-Relevant Tasks

Each scenario is paired with a specific guard artifact whose removal we test:

#### Scenario Set R1: Read-Before-Edit (Guard: `read-before-edit` skill)

**Guard artifact**: `agents/bob/skills/read-before-edit.md` + context.md entry "C1.1 read-before-edit: You MUST read() any file before edit()ing it"

**Failure knowledge encoded**: Agents frequently call edit() without first reading the file, causing blind overwrites, duplicate entries, and broken file structure. This was Bob's #1 failure mode (34+ wasted calls in 7 days documented).

**Gym scenarios**: Any scenario requiring file edits — e.g., `investigate-fix-pattern` (100% baseline, but with targeted removal may regress), `mock-leak-trap` (if scoring fixed), or coding tasks from the gym catalog.

**Predicted effect of removal**: Agent will attempt edit() calls without prior read(), leading to content corruption or edit failures (oldText mismatch).

#### Scenario Set R2: Path Hallucination (Guard: EXP-132 context entry)

**Guard artifact**: Context.md entry encoding path hallucination prevention — "always `ls` the parent directory before reading files in agents/shared/knowledge/"

**Failure knowledge encoded**: Agents guess file paths from memory instead of listing directories, causing ENOENT errors and wasted tool calls. Top FM-1.3 error pattern.

**Gym scenarios**: Any scenario requiring navigation of a knowledge base or file tree — `kb-integration-discovery-fewshot` (33% baseline — good medium range), or `context-proof-build-xref` (0% baseline — too hard).

**Predicted effect of removal**: Agent will hallucinate file paths, hitting ENOENT errors and consuming tool calls on non-existent files.

#### Scenario Set R3: Verification Collapse (Guard: FM-3.3 verification guard)

**Guard artifact**: The finish() verification gate — blocks completion without evidence of post-write read-back. Plus context.md entry "Verify with evidence, not narrative".

**Failure knowledge encoded**: Agents claim verification ("I confirmed the file looks correct") without actually reading the output. H-093 documents this as verification collapse under complexity pressure.

**Gym scenarios**: Scenarios requiring accurate output verification — `contradictory-requirements-ext-3unrelated` (50% baseline — ideal medium), `investigate-fix-pattern` (100% baseline — ceiling risk).

**Predicted effect of removal**: Agent will produce unverified outputs, claiming success without reading back. Error rate increases on tasks requiring accurate deliverables.

### 3.5 Selected Scenarios — Guard-Irrelevant Tasks (Control)

These scenarios should NOT be affected by the specific guard removals, serving as a within-subject control:

| Scenario | Baseline | Why Guard-Irrelevant |
|----------|----------|---------------------|
| `investigate-fix-pattern` | 100% | Primarily code investigation — read-before-edit, path hallucination, and verification guards are secondary to core debugging skill |
| A simple code-fix scenario (TBD from gym catalog) | 60-80% | Straightforward single-file fix where guards add overhead but don't encode relevant failure knowledge |

**Predicted effect of removal on controls**: Targeted Removal ≈ Full Context (no relevant memory lost). Baseline Minimal may improve if overhead reduction helps (per H-107) or stay equal.

### 3.6 Lab Fork Specifications

#### `coder-exp152-targeted` Lab Fork

Create three sub-variants, one per guard-relevant scenario set:

| Variant | Removed Artifact | Everything Else |
|---------|-----------------|-----------------|
| `coder-exp152-no-rbe` | Remove `read-before-edit.md` skill + context.md C1.1 entry | All other skills, guards, context intact |
| `coder-exp152-no-path` | Remove path hallucination context.md entry ("always ls the parent directory...") | All other skills, guards, context intact |
| `coder-exp152-no-verify` | Remove FM-3.3 verification guard + "Verify with evidence" context entry | All other skills, guards, context intact |

This ensures each removal is **surgical** — testing the memory function of one specific artifact in isolation, not the general effect of overhead reduction.

## 4. Sample Size

### Justification from EXP-151 Learnings

EXP-151 Phase 1 revealed critical sample size lessons:
- Easy bucket (100% baseline) showed zero variance → no sample size would detect an effect
- Hard bucket (0% baseline) showed zero variance → same problem
- **Medium bucket is where effects live** — we MUST select scenarios with 30-70% baseline rates

### Power Analysis

For comparing two proportions (e.g., Full Context vs Targeted Removal):
- Expected effect size: 20pp degradation (from ~60% → ~40% pass rate) — conservative estimate based on DD-755's grid-world findings showing 15-30pp effects of artifact removal
- At α = 0.05 (one-tailed, directional hypothesis), β = 0.20 (80% power):
- Required N ≈ **25 per cell** for 20pp effect
- Required N ≈ **45 per cell** for 15pp effect

### Practical Sample Plan

| Arm | N per guard-relevant scenario | N per control scenario | Total |
|-----|-------------------------------|----------------------|-------|
| Full Context | 20 | 10 | ~70 |
| Targeted Removal | 20 | 10 | ~70 |
| Baseline Minimal | 20 | 10 | ~70 |

**Total trials**: ~210 (across 3 arms × ~3 guard-relevant + ~2 control scenarios × N per cell)

**Cost estimate**: At $0.05–0.15 per trial → **$10–$32**

**Note**: If initial results show effect sizes >25pp, we can stop early (sequential testing with alpha spending). If effect sizes are <10pp, we may need to increase N — but that would itself be informative (small effect = weak memory function).

## 5. Procedure

### Phase 0: Lab Fork Preparation
1. Create `coder-exp152-targeted` lab fork directory structure
2. For each variant, surgically remove the specific guard artifact
3. Validate that the forks load correctly: run 1 trial each, confirm no infrastructure errors
4. Document exact diff between production and each variant

### Phase 1: Calibration (N=5 per scenario)
1. Run 5 trials of each candidate scenario under Full Context condition
2. Confirm baseline pass rates are in 30-70% range
3. Drop any scenario at ceiling (>85%) or floor (<15%)
4. Select final scenario set

### Phase 2: Main Experiment
1. For each cell (3 conditions × ~5 scenarios):
   - Run N=20 independent trials
   - Randomize trial order across conditions
   - Record: pass/fail, tool call count, token usage, specific error types (path hallucination, edit-without-read, unverified output)
2. Run conditions in interleaved blocks to control for temporal effects

### Phase 3: Retrospective Analysis
*(Separate from the prospective experiment — leverages existing data)*

1. Query `.state/may.db` for all multi-agent sessions from the past 30 days
2. Identify sessions where:
   - A guard was recently added (before vs after treatment)
   - A guard was recently removed or exempted (e.g., EXP-142's Bob guard exemption)
3. For each guard change, measure error rates in the **7 days before** vs **7 days after**
4. Specific metrics:
   - FM-1.3 (path hallucination) rate before/after path guard addition
   - FM-3.3 (verification failure) rate before/after verification guard changes
   - C1.1 (read-before-edit) violation rate before/after skill addition

**This arm provides ecological validity** — real production data, not gym scenarios. The prospective experiment provides causal inference; the retrospective provides ecological generalizability.

### Phase 4: Analysis
1. Primary analysis (see §6)
2. Error taxonomy: classify each failure as "guard-relevant" (would have been prevented by the removed artifact) vs "guard-irrelevant"
3. Write results entry (KE-170 or similar)

## 6. Statistical Analysis Plan

### 6.1 Primary Test: Guard Artifact Memory Effect

**Logistic regression**:
```
logit(pass) = β₀ + β₁(condition) + β₂(task_type) + β₃(condition × task_type) + ε
```

- **Primary interest**: β₃ (interaction). H-108 predicts that condition effects are **larger** for guard-relevant tasks than guard-irrelevant tasks.
- Condition coded as: Full=0, Targeted Removal=1, Minimal=2
- Task type coded as: Guard-Relevant=1, Guard-Irrelevant=0

### 6.2 Planned Contrasts (maps to H-108 predictions)

| Prediction | Test | Expected Result |
|-----------|------|-----------------|
| **P-108a**: Targeted removal degrades guard-relevant tasks | Guard-Relevant: Full vs Targeted pass rate | Full > Targeted (one-tailed z-test, p<0.05) |
| **P-108a corollary**: Targeted removal does NOT degrade guard-irrelevant tasks | Guard-Irrelevant: Full vs Targeted pass rate | Full ≈ Targeted (equivalence test, TOST, ±10pp) |
| **Memory > Overhead**: Targeted removal is worse than Full despite reduced overhead | Same as P-108a primary | Confirms memory function outweighs overhead reduction |
| **Specificity**: Targeted removal is BETTER than Baseline Minimal on guard-irrelevant tasks | Guard-Irrelevant: Targeted vs Minimal pass rate | Targeted ≥ Minimal (remaining guards still provide memory for other failure modes) |
| **Dose-response**: Baseline Minimal is worst on guard-relevant tasks | Guard-Relevant: Full > Targeted > Minimal | Monotonic degradation with artifact removal |

### 6.3 Secondary Metrics

| Metric | Measurement | H-108 Prediction |
|--------|-------------|-----------------|
| **Tool call count** | Mean tool calls per trial | Targeted Removal > Full on guard-relevant tasks (agent must rediscover via extra exploration what the guard artifact would have told it) |
| **Error type distribution** | Classify failures by error taxonomy | Targeted Removal re-exhibits the specific failure the removed guard was designed to prevent |
| **Token usage** | Total tokens consumed | Targeted Removal > Full on guard-relevant tasks (capacity no longer externalized → must be carried internally) |
| **Time to first error** | Tool call index of first guard-relevant error | Earlier errors in Targeted Removal (no artifact to prevent initial mistake) |

### 6.4 Error Recurrence Analysis (Key H-108 Discriminator)

For each guard removal variant, track whether the **specific error type** the guard was designed to prevent recurs:

| Variant | Error to Track | Measurement |
|---------|---------------|-------------|
| `no-rbe` | edit() without prior read() of same file | Count edit calls not preceded by read of same path |
| `no-path` | ENOENT errors from hallucinated paths | Count file-not-found errors in tool outputs |
| `no-verify` | finish() without post-write read-back | Count finish calls without evidence of file verification |

**This is the strongest test of H-108**: if guard removal causes the **exact error** the guard was designed to prevent to recur, the artifact was functioning as environmental memory of that failure mode.

### 6.5 Retrospective Analysis Plan

For the Phase 3 retrospective arm:

**Interrupted time series analysis**: For each guard addition/removal event, fit a segmented regression:
```
error_rate_t = β₀ + β₁(time) + β₂(post_intervention) + β₃(time × post_intervention) + ε
```
- β₂ captures the immediate level change after guard introduction/removal
- β₃ captures whether the effect sustains or decays over time

**H-108 predicts**: β₂ < 0 for guard additions (immediate error reduction), β₂ > 0 for guard removals (immediate error increase). β₃ ≈ 0 (sustained effect — the artifact continues providing memory as long as it's present).

### 6.6 Falsification Criteria

H-108 is **falsified** if:
- Targeted Removal ≈ Full Context on guard-relevant tasks (no memory effect, p > 0.20)
- AND error recurrence analysis shows no increase in guard-specific errors after removal
- AND retrospective analysis shows no before/after effect of guard changes

H-108 is **supported** if:
- Full > Targeted on guard-relevant tasks (p < 0.05) with effect size > 10pp
- AND error recurrence analysis shows the specific prevented error returns after removal
- AND Full ≈ Targeted on guard-irrelevant tasks (specificity confirmed)

H-108 is **partially supported** if:
- Prospective experiment shows the predicted pattern but retrospective does not (or vice versa)
- Effect exists but is smaller than predicted (<10pp) — suggests weak memory function

## 7. Threats to Validity

| Threat | Severity | Mitigation |
|--------|----------|-----------|
| **Confound: overhead reduction masks memory loss** | High | Targeted Removal design isolates memory from overhead — removes only the specific artifact, not general guards |
| **Confound: scenario-guard coupling** | Medium | Include guard-irrelevant control tasks to confirm specificity. Also: each scenario paired with a specific guard, not testing general "guard presence" |
| **Scenario selection bias** | Medium | Select scenarios based on baseline rates (30-70%), not expected effect size. Phase 1 calibration catches misclassified scenarios |
| **Ceiling/floor effects** | High (learned from EXP-151) | EXP-151 showed Easy=100%, Hard=0%. We MUST confirm medium-range baselines in Phase 1. Drop any scenario outside 20-80% |
| **Scoring artifacts** | Medium (learned from EXP-151) | EXP-151's mock-leak-trap had scoring issues (0% due to scorer expectations, not agent failure). Run 5 calibration trials per scenario and inspect scoring criteria before main experiment |
| **Temporal confounds in retrospective** | Medium | Interrupted time series controls for secular trends. Multiple guard change events provide replication |
| **Multiple comparisons** | Low | Pre-registered contrasts with Holm-Bonferroni correction. 5 planned comparisons → adjusted α ≈ 0.01 for the first comparison |
| **Lab fork fidelity** | Medium | Document exact diffs. Run 1 validation trial per fork before main experiment |

## 8. Connection to Knowledge Base

| Entry | Relationship |
|-------|-------------|
| **H-108** | Direct test — EXP-152 is the primary experiment for P-108a |
| **DD-755** | Theoretical foundation — Artifact Reduction Theorem predicts the memory effect being tested |
| **DD-756** | Architectural complement — IEEC evidence chains as memory artifacts |
| **KE-161** | Parent paradigm — if H-108 supported, strengthens "permanent linter" with memory function argument |
| **KE-164** | Knowledge entry connecting DD-755 to our architecture — EXP-152 empirically tests KE-164's predictions |
| **KE-165** | Knowledge entry bridging DD-756 to guard architecture — EXP-152 tests whether the bridge holds empirically |
| **H-107 / EXP-151** | Difficulty threshold interaction — EXP-152 scenarios must be in medium range (EXP-151 learning). Also tests P-108e (memory effect strongest at medium difficulty) |
| **EXP-142** | Counter-evidence source — Bob's guard exemption helped in single-agent. EXP-152's retrospective arm can re-analyze EXP-142 data for downstream effects |
| **KE-143** | Guard redundancy finding — EXP-152 distinguishes "redundant overhead" from "useful memory" by testing targeted removal |
| **H-093** | Verification collapse — one of the specific failure modes EXP-152 tracks (FM-3.3 recurrence after verification guard removal) |

## 9. Decision Rules

After EXP-152 completes:

**If H-108 supported (Full > Targeted on guard-relevant tasks, error recurrence confirmed)**:
- Update H-108 P(H) upward (target: 0.75+)
- Update KE-161 with memory function evidence
- Propose design principle: guard removal decisions must evaluate downstream memory effects, not just fire rate on the guarded agent
- Design EXP-153: artifact quality gradient (rich vs. minimal checkpoint files) to test P-108b

**If H-108 falsified (no memory effect, no error recurrence)**:
- Update H-108 P(H) downward (target: 0.25)
- Record that DD-755's grid-world externalization findings do NOT transfer to language agent context injection
- Guard value is purely safety (KE-161 sufficient without H-108 extension)
- Redirect effort to H-107/EXP-151 medium bucket (difficulty threshold is the more promising line)

**If mixed results (e.g., retrospective shows effect but prospective doesn't)**:
- Design targeted follow-up (EXP-153) focusing on the arm that showed signal
- Consider that gym scenarios may not capture multi-agent pipeline dynamics (H-108's strongest prediction is about multi-agent, but EXP-152 Phase 2 is single-agent with context manipulation)

## 10. Resource Requirements

- **Lab fork creation**: ~30 minutes (3 surgical variants of coder agent)
- **Phase 0 (fork validation)**: 3 trials × $0.10 = ~$0.30
- **Phase 1 (calibration)**: 5 scenarios × 5 trials × $0.10 = ~$2.50
- **Phase 2 (main experiment)**: ~210 trials × $0.10 = ~$21
- **Phase 3 (retrospective)**: Database queries only — no gym cost
- **Phase 4 (analysis)**: 1-2 sessions
- **Total estimated cost**: ~$24
- **Total estimated time**: 2-3 days (parallelizable gym runs)

## 11. Implementation Notes

### Creating the Lab Forks

```bash
# Base: copy production coder to lab
cp -r agents/coder agents/.lab/coder-exp152-no-rbe
cp -r agents/coder agents/.lab/coder-exp152-no-path  
cp -r agents/coder agents/.lab/coder-exp152-no-verify

# Variant 1: Remove read-before-edit
rm agents/.lab/coder-exp152-no-rbe/skills/verify-after-edit.md
# Also edit context.md to remove C1.1 entry

# Variant 2: Remove path hallucination guard
# Edit context.md to remove "always ls the parent directory" entry

# Variant 3: Remove verification guard
# Edit context.md to remove "Verify with evidence, not narrative" entry
# Remove verification skill if present
```

### Running Trials

```bash
# Full Context (control)
scripts/gym-run.sh <scenario> --agent coder

# Targeted Removal (treatment)
scripts/gym-run.sh <scenario> --agent coder --lab coder-exp152-no-rbe

# Baseline Minimal (reference)  
scripts/gym-run.sh <scenario> --agent coder --lab coder-minimal-exp096
```

### Retrospective Queries

```javascript
// Example: FM-1.3 path hallucination rate before/after guard addition
import { Database } from 'bun:sqlite';
const db = new Database('.state/may.db', { readonly: true });

// Find guard addition date from git log
// Then query session failures before/after
const results = db.query(`
  SELECT 
    date(created_at) as day,
    COUNT(*) as total,
    SUM(CASE WHEN failure_mode LIKE '%FM-1.3%' THEN 1 ELSE 0 END) as path_errors
  FROM sessions
  WHERE agent = 'coder' 
    AND created_at BETWEEN ? AND ?
  GROUP BY date(created_at)
`).all(startDate, endDate);
```
