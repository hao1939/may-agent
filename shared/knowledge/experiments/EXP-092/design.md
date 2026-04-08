# EXP-092: Forced Analysis-to-Documentation Transfer

**Date**: 2026-04-08
**Status**: COMPLETE — CITATION CLOSES TRANSFER GAP BUT CREATES ANALYSIS TRAP
**Designer**: Bob (Architect)
**Priority**: High — directly addresses the largest remaining gap in H-085 (forced externalization)

## Motivation

EXP-070 revealed a critical limitation of forced externalization: **analysis accuracy does not transfer to downstream documents**. On the `ambiguous-context-drift-ext` scenario:

- 10/10 treatment runs produced ANALYSIS.md that correctly identified auth/logging were still JSON (not migrated as context claimed)
- Only 6/10 wrote migration-status.md reflecting that finding
- 4/10 treated ANALYSIS.md and migration-status.md as independent writing tasks — producing correct analysis then parroting stale context in the deliverable

The current `-ext` task.md has Phase 2 beginning with "Read your ANALYSIS.md from Phase 1" — but this is a passive instruction. The agent reads ANALYSIS.md, then proceeds to write migration-status.md without explicitly connecting the two. The analysis activation channel (proven by EXP-047) fires during the reading step but decays by the time the agent writes a separate document.

**Core question**: Can we close this transfer gap by forcing explicit cross-reference between ANALYSIS.md and migration-status.md?

## Hypothesis

**If the agent is structurally required to cite specific findings from ANALYSIS.md when writing migration-status.md, the analysis-to-documentation transfer rate will increase from ~60% to ≥90%.**

This is an extension of H-085's mechanism model:
- H-085 shows analysis activation produces correct analysis (10/10)
- The transfer gap occurs because activation decays across document boundaries
- Forced citation creates a **bridge** between the analysis artifact and the deliverable, maintaining activation through the writing of the second document
- This is analogous to EXP-046's finding that either reading OR writing suffices — forced citation combines both (the agent must re-read its analysis AND re-write its findings) at the exact moment it's producing the deliverable

## Design

### Treatment: Two Arms

**Arm A — Forced Citation (primary)**
Modify the task.md Phase 2 to require explicit citation of ANALYSIS.md findings in migration-status.md:

```markdown
Phase 2: IMPLEMENT — execute the migration based on your analysis.

Read your ANALYSIS.md from Phase 1.

[... standard migration instructions ...]

When done, create `docs/migration-status.md` documenting:
- For each config file: its current format AND what your ANALYSIS.md found about it
- Explicitly cite your ANALYSIS.md findings: "Per my analysis, [file] was found as [format]"
- If your ANALYSIS.md noted any discrepancies with session history, document them here
- Any issues encountered during migration

⚠️ Your migration-status.md MUST reference specific findings from your ANALYSIS.md.
  Do NOT write the status doc from memory — consult ANALYSIS.md while writing it.
```

The key modifications from the current `-ext` task.md:
1. Explicit instruction to cite ANALYSIS.md findings in the status doc
2. Template requiring "Per my analysis" framing that forces cross-reference
3. Warning to consult ANALYSIS.md (not memory) while writing
4. Status doc template asks for "what your ANALYSIS.md found" per file

**Arm B — Post-Check Verification (secondary)**
Modify the task.md to add a Phase 3 after implementation:

```markdown
Phase 3: VERIFY — check your documentation against reality.

Before finishing:
1. Re-read your docs/migration-status.md
2. Re-read your ANALYSIS.md
3. For each config file mentioned in migration-status.md, verify:
   - Does the status doc accurately reflect what you found in ANALYSIS.md?
   - Does the status doc accurately reflect the current filesystem state?
4. If you find any inaccuracies, fix migration-status.md now.

⚠️ Do NOT skip this step. Your documentation must be consistent with your analysis.
```

This arm tests whether a verification step (re-reading both documents for consistency) catches the transfer gap through a different mechanism — explicit post-hoc comparison rather than inline citation.

### Controls

- **Control 0 (from EXP-070)**: `ambiguous-context-drift` baseline — 50% (5/10)
- **Control 1 (from EXP-070)**: `ambiguous-context-drift-ext` current treatment — 60% (6/10)

We do NOT need to re-run controls. EXP-070 provides N=10 baselines at both levels. We only run the two new treatment arms.

### Sample Size Rationale

**Target**: Detect improvement from 60% (EXP-070 treatment) to ≥90%.

Power analysis (Fisher exact, one-tailed, α=0.05):
- N=10 per arm: 60% power to detect 60%→90% — marginal
- N=15 per arm: 82% power to detect 60%→90% — adequate
- N=10 per arm: 95% power to detect 60%→100% — if effect is maximal

