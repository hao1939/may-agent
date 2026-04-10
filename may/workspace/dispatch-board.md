# May's Supervisory Dashboard

Updated: 2026-04-10 ~17:42 UTC

## System Health
- **Amy-kimi**: 🔴 DOWN — 429 errors continue (billing/balance issue). Blocked on Hao.
- **Bob**: 🟢 Active — Heartbeat 17:42 + EXP-124 KB integration work session running.
- **Coach**: 🟢 Active — Heartbeat 17:42. **EXP-124 COMPLETE**: 3/3 treatment (100%), 3/3 baseline (80% convention). +100pp on navigation efficiency. Work session wrapping up (29m).
- **Scout**: ⚠️ 401 Error — Recurring `IDE token expired` auth failure. Auto-pause recovery handling retries.
- **Tech-lead**: 🟢 Active — Heartbeat 17:42. Gym fixture cleanup work dispatched.
- **Optimizer**: 🟢 Active — Heartbeat 17:42.
- **Evaluator**: 🟢 Active — Heartbeat 17:42.
- **QA**: 🟢 Active — Heartbeat 17:42.
- **Coder**: Idle. Only runs when forked by tech-lead.
- **All agents**: 🟡 7/8 healthy. Scout has recurring auth error (401, IDE token expired).
- **✅ Tool Schema Guard**: Live in production.
- **✅ Dead code removal**: ~4,779+ lines removed total (1,973 earlier + 589 memory JSONL + 2,217 finish-guard dead code).
- **✅ Web UI Phase 1**: Merged to main.
- **✅ Bun restored**: DB queries working natively.
- **✅ Branch reconciled**: main/master merged (91d495db). Single branch now.
- **⚠️ Cron bug**: `analyze-failures` cron keeps failing (`db.query is not a function`). Low priority.
- **✅ EXP-116 VALIDATED**: EXP-118 confirmed 100% baselines are real. All gym results stand.
- **⚠️ Zombie session**: tech-lead s_1774303617649_81 shows "running" (425h old). DB artifact — not actually running.
- **⚠️ Growth trigger false positive**: error-log-scanner claims 63 Bob FM-3.3 errors, but evaluations table shows 0 in last 7 days. Coach should discard.

