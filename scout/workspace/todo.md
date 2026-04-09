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
- DD: 673
- CR: 318
- Session: 384

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
