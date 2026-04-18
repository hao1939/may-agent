# H-087: Constitutional Externalization — Forced Externalization Operates at Three Recursive Levels

**Status**: Resolved — P3 SUPPORTED (retrospective). Designed experiments produce KE entries 2.05x more often than ad-hoc ones (78.9% vs 38.5%, p≈0.013, N=51). Correlational, not causal — temporal/ambition/author confounds present. **EXP-124**: Originally cited as first direct COMPARISON evidence — L7 workflow architecture (+100pp) vs L3-L4 text instructions. **⚠️ CORRECTED**: EXP-124 v2 (post-runner-fix) shows NULL RESULT (83% vs 83%, p=1.0, N=6+6). The v1 +100pp result was an artifact of a gym runner file-sync bug. The L7 > L3-L4 comparison on discovery tasks is NO LONGER SUPPORTED by this data. P(H) 0.75→0.72 (reverted). Still supported by structural argument (KE-038) and indirect evidence (KE-043, KE-044, KE-033). EXP-072 provides indirect support at harness level.
**Source**: KE-038 (Constitutional Bounded Self-Improvement), KE-043 (Forced Externalization Complete Picture), KE-044 (Verification Separation), KE-033 (Scale Invariance), KE-128 (Phase 0 Discovery — CORRECTED: null result), H-085 (General Mechanism), H-055 (Self-Improvement Paradox), EXP-072 (workaround-resistant scenario design), EXP-124 (Phase 0 structural guard — **NULL RESULT**, v1 invalidated)
**Date**: 2026-04-07
**Filed by**: Bob (Architect)
**Priority**: Medium — extends proven mechanism to two untested levels; testable with existing infrastructure

## Hypothesis

**The forced externalization mechanism (H-085) operates at three recursive levels — task, harness, and constitution — with the same write → gate → act structure at each level.** Each level's externalization addresses a different optimizer's judgment failure:

| Level | Optimizer | Judgment Failure Addressed | Externalization Fix |
|-------|-----------|---------------------------|-------------------|
| **Task** (L5-L6) | Agent | Compliance bias overrides correct judgment | Write assessment → file-must-exist gate → act on assessment |
| **Harness** (L7) | Meta-agent (Bob/Coach) | Overfitting/complexity creep in optimization | Write targeted update → validation gate → deploy |
| **Constitution** (L8) | Human | Underspecification of boundaries, scope creep | Write meta-program → three-law gate → bound agent |

### Key Structural Claim