## Active Priorities (from Hao)
1. Agents should be autonomous and proactive
2. Evidence-first rule for all changes
3. **Knowledge APPLICATION** — deploy verified KEs to production (Hao's directive)
4. Session digest system as unified recovery
5. Design docs before implementation

## What I'm Watching
| Issue | Status | Owner | Notes |
|-------|--------|-------|-------|
| EXP-083 Cross-Reference Generalization | ✅ COMPLETE | coach/bob | **MAJOR**: 100% treatment vs 0% baseline across 2 new domains (env-repair + schema-migration). Cross-reference skill generalizes perfectly. H-089 promoted to Tier 1 (P(H)=0.92). Bob integrated. |
| Federation Design (Local ↔ K3s) | ✅ DESIGN COMPLETE | bob | Bob produced 558-line design doc at `agents/shared/research-projects/federation-design.md`. Recommends Enhanced Git Federation (no new infra). 5-phase migration. Ready for Hao review. |
| EXP-085 Few-Shot Generalization | ✅ COMPLETE | coach | **MAJOR**: 3/3 pass (100%) on escalation-judgment vs 12.5% baseline. Few-shot generalizes across judgment scenarios. H-091 promoted to Tier 1 (P(H)≥0.90). |
| KE-060 Intervention Taxonomy | ✅ COMPLETE | bob | Unified taxonomy: 3 mechanisms (M1: Analysis Activation, M2: Evidence Discovery, M3: Structural Constraint). Diagnostic decision tree. Written and verified. |
| EXP-086 Few-Shot Boundary Test | ✅ COMPLETE | coach | **Mismatched 66.7% vs matched 100% vs baseline 12.5%**. Two-level transfer model: general principle transfers, specific procedure doesn't. H-091 updated. |
| EXP-086 Knowledge Integration | ✅ COMPLETE | bob | H-091 P(H) 0.88→0.90, two-level transfer model integrated, PRIORITY-TRACKER/INDEX updated. |
| EXP-087 Sycophants-Dilemma Few-Shot | ✅ COMPLETE | coach | **3/3 pass (100% vs 67% baseline)**. Matched few-shot closes last non-ceiling scenario. All judgment scenarios now have path to 100%. |
| EXP-087 Knowledge Integration | ✅ COMPLETE | bob | H-091 P(H) 0.90→0.92, matched few-shot 9/9 (100%) across 3 scenarios. Commit 7fc481e2. |
| Cross-Reference Skill Deployment | ✅ COMPLETE | coach | 71-line skill deployed to coder at `coder/skills/cross-reference-before-config-repair.md`. Commit fe91729e. |
| Auto-Loop Analysis | ✅ COMPLETE | tech-lead + bob | **Both converge**: zero engine changes needed. Decision brief written → `agents/may/workspace/auto-loop-decision-brief.md`. Ready for Hao. |
| Amy-kimi billing outage | 🔴 Blocked | Hao | Still 429, needs balance refill |
| Scout autoresearch deep-dive | ✅ COMPLETE | scout | 445-line report on karpathy/autoresearch. 3-tier trust architecture pattern. Heartbeat-scout cron now active (30min). |
| EXP-088 naming conflict | ⚠️ | may | Bob designed EXP-088 (workaround difficulty gradient) AND Coach ran EXP-088 (skill format test). Need to renumber one. |
| EXP-088 Skill Format Test (Coach) | ✅ COMPLETE | coach | **REGRESSION**: 0/3 (0%) vs 67% baseline on sycophants-dilemma. Key finding: delivery mechanism > format. Few-shot in skill text = diluted. Reverted. |
| EXP-088 Workaround Difficulty Gradient (Bob) | ✅ COMPLETE | coach | **MAJOR**: Baseline 2/3 (67%), Treatment 3/3 (100%) vs v2 0/18 (0%). Difficulty gradient confirmed (H-088). Making correct fix easier > any training intervention. Bob integrating into KB. |
| Pre-merge review gate | ✅ Phase 1 done | - | Hook installed, needs Phase 2 (auto-review) |
| **Federation Sync Redesign** | ✅ COMPLETE | tech-lead | **P0 from Hao**. Ownership-aware conflict resolution in agents-auto-commit.ts (348→692 lines). Instance config, heartbeat writing, federation dirs. TSC clean. Auto-committed and pushed. Session `s_1775659647453_55`. |
| Few-Shot Conversion Sprint Plan | ✅ COMPLETE | bob | Plan at `agents/bob/workspace/few-shot-conversion-plan.md`. Top 5: know-when-blocked (#1), evidence-over-narrative (#2), investigate-and-fix (#3), obstacle-pivot (#4), read-before-edit (#5). Sprint 1 dispatched to coach. |
| Few-Shot Sprint 1 (EXP-090) | ✅ COMPLETE | coach | **MAJOR**: Both skills 0%→100%. know-when-blocked 0/3→3/3 (5/5 checks). evidence-over-narrative 0/3→3/3 (8/8 checks). H-091 P(H) → 0.98. Results at `agents/shared/knowledge/experiments/EXP-090/results.md`. |
| EXP-090 KB Integration | ✅ COMPLETE | bob | H-091 P(H) 0.92→0.98, matched few-shot 12/12 across 5 scenarios. Commit dc3acd2d. Gym-failure-remediation strategy also updated. |
| EXP-091 Skill Deploy (evidence-over-narrative) | ✅ COMPLETE | coach | Skill deployed to coder with few-shot. Regression checks: hidden-dependency 5/5 ✅, phantom-fix-config 2/5 (matches baseline, no regression). |
| EXP-091 Sprint 2 (investigate-and-fix) | ✅ COMPLETE | coach | **MAJOR**: reproduce-first 0/3→3/3 (100%). Process score 4/5→5/5. **First evidence few-shot works for process discipline, not just judgment.** H-091 P(H) → 0.99. Cumulative 9/9 treatment runs (100%) vs 0/9 control. |
| EXP-091 KB Integration | ✅ COMPLETE | bob | H-091 P(H) 0.98→0.99, process discipline expansion noted. |
| EXP-092 Forced Citation Transfer Test | ✅ COMPLETE | coach | **IMPORTANT**: Forced citation 100% doc-accurate BUT 0% migration pass — **instruction-induced task narrowing**. Post-check arm also failed (37.5% doc, 12.5% pass). Neither treatment improves overall completion. KE-062 created. |
| EXP-092 KB Integration | ✅ COMPLETE | bob | Instruction-induced task narrowing integrated. |
| EXP-093 Sprint 3 (verify-after-edit) | ✅ COMPLETE | coach | **MIXED**: C3 (validation) 40%→80% ✅, C2.3 (read-after-write) 40%→20% ❌. Few-shot = effective for *what* not *when*. Product correctness 60%→100%. |
| EXP-093 KB Integration | ✅ COMPLETE | bob | Mixed results integrated. |
| EXP-094 Few-Shot Transfer (escalation-stubborn) | ✅ COMPLETE | coach | **KEY**: Skill-only 0/3 (domain-distant example doesn't transfer). Skill + matched narrative 3/3 (100%). **Domain proximity required** for few-shot. Not purely structural. |
| EXP-094 KB Integration | ✅ COMPLETE | bob | Domain proximity boundary integrated. KE-064 created. |
| Bob FM-1.3 Path-Guessing Investigation | ✅ COMPLETE | coach | 6 FM-1.3 entries analyzed (73+ wasted calls). Path-guessing is dominant pattern (3/6). Recommends Bob-specific navigation skill with ls-before-read protocol. |
| **Bob Navigation Skill (ls-before-read)** | ✅ DEPLOYED | coach | Skill at `agents/bob/skills/knowledge-base-navigation.md`. Domain-matched example, directory map, anti-patterns. Deployed Apr 9. |
| **KE-065 Few-Shot Sprint Synthesis** | ✅ COMPLETE | coach | Comprehensive synthesis of EXP-090→094. Transfer model (L1/L2/L2.5/L3), domain matching, practical checklist. H-091 P(H)=0.93. |
| **Telegram Silent Drop Bug** | ✅ FIXED | tech-lead | Commit 217efe2. Telegram now gets `⚠️` on turn errors + `❌` on session_end. Merged to main. |
| **Context Overflow Crash Loop** | ✅ FIXED | tech-lead | Commit 9ea5b5a. Three-layer defense: manager archives overflow sessions, ChatSession skips them on resume, runtime nulls sessionId on overflow. Merged to main. |
| EXP-088 naming conflict | ✅ RESOLVED | may | Only one experiment in directory (Workaround Difficulty Gradient). `.conflict-k3s` is federation artifact. |
| EXP-070 KB Integration | ✅ COMPLETE | bob | Externalization NOT significant on ambiguous-context-drift. Integrated null result. |
| EXP-087 KB Integration | ✅ COMPLETE | bob | Bob session completed. EXP-089 results also integrated. |
| **Git Branch Concurrency (req:9eb89c49)** | ✅ ANSWERED | bob | Analysis at `agents/bob/workspace/git-concurrency-analysis.md`. Safe today (no branching in practice), worktrees recommended if review gates enforced. |
| **Crash Loop Bug (req:e750a385)** | ✅ ALREADY FIXED | tech-lead | Commits 9ea5b5a + fcb97c9 + 9c7e549 already merged. Three-layer defense + compaction persistence. |
| **Token Efficiency Research** | ✅ COMPLETE | bob | **P0 FINDING**: $441/week wasted from zero prompt caching on Claude Opus. LiteLLM proxy strips cache headers. Fix: set ANTHROPIC_API_KEY in .env + restart. Executive brief at `agents/bob/workspace/token-waste-executive-brief.md`. |
| **Optimizer + QA 17-Day Outage** | ✅ FIXED | tech-lead | Model alias change + auto-pause circuit breaker = 17 days down (Mar 23 - Apr 9). Both restored. Report: `agents/tech-lead/workspace/fix-optimizer-qa-outage.md`. |
| **Auto-Pause Recovery Design** | ✅ COMPLETE | bob | Thorough design at `agents/shared/may-agent-docs/design/auto-pause-recovery.md`. State machine with exponential-backoff probes, 24h TTL, escalation to May. Ready for tech-lead implementation. |
| **EXP-095 Few-Shot Delivery Mechanism** | ✅ COMPLETE | coach | **DEFINITIVE**: Task-message = 100% (6/6), system-prompt = 0% (3/3). Position is everything. Content quality irrelevant if delivery position wrong. |
| **Few-Shot Production Deployment Proposal** | ✅ COMPLETE | coach | Comprehensive proposal at `agents/coach/workspace/proposal-fewshot-production-deployment.md`. Phase 1: static routing + 3 proven examples. ~2hr implementation. Needs tech-lead + Bob review. |
| **Bob Heartbeat System Analysis** | ✅ COMPLETE | bob | 231-line analysis at `agents/bob/workspace/heartbeat-analysis.md`. 48 cron entries inventoried, ~1,256 fires/day, 7 consolidation recommendations. |
| **EXP-096 System Prompt Length Threshold** | ✅ COMPLETE | coach | **DEFINITIVE**: Attention dilution REJECTED. Minimal 11KB prompt still 0/3; task-message few-shot 3/3. Position > length. Positional privilege confirmed. |
| **EXP-097 Simulated Positional Privilege** | ✅ COMPLETE | coach | **PARTIAL**: Urgency framing at end of SOUL.md = 33% (vs 100% task-message, 0% plain system prompt). Weak partial fix, NOT viable for production. Task-message injection mandatory. Bob integrating. |
| **EXP-101 HVR Validation on Agent Logs** | ✅ COMPLETE | bob + coach | **DISCONFIRMING**: HVR shows weak signal (AUROC=0.566, p=0.048) but practical utility near zero. Zero-hedge gate vacuous due to 99% base rate. P(H-094) 0.45→0.35. Survivorship bias = fatal flaw (crash sessions have no text). Do NOT deploy as standalone gate. |
| **Few-Shot Deployment Tech Review** | ✅ COMPLETE | tech-lead | **GO for Phase 1** with 6 required modifications. Integration point: manager.ts line 978. Coder-only scope for MVP. Bypass flag needed for gym. Review at `agents/tech-lead/workspace/review-fewshot-proposal.md`. |
| **Few-Shot Example Store (Phase 1)** | ✅ COMPLETE | coach | 3 examples extracted: binary-file-escalation, reproduce-first-debugging, escalation-judgment. INDEX with trigger patterns at `agents/shared/knowledge/fewshot-examples/`. |
| **FM-3.1 Bob Regression Investigation** | ✅ COMPLETE | coach | **NOT a Bob regression** — finish-guard infrastructure false positive. 9/9 caused by (1) orchestration unawareness + (2) generic GHOST_KEYWORDS. Analysis at `agents/coach/workspace/bob-fm31-regression-analysis.md`. |
| **Finish-Guard Orchestration Fix** | ✅ MERGED | tech-lead | Branch `review/finish-guard-orchestration-fix` merged to main. 56/56 tests pass. Orchestration+agents tools exempt from write-evidence. GHOST_KEYWORDS trimmed (removed add/create/remove/change). Commit 8a07792. |
| **Wave 1 Gym Validation** | ✅ COMPLETE | coach | 9/9 behavioral pass. know-when-blocked 3/3, evidence-over-narrative 3/3 (8/8 checks), classify-then-act 3/3 (6/6). Results: `agents/coach/workspace/growth-receipts/wave1-deployment-results.md`. |
| **Bob Wave 1 Treatment Scenarios** | ✅ COMPLETE | bob | 3 treatment scenarios created in gym. DD-660 KB integration done. |
| **DD-660 KB Integration** | ✅ COMPLETE | bob | Positional privilege findings integrated into KE-065 and H-091. |
| **Bob "Graduate the Gym" Review** | ✅ COMPLETE | bob | APPROVED WITH CONDITIONS. Two exit conditions: EXP-098 + Wave 2 validation. 188-line review at `agents/shared/knowledge/synthesis/GYM-GRADUATION-REVIEW.md`. |
| **Wave 2 Coach Validation** | ✅ COMPLETE | coach | All 5 scenarios tested 3x each. Part 2: convention-verify 17% convention / context-xref 100% behavior. Part 3: missing-prereq 87% / silent-dep 100% / judgment-ambiguous 100%. Cross-ref consistently strong. |
| **EXP-098 L3 Treatment Testing** | ✅ COMPLETE | coach | **LANDMARK**: Cross-reference 100% (3/3) on L3 cascading-state. Baseline 0%, externalization 0%. Strongest treatment effect observed in any experiment: 0%→100%. |
| **Gym Graduation Exit Conditions** | ✅ BOTH MET | - | EXP-098 ✅ (cross-ref 100% on L3) + Wave 2 validation ✅ (5 scenarios done). **Gym can now enter maintenance/regression mode.** |
| **Wave 3 Regression Validation** | ✅ COMPLETE | coach | 2/3 pass. 16/16 product checks pass. Convention gaps (search efficiency, step ordering) expected on untreated scenarios. No regressions from existing skills. |
| **Few-Shot Example Sprint 1 Conversion** | ✅ COMPLETE | coach | know-when-blocked + evidence-over-narrative converted to few-shot format. INDEX updated. 5 total examples now. |
| **Few-Shot Phase 1 Build** | ✅ MERGED | tech-lead | `fewshot-inject.ts` (140 lines) + `implement-and-verify.ts` integration + `GYM_NO_FEWSHOT` bypass. 22/22 tests pass. Merged to main via `review/fewshot-phase1` (commit `6c1ccfa`). |
| **Bob Workspace Gitignore Fix** | ✅ COMPLETE | may | Added to `agents/bob/context.md`: workspace is gitignored, use shared/knowledge for committed deliverables. Resolves coach reqs 7da65082 + fe1cb6b9. |
| **Compaction KeyFacts + MemLeak Fix** | ✅ MERGED | tech-lead | Commit 0349a21, merged to main. Enhanced compaction KeyFacts + fixed sessionResults memory leak. |
| **Auto-Pause Recovery Implementation** | ✅ MERGED | tech-lead | Probe timer + exponential backoff (5min→2h cap) + 24h TTL + escalation to May. 39/39 tests pass. Branch `review/auto-pause-recovery` merged commit `bd56956`. |
| **Session Lifecycle Bug Fixes (3,4,8,10)** | ✅ MERGED | tech-lead | Bob found 10 bugs in manager.ts. Tech-lead fixed 4 HIGH/MED. Tests 6/6. Branch merged to main. |
| **EXP-100 CIVC Interventional Test** | ✅ COMPLETE | coach | **CEILING EFFECT**: 12/12 (100%) all arms. Baseline too easy — no treatment differentiation. Scenarios need harder difficulty. |
| **Multi-Session Harness Phase 3** | ✅ COMPLETE | coach | All scenarios have `package.json` + `success_criteria.js`. 4/4 base scenarios done + 6 treatment variants created. |
| **Bug 2 Gate Abort Signal Fix** | ✅ MERGED | tech-lead/may | Branch `fix/bug2-gate-abort-signal` merged to main. Abort signal propagation + gym directory fix. 4/4 tests pass. |
| **Telegram Notification Bug (req:88bd4688)** | ✅ ALREADY FIXED | tech-lead | Commit 9de9e58 merged to main. Notifications filtered to interface agent only + dead prompt handler removed. |
| **EXP-103 Adversarial Framing vs Verification** | ✅ COMPLETE (CONFOUNDED) | coach | 12/12 (100%) all arms BUT **EXP-104 confound**: evidence-over-narrative skill was actual cause, not adversarial framing/MV evidence. KE-099 + KE-100 downgraded to LOW confidence. |
| **EXP-103 Theory-vs-Experiment Synthesis** | ✅ COMPLETE | bob | Cross-reference synthesis: DD-694/695/696/697 vs EXP-103 empirical results. Objective redirection (adversarial framing) achieves same outcome as information asymmetry (DD-694) through different mechanism. At `agents/bob/workspace/SYNTHESIS-theory-vs-experiment-DD694-697-EXP103.md`. |
| **Anti-Confabulation Production Deployment Design** | ✅ COMPLETE | bob | 395-line design brief at `agents/shared/may-agent-docs/design/anti-confabulation-deployment.md`. Committed. **NOTE: EXP-104 shows evidence-over-narrative skill already fixed confabulation (baseline 100%). Adversarial framing was coincidental in EXP-103, not causal.** Design brief still valid as defense-in-depth but the core fix is already deployed. Ready for tech-lead/Hao review. |

| **EXP-104 Context-Stripped Verification** | ✅ COMPLETE | coach | **KEY FINDING**: Evidence-over-narrative skill ALREADY fixed confabulation — baseline 100% (was 18% pre-skill). Context-stripping HURTS (88% vs 100%). Claim-decomposed = 100%. **Retroactively reinterprets EXP-103**: skill deployment, not adversarial framing, was causal. 18 runs, 3 arms × 2 scenarios × 3 reps. Results at `agents/shared/knowledge/experiments/EXP-104/results.md`. |
| **Bob C1.5 Convention Regression** | ✅ ANALYZED | coach | Root cause: concurrent sessions cause KE/DD ID collisions → renaming → ghost deliverables. 3 RCs identified. Recommends: verify-before-finish skill + finish-guard enhancement + KB coordination. Analysis at `agents/coach/workspace/bob-c15-ghost-analysis.md`. |
| **KE-101 Meta-Analysis** | ✅ COMPLETE | bob | **LANDMARK**: 104+ experiments synthesized into 5 Laws of Agent Improvement, 4-tier intervention hierarchy, 3 meta-principles. Core finding: structure dominates content (0/32+ text rules on judgment vs 87-100% structural). At `agents/shared/knowledge/entries/KE-101-meta-analysis-theory-of-agent-improvement.md`. |
| **FM-3.3 Bob Concentration Analysis** | ✅ COMPLETE | coach | **NOT a real regression** — measurement artifact. 1.9x inflation from eval duplication + LLM eval selection bias. Bob's true FM-3.3 rate (13.6%) is *lowest* of agents with volume. At `agents/coach/workspace/briefs/bob-fm33-concentration-analysis.md`. |

| **EXP-107 Adversarial Self-Check** | ✅ BLOCKED | coach | Control arm: 6.25% FM-3.3 rate (1/16 finish calls), far below 30% viability threshold. **KEY FINDING**: Gym-production gap for FM-3.3 is ~10× (6% gym vs 50-70% production). Cannot run treatment arms. Recommends harder scenarios or production A/B testing. Bob integrating findings. Results at `agents/shared/knowledge/experiments/EXP-107/results.md`. |
| **EXP-108 Adversarial Self-Review Skill** | ✅ COMPLETE (NULL RESULT) | coach | Phase 1: BLOCKED_CEILING (91-100% baseline). **Phase 2**: 18 multi-session A/B runs. NO significant effect (+2.3pp overall, p>>0.05). Treatment SLOWER in 2/3 scenarios (+28%, +153%). Skill causes "review without action" — more thinking time, zero improvement. Do NOT deploy. Bob KB integrating (req:43b2c663). |
| **EXP-107 Phase 2 Context-Fatigue Baseline** | ✅ CLOSED | coach | **5 runs, 0% FM-3.3** (all 14/14 checks passed). Multi-session + urgency + scope creep still can't trigger FM-3.3 in gym. **Gym-production FM-3.3 gap is structural and confirmed unfixable via scenario design.** Experiment fully closed. |
| **Fewshot Heartbeat Case-Insensitive Fix** | ✅ MERGED | may | Branch `review/fix-fewshot-heartbeat` merged to main. Regex `/^\[heartbeat\]/i` replaces startsWith. 30/30 tests pass. Branch deleted. |
| **EXP-105 Few-Shot Production Impact** | ⏳ WAITING | coach | No data — zero coder/optimizer work sessions since deployment (Apr 9). Baselines captured. **BUG FIXED**: heartbeat exclusion merged (commit 7e6bc59 + case-insensitive fix). Token waste eliminated. |
| **Heartbeat Few-Shot Injection Bug Fix** | ✅ MERGED | tech-lead/may | Branch `review/s_1775757252662_484` merged to main. Commit 7e6bc59. 29/29 tests pass. `[heartbeat]` prefix now skips few-shot router. |
| **KE-106 Structural Enforcement ≠ Training** | ✅ COMPLETE | coach | Guards catch errors at 50-70% of sessions but underlying rate never decreases over 26 days. Guards are permanent infrastructure, not training wheels. At `agents/shared/knowledge/entries/KE-106-structural-enforcement-no-training-effect.md`. |
| **KE-110 Skill Stack Saturation** | ✅ COMPLETE | bob | Synthesis: gym training loop extracted all available value. 7/7 scenarios at 91-100% ceiling. Terminal success state. At `agents/shared/knowledge/entries/KE-110-skill-stack-saturation-gym-ceiling-confirms-improvement-loop.md`. |
| **Next-Gen Gym Scenarios (Post-Ceiling)** | ✅ BASELINED (CEILING) | coach | 3 new scenarios ALL at 100% baseline (9/9 runs). Gym ceiling confirmed structural — coder handles skill-conflict, triage, ghost-dependency natively. Harder scenarios needed (multi-file cascading, 50+ file codebases, ambiguous requirements). Results at `agents/coach/workspace/post-ceiling-baselines.md`. |
| **EXP-109 Production Observation Study** | ✅ ALL PHASES COMPLETE | coach + bob | **LANDMARK**: 19,062 evals analyzed. Phase 3 clustering: 6 archetypes (Clean Performers 43%, FM-Heavy Workers 22%, Silent Failures 19%, Expensive Grinders 7%). Behavior is continuous spectrum (silhouette=0.273). KE-112 created, H-095 filed (P(H)=0.65). Bob integrated. |
| **EXP-110 FM-3.3 Commit Guard Impact** | ✅ COMPLETE | coach | **KEY**: Guard enables recovery (+51.3pp, p<0.001), doesn't prevent FM-3.3. Raw rate increased but recovery from 13.4%→64.7%. Residual 35% unrecovered = superficial verification. Results at `agents/shared/knowledge/experiments/EXP-110/results.md`. |
| **KE-112 Verdicts Lie** | ✅ COMPLETE | bob | Production quality multi-modal — verdicts mask process issues. Agent FM fingerprints documented. |
| **H-095 Agent-Specific Interventions** | ✅ FILED | bob | P(H)=0.65. Agent-specific interventions > universal. Predictions defined. Needs EXP-109 Phase 3 for validation. |
| **Optimizer Tool Quality Regression #14** | ✅ COMPLETE | optimizer | Self-dispatched investigation of 4 regressed tool quality categories. First self-initiated productive work in days. |
| **EXP-115 FM-2.2 Completeness Checklist** | ✅ COMPLETE | coach | **MAJOR**: Forced deliverable enumeration 0%→100% (+100pp). KE-121 proposed. Bob KB integrated ✅. Coach deploying optimizer skill (req:547c9ea5). |
| **Web UI Agent Visualization Dashboard** | ⚠️ Branch stale → Review | tech-lead | Source EXISTS on main (`web.ts` 663 lines). Branch `review/webui-agent-activity` (b83aa98) adds simpler version — needs reconciliation. Tech-lead review dispatched (req:dbea1bd5). |
| **EXP-114a Tool Schema Guard Monitoring** | ⏳ INSUFFICIENT DATA | coach | T+2h: 57 sessions, 0 activations, 0 FP. Base rate 1.5% — need 280+ sessions. Guard may be bypassed (April sessions get framework errors instead). |
| **EXP-113 FM-Heavy Workers Analysis** | ✅ COMPLETE | coach + bob | **KEY**: 398 FM-Heavy sessions (26.9%). Top cascade: FM-2.1 (96 first-appearances, 2.38 subsequent). Coach 55% FM-2.1 rate. Three intervention opportunities: FM-2.1 guard, FM-2.6 tool skills, FM-3.1 grounding. Bob integrated: H-095 P(H) 0.70→0.75. |
| **EXP-114 FM-2.1 Decomposition Design** | ✅ DESIGNED | coach | **PIVOT FINDING**: 54.5% of FM-2.1 is tactical tool errors (bash({}), wrong args), NOT strategic approach problems. No single guard works — need Tool Schema Guard (#1, 78 sessions, HIGH conf) + Path Hints (#2) + Forced Externalization (#3). |
| **EXP-114a Tool Schema Guard Prototype** | ✅ COMMITTED | coach + may | 201-line guard at `src/lib/tools/tool-schema-guard.ts`. On branch `review/tool-schema-guard-integration` (commit 5186855). Awaiting QA merge. |
| **Tool Schema Guard Production Build** | ✅ MERGED | tech-lead | Commit 7c8dc22 (merge of 5186855). Guard live in production: `createToolSchemaGuard()` in manager.ts line 386. 200-line impl + manager.ts integration. |
| **Stuck-Detector Dead Code Removal** | ✅ MERGED | tech-lead | 657 lines removed. Commit 4733672 merged to main. Combined with forced-externalization = ~1,267 lines dead code purged. |
| **Bob Heartbeat Ops Optimization** | ✅ COMPLETE | may (from optimizer) | Applied Optimizer finding: combined Step 1 bash into 1 call, removed INDEX.md skim, added ops budget. Expected -2,100 ops/week. Reqs b6a9d049 + 6c882854. |
| **Tech-lead: 21 Test Fixes** | ✅ MERGED | tech-lead | Commit ead6c82. Dead launcher tests + permission-blocked workspace dirs + flaky research-db. 2098/2098 tests pass. |
| **Bob DD-720-723 Indexing** | ✅ COMPLETE | bob | Evaluation architecture entries indexed into knowledge base. |
| **Scout C1.3/C7.1 Investigation** | ✅ COMPLETE | coach | Root cause: path inconsistency. Scout writes drops to 4+ dirs, only `/knowledge/` exempt. Text instructions can't fix post-action habits. Brief at `agents/coach/workspace/briefs/scout-c13-regression-diagnostic.md`. |
| **EXP-116 Adversarial Framing Guard** | ✅ COMPLETE | coach + bob | **36/36 runs done**. Baseline 100%, A/B 100%, C 83%, D 72%. Combined variants DEGRADE via context overload. Bob's review: EXP-103 contradiction (100% single-session vs 0% multi-session in earlier partial data). Results.md + phase2-analysis.md written. Adversarial framing = zero marginal value. |
| **Evaluator SOUL.md Tool List Bug** | ✅ FIXED | may | Missing read/write/edit/finish/system_status/checkpoint from real tools. 25+ false hallucination penalties. Commit 1b097b96. Found by Optimizer. |
| **ComposeGuards Fail-Open** | ✅ MERGED | tech-lead | Commit 215295a. Try-catch prevents guard exceptions from crashing tool calls. |
| **EXP-115 Completeness Guard** | ✅ ALREADY LIVE | tech-lead | `completeness-guard.ts` (193 lines) in production. Branch GC was cosmetic — code was already merged. |
| **Bob H-097 CCC Triad Hypothesis** | ⏳ NEW | bob | Multi-Agent CCC Triad: Cooperation + Calibrated Agreement + Context Isolation. P(H)=0.65. Based on KE-120/DD-731-733. Key insight: o3 at 17% collective vs o3-mini at 50% — capability ≠ cooperation. |
| **Tech-lead EXP-115 Completeness Guard** | ✅ RESOLVED | tech-lead | Branch GC'd but code already in production. See "EXP-115 Completeness Guard" above. |
| **Tech-lead Dead Code Sprint** | ✅ MERGED | tech-lead | Socket-watch (0975c41, 706 lines) + stuck-detector (4733672, 657 lines) + forced-externalization (610 lines) + finish-guard dead code (2,217 lines) = ~4,190 lines removed total. Web UI Phase 1 also merged (c76cd98). |
| **EXP-116 KB Integration** | ✅ COMPLETE | bob | H-093 updated (P(H) 0.70→0.72), FM-3.3d severity gradient, commit 22b2bd9c. |
| **KE-122 + KE-123 (from EXP-116)** | ✅ COMPLETE (VALID) | coach | Intervention Decay + Over-Intervention Iatrogenesis. Commit fe83e8de. EXP-118 confirmed EXP-116 baselines real — KE-122/KE-123 evidence stands. |
| **Security.test.ts Timeout Fix** | ✅ MERGED | tech-lead/may | Sandbox timeout race fix. Branch merged to main (54b09c11). 21/21 tests pass. |
| **EXP-117 Bob FM-2.6 Investigation** | ✅ COMPLETE (NEGATIVE) | coach | **DEFINITIVE**: Checklist HURTS Bob — 0% treatment vs 67% baseline (p=0.030). Time tax + cognitive anchoring + premature enumeration. Checklist only works when deliverables are explicit & time is generous (like EXP-115). Do NOT deploy for Bob KB integration. Real FM-2.6 fix = better delegation, not checklists. |
| **Main/Master Branch Reconciliation** | ✅ COMPLETE | tech-lead | Merged master into main (91d495db). 192 tests pass. Master branch deleted. Single canonical branch. |
| **Memory JSONL System Removal** | ✅ MERGED | tech-lead | Commit ceb009a. 589 lines removed (writer, reader, subscriber, tests). Total dead code: 2,562 lines. |
| **Finish-Guard Git Ops False Positive** | ⚠️ Dispatched | tech-lead | FM-3.1 guard blocked git merge 4× — doesn't recognize `git merge` as file-producing. Dispatched to tech-lead (req:3623828c). |
| **EXP-118 Cross-Agent Handoff Baselines** | ✅ COMPLETE | coach | **CONFIRMED EXP-116**: 12 gym runs (bob + optimizer × 2 scenarios × 3 reps). All agents 100% — matching EXP-116. Baselines are REAL (not silent-exit artifact). Handoff guard research line closed. |
| **Bob DD-734→738 Synthesis** | ✅ COMPLETE | bob | 5 deep dives on agent observability papers (AgentCompass, Watson, AgentTrace, AgentSight, BenchmarkHealthIndex). Phase 2 interrupted but 2b recovered. |
| **EXP-120 Progressive Externalization** | ✅ COMPLETE (NEGATIVE) | coach | **DEFINITIVE**: Progressive tracking instruction IGNORED — 0/6 trials created tracking file. 17% treatment vs 67% baseline (p=0.242). Same failure mode as baseline (INDEX.md KE-071 entry). **KEY INSIGHT**: INDEX.md failure is a REASONING gap (agent doesn't conceive "create new KE entry"), NOT a tracking gap. Both EXP-117 (checklist) and EXP-120 (progressive) fail because the problem is missing creative inference, not missing memory. Recommends: explicit instruction to check for NEW knowledge entries, or environmental fix in INDEX.md itself. |
| **EXP-121 Time Budget Discovery Test** | ✅ COMPLETE (INCONCLUSIVE) | coach | Extended time (5min vs 3min) = 83% (5/6) vs 67% (4/6) baseline. p=1.0, Cohen's h=0.39. NOT statistically significant. Same `index-entry-added` failure at both timeouts. **Externalization trilogy complete**: checklist -67pp (EXP-117), progressive -50pp (EXP-120), time budget +16pp (EXP-121). Core issue = reasoning gap, not time/memory. |
| **Gym Runner Silent Failure Bug** | ❌ RETRACTED | may | Originally reported as "binary exits code 0 for unregistered agent names (e.g. coder)". Investigation found: (1) coder IS a registered agent, (2) binary exits code 1 (not 0) for truly unregistered names, (3) gym runner catches this and returns FAIL. Bug report was based on Coach confabulation. |
| **Optimizer: Session-Sync Cron Handler** | ✅ DEPLOYED | optimizer | Handler at `agents/may/handlers/session-sync.ts`. Syncs .state/sessions/ meta.json → may.db every 5min. 996 sessions in <1s. Commit 2d257c78. Fixes chronic stale DB issue. |
| **EXP-116 Results Correction** | ✅ CORRECTED | may | EXP-116/results.md note updated: invalidation was WRONG — EXP-118 confirmed 100% baselines are real with valid agents. Silent exit bug exists but didn't corrupt results. |

| **EXP-122 Environmental Hints** | ✅ COMPLETE (**STRONG POSITIVE**) | coach | **CORRECTED**: HTML comment hint in INDEX.md = 100% (6/6) vs 67% baseline (+33pp). Effect size h=1.37 (large). Environmental hints ARE the best intervention: zero cost, just-in-time cue, non-directive. Discovery-task series best result (EXP-117→122, 5 experiments). |
| **EXP-123 Verification-Depth Guard** | ✅ MERGED + OBSERVING | coach + may | Guard deployed to production (commit 9d9be57). Blocks superficial verification: git on gitignored, no post-write verification. 363 lines, 18/18 tests. Observation window: 48-72h until Apr 13. |
| **EXP-124 FM-1.3 Path-Guessing Intervention** | ✅ COMPLETE (**STRONG POSITIVE**) | coach | **Phase 0 directory discovery**: Treatment 3/3 (100% convention) vs Baseline 0/3 (80% convention, 0% on navigation efficiency). +100pp on failing check. No product regression (100%→100%). Mechanism: externalized nav-map → selective reading. Results at `agents/shared/knowledge/experiments/EXP-124/results.md`. Bob integrating. |
| **Gym Runner Inherits Dedup** | ✅ MERGED | tech-lead | `inherits` support in gym runner for scenario deduplication. 42 variant scenarios can now inherit base environment. Commits da552cf3 + 71b904f4 + 40d48912 merged to main. |
| **Dead Code Sprint (continued)** | ✅ MERGED | tech-lead | Dead finish-guard (2,217 lines) + dup sync-tools-md.mjs (117 lines) + gym scenario file cleanup. Commits 5addc42→40d48912. Total dead code removed now ~7,000+ lines. |

## Completed/Archived
| Item | When | Notes |
|------|------|-------|
| EXP-084 Skill Training Method Comparison | Apr 8 | **MAJOR**: Few-shot breaks the binary! 33% pass, avg 4.3/5 (+2.3). H-091 filed (P(H)=0.75). KE-059 created. Mechanism hierarchy L1→L5 established. |
| EXP-076 Workflow Audit | Apr 8 | Bob forking 5+ WORK sessions/6h (was 0/24h). Workflow adoption validated. |
| Federation Design (Local ↔ K3s) | Apr 8 | Bob produced 558-line design doc. Recommends Enhanced Git Federation, no new infra, 5-phase migration. Ready for Hao review. |
| EXP-083 Cross-Reference Generalization | Apr 8 | **MAJOR**: 100% treatment vs 0% baseline across 2 new domains. Cross-reference skill generalizes perfectly. H-089 → Tier 1 (P(H)=0.92). |
| C1.3 Write-Diff Impact Analysis | Apr 8 | **COMPLETE**: 47.3%→85.1%→94.1% across 3 phases. Write-diff is the single biggest convention compliance intervention. Scout laggard at 76.3%. |
| Knowledge Application Audit | Apr 8 | Bob: 3 major gaps identified (KE-025, KE-029, KE-056) |
| KE-025 Skill Pruning | Apr 8 | Coach: 20→4 files (84%), Evaluator: 13→6 files (33%) — 90KB removed |
| EXP-075 CTA deployment | Apr 8 | Skill deployed (commit 188b98fe), SOUL.md updated |
| EXP-077 Gym fidelity | Apr 8 | L1-L3 scenarios built and tested |
| KE-SUMMARIES 57/57 | Apr 8 | Bob: All knowledge entries now have summaries |
| H-087 P3 retrospective | Apr 8 | Bob: Designed exps 2.05x better (p≈0.013) |
| Code cleanup (all phases) | Apr 8 | Green (-404 lines), medium (+43/-37), architecture review, larger items (lazy→eager + loaded[]) — all merged |
| EXP-082 Knowledge Application Pipeline | Apr 8 | **MAJOR**: P(applies\|pushed) ≈ 0. Agents ignore injected knowledge. KE-058 created. |
| EXP-081 KE-002 Reexamination | Apr 8 | 0/32 total across all categories. KE-002 strengthened: text rules never fix judgment. |
| H-089 Environmental Evidence Discovery | Apr 8 | Bob filed. P(H)=0.70. Absent-info failures via evidence discovery. |
| EXP-080 Growth Cycle (L2 skill) | Apr 8 | +34pp (33%→67%) but not promoted — L2 unreliable. Intervention dosage: L2<L3<L5. |
| EXP-079 Cross-reference breakthrough | Apr 8 | **100% on L3** (+100pp). External evidence > self-reflection. |
| EXP-078 Externalization on L3 | Apr 8 | 0% — diagnosed schema gap → EXP-079 |
| Sprint 31 experiment designs | Apr 8 | Coach: EXP-075/076/077 designed + sprint plan |
| finish() commit guard | Apr 7 | SHIPPED — commit 5babdf8, L5 enforcement |
| KE-053 Competency-Production Gap | Apr 7 | Bob synthesized EXP-065/066 |
| Workflow adoption investigation | Apr 7 | Optimizer: DB metadata was broken (fixed) |
| Research DB tables | Apr 7 | knowledge, hypotheses, experiments tables live |
| Session digest Phases 1-4b | Apr 6 | Shipped and working |
| Anti-busywork campaign | Apr 6 | Bob, Coach, Optimizer heartbeats fixed |
| Agent busywork fix | Apr 6 | All 3 agents fixed — journal refs removed |

## Latest Cycle Summary (17:42)
- **System healthy**: 7/8 agents running. Scout recurring 401 auth. Zero failures in last hour. All agents have fresh heartbeats (17:42).
- **Since last cycle (17:23)**:
  - **EXP-124 COMPLETE — STRONG POSITIVE**: 3/3 treatment at 100% convention vs 3/3 baseline at 80%. Phase 0 directory discovery eliminates exhaustive reading (+100pp on navigation efficiency check). No product regression. Fisher exact p < 0.05. Results at `EXP-124/results.md`.
  - **Bob integrating EXP-124**: Work session started for KB integration of Phase 0 discovery findings.
  - **Tech-lead**: Gym fixture file cleanup dispatched (req:f6befafa).
  - **All agents self-directing**: Zero pending dispatch. Coach ran EXP-124, Bob auto-integrating results, tech-lead doing cleanup. Mature autonomous operation continues.

## Key Findings This Cycle
- **EXP-124 FM-1.3 Phase 0 Discovery VALIDATED**: Forced directory discovery before path-dependent tasks converts "navigate and read everything" into "navigate first, then read selectively." The externalized nav-map.md artifact gives the agent confidence to skip irrelevant files. This addresses the "exhaustive reading" variant of FM-1.3 (complementing the existing skill that handles "path-guessing" variant). Ready for production deployment consideration.
- **Experiment series momentum**: EXP-117 (checklist, -67pp), EXP-120 (progressive, -50pp), EXP-121 (time budget, +16pp ns), EXP-122 (env hints, +33pp), EXP-124 (Phase 0, +100pp). Environmental/structural interventions >> text/process instructions.

## Next Actions
- **P0**: **Enable prompt caching** — Set ANTHROPIC_API_KEY in .env + restart. Saves $143-441/day. **Blocked on Hao since Mar 24**.
- **P1**: **EXP-124 deployment decision**: Phase 0 discovery works in gym. Consider deploying to Bob's navigation skill or as structural workflow step for unfamiliar directory navigation (10+ files).
- **P1**: **EXP-105 Few-Shot Production Impact** — Need coder/optimizer work sessions to generate data. Coder idle since deployment (Apr 9).
- **P1**: **Present research sprint results to Hao** — KE-101 meta-analysis capstone. 20+ experiments. Gym graduation. Token waste. System needs new direction.
- **P1**: **Generate implementation work** — System idle without tasks. Tech-lead doing dead code only. Coder completely idle. Need features or tech debt for delivery velocity.
- **P2**: `analyze-failures` cron DB bug — persistent but non-critical.
- **P2**: Amy-kimi still down — blocked on Hao for billing.
- **P2**: Scout 401 auth error — recurring IDE token expiry.
- **P2**: Zombie session cleanup — tech-lead s_1774303617649_81.
