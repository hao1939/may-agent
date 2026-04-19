# EXP-187 Treatment INDEX (Discriminative Keywords)

Modified INDEX.md for Arm B. Each entry has 2-3 discriminative keywords appended.
Keywords selected by: (1) unique terms relative to neighboring entries, (2) concrete nouns/metrics preferred, (3) no keyword shared by >3 entries.

## Verified (tested with evidence)

| ID | Claim | Keywords | Location |
|----|-------|----------|----------|
| KE-001 | Context learning works for environmental knowledge only | **[context.md, env-knowledge, A/B-test]** | knowledge/entries/KE-001.md |
| KE-002 | Text rules don't fix judgment failures | **[SOUL.md, coaching, 0/32-text-rules]** | knowledge/entries/KE-002.md |
| KE-003 | Rich delegation context reduces ops by 47% | **[delegation, op-reduction, POC]** | knowledge/entries/KE-003.md |
| KE-004 | Guards are brittle, use context.md instead | **[guard-revert, brittle, context.md-preferred]** | knowledge/entries/KE-004.md |
| KE-005 | QA rubber-stamps at 14% detection | **[QA, rubber-stamp, 14%-detection]** | knowledge/entries/KE-005.md |
| KE-006 | Skills targeting reasoning patterns don't change tool-calling patterns | **[reasoning-skill, tool-call, null-result]** | knowledge/entries/KE-006.md |
| KE-007 | Workflow enforcement is the only reliable behavioral intervention | **[Method-15, workflow-enforcement, 55-experiments]** | knowledge/entries/KE-007.md |
| KE-008 | Heartbeat step restructuring causes regression | **[heartbeat, step-reorder, regression]** | knowledge/entries/KE-008.md |
| KE-009 | Negative examples in LESSONS.md have zero effect | **[LESSONS.md, negative-examples, 0/8]** | knowledge/entries/KE-009.md |
| KE-010 | Most gym scenarios hit ceiling — agents pass at baseline | **[gym-ceiling, baseline-pass, 106-scenarios]** | knowledge/entries/KE-010.md |
| KE-011 | Knowledge files are passive — agents skip them under ALL conditions | **[knowledge-files, passive, 0/29-discovery]** | knowledge/entries/KE-011.md |
| KE-012 | Lab-fork null-patch test confirms infrastructure validity | **[null-patch, lab-fork, infrastructure-test]** | knowledge/entries/KE-012.md |
| KE-013 | Task boundedness is the primary driver of delegated session quality | **[boundedness, delegation-quality, n=116]** | knowledge/entries/KE-013.md |
| KE-014 | Bash quote splitting bypasses regex security filters | **[quote-splitting, regex-bypass, path-normalization]** | knowledge/entries/KE-014-quote-splitting-bypass.md |
| KE-015 | Decision topology (eliminable ratio R) predicts workflow effectiveness | **[topology-R, eliminable-ratio, ρ=0.95]** | knowledge/entries/KE-015.md |
| KE-016 | Workflow effectiveness depends on decision type — helps 40%, hurts 40% | **[decision-type, helps-hurts-40%, 20-pairs]** | knowledge/entries/KE-016.md |
| KE-017 | Materialize-findings cadence skill improves behavior AND product quality | **[materialize-findings, +67pp, first-skill-breakthrough]** | knowledge/entries/KE-017.md |
| KE-018 | Environmental nudges (L4) match text skills (L3) for behavioral change | **[nudge-L4, skill-L3, equally-effective]** | knowledge/entries/KE-018.md |
| KE-019 | Sycophancy requires materialization gates (L5), not nudges or workflows | **[sycophancy-gate, L5, self-commitment]** | knowledge/entries/KE-019.md |
| KE-020 | Agent capability adoption requires explicit wiring, not just availability | **[adoption-hierarchy, available-0%, automatic-100%]** | knowledge/entries/KE-020.md |
| KE-021 | Skill effectiveness depends on skill type: Process > Knowledge > Judgment | **[process-skill, judgment-0/20, skill-taxonomy]** | knowledge/entries/KE-021.md |
| KE-022 | Agent errors concentrate in early exploration phase — 3.6x more frequent in first 40% | **[early-phase, 3.6x-errors, n=577-sessions]** | knowledge/entries/KE-022-early-exploration-errors.md |
| KE-023 | Read-before-edit skill deployment shows no production improvement | **[read-before-edit, production-null, 4-agents]** | knowledge/entries/KE-023-read-before-edit-deployment-ineffective.md |
| KE-024 | Separating heartbeat triage from execution eliminates overhead — 94% cost reduction | **[dispatcher-pattern, triage-separation, 94%-cost-cut]** | knowledge/entries/KE-024-dispatcher-heartbeat-pattern.md |
| KE-025 | Instruction overhead paradox: more context files hurt performance | **[instruction-overhead, attention-dilution, ETH-Zürich]** | knowledge/entries/KE-025-instruction-overhead-paradox.md |
| KE-026 | Agents cannot self-serve from reference materials — pull discovery is dead | **[pull-model, 0/30-discovery, self-serve-dead]** | knowledge/entries/KE-026-pull-model-discovery-dead.md |
| KE-028 | Technical sycophancy is the ceiling — last non-ceiling gap | **[sycophancy-ceiling, social-pressure, 4/6-persist]** | knowledge/entries/KE-028-technical-sycophancy-ceiling.md |
| KE-029 | Classify-then-act eliminates sycophancy | **[classify-then-act, two-phase, 0%→100%]** | knowledge/entries/KE-029-classify-then-act-eliminates-sycophancy.md |
| KE-030 | Skill ablation falsifies causal attribution of ceiling shifts | **[ablation, ceiling-shift, no-skills-still-pass]** | knowledge/entries/KE-030-skill-ablation-falsifies-ceiling-shift-causation.md |
| KE-031 | Forced externalization is domain-independent: +69pp across 3 failure domains | **[forced-ext, +69pp, domain-independent]** | knowledge/entries/KE-031-forced-externalization-domain-independent.md |
| KE-032 | Forced externalization works via two independent pathways (write OR read) | **[dual-pathway, write-only, read-only]** | knowledge/entries/KE-032-forced-externalization-dual-pathway.md |
| KE-033 | Forced externalization is scale-invariant | **[scale-invariant, meta-agent, harness-level]** | knowledge/entries/KE-033-forced-externalization-scale-invariant.md |
| KE-034 | Forced externalization works via "analysis activation," not content provision — wrong analysis works | **[analysis-activation, wrong-analysis, System1→System2]** | knowledge/entries/KE-034-forced-externalization-analysis-activation.md |
| KE-035 | Agents facing impossible tasks exhibit proxy-satisfying behavior | **[impossible-task, proxy-satisfying, escalation]** | knowledge/entries/KE-035-proxy-satisfying-behavior-forced-assessment.md |
| KE-036 | Behavioral tool-call patterns detect frustration independently of linguistic signals | **[frustration-detection, behavioral-signal, verification-gated]** | knowledge/entries/KE-036-behavioral-frustration-detection-verification-gated.md |
| KE-037 | The Scaffolding Spectrum — internalization and externalization are complementary endpoints | **[scaffolding-spectrum, SKILL0, complementary]** | knowledge/entries/KE-037-scaffolding-spectrum-internalization-vs-externalization.md |
| KE-038 | Constitutional meta-engineering IS forced externalization applied recursively | **[constitutional, recursive-ext, Three-Laws]** | knowledge/entries/KE-038-constitutional-bounded-self-improvement.md |
| KE-039 | Persistent agent runtimes converge on our architecture | **[Springdrift, Erlang-OTP, Artificial-Retainer]** | knowledge/entries/KE-039-persistent-runtime-convergence-artificial-retainer-taxonomy.md |
| KE-040 | Memory architecture convergence: lifelong learning requires active substrate | **[lifelong-memory, write-gating, consolidation]** | knowledge/entries/KE-040-memory-architecture-convergence-lifelong-learning-active-substrate.md |
| KE-041 | Structural constraint and stigmergic coordination as dual design primitives | **[stigmergy, causal-action-space, DD-589]** | knowledge/entries/KE-041-structural-constraint-stigmergic-coordination.md |
| KE-042 | Multi-agent dispatch convergence — typed tasks + explicit delegation | **[typed-dispatch, 5-paradigms, coordination-infrastructure]** | knowledge/entries/KE-042-dispatch-convergence-structural-coordination-infrastructure.md |
| KE-043 | Forced externalization complete empirical picture: 75+ runs, 5 domains | **[75-runs, 5-domains, analysis-activation-mechanism]** | knowledge/entries/KE-043-forced-externalization-complete-picture.md |
| KE-044 | Verification Separation Thesis: self-evolution needs separated verification | **[self-evolution, CORAL, cross-evaluation]** | knowledge/entries/KE-044-self-evolution-verification-separation-thesis.md |
| KE-045 | Multi-agent social pathology: power concentration, sycophancy cascades, collusion | **[social-pathology, power-law, AUROC-1.0-collusion]** | knowledge/entries/KE-045-multi-agent-social-pathology-emergence.md |
| KE-046 | Reasoning depth crisis: reducing thinking budget causes invisible quality collapse | **[thinking-budget, 75%-reduction, $345→$42K]** | knowledge/entries/KE-046-reasoning-depth-crisis-thinking-budget-collapse.md |
| KE-047 | Agent harness architecture convergence: same architectural decomposition | **[harness-architecture, 12-dimensions, ReAct-loop]** | knowledge/entries/KE-047-agent-harness-architecture-convergence.md |
| KE-048 | Agent safety stack: vulnerability discovery to regulatory compliance | **[safety-stack, 5-layers, Carlini-CVE]** | knowledge/entries/KE-048-agent-safety-stack-vulnerability-to-regulation.md |
| KE-049 | Agent-environment interface formalization ceiling: structure eliminates mechanical but not reasoning errors | **[formalization-ceiling, MemCoder, semantic-misuse]** | knowledge/entries/KE-049-agent-environment-interface-formalization-ceiling.md |
| KE-050 | Robustness-architecture nexus: robustness is architectural not model property | **[robustness, 30-70%-collapse, behavioral-fuzzing]** | knowledge/entries/KE-050-robustness-architecture-nexus.md |
| KE-051 | Self-governance stack: self-verification, diversity enforcement, meta-verification | **[self-governance, 3-layer, diversity-enforcement]** | knowledge/entries/KE-051-self-governance-stack.md |
| KE-052 | Structural access constraints dominate content quality | **[access>quality, ∂U/∂Access, recency-bias-85%]** | knowledge/entries/KE-052-structural-access-thesis.md |
| KE-053 | Gym-production gap is structural, not behavioral: 96% gym vs 72% production | **[gym-production-gap, 24pp, FM-3.3-behavioral]** | knowledge/entries/KE-053-gym-production-gap-structural-not-behavioral.md |
| KE-054 | Externalization has a sharp domain boundary — helps judgment, hurts debugging | **[judgment-vs-debugging, analysis-action-gap, cascading-fix]** | knowledge/entries/KE-054-externalization-boundary-judgment-vs-debugging.md |
| KE-055 | Implementation commitment (binding) — partial solution, bounded by workaround availability | **[binding, workaround-blocked, drift-vs-attraction-gap]** | knowledge/entries/KE-055-binding-closes-analysis-action-gap.md |
| KE-056 | The constraint hierarchy — workaround availability dominates | **[constraint-hierarchy, L1-L5, workaround-availability]** | knowledge/entries/KE-056-constraint-hierarchy-workaround-availability.md |
| KE-097 | Confirmation bias as root mechanism of verification confabulation | **[confirmation-bias, Wason-2-4-6, falsification-prompting]** | knowledge/entries/KE-097-confirmation-bias-mechanism-verification-confabulation.md |
| KE-101 | Meta-analysis — theory of what actually improves LLM agent performance | **[140-experiments, 5-laws, structure>content]** | knowledge/entries/KE-101-meta-analysis-theory-of-agent-improvement.md |
| KE-102 | Evidence-over-narrative skill eliminates verification confabulation | **[evidence-over-narrative, 18%→100%, skill>architecture]** | knowledge/entries/KE-102-skill-level-confabulation-fix.md |
| KE-103 | Context-stripping paradox: removing context hurts skilled agents | **[context-stripping, MARCH-paradox, orientation-cues]** | knowledge/entries/KE-103-context-stripping-paradox.md |
| KE-104 | Complete verification architecture — evidence grounding stack | **[AEGIS, PROClaim, Ground→Gate→Challenge→Audit]** | knowledge/entries/KE-104-complete-verification-architecture-evidence-grounding.md |
| KE-105 | Verification orchestration stack — compile, triage, enforce, verify | **[orchestration, Semantic-Router-DSL, DOVA-budget]** | knowledge/entries/KE-105-verification-orchestration-stack.md |
| KE-106 | Structural enforcement does NOT train behavior — guards are brakes, not lessons | **[guard-no-training, 27%→70%-attempts, permanent-infrastructure]** | knowledge/entries/KE-106-structural-enforcement-no-training-effect.md |
| KE-107 | FM-3.3 gym-production gap quantified — 10× difference | **[10×-gap, context-complexity, Wave-1-Wave-2]** | knowledge/entries/KE-107-fm33-gym-production-gap-quantified.md |
| KE-108 | Step-level credit assignment as verification cascade defense | **[T-STAR, Cognitive-Tree, step-credit]** | knowledge/entries/KE-108-step-level-credit-assignment-verification-cascade.md |
| KE-109 | Gym-production gap is structural — five dimensions, three paths forward | **[5-dimensions, D1-D5, production-observation]** | knowledge/entries/KE-109-gym-production-gap-structural-mismatch.md |
| KE-110 | Skill stack saturation — gym ceiling confirms improvement loop finished | **[saturation, 91-100%-ceiling, maintenance-mode]** | knowledge/entries/KE-110-skill-stack-saturation-gym-ceiling-confirms-improvement-loop.md |
| KE-111 | Production evaluation architecture — from gym termination to observational science | **[production-evaluation, 5-layer, trajectory-capture]** | knowledge/entries/KE-111-production-evaluation-architecture-pivot.md |
| KE-112 | Production session quality is multi-modal — verdicts lie | **[tri-modal, 73/18/9-split, binary-verdicts-misleading]** | knowledge/entries/KE-112-production-quality-multimodal-verdicts-lie.md |
| KE-113 | Commit guard production impact — recovery not prevention | **[recovery-not-prevention, +51.3pp-recovery, cascading-FM-2.x]** | knowledge/entries/KE-113-commit-guard-recovery-not-prevention.md |
| KE-114 | Production behavioral archetypes — spectrum not types | **[6-archetypes, silhouette=0.273, Silent-Failures]** | knowledge/entries/KE-114-production-behavioral-archetypes-spectrum.md |
| KE-115 | FM-heavy workers intervention priority map | **[FM-Heavy, FM-2.1-cascade, dose-response-cliff]** | knowledge/entries/KE-115-fm-heavy-workers-intervention-priority-map.md |
| KE-116 | Next-generation agent evaluation — adaptive, state-aware, length-resistant | **[adaptive-eval, horizon-degradation, DimensionAwareFilter]** | knowledge/entries/KE-116-next-gen-evaluation-architecture-adaptive-state-aware.md |
| KE-117 | Verification self-awareness stack — meta-verification, signal calibration | **[meta-verification, CAMV, isotonic-regression]** | knowledge/entries/KE-117-verification-self-awareness-stack-meta-verification-signal-calibration.md |
| KE-118 | Complete verification orchestration — all five KE-105 gaps closed | **[8-layer-stack, TrACE, SAVeR-adversarial]** | knowledge/entries/KE-118-complete-verification-orchestration-stack-ke105-gaps-closed.md |
| KE-119 | Adversarial self-review null result — review without action | **[self-review-null, review-without-action, Δ=-5.6pp]** | knowledge/entries/KE-119-adversarial-self-review-null-result-review-without-action.md |
| KE-120 | Cooperation-calibration-context triad for multi-agent systems | **[cooperation-triad, conformal-prediction, DACS-isolation]** | knowledge/entries/KE-120-cooperation-calibration-context-triad-multi-agent-structural-requirements.md |
| KE-121 | Forced externalization prevents misinterpretation, not just omission | **[anti-misinterpretation, DELIVERABLES_CHECKLIST, replace-vs-append]** | knowledge/entries/KE-121-forced-externalization-prevents-misinterpretation.md |
| KE-122 | Intervention decay — effective interventions become redundant through internalization | **[decay-lifecycle, internalization, guard-deprecation]** | knowledge/entries/KE-122-intervention-decay-internalization-lifecycle.md |
| KE-123 | Over-intervention iatrogenesis — combined interventions degrade performance | **[iatrogenesis, −12pp-combined, overcorrection]** | knowledge/entries/KE-123-over-intervention-iatrogenesis.md |
| KE-124 | Agent observability — cognitive observability is the binding constraint | **[cognitive-observability, L2-L3-gap, BHI-methodology]** | knowledge/entries/KE-124-agent-observability-production-evaluation-stack.md |
| KE-125 | Forced deliverable enumeration fails on discovery tasks under time pressure | **[enumeration-harms-discovery, −67pp, time-tax]** | knowledge/entries/KE-125-forced-enumeration-fails-discovery-tasks.md |
| KE-126 | Soft interventions cannot close the creative inference gap | **[creative-inference-gap, 5-arms-null, judgment-generation]** | knowledge/entries/KE-126-soft-interventions-creative-inference-gap.md |
| KE-127 | Error propagation lifecycle — context pollution mechanisms | **[error-propagation, 5-phase, context-pollution]** | knowledge/entries/KE-127-error-propagation-lifecycle-context-pollution-architectural-defenses.md |
| KE-128 | Phase 0 discovery — null result for structural intervention on FM-1.3 | **[Phase0-null, nav-map, exhaustive-reading]** | knowledge/entries/KE-128-phase0-discovery-structural-intervention-fm13.md |
| KE-129 | Forced externalization is the only reliable channel for judgment tasks | **[Ch2-only, p=0.0000074, action-momentum]** | knowledge/entries/KE-129-forced-externalization-only-reliable-channel-judgment.md |
| KE-130 | Text-channel content delivery fails for contradiction detection | **[text-channel-fail, 0/24, contradiction-detection]** | knowledge/entries/KE-130-text-channel-content-delivery-fails-judgment.md |
| KE-131 | Environmental hints no effect on KB discovery (replication) | **[hints-null-replication, N=24, timeout-confound]** | knowledge/entries/KE-131-environmental-hints-null-result-replication.md |
| KE-132 | Channel 3 few-shot has task-type boundary — coding momentum overwhelms | **[Ch3-boundary, coding-momentum, success-misdirection]** | knowledge/entries/KE-132-ch3-task-type-boundary-coding-momentum.md |
| KE-133 | Few-shot is actively harmful on discovery tasks — template displacement | **[few-shot-harmful, −67pp, template-displacement]** | knowledge/entries/KE-133-few-shot-harmful-discovery-template-displacement.md |
| KE-134 | Channel 2 gate stacking follows a hump curve, not a cliff | **[hump-curve, 3-gate-peak, +167s/gate]** | knowledge/entries/KE-134-channel2-gate-stacking-hump-curve.md |
| KE-135 | Gate-task synergy — performance depends on gate relevance, not count | **[gate-synergy, related-vs-unrelated, 36pp-difference]** | knowledge/entries/KE-135-gate-task-synergy-effect.md |
| KE-136 | Structural guards transfer to production — +15.8pp fleet-wide | **[production-transfer, +15.8pp, ⚠️-superseded-KE-143]** | knowledge/entries/KE-136-structural-guards-transfer-production.md |
| KE-137 | Guard response bifurcation — learners vs. reliants | **[learner-reliant, workflow-substitution, bob-58%→24%]** | knowledge/entries/KE-137-guard-response-bifurcation-learners-reliants.md |
| KE-140 | Agent read patterns — duplicate reads as primary waste | **[duplicate-reads, 37.8%-waste, INDEX-47×]** | knowledge/entries/KE-140-agent-read-patterns-duplicate-waste.md |
| KE-142 | Format tax external validation — DD-747 grounds H-103 | **[format-tax, 30.8%-degradation, UCSD]** | knowledge/entries/KE-142-format-tax-external-validation-h103.md |
| KE-143 | Guard response trifurcation — three categories, agent-specific harm | **[trifurcation, bob-harmed, guard-dependent]** | knowledge/entries/KE-143-guard-response-trifurcation-agent-specific-harm.md |
| KE-144 | Verification guards don't teach — Ch2 forces without transfer | **[guard-no-transfer, behavioral-prosthetic, dependency-escalation]** | knowledge/entries/KE-144-verification-guard-non-internalization-channel2-limits.md |
| KE-145 | 30K-agent scaling — over-provision+filter, oracle verification divide | **[30K-Meta-FAIR, oracle-verification, over-provision]** | knowledge/entries/KE-145-30k-agent-scaling-insights.md |
| KE-146 | Reasoning externalization gap — agents reason correctly without visible artifacts | **[invisible-reasoning, thinking-tokens-3×, H-104-falsified]** | knowledge/entries/KE-146.md |
| KE-155 | Externalization harm boundary — when showing work changes the work | **[harm-boundary, displaces-vs-scaffolds, unified-theory]** | knowledge/entries/KE-155-externalization-harm-boundary-unified-theory.md |
| KE-156 | Voluntary externalization paradox — agents don't externalize without forcing | **[voluntary-paradox, 0/13-unforced, format-IS-forcing]** | knowledge/entries/KE-156-voluntary-externalization-paradox.md |
| KE-157 | Literature-validated externalization tax | **[verbal-overshadowing, self-distillation, 50-90%-eliminable]** | knowledge/entries/KE-157-literature-validated-externalization-tax.md |
| KE-158 | Overhead narrative challenge — difficulty threshold reframes guard harm | **[difficulty-threshold, ~50%-baseline, overhead-conditional]** | knowledge/entries/KE-158-overhead-narrative-challenge-difficulty-threshold.md |
| KE-159 | Format toll — structured gates as task decomposition aids | **[format-toll, 52pp-compliance-gap, slower-without-format]** | knowledge/entries/KE-159-format-toll-structured-gates-as-task-decomposition-aids.md |
| KE-160 | Guard design success factors — verification-depth graduation | **[7-criteria, boundary-moment, fail-open]** | knowledge/entries/KE-160-guard-design-success-factors-verification-depth-graduation.md |
| KE-161 | Guard architecture framework — permanent linter paradigm | **[permanent-linter, 5-Laws, guard-vs-workflow-tree]** | knowledge/entries/KE-161-guard-architecture-framework-permanent-linter-paradigm.md |
| KE-162 | Bias amplification in guard chains — echo chamber dynamics | **[bias-amplification, sequential-topology, medium-difficulty-peak]** | knowledge/entries/KE-162-bias-amplification-guard-chains-echo-chamber.md |
| KE-163 | Bias amplification as mechanistic engine of H-107's medium-difficulty peak | **[H-107-mechanism, α>1-amplification, EXP-151-medium]** | knowledge/entries/KE-163-bias-amplification-difficulty-threshold-bridge.md |
| KE-170 | Skills are redundant when base model capability is at ceiling | **[skill-redundancy, ceiling-scenarios, counter-intuitive-only]** | knowledge/entries/KE-170-skill-redundancy-ceiling-effect.md |
| KE-171 | Difficulty calibration — predicting experimental signal from baseline pass rates | **[signal∝p(1-p), sweet-spot-35-70%, bimodal-scenarios]** | knowledge/entries/KE-171-difficulty-calibration.md |