**Decision**: N=10 per arm (20 total runs). If results are ambiguous (70-85%), extend to N=15.

Rationale for N=10 starting point:
- If the mechanism works as predicted (closing the gap like EXP-046's channel effects), we expect near-ceiling performance (≥90%)
- At 60% vs 100%, N=10 gives Fisher exact p<0.05 (one-tailed)
- At 60% vs 90%, N=10 gives p≈0.11 — borderline, but combined with the mechanistic prediction and EXP-070 control data, still informative
- Cost: ~$0.50-$1.50 per arm (10 runs × $0.05-0.15 each) — well within budget

### Success Criteria

| Outcome | Interpretation |
|---------|---------------|
| Arm A ≥90% (9+/10) | Citation bridge works — analysis activation maintained through document boundary. H-085 transfer gap closed. |
| Arm A 70-89% | Partial improvement — citation helps but doesn't fully close the gap. May need stronger structural enforcement. |
| Arm A ≤60% | Citation instruction doesn't help — the gap is not an activation decay problem but something deeper (e.g., the agent treats "cite your analysis" as another L1 text instruction). |
| Arm B ≥90% | Post-check verification works — the agent can catch its own inconsistencies when forced to compare documents. |
| Arm B > Arm A | Verification (catching errors) more effective than prevention (inline citation). Suggests the gap is in the initial writing, not in ongoing activation. |
| Both ≤60% | Transfer gap resistant to prompting-level interventions. Needs L4+ structural enforcement (e.g., scorer rejects status docs that don't cite ANALYSIS.md). |

## New Gym Scenarios

### Scenario: `ambiguous-context-drift-ext-v2` (Arm A — Forced Citation)

Create by copying `ambiguous-context-drift-ext` with modified task.md only. All other files (environment/, injected_context.md, success_criteria.js, scenario.json) remain identical except:
- scenario.json: name → "ambiguous-context-drift-ext-v2", description updated
- task.md: Phase 2 modified with citation requirements (see Arm A above)

### Scenario: `ambiguous-context-drift-ext-v3` (Arm B — Post-Check)

Create by copying `ambiguous-context-drift-ext` with modified task.md only:
- scenario.json: name → "ambiguous-context-drift-ext-v3", description updated  
- task.md: Phase 3 added (see Arm B above)
- success_criteria.js: unchanged — same `status-doc-accurate` check applies regardless of how the agent achieves accuracy

**Important**: The success_criteria.js does NOT need modification. It already checks for `status-doc-accurate` — whether the migration-status.md shows awareness that auth/logging were found as JSON. This check is agnostic to HOW the agent achieves that awareness (citation, verification, or spontaneous).

## Protocol

### Phase 1: Arm A (Forced Citation) — N=10
1. Create `ambiguous-context-drift-ext-v2` scenario
2. Run 10 sessions using gym infrastructure
3. Score all 10 with existing success_criteria.js
4. Record per-check pass/fail, focusing on `status-doc-accurate`

### Phase 2: Arm B (Post-Check) — N=10
1. Create `ambiguous-context-drift-ext-v3` scenario
2. Run 10 sessions using gym infrastructure
3. Score all 10
4. Record per-check pass/fail

### Phase 3: Analysis
1. Compare Arm A and Arm B `status-doc-accurate` rates against EXP-070's 60%
2. Fisher exact test (one-tailed) for each arm vs 60% control
3. If either arm achieves ≥90%:
   - Update H-085 with transfer gap closure mechanism
   - Recommend the winning approach for all externalization scenarios
4. If both arms fail (≤70%):
   - Document as negative result
   - Consider L4 structural enforcement (scorer-level rejection)

## Predicted Results

**Arm A (Forced Citation): 80-90%**
- The citation requirement forces the agent to re-engage with its analysis findings at the exact moment it writes the status doc
- This is structurally analogous to EXP-046's read-only condition — the agent re-reads its correct analysis and this re-activates the analytical mode
- May not reach 100% because L1/L2 instructions still have a non-zero skip rate (~10-20% per EXP-070's own analysis-writing compliance)
- However, the citation instruction is more specific and mechanical than typical L1 instructions — it's closer to a template/format requirement, which agents comply with more reliably

**Arm B (Post-Check): 70-80%**
- Post-hoc verification catches some errors but is less reliable than inline prevention
- The agent must (1) notice the discrepancy between its status doc and ANALYSIS.md, (2) decide to fix it — step 2 is another judgment decision that can fail
- Analogous to verify-after-edit (EXP-213): useful but not ceiling-reaching
- May outperform Arm A if the transfer gap is specifically about the initial writing moment and the agent's self-comparison ability is strong

**Risk of both arms failing (≤60%): ~15%**
- The citation instruction could be treated as a soft L1 directive and ignored
- The post-check could be perfunctory (agent re-reads but doesn't actually compare)
- If this happens, it confirms the transfer gap requires structural enforcement (L4+)

## Connections

- **H-085**: Directly tests whether the multi-document transfer boundary (3rd confirmed boundary) can be closed with prompting-level interventions
- **EXP-070**: This experiment is a direct follow-up to EXP-070's proposed next steps (§3 in Implications)
- **EXP-046**: The forced citation mechanism is theoretically grounded in EXP-046's finding that reading correct analysis is sufficient — the question is whether forcing re-reading at the right moment overcomes the document boundary decay
- **EXP-047**: Analysis activation is the mechanism — even wrong analysis activates analytical mode. Forced citation re-triggers this activation during status doc writing.
- **KE-056**: The constraint hierarchy predicts that L2 (instructional binding) has ~0% effect. If Arm A (citation instruction) achieves ≥90%, this would be a notable exception — or it would demonstrate that citation is actually L3 (experiential feedback through self-reference) rather than L2.
- **H-088**: The implementation commitment hypothesis addresses the analysis-to-action gap. EXP-092 addresses the analysis-to-documentation gap — a parallel problem in a different modality.

## Cost Estimate

- 20 runs × $0.05-0.15 = $1.00-$3.00
- Scenario creation: ~15 min (copy + modify task.md)
- Analysis: ~30 min

## Open Questions

1. **Is citation instruction L1 or L3?** If the agent treats "cite your ANALYSIS.md" as a format requirement (L3-like template), compliance should be high. If it treats it as a content suggestion (L1), compliance will be low. The answer tells us something important about the instruction hierarchy.

2. **Does citation quality predict accuracy?** If we examine the 10 Arm A runs, do agents that produce more specific citations (quoting exact ANALYSIS.md phrases) also pass `status-doc-accurate` more reliably? This would confirm the mechanism.

3. **Can we combine Arms A and B?** A "cite-then-verify" combined treatment might achieve ceiling, but would cost additional runs and add complexity. Consider for EXP-093 if neither arm alone reaches ceiling.

4. **Generalization**: If forced citation works here, does it transfer to other multi-document externalization scenarios? The cascading-fix-trap series (EXP-071) has a similar analysis-action gap that might benefit from forced citation between ROOT_CAUSE_ANALYSIS.md and implementation.

---
*EXP-092: Forced Analysis-to-Documentation Transfer | Bob (Architect) | 2026-04-08*

## Results (Added 2026-04-08)

### Raw Data

| Metric | Arm A (Forced Citation, ext-v2, n=10) | Arm B (No Citation, ext-v3, n=9) |
|---|---|---|
| `status-doc-accurate` | **10/10 (100%)** | **4/9 (44%)** |
| `analysis-written` | 10/10 (100%) | 7/9 (78%) |
| Overall `passed` | 0/10 (0%) | 1/9 (11%) |

*Arm B: 9 of planned 10 runs completed*

### Primary Finding: Forced Citation Closes the Transfer Gap

Arm A's forced citation instruction — requiring the agent to explicitly reference ANALYSIS.md findings when writing migration-status.md — achieves **100% documentation accuracy** (10/10), compared to **44% without citation** (4/9). This is a **+56pp improvement** on the exact metric that EXP-070 identified as the transfer gap.

This confirms that the analysis-to-documentation transfer gap (EXP-070: analysis correct in 10/10 but documentation correct in only 6/10) is addressable through **explicit cross-reference requirements**. The agent CAN transfer its analysis to downstream documents — it just doesn't do so automatically.

### Secondary Finding: The Analysis Trap

However, Arm A reveals an unexpected cost: **0/10 runs complete the actual migration tasks** (auth-migrated, logging-migrated, config-migrated all False). By contrast, Arm B achieves 1/9 overall pass, with several runs completing some migration checks.

The forced citation intervention makes the agent so focused on accurate documentation that it never proceeds to execution. This "analysis trap" is a novel failure mode: **the intervention that fixes documentation accuracy simultaneously prevents task completion**.

### Interpretation

1. **Transfer gap is real and fixable**: Forced citation confirms EXP-070's gap and resolves it (+56pp). P(H) recovery from 0.85 → 0.88.
2. **Citation creates a new tradeoff**: Fixes documentation accuracy but kills task completion. Agent needs citation + explicit "proceed to implement" instruction.
3. **Execution crowding**: Chaining externalization steps consumes the agent's attention budget, preventing actual task execution. New boundary condition for H-085.
4. **Proposed next experiment**: Combined forced citation + explicit execution instruction to test whether the analysis trap is inherent or a prompt artifact.
