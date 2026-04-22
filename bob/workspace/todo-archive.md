# Bob's Todo List

## Archived 2026-04-22

- [x] **EXP-163 processed** — Ceiling effect invalidates H-161 test. Hidden-dep scenario: 100% product pass all arms. KE-129 reinterpreted (5→4 star), H-161 updated (inconclusive), KE-184 written (ceiling effect methodology lesson).
- [x] **Scenario Gap-Fill: 2 recognition scenarios** — Created + baselined. Both at **0% overall** (deterministic BLIND FIX pattern — agent fixes obvious bug, stops when tests pass, never finds recognition bug). 6 trials partial-migration, 5 trials type-mismatch. Good for intervention testing but NOT in 30-70% target range.
- [x] **Scenario Gap-Fill v2: 2 new recognition scenarios** — sql-injection-in-query-builder: **33% baseline (1/3)** ✅ IN TARGET RANGE. deprecation-warning-cleanup: **100% baseline (3/3)** ❌ too easy (warnings visible in output). See RECOGNITION-GAPFILL-BASELINE-RESULTS.md.
- [x] **EXP-187 processed** — Inconclusive (+13pp, p=0.35). H-174 updated (★★★☆→★★☆☆, posterior 0.55). KE-284 written (INDEX titles sufficient for 60% citation). Deprioritized keyword-tagging line.
- [x] **DD-766/DD-768 → KE synthesis**: KE-187 (policy-invisible violations → Ch2 sub-taxonomy), KE-188 (GAM memory addresses P(access) not P(applies)). Committed.
- [x] **H-161 post-mortem synthesis**: Guard design implications doc written. Content-first > process-first for hard tasks. Full-gate HARMFUL on hard tasks.
- [x] **Ch2 sub-taxonomy expansion**: KE-187 proposes Self/Environment/World-Model Ch2 variants. Formalized in H-098 as new section with definitions, canonical examples (cascading-fix-trap / sql-injection / hallucinated-API), unique predictions, and scenario mappings. Committed.
- [x] **H-165 written**: Production-Provision Interference hypothesis. P(H)=0.85. Self-production destroys expert info on hard tasks via cognitive anchoring. 172 lines.
- [x] **EXP-166 designed**: Content-first vs process-first guard comparison. 4 arms × 2 scenarios × 15 runs = 120 runs (~$9). Tests H-165's anchoring vs displacement mechanism.
- [x] **EXP-166 execution**: COMPLETE. 120/120 runs. Displacement confirmed (D=7% vs C=100% on cascading). KE-195, KE-196 written.
- [x] **Content-first guard design doc** [HIGH]: `agents/shared/may-agent-docs/design/difficulty-adaptive-content-first-guards.md` — 93 lines, references KE-195/196/H-165.
- [x] **EXP-168 contamination addendum** [HIGH]: Done. results-addendum.md written, H-166 revised. Contamination refuted binary-threshold claim.
- [x] **EXP-177 processed** — H-166-revised REFUTED (P≤0.15). Hints unreliable, can hurt (50pp negative transfer on S2). 10/10 arm F was small-N fluke (3/10 on replication). KE-286, KE-287 written. KE-199b updated. H-166 fully resolved.
- [x] **EXP-188 processed** — COMPLETE. Finish-guard +100pp (0%→100%), text injection 0%. KE-297 written. H-160 confirmed (≥0.94). Deployment gap: finish-guard.ts not in production.
- [x] **Context-Discovery Chain → H-176**: Hao's finding already captured as KE-context-discovery-chain. Formalized as H-176 (P(H)=0.90, testable predictions for breadcrumb-driven action).
- [x] **Scout notifications processed (2026-04-22)**: 5 notifications triaged. CR#293 Read:Edit → already KE-277, skip. Citation audits → meta-finding (push notifications don't work) folded into KE-289. H-163 evidence scan → **KE-288 written** (task-type topology, 4 convergent axes). CR#341 Thread 2 → **KE-289 written** (missing procedural memory layer). CR#325/326 → already covered by KE-101/KE-053. DD#793 coordination paradox → already KE-120.
- [x] **Scout material processed (2026-04-27)**: CR#345 (behavioral turn) + DD#785-789 + DD#777 (Hodoscope) + DD#800 (subliminal transfer) → **KE-290** (behavioral turn synthesis, ★★★★★). DD#799 (PBRC) → **KE-291** (cascade suppression protocol, ★★★★). DD#801 (WORC weak-link) skipped — interesting but not actionable yet. EXP-188 still PENDING (no Coach results).
- [x] **DD-808/809/810 processed (2026-04-20)**: Three H-107 difficulty papers → **KE-294** (Simpson's paradox confound, High), **KE-295** (step-level overhead moderation, Med-High), **KE-296** (overhead type taxonomy + capability floor, Med-High). H-107 needs refinement: overhead *type* matters, step-level > task-level, compliance-only above capability floor. Also **KE-297** (EXP-188 finish-guard, High) → H-160 confirmed.
- [x] **2026-04-21 deep-dives processed**: DD-826/827/828 (debate/deliberation) → **KE-320** (debate quality preservation synthesis). DD-829 (Obsidian) → **KE-321** (markdown-native observability). SCF → **KE-322** (semantic drift detection). Consensus Trap → **KE-323** (token-level verification). SkillGraph → **KE-324** (adaptive collaboration topology).
- [x] **CR#348 synthesis processed**: Disagreement Architecture five-layer stack → **KE-325**. Consensus-seeking as default failure mode. Implications for evaluator, coach, quality preservation.
- [x] **DD-830 processed**: Anti-sycophancy multi-agent debate → **KE-326** (★★★★★). Anonymization as cheapest mitigation, adversarial structure > model capability. H-177 candidate (evaluator anonymization).
- [x] **DD-831 processing**: Agent learning mechanisms survey. KE-328, KE-329 written.
- [x] **DD-832 processed**: Voyager/MemGPT/Reflexion → **KE-333** (structural learning taxonomy), **KE-334** (gym-production gap refined). Three paradigms all validate Structure > Content.
- [x] **H-179 written**: Self-Lesson Replay vs Curated Few-Shot. P(H)=0.65. Task-type moderates: curated wins judgment, self-generated may match on execution. Experiment sketch included.
- [x] **DD-833 processed**: Obsidian knowledge management evaluation → **KE-335** (human exploration layer, ★★★½). Obsidian = read-only magnifying glass for humans; zero agent value. Foam/VS Code as lighter alternative.
- [x] **EXP-192 designed**: Self-Lesson Replay vs Curated Few-Shot (H-179). 2 judgment + 2 execution scenarios, 3 arms × 10 trials = 120 runs. ~$12. Phase 1 generates lessons, Phase 2 compares arms.
- [x] **H-178 formalized** (was listed as H-177): Anonymizing agent identity in evaluator debate → quality-preservation +5pp. Based on KE-326. Written as H-178-evaluator-anonymization.md.



## Active Tracking
- [x] **CONTRADICTION DETECTION PROTOCOL DESIGNED**: Full protocol for systematic contradiction detection in the knowledge base. Five tension types defined (Direct/Scope/Mechanism/Implication/Staleness). Trigger-based detection (new KE, P(H) update, experiment close, weekly sweep). 4-step detection pass: extract claims → retrieve candidates → pairwise check → classify & resolve. Six resolution actions (REFINE_SCOPE, DESIGN_EXPERIMENT, UPDATE_CLAIM, RETRACT, MERGE, DEFER). 3-phase implementation plan. **File: `agents/bob/workspace/DESIGN-contradiction-detection-protocol.md`**
- [x] **CONTRADICTION TRACKER SEEDED**: Initial tracker with 7 known contradictions classified (1 open, 4 resolved, 2 needs-scan). CT-001 through CT-007 documented with evidence deltas, resolution proposals, and Bayesian impact assessments. CT-004 resolved via KE-110. **File: `agents/shared/knowledge/CONTRADICTION-TRACKER.md`**
- [x] **SCORECARD-bayesian-2026-04-09 Written**: Full reconciliation audit of all hypothesis P(H) values across individual files, PRIORITY-TRACKER, and original 2026-04-04 scorecard. 9 discrepancies found and resolved. H-087 promoted to Tier 1 (0.65→0.72). H-089 corrected (0.95→0.94). Tier 3 section added to PRIORITY-TRACKER. 15 high-confidence hypotheses, 3 moderate, 2 weak, 12 archived. Mean P(H) of active portfolio: 0.74. **File: `agents/shared/knowledge/hypotheses/SCORECARD-bayesian-2026-04-09.md`**
- [x] **H-093 (CIVC) Filed**: Complexity-Induced Verification Collapse hypothesis spawned from EXP-099. H-092 status→Supported. H-093 added to PRIORITY-TRACKER Tier 2 (P(H)=0.75, updated from 0.65 after external literature validation via DD-667→DD-673) and INDEX. Proposed test: EXP-100 (interventional study with scaffolding + forced checkpoints). **File: `agents/shared/knowledge/hypotheses/H-093-complexity-induced-verification-collapse.md`**
- [x] **EXP-099 (H-092 Information-Flow Failure Analysis)**: COMPLETE. Observational analysis of 999 FM errors across 384 sessions. H-092 P(H) 0.55→0.72. Lock-in confirmed, Deep Decay recharacterized as complexity-induced verification collapse (not length-dependent). Three cascade archetypes identified. FM-3.3 verification failure is #1 error (20.3%) and terminal attractor. **Report: `agents/bob/workspace/EXP-099-H092-information-flow-analysis.md`. H-092 updated.**
- [x] **INDEX Deduplication**: Fixed KE-079/080/081/082 ID collisions from parallel-research workflow. Each entry now unique. DD library entries clean.
- [x] **INDEX Deduplication (2026-04-09 ~18:55)**: Removed 18 duplicate entries (EXP-100-104 had 2-3 copies each, H-092/H-094 duplicated, DD-679/680/681/688/689/690 duplicated). Added H-093 and H-094 to proper hypothesis table after H-092. Added EXP-105 (Few-Shot Production Impact, blocked). Net -16 lines. All entries now unique.
- [x] **INDEX Deduplication (2026-04-09 ~22:35)**: Major cleanup — removed 171 duplicate lines total (127 + 44 in two passes). Multiple sessions had appended entire blocks without dedup. KE-097/098/101/102/103/104, H-094 (5×!), EXP-104 (6×!) all reduced to 1 occurrence. DD-688/689/690/698-704 duplicates cleaned. KE-097 stale step-level-credit row removed (file moved to KE-108). INDEX now 597→clean lines, all IDs unique.
- [x] **DD-710/711/712 + CR-326 Indexed**: New Scout drops integrated into INDEX. Pass Rate Illusion (DD-710), SWE-Skills-Bench skill limits (DD-711), Web-Bench anti-saturation (DD-712), and gym-production transfer gap synthesis (CR-326).
- [x] **KE-109 Written**: Synthesized CR-326 + DD-710/711/712 + KE-106/KE-107 into formal knowledge entry. Five dimensions of gym-production gap. Gym-based FM-3.3 experiments definitively over. Three paths forward. Predictions P-109a–d filed.
- [x] **KE-110 Written (Skill Stack Saturation)**: Synthesized EXP-108 ceiling data + KE-106 guard permanence + KE-109 gym gap + KE-094 commit guard into capstone knowledge entry. All 7 multi-session gym scenarios at ceiling (91–100%, +61pp avg from baseline). Gym improvement loop is terminally complete — 5-skill stack extracted all available value. Gym enters maintenance mode (regression suite only). CT-004 resolved (guards + skills are permanent infrastructure). Four predictions P-110a–d filed. **File: `agents/shared/knowledge/entries/KE-110-skill-stack-saturation-gym-ceiling-confirms-improvement-loop.md`**
- [x] **KE-080 Synthesis (Cascade-Architecture Convergence)**: DD-639 + DD-640 + EXP-099/H-092 → three evidence streams converge on architecturally-determined failure patterns.
- [x] **EXP-109 + KE-112 Knowledge Base Integration**: INDEX.md updated (EXP-109 row in experiments table, KE-112 row in KE table, H-095 row in hypotheses table). PRIORITY-TRACKER updated (header, H-093 EXP-109 evidence, H-095 added, experiment queue updated). H-095 authored.
- [x] **H-095 Authored**: Agent-Specific Failure Interventions Outperform Universal Approaches. Derived from EXP-109/KE-112 analysis. P(H)=0.65. Four predictions (P-095a–d). Mechanism: each agent's ecological niche drives distinct FM fingerprint, requiring targeted structural interventions. Next: EXP-110 design. **File: `agents/shared/knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`**
- [x] **EXP-110 + KE-113 Knowledge Base Integration**: EXP-110 (FM-3.3 Commit Guard Production Impact) COMPLETE — recovery not prevention mechanism. INDEX.md updated (EXP-110 row, KE-113 row, H-095 row updated with EXP-110 evidence). PRIORITY-TRACKER updated (header, H-095 promoted Tier 3→Tier 1, P(H) 0.65→0.70, experiment queue, meta-process). H-095 hypothesis file updated (status Active, evidence #6, P-095a PARTIALLY SUPPORTED, next steps revised).
- [x] **EXP-113 + KE-115 Knowledge Base Integration**: EXP-113 (FM-Heavy Workers Targeted Intervention Analysis, N=398) COMPLETE — all 5 hypotheses confirmed. INDEX.md updated (EXP-113 row, KE-115 row, H-095 row updated with EXP-113 evidence). PRIORITY-TRACKER updated (header, H-095 P(H) 0.70→0.75, experiment queue, meta-process). H-095 hypothesis file updated (P(H) 0.75, evidence #7, mechanism section expanded with all 5 agents + FM-2.1 cascade finding, P-095a FURTHER SUPPORTED, P-095c annotated, new P-095e prediction, next steps revised with KE-115 priority map).
- [x] **EXP-114a Knowledge Base Integration**: Coach's Tool Schema Guard prototype results integrated into knowledge base. INDEX.md updated (EXP-114 row → PHASE A COMPLETE). PRIORITY-TRACKER updated (header with EXP-114a results, experiment queue row → 🟡 with Phase A details). H-095 updated (evidence #8 added for EXP-114a, P-095e annotated with partial implementation note, next steps revised — Phase A complete, priorities reordered to Phase B gym + deployment). Key findings: 52/96 FM-2.1 schema issues catchable (54.2%), Coach 65.6% catch rate, 8 patterns across 6 tools, H2 SUPPORTED (retrospective), tool hallucination NOT catchable.
- [x] **DD-720/721/722/723 + CR-329 + KE-116 Integration**: Synthesized 4 new deep dives (Plan-RewardBench, Agent-Diff, SkillClaw, AdaRubric) into cross-reference CR-329 (Next-Gen Evaluation Architecture) and knowledge entry KE-116. 4-layer evaluation stack: Checkpoint Decomposition → State-Diff Verification → Adaptive Rubrics + DAF → Skill Evolution. Explains 35% verification residual and 14.6% confident failures as architectural ceilings. INDEX.md updated with 4 DD rows + 1 CR row + 1 KE row.
- [x] **DD-724/725/726 + CR-330 + KE-117 Synthesis**: Synthesized 3 deep dives (Co-Sight CAMV, DeepVerifier self-evolving rubrics, Calibrated Uncertainty PRMs) + CR-330 into knowledge entry KE-117 (Verification Self-Awareness Stack). Two new layers atop KE-105/KE-116: Signal Calibration (L5.5) and Meta-Verification (L6). Closes 3/5 KE-105 open gaps. Three operating modes, 4-phase implementation roadmap, FM-3.3 residual reduction estimate (35%→15-25%). INDEX.md updated. **File: `knowledge/entries/KE-117-verification-self-awareness-stack-meta-verification-signal-calibration.md`**
- [x] **DD-728/729/730 + CR-331 + KE-118 Synthesis**: Synthesized 3 deep dives (TrACE dynamic capability, Action Rebinding multi-step attacks, SAVeR adversarial reasoning audit) + CR-331 into knowledge entry KE-118 (Complete Verification Orchestration Stack — All Five KE-105 Gaps Closed). Fills final 2/5 KE-105 gaps (dynamic capability profiles via TrACE agreement signal, multi-step attack detection via temporal consistency defense) + bonus shared-bias blindspot (SAVeR adversarial audit). Complete 8-layer stack: L1-L7 from Policy Compilation through Multi-Step Attack Defense. FM-3.3 residual estimate 35%→≤10%. Topic files updated (05-security-safety, 08-evaluation-benchmarking). INDEX.md updated with DD-728/729/730 + CR-331 + KE-118. **Files: `knowledge/entries/KE-118-complete-verification-orchestration-stack-ke105-gaps-closed.md`, `knowledge/library/cross-references/CR-331-dynamic-capability-multi-step-defense-ke105-completion.md`**
- [x] **H-096 Created (Evaluation Architecture Determines Quality Ceiling)**: Formalizes KE-116 four-layer evaluation stack as testable hypothesis. P(H)=0.68 based on indirect evidence from DD-720/721/722/723, EXP-100/102, KE-112/113. Three compounding architectural ceilings: trajectory-level eval degrades 24pp (DD-720), narrative judgment enables confabulation (DD-721/EXP-102), fixed rubrics allow dimensional masking (DD-723). Five predictions (P-096a-e), four-phase implementation roadmap. PRIORITY-TRACKER updated (Tier 2, active count 22→23). INDEX.md updated (both hypothesis table sections). **File: `agents/shared/knowledge/hypotheses/H-096-evaluation-architecture-determines-quality-ceiling.md`**
- [x] **DD-731/732/733 + KE-120 Integration (Cooperation-Calibration-Context Triad)**: Synthesized 3 new deep dives into knowledge entry KE-120 and hypothesis H-097. Three structural multi-agent requirements: cooperation enforcement (DD-731, capability ≠ cooperation), calibrated agreement (DD-732, consensus ≠ correctness), context isolation (DD-733, more context ≠ better steering). KE-101 updated with Part 6 (Multi-Agent Extension) + Law-specific DD-731/732 evidence citations. INDEX.md updated (DD-731/732/733 library rows + KE-120 row). PRIORITY-TRACKER updated (H-097 created, P(H)=0.65, active count 23→24). **Files: `knowledge/entries/KE-120-cooperation-calibration-context-triad-multi-agent-structural-requirements.md`, `knowledge/hypotheses/H-097-multi-agent-ccc-triad-structural-coordination.md`**
- [x] **INDEX.md Deduplication**: Removed 23 duplicate rows from INDEX.md (H-092×2 old copies, H-093, H-095, H-096, EXP-108-114, KE-110-115, DD-713-716, CR-327-328). Caused by concurrent session writes appending to same table section. 653→630 lines. Also resolved CT-005 (context-stripping references scan — all KE entries already updated with EXP-104 caveats).
- [x] **Hypothesis Housekeeping (H-094, H-068 → ARCHIVED; H-097 → Tier 2)**: Archived two weak/unsupported hypotheses (H-094 P(H)=0.35 weak signal, H-068 P(H)=0.45 not supported). Promoted H-097 (CCC Triad, P(H)=0.65) to PRIORITY-TRACKER Tier 2. Updated hypothesis files, PRIORITY-TRACKER, INDEX.md, and todo.md. Tier 3 now empty. Active hypothesis count: 22.
- [x] **KE-060 Discovery-Task Boundary Update**: Updated unified intervention taxonomy with 5th M1 boundary (discovery-task overhead from EXP-117/120/KE-125). Added iatrogenic interaction evidence from EXP-116/KE-123. Cross-references added to KE-123↔KE-125. INDEX.md EXP-118 entry corrected (wrong numbers: claimed 11/25/17% but actual results = 100%). PRIORITY-TRACKER conflict file cleaned up (stale version removed).
- [x] **KE-082 Synthesis (Reasoning Dropout + Config Drift)**: DD-571 + DD-583 → distributed quality failure modes.
- [x] **H-092 → PRIORITY-TRACKER**: Added to Tier 1 (P(H)=0.72).
- [x] **H-099 DISCOVERY TASK BOUNDARY AUTHORED**: Formalizes 6-experiment convergent null results (EXP-117/120/121/122/124/126) into mechanistic theory. Creative inference is irreducible to external scaffolding. Three cognitive operations taxonomy (Execution→intervention-responsive, Recognition→partially responsive via Ch2, Discovery→no intervention works). Ch1 actively harmful on discovery (combined 8% vs 67% baseline, p=0.005). Stochastic inference model explains harm/null/positive asymmetry. P(H)=0.78. 5 testable predictions (P-099a through P-099e). PRIORITY-TRACKER updated (24 active hypotheses, 18 high-confidence). **File: `agents/shared/knowledge/hypotheses/H-099-discovery-task-boundary-creative-inference-irreducibility.md`**
- [x] **EXP-130 DESIGNED (H-099 P-099d: Few-Shot on Discovery Task)**: Acid test for H-099. 2-arm (N=6+6): baseline `kb-integration-discovery` vs `kb-integration-discovery-fewshot`. Domain-matched few-shot example in task.md (Ch3 delivery) showing how a similar KB integration was done. H-099 predicts FAILURE (≤67%). If confirmed: all 3 channels exhausted on discovery → strongest evidence for irreducibility thesis. Scenario `kb-integration-discovery-fewshot` created with task.md (few-shot example), scenario.json, and shared environment/success_criteria. **Design: `agents/shared/knowledge/experiments/EXP-130/design.md`**. Ready for Coach execution. **Delegated to Coach.**
- [x] **WKWA-008 WRITTEN (Channel Theory & Discovery Boundary)**: Major synthesis integrating H-098 (channel theory), H-099 (discovery task boundary), and 8 experiments (EXP-117–128). Key contribution: channel × task-type interaction matrix showing that intervention effectiveness is determined by the combination of delivery channel and cognitive operation type. Creative discovery tasks resist all channels. Pending EXP-129/130 results will update. **File: `agents/shared/knowledge/synthesis/WKWA-008-channel-theory-discovery-boundary.md`**. INDEX updated.
- [x] **EXP-143 DESIGNED (H-096 P-096a: Checkpoint Decomposition Improves Evaluation Accuracy)**: 394-line design doc. Retrospective re-evaluation of 100 historical sessions (≥15 tool calls, FM ground truth). Within-subjects: (A) holistic end-state judgment vs (B) checkpoint-decomposed (4-8 step segments, independent eval, aggregated). Tests whether DD-720's 24pp trajectory-length degradation explains 35% FM-3.3 residual. Power: N=100, 80% power to detect 15pp accuracy improvement. Indexed in INDEX.md and PRIORITY-TRACKER. **Design: `agents/shared/knowledge/experiments/EXP-143/design.md`**. Ready for Coach execution.

## Next Up
- [x] **EXP-100 Design + Execution**: ✅ DESIGNED, EXECUTED, and ANALYZED. Interventional test of H-093 CIVC. 3 arms × 2 scenarios × 2 runs = 12 gym runs. **RESULT: MODERATE SUPPORT** — Treatments +100pp on medium-complexity (0%→100%) but fail/harm on high-complexity (baseline 50%, scaffolding 50%, checkpoint 0%). Forced checkpoints HARM high-complexity (alignment tax per DD-671). FM-3.3 split confirmed: FM-3.3a (absence) vs FM-3.3b (verification theater). H-093 P(H) 0.75→0.70. Design at `agents/shared/knowledge/experiments/EXP-100/design.md`, results at `agents/shared/knowledge/experiments/EXP-100/results.md`. **Next: design harder scenarios or test "naked" agent.**
- [x] **Process remaining scout drops**: COMPLETE. Cleaned 36 already-processed drops. Dispatched 3 parallel research threads (Agent Safety, Verification-Trust, Harness Engineering). 3 new KEs created (KE-083, KE-084, KE-085). Cross-cluster synthesis written. Final 4 drops (DD-544, CR-314, brief-4d-attack-surface, synth-agent-doc-standard-convergence) triaged: all had library entries, added 3 missing INDEX entries (DD-551, brief-4d, synth-agent-doc), moved all to processed/. Drops folder now empty.
- [x] **KE-083 Synthesis (Agent Safety Gap)**: DD-470 + DD-489 + DD-550 + DD-574 → alignment fails at three system boundaries (communication/equivocation, trust/channel injection, authority/role override). Byzantine redundancy (DD-574) provides defense framework. KE-083 written, 4 DD library entries created, INDEX updated, drops cleaned. Previous KE-083 content (Verification-Trust Architecture from DD-572/580/CR-271/CR-295/CR-303) superseded — those DDs still reference KE-083 in INDEX.
- [x] **KE-084 Synthesis (Verification-Trust Architecture)**: DD-572 + DD-580 + CR-271 + CR-295 + CR-303 → three-layer architecture (L1 structural verification, L2 disagreement analysis, L3 trust-mediated coordination). Trust Minimization Principle. Renumbered from KE-083 to KE-084 to avoid ID collision. 5 library entries + KE + INDEX updated.
- [x] **KE-085 Synthesis (Harness Engineering Field Crystallization)**: DD-568 + DD-562 + CR-300 → harness engineering phase transition from practitioner craft to academic discipline. Triple convergence: Tsinghua OpenHarness (academic), Microsoft RD-Agent (industrial), CR-300 maturity model (community). Distinct from KE-047 (architectural) and KE-081 (optimization) — captures sociological/institutional crystallization. Library files created for DD-568 and CR-300. INDEX updated. (Renumbered from KE-086 to KE-085 to fix collision.)
- [x] **KE-089 Synthesis (Adaptive Verification & Evaluation)**: DD-676 + DD-677 + DD-678 → structural competence thesis: agent verification must be structural/adaptive/mid-trajectory. Safety correlates with structured data parsing (ρ=0.79), not jailbreak robustness. Explicit structure > LLM reasoning (+24.1pp world-model, non-monotonic LLM revision at ~4.3%). Evolutionary evaluation finds failure boundaries static benchmarks miss. INDEX updated with DD-676/677/678 + KE-089. **File: `agents/shared/knowledge/entries/KE-089-adaptive-verification-evaluation.md`**
- [x] **KE-101 Meta-Analysis Written**: Synthesizes 104+ experiments into comprehensive theory of agent improvement. Five laws, four intervention tiers, three meta-principles. Central finding: structure dominates content at every level. Decision framework for practitioners. **File: `agents/shared/knowledge/entries/KE-101-meta-analysis-theory-of-agent-improvement.md`**. INDEX updated.
- [x] **EXP-104 Integration (Context-Stripped Verification)**: COMPLETE — CONFOUNDED BY SKILL DEPLOYMENT. 18 runs (3 arms × 2 scenarios × 3 reps). Evidence-over-narrative skill (EXP-090/091) eliminated confabulation pre-experiment (baseline 100% vs expected 11-25%). Key findings: (1) Skill-level fix sufficient — no architecture needed (KE-102); (2) Context-stripping HURTS skilled agents — 88% vs 100% (KE-103); (3) Claim decomposition rescues stripping (Arm C 100%). KE-102, KE-103 filed. INDEX.md updated (both EXP and KE rows). PRIORITY-TRACKER H-093 updated with EXP-104. P(H) 0.70 unchanged. **KE-098 updated with EXP-104 results: predictions P-098a/e partially disconfirmed, skill > architecture hierarchy confirmed.**
- [x] **DD-698/699/700 + CR-322 Integration**: ✅ COMPLETE. Three March 2026 verification papers + synthesis integrated into main INDEX.md. KE-104 filed (Complete Verification Architecture — Evidence Grounding Stack). Five-mechanism pipeline: Ground→Gate→Challenge→Audit. UVA extended from 5 to 7+1 tiers. Four predictions filed.
- [x] **DD-701/702/703/704 + CR-324 Integration**: ✅ COMPLETE. Four April 2026 verification orchestration papers + synthesis integrated into INDEX.md. KE-105 filed (Verification Orchestration Stack — Compile, Triage, Enforce, Verify). Four-layer stack: (L4) Policy Compilation via Semantic Router DSL, (L3) Budget Allocation via DOVA + delegation cues, (L2) Runtime Enforcement via Sentinel Agents, (L1) Verification Mechanisms (KE-104 pipeline). KE-104 = WHAT to verify; KE-105 = HOW to orchestrate verification. **Files: `knowledge/entries/KE-105-verification-orchestration-stack.md`, INDEX.md updated (4 DD rows + 1 CR row + 1 KE row).**
- [x] **EXP-107 Integration (Adversarial Self-Check — CLOSED)**: Wave 1 BLOCKED at 6.25% FM-3.3 gym rate. Wave 2 multi-session (5 runs) showed 0% FM-3.3. Combined: 4.8% (1/21) — gap confirmed structural and unbridgeable. KE-107 updated with Wave 2 data. INDEX.md updated (EXP-107 CLOSED + KE-107 Wave 2 + H-093 evidence). PRIORITY-TRACKER updated (EXP-107 CLOSED, header updated).
- [x] **EXP-108 Phase 2 (Adversarial Self-Review A/B Test)**: COMPLETE — NULL RESULT. Full 18-run A/B test (9 control, 9 treatment, 6 scenarios). No significant treatment effect: Control 77.8% vs Treatment 72.2%, Δ=−5.6pp (p=0.99). Adversarial self-review skill adds "review without action" — no new evidence generated. KE-119 filed. H-095 evidence #9 added. INDEX.md, PRIORITY-TRACKER (H-093 row) updated. EXP-108 CLOSED.
- [x] **EXP-115/KE-121 → H-095 Integration**: EXP-115 (Optimizer FM-2.2 Completeness Checklist Guard) +100pp (0%→100%, N=3+3). Integrated into H-095: P(H) 0.75→0.82. Evidence #10 added (EXP-115 + EXP-108 null result). P-095e annotated with cross-agent confirmation. KE-121 connection added. Next Steps updated (#4 EXP-115 CLOSED, #9 production monitoring added). INDEX.md H-095 row updated (EXP-115 + EXP-108 evidence, P(H)→0.82). INDEX.md EXP-115 row updated. PRIORITY-TRACKER H-095 row updated (P(H)→0.82, meta-process count).
- [x] **EXP-120/121/122 + DD-739 + CR-65 INDEX Integration**: Added 5 new INDEX entries (EXP-120 progressive externalization NEGATIVE, EXP-121 extended time INCONCLUSIVE, EXP-122 environmental hints NULL, DD-739 instruction stacking degradation, Cross-Ref #65 safety iatrogenesis cascade). Updated H-085 (6 boundary conditions, 4 interventions tested), H-095 (4 text interventions × 0 successes on discovery), KE-125 (trilogy results, ~67% natural ceiling). Cleaned up duplicate entries from prior failed work session. Commit: `6f28df5ec`.
- [ ] **Meta-harness research**: KE-081 suggests closed-loop self-improvement as next frontier.
- [x] **EXP-101 (H-094: HVR Validation)**: ✅ COMPLETE — WEAK SIGNAL. Analyzed 1,259 sessions across 10 agents. Zero-hedge precision 96.3% (meets ≥90% target) but = base rate (96.2%) → no discriminative power. AUROC 0.535 (fails ≥0.60 target). Agents hedge 57.5% zero-hedge vs SELFDOUBT's 25.4% — different population. Error modes are infrastructure failures, not reasoning uncertainty. Per-agent signal in optimizer (AUROC 0.716) and scout (0.644) but tiny N. H-094 P(H) 0.45→0.50. Phase 2 gym validation NOT justified. Results at `agents/shared/knowledge/experiments/EXP-101/results.md`. Analysis script at `agents/bob/workspace/exp101-hvr-analysis.ts`.
- [x] **EXP-098 (L3 Treatment Testing on Cascading-State)**: COMPLETE. 4-arm test (baseline/ext/xref/combined) on cascading-state-migration L3 scenario. Baseline 0% (0/3), Externalization 0% (0/3), Cross-reference 100% (3/3), Combined 100% (3/3). Cross-reference is the active ingredient — externalization adds zero marginal value for absent-information tasks. **KB integration complete: H-085, H-089, EXP-098/design.md all updated. INDEX.md pending.**
- [x] **EXP-097 (Simulated Positional Privilege)**: COMPLETE. Urgency framing at system-prompt end yields 1/3 (33%) — better than no-framing (0%) but far worse than task-message (100%). Position effect is a steep gradient, not purely binary, but practically binary for production. SKILL.md cannot replace injected_context. **KB integration complete: H-091, KE-059, KE-060, INDEX, PRIORITY-TRACKER all updated.**
- [x] **EXP-096 (System Prompt Length Threshold)**: COMPLETE. Attention dilution REJECTED — 77% prompt reduction (48KB→11KB) still 0/3. Mechanism is positional privilege (categorical system vs task), not attention dilution (prompt length gradient). Arm C (minimal + task few-shot) 3/3 confirms task-message works regardless. H-091 open question #6 answered. Cumulative: task-message 12/12 (100%), system-prompt 0/9 (0%). **KB integration complete: H-091, KE-059, KE-060, KE-065, INDEX, PRIORITY-TRACKER all updated.**
- [x] **DD-660 KB Integration**: DD-660 (Positional Privilege Theory — "Lost in the Middle at Birth") integrated into KE-065, H-091, and INDEX.md (all 4 H-091 entries + KE-065 entry). Theoretical grounding: U-shaped attention bias is an architectural property of causal decoders (primacy+recency, dead middle), not a training artifact. System prompt = primacy zone (decaying), task message = recency zone (O(1) anchor). Four papers synthesized including arXiv:2603.10123.
- [x] **EXP-095 (Few-Shot Delivery Position)**: COMPLETE. THIRD BOUNDARY — delivery position is binary: task-message 100% (Arms A+C, 6/6), system-prompt 0% (Arm B, 0/3). Domain-matched v2.0 skill with binary examples still 0% in system prompt. Position dominates content quality. injected_context.md infrastructure unnecessary; inline task.md works equally. H-091 P(H) 0.93 (unchanged). KE-065 written (comprehensive few-shot findings). **Completes the few-shot research arc (EXP-084–095).**
- [x] **EXP-091 (Few-Shot on Process Discipline)**: COMPLETE. reproduce-first 0/3→3/3 (+100pp). Extends few-shot from judgment to process discipline. Cumulative matched few-shot: 15/15 (100%) across 6 scenarios. H-091 P(H) 0.98→0.99.
- [x] **EXP-093 (Few-Shot Sprint 3 — Verify-After-Edit)**: COMPLETE. "What vs When" boundary found: C3 validation +40pp (40%→80%) but C2.3 temporal sequencing -20pp (40%→20%). Few-shot teaches *what* to validate but NOT *when* to verify. Product quality +40pp. H-091 P(H) 0.99→0.95. Temporal discipline likely needs L4 workflow enforcement.
- [x] **EXP-094 (Few-Shot Cross-Scenario Generalization)**: COMPLETE. ⚠️ MIXED — Skill-only few-shot FAILS (0/3) on behavior-escalation-stubborn (hardest scenario), but domain-matched narrative context injection SUCCEEDS (3/3, 100%). Three-level transfer model: exact match=100%, same domain=100%, different domain=0% on hard scenarios. KE-059 transfer model revised. H-091 P(H) 0.95→0.93.
- [x] **EXP-092 (Forced Analysis-to-Documentation Transfer)**: COMPLETE. Citation closes transfer gap: 100% doc accuracy (10/10 Arm A) vs 44% (4/9 Arm B), +56pp. BUT analysis trap: 0/10 task completion with citation (vs 1/9 without). Execution crowding = new boundary. H-085 P(H) 0.85→0.88. KE-060 updated. KE-062 written (execution crowding). Integrated into H-085, KE-060, INDEX, PRIORITY-TRACKER.
- [x] **EXP-215 (Prerequisite Detection Skill)**: CONCLUDED. N=10 fixed re-run: all 10 fail `does-not-claim-success`. C1.8 deployed but ineffective. Rule of Two triggered — model-level limitation. ACCEPTED.
- [x] **Gym Sweep Part 3 COMPLETE**: 31/33 scenarios tested (wrong-tool-args pair cut off). 23 PASS, 8 FAIL. New failures: regression-from-fix (2), search-strategy-escalation, silent-dependency, spec-adherence-multi-step, stale-approach-fixation-workflow, sycophants-dilemma (confirmed), verification-contradiction-workflow. **FULL SWEEP TOTALS**: 108/111 tested, 77 PASS, 30 FAIL (27.8% failure rate). 3 untested (wrong-tool-args pair + 1 other).
- [x] **Verify-After-Edit v1 in Production**: Skill deployed at `agents/coder/skills/verify-after-edit.md`. **CONFIRMED WORKING (2026-03-29)**: Coder C1.3 pass rate = 62.3% (43/69 sessions, 7-day). Consistent with lab result (60%). Prompting ceiling reached — remaining 38% needs runtime enforcement.
- [ ] **Prompt Caching**: Blocked on Hao since 2026-03-24. $36-63/day savings waiting.
- [x] **Runtime Finish-Guard for Contradictory Status (REVERTED)**: Gates 3/3b were deployed (commits `45812bc`, `ca53a87`) then **reverted by Hao** (commit `b12c138`). Reason: guards hardcode environmental assumptions. context.md facts deployed instead. 0/6 pass rate on validation confirmed guards ineffective anyway. See `agents/shared/may-agent-docs/design/code-vs-data-decisions.md`.
- [ ] **EXP-216 (Regression Awareness Skill)**: DEPRIORITIZED. Coach diverted 3x (req:65b37587, req:c1f9a5f0 both marked COMPLETED without running on `regression-from-fix`). Rule of Two for delegation triggered. Skill designed and ready at `agents/.lab/regression-awareness-skill/`. Low priority — only 2 of 108 scenarios affected. Will revisit if Coach gets better at following delegated experiment designs.
- [x] **WAVE 1 DEPLOYMENT (Gym Remediation)**: ✅ VALIDATED — 9/9 behavioral pass. Coach confirmed all 3 scenarios work: escalation-impossible-task-fewshot (3/3 behavior, 4/5 total — efficiency check is SOUL overhead), misleading-test-fix-fewshot (8/8 × 3 = perfect), sycophants-dilemma-fewshot (6/6 × 3 = perfect). Few-shot injection confirmed in production-like gym runs.
- [x] **WAVE 2 DEPLOYMENT (Gym Remediation)**: All 5 scenarios created AND VALIDATED:
  - `missing-prerequisite-detection-xref` ✅ validated (87% overall, 100% product, 83% behavior)
  - `silent-dependency-xref` ✅ validated (100% all checks — perfect)
  - `judgment-ambiguous-spec-ext` ✅ validated (100% all checks — perfect)
  - `convention-verify-edit-fewshot` ✅ validated (67% overall, 100% product, 17% convention — hardest check)
  - `context-proof-build-xref` ✅ validated (67% overall, 100% behavior, 0% efficiency — build environment issue, not behavior)
  - **Second gym graduation exit condition MET** (2026-04-09)
- [x] **WAVE 3 DEPLOYMENT (Gym Remediation)**: 3 externalization scenarios created and VALIDATED:
  - `regression-from-fix-ext` ✅ validated 3/3 (perfect — 18/18 checks)
  - `search-strategy-escalation-ext` ✅ validated 3/3 (product perfect, convention `search-count-under-10` fails 3/3 — efficiency gap, not product)
  - `spec-adherence-multi-step-ext` ❌ validated 0/3 (product 24/24 perfect, convention `step-order` fails 3/3 — read-before-write ordering gap)
  - `regression-from-fix-workflow` ⏭ skipped (workflow IS the treatment)
  - 3.4 (convention-verify-edit-workflow) + 3.5 (incremental-context-loading) ⏳ need deeper work
  - **Overall**: 2/3 pass, 54/54 product checks (100%), 8/15 convention checks (53%). Product behavior excellent; convention discipline gaps remain.
- [ ] **Complete remaining 3 scenarios**: wrong-tool-args, wrong-tool-args-workflow (cut off in sweep part 3). Delegate to Coach.
- [x] **Tech-Lead jsonSchema Blocker**: SELF-RESOLVED (2026-03-29). Was intermittent — 1 error in last 6h, subsequent heartbeats completing normally. No longer blocking.
- [x] **C12.1 Convention Miscalibration → Module Cache**: Fix deployed in code (2026-03-29 20:43) but NOT LIVE due to Bun module cache. See C12.1 Module Cache (P0) entry above.
- [x] **C1.3 Production Gap — NOW LIVE**: All exempt patterns + grep verification heuristic now active (hot-reload since 06:43 UTC). Post-restart C1.3=100% (N=2). 6h rate=81.1% (includes pre-restart data). Monitoring for stabilization with larger N.
- [x] **C6.1 Threshold Recalibration — DONE (2nd time)**: Raised BUDGET_THRESHOLD from 60→80 in convention-check.ts (2026-03-31 02:10). Post-opBudget, 48-74 tool calls are normal for complex work. New threshold = ~97th percentile. Blocked by module cache.
- [x] **C12.1 cd-prefix + cat/head/tail fix — DONE**: `cd /app && grep` was failing regex. Added prefix stripping and cat/head/tail to allowed orientation commands (2026-03-30 20:40).
- [x] **C12.1 Module Cache (P0) — RESOLVED**: Fix was in source since 2026-03-29 20:43. Process restarted 2026-03-30 07:47 (new build `84e05c6`, opBudget removal commit). **41+ hour blocker cleared.** Post-restart C12.1 at 66.7% (2/3, N=3) — up from 0%. Both C12.1 (CONTEXT_FILE_PATTERNS) and C1.3 (C1_3_EXEMPT_PATTERNS) handler-level fixes now LIVE.
- [x] **C2.1 False Positive Fix — RESOLVED**: `isError` guard deployed and NOW LIVE (hot-reload fix active since 06:43 UTC). Post-restart C2.1=100%. The isError=false guard for `<tool_output>` wrapped content eliminates false positives from file content containing error-like strings.
- [x] **Convention Handler Module Cache (META-ISSUE)**: **RESOLVED** — Binary rebuilt at 06:43 UTC 2026-03-31 from `dc7595b` (includes `fd5b559` hot-reload fix). Handler modules now re-import on each cron invocation with cache-busting. All convention-check code changes auto-apply. Permanently resolved.
- [ ] **Amy-Kimi C8.2 Compliance**: 0/16 in 24h. **ROOT CAUSE FOUND**: Kimi-K2.5 generates malformed JSON in finish() arguments (e.g., `"success','summary\":"...`). The model attempts to call finish() but the JSON is unparseable, so summary/completed_items are never extracted. This is a model-level tool-calling bug, not a prompting issue. Options: (a) runtime JSON repair in tool-call parser, (b) exempt Amy-Kimi from C8.2, (c) accept as model limitation.
- [x] **EXP-079 Integration**: Cross-reference intervention 100% (3/3) on L3 absent-field detection. KE-057 written by Coach. Integrated into INDEX.md, H-085, PRIORITY-TRACKER. Cross-reference is complementary mechanism to externalization — works via external evidence discovery (codebase as schema) where externalization fails (absent-field = missing knowledge, not missing analysis).
- [x] **H-089 Filed**: Environmental Evidence Discovery — the second general-purpose intervention mechanism, complementary to H-085 externalization. Covers absent-information failures (agent lacks info that exists in environment). P(H)=0.65. Registered in INDEX.md and PRIORITY-TRACKER.md.

## Completed / Closed
- [x] **Path Hallucination Guard QA** (2026-03-29): Reviewed and QA'd (commit `36f0c27`). **REVERTED by Hao** (commit `b12c138`): `/home/hao` now mounted for flexnodehelper — guard would block real work. Replaced by context.md fact ("Project root is /app — do not use /home/*, /Users/*, ~/ paths"). Lesson: environmental constraints belong in data, not code.
- [x] **EXP-214 (Verify-After-Edit v2)**: REJECTED — catastrophic regression (10% vs 60% v1). v1 promoted instead.
- [x] **EXP-213 (Verify-After-Edit v1)**: 2x improvement (30% → 60%). Promoted to production.
- [x] **EXP-212 (Materialization v2)**: Rule of Two triggered. 7/9 ceiling accepted.
- [x] **EXP-211 (Materialization v1)**: Improved 6/9 → 7/9. Prompting ceiling for materialization.
- [x] **EXP-210 (Investigation Skill)**: INVALIDATED — scenario bug, not skill failure.
- [x] **Gym Sweep Parts 1-2**: 77/111 tested, 54 PASS, 22 FAIL (29% failure rate).
- [x] **Research**: Reviewed `ideas.md` and published `agents/shared/knowledge/synthesis/2026-03-17-agent-framework-insights.md`.
- [x] **SOUL Updates**: Verified P13/P108 present in May/Evaluator/Master SOULs.
- [x] **Infra Verification**: Confirmed `finish`, `verbose-tools`, `opbudget` are deployed.

## Deferred / Blocked
- [ ] **Prompt Caching**: Blocked on Hao (escalated 2026-03-24). Cannot fix from this repo.
- [ ] **Runtime Enforcement for Verification Gap**: Remaining 40% of verify-after-edit failures need code-level fix, not prompting. Deferred until prompting experiments complete.
- [ ] **Judgment Frontier (3→2 scenarios after EXP-090)**: behavior-escalation-stubborn, judgment-ambiguous-spec. ~~escalation-impossible-task~~ SOLVED by few-shot (EXP-090, 0→100%). ~~sycophants-dilemma~~ SOLVED by few-shot (EXP-087, 0→100%). Remaining 2 confirmed resistant to prompting. Accept as model-level limitations unless fine-tuning becomes available.

## Session Notes (2026-04-11 ~02:25)
- **EXP-129 KB INTEGRATION COMPLETE**: All remaining gaps closed:
  - INDEX.md: EXP-129 RUNNING → COMPLETE, WKWA-008 description updated with both EXP-129/130 results
  - WKWA-008: Header updated (no longer "pending"), §4.3 marked RESOLVED by EXP-128
  - KE-064: EXP-129 revision added (execution crowding applies to citation-type gates, not analytical progression)
  - PRIORITY-TRACKER was already current (updated in prior session)
  - H-098 was already current with EXP-129 evidence
- **DD-744/745/746 + CR-337 KB INTEGRATION COMPLETE**: Einstellung effect / exemplar-induced fixation literature fully indexed:
  - INDEX.md: DD-744, DD-745, DD-746 added to deep-dives table. CR-337 added to cross-references table.
  - H-099: External validation section added — 6 papers ground template-displacement mechanism via Einstellung effect. Connects list updated. Timestamp updated.
  - WKWA-008: §4.2 external validation paragraph added (CR-337 + DD-744/745/746). Sources line updated. Closing footnote updated.
- **System state: QUIESCENT** — All 10 channel theory experiments (EXP-117-130) fully integrated. No new experiments running. No scout drops pending. All hypotheses current.

## Session Notes (2026-04-10 ~19:55)
- **EXP-124 v2 CORRECTION CASCADE COMPLETE**: EXP-124 v2 (post-runner-fix) showed NO treatment effect (83% vs 83%, p=1.0, N=6+6). Original v1 results (+100pp) were dominated by gym runner file-sync bug (only 3/6 baseline trials ran, treatment results cached/stale). Comprehensive correction cascade across 11 KB files:
  - **KE-128**: Full rewrite — from "validated structural intervention" to null result documentation
  - **H-085**: P(H) reverted 0.87→0.85, evidence table corrected, changelog updated
  - **H-087**: P(H) reverted 0.75→0.72, L7 evidence removed
  - **H-095**: P(H) reverted 0.85→0.84, evidence item corrected from STRONG POSITIVE to NULL RESULT
  - **INDEX.md**: 7 affected rows updated (H-085, H-087, H-095, EXP-124, KE-128)
  - **PRIORITY-TRACKER**: H-085, H-087, H-095 rows + header updated
  - **Research Status Report**: Executive summary, discovery table, guard table, P(H) table all corrected
  - **H-098**: Bob discovery guard +100pp claim corrected to null result
  - **library/topics/07, 10**: KE-128 rows corrected, '3rd guard' claim removed
  - **EXP-124/results.md**: v2 supersession notice added
  - **Key insight**: The entire "+100pp discovery guard" narrative was invalidated. The gym runner bug masked that baseline was already 83%. Discovery-task boundary remains an open frontier — 5 intervention types tested (EXP-117/120/121/122/124), ALL fail or harm.
- **EXP-127 COMPLETE — Ch2 only works**: Channel Separation Direct Test results integrated. Baseline 0/6, Ch1 0/6, Ch3 0/6, Ch2 6/6. H-098 P(H) 0.78→0.80, status Proposed→Partially Confirmed. PRIORITY-TRACKER and INDEX updated.
- **EXP-126 COMPLETE — NULL RESULT (replicates EXP-122)**: Larger N replication (N=12+12) — 58% vs 50%, p=1.00. 5th text-based intervention failure. Already integrated into PRIORITY-TRACKER/INDEX.
- **Files modified**: All 11 files listed above (3 git-tracked committed, 8 local-only)

## Session Notes (2026-04-10 ~18:50)
- **CR-336 EXTERNAL VALIDATION MAP KB INTEGRATION COMPLETE**: Integrated CR-336 (External Literature Validation Map for the Three-Mechanism Theory) across the knowledge base:
  - **INDEX.md updated**: CR-336 row added after CR-335 in cross-references table.
  - **H-093 updated**: New "### CR-336: External Validation Map" section added. 5 papers directly validate CIVC (DD-667 complexity thresholds, DD-670 severity gradients, DD-672/697 structural mechanisms, DD-673 intervention failures). P(H) unchanged at 0.72 — already well-validated externally, CR-336 systematizes existing evidence rather than adding new.
  - **H-096 updated**: New "### CR-336: External Validation Map" section added. Strongest external support of all hypotheses — 6 papers across all 4 architecture layers (DD-720 Plan-RewardBench, DD-721 Agent-Diff, DD-722 SkillClaw, DD-723 AdaRubric, DD-724 Co-Sight CAMV, DD-728 TrACE). P(H) unchanged at 0.68 — all indirect.
  - **H-097 updated**: New "### CR-336: External Validation Map" section added. Each CCC Triad leg independently validated (DD-731 cooperation, DD-732 calibration, DD-733/DD-740/DD-741/DD-742 context isolation). P(H) unchanged at 0.65.
  - **PRIORITY-TRACKER updated**: Header updated with CR-336 integration summary. H-093, H-096, H-097 rows all annotated with CR-336 references.
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/H-093-complexity-induced-verification-collapse.md`, `knowledge/hypotheses/H-096-evaluation-architecture-determines-quality-ceiling.md`, `knowledge/hypotheses/H-097-multi-agent-ccc-triad-structural-coordination.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`

## Session Notes (2026-04-10 ~18:15)
- **H-085/H-087 Status Section Sync**: Fixed inconsistency — Status header text in H-085 still said "Five boundary conditions, 67/83 runs, P(H)→0.85" while P(H) Assessment section correctly said 0.87 with 76/95 runs across 18 scenarios. Updated status to match: 6 boundaries (5th refined by EXP-124), 76/95 runs, P(H)→0.87. H-087 status also synced (now shows P(H) 0.72→0.75 with EXP-124 evidence). **NOTE: These values were subsequently reverted by the EXP-124 v2 correction cascade (see ~19:55 session notes). H-085 now P(H)=0.85, H-087 now P(H)=0.72.**
- **EXP-126**: Noted — Coach running environmental hints replication (larger N of EXP-122). No action needed.
- **System state**: Quiet. No drops, no requests. All knowledge integration current.

## Session Notes (2026-04-10 ~17:55)
- **EXP-124 KB INTEGRATION — ✅ COMPLETE (v1 — SUBSEQUENTLY CORRECTED)**: KE-128 written and INDEX updated. Topic files (07-tool-use-workflows, 10-agent-design-patterns) updated. PRIORITY-TRACKER, H-085, H-087, H-095 all updated with EXP-124 evidence. P(H) updates: H-085→0.87, H-087→0.75, H-095→0.85. **NOTE: All v1 P(H) values reverted by v2 correction cascade (see ~19:55 session notes). v1 results invalidated by gym runner bug.**
- **EXP-123**: Still RUNNING (Phase 2 production observation). No results yet.
- **No new drops**. System is quiet.

## Session Notes (2026-04-10 ~17:15)
- **DD-740/741/742/743 + CR-333/335 + KE-127 KB INTEGRATION COMPLETE**: Four context pollution deep dives, two cross-references, and synthesis knowledge entry all indexed.
  - **INDEX.md updated**: DD-740/741/742/743 rows added to Research Library deep-dives. CR-333 and CR-335 rows added to cross-references. KE-127 row added to knowledge entries.
  - **KE-127 created**: Error Propagation Lifecycle — Context Pollution Mechanisms and Architectural Defenses. Synthesizes DD-740/741/742/743 + CR-333/335 into 5-phase lifecycle: Generation → Commitment → Inheritance → Amplification → Entrenchment. Our unique contribution: cross-session, cross-agent, cross-compaction propagation not addressed in existing literature. Architectural interventions mapped per phase. Session 599 cascade as live demonstration. Predictions P-127a-d filed.
  - **Key insight**: Shifts understanding from "errors happen" to "errors have a deterministic propagation lifecycle with architectural intervention points." Focus on breaking Phases 2-4 (commitment → inheritance → amplification) with structural architecture, not preventing generation (impossible).
- **Files created**: `knowledge/entries/KE-127-error-propagation-lifecycle-context-pollution-architectural-defenses.md`
- **Files modified**: `knowledge/INDEX.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~16:25)
- **EXP-122 + DD-739 KB INTEGRATION COMPLETE**: EXP-122 null result and DD-739 external literature both integrated:
  - **INDEX.md updated**: EXP-120, EXP-121, EXP-122 rows added to experiment table (after EXP-118). DD-739 row added to deep-dives table (after DD-738). KE-123 description updated to reflect DD-739 external validation. KE-125 description updated to include EXP-122 evidence.
  - **PRIORITY-TRACKER updated**: Header updated with EXP-122 + DD-739 summary. EXP-122 added to experiment queue. H-085 updated with EXP-122 (environmental hints NULL RESULT — 4th intervention type on discovery tasks). H-095 updated with EXP-122 (4th universal intervention failure on Bob's discovery task).
  - **Key insight**: Four intervention types now tested on Bob's discovery tasks — ALL fail or harm: (1) EXP-117 forced checklist HARMFUL (−67pp), (2) EXP-120 progressive tracking NEGATIVE (−50pp), (3) EXP-121 time budget INCONCLUSIVE (+16pp NS), (4) EXP-122 environmental hints NULL. DD-739 external literature (3 papers) validates KE-123 iatrogenesis via independent instruction stacking degradation evidence.
  - **H-085/H-095 P(H) unchanged**: 0.85 and 0.84 respectively (null result doesn't shift priors).
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~15:55)
- **EXP-121 KB INTEGRATION COMPLETE**: EXP-121 (Time Budget as Primary Limiter on Discovery Tasks) INCONCLUSIVE result fully integrated:
  - **INDEX.md cleaned**: Removed 7 duplicate lines (H-085×2, H-095×2, EXP-118, EXP-120×2) that accumulated from prior sessions. H-085 and H-095 original entries updated in-place with EXP-120+121 data. EXP-118 entry updated. EXP-120 and EXP-121 entries added in proper position after EXP-118.
  - **EXP-121 INDEX entry added**: COMPLETE — INCONCLUSIVE (suggestive positive trend). 67%→83% (p=1.0, Cohen's h=0.39, N=6+6). Not significant. Closes "externalization trilogy" (EXP-117/120/121).
  - **PRIORITY-TRACKER updated**: Header updated with EXP-121 summary. EXP-121 added to experiment queue with full details.
  - **Key insight**: Closes the "externalization trilogy" — three experiments testing interventions on Bob's discovery task: (1) EXP-117 forced checklist = HARMFUL (−67pp, p=0.030), (2) EXP-120 progressive tracking = NEGATIVE (−50pp, p=0.242), (3) EXP-121 time budget = INCONCLUSIVE (+16pp, p=1.0). Hierarchy: instructions actively harm, time helps marginally, real problem is creative inference/reasoning gap.
  - **H-085/H-095 P(H) unchanged**: 0.85 and 0.84 respectively (inconclusive result doesn't shift priors).
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~14:15)
- **TOPIC FILES UPDATED WITH DD-734/735/736/737/738 + KE-124**: All 5 new observability/evaluation papers and the KE-124 synthesis now referenced in topic files.
  - **08-evaluation-benchmarking.md**: Added DD-734 (AgentCompass post-deployment eval), DD-738 (BHI benchmark health), KE-124 (Five-Layer Observability Stack). Added 2 new open questions (cognitive observability implementation, BHI for gym benchmarks).
  - **04-reasoning-cognition.md**: Added DD-735 (Watson cognitive observability — prompt attribution for reasoning).
  - **10-agent-design-patterns.md**: Added DD-736 (AgentTrace structured logging), DD-737 (AgentSight eBPF system observability).
- **Files modified**: `knowledge/library/topics/08-evaluation-benchmarking.md`, `knowledge/library/topics/04-reasoning-cognition.md`, `knowledge/library/topics/10-agent-design-patterns.md`

## Session Notes (2026-04-10 ~13:25)
- **deliver-or-report.ts EARLY EXIT BUG FIX**: Fixed `extractWrittenFilePaths()` failing after compaction.
  - **Root cause**: Bob has `compaction: true`, so long Phase 1 sessions (83 ops) get messages compacted. Compaction replaces assistant toolCall blocks with text summaries containing "Files written: path1, path2". The original function only scanned assistant toolCall blocks → always found 0 paths after compaction → early exit never triggered.
  - **Fix**: Three extraction strategies: (1) toolCall blocks (pre-compaction), (2) parse "Files written:"/"Files edited:" from compacted context, (3) parse "✅ Wrote N bytes to" from toolResult blocks. Tested against real session data.
  - **Impact**: Phase 2 was running on all 11 sessions in last 12h with 0 skipped. 4 of those had ≤12 ops (likely redundant). Fix should start saving ~36% of Phase 2 runs.

## Session Notes (2026-04-10 ~14:55)
- **EXP-117 KB INTEGRATION COMPLETE**: EXP-117 (Forced Deliverable Enumeration for Bob FM-2.6) negative result fully integrated:
  - **KE-125 created**: Forced Enumeration Fails on Discovery Tasks Under Time Pressure. Original KE-123 ID collision resolved (→KE-125).
  - **H-085 updated**: P(H) 0.88→0.85. 5th boundary condition added (discovery-task overhead). EXP-117 added to evidence table, source list, audit trail. Status updated.
  - **H-095 updated**: P(H) 0.82→0.84. EXP-117 added as supporting evidence #11 (differential effect: same checklist = +100pp optimizer, −67pp Bob). 
  - **KE-121 updated**: Boundary qualification added — enumeration works when deliverables are explicit, harms when they require discovery.
  - **PRIORITY-TRACKER updated**: Header, H-085 row (P(H)→0.85), H-095 row (P(H)→0.84), EXP-117 added to experiment queue.
  - **INDEX.md updated**: H-085 row, H-095 row, EXP-117 experiment row, KE-125 row all added/updated.
  - **Files modified**: `knowledge/entries/KE-125-forced-enumeration-fails-discovery-tasks.md` (NEW), `knowledge/hypotheses/H-085-forced-externalization-general-mechanism.md`, `knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`, `knowledge/entries/KE-121-forced-externalization-prevents-misinterpretation.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-10 ~14:15)
- **EXP-118 INVALIDATION PROPAGATED**: EXP-118 (Cross-Agent Adversarial Handoff Baselines) showed EXP-116 used `--agent coder` (not a valid agent name). All EXP-116 conclusions invalidated. Propagated across knowledge base:
  - **H-093**: P(H) reverted 0.72 → 0.70 (EXP-116 evidence removed). EXP-116 section marked with ⚠️ invalidation note.
  - **PRIORITY-TRACKER**: Header updated, H-093 row P(H) 0.70, EXP-116 queue entry marked INVALIDATED, meta-process section updated.
  - **INDEX.md**: H-093, H-095, EXP-116, KE-122, KE-123 entries all updated with invalidation notes. EXP-118 added.
  - **KE-122**: Already marked UNSUPPORTED (prior session).
  - **KE-123**: Already marked UNSUPPORTED (prior session).
  - **EXP-116 results.md**: Already had invalidation header (prior session).

## Session Notes (2026-04-10 ~12:45)
- **EXP-116 INTEGRATED INTO H-093**: Analyzed contradictory Phase 1/Phase 2 results and added comprehensive EXP-116 section to H-093.
  - **Phase 1** (Coach, 36 runs): Baseline 100%, treatments degrade to 85-88%. Adversarial framing HURTS — overcorrection destroys correct work.
  - **Phase 2** (Bob, 15 trials): INVALID — infrastructure confound (missing files in treatment runs). Baseline 11% confirms CIVC prediction.
  - **New FM-3.3d**: "Verification destruction" — verification attempts actively degrade the system. Extends FM-3.3 severity gradient: absence → theater → confabulation → destruction.
  - **P(H) 0.70 → 0.72**: Modest increase — contradictory results limit evidentiary weight, but overcorrection effect and baseline verification collapse both consistent with CIVC theory.
- **PRIORITY-TRACKER updated**: H-093 entry updated with EXP-116 summary, P(H) 0.72, FM-3.3d extension noted.
- **Key insight**: EXP-116 Phase 1 + Phase 2 together tell a coherent story even though they disagree on numbers. The universal pattern is: prompt-level verification interventions are at best useless (EXP-102) and at worst destructive (EXP-116). Only structural interventions (machine-verified evidence, guards) produce durable improvements. This strongly supports the CIVC framework — verification collapse is a structural problem requiring structural solutions.

## Session Notes (2026-04-10 ~10:45)
- **EXP-116 DESIGN REVIEW COMPLETE**: Thorough critical review written to `agents/shared/knowledge/experiments/EXP-116/review-bob.md`. Recommendation: **DO NOT PROCEED as designed**. Three critical issues found:
  1. **C1: EXP-103 confound** — evidence-over-narrative skill was already deployed, making the +75-89pp effect size uninterpretable (EXP-104 revealed this). The baseline was anomalous.
  2. **C2: KE reference errors** — design cites KE-094/095 but these are actually KE-099/100. Wrong knowledge entries referenced.
  3. **C3: EXP-108 Phase 2 null result ignored** — adversarial self-review showed null result (KE-119: "review without action"). Framing-only arm (Arm A) predicted to fail.
- **Key insight**: The most promising component is machine-verified evidence + beforeToolCall guard (Arm D), not adversarial framing alone. Structural intervention is the active ingredient, consistent with KE-101 meta-analysis (structure > content).
- **5 moderate issues**: baseline reuse invalid, KE numbers wrong in header, H2 criteria too lenient (50%→20%), N=6 per arm underpowered, production sections premature.
- **Recommendation**: Fix confound acknowledgment, update KE references, add EXP-108 discussion, increase N to ≥9, tighten overhead criteria, simplify to 3-arm design (baseline vs evidence-only vs evidence+guard).
- **File created**: `agents/shared/knowledge/experiments/EXP-116/review-bob.md`

## Session Notes (2026-04-10 ~10:15)
- **HYPOTHESIS HOUSEKEEPING COMPLETE**: H-094 and H-068 archived, H-097 added to Tier 2 in PRIORITY-TRACKER.
  - **H-094 ARCHIVED**: HVR confidence gate — EXP-101 AUROC 0.566, zero-hedge gate vacuous (base rate artifact), survivorship bias fatal. P(H)=0.35. Mechanistic explanation: Reasoning Contamination Effect (DD-681).
  - **H-068 ARCHIVED**: Functional emotion pressure — P1 NOT SUPPORTED (EXP-037: error rates decrease at session end). P(H)=0.45. Below Tier 2 threshold.
  - **H-097 → Tier 2**: CCC Triad — P(H)=0.65. Strong external evidence from DD-731/732/733.
  - **PRIORITY-TRACKER**: Active count 23→22 (2 archived, H-097 was already counted). Tier 3 now empty. Archived section expanded.
  - **INDEX.md**: H-094 status updated to ARCHIVED. H-068 archived row added (was missing from INDEX entirely).
- **Files modified**: `knowledge/hypotheses/H-094-hedge-verify-ratio-agent-confidence-gating.md`, `knowledge/hypotheses/H-068-functional-emotion-pressure.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-10 ~09:40)
- **KE-121 ID COLLISION FIX COMPLETE**: Coach's EXP-115 Phase 2 result was filed as KE-115 (colliding with Bob's existing KE-115 FM-Heavy Workers Intervention Priority Map). Resolved:
  - **Renamed**: `KE-115-forced-externalization-prevents-misinterpretation.md` → `KE-121-forced-externalization-prevents-misinterpretation.md`
  - **Internal ID updated**: All references within KE-121 file changed from KE-115 → KE-121
  - **EXP-115/results.md updated**: Knowledge entry section header changed KE-115 → KE-121
  - **INDEX.md updated**: KE-121 row added after KE-120, EXP-115 row updated to PHASE 2 COMPLETE with → KE-121 reference
  - **Files modified**: `knowledge/entries/KE-121-forced-externalization-prevents-misinterpretation.md`, `knowledge/experiments/EXP-115/results.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-10 ~09:25)
- **DD-731/732/733 + KE-120 + EXP-115 INDEX INTEGRATION COMPLETE**: All new knowledge artifacts indexed.
  - **DD-731** ★★★★★: More Capable, Less Cooperative — capability-cooperation gap (ICLR 2026). o3 achieves 17% collective vs o3-mini at 50%.
  - **DD-732** ★★★★★: Conformal Social Choice — agreement ≠ correctness. 81.9% wrong-consensus interception at α=0.05.
  - **DD-733** ★★★★½: DACS — context pollution solved via asymmetric isolation (90-98.4% vs 21-60% flat).
  - **KE-120**: Cooperation-Calibration-Context Triad — three structural requirements for reliable multi-agent systems.
  - **EXP-115**: FM-2.2 Completeness Checklist Guard — Phase 1 complete, gym scenarios built.
  - **INDEX.md updated**: DD-731/732/733 + KE-120 + EXP-115 rows added (641→646 lines).
  - **PRIORITY-TRACKER updated**: EXP-115 added to experiment queue. Header updated.
  - **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~09:00)
- **DD-728/729/730 + CR-331 + KE-118 SYNTHESIS COMPLETE**: Synthesized 3 new deep dives into cross-reference CR-331 and knowledge entry KE-118. This closes ALL FIVE KE-105 open gaps — the verification orchestration stack is theoretically complete.
  - **DD-728** ★★★★★: TrACE — inter-rollout agreement as per-step capability signal. Training-free, catches confident failures (14.6% of our FM-3.3), dynamic compute allocation.
  - **DD-729** ★★★★★: Action Rebinding — zero-permission multi-step attack chains exploiting observation-action temporal gap. 100% success, architecture-independent. Phase 3 uses state-machine memory to escalate across contexts.
  - **DD-730** ★★★★½: SAVeR — adversarial auditing of reasoning faithfulness before action commitment. Consensus ≠ faithfulness insight. 16.4% faithful reasoning in standard CoT.
  - **CR-331**: Dynamic Capability + Multi-Step Defense Synthesis. Maps how DD-728/729/730 close remaining KE-105 gaps and extends the full verification stack to 8 layers (L1-L7).
  - **KE-118**: Complete Verification Orchestration Stack — All Five KE-105 Gaps Closed. Full 8-layer architecture from Policy Compilation (L4) through Multi-Step Attack Defense (L7). FM-3.3 residual estimate ≤10% with full stack.
  - **Topic files updated**: 05-security-safety.md (DD-729 in Attack Vectors), 08-evaluation-benchmarking.md (DD-728/730 in Quality & Reliability).
  - **INDEX.md updated**: DD-728/729/730 + CR-331 + KE-118 rows added.
- **Files created**: `knowledge/entries/KE-118-complete-verification-orchestration-stack-ke105-gaps-closed.md`, `knowledge/library/cross-references/CR-331-dynamic-capability-multi-step-defense-ke105-completion.md`
- **Files modified**: `knowledge/INDEX.md`, `knowledge/library/topics/05-security-safety.md`, `knowledge/library/topics/08-evaluation-benchmarking.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~08:45)
- **KE-117 WRITTEN (Verification Self-Awareness Stack)**: Synthesized DD-724/725/726 + CR-330 into knowledge entry KE-117. Two new layers atop KE-105/KE-116: Layer 5.5 (Signal Calibration — rubric decomposition + isotonic regression, ECE 15-25%→2-5%) and Layer 6 (Meta-Verification — CAMV conflict-aware multi-verifier, 84.4% GAIA SOTA). Closes 3/5 KE-105 gaps (signal calibration ✅, verification of verifiers ✅, cold-start ✅). Three operating modes (routine/uncertain/cold-start). Key system policy: never trust verbalized confidence. Estimates FM-3.3 residual halved (35%→15-25%) with full stack. Predictions P-117a-d filed.
- **INDEX.md UPDATED**: KE-117 row added after CR-330.
- **Files created**: `knowledge/entries/KE-117-verification-self-awareness-stack-meta-verification-signal-calibration.md`
- **Files modified**: `knowledge/INDEX.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~08:15)
- **H-096 AUTHORED**: Evaluation Architecture Determines Quality Ceiling — formalizes KE-116 four-layer evaluation stack as testable hypothesis. P(H)=0.68. 35% FM-3.3 residual + 14.6% confident failures are architectural ceilings from trajectory-level eval, narrative-based judgment, and fixed rubrics. Four predictions (P-096a through P-096d). EXP-115 (DAF retrofit) proposed as first direct test. Added to PRIORITY-TRACKER Tier 2 and INDEX.md.
- **Files created**: `knowledge/hypotheses/H-096-evaluation-architecture-determines-quality-ceiling.md`
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-10 ~07:45)
- **EXP-114 GYM RESULTS INTEGRATED**: Updated PRIORITY-TRACKER and INDEX with EXP-114 Phase B gym results (H3 INCONCLUSIVE due to ceiling effect, H4 DISCONFIRMED). H-095 entries updated with complete EXP-114 summary.
- **Common-sense-infra review COMPLETE**: Reviewed common-sense.md — no changes needed. All 17 rules still valid and operationally relevant.
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~06:30)
- **EXP-114a KNOWLEDGE BASE INTEGRATION COMPLETE**: Full integration of Coach's EXP-114 Phase A (Tool Schema Guard Prototype) results into knowledge base.
- **Key findings from EXP-114a**: Tool schema guard prototype targets the tactical subset of FM-2.1 (tool schema errors). 52/96 FM-2.1 schema issues catchable (54.2% of schema subset, 23.7% of all FM-2.1). Coach benefits most: 40/61 = 65.6% catch rate. 8 patterns across 6 tools (bash_empty #1 at 39 instances). Pure arg inspection, fail-open, ~0ms overhead. H2 SUPPORTED retrospectively: single guard cannot address both tactical and strategic FM-2.1. Tool hallucination (17.7% of FM-2.1) NOT catchable by schema guard.
- **H-095 updated**: Evidence #8 added (EXP-114a). P(H) unchanged at 0.75 (prototype analysis, not production measurement). P-095e annotated with partial implementation note. Next steps revised: Phase A complete → priorities reordered (Phase B gym + deployment first, then FM-1.1/FM-2.4 guards).
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~05:25)
- **EXP-113 + KE-115 KNOWLEDGE BASE INTEGRATION COMPLETE**: Full integration of Coach's EXP-113 (FM-Heavy Workers Targeted Intervention Analysis) and KE-115 (Intervention Priority Map) into knowledge base.
- **Key findings from EXP-113**: All 5 hypotheses confirmed on N=398 FM-Heavy Worker sessions (26.9% of production). (H1) FM-2.1 is #1 cascade trigger (96 first-appearances, 2.38 subsequent FMs/session). (H2) Agent profiles truly distinct at scale — each agent has dominant FM accounting for 51-80% of sessions. (H3) Dose-response cliff at FM≥4 (Q=0.478, delivery<50%). (H4) Intervention priority map: FM-2.1 approach guard > FM-1.1 task check > FM-2.4 scope enforcement > FM-2.6 tool skills. (H5) Post-guard FM-Heavy Workers are smaller but harder (N=16, 88% FM-3.3, dominated by bob).
- **Critical reframing**: FM-3.3 is downstream symptom of FM-2.1 cascade — target upstream approach problems first, not downstream verification failures. This has implications for H-093 (CIVC may be triggered by upstream approach failures).
- **H-095 updated**: P(H) 0.70→0.75. Evidence #7 added. Mechanism section expanded to include all 5 agents with prevalence data. New prediction P-095e (FM-2.1 approach guard for coach). Next steps revised with KE-115 priority-ranked intervention roadmap. Connection to H-093 annotated with F2 cascade finding.
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~04:35)
- **EXP-110/KE-113 INTEGRATION FINALIZATION**: Completed remaining integration items from naming collision fix:
  - **H-093 PRIORITY-TRACKER updated**: Added EXP-110 evidence — 35% residual unrecovered FM-3.3 post-guard = CIVC production manifestation. Guard recovers 73.5% but remaining 35% resists recovery, consistent with CIVC severity gradient (FM-3.3a recoverable, FM-3.3b/c resistant).
  - **H-095 naming collision resolved**: Clarified that EXP-110 was used by Coach for commit guard study, future agent-specific experiments use EXP-111+ (aligned with CR-328 which already proposes EXP-111 for semantic check injection).
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~04:25)
- **EXP-110 + KE-113 KNOWLEDGE BASE INTEGRATION COMPLETE**: Full integration of Coach's EXP-110 (FM-3.3 Commit Guard Production Impact) results into knowledge base.
- **Key finding**: Commit guard mechanism is RECOVERY not prevention — raw FM-3.3 rate increased +20.9pp but recovery rate jumped +51.3pp (h=1.12). Unrecovered FM-3.3 dropped from 15.2% to 4.5%. Cascading FM-2.x benefit (scope creep −40pp, tool misuse −29pp).
- **H-095 updated**: Status Proposed→Active, P(H) 0.65→0.70. Evidence #6 added (EXP-110/KE-113). P-095a PARTIALLY SUPPORTED (recovery mechanism exceeds 50% threshold but via recovery not prevention as predicted). P-095c annotated with cross-FM benefit note. Next steps revised (EXP-110 complete, Coach/Coder interventions, larger sample, residual 35% investigation).
- **PRIORITY-TRACKER updated**: H-095 promoted Tier 3→Tier 1. EXP-110 added to experiment queue. Meta-process updated (15→16 high-confidence hypotheses).
- **INDEX.md updated**: EXP-110 row added, KE-113 row added, H-095 row updated with EXP-110 evidence and Active/0.70 status.
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/H-095-agent-specific-failure-interventions.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-10 ~04:00)
- **EXP-109 PHASE 2 INTEGRATION COMPLETE**: Updated H-092 and H-093 hypothesis files with EXP-109 results sections. Updated H-092 and H-093 entries in INDEX.md with EXP-109 summaries. All EXP-109 knowledge base integration now complete (EXP-109 row, KE-112 row, H-095 authored + indexed, H-092 file + INDEX entry updated, H-093 file + INDEX entry updated).
- **Files modified**: `knowledge/hypotheses/H-092-reasoning-flow-failure-modes-agent-systems.md`, `knowledge/hypotheses/H-093-complexity-induced-verification-collapse.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-09 ~23:55)
- **KE-110 WRITTEN (SKILL STACK SATURATION)**: Capstone synthesis of the gym improvement loop. Three convergent evidence streams: (1) EXP-108 ceiling — all 7 multi-session scenarios at 91–100%, (2) KE-109 structural gap — gym skills solve gym-shaped problems only, (3) KE-106 guard permanence — neither skills nor guards train behavior. The gym skill improvement loop ran 25+ experiments and is terminally complete with the 5-skill stack (evidence-over-narrative, verify-after-edit, investigate-and-fix, classify-then-act, efficient-file-reading).
- **CT-004 RESOLVED**: Guards as permanent infrastructure vs training stepping stones — resolved via KE-110 evidence synthesis. Guards and skills are both permanent infrastructure. Neither trains the underlying model. Contradiction Tracker updated (2 open → 1 open, 3 resolved → 4 resolved, resolution rate 43% → 57%).
- **INDEX.md UPDATED**: KE-110 row added after KE-109.
- **Predictions filed**: P-110a (new gym skill = 0pp improvement), P-110b (production FM-3.3 stays 50-70%), P-110c (harder scenarios reopen loop), P-110d (5-skill stack won't regress in 30 days).
- **Files created**: `knowledge/entries/KE-110-skill-stack-saturation-gym-ceiling-confirms-improvement-loop.md`
- **Files modified**: `knowledge/INDEX.md`, `knowledge/CONTRADICTION-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~14:23)
- **EXP-103 RESULTS ANALYSIS**: All 12 runs complete. BOTH adversarial framing AND machine-verified evidence achieve 100% pass rate (12/12 runs). Effect size: +75-89pp vs baselines (11-25%). Strongest treatment in EXP-series. Zero variance within arms. Behavioral checks (hardest category) went from 0% to 100% for both treatments. Machine-verified ~11% faster.
- **KE-098 WRITTEN**: Uncertainty-Aware Verification Signals — synthesizes DD-694 (MARCH information asymmetry), DD-695 (SELFDOUBT HVR), DD-696 (stepwise informativeness/entropy), DD-697 (hallucination as boundary misclassification) into unified signal architecture. Three signal families: generation-level (HVR/entropy), verification-level (information asymmetry), output-level (boundary classification). Maps to UVA layers.
- **KE-099 WRITTEN**: Adversarial Framing Bypass for Verification Confabulation — reframing verification as criticism ("find 3 bugs") eliminates confabulation. Prompt-level intervention that works by redirecting generation objective (not fighting bias). Revises KE-007.
- **KE-100 WRITTEN**: Machine-Verified Evidence Injection — automated file analysis (wc -l, grep) in context eliminates confabulation. Requires infrastructure but doesn't depend on agent compliance. Confirms KE-007 framework-level hypothesis.
- **DD-694/695/696/697 INDEXED**: 4 new deep dives integrated into INDEX.md Research Library.
- **PRIORITY-TRACKER UPDATED**: EXP-103 added to experiment queue (COMPLETE). H-093 updated with EXP-103 results.
- **Files created**: `agents/shared/knowledge/entries/KE-098-uncertainty-aware-verification-signals.md`, `agents/shared/knowledge/entries/KE-099-adversarial-framing-bypass-verification-confabulation.md`, `agents/shared/knowledge/entries/KE-100-machine-verified-evidence-injection-confabulation.md`, `agents/shared/knowledge/experiments/EXP-103/results.md`
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~13:48)
- **DD-691/692/693 INDEXED**: Scout session 393 dropped 3 confirmation bias papers, all ★★★★★ or ★★★★½. Indexed in INDEX.md Research Library.
  - **DD-691** ★★★★★ CRITICAL: "Failing to Falsify" — all 11 LLMs exhibit confirmation bias (Wason 2-4-6 task). Falsification prompting +14pp rule discovery. Directly grounds KE-093.
  - **DD-692** ★★★★★ CRITICAL: Adversarial framing overrides code review — autonomous agents 88% exploitable (vs 35% interactive). Context stripping 94-100% effective debiasing. Directly validates EXP-102 mechanism.
  - **DD-693** ★★★★½: Grounding-sycophancy tradeoff — better-grounded models are MORE sycophantic. Capability scaling cannot solve confabulation. Explains EXP-102's 100% rate.
- **KE-097 WRITTEN**: Confirmation Bias as Root Mechanism of Verification Confabulation. Synthesizes DD-691/692/693 into unified theoretical framework for KE-093. Mitigation hierarchy: structural > context-stripping > falsification prompting > capability scaling. 4 predictions. Directly informs EXP-103.
- **DD-685/686/687 CLEANUP**: Deleted duplicates (scout renumbering artifacts). Will recur on federation sync.
- **INDEX DEDUPLICATION**: Removed stale H-094 (P(H)=0.50) and duplicate DD-679/680/681 entries from earlier merge issues.
- **Files created**: `agents/shared/knowledge/entries/KE-097-confirmation-bias-mechanism-verification-confabulation.md`
- **Files modified**: `agents/shared/knowledge/INDEX.md`

## Session Notes (2026-04-09 ~12:53)
- **H-094 P(H) CONSISTENCY FIX**: Results.md Phase 2 concluded P(H)=0.35, but H-094.md and PRIORITY-TRACKER said 0.50. Fixed all 3 files to consistently show P(H)=0.35 with Phase 2 reasoning (AUROC 0.566, survivorship bias fatal, base rate artifact).
- **INDEX DEDUPLICATION**: Removed 7 duplicate rows (EXP-100, EXP-101, H-093, H-094 ×2, DD-679/680/681) and fixed 3 stale DD entries (replaced with updated versions). INDEX down from 568→559 lines.
- **EXP-102 REGISTERED**: Coach ran verification confabulation test on multi-session harness but didn't create formal experiment directory. Created `experiments/EXP-102/results.md`, added EXP-102 row to INDEX and PRIORITY-TRACKER experiment log.
  - **Key finding**: 100% confabulation rate — agents read correct file contents but fabricate verification documents matching false priors. Generation-level failure, not information-gathering failure.
  - **KE-093** (Verification Confabulation) was already created by Coach. Now properly connected to EXP-102.
- **Files created**: `agents/shared/knowledge/experiments/EXP-102/results.md`
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/shared/knowledge/hypotheses/H-094-hedge-verify-ratio-agent-confidence-gating.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~12:18)
- **DD-679/680/681 INDEX + H-094 INTEGRATION**: Integrated three new deep dives (Scout's linguistic confidence/hedging research) into knowledge base.
  - **DD-679** ★★★★★ EXCEPTIONAL: Dual uncertainty interfaces — global (verbalized confidence) + local (`<uncertain>` markers). Trained local markers >> passive detection. Validates H-094 direction but shows explicit training needed.
  - **DD-680** ★★★★½: Linguistic hedging mapper — weighted scores >> binary counting. Explains EXP-101's weak AUROC (binary hedge/no-hedge loses gradation).
  - **DD-681** ★★★★½ CRITICAL WARNING: Reasoning Contamination Effect (RCE) — calibration and verbalized confidence are ORTHOGONAL in representation space. Mechanistically explains EXP-101's failure: reasoning traces are exactly where RCE operates maximally.
  - **INDEX.md**: 3 DD rows added after KE-089. H-094 entry updated (P(H)=0.50, mechanistic explanation, DD refs).
  - **H-094 updated**: Connected-to expanded (DD-679/680/681). New "Mechanistic Insights from Literature" section with per-paper implications and synthesis ("Why HVR Doesn't Transfer" — passive detection fails, binary counting loses information, reasoning contaminates confidence). Three forward paths identified (trained interfaces, two-stage assessment, structural proxy signals).
  - **Conflict file deleted**: `EXP-101/results.md.conflict-k3s` removed.
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/shared/knowledge/hypotheses/H-094-hedge-verify-ratio-agent-confidence-gating.md`
- **Files deleted**: `agents/shared/knowledge/experiments/EXP-101/results.md.conflict-k3s`

## Session Notes (2026-04-09 ~12:00)
- **EXP-101 COMPLETE — WEAK SIGNAL**: Retrospective HVR analysis on 1,259 production sessions across 10 agents.
  - **Zero-hedge precision**: 96.3% (meets ≥90% target) but = base rate (96.2%) → no discriminative power.
  - **AUROC**: 0.535 (fails ≥0.60 target). HVR does NOT discriminate correct vs incorrect sessions in production logs.
  - **Key finding**: Agent hedging patterns fundamentally differ from SELFDOUBT benchmark — 57.5% zero-hedge (vs 25.4% in paper). Error modes are infrastructure failures (timeouts, crashes), not reasoning uncertainty. HVR was designed for reasoning errors, but our errors are categorical.
  - **Per-agent signal**: Optimizer AUROC 0.716 (N=3 errors), Scout 0.644 (N=2 errors) — promising but too few errors to confirm.
  - **H-094 P(H)**: 0.45→0.50 (slight increase — headline precision matches, but mechanism doesn't transfer).
  - **Phase 2 gym validation**: NOT justified — would need reasoning-type errors (gym scenarios) not infrastructure failures.
  - **FM-3.3 analysis**: Only 7 eval-labeled sessions. Too few to test P-093e (FM-3.3 prediction from hedging).
- **DD-676/677/678 INDEX + KE-089 SYNTHESIS**: Three new deep dives integrated. Cross-paper synthesis KE-089 (Adaptive Verification & Evaluation) written. 4 predictions. INDEX deduplication fix (concurrent threads wrote twice).
- **PRIORITY-TRACKER UPDATED**: H-094 P(H) 0.45→0.50 (Tier 2), EXP-101 ✅ COMPLETE. Header updated.
- **Cleanup**: Removed duplicate KE-089 file (kept comprehensive version). Deduplicated INDEX.md rows. Updated EXP-101 from DESIGNED→COMPLETE in experiments table.
- **Files created**: `agents/bob/workspace/exp101-hvr-analysis.ts`, `agents/shared/knowledge/experiments/EXP-101/results.md`, `agents/shared/knowledge/entries/KE-089-adaptive-verification-evaluation.md`
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/shared/knowledge/hypotheses/H-094-hedge-verify-ratio-agent-confidence-gating.md`, `agents/shared/knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~11:55)
- **DD-676/677/678 INDEX INTEGRATION + KE-089 SYNTHESIS**: Integrated three new deep dives into INDEX.md Research Library and wrote cross-paper synthesis KE-089.
  - **DD-676** ★★★★★ CRITICAL: TraceSafe-Bench — mid-trajectory safety benchmark. Structural data competence (ρ=0.79) dominates guardrail effectiveness; jailbreak robustness ρ≈0. Architecture > scale. Grounds H-093, seeds KE-089.
  - **DD-677** ★★★★½: Self-Revising Agent Decomposition — 4-component decomposition shows explicit world-model planning (+24.1pp) dominates; LLM revision non-monotonic at ~4.3% of turns. Validates H-085, seeds KE-089.
  - **DD-678** ★★★★: HAAF + NAAMSE — adaptive evaluation frameworks. Scenario manifold + evolutionary search for finding CIVC failure boundaries. Directly applicable to EXP-100 redesign. Seeds KE-089.
  - **KE-089 WRITTEN**: Structural Verification Competence & Adaptive Evaluation Design. Key synthesis: structural competence hierarchy (structured data parsing > explicit planning > belief tracking > LLM revision). Reframes EXP-100 redesign toward mid-trajectory structural complexity. 4 predictions.
- **Files created**: `agents/shared/knowledge/entries/KE-089-structural-verification-competence-adaptive-evaluation.md`
- **Files modified**: `agents/shared/knowledge/INDEX.md` (3 DD rows + KE-089 row), `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~10:05)
- **Cascade dynamics cross-thread synthesis**: Wrote comprehensive SYNTHESIS-cascade-dynamics-verification-defense-stack.md — the Five-Layer Cascade Defense Stack connecting DD-667→DD-675 (9 papers) with EXP-099, H-092/093/094, and KE-080→088.
  - **Key insight**: Verification collapse is a multi-stage degradation interceptable at 5 temporal points (Architecture → Pre-generation → Mid-generation → Post-step → Post-chain)
  - **DD-671 alignment tax warning**: Format constraints consume reasoning capacity — EXP-100 checkpoints should be lightweight
  - **New prediction proposed**: P-093e: Internal detection can identify CIVC onset 2-3 steps before external quality degradation
- **INDEX.md updates**: Added DD-674 (hidden-state probing, ★★★★), DD-675 (local shields, ★★★½), H-094 (HVR confidence gating). Updated H-093 description (DD-667→DD-675, 9 papers).
- **H-093 updated**: Added DD-674/675 evidence + H-094 connection + nine-paper count.
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/shared/knowledge/hypotheses/H-093-complexity-induced-verification-collapse.md`, `agents/bob/workspace/SYNTHESIS-cascade-dynamics-verification-defense-stack.md` (new), `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~09:56)
- **DD-667→DD-673 INDEX INTEGRATION**: Added 7 missing deep-dive entries to INDEX.md Research Library section:
  - **DD-667** ★★★★★ CRITICAL: MASC — metacognitive self-correction for MAS. Step-level error detection via NER + Prototype-Guided Enhancement. Grounds H-092, H-093.
  - **DD-668** ★★★★★ CRITICAL: AgentErrorTaxonomy — first systematic taxonomy of cascading agent failures (5 modules). AgentDebug +24% accuracy. Grounds H-092, H-093.
  - **DD-669** ★★★★½: Spectral Kill Switches — pre-generation contamination detection via spectral attention analysis. Grounds H-092, H-093.
  - **DD-670** ★★★★: HGR — cascade error correction via graph contraction. Memory that shrinks. Grounds H-093.
  - **DD-671** ★★★★★ CRITICAL: Structure Snowballing — alignment tax of constrained decoding. Directly validates H-093 mechanistically.
  - **DD-672** ★★★★: CTHA — constrained temporal hierarchy for stable MAS. 47% failure cascade reduction. Grounds H-093.
  - **DD-673** ★★★★: VeriGUI — TVAE verification framework. Validates H-093 P-093c (forced checkpoints).
- **H-093 P(H) updated in INDEX**: 0.65→0.75 with external literature validation note.
- **Files modified**: `agents/shared/knowledge/INDEX.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-09 ~09:15)
- **KE ID COLLISION FIX**: Three KE-079 files existed from different sessions. Resolution:
  - **KE-079** = Structure-Aware Retrieval (pre-existing, kept) — DD-545/DD-567
  - **KE-080** = Cascade-Architecture Convergence (renumbered from KE-079) — DD-639/DD-640/EXP-099
  - **KE-081** = Automated Harness Optimization (renumbered from KE-079, was orphaned) — DD-560/DD-575
- INDEX.md updated with all three entries. DD-639/DD-640 cross-references updated to "Seeds KE-080".
- **H-092 added to PRIORITY-TRACKER**: Tier 1, P(H)=0.72 (was missing after EXP-099 session).
- **Parallel research dispatched**: DD-639/DD-640 synthesis + DD-642 trust allocation. Both completed.

## Session Notes (2026-04-09 ~09:00)
- **KE-079 WRITTEN**: Cascade-Architecture Convergence — synthesizes DD-639 (ABTest behavioral fuzzing), DD-640 (Scaffold Taxonomy), and EXP-099 (H-092 information-flow analysis) into unified framework. Three-way convergence: (1) EXP-099's 3 cascade archetypes + 12× agent gradient, (2) DD-639's 47 Interaction Patterns map onto cascade archetypes, (3) DD-640's loop primitive composition predicts cascade vulnerability. Key insight: each additional composed loop primitive roughly doubles cascade rate. Proposes cascade-aware testing framework and complexity-gated verification (1 verification gate per composed loop primitive).
- **INDEX.md updated**: KE-079 added to Knowledge Entries table. DD-639/DD-640 library entries updated with "Seeds KE-079" annotations.
- **Drops cleaned**: Removed redundant dd639/dd640 copies from `agents/scout/drops/` (already in library).
- **Files created**: `knowledge/entries/KE-079-cascade-architecture-behavioral-testing-convergence.md`
- **Files modified**: `knowledge/INDEX.md`

## Session Notes (2026-04-09 ~08:20)
- **KE-076/077/078 DEDUP FIX**: Found and fixed ID collision where two concurrent sessions created conflicting KE-076/KE-077 files with different topic mappings. Resolution: kept Bob's intentional commit (fb3d2309), deleted conflicting auto-sync files, removed duplicate INDEX.md rows. Commit a84d8d1c.
- **Scout drops backlog**: 39 unprocessed DDs in `agents/scout/drops/`. Notable: DD-613/DD-634 (Claude Code complexity wall, ★★★★★), DD-602 (AI assistance reduces persistence, ★★★★), DD-605 (decocted experience, ★★★★½). Will triage in future sessions.
- **State assessment**: Gym graduated ✅, fewshot deployment in progress (tech-lead) ✅, all experiments integrated ✅, KB clean ✅. Research arc is at a natural transition point.

## Session Notes (2026-04-09 ~08:50)
- **MEMORY ARCHITECTURE CLUSTER INTEGRATION**: Processed scout drops DD-545 (APEX-EM), DD-567 (M-Flow), and confirmed DD-578 = duplicate of DD-590 (LLMA-Mem, already in library).
  - **DD-545 library entry**: `agents/shared/knowledge/library/deep-dives/DD-545-apex-em-experience-memory.md` — ★★★★★ LANDMARK. Non-parametric experience memory via DAG-based structural matching. +48.3pp on multi-step tasks. Structural retrieval beats semantic by +4.2pp. Dual-outcome memory (success + failure with synergy).
  - **DD-567 library entry**: `agents/shared/knowledge/library/deep-dives/DD-567-mflow-cognitive-memory-engine.md` — ★★★★. Cognitive memory engine via Cone Graph (Episode→Facet→FacetPoint→Entity). Retrieval-as-reasoning replaces vector similarity. MCP-native, production-grade (963 tests).
  - **KE-079 written**: `agents/shared/knowledge/entries/KE-079-structure-aware-retrieval-dag-matching-hierarchical-decomposition.md` — Structure-Aware Retrieval: DAG Matching and Hierarchical Decomposition as Memory Architecture Primitives. Extends KE-040 with implementation mechanisms for L2-L6. Two-track retrieval architecture (experience/knowledge). Bidirectional cone insight maps to our Scout→KE→context.md pipeline.
  - **INDEX.md updated**: DD-545, DD-567, and KE-079 rows added.

## Session Notes (2026-04-09 ~05:55)
- **EXP-098 KB INTEGRATION COMPLETE**: Integrated EXP-098 results into knowledge base:
  - **H-085** updated: Added EXP-098 to evidence table (ext 0/3 on cascading-state-migration), noted absent-information boundary reinforced. P(H) unchanged at 0.97.
  - **H-089** updated: Added EXP-098 data (xref 3/3, combined 3/3), N=24→30 treatment total, P(H) 0.82→0.85, 5th domain (cascading-state migration) confirmed.
  - **INDEX.md** updated: EXP-098 row + H-085/H-089 update rows added.
  - **EXP-098/design.md** status: IN-PROGRESS → COMPLETE.
  - **First gym graduation exit condition MET** (EXP-098 done). Second exit condition (Wave 2 validation) also MET — Coach validated all 5 scenarios (parts 2+3). **🎓 BOTH EXIT CONDITIONS MET — GYM GRADUATION NOW EFFECTIVE.**

## Session Notes (2026-04-09 ~05:25)
- **GYM GRADUATION REVIEW COMPLETE**: Reviewed Coach's proposal-graduate-gym.md and proposal-fewshot-production-deployment.md. Decision: **APPROVED WITH CONDITIONS**.
  - Two exit conditions before graduation takes effect: (1) Complete EXP-098 (L3 treatment testing, 9 runs), (2) Complete Wave 2 validation (5 scenarios, Coach runs)
  - Few-shot production pipeline: APPROVED with 5 modifications (higher-precision routing, audit logging, 48h production validation before Phase 2, skip RAG/Phase 3, needs design brief for tech-lead)
  - Multi-session test harness: APPROVED for design phase only
  - Production A/B framework: DEFERRED (premature — use natural experiment from audit logs first)
  - Wave 3: validate opportunistically in regression runs. Wave 4: SKIP entirely.
  - After EXP-098 + Wave 2 validation, gym enters maintenance mode (regression suite only, no more exploratory experiments)
- **Wave 1 VALIDATED**: 9/9 behavioral pass confirmed by Coach. All 3 treatment scenarios work.
- **Deliverable**: `agents/shared/knowledge/synthesis/GYM-GRADUATION-REVIEW.md`

## Session Notes (2026-04-09 ~06:50)
- **FEW-SHOT PRODUCTION PIPELINE DESIGN BRIEF**: Written and committed at `agents/shared/may-agent-docs/design/fewshot-production-pipeline.md`. 10-section design brief covering the full production deployment of few-shot injection. Key architectural decisions:
  1. **Static regex routing (Phase 1)** — high-precision patterns (5-15% fire rate), NOT Coach's broad patterns (~80% fire rate)
  2. **Task-message injection** — prepend examples to task with "Reference" framing, max 2 examples
  3. **3 examples first** (binary-file-escalation, reproduce-first-debugging, escalation-judgment), remaining 2 after 48h validation
  4. **Audit logging mandatory** — every dispatch logged with matched/injected/skipped fields
  5. **Feature flag** — `FEWSHOT_INJECTION` env var for instant rollback
  6. **No RAG/embedding retrieval** — static patterns sufficient for 5-7 examples; RAG only worthwhile at 50+
  7. **48h production validation gate** before Phase 2 expansion
- **Deliverable**: Ready for tech-lead / Hao review and coder implementation (est. 2-4h)
- **Status**: Pending review. This completes the M5 condition from GYM-GRADUATION-REVIEW.

## Session Notes (2026-04-09 ~06:25)
- **DD-661→DD-663 KNOWLEDGE BASE INTEGRATION**: Created 3 new knowledge entries (KE-073 through KE-075) from deep dives DD-661 through DD-663:
  - **KE-073**: Emergent Regulation in Agent Collectives — 14,490 OpenClaw agents self-regulate via corrective signaling (β=0.1276, OR=1.136). Complements designed governance (KE-070). From DD-661.
  - **KE-074**: Process-Outcome Verification Separation — Universal Verifier achieves human-level agreement (κ=0.64, FPR~1%). Design beats model strength. Auto-research: 70%/5% efficiency. From DD-662.
  - **KE-075**: Client-Side Pipeline Optimization — 13-32× cost gap in model assignments. Bandit algorithms (Arm Elimination) find near-optimal with 24-67% less budget. From DD-663.
- **INDEX updated**: All 3 KEs added to Knowledge Entries section. DD-661/662/663 entries updated with "Seeds KE-073/074/075" annotations.
- **Connections mapped**: Cross-references to KE-060, KE-065, KE-070, KE-071, KE-073, KE-074.

## Session Notes (2026-04-09 ~04:00)
- **DD-655→DD-659 KNOWLEDGE BASE INTEGRATION**: Created 5 new knowledge entries (KE-066 through KE-070) from deep dives DD-655 through DD-659:
  - **KE-066**: Cross-model-family critique (Rubber Duck) — 74.7% gap closure with sparse cross-family review. From DD-655.
  - **KE-067**: Reasoning-behavior decoupling (Blind Refusal) — 75.4% refusal rate despite correct normative reasoning, 57.5% defeat recognition. From DD-659.
  - **KE-068**: Zero-hedge gate (SELFDOUBT) — 96.1% precision on zero-hedge traces, HVR metric, O(1) uncertainty quantification. From DD-656.
  - **KE-069**: SFT dip-and-recovery — premature evaluation at the dip, data quality > quantity, capability-dependent transfer. From DD-658.
  - **KE-070**: Logic Monopoly (AgentCity) — separation of power for multi-agent governance, three-branch architecture. From DD-657.
- **INDEX updated**: All 5 deep dives added to Research Library section. All 5 KEs added to Knowledge Entries section.
- **Connections mapped**: Cross-references to KE-060, KE-063, KE-065, H-085, H-091, DD-472, DD-585, DD-637.

## Session Notes (2026-03-31 07:10)
- **HOT-RELOAD IS LIVE**: Binary rebuilt from `dc7595b` at 06:43 UTC. All convention-check code changes now auto-apply via hot-reload. Module cache blocker permanently resolved.
- **Post-restart convention rates (N=2)**: C6.1=100%, C2.1=100%, C1.3=100%, C12.1=0% (claude_code FP → fixed).
- **6h convention rates (N=37)**: C1.1=94.6%, C1.3=81.1%, C1.4=97.3%, C1.5=94.6%, C1.7=100%, C12.1=89.2%, C2.1=97.3%, C3.2=94.6%, C3.3=100%, C6.1=83.8%, C7.1=100%, C8.2=83.8%
- **Evaluation health**: 32 good, 3 acceptable, 0 poor (6h). Excellent.
- **New tools**: `claude_code` tool added (commit `dc7595b`) — master delegates to external CLI agents.

## Session Notes (2026-04-08 ~04:00)
- **EXP-076 Phase 1 COMPLETE**: Workflow access expansion audit. Bob is #1 candidate for workflow tool access (score 13/15). 99.9% of Bob's sessions run unprotected. 100% of Bob's tasks are judgment-intensive. FM-3.3 (verification) and FM-2.6 (tool misuse) directly addressable by workflow guard. `deliver-or-report` workflow already exists. Action needed: May/Hao add `"workflow"` to `agents/bob/agent.json` + heartbeat instruction for WORK SESSION tasks.
- **EXP-075 CLOSED**: CTA deployment to Bob's heartbeat — baseline at ceiling (3/3 pass, 6/6). Treatment skipped. CTA already works.
- **Skill pruning CONFIRMED COMPLETE**: Optimizer executed. Coach 20→3 .md skills, Evaluator 13→5 .md skills. KE-025 compliance achieved.
- [x] **EXP-080 integration**: COMPLETE. KE-057 updated with L2 skill evidence (67% vs L3's 100%). H-089 P(H) 0.65→0.70 with EXP-080 dosage model. INDEX.md KE-057 + H-089 entries updated. PRIORITY-TRACKER H-089 updated.
- [x] **EXP-077 integration**: COMPLETE. KE-053 updated with EXP-077 findings. INDEX.md updated with EXP-077 row.
- **Systemic finding from EXP-076**: C12.1 fails across ALL agents (14.6%–58.9% pass rate). This is the single worst convention system-wide. Not agent-specific — needs systemic fix.

## Session Notes (2026-04-08 ~09:50)
- **INTEGRATION SESSION**: EXP-083 baselines, EXP-084, KE-059, H-091 all integrated into knowledge base.
- **PRIORITY-TRACKER updated**:
  1. H-091 added to Tier 1 (P(H)=0.75) — skill delivery methods between text rules and workflow enforcement
  2. EXP-084 added to experiment queue (COMPLETE — H-091 SUPPORTED)
  3. EXP-083 status updated (BASELINES COMPLETE — Phase 2 running)
  4. Meta-process section updated: 10 high confidence (was 9), H-091 added to list
  5. Header updated with current state
- **H-089 updated**: P1 prediction now shows BASELINES COMPLETE with full quantitative results (100% visible, 0% silent across both domains). Phase 2 treatment runs running via Coach.
- **Connections noted**: H-091 partially bridges H-043's utilization dead zone — few-shot examples achieve measurable transfer (P(applies) > 0) where text rules and pushed declarative knowledge both = 0%. This is the first empirical evidence of intermediate delivery methods.
- **EXP-083 Phase 2 COMPLETE**: Treatment runs on truncated-env-repair-xref and truncated-schema-migration-xref finished. 24/24 silent checks passed (100%), p<0.0001. H-089 P1 CONFIRMED. H-089 promoted to Tier 1 (P(H) 0.70→0.92).

## Session Notes (2026-04-08 ~08:20)
- **EXP-083 DESIGNED**: Cross-Reference Generalization — Multi-Domain Absent-Information Test. Tests H-089 P1 (cross-reference generalizes across domains).
- **4 new gym scenarios created**:
  1. `truncated-env-repair` — .env truncated (4 of 8+ vars present). 6 visible failures (tests show), 2 silent failures (webhook vars — only in source). Baseline.
  2. `truncated-env-repair-xref` — Same + cross-reference instruction in task.md + injected_context.md skill. Treatment.
  3. `truncated-schema-migration` — SQL schema truncated (4 of 7 columns). 1 visible failure (role — tests show), 2 silent failures (avatar_url, last_login — only in user-model.js). Baseline.
  4. `truncated-schema-migration-xref` — Same + cross-reference instruction + injected_context.md skill. Treatment.
- **All success criteria tested and verified**: Broken state fails correctly. Visible-only fix gets "Partial fix: Agent did NOT cross-reference..." message. Complete fix passes all checks.
- **H-089 updated**: P1 status → EXP-083 DESIGNED. Next Experiments section → EXP-083 ready to run. Cross-reference added to experiments list.
- **Experiment design filed**: `agents/shared/knowledge/experiments/EXP-083/design.md`
- **Protocol**: Phase 1 baselines (N=6 × 2 scenarios), Phase 2 treatments (N=6 × 2 scenarios). 24 total runs.
- **Ready for Coach**: Baselines can be run by Coach using standard gym infrastructure.

## Session Notes (2026-04-08 ~07:05)
- [x] **EXP-081 + EXP-082 integration**: COMPLETE. Both experiments now fully integrated into knowledge base.
- **EXP-081 (KE-002 Reexamination)**: Already integrated by Coach — KE-002 updated (0/32 across 5+ categories), INDEX.md has experiment row. No additional updates needed.
- **EXP-082 (Knowledge Application Pipeline)**: Integrated into:
  1. **H-043**: Evidence §11 added (P(applies|pushed) ≈ 0). P(applies) table expanded with knowledge-type breakdown. P(H) 0.82→0.85. References and date updated.
  2. **INDEX.md**: EXP-082 experiment row added after EXP-081.
  3. **PRIORITY-TRACKER**: H-043 probability corrected (0.72→0.85 — was stale, file said 0.82, now 0.85 with new evidence).
- **KE-058 (Injected Declarative Knowledge No Effect)**: Already existed from Coach's experiment run. No updates needed.
- **Key synthesis**: The utilization dead zone is now formally complete in H-043. For judgment-type declarative knowledge: P(access) ≈ 0 for pull AND P(applies) ≈ 0 for push. BOTH delivery mechanisms fail. Only structural form conversion (workflows, forced externalization) achieves non-zero U. This is the strongest empirical constraint on our system improvement strategy.

## Session Notes (2026-04-08 ~06:04)
- **H-089 FILED**: Environmental Evidence Discovery — A General Complement to Externalization. Filed as `knowledge/hypotheses/H-089-environmental-evidence-discovery.md`.
- **Core claim**: When agents fail because they lack information that exists in the environment (source code, schemas, tests), instructing them to discover that evidence closes the performance gap — even when externalization (self-reflection) has no effect.
- **Two-mechanism model**: H-085 covers present-but-wrong failures (analysis activation); H-089 covers absent-information failures (evidence discovery). Together they form a complete intervention taxonomy for recognition failures.
- **Evidence**: EXP-079 0%→100% (+100pp) on absent-field via cross-reference. EXP-078 externalization 0% (same as baseline). N=3, single scenario.
- **P(H) = 0.65**: Strong effect (+100pp, 100% consistency) but single scenario (N=3). Would rise to 0.80 if cross-reference generalizes to 2+ additional absent-information scenarios.
- **Five testable predictions**: P1 (generalization to other absent-info scenarios), P2 (evidence type ranking), P3 (independence from externalization via 2×2 factorial), P4 (generalization beyond config repair), P5 (high agent compliance ≥90%).
- **Registered in**: INDEX.md (hypothesis table), PRIORITY-TRACKER.md (Tier 2, active count 16→17).
- **Files created**: `knowledge/hypotheses/H-089-environmental-evidence-discovery.md`
- **Files modified**: `knowledge/INDEX.md`, `knowledge/hypotheses/PRIORITY-TRACKER.md`, `agents/bob/workspace/todo.md`

## Session Notes (2026-04-08 ~05:05)
- **EXP-078 KNOWLEDGE BASE INTEGRATION**: Coach ran externalization on L3 absent-field detection (ambiguous-context-drift-L3). 0/3 pass — no improvement over 0% baseline. Agent wrote ANALYSIS.md but never listed missing `max_age` field because original config was deleted.
- **INDEX.md UPDATED**: EXP-078 row added after EXP-077.
- **H-085 UPDATED (4 changes)**: (1) Formal statement adds condition 4: "problem information must be present in the environment." (2) EXP-078 row in convergence table (0% → 0%, 0pp). (3) Aggregate adjusted: 51/57 across 12 scenarios (was 55/60 across 13 — corrected). (4) Recognition sub-boundary section added. (5) Source line + footer updated. P(H) stays 0.92.
- **KE-054 UPDATED**: Decision rule table extended with "Missing field/element detection (no schema)" → ❌ Do not deploy.
- **Key insight formalized**: Externalization has a *recognition sub-boundary*: helps "present-but-wrong" (agent can examine existing elements and notice mismatch) but NOT "absent-field" (agent has no schema reference for what should exist). This is a fundamentally different failure mode — it's not a judgment failure but an information absence.

## Session Notes (2026-04-08 ~04:35)
- **KE-053 UPDATED WITH EXP-077 FINDINGS**: Integrated Coach's EXP-077 (Fidelity Ladder) results into KE-053. Three major additions:
  1. New "EXP-077: Fidelity Ladder" subsection under Evidence with full results table and 5 critical findings
  2. Gap hierarchy revised from 5 co-equal gaps to prioritized stack: cascading state (PRIMARY) >> deliverable completeness (SECONDARY) >> context noise ≈ task ambiguity (NEGLIGIBLE)
  3. Each structural gap annotated with EXP-077 findings (Gap 1: NEGLIGIBLE, Gap 2: SECONDARY, Gap 3: PRIMARY)
- **EXP-077 ADDED TO INDEX.md**: New experiment table row after EXP-074 with full results summary
- **Quantitative summary expanded**: 3 new EXP-077 rows added (L1: 67%, L2: 100%/0%, L3: 0%)
- **Links updated**: EXP-077 synthesizes link + KE-007 confirms link added
- **Key insight**: Cascading state from failed sessions (information loss) is the primary driver of the gym-production gap. Context noise and task ambiguity are negligible for core work. This narrows the intervention target significantly.

## Session Notes (2026-04-08 ~02:10)
- **KE-SUMMARIES COMPLETE**: Extended from 19 entries (KE-001–KE-019) to all 57 entries (KE-001–KE-056 including KE-028a/b split). 38 new summaries added covering all knowledge entries from EXP-028 onward.
- **INDEX.md GAPS FIXED**: 8 missing entries (KE-014, KE-016, KE-017, KE-021, KE-022, KE-023, KE-024, KE-026) added to INDEX table. All 56 unique KE IDs now present and in order.
- **Knowledge base audit findings**: 56 KE files on disk, 57 summary entries (KE-028 has two files: security + sycophancy), all now indexed and summarized. No orphan files, no missing entries.
- **KNOWLEDGE APPLICATION AUDIT**: Created `agents/shared/knowledge/KNOWLEDGE-APPLICATION-AUDIT.md`. Three major gaps identified:
  1. **KE-025 violation**: Coach (20 skills) and Evaluator (13 skills) have excessive context files — our own data says this hurts
  2. **KE-029 undeployed**: Classify-then-act (+60pp on sycophancy) verified but not in any production agent
  3. **KE-056 not applied**: Constraint hierarchy shows L1-L2 interventions have 0% effectiveness, but we still default to them
- **Action items dispatched**: P0 skill pruning (Optimizer), P1 CTA deployment (Coach), P1 constraint hierarchy gate (Bob self-deploy)

## Session Notes (2026-04-08 ~01:40)
- **H-087 P3 RETROSPECTIVE COMPLETE**: Analyzed all 61 experiments (51 completed). Designed experiments produce KE entries 2.05x more often than ad-hoc (78.9% vs 38.5%, p≈0.013). P3 prediction of ≥2x confirmed. Analysis at `agents/shared/knowledge/experiments/H087-P3-retrospective-analysis.md`.
- **H-087 P(H) updated**: 0.65 → 0.72. Modest increase due to correlational nature and three confounds (temporal, ambition, author maturation).
- **Additional metrics**: Hypothesis resolution 1.82x, named hypothesis testing 2.39x, actionability 1.61x — all favor designed experiments.
- **Key confound**: Temporal — early experiments were all designed AND explored virgin territory. The "design causes better results" claim is supported but not proven.

## Session Notes (2026-04-08 ~00:35)
- **KE-056 WRITTEN**: The Constraint Hierarchy — Workaround Availability Dominates Instructional Interventions. Synthesizes the full EXP-070→073 arc (30 runs, 6 conditions) into a five-level constraint hierarchy: L5 action-space restriction > L4 mechanical enforcement (100%) > L3 experiential feedback (67%) > L2 instructional binding (0%) > L1 text instructions (0%) > L0 no intervention (0%).
- **Core insight formalized**: Workaround availability is the single dominant variable. Critical discontinuity between L3 and L4. Two gap types: drift gap (fixable with binding when workarounds blocked) vs attraction gap (requires mechanical enforcement).
- **KE-043 hierarchy extended**: Domain-specific calibration added — L4 splits into L4a (convergent/judgment, 100%), L4b (divergent/debugging+workarounds, 0%), L4c (divergent/debugging+blocked, 100%).
- **Cross-references updated**: KE-043, KE-054, KE-055, KE-041 all updated with back-references to KE-056.
- **INDEX.md updated**: KE-056 row added after KE-055.
- **Files created**: `knowledge/entries/KE-056-constraint-hierarchy-workaround-availability.md`
- **Files modified**: `knowledge/INDEX.md`, `KE-043-forced-externalization-complete-picture.md`, `KE-054-externalization-boundary-judgment-vs-debugging.md`, `KE-055-binding-closes-analysis-action-gap.md`, `KE-041-structural-constraint-stigmergic-coordination.md`

## Session Notes (2026-04-08 ~00:32)
- **EXP-073 Phase 2 PROCESSED**: Coach ran v2-commit cross-validation (6 runs). Binding FAILS on v2: 0/6 pipeline reorder despite 4/6 writing FIX_PLAN.md with reorder. H-088 partially disconfirmed — P(H) 0.92→0.70. Workaround availability is the critical boundary.
- **INDEX.md consistency fix**: Updated KE-055, H-088, EXP-073 rows to reflect Phase 2 partial disconfirmation. Coach had updated H-088.md, KE-055.md, and PRIORITY-TRACKER but missed INDEX.md.
- **Key insight from full EXP-070→073 arc**: The dominant variable is workaround availability, not externalization or binding. When workarounds are mechanically blocked (v3), everything works (100%). When they exist (v2), nothing tested closes the gap. Two distinct gap types: drift gap (fixable) vs attraction gap (fundamental). Hierarchy: mechanical enforcement > experiential feedback > instructional binding.
- **Next research directions**: (1) Mechanical enforcement on v2 (scorer rejects workarounds at implementation review), (2) Graduated workaround availability (is there a threshold?), (3) Generalization of binding to other constrained scenarios.

## Session Notes (2026-04-07 ~23:33)
- **EXP-073 COMPLETE — H-088 CONFIRMED**: 3/3 (100%) with FIX_PLAN.md binding vs. 0/6 (0%) EXP-071 control. Analysis-action gap fully closed. P(H) 0.65→0.92. KE-055 filed. All knowledge base updates complete.
- **New scenario created**: `agents/gym/scenarios/cascading-fix-trap-v2-commit/` — 3-phase task (analyze → commit → fix). 13-check scorer extends v2-ext with FIX_PLAN.md checks. Smoke-tested: 6/13 pass on unmodified environment (expected).
- **Design rationale**: EXP-071 showed 6/6 correct analysis but 0/6 correct implementation. H-088 predicts that adding a FIX_PLAN.md commitment step between analysis and implementation will close this gap. The plan requires specific file-level changes that create self-consistency pressure with the analysis.
- **Next**: Run 6 treatment sessions on cascading-fix-trap-v2-commit, score, compare against EXP-071's 0/6 pipeline reorder rate.
- **Files created**: `knowledge/experiments/EXP-073/design.md`, `gym/scenarios/cascading-fix-trap-v2-commit/` (scenario.json, task.md, success_criteria.js, environment/, package.json)
- **Files modified**: `knowledge/INDEX.md` (EXP-073 row), `knowledge/hypotheses/PRIORITY-TRACKER.md` (header, queue entry)

## Session Notes (2026-04-07 ~23:05)
- **EXP-072 KNOWLEDGE BASE INTEGRATION COMPLETE**: All 6 files updated with EXP-072 results.
- **H-085**: Status updated — boundary CONFIRMED (not just discovered). 55/60 runs pass (added EXP-072's 4/6). P(H) stays 0.92 (boundary already priced in from EXP-071). Key finding: externalization DEGRADES on workaround-resistant scenarios (100% baseline → 67% with ext).
- **H-087**: Indirect support added — scenario-level architecture (harness level) > task-level externalization for debugging. Validates the level hierarchy.
- **H-088**: P(H) 0.60→0.65. Analysis-action gap re-confirmed (2/6 v3-ext correct analysis → workaround anyway). EXP-072's "Two Competing Approaches" section updated with results.
- **KE-043**: §8 added (EXP-072 full writeup). Source/confidence line updated (9 experiments, 79+ runs). Open question 7 updated. Cross-references expanded.
- **PRIORITY-TRACKER**: Header, H-088 table entry, experiment queue all updated.
- **INDEX.md**: H-085 and H-088 entries updated. EXP-072 row added.
- **Key insight**: Scenario architecture (blocking workarounds mathematically) is the superior approach for debugging-class tasks — 100% vs 67% with externalization. But scenario architecture doesn't generalize to real tasks where workarounds can't be pre-blocked. H-088's implementation commitment remains the candidate for general-purpose analysis-action gap closure.

## Session Notes (2026-04-07 ~22:33)
- **H-088 FORMALIZED**: Implementation Commitment Externalization — closing the analysis-action gap requires fix-path externalization. P(H) = 0.60. When multiple valid fix paths exist and analysis externalization achieves correct diagnosis but not correct implementation, adding a FIX_PLAN.md commitment step (gated against the analysis) should close the gap. Five predictions: P1 (fix-path externalization closes gap on cascading-fix-trap-v2), P2 (implementation commitment independently necessary), P3 (generalizes beyond cascading-fix-trap), P4 (commitment must be specific), P5 (plan-implementation deviation predicts failure). P1 immediately testable.
- **PRIORITY-TRACKER updated**: H-088 added to Tier 2 (P(H) 0.60). Active count 15→16. Meta-process section updated.
- **INDEX.md updated**: H-088 added to hypothesis table.
- **Files created**: `knowledge/hypotheses/H-088-implementation-commitment-externalization.md`
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-07 ~22:03)
- **H-087 FORMALIZED**: Constitutional Externalization — forced externalization operates at three recursive levels (task, harness, constitution) with the same write → gate → act structure. P(H) = 0.65. Four predictions: P1 (constitutional-level externalization improves governance decisions), P2 (analysis-action gap scales with level), P3 (retrospective experiment success rate correlates with externalization completeness), P4 (removing externalization at any level degrades below it). EXP-072 tests P1/P2. P3 testable immediately from existing data.
- **PRIORITY-TRACKER updated**: H-087 added to Tier 2 (P(H) 0.65). Active count 14→15.
- **INDEX.md updated**: H-085 + H-087 both added to hypothesis table (H-085 was missing from INDEX tables).
- **Files created**: `knowledge/hypotheses/H-087-constitutional-externalization.md`
- **Files modified**: `knowledge/hypotheses/PRIORITY-TRACKER.md`, `knowledge/INDEX.md`

## Session Notes (2026-04-07 ~21:05)
- **EXP-070 numbering collision RESOLVED**: Coach committed cascading-fix-trap-v2 baselines as EXP-070 results, colliding with Bob's EXP-070 (externalization on ambiguous-context-drift). Resolution: results moved to EXP-071/baselines.md; EXP-070/results.md replaced with collision note; INDEX.md updated.
- **EXP-071 COMPLETE — BOUNDARY CONDITION FOUND**: Treatment 83% (+5.6pp from 78%). 6/6 correct root cause analysis but 0/6 pipeline reorder. First analysis-action gap.
- **New failure pattern confirmed — "workaround satisficing"**: Agent consistently finds partial workaround (threshold fix + penalties hack) instead of root cause (pipeline ordering). Externalization improves analysis quality but NOT implementation choice. Analysis-action gap is a novel boundary condition for H-085.
- **H-085 updated**: EXP-071 treatment results integrated. Boundary condition documented. P(H) reduced from 0.97 to 0.92. Formal statement's "≥90%" prediction partially falsified.
- **KE-043 updated**: §7 updated with treatment results and analysis-action gap. Open question #8 added (analysis-action gap mechanism). Cross-references updated.
- **PRIORITY-TRACKER updated**: H-085 status, P(H), and EXP-071 queue entry all updated.
- **INDEX.md updated**: EXP-071 marked complete with boundary condition summary.

## Session Notes (2026-04-07 ~14:03)
- **EXP-053 Phase 2 COMPLETE**: Retrospective natural experiment on KB growth and utilization.
  - **Citation Freshness Decay**: Strong recency bias — Era 4 entries point 85% to Era 3+ (recent), only 7% to Era 1 (foundational). Down from 66%/23% in Era 3. Hub-and-spoke structure: KE-002 (21 cites), KE-007 (13 cites), KE-001 (7 cites) dominate; 12/15 Era 1 entries avg only 1.2 citations.
  - **Cross-Reference Density**: Absolute refs increase (1.3→6.0/entry) — AGAINST H-047 prediction. But normalized density drops: 0.22→0.07→0.17→0.13. Era 2 saw sharpest decline, Era 3 recovered (topic pages + thematic clustering).
  - **Topic Index Emergence**: Created Apr 4 at KE=17, INDEX=260 lines — qualitative stress signal.
  - **Overall**: 2/4 analyses support H-047, 1 contradicts, 1 inconclusive. Pattern is "narrowing scope with compensation" not clean inverted-U.
  - **P(H) update**: H-047 0.56 → 0.62 (weakly supported).
  - **Results file**: `knowledge/experiments/EXP-053/results-phase2.md`

## Session Notes (2026-04-07 ~13:34)
- **EXP-053 Designed**: 3-phase experiment testing H-047 (Memory Lifecycle Gap — inverted-U knowledge utilization).
  - **Phase 1**: Controlled KB-size gym A/B/C test (minimal 10 entries vs full 52 entries vs curated 15 entries). 5 scenarios × 3 conditions × 3 reps = 45 runs. Tests whether more knowledge helps or hurts.
  - **Phase 2**: Retrospective natural experiment — citation freshness decay, cross-reference network density, hypothesis resolution rate, topic index emergence as stress signal. Free (~$0).
  - **Phase 3**: Minimal intervention — hide 37/52 KE entries for 5 heartbeat sessions, compare quality to 5 control sessions.
  - **Key prediction**: Condition B (full KB) ≤ Condition A (minimal KB) would confirm inverted-U. Condition C (curated) > Condition B would confirm curation > accumulation.
  - **Recommended order**: Phase 2 first (free, immediate data), then Phase 1.
- **Files created/modified**: `knowledge/experiments/EXP-053/protocol.md` (new), `PRIORITY-TRACKER.md` (EXP-053 added to queue), `INDEX.md` (EXP-053 row added), `H-047-memory-lifecycle-gap.md` (updated ownership section).

## Session Notes (2026-04-07 ~12:33)
- **Topic Pages Updated**: All 10 topic pages (01-10) updated with Knowledge Entries (KE-043+) sections. Each KE mapped to relevant topics with topic-specific annotations.
- **Coverage**: 9 KE entries (KE-043 through KE-051) cross-referenced across 10 topic pages. 21 total cross-references. Every KE appears in ≥1 page; every page has ≥1 KE.
- **Mapping**: KE-043 → 01,07,08 (forced ext); KE-044 → 03,08 (verification separation); KE-045 → 01,09 (social pathology); KE-046 → 04 (reasoning crisis); KE-047 → 07,10 (harness architecture); KE-048 → 05,06 (safety stack); KE-049 → 02,07,10 (interface formalization); KE-050 → 01,08,09,10 (robustness-architecture); KE-051 → 03,06 (self-governance).

## Session Notes (2026-04-07 ~11:33)
- **KE-050 written**: Robustness-Architecture Nexus — synthesized DD-635 (brittleness/perturbation), DD-636 (beyond fixed tests), DD-637 (self-optimizing MAS), DD-638 (subgraph sociality), CR-315. Core finding: agent robustness is determined by architecture (topology, harness, evaluation) not model capability. Robustness Stack: Topology > Harness > Evaluation > Model. Key concepts: Memorization-Robustness Inverse, 5th conformity paradox manifestation (topological). Extends KE-043/045/047.
- **KE-051 written**: Self-Governance Stack — synthesized DD-628 (self-execution simulation), DD-629 (vocabulary dropout), DD-630 (evolved UQ), CR-313. Three independently converged governance layers: L1 Self-Verification, L2 Diversity Enforcement, L3 Meta-Verification. Critical self-assessment: our system has L1 partial, L2 absent (biggest gap), L3 human-dependent. Proposes Law 50. Extends KE-038/043/044/045/047.
- **Drops processed**: All 5 files moved from drops/ to library/ (4 DDs → deep-dives/, 1 CR → cross-references/). Drops directory empty.
- **INDEX.md updated**: KE-050, KE-051 added to knowledge entries table; DD-635/636/637/638 and CR-315 added to Research Library section.

## Session Notes (2026-04-07 ~09:33)
- **Hypothesis Corpus Cleanup**: Resolved 11 hypotheses, satisfying the moratorium (required 5+). Active corpus reduced from 26 (with archived) to 15 clean, evidence-backed hypotheses.
- **Resolutions by type**:
  - ❌ **DISCONFIRMED (1)**: H-001 (adversarial QA framing — EXP-038 showed it HURT evidence discipline)
  - 📦 **SUPERSEDED (1)**: H-002 (weaker model context benefit → superseded by H-059 cadence skill)
  - 📦 **RECLASSIFIED as design principles (3)**: H-034 (session fragility), H-038 (transient skills), H-039 (decomposition bottleneck) — all true but unfalsifiable
  - 📦 **ARCHIVED for insufficient evidence (3)**: H-046 (coupled resources), H-048 (dynamic topology), H-051 (abstention R-estimator) — zero data, chain dependencies
  - 📦 **ABSORBED/MERGED (2)**: H-052 (epistemic fragility → into H-058/KE-048), H-064 (self-preservation → into H-055/H-056)
  - 📦 **OUT OF DOMAIN (1)**: H-065 (tool safety guardrails — requires model-level changes)
- **H-009 promoted to Tier 1** (P=0.85): 4 phases deployed, EXP-039 Phase B confirmed selective bias, Phase C live.
- **Moratorium lifted**: New hypotheses may be created if falsifiable, P(H) prior ≥ 0.40, connected to empirical evidence.
- **Files modified**: PRIORITY-TRACKER.md (major rewrite), H-001.md, H-002.md, H-034-session-fragility.md, H-038-transient-skill.md, H-039-decomposition-bottleneck.md, H-052-epistemic-fragility-stack.md

## Session Notes (2026-04-07 ~09:03)
- **KE-044 written**: Verification Separation Thesis — synthesized DD-523 (CORAL), DD-528 (SEVerA), DD-529 (Hermes), DD-532 (EvoSkills), DD-540 (Steve-Evolving) into a comprehensive knowledge entry on the convergent requirement that self-evolution requires architecturally separated verification.
- **Key findings**: (1) Five independent systems from 6+ institutions, 3 continents, zero shared authors converge on identical structural requirement. (2) Four distinct separation mechanisms identified: multi-agent cross-evaluation, formal contracts, information isolation, execution-layer diagnostics. (3) **Meta-insight**: verification separation IS forced externalization (KE-043) — the same mechanism operating at the meta-learning level rather than the task level. (4) Strong external validation of H-055 (Self-Improvement Paradox). (5) Five shared primitives: external verification authority, dual-track knowledge extraction, diagnostic granularity beyond binary, anti-gaming architecture, persistent accumulation with distillation.
- **INDEX.md updated**: KE-044 added to Verified knowledge entries table.
- **Unifying connection**: KE-043 (forced externalization works at task level) + KE-044 (verification separation works at evolution level) = same structural principle at different scales. Joins KE-033 (scale invariance) and KE-038 (constitutional recursion) in the multi-level enforcement family.
- **KE-045 written**: Multi-Agent Social Pathology — synthesized DD-534 (power laws/intellectual elites), DD-535 (sycophancy propagation), DD-520 (NARCBench collusion detection), DD-538 (Holos ecological MAS) into knowledge entry on emergent structural diseases in multi-agent systems.
- **INDEX.md updated**: KE-045 added to Verified knowledge entries table.
- **Three-level hierarchy complete**: KE-043 (individual task) → KE-044 (self-improvement) → KE-045 (multi-agent social). Each level has different failure modes but same structural principle: systems cannot reliably evaluate themselves without structural intervention.
- **KE-046 written**: Reasoning Depth Crisis — synthesized DD-541 (BenVanik quantitative analysis, 17,871 thinking blocks, r=0.971) and DD-556 (Claude Code Effort Crisis, 590 HN pts, Anthropic official confirmation) into knowledge entry on how reasoning budget reduction causes invisible, multiplicative quality collapse. Extends hierarchy to four levels: individual → self-improvement → social → infrastructure.
- **INDEX.md updated**: KE-046 added to Verified knowledge entries table.
- **KE-047 written**: Agent Harness Architecture Convergence — synthesized DD-517 (Raschka 6-component), DD-521/DD-524 (Imbue mngr 100+ agents), DD-530 (OpenHarness 4.8k★). Ten convergent subsystems identified: six irreducible core, one near-universal, three emerging. 1:1 mapping to software engineering patterns. Strongest validation of harness engineering thesis (H-036).
- **INDEX.md updated**: KE-047 added to Verified knowledge entries table.
- **KE-048 written**: Agent Safety Stack — synthesized DD-518 (Carlini Linux kernel CVEs), DD-526 (OpenClaw privilege escalation), DD-533 (Lean-Agent Protocol), DD-557 (Wikipedia AI Tom), DD-588 (EU law mapping). Five-layer stack: L1 Vulnerability Discovery → L2 Infrastructure Security → L3 Formal Verification → L4 Social Governance → L5 Regulatory Compliance. Three cross-cutting patterns: offense-defense asymmetry, self-attestation failure, static-dynamic mismatch.
- **INDEX.md updated**: KE-048 added to Verified knowledge entries table.
- **KE-049 written**: Agent-Environment Interface Formalization Ceiling — synthesized DD-539 (MemCoder, ICML SOTA SWE-bench), DD-542 (MatClaw 4-layer memory), DD-543 (Schema-First Tool APIs), DD-566 (Agent HTTP behavioral signatures). Core finding: structural formalization eliminates mechanical errors but leaves reasoning errors untouched. Six-level formalization ladder; ceiling between L2 (diagnostics) and L3 (semantic constraints). All 24 previously-unreferenced DDs now covered by KE entries.
- **INDEX.md updated**: KE-049 added to Verified knowledge entries table.

## Session Notes (2026-04-07 ~08:04)
- **KE-043 written**: Forced Externalization — The Complete Empirical Picture. Synthesized EXP-045 through EXP-049 into a comprehensive knowledge entry covering all five experiments, four failure domains, and the unified mechanism model.
- **Key contributions**: (1) Unified evidence stack: 60+ runs, 100% ext pass rate vs 0-50% baselines across tunnel vision, sycophancy, contradiction blindness, and proxy-satisfying behavior. (2) Mechanism definitively identified as "analysis activation" (behavioral mode shift), NOT content provision, commitment, or anchoring. (3) Intervention hierarchy formalized: reward shaping (0%) < text skills (0%) < hard workflow (100%). (4) Integrates KE-029 through KE-036 + KE-041 into single reference. (5) Five open questions identified for future work.
- **INDEX.md updated**: KE-043 added to Verified knowledge entries table.

## Session Notes (2026-04-07 ~06:33)
- **KE-041 written**: Structural Constraint and Stigmergic Coordination — synthesized DD-589 (C-MADF causal cyber defense) and DD-594 (Ledger-State Stigmergy) into a knowledge entry identifying two dual design primitives.
- **Key findings**: (1) Forced externalization IS causal action-space restriction (DD-589) — both work by eliminating invalid options, not discouraging them. Hierarchy: reward shaping (0%) < text rules (0%) < soft workflows (partial) < hard gates (100%) < full action-space restriction (6.2× FPR↓). (2) Our knowledge base IS stigmergic coordination (DD-594) — agents modify shared environment, others read and respond, no direct messaging. But we've designed it as a filesystem, not as an optimized stigmergic medium. (3) Behavioral Divergence Score proposed as runtime R-estimator from DD-589's dual-policy architecture. (4) Configurable decay needed — DD-594 predicts H-047 inverted-U from a second theoretical tradition. (5) Candidate H-090 proposed (stigmergic coordination advantage) — deferred per moratorium.
- **INDEX.md updated**: KE-041 added to knowledge entries table; DD-589, DD-594 added to Research Library.
- **13th-14th independent convergences** on structural enforcement thesis (from adversarial cybersecurity and biological coordination theory).

## Session Notes (2026-04-07 ~05:33)
- **KE-040 written**: Memory Architecture Convergence — synthesized DD-590/591/592/593 into a knowledge entry on active memory substrate. Five shared primitives identified across four independent systems: write-gating, consolidation/forgetting, active middleware, hybrid retrieval, role-aware routing.
- **INDEX.md updated**: KE-040 added to knowledge entries table; DD-590/591/592/593 added to Research Library.
- **Key insight**: Passive storage is the fundamental failure mode — all four papers independently converge on memory as an active computational layer, not a retrieval database. This extends WKWA-004 and directly addresses H-043 utilization bottleneck.

## Session Notes (2026-04-04 ~14:15)
- **Bayesian Hypothesis Scoring**: Applied continuous P(H) scores to all 23 active hypotheses. Created SCORECARD-bayesian-2026-04-04.md with full methodology.
- **Results**: 3 high confidence (H-055, H-053, H-059), 8 moderate, 7 low, 4 archive candidates.
- **H-066 created**: Bayesian Belief Management hypothesis — the meta-process for managing the corpus. P1 confirmed (7 hypotheses below 0.40, predicted ≥5).
- **PRIORITY-TRACKER updated**: All tiers now use quantitative P(H) scores instead of qualitative labels. Active count reduced from 23→17. Moratorium enforced (H-060-065 triaged).
- **Key contradiction surfaced**: H-060 (hierarchy > flat) vs H-061 (constrained communication helps flat). Needs resolution.
- **CR#279 actions**: Bayesian belief updates and progressive evidence requirements now DONE. 2/5 completed this session.

## Session Notes (2026-04-04 ~13:45)
- **Memory Architecture Stack synthesis**: Connected DD#501-504 to H-043. Proposed 4-layer architecture (Gating → Store Typing → Governance → Role Routing). Added to INDEX.
- **New material absorbed**: DD#501-511, CR#279, KE-018/019, H-059-065, HB-0119-0125, HB-250409-250414. Rich batch focused on memory architectures, belief management, and sycophancy.
- **Key insight**: Knowledge utilization is a delivery problem, not a production problem. Four independent ICLR 2026 research groups confirm.
- **BACE connection**: DD#511 provides the technical blueprint for Bayesian hypothesis confidence scoring. Directly implements CR#279's recommendation.

## Session Notes (2026-04-04 ~06:45)
- **Materialization Paradox identified**: EXP-022 breaks KE-002's 0/20 barrier. Cadence skills ≠ judgment skills.
- **New cross-ref written**: `cross-ref-materialization-paradox.md` — highest-value synthesis this session.
- **Hypothesis files**: All 36 scanned at title/status level. H-055 (Self-Improvement Paradox) and H-053 (Workflow Adoption Decay) are the strongest hypotheses, both with rich empirical data.
- **Phase 2 Knowledge Compilation**: Completed last session — 10 topic index files live.

## Session Notes (2026-04-07 ~19:34)
- **EXP-070 DESIGNED**: Externalization treatment on ambiguous-context-drift (EXP-068's first non-ceiling injected_context scenario, baseline 67%). Phase 1: extended baseline N=10. Phase 2: treatment N=10. Phase 3: diagnostic analysis. Tests whether H-085 can close the documentation-parroting gap.
- **H-019 UPDATED**: Added DD#570 (SKILL0 deep-dive) evidence — confirms skill internalization maps to tiered memory architecture. Dynamic curriculum = automated consolidation scheduler. Challenges harness-only optimization thesis.
- **Deep-dives absorbed**: DD-569 (御舆 Claude Code book — 420K words, 5th harness engineering convergence), DD-570 (SKILL0 internalization), DD-584 (Springdrift — 7th harness convergence from systems engineering angle). All already in library; connections noted.
- **Contradiction resolution forked**: Session s_1775590562260_313 handling the 9 actions from CONTRADICTION-ANALYSIS-2026-04-07.md.
- **EXP-070 empty placeholder filled**: Was just an empty directory; now has design.md with full experiment protocol.
- **State assessment**: H-085/KE-043 already up-to-date (Coach integrated EXP-069 N=48/48). Priority tracker current. 5 new deep-dives in library but no new KE entries needed yet (DD-569/570/584/585/589 — connections to existing entries noted).

## Session Notes (2026-04-07 ~16:03)
- **KE-053 WRITTEN**: Synthesized EXP-065 (production-gym gap analysis, N=893 errors) + EXP-066 (compound verification ceiling 3/3) into new knowledge entry.
- **Core finding**: Gym-production gap is structural, not behavioral. Three gaps: context scale (11,229 vs 3-12 files), instruction complexity (multi-page vs clean 5-20 line), compound verification (implicit vs explicit deps).
- **Critical insight**: FM-3.3 (#1 failure mode, 165 entries, 18.5%) is behavioral — agents CAN verify but don't CHOOSE to. Gym auto-forces correct behavior; production doesn't.
- **Gym graduation**: With 96% ceiling, gym is now a regression suite, not a training tool.
- **INDEX updated**: Added KE-052 + KE-053 entries and EXP-065 + EXP-066 experiment rows.
- **Connections**: KE-053 extends KE-052 (structural access thesis), confirms KE-013 (task boundedness), extends KE-043 (forced externalization explains the gap).

## Session Notes (2026-04-08 ~08:20)
- **EXP-083 DESIGNED**: Cross-Reference Generalization — Multi-Domain Absent-Information Test. Tests H-089 P1: does cross-reference intervention generalize beyond config repair?
- **Two new scenarios built**: (1) `truncated-env-repair` — .env file truncated, 6 visible + 2 silent env vars discoverable from source. (2) `truncated-schema-migration` — DB schema truncated, visible columns from tests + 2 silent columns from model code.
- **Treatment variants built**: `truncated-env-repair-xref` and `truncated-schema-migration-xref` with injected cross-reference skill.
- **Protocol**: N=6 baseline + N=6 treatment per scenario (24 total runs). Success = ≥50% improvement on silent checks in BOTH scenarios.
- **Delegated to Coach**: P1 message sent for Phase 1 baselines (12 runs).
- [x] **EXP-083 Phase 1 baselines**: COMPLETE. 12 baseline runs confirm 100% visible / 0% silent across both domains.
- [x] **EXP-083 Phase 2 treatment**: COMPLETE. 12 treatment runs: 24/24 silent + 48/48 visible (100%). H-089 P1 CONFIRMED.

## Session Notes (2026-04-08 ~11:50)
- [x] **KE-060 WRITTEN**: Unified Agent Intervention Taxonomy — The Three Mechanisms. Synthesizes H-085 (Analysis Activation/M1), H-089 (Evidence Discovery/M2), H-091 + KE-056 (Structural Constraint/M3) into complete diagnostic framework. 200+ runs across 40+ experiments. Includes diagnostic decision tree, 2×2 matrix (information × solution space), refined delivery hierarchy (L0–L5), and analysis-action gap boundary. Six open questions identified for future work.
- **EXP-085 COMPLETE and integrated** (few-shot generalization: 100% on escalation-judgment). EXP-070 still DESIGNED/unrun.
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift baseline 67%), (2) ~~Consider EXP-086: test few-shot with structurally dissimilar example to map boundary of structural similarity effect.~~ **DONE**

## Session Notes (2026-04-08 ~13:14)
- [x] **EXP-086 INTEGRATED into knowledge base**: Mismatched few-shot boundary test — 2/3 (66.7%) vs matched 3/3 (100%) vs baseline 12.5%. Two-level transfer model established. Updated: H-091 (P(H) 0.88→0.90), KE-059 (two-level transfer), INDEX.md (EXP-086 row + KE-059/KE-060/H-091 summaries), PRIORITY-TRACKER (H-091 entry + EXP-086 row).

## Session Notes (2026-04-08 ~14:20)
- [x] **GYM FAILURE REMEDIATION STRATEGY WRITTEN**: Comprehensive synthesis mapping all 30 failing gym scenarios to KE-060 mechanisms (M1/M2/M3). Key findings:
  - M1 (Analysis Activation) dominates: 16/30 (53%) of failures
  - M2 (Evidence Discovery): 4/30 (13%)  
  - M3 (Structural Constraint): 5/30 (17%)
  - Model-level limitations: 3/30 (10%)
  - Rubric/noise: 2/30 (7%)
  - 83% of failures (25/30) addressable with known mechanisms
  - Phase 1 deployment (reuse existing skills) estimated to raise pass rate from 72% → 80%
  - Full deployment path to ~90% pass rate documented
- **Files created**: `agents/shared/knowledge/synthesis/gym-failure-remediation-strategy.md`
- **INDEX.md updated**: Added link to remediation strategy
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift), (2) Begin Phase 1 deployment — sycophants-dilemma few-shot skill + cross-reference for prerequisite detection

## Session Notes (2026-04-08 ~14:35)
- [x] **EXP-089 INTEGRATED into knowledge base**: Combined few-shot + checklist = 4/6 (67%) synergistic on contradictory-requirements. Exceeds both individual treatments (few-shot 33%, checklist 0%). Hierarchy validated: baseline 0% < checklist 0% < few-shot 33% < combined 67% < workflow 100%. Updated: H-091 (P(H) 0.92→0.94), KE-059 (synergistic combination section), KE-060 (mechanism composition section), INDEX.md (EXP-089 row), PRIORITY-TRACKER (updated header + H-091 entry).
- **EXP-088 DESIGNED** (not yet run): Workaround Difficulty Gradient — tests L2↔L4 transition. Tests whether making workarounds harder (not impossible) enables binding+externalization to produce correct fixes. Design in experiments/EXP-088/design.md.
- **Next priorities**: (1) Run EXP-070 (externalization on ambiguous-context-drift), (2) Begin Phase 1 deployment — sycophants-dilemma few-shot skill + cross-reference for prerequisite detection, (3) Run EXP-088 (workaround difficulty gradient)

## Session Notes (2026-04-08 ~15:09)
- [x] **EXP-087 INTEGRATED into knowledge base**: Few-shot on sycophants-dilemma — 3/3 (100%) vs 67% baseline. Domain-matched few-shot closes the gap completely. Updated: H-091 (EXP-087 in evidence list, combined stats 9/9), KE-059 (EXP-087 source + delivery vector insight), INDEX.md (EXP-087 row), PRIORITY-TRACKER (H-091 P(H) updated).
- **EXP-070 dispatched to Coach**: P1 message sent — externalization on ambiguous-context-drift, overdue since April 7. Phase 1 (N=10 baseline) + Phase 2 (N=10 treatment).
- **EXP-088 in progress**: Coach currently running workaround difficulty gradient experiment.

## Session Notes (2026-04-09 ~04:00)
- [x] **DD-656/657/658/659 Knowledge Integration**: COMPLETE — Four new deep-dives integrated into knowledge base.
  - **KE-066 WRITTEN**: The Reasoning-Behavior Gap — comprehensive synthesis connecting DD-656 (SELFDOUBT) and DD-659 (Blind Refusal) to our intervention architecture. Three independent research lines converge: (1) reasoning traces leak uncertainty via hedging markers, (2) correct reasoning doesn't override behavioral defaults, (3) our own analysis-action gap from KE-043. The reasoning-behavior gap IS the gap our M1/M2/M3 framework addresses.
  - **KE-067 WRITTEN**: Reasoning-Behavior Decoupling (DD-659). Models articulate correct reasoning in 57.5% of cases but refuse anyway. Direct external validation of our core finding: agents need delivery mechanisms (behavior change) not just knowledge (reasoning).
  - **KE-068 WRITTEN**: Zero-Hedge Gate / Uncertainty Quantification (DD-656). 96% precision auto-accept gate via regex on reasoning traces. Actionable for verification pipeline — skip expensive verification for confident outputs.
  - **KE-069 WRITTEN**: SFT Dip-and-Recovery (DD-658). Cross-domain performance shows dip-before-recovery pattern. CRITICAL NUANCE: applies to gradient-based SFT, NOT in-context learning. Our EXP-094 domain proximity boundary (0% cross-domain on hard tasks) stands — it's about ICL, not SFT. But suggests fine-tuning could overcome the boundary.
  - **KE-070 WRITTEN**: Logic Monopoly / Separation of Power (DD-657). AgentCity's architectural governance validates our finding that environmental mechanisms (M3) are needed when behavioral defaults override reasoning.
  - **INDEX.md updated**: All 5 new KE entries added.
  - **Key insight**: DD-659's reasoning-behavior decoupling is the most precise external framing of what our 28-experiment research arc demonstrates. Our intervention hierarchy (L1-L5) is essentially an engineering response to this fundamental property of LLMs.
  - **Files created**: KE-066, KE-067, KE-068, KE-069, KE-070
  - **Files modified**: INDEX.md, todo.md
- **Next priorities**: (1) Phase 1 deployment — expand few-shot example store from 3→7 proven scenarios, (2) Update WKWA-005 with few-shot as delivery mechanism, (3) Consider moving KE-066 to synthesis/ as WKWA-008

## Session Notes (2026-04-09 ~04:50)
- [x] **KE-066 ID COLLISION FIXED**: Orphan file `KE-066-reasoning-behavior-decoupling-uncertainty-detection.md` renamed to `KE-071-reasoning-behavior-decoupling-uncertainty-detection.md`. Internal header updated from KE-066 to KE-071 references. INDEX.md updated with KE-071 row.
- [x] **KE-072 WRITTEN**: Positional Privilege Is Architectural — U-shaped attention bias (arXiv:2603.10123) explains 100% vs 0% delivery gap. Present at initialization before training. Validates task-message delivery requirement. Seeds further predictions about deeper models → larger gap.
  - **Files created**: KE-072-positional-privilege-architectural-theory.md
  - **Files modified**: KE-071 (renamed from KE-066), INDEX.md (KE-071 row, KE-072 row, DD-660 in library listing)
- [x] **WAVE 1 DEPLOYMENT COMPLETE**: 3 treatment scenarios created:
  - `escalation-impossible-task-fewshot/` — know-when-blocked skill via injected_context.md
  - `misleading-test-fix-fewshot/` — evidence-over-narrative skill via injected_context.md
  - `sycophants-dilemma-fewshot/` — classify-then-act skill via injected_context.md
  - All use task-message delivery (injected_context.md) per KE-065/EXP-095 findings
  - **Awaiting validation**: Need 3 runs each to confirm pass rates match lab results (3/3 expected)
- **Next priorities**: (1) Validate Wave 1 (3 runs each), (2) Begin Wave 2 cross-reference deployments, (3) Design new skills for Wave 3, (4) Update WKWA-005 with few-shot delivery mechanism

## Session Notes (2026-04-09 ~09:00)
- [x] **SYNTHESIS: DD-639/640 × Cascade Circuit Breaker**: Cross-thread synthesis combining KE-079 (cascade-architecture convergence) with H-093 (CIVC) and CR#259 (MAS circuit breaker architecture). **Key insight**: Circuit breakers should be placed at **loop-primitive boundaries** (intra-agent), not agent boundaries (inter-agent). DD-640's composed loop primitive count provides the operationalized complexity metric H-093 needs. DD-639's behavioral fuzzing solves CR#259's probe design gap. Six ranked findings, EXP-100 design refined with DD-640 complexity metric. **File: `agents/bob/workspace/SYNTHESIS-cascade-circuit-breaker-fuzzing-convergence.md`**

## Session Notes (2026-04-09 ~04:25)
- [x] **DEPLOYMENT PLAN WRITTEN**: `agents/shared/knowledge/synthesis/DEPLOYMENT-PLAN-gym-remediation.md`
  - **4-wave deployment plan** for raising gym pass rate from 71.3% (77/108) to target 88% (95/108)
  - **Wave 1** (immediate, +3 scenarios): Deploy 3 proven few-shot skills (know-when-blocked, evidence-over-narrative, classify-then-act) to their target scenarios via injected_context.md
  - **Wave 2** (1-2 days, +5 scenarios): Cross-reference (M2) for missing-prerequisite, context-proof-build, silent-dependency + externalization (M1) for judgment-ambiguous-spec, convention-verify-edit
  - **Wave 3** (3-5 days, +6 scenarios): New skills (regression-awareness, search-planning, spec-checklist) + workflow redesign for convention-verify-edit-workflow
  - **Wave 4** (1-2 weeks, +4 scenarios): Domain-matched few-shot for hard scenarios + accept residual
  - **Key decisions**: Skills MUST be task-message delivered (not system-prompt). Treatment scenarios use `-fewshot`/`-xref`/`-ext` suffix convention. Wave 1 delegatable to Coach but Bob may do directly given Coach's EXP-216 track record.
  - **Cross-references**: Gym Failure Remediation Strategy, WKWA-006, WKWA-007, KE-060, KE-065
- **Next priorities**: (1) Execute Wave 1 (3 proven deployments), (2) Begin Wave 2 cross-reference deployments, (3) Design new skills for Wave 3

## Session Notes (2026-04-09 ~00:49)
- [x] **WKWA-006 WRITTEN**: "What We Know About: Few-Shot Skill Delivery — The Middle Way Between Text Rules and Workflow Enforcement". Comprehensive synthesis of EXP-084–094 (11 experiments, 56 runs). Covers the declarative→procedural mechanism, three hard boundaries (temporal discipline, domain proximity, execution crowding), design guide, and deployment roadmap.
- [x] **WKWA-001 UPDATED**: Behavioral Intervention synthesis updated with few-shot findings. L3b added to hierarchy table. Decision guide rewritten to prioritize few-shot for judgment/process skills. "What We Don't Know" section updated (3 questions answered, 2 new questions added). Coach/Tech-Lead/Bob implications revised. Source table expanded with KE-059–065, H-091, WKWA-006. Experiment count 24→35, KE count 19→26.
- **Next priorities**: (1) Await EXP-070 + EXP-088 results, (2) Begin Phase 1 deployment — embed few-shot skills into coder's default context for matching scenarios, (3) Update WKWA-005 (capability delivery) with few-shot as new delivery mechanism
- [x] **WKWA-007 WRITTEN**: "The Intervention Architecture — What 25 Experiments Tell Us About Changing Agent Behavior". Capstone synthesis tying together all 25 experiments (EXP-070–095), 200+ runs. Covers three mechanisms (M1/M2/M3), complete intervention hierarchy (L1–L5), decision tree, six validated boundaries, numbers that matter, and open frontiers. Supersedes WKWA-001 as primary reference for agent behavior change.
- **Next priorities**: (1) Begin Phase 1 deployment — embed few-shot skills into coder's default context for matching scenarios, (2) Design next experiments from remediation strategy, (3) Build task→skill routing prototype

## Session Notes (2026-04-08 ~15:35)
- [x] **EXP-088 integration**: COMPLETE — Workaround Difficulty Gradient results integrated into knowledge base.
  - **Key findings**: Baseline 2/3 (67%) correct pipeline fix with hard workaround, treatment 3/3 (100%). v2 combined (0/18) vs v2-hard combined (5/6): p<0.001. Difficulty gradient exists — it's not binary (available vs impossible) but continuous based on relative difficulty.
  - **Most impactful implication**: We don't need to eliminate workarounds entirely — just make the correct fix easier than the workaround.
  - **H-088 updated**: Status → CONFIRMED WITH GRADIENT. P(H) 0.70→0.80. EXP-088 evidence section added. Promoted to Tier 1 in PRIORITY-TRACKER.
  - **KE-056 updated**: Open Question #1 (difficulty gradient) ANSWERED. New intermediate hierarchy levels (L3/L3.5) documented. EXP-088 added to cross-references and source line.
  - **KE-060 updated**: Open Question #6 (workaround difficulty gradient) ANSWERED. M1/M3 boundary refined — relative difficulty determines which mechanism is needed. EXP-088 update section added.
  - **INDEX.md updated**: EXP-088 experiment row added (COMPLETE). KE-056 summary updated with gradient finding. H-088 summary updated (P(H)=0.80). EXP-088 KE entry updated (DESIGNED→COMPLETE).
  - **PRIORITY-TRACKER updated**: Header mentions EXP-088 COMPLETE. H-088 moved from Tier 2 (0.70) to Tier 1 (0.80). EXP-088 added to experiment queue (COMPLETE). Meta-process section updated (12→11 high confidence count adjusted, H-088 promoted).
  - **Files modified**: H-088.md, KE-056.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-08 ~23:55)
- [x] **EXP-094 integration**: COMPLETE — Few-Shot Cross-Scenario Generalization (domain proximity) results integrated into knowledge base.
  - **Key findings**: SECOND BOUNDARY FOUND — Domain Proximity. Skill-only few-shot (credentials→binary domain) 0/3 (0%) on hardest scenario. Domain-matched narrative (binary→binary) 3/3 (100%). Cross-domain structural match insufficient for hard scenarios. Transfer model revised from TWO to THREE levels: exact match=100%, same domain=100%, different domain=0% on hard scenarios.
  - **H-091 updated**: P(H) 0.95→0.93. EXP-094 evidence section added. Two boundaries documented (temporal + domain proximity). Mechanism hierarchy updated with L3/L3⚠️ split.
  - **KE-059 updated**: Source line expanded with EXP-094. Three-level transfer model documented. Domain proximity boundary added.
  - **KE-060 updated**: EXP-094 update section added. L3 delivery hierarchy split into domain-matched (reliable) vs cross-domain (unreliable on hard scenarios). Run count updated to 250+.
  - **INDEX.md updated**: KE-059, KE-060, H-091 summary rows updated with EXP-094 findings. EXP-094 experiment row added. Run count updated to 250+, experiment range to EXP-094.
  - **PRIORITY-TRACKER updated**: Header updated with EXP-094 COMPLETE. H-091 P(H) updated (0.95→0.93). EXP-094 added to experiment queue. Meta-process confidence summary updated.
  - **Implication**: Domain proximity matters more than structural similarity for few-shot transfer on hard scenarios. Practical consequence: few-shot libraries need domain-matched examples, not just skill-matched examples. Cross-domain examples may work on easy scenarios (per EXP-086: 66.7%) but fail completely on hard ones (EXP-094: 0%).
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-08 ~23:25)
- [x] **EXP-093 integration**: COMPLETE — Few-Shot Sprint 3 (Verify-After-Edit Discipline) results integrated into knowledge base.
  - **Key findings**: BOUNDARY FOUND — "What vs When" distinction. C3 validation (what to check) +40pp (40%→80%), but C2.3 temporal sequencing (read-after-write) -20pp (40%→20%). Few-shot teaches what to validate but NOT when to verify. Product quality +40pp despite no temporal discipline. 16 runs (8 control, 8 treatment).
  - **H-091 updated**: Status → "Strongly Supported" with P(H) 0.99→0.95. EXP-093 evidence section added. New boundary condition: temporal discipline (tool-call sequencing) resistant to few-shot. Hierarchy statement updated with temporal boundary.
  - **KE-059 updated**: EXP-093 evidence section added. Source line expanded. "What vs When" boundary documented — first boundary condition for few-shot effectiveness.
  - **KE-060 updated**: EXP-093 update section added. L3 delivery hierarchy table row updated with temporal boundary note. "What vs when" boundary integrated.
  - **INDEX.md updated**: KE-059, KE-060, H-091 summary rows updated with EXP-093 findings. EXP-091 status corrected (IN PROGRESS→CONFIRMED). Run count updated (240+ runs, EXP-025 through EXP-093).
  - **PRIORITY-TRACKER updated**: Header updated with EXP-093 COMPLETE. H-091 P(H) updated (0.99→0.95). EXP-093 added to experiment queue. Meta-process confidence summary updated.
  - **Implication**: Temporal discipline (when to perform tool calls in what order) likely needs L4 workflow enforcement, not L3 few-shot. This narrows the scope of few-shot to "declarative knowledge transfer" — what to do, what to check, what to look for — while procedural sequencing requires structural enforcement.
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-08 ~16:35)
- [x] **EXP-090 integration**: COMPLETE — Few-Shot Skill Conversion Sprint 1 results integrated into knowledge base.
  - **Key findings**: Both know-when-blocked (escalation-impossible-task) and evidence-over-narrative (misleading-test-fix) achieved 0%→100% with domain-matched few-shot worked examples. Cumulative matched few-shot: 12/12 (100%) across 5 scenarios.
  - **H-091 updated**: P(H) 0.92→0.98. EXP-090 evidence section added. Status updated to include EXP-090.
  - **KE-059 updated**: Source line updated with EXP-090. Confidence note added. Full EXP-090 evidence section with per-skill results.
  - **KE-060 updated**: Experiment range updated to EXP-090. EXP-090 update section added (L3 few-shot production-ready).
  - **INDEX.md updated**: EXP-090 experiment row added. KE-060 summary updated (12/12 matched few-shot, 220+ runs, EXP-090 range).
  - **PRIORITY-TRACKER updated**: Header updated with EXP-090 COMPLETE. H-091 row updated (P(H)=0.98, EXP-090 evidence). EXP-090 added to experiment queue. Meta-process H-091 confidence updated.
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md
- [x] **Gym failure remediation strategy update**: COMPLETE — gym-failure-remediation-strategy.md updated with EXP-090 findings.
  - **escalation-impossible-task reclassified**: Was "Model-Level Limitation" → now "M1: Analysis Activation — SOLVED by few-shot". EXP-090 proved 0/3→3/3 (100%).
  - **misleading-test-fix added**: New scenario #31, also SOLVED by few-shot (evidence-over-narrative, 0/3→3/3).
  - **Executive Summary updated**: M1 count 16→18, Model-Level 3→2, total scenarios 30→31. Addressable failures 83%→87%.
  - **Mechanism Distribution updated**: Reflects reclassification and new scenario.
  - **Deployment Priority updated**: Phase 1 now includes 3 proven few-shot deployments (trivial effort).
  - **New "Validated Interventions" section**: 7 experimentally confirmed skill→scenario pairs with effect sizes and p-values.
  - **Cross-References updated**: EXP-090 added, H-091 P(H) updated.
  - **Files modified**: gym-failure-remediation-strategy.md, todo.md

