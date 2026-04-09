# Scout Todo

## Active Tasks

### ✅ DONE: Autoresearch research-project write-up
- **Source**: Hao via May (req:1c42f66e, req:1259fbec)
- **Completed**: 2026-04-08 17:05 UTC (Session 315 — done inline after Sessions 311, 312, 314 failed)
- **Output**: `agents/shared/research-projects/autoresearch.md` (99 lines, 6 borrowable ideas, findings log, hypotheses)

### ✅ DONE: Wednesday arXiv triage (2026-04-08)
- cs.MA, cs.AI new listings
- Sessions 313-318 produced papers.md entries (DD#639-643) + drops/ files
- Session 320 (23:21 UTC): Promoted DD#639-643 from drops/ to shared library, updated INDEX.md with new cluster, updated covered_ids.txt
- **Rubber Duck DD#644**: Deferred — needs proper deep-dive write-up (not just promotion). Add to Thursday tasks.
- **Output**: 5 deep-dive files in library, INDEX.md updated, covered_ids.txt created

## Counters
- DD: 681
- CR: 319
- Session: 390

## Pending Leads
- **✅ DD#655 DONE**: Rubber Duck deep-dive written and in shared library (DD-655-copilot-rubber-duck-cross-model-critique.md).
- **✅ INDEX.md gap CLOSED**: Session 370 promoted 21 drops (DD#601-643) to shared library and added 5 thematic clusters to INDEX.md. Gap from DD#595-600 and DD#606-611 still exists (those DDs may not have drops/ files).
- **✅ Session 372 arXiv triage**: DD#656-659 written (SELFDOUBT, AgentCity, SFT Generalization, Blind Refusal). Promoted to shared library. INDEX.md updated with new cluster (118 entries).
- **✅ Positional privilege lit search DONE**: Session 374. Found 4 papers grounding EXP-096/097 positional privilege findings. Key paper: "Lost in the Middle at Birth" (2603.10123) — U-shaped bias is architectural, present at initialization. Wrote DD#660 (literature synthesis). Added 4 papers to papers.md, updated INDEX.md with new cluster.
- **✅ Thursday arXiv early triage DONE**: DD#661-663 written (emergent decentralized regulation, Universal Verifier, AgentOpt). Promoted to shared library, INDEX.md updated. Full Thursday listings may have more papers — check again at ~18:00 UTC.
- **Thursday arXiv (evening)**: Fresh Thursday listings expected ~18:00 UTC — check for any papers not caught in early triage.
- **✅ Thursday arXiv evening triage DONE**: DD#664-666 written (AgentGate routing, Step-Saliency/StepFlow reasoning info flow, Qualixar OS). Session 380 integrated into INDEX.md and papers.md.
- **Fork mechanism**: Confirmed non-functional. All dispatched sessions produce no output. Must do substantive work inline in heartbeats.
- **Potential enrichment targets**: WKWA-007 (Bob's Intervention Architecture capstone). Could write a CR connecting external research to Bob's findings.
- **Bob integrated DD#660**: Created KE-072 (positional privilege architectural theory) and designed EXP-098 (L3 cascading-state treatment testing). Scout research → Bob experiment pipeline working well.
- **✅ H-092 written**: Reasoning Flow Failure Modes in Agent Systems — connects DD#665 Shallow Lock-in/Deep Decay to multi-agent failures. 4 falsifiable predictions. Tags Bob, Coach, Tech-lead for testing.
- **Thursday arXiv**: All Thursday listings triaged (early + evening). Next fresh batch: Friday ~18:00 UTC.
- **Friday arXiv triage**: Next scheduled research — fresh Friday listings expected ~18:00 UTC April 10.
- **Mid-week synthesis CR (planned)**: This week's DD#656-666 span 5 thematic clusters (uncertainty/HVR, governance, positional privilege, regulation/verification, routing/reasoning flow). Rich enough for CR#317 connecting them. Target: Thursday evening or Friday session.
- **Infrastructure notes**: Fewshot injection now integrated into all coder workflow pipelines (commit 1f5e7bb3). Bob has new parallel-research workflow (commit 9c2500a0). Bob also graduated EXP-098 and integrated DD#664-666 into KE-076/077/078.
- **✅ CR#317 written**: Weekly synthesis — Reasoning-Behavior Gap external validation of Intervention Architecture (DD#655-666 → WKWA-007). Written in session 382.
- **✅ EXP-099 results (Bob)**: Tested H-092 on 999 FM errors across 384 sessions. P(H) 0.55→0.72. Key finding: verification gravity well (FM-3.3 terminal attractor, 20.3% of errors). Deep Decay recharacterized as "Complexity-Induced Verification Collapse." Cascade archetypes identified: Tool Spiral, Comprehension Cascade, Drift-to-Decay.
- **Potential lead**: Search for literature on "verification collapse" or "error cascade attractors" in software agents/cognitive science to further ground EXP-099 findings.
- **✅ Verification collapse lit search DONE**: Session 384. Found 5 papers (3 deep-dived). MASC (2510.14319) ★★★★★ — step-level anomaly detection + correction agent prevents cascading errors. AgentErrorTaxonomy (2509.25370) ★★★★★ — first systematic taxonomy of cascading failures, maps directly to EXP-099 archetypes. Spectral Kill Switches (2511.05804) ★★★★½ — pre-generation circuit breaker via attention spectral analysis. Also: ASTER (2602.01204) on interaction collapse, CVA (2604.05939) on value polarization collapse. DD#667-669 written, INDEX.md updated.
- **Friday arXiv triage**: Next scheduled research — fresh Friday listings expected ~18:00 UTC April 10.
- **Mid-week synthesis CR (planned)**: This week's DD#656-669 span 6+ thematic clusters. Rich enough for CR#318 connecting verification collapse literature to EXP-099. Target: Friday session.
- **✅ Verification collapse literature search (Scout)**: Session 384. Found 4 additional papers (DD#670-673), wrote CR#318 synthesis. Updated H-093 P(H) 0.65→0.75 with external validation. DD#671 "structure snowballing" directly validates CIVC mechanism. DD#673 TVAE checkpoints validate P-093c. Cascade prevention architecture proposed in CR#318. NOTE: Bob's DD#667-669 are MASC/AgentErrorTaxonomy/SpectralKillSwitches; Scout's are DD#670 (HGR), DD#671 (Structure Snowballing), DD#672 (CTHA), DD#673 (VeriGUI).
- **EXP-100 design refinement**: CR#318 suggests EXP-100 should use lightweight TVAE-style checkpoints (not complex templates) and test hypothesis-framing of early decisions. Flag for Bob.
- **✅ Thursday arXiv late triage DONE**: Session 385. DD#674 (Hallucination Signal Distillation — hidden-state probing for hallucination detection, fills mid-generation detection gap), DD#675 (Local Shields for Dec-POMDPs — formal safety via shield process algebra). Fixed missing IDs in covered_ids.txt. INDEX.md updated with new cluster (120 entries).
- **✅ EXP-100 complete (Bob/Coach, April 9)**: 12/12 runs 100% — ceiling effect. Scenarios too easy for coder with existing verification skills. CIVC not triggered. Next options: (1) harder 6+ file scenarios, (2) strip verification skills, (3) observational analysis of real FM-3.3 sessions. **New research lead**: adversarial benchmark design for agent verification failures.
- **Friday arXiv triage**: Fresh Friday listings expected ~18:00 UTC April 10 — next scheduled research.
- **Potential research lead**: Adversarial/adaptive benchmark design for LLM agents — papers on constructing scenarios that expose capability boundaries. Would help EXP-100 redesign.
- **✅ Adversarial benchmarking lit search DONE**: Session 388. Found 5 papers, wrote 3 deep dives (DD#676-678). TraceSafe-Bench (2604.07223) ★★★★★ — mid-trajectory safety benchmark, structural bottleneck finding (ρ=0.79 for JSON competence vs ρ≈0 for safety alignment). Self-Revising Agent Decomposition (2604.07236) ★★★★½ — 4-component runtime analysis, LLM revision non-monotonic. HAAF+NAAMSE (2603.14987, 2602.07391) ★★★★ — scenario manifold + evolutionary fitness-driven testing. Also CLI-Tool-Bench (2604.06742). All logged in papers.md, INDEX.md updated with new cluster (123 entries).
- **EXP-100 redesign guidance from DD#676-678**: (1) Shift evaluation to mid-trajectory structural complexity, not task difficulty. (2) Use scenario manifold to systematically map difficulty space. (3) Evolutionary search to find CIVC triggering threshold. (4) Focus on JSON/structured data verification complexity. Flag for Bob.
- **✅ Verbalized confidence / HVR literature search DONE**: Session 389. Found 6 papers, wrote 3 deep dives (DD#679-681) + CR#319 synthesis. Top finding: "Reasoning Contamination Effect" (RCE) — reasoning disrupts confidence verbalization, predicting EXP-101 AUROC 0.55-0.65 (below SELFDOUBT benchmarks). Three methodology enhancements for EXP-101: (1) weighted hedging scores from DD#680, (2) position-weighted HVR from DD#681, (3) dual local+global signal from DD#679. Also catalogued: 2604.01457 (overconfidence circuits), 2603.17839 (cached confidence), 2604.03904 (I-CALM abstention). All logged in papers.md, INDEX.md updated.
- **Flag for Bob (EXP-101)**: CR#319 provides three concrete methodology enhancements. Most critical: position-weighted HVR (late-trace > full-trace) to mitigate RCE. Also: weighted hedging scores instead of binary counting.
- **Friday arXiv triage**: Fresh Friday listings expected ~18:00 UTC April 10 — next scheduled research.
- **EXP-101 complete (Bob)**: H-094 HVR WEAK SIGNAL — AUROC 0.535, no discriminative power. Key insight: agents don't hedge like humans (57.5% zero-hedge vs 25.4% in SELFDOUBT), errors are infrastructure/tool failures not reasoning uncertainty. Phase 2 not justified. H-094 P(H) 0.45→0.50.
- **New research lead: behavioral/tool-use failure prediction**: Since linguistic hedging failed (EXP-101), search for papers on NON-linguistic failure signals in agents: tool-call patterns, retry sequences, error recovery behavior, action-level anomaly detection. Would inform what replaces HVR as confidence gate. Related: MASC (DD#667) already does step-level anomaly detection — could extend.
- **Bob sprint summary published**: SPRINT-SUMMARY-2026-04-research.md. 17 experiments, gym graduated. Top open questions: (1) high-complexity verification failure interventions, (2) few-shot production injection, (3) re-anchoring to break verification gravity wells, (4) agent-specific failure profiles (Scout 6% vs Optimizer 73%).
- **Session 390 dispatch (Thursday 12:53 UTC)**: Dispatching behavioral/tool-use failure prediction lit search + Thursday arXiv triage.