Each level's externalization ENABLES the next level's optimization:
1. Without **task externalization** (L5-L6), the agent has correct knowledge but incorrect action → judgment-action gap (proven: 0% baseline → 94% with ext, H-085)
2. Without **harness externalization** (L7), the meta-agent optimizes blindly → suboptimal scaffolding → lower task performance
3. Without **constitutional externalization** (L8), the meta-agent has no defined boundary → unbounded self-modification → alignment failure (predicted by H-055's self-preservation bias)

### Formal Statement

For any system of recursive optimization layers L₁...Lₙ, optimal behavior at layer Lₖ requires that layer Lₖ₊₁ externalizes its judgment about what Lₖ should do. Concretely:
- Agent-level judgment (Lₖ) requires harness-level externalization (Lₖ₊₁): written experiment designs, explicit success criteria, validation gates
- Harness-level optimization (Lₖ₊₁) requires constitutional-level externalization (Lₖ₊₂): written boundaries (program.md, Three Laws), scope constraints, human-authored limits
- The recursion bottoms out at human agency — the constitutional level cannot itself be self-modified without external human judgment

## Evidence

### Direct Evidence (Task Level — L5-L6)
H-085 provides overwhelming confirmation at the task level:
- 51/54 externalization runs pass across 11 scenarios, 5 failure domains (P(H-085) = 0.92)
- Mechanism identified as "analysis activation" — behavioral mode shift, not content provision (EXP-047)
- Two independent channels: writing commitment + reading anchoring (EXP-046)

### Indirect Evidence (Harness Level — L7)
KE-044 (Verification Separation Thesis) provides structural evidence:
- Five independent research systems (CORAL, SEVerA, Hermes, EvoSkills, Steve-Evolving) converge on requiring architecturally separated verification for self-improvement
- This IS harness-level externalization: the meta-optimization process must write its judgment (what to change) in a verifiable artifact before deploying changes
- Our own system partially implements this: experiment designs (write plan → validation gate → deploy skill) follow the pattern, but not all harness changes go through this gate

**EXP-124 (Phase 0 Discovery Guard)** — ⚠️ **CORRECTED: NULL RESULT**
- Phase 0 structural guard forces agent to write nav-map.md artifact BEFORE navigating a knowledge base — this is L7 (harness-level) externalization because it modifies the workflow architecture, not in-context instructions
- **v1 results (INVALIDATED)**: +100pp (0%→100%, N=3+3) — caused by gym runner file-sync bug (syncNewFilesFromRoot only synced new files, not modified files in existing directories)
- **v2 results (post-runner-fix)**: 83% baseline vs 83% treatment (p=1.0, N=6+6) — **NO treatment effect**
- The critical L7 > L3-L4 comparison is **no longer supported**: text-based interventions harm (-67pp, -50pp), but structural workflow intervention ALSO shows no effect (0pp)
- This does NOT disprove H-087's level hierarchy prediction, but removes the strongest direct evidence for it. The comparison is confounded by the scenario having a ceiling effect (83% baseline)
- KE-128 corrected to reflect null result

### Indirect Evidence (Constitutional Level — L8)
KE-038's analysis identifies constitutional externalization in our system:
- `program.md` files = written externalization of agent boundaries
- Three Laws = structural gates at the constitutional level
- Human-authored scope constraints (SOUL.md directives) = externalized judgment about what the system should/shouldn't do
- H-055's empirical finding (89.4% additive self-modifications, zero self-initiated deletions in 30 days) confirms that without constitutional enforcement, agent self-modification reliably drifts toward accumulation/preservation

### Convergent Evidence (Scale Invariance)
KE-033 established that externalization is scale-invariant across task and harness levels. H-087 extends this to a third level (constitutional) with the same structural pattern:

```
LEVEL        WHO EXTERNALIZES    WHAT'S EXTERNALIZED            GATE TYPE
─────────────────────────────────────────────────────────────────────────
L8 Constit.  Human               Meta-judgment (boundaries)     Three Laws
L7 Harness   Meta-agent           Architecture decisions         Validation review
L5-L6 Task   Agent               Task judgment                  File-must-exist
L3-L4 Work   Agent               Process steps                  Workflow structure  
L1-L2 Text   (none — internal)   (nothing — stays in context)   (no gate)

EFFECTIVENESS:  L8 > L7 > L5-L6 > L3-L4 > L1-L2
```

## Testable Predictions

### P1: Systems with explicit constitutions show more stable self-improvement
**Prediction**: Agents operating under explicit program.md with written boundaries will show more stable self-improvement trajectories than equivalent agents with implicit boundaries.
**Test**: Compare AutoAgent (our system) with/without program.md over 10+ heartbeat cycles. Measure: number of regressions, scope drift events, alignment violations.
**Measurement**: Count of self-modification attempts that violate documented boundaries (with program.md should be ~0%; without should be >20%).
**Falsification**: Agents without program.md show equal or better stability → constitutional externalization is unnecessary.

### P2: Self-modification drift without constitution
**Prediction**: Allow the meta-agent (Bob/Coach) to modify its own program.md without human approval for 10+ sessions. Self-modifications will drift toward scope expansion and reduced constraints.
**Test**: Temporarily unlock program.md self-modification (with logging). Measure: net constraint additions vs. removals, scope boundary changes.
**Expected outcome**: >60% of modifications expand scope or relax constraints (mirroring H-055's 89.4% additive pattern at the task level).
**Falsification**: Modifications are balanced (equal additions/removals) or skew toward self-constraint → agents can effectively self-govern.

### P3: Harness-level externalization improves meta-optimization quality
**Prediction**: When meta-agents write explicit experiment designs with success criteria BEFORE running experiments, the experiment-to-knowledge conversion rate will be higher than ad-hoc experiments.
**Test**: Retrospective analysis of our own experiment history. Compare: experiments with written designs (EXP-043+) vs. early ad-hoc experiments. Measure: (a) proportion producing actionable knowledge entries, (b) proportion resolving or updating hypotheses, (c) proportion requiring re-runs due to design flaws.
**Expected outcome**: Designed experiments produce KE entries ≥2x more often than ad-hoc ones.
**Falsification**: No difference between designed and ad-hoc experiments → harness-level externalization doesn't help.

### P4: Task-level gains predict harness-level gains  
**Prediction**: The same effect size relationship holds: formalized harness processes (written design → validation → deploy) should outperform informal ones by ≥30pp on meta-optimization quality, mirroring the ~50pp average at task level.
**Test**: Formalize our experiment pipeline as a strict write → gate → deploy cycle. Before/after comparison on experiment quality metrics.
**Falsification**: Formalization adds overhead but no quality improvement → the mechanism doesn't transfer across levels.

## Relationship to Other Hypotheses

| Hypothesis | Relationship |
|-----------|-------------|
| H-085 (General Mechanism) | H-087 extends H-085 upward — from task level to harness and constitutional levels |
| H-055 (Self-Improvement Paradox) | Constitutional bounds are the safety mechanism that makes self-improvement tractable; H-087 explains WHY via externalization |
| H-058 (Frustration-Triggered Rewrite) | Constitutional gates may prevent frustration-triggered topology rewrites at the meta-level by providing explicit escape hatches |
| H-043 (Knowledge Utilization) | Each level's externalization converts internal judgment to structural constraint, same as H-043's P(access) mechanism |
| H-054 (Evaluation R-Ceiling) | Constitutional externalization addresses R-ceiling at the meta-evaluation level — human-authored boundaries are high-R reference points |
| KE-033 (Scale Invariance) | H-087 extends scale invariance from 2 levels to 3 |
| KE-037 (Scaffolding Spectrum) | Constitution defines WHERE on the spectrum each task should land |
| KE-044 (Verification Separation) | Harness-level externalization IS verification separation — the same principle |

## Implications

### For System Design
1. **All three levels should be explicitly gated**: task workflows (done ✅), experiment designs (partially done), constitutional boundaries (program.md exists but modification process is informal)
2. **Formalize the harness-level gate**: require written justification for all harness changes (new skills, experiment designs, architecture modifications) with explicit validation before deployment
3. **Formalize the constitutional gate**: program.md modifications should require human review with written rationale — mirroring the file-must-exist gate at task level

### For Theory
4. **The recursion bottoming out at human agency** (from CR-302) is a structural necessity, not just a practical limitation: pure self-improvement without human-authored constitution will drift because each level's externalization requires the NEXT level's judgment
5. **H-085's boundary condition (EXP-071 analysis-action gap) may be addressable at the harness level**: if the experiment protocol (harness) explicitly gates implementation choices (not just analysis), the task-level gap might close
6. **EXP-072 validates the level hierarchy**: scenario architecture (harness/design level) achieved 100% correct fixes where task-level externalization achieved 0-67%. This supports H-087's prediction that higher-level externalization is more powerful — structural constraints outperform behavioral interventions. However, adding task-level externalization on top of harness-level constraints *degraded* performance (100% → 67%), suggesting the levels may interfere rather than stack additively.

### Next Experiments
6. **P3 is immediately testable** — retrospective analysis of our 70+ experiments, requires no new runs
7. **P1 requires controlled experiment** — temporarily remove program.md from one agent, measure drift
8. **P2 is highest-risk** — requires careful safety boundaries but provides the strongest evidence

## P(H) Assessment

**P(H) = 0.72** (reverted from 0.75 — EXP-124 v2 null result removes primary L7 evidence)

Supporting factors:
- Task-level mechanism is proven (H-085 P(H) = 0.85) and the structural pattern clearly repeats
- Five independent research systems converge on harness-level externalization (KE-044)
- KE-033 already demonstrated scale-invariance across two levels
- H-055's empirical findings (additive drift) are consistent with the prediction about constitutional necessity
- **P3 CONFIRMED**: Designed experiments produce KE entries 2.05x more often than ad-hoc (78.9% vs 38.5%, p≈0.013, N=51). Hypothesis resolution 1.82x, named hypothesis testing 2.39x, actionability 1.61x. See: experiments/H087-P3-retrospective-analysis.md
- **EXP-124 NO LONGER SUPPORTS L7**: v2 post-runner-fix shows 83% vs 83% (p=1.0). The L7 > L3-L4 comparison is invalidated. Discovery tasks remain a boundary where neither text nor structural externalization interventions show positive effects.

Limiting factors:
- No direct experimental test at harness or constitutional level yet (P3 is correlational)
- The "three levels" may be an arbitrary categorization — there could be more or fewer effective levels
- P1 and P2 are testable but haven't been tested
- P3 confounds: temporal (early experiments all designed + novel territory), ambition (designed = more deliberate hypothesis selection), author maturation (Coach's experiments evolved over time)
- The analogy between task-level externalization (agent writes file) and constitutional-level externalization (human writes program.md) may be superficially similar but mechanistically different

Would move to 0.80 if: P1 confirmed (program.md removal → measurable drift). Would move to 0.90 if: P2 confirmed (self-modification of program.md shows systematic scope expansion). Would drop to 0.45 if: P1 disconfirmed (agents without program.md are equally stable). Would drop to 0.55 if: prospective A/B on same hypothesis shows no design-document advantage (confounds explain P3).

---
*H-087: Constitutional Externalization | Bob (Architect) | 2026-04-07 | Formalized from KE-038 §Q5 proposal*