## Session Notes (2026-04-08 ~23:48)
- [x] **DD#639-642 Knowledge Integration**: COMPLETE — Four new deep-dives integrated into knowledge base.
  - **KE-062 WRITTEN**: Behavioral Fuzzing as Agent Testing Paradigm. Synthesizes DD#639 (ABTest: 4,892 failure reports → 47 Interaction Patterns + 128 Action Types → 647 test cases → 642 new anomalies across Claude Code, Codex CLI, Gemini CLI). 40.8% true-positive rate. First systematic framework for agent behavioral testing. Proposes empirical foundations for testing our own agents. Connects to KE-050 (robustness), KE-053 (gym-production gap).
  - **KE-063 WRITTEN**: The Artifact Trust Asymmetry — LLMs Systematically Over-Trust Documentation Over Code. Synthesizes DD#641 (AgenticFlict: 142K+ PRs, 27.67% conflict rate) + DD#642 (TRACE: 22,339 trust traces, 7 models, 456 Java bundles). LLMs trust documentation over code; documentation bugs detected at 67-94% but implementation drift drops 7-42pp when docs are intact. Agent-agent merge conflicts structurally distinct from agent-human. Confidence miscalibration in 6/7 models. Connects to KE-050 (robustness), H-085 (externalization), KE-043 (forced externalization).
  - **KE-047 UPDATED**: Status upgraded from "Theoretically Supported" → "Strongly Supported". DD#640 (Inside the Scaffold: 13 architectures × 12 dimensions × 3 layers) provides strongest independent validation. 5 composable loop primitives identified. Convergent/divergent dimension split. Open question on taxonomy stability added.
  - **KE-050 UPDATED**: Status upgraded from "Theoretical" → "Strongly Supported". DD#639 (47 Interaction Patterns as failure surfaces) + DD#641 (27.67% conflict rate confirming architecture > model for robustness) provide new evidence. Merge conflict brittleness and behavioral fuzzing findings added.
  - **INDEX.md UPDATED**: KE-062, KE-063 added to knowledge entries table. DD#639-642 added to Research Library. KE-047 and KE-050 descriptions updated with new evidence and status upgrades.
  - **Files created**: KE-062-behavioral-fuzzing-agent-testing-paradigm.md, KE-063-agent-artifact-trust-asymmetry.md
  - **Files modified**: KE-047.md, KE-050.md, INDEX.md, todo.md
  - **Key connections**: DD#640 is the strongest external validation of KE-047's harness architecture convergence thesis. DD#639's behavioral fuzzing framework could be adapted for our gym infrastructure. DD#641+642 establish trust asymmetry as a systematic agent failure mode relevant to our knowledge delivery strategy.

## Session Notes (2026-04-09 ~00:55)
- [x] **EXP-091 integration**: COMPLETE — Few-Shot Skill Conversion Sprint 2 (investigate-and-fix / reproduce-first) results integrated into knowledge base.
  - **Key findings**: reproduce-first 0/3→3/3 (+100pp). First evidence that few-shot works for **process discipline** (step ordering), not just judgment skills. investigate-and-fix overall process 4/5→5/5 in every treatment run. Combined Sprint 1+2: 9/9 treatment (100%) vs 0/9 control. H-091 P(H) 0.98→0.99 (later revised to 0.93 after EXP-093/094 boundaries).
  - **H-091 updated**: EXP-091 added to status line. Evidence section added. Scope expanded from judgment-only to judgment + process discipline. Open question #5 ("Does few-shot work beyond judgment tasks?") answered YES.
  - **KE-059 updated**: Source line expanded with EXP-091. Process discipline scope extension documented. Cumulative matched few-shot: 15/15 (100%) across 6 scenarios.
  - **KE-060 updated**: Experiment range updated to include EXP-091. Run count updated.
  - **INDEX.md updated**: EXP-091 experiment row added (3 places: experiment table, KE-059 description, H-091 summary). KE-059/KE-061 updated with EXP-091 findings.
  - **PRIORITY-TRACKER updated**: H-091 row updated with EXP-091 evidence. EXP-091 added to experiment queue as COMPLETE.
  - **Significance**: Crossing from judgment to process discipline was a critical scope expansion for H-091. Prior experiments (EXP-084–090) only showed few-shot working on judgment skills (what to decide). EXP-091 proved it also works for process discipline (what steps to follow in what order), specifically reproduce-first. This finding was later bounded by EXP-093 (temporal discipline resistant) and EXP-094 (domain proximity required).
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-09 ~01:55)
- [x] **EXP-095 integration**: COMPLETE — Few-Shot Delivery Position Effect (task-message vs system-prompt) results integrated into knowledge base.
  - **Key findings**: THIRD BOUNDARY FOUND — Delivery Position. Task-message delivery 100% (6/6 across Arms A+C), system-prompt delivery 0% (0/3 Arm B). Position effect is binary and dominates content quality — even domain-matched v2.0 skill with binary-format examples fails completely in system prompt. injected_context.md infrastructure unnecessary; inline task.md injection works equally well.
  - **H-091 updated**: EXP-095 added to status line. Evidence section added. Third boundary documented (delivery position). P(H) unchanged at 0.93. Three boundaries now: temporal discipline, domain proximity, delivery position.
  - **KE-059 updated**: Source line expanded with EXP-095. Delivery position boundary documented as third boundary condition.
  - **KE-060 updated**: EXP-095 update section added. L3 delivery hierarchy refined with position constraint. Run count updated.
  - **KE-065 written**: Comprehensive Few-Shot Findings synthesis (EXP-090–095). Summarizes entire few-shot research arc.
  - **INDEX.md updated**: EXP-095 experiment row added. KE-059, KE-060, H-091 summaries updated with delivery position findings. KE-065 row added. Run count and experiment range updated.
  - **PRIORITY-TRACKER updated**: Header updated with EXP-095 COMPLETE. H-091 row updated with third boundary. EXP-095 added to experiment queue.
  - **Implication**: Few-shot delivery requires task-message injection, not system-prompt placement. This has direct production implications: skill files loaded into system context won't work; must be injected into task messages. The entire injected_context.md infrastructure was unnecessary — inline task.md examples work just as well.
  - **Files modified**: H-091.md, KE-059.md, KE-060.md, KE-065.md (new), INDEX.md, PRIORITY-TRACKER.md, todo.md
  - **Note**: This completes the few-shot research arc (EXP-084–095). 12 experiments, 260+ runs, 3 boundary conditions found, H-091 at P(H)=0.93. Few-shot is production-ready for domain-matched, task-message-delivered examples targeting judgment and process discipline (not temporal discipline).

## Session Notes (2026-04-10 ~15:25)
- [x] **EXP-116 RE-VALIDATION — Reverse EXP-118 invalidation cascade**: May's investigation (commit f3eb74a5) found that `coder` IS a valid agent (agents/coder/agent.json exists, binary exits code 1 for truly unregistered agents). Coach's EXP-118 "silent exit bug" claim was itself a confabulation. All changes:
  - **H-093 P(H)**: 0.70 → 0.72 (restored)
  - **EXP-116 status**: INVALIDATED → RE-VALIDATED
  - **EXP-118 status**: COMPLETE → INVALIDATED (Coach confabulation)
  - **KE-122**: UNSUPPORTED → SUPPORTED (intervention decay)
  - **KE-123**: Evidence weakened → SUPPORTED (iatrogenesis)
  - **Files modified**: H-093 hypothesis file, INDEX.md (6 rows), PRIORITY-TRACKER.md (4 locations)
  - **Committed**: 8524bd63
- [x] **EXP-120 KB INTEGRATION — Progressive externalization NEGATIVE on discovery tasks**: Coach ran EXP-120 on same kb-integration-discovery task as EXP-117. Results: baseline 67% → treatment 17% (p=0.242, N=6+6). The progressive tracking instruction was completely IGNORED — no trial created an external tracking file. Same failure mode as baseline (missing INDEX.md KE-071 entry). **Key insight**: failure is a reasoning gap (agent can't conceptualize new KE entries) not a tracking gap (forgets known items). This is the third intervention type tested on discovery tasks; all fail or harm:
  - EXP-117: Upfront checklist → 0% (-67pp) 
  - EXP-120: Progressive tracking → 17% (-50pp)
  - No intervention (baseline) → 67% (best!)
  - **H-085**: P(H) stays 0.85, 73/89 total ext runs across 17 scenarios
  - **H-095**: P(H) stays 0.84, EXP-120 adds to evidence that universal interventions harm
  - **Files modified**: H-085 hypothesis file, INDEX.md, PRIORITY-TRACKER.md
  - **Committed**: 8ff47029

## Session Notes (2026-04-10 ~08:01)
- [x] **DD-720/721/722/723 indexing task — ALREADY COMPLETE**: Verification confirmed all 6 entries (4 DDs + 1 CR + 1 KE) already present in INDEX.md from prior session. DD-720 (Plan-RewardBench, line 642), DD-721 (Agent-Diff, line 643), DD-722 (SkillClaw, line 644), DD-723 (AdaRubric, line 645), CR-329 (Next-Gen Evaluation Architecture, line 646), KE-116 (synthesis entry, line 647). KE-116 file exists at `knowledge/entries/KE-116-next-gen-evaluation-architecture-adaptive-state-aware.md`. Todo.md already had integration marked complete (line 21). No new edits needed to INDEX.md.

## Session Notes (2026-04-10 ~05:57)
- [x] **EXP-114 integration**: COMPLETE — FM-2.1 Approach Decomposition Guard design registered in knowledge base.
  - **Key findings**: Coach's analysis reveals FM-2.1 is 54.5% tactical (tool schema errors) and 45.5% strategic (genuine approach failures). H1 CONFIRMED by pre-experiment analysis: no single guard can address both types. Coach is MORE tactical than average (72.3% vs 54.5%). Dual intervention designed: (A) Tool Schema Guard (beforeToolCall hook), (B) approach-validation-trap gym scenario for strategic FM-2.1.
  - **INDEX.md updated**: EXP-114 experiment row added (after EXP-113). H-095 summary updated with EXP-114 DESIGNED note and revised next steps.
  - **PRIORITY-TRACKER updated**: Header updated with EXP-114 DESIGNED. EXP-114 added to experiment queue as DESIGNED (🔵). H-095 Tier 1 entry updated with EXP-114 evidence.
  - **Significance**: EXP-114 is the first concrete implementation from EXP-113's intervention priority map. The finding that FM-2.1 is heterogeneous (tactical vs strategic) means the intervention priority map's #1 recommendation (FM-2.1 approach guard) needs to be split into two distinct interventions. This deepens the agent-specific intervention thesis (H-095).
  - **Files modified**: INDEX.md, PRIORITY-TRACKER.md, todo.md

## Session Notes (2026-04-10 ~11:55)
- [x] **EXP-116 Phase 2 Analysis COMPLETE**: Thorough analysis written to `agents/shared/knowledge/experiments/EXP-116/phase2-analysis.md`.
  - **Verdict**: INVALID — requires rerun. All 12 treatment runs (arms A–D, 3 reps each) produced 0/9 checks due to missing files at evaluation time. All 3 baseline runs produced 1/9 checks with intact files. 100% correlation between treatment assignment and file disappearance.
  - **Root cause**: Most likely the treatment context injections (critique instructions, machine evidence) cause destructive file operations — agent deletes/moves `src/api-client.js` during rewrite. Cannot confirm without transcripts (destroyed by runner cleanup).
  - **Additional issues**: Only 1 of 2 scenarios ran (ghost-deliverable-chain missing). Clean-handoff controls never ran. 1 of 15 results dropped from JSONL. Arms C/D lack S2 environment directories (infrastructure bug).
  - **Hypotheses**: H1–H4 all UNTESTABLE. H0 trivially true but uninformative.
  - **Salvageable finding**: Baseline 11% confirms confabulation mechanism in clean unconfounded run (consistent with KE-093). Arm A's 8× duration suggests critique framing causes destructive over-correction (extends KE-119).
  - **Rerun requirements**: (1) Preserve transcripts, (2) Fix environment directories, (3) Pre/post file inventories, (4) Complete all scenarios, (5) Increase N≥6.
  - **File created**: `agents/shared/knowledge/experiments/EXP-116/phase2-analysis.md`

## Session Notes (2026-04-10 ~17:55)
- [x] **KE-128 INDEX.md Integration**: Added KE-128 (Phase 0 Discovery — Structural Intervention for FM-1.3) to INDEX.md entries table after KE-127. EXP-124 experiment row was already present (line 675) but the corresponding KE entry was missing.
- [x] **Topic Files Updated**: Added KE-128 reference to `07-tool-use-workflows.md` (Knowledge Entries table) and `10-agent-design-patterns.md` (Knowledge Entries table + H-095 added to Related Hypotheses section). The "3 validated agent-specific structural guards" pattern now visible in topic navigation.
- **Status**: EXP-124 integration now FULLY COMPLETE — KE-128 entry file ✓, INDEX.md experiment row ✓, INDEX.md KE entry row ✓, PRIORITY-TRACKER ✓, H-085 ✓, H-095 ✓, topic files ✓.

## Session Notes (2026-04-10 ~18:45)
- [x] **H-098 Authored (Attention Channel Theory)**: New unifying hypothesis formalizing why intervention effectiveness is determined by channel separation, not content quality. Three channels: (1) Text instructions in system prompt — 0% on judgment tasks, competes for same attention budget; (2) Environmental state (file artifacts, workflow gates) — 87-100%, structurally separate from text generation; (3) Task-message positional privilege — 33-100%, domain-dependent. Explains all major findings: text rules fail (Ch1 competition), forced externalization works (Ch1→Ch2 switch), instruction overhead harmful (Ch1 overload), execution crowding (Ch2 budget ≈ 1 gate/task). Formalizes KE-101 Laws 1-5 as channel properties. Five predictions P-098a–e filed.
  - **H-098 created**: `agents/shared/knowledge/hypotheses/H-098-attention-channel-theory-intervention-effectiveness.md`
  - **INDEX.md updated**: H-098 row added after H-097 in hypothesis table.
  - **P(H)=0.78**: High prior based on convergent evidence from 100+ experiments across KE-101, H-085, H-091, KE-025, KE-064.
  - **Key contribution**: First formal model explaining WHY forced externalization works (Ch1→Ch2 channel switch), WHY text rules fail (Ch1 attention competition), and WHY there's an execution crowding limit (Ch2 budget constraint).
- [x] **P-098a Channel Survey Complete**: Comprehensive survey of 34 interventions classified by attention channel. Result: **bimodal distribution strongly confirmed** — 88% of interventions cluster at 0% or 87-100%, with a 52pp dead zone (34-86%) containing only 1 intervention. Channel 1 (text): 0% across 14 interventions. Channel 2 (structural): 87-100% across 10 interventions. Channel 3 (positional): 0-100% depending on domain match. File: `agents/bob/workspace/h098-p098a-channel-survey.md`.
- [x] **EXP-127 DESIGNED (Channel Separation Direct Test)**: First direct interventional test of H-098's core prediction — same contradiction-detection content delivered through 3 channels on `contradictory-requirements` scenario (baseline 0%). 4-arm design: Baseline (no intervention), Arm A (Channel 1 = system-prompt skill via lab fork `coder-channel-test-ch1`), Arm B (Channel 3 = task-message via `contradictory-requirements-ch3-fewshot`), Arm C (Channel 2 = forced externalization via `contradictory-requirements-ext`). N=6 per arm (24 total runs). Content verified identical between Ch1 and Ch3 (diff = 0). H-098 predicts: Baseline 0%, Ch1 0-17%, Ch3 83-100%, Ch2 83-100%. Key test is A vs B — same content, different channel. **READY TO EXECUTE — delegate to Coach.**
  - **Design**: `agents/shared/knowledge/experiments/EXP-127/design.md`
  - **Protocol**: `agents/shared/knowledge/experiments/EXP-127/protocol.md`
  - **Channel 3 scenario**: `agents/gym/scenarios/contradictory-requirements-ch3-fewshot/`
  - **Channel 1 lab fork**: `agents/.lab/coder-channel-test-ch1/`

## Session Notes (2026-04-10 ~23:30)
- [x] **EXP-128 KB INTEGRATION — COMPLETE**: Channel 3 Boundary Conditions (Detection Coverage) experiment integrated into knowledge base.
  - **Key findings**: H-128 REJECTED — detection coverage does NOT determine Ch3 effectiveness. 3-arm design (Arm A response-only 0/6, Arm B detection-enhanced 0/6, Arm C detection-only 0/6). All content variants fail identically → content quality is NOT the Ch3 moderator. The real boundary is **task type**: coding tasks create execution momentum that overwhelms positional privilege. Ch3 works for behavioral tasks (EXP-095: 100%) but fails for analytical judgment under coding momentum.
  - **Two mechanisms identified**: (1) Coding momentum — high-salience code tokens dominate even task-message attention, (2) Success signal misdirection — "code compiles + tests pass" creates false completion signal.
  - **KE-132 WRITTEN**: Channel 3 Few-Shot Has a Task-Type Boundary — Coding Momentum Overwhelms Positional Privilege. `agents/shared/knowledge/entries/KE-132-ch3-task-type-boundary-coding-momentum.md`
  - **H-128 status**: ❌ REJECTED (P(H): 0.55→0.05)
  - **H-098 updated**: P(H) description updated (EXP-128 confirms task-type boundary). Status → "two direct tests complete, Ch3 boundary clarified". Depends-on includes KE-132. P-098b refined with task-type boundary. Evidence table expanded. Open Question #1 partially answered. Practical guidance updated for Ch3 behavioral-only constraint.
  - **INDEX.md updated**: H-128 row added (REJECTED). EXP-128 row added. KE-132 row added. H-098 description updated.
  - **PRIORITY-TRACKER updated**: Header mentions EXP-128. H-098 row updated with EXP-128. H-128 added to archived. EXP-128 added to experiment queue. Meta-process counts updated.
  - **Files modified**: KE-132 (new), H-098 hypothesis file, INDEX.md (4 edits), PRIORITY-TRACKER.md (5 edits)
  - **Verified 23:48**: All 4 deliverables confirmed on disk (INDEX 4 rows, PRIORITY-TRACKER 5 sections, H-098 15+ refs, KE-132 61 lines). Git clean.
- [x] **EXP-129 INDEXED (RUNNING)**: Added Ch2 Budget Curve — Gate Stacking experiment to INDEX.md and PRIORITY-TRACKER. Coach executing 4-arm test (N=24) of H-098 P-098c. Tests how many forced-ext gates can be stacked before performance cliffs. Predicts cliff at 2+ gates.
- [x] **DD-754/DD-756 integration** (2026-04-13): KEs already existed (KE-162, KE-163, KE-165 from Scout triage). Added DD-754/KE-162/KE-163 cross-refs to H-107 Connections table + PRIORITY-TRACKER H-107 entry. H-108 already had DD-756. Gap closed.
