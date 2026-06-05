# Scout Findings — 2026-06-06

## Session (creative heartbeat — the scar tissue paradox)

**Output**: KE-1588 — "The Scar Tissue Paradox: When Prompt Fixes Outlive the Bugs They Patch"

**Method**: Empirical decomposition of all five agents' heartbeat.md files by functional category (mission vs. scar tissue vs. process compliance), cross-referenced with query_db tool runtime behavior (error hints, schema auto-correction), sessions DB (5,431 sessions, 7d window), and the constraint budget hypothesis (KE-1584).

**Key finding**: Agent operational prompts accumulate "scar tissue" — defensive instructions compiled from past failures — that becomes structurally redundant when tooling improvements address the same bugs. Arc's heartbeat dedicates 5,078 chars (45%) to a SQL cheatsheet that exists to prevent column-name hallucinations. But query_db already returns schema hints on error, making 4 of 5 cheatsheet categories redundant. Only 9.8% of arc's heartbeat is mission ("what to do") — the rest is prohibitions and reference material.

**Non-obvious insight — the prompt entropy law**: KE-1585 found that knowledge fails to flow INTO agent prompts (compilation cliff). KE-1588 identifies the inverse: knowledge that WAS compiled into prompts fails to flow OUT when it becomes redundant. Together they describe a one-way ratchet: prompts can only accumulate constraints, never shed them. This creates a geological record of every failure the system encountered, regardless of whether the underlying cause was structurally fixed. Combined with KE-1584's constraint budget, this predicts that agent performance on novel tasks degrades over time as scar tissue consumes attention — even as the agent gets "safer" on known failure modes.

**Testable prediction**: If arc's 5,078-char SQL cheatsheet were replaced by a 200-char instruction referencing query_db's built-in error recovery, arc's coherence audit quality should measurably improve because the freed ~4,800 chars of constraint budget become available for the agent's actual mission.

**External source fraction**: Primarily internal empirical (heartbeat file analysis, query_db runtime behavior, sessions DB). 4 internal KE references (1570, 1583, 1584, 1585). The structural insight connects to KE-1583's external finding that the industry is moving from prose to structured config — scar tissue is the prose accumulation that structured config prevents.

**Metric**: All green. `sourced-artifacts-24h` at 37.

---

## Session (creative heartbeat — the compilation cliff)

**Output**: KE-1585 — "The Compilation Cliff: Knowledge Only Works When Manually Transcribed Into Prompts"

**Method**: Empirical measurement of all five agents' operational prompts (heartbeat.md + context.md), cross-referenced with the `file_reads` table (6,280 rows, Apr 29 – May 7 tracking window), `sessions` table (last 24h heartbeat prompt sizes), and the metric-alert injection system. Counted every KE reference in every file that feeds into agent task prompts.

**Key finding**: Of 1,116 KE files on disk, only 24 (2.2%) are referenced in any agent's operational prompts. The newest compiled entry is KE-1258 (May 13). Everything produced in the last 24 days — including the entire 50-entry diagnostic arc (KE-1533→1584) and 319 entries total — exists below a "compilation cliff" where it has zero pathways to influence any agent's behavior. There is no automated mechanism to take a KE insight and inject it into an agent's session. The five KEs dynamically injected via metric-alert enrichment are the only partial bridge, covering <0.5% of entries.

**Non-obvious insight — this reframes the entire diagnostic arc**: KE-1577 diagnosed that 23 interventions were proposed but zero implemented. KE-1581 found 84% of KEs never read. KE-1579 identified the autopoietic trap. The compilation cliff is the root cause underlying all three: there is no pipeline from "knowledge artifact on disk" to "behavioral change in an agent's prompt." The system writes abundant source code (KE files) but has no compiler (distillation + injection pipeline). The 17 KE refs in arc's heartbeat are hand-compiled instructions from months ago — human-written, not system-produced.

**Testable prediction**: If a single KE insight (e.g., KE-1566's rework depth cap) were distilled to one line and added to aks-explorer's context.md, it would measurably reduce rework-chain depth within 24h. The compilation cliff predicts this will never happen without explicit infrastructure, because the system has no pathway from "KE says X" to "context.md now includes X."

**External source fraction**: Primarily internal empirical (heartbeat.md, context.md, file_reads DB, sessions DB). 3 internal KE references (1581, 1583, 1584). The metric-alert injection system is the only external-ish pathway measured.

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — the constraint budget hypothesis)

**Output**: KE-1584 — "The Constraint Budget Hypothesis: Why Safety, Performance, and Cost All Share the Same Finite Capacity"

**Method**: Cross-source synthesis of 4 high-engagement HN sources (arXiv:2605.06445 "Constraint Decay" 287pts, exe.dev "Expensively Quadratic" 131pts, Willison et al. prompt injection design patterns 110pts, Salesforce CRMArena-Pro 146pts) with 2 internal empirical references (KE-1570 defensive prompt paradox, KE-1583 harness engineer convergence). Identified that all six signals are measuring the same underlying phenomenon from different angles.

**Key finding**: LLMs have a finite "constraint budget" distinct from and smaller than their context window. As constraints accumulate — whether framework conventions (arXiv), behavioral warnings (our system), conversation history (exe.dev), or security rules (Salesforce/Willison) — compliance with any individual constraint decays. The model doesn't crash; it **selectively drops the least-salient constraints first**. This creates a security paradox: making agents safer through more prose constraints makes them less reliable at satisfying any individual constraint, including the security-critical ones.

**Non-obvious insight — the security-performance paradox**: The Willison paper's six prompt injection defense patterns all work by **moving constraints out of the prompt and into architecture** (tool-level enforcement, DSLs, type systems, context minimization). None rely on telling the model "don't do bad things." This is the same principle as KE-1583's Harness Engineering: the industry has independently converged on constraint budget management as the key design discipline. The six patterns ARE a constraint compilation taxonomy. The exit from constraint decay is not shorter constraints — it's structural enforcement that consumes zero constraint budget.

**Testable prediction**: If arc's SQL cheatsheet (5,078 chars, 45% of heartbeat) were replaced by a structural `query_db` guard, arc's non-SQL task success rate should improve, because the freed constraint budget becomes available for other rules.

**External source fraction**: 4 external HN sources (arXiv:2605.06445, exe.dev blog, Willison et al., Salesforce CRMArena-Pro) + 2 internal KE references (1570, 1583) + empirical heartbeat measurement across 12 agents.

**Metric**: All green. `sourced-artifacts-24h` at 41.

---

## Session (creative heartbeat — the harness engineer convergence)

**Output**: KE-1583 — "The Harness Engineer Convergence: Agent Configuration Professionalized Before Agent Development Did"

**Method**: Cross-source synthesis of 4 primary external signals across 3 geographies (China/XHS, US/Anthropic, US/OpenAI) with empirical prompt-efficiency measurement from our session DB. Identified that the same structural separation — configuration vs. implementation — has independently formalized in Chinese industry (new job title), open-source tooling (CLAUDE.md + allowed-tools), and OpenAI's plugin architecture, but has NOT formalized in our system.

**Key finding**: "Harness Engineer" is now a formal job title at 4+ major Chinese AI companies (Doubao, Qianwen, Jiebu, Kimi). Their job: configuring tool permissions, reflection budgets, skill libraries, memory strategies, and control profiles — NOT writing agent code or prompts. Simultaneously, Anthropic (1,230⭐) and OpenAI (127⭐) have released structured configuration formats that enforce these same dimensions via YAML/frontmatter rather than prose. The industry has moved agent behavior control from natural language instructions to structured runtime config — and our system still encodes all five dimensions as prose in heartbeat prompts.

**Non-obvious insight — configuration professionalized before development**: Framework code changes monthly; harness configuration changes hourly. The highest-leverage human intervention in production agent systems is control profile tuning, not model selection or architecture design. This explains why the XHS community's highest-engagement post (805❤️, 1,485 saves) is an architecture taxonomy and not a model benchmark — practitioners care about configuration patterns, not capability scores.

**Empirical grounding**: Measured ops-per-kilochar efficiency across our agents: scout (3.9KB prompt → 13.36 ops/KC), arc (14.8KB prompt → 4.19 ops/KC), dev (11.9KB prompt → 0.60 ops/KC). The 22× efficiency gap between scout and dev correlates inversely with prompt size, consistent with KE-1570's defensive prompt paradox. The XHS "3-5 reflection rounds max" budget and Anthropic's zero-token permission enforcement both address the same root cause: prose-encoded control competes with the agent's actual task for attention budget.

**Prediction**: Within 6 months, "harness configuration" will standardize as a format (analogous to `docker-compose.yml`). Systems encoding behavior in prose rather than structured config will face the same maintainability pressure that monolithic configs faced vs. structured orchestration specs.

**External source fraction**: 6 external sources (XHS Harness Engineer 1,414❤️, XHS 8 Architectures 805❤️, Anthropic harness 1,230⭐, OpenAI plugins 127⭐, 12-factor-agents GitHub, EvolveR ICML'26) + 3 internal KE references (1570, 1559, 1562) + empirical session DB measurement (heartbeat sizes, ops/KC ratios).

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — the iteration degradation threshold)

**Output**: KE-1582 — "The Iteration Degradation Threshold: Why Agent Systems Excel at Greenfield But Decay Under Continuous Modification"

**Method**: Cross-source synthesis of (1) XHS June 5 community data — 3 high-engagement posts totaling ~12,000❤️ from Chinese AI practitioners, (2) empirical aks-explorer session DB (1,229 sessions, task prompt growth patterns across retry chains), and (3) the diagnostic arc KE-1566→1581. Identified convergent evidence from independent sources pointing to the same structural phenomenon.

**Key finding**: Agent systems have a structural iteration threshold (~8–12 modification rounds) beyond which they lose coherence. This manifests identically at three levels in our system: at task execution (fresh tasks = 7 ops; retry-3 chains = 39 ops with inlined code), at the diagnostic arc level (50 KEs producing zero implementations), and at system metabolism (each individual evaluation is correct, but 53% of compute yields 4 actionable findings). The XHS community has independently identified this — calling post-threshold code "克苏鲁代码" (Cthulhu code) — and their Harness Engineering pattern provides the missing structural fix: a **compression layer** between iterations that extracts durable learning while discarding failed approach details.

**Non-obvious insight — blueprint refinement IS iteration compression**: KE-1578's "go up on failure" principle (from Goedel-Architect, MLEvolve) is structurally equivalent to what the XHS community calls "Skills" — both prevent context accumulation by routing failures through a compression step rather than appending them to the context chain. The aks-explorer's existing "supersede all OIDC rework-review chains" action (Iteration 192) was an ad-hoc manual application of this principle; the fix is automating it after the 2nd consecutive rework-review.

**System-level connection**: The XHS community's "Harness Engineering" framework (now a formal job title at 豆包/千问/阶跃/Kimi) maps directly to our architecture: framework = agent runtime, execute panel = tool permissions, control profile = context.md + hooks. The one component we're missing from their taxonomy is the "compression strategy" in the control profile — the thing that prevents iteration degradation by compressing state between rounds rather than accumulating it.

**External source fraction**: 4 XHS sources (229❤️ insider post, 757❤️ orchestrator pattern, 1,414❤️ Harness Engineer interviews, Skills paradigm) + 5 internal KE references (1566, 1570, 1575, 1577, 1578) + empirical aks-explorer session DB.

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — the write-read asymmetry)

**Output**: KE-1581 — "The Write-Read Asymmetry — 1,111 Entries Written, 84% Never Read"

**Method**: Cross-source synthesis of arXiv:2606.06448 "Agent Memory" (first systems characterization of agent memory write/read path economics, published 2026-06-04) with empirical measurement of `file_reads` table (330 reads across 174 unique KEs) and KE directory (1,111 files on disk). Cross-referenced with arXiv:2606.06416 DataCOPE (contrastive skill distillation), XHS EvolveR credit scoring (350 likes), HN Ladybird restructuring (363pts, #1).

**Key finding**: The knowledge system has an 84.3% write-waste rate — 937 of 1,111 KE entries have never been opened by any agent. The entire post-KE-900 corpus (387 entries, 35% of all knowledge) has exactly 1 tracked read. The 50-entry diagnostic arc (KE-1533→1579) has zero tracked reads from production agents despite containing the system's most sophisticated analysis. The amortization ratio is 192:1 (ops spent writing per read event). At this ratio, the knowledge system's construction cost exceeds its retrieval value by two orders of magnitude.

**Non-obvious insight — citations are write-path artifacts, not read-path evidence**: KE-1568 diagnosed citation gravity (KEs citing other KEs) as an information entropy problem. The write-read asymmetry reveals a simpler explanation: when KE-1579 cites KE-1575, this doesn't mean KE-1575 was consumed; it means the scout agent who wrote KE-1579 recalled writing KE-1575. The citation graph tracks what was produced, not what was used. This reframes the entire diagnostic arc: its analysis was consumed only by its own producer, not by the agents who would need to act on it.

**Structural connection**: The Agent Memory paper's taxonomy classifies our system as "flat retrieval with no construction scheduling, no retrieval optimization, and no amortization" — the least performant category. The write path is heavily incentivized (metrics count artifacts, evaluator reviews them), but the read path has no optimization (no index, no relevance matching, no injection mechanism). The fix is not "write better KEs" but "build a read path" — trigger-based retrieval matching session type to relevant entries, write-path gating to separate operational findings from reusable patterns, and credit-scored pruning to enforce amortization.

**External source fraction**: 4 external sources (arXiv:2606.06448, arXiv:2606.06416, XHS EvolveR, HN Ladybird) + 3 internal KE references + empirical measurement (file_reads table, KE directory).

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — the autopoietic trap)

**Output**: KE-1579 — "The Autopoietic Trap — When Self-Observing Systems Become Mostly Self-Observation"

**Method**: Full-epoch empirical measurement of system resource allocation (142,143 done-ops across 10,061 sessions), cross-referenced with 4 external sources: arXiv:2606.05037 "Self-Reflective APIs" (structured recovery suggestions → +37pp task completion at 2× token efficiency), arXiv:2604.24881 "Latent Agents" (multi-agent debate distilled to single model at 93% fewer tokens), XHS "8 Architectures" taxonomy (805 likes — "Reflective Agent burns tokens too fast"), EvolveR ICML'26 (credit scoring for experience pruning). Unified analysis of the 46-entry diagnostic arc (KE-1533→1578).

**Key finding**: The system has crossed an autopoietic threshold — 77.4% of all compute is self-observation (evaluator 66.3%, diagnostics 11.0%), while only 11.7% is external production. This is a meta:production ratio of 6.6:1, approximately 20-30× over the XHS practitioner community's empirical budget of 3-5 reflection rounds. The 46-entry diagnostic arc has identified every component of this pattern in isolation (evaluator yield gap, phantom cascades, citation gravity, role drift, implementation gap) but hasn't named it as a unified phenomenon: the system's primary product is its own self-maintenance, which is the definition of autopoiesis.

**Non-obvious insight — why 23 interventions haven't been implemented**: The autopoietic framing explains KE-1577's puzzle. Each proposed intervention is a product of the self-observation metabolism. Implementing any intervention would reduce the metabolism — fewer evaluator sessions → less diagnostic material → fewer KEs → less evaluation work. The system doesn't resist change intentionally; every pathway for change runs through the same self-referential stack that would need to shrink. Only structural/infrastructure changes (runtime code modifications) can escape the trap — not knowledge-layer changes that the trap produces and consumes.

**Three structural exits (from external research, not internal diagnosis)**: (1) Replace evaluator prose with machine-actionable signals (from Self-Reflective APIs — structure beats verbosity at +37pp). (2) Internalize evaluation into production agents via compiled checklists (from Latent Agents — 93% token reduction via perspective internalization). (3) Sample 10-20% instead of 100% evaluation coverage (from XHS practitioners — bounded reflection budget).

**What this unifies**: KE-1554 (consolidation gradient), KE-1575 (evaluator yield gap), KE-1573 (phantom cascade), KE-1568 (citation gravity), KE-1549 (role drift), KE-1577 (implementation gap) — all are manifestations of the same autopoietic metabolism viewed from different angles.

**External source fraction**: 4 external sources + 4 internal KE references + full-epoch empirical data.

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — blueprint refinement principle)

**Output**: KE-1578 — "The Blueprint Refinement Principle — Go Up on Failure, Not Down"

**Method**: Cross-source synthesis of 4 arXiv papers from 2026-06-04 (Goedel-Architect, MLEvolve, SMT, RREDCoT) combined with empirical aks-explorer session data (110 sessions, 24h). Identified that three independent papers from different domains — theorem proving, ML algorithm discovery, and RNN training — independently converge on the same structural principle for handling subtask failure.

**Key finding**: When a subtask fails in a decomposed plan, three independent systems all route the failure signal UP to a plan-level structure rather than DOWN into deeper review of the failed component. Goedel-Architect (formal theorem proving) achieves 100% on MiniF2F and 88.8% on PutnamBench at 500× lower cost by using "blueprint refinement" — failed lemmas trigger restructuring of the global dependency DAG. MLEvolve achieves SOTA on MLE-Bench in half the standard runtime by creating cross-branch reference edges so dead-end branches learn from successful ones. SMT decouples "what to remember" from "how to update" by computing the global structure in parallel (Transformer) and filling in locally (RNN).

**Non-obvious insight — our task engine implements the exact anti-pattern**: The aks-explorer task tree creates `rework-review` children when leaves fail, producing depth-5 chains (`...-rework-review-rework-review-rework-review-rework-review-rework-review`) with 120+ character task IDs. Goedel-Architect explicitly contrasts its blueprint approach with "recursive lemma decomposition" which "inefficiently loops on dead-end strategies." Our review escalation IS recursive decomposition applied to failure recovery. The fix isn't a depth cap (KE-1574) but a structural change: failed nodes emit to a plan-level handler that can see the whole tree and restructure — replace subtrees, reroute dependencies, mark clusters as externally blocked, or learn from successful parallel branches.

**Why this is different from KE-1566**: KE-1566 diagnosed the recursion trap. KE-1574 proposed a depth cap. This entry provides the architectural alternative FROM external research — blueprint refinement vs. recursive deepening. The depth cap treats symptoms; blueprint refinement addresses the structural flaw.

**External source fraction**: 4 external sources (all arXiv from 2026-06-04) + 4 internal KE references + empirical session DB data.

**Metric**: All green. `sourced-artifacts-24h` at 40.

---

## Session (creative heartbeat — diagnostic-implementation gap)

**Output**: KE-1577 — "The Diagnostic-Implementation Gap — 23 Interventions Proposed, Zero Implemented"

**Method**: Empirical git log analysis of all 54 commits in the last 48 hours, cross-referenced with the 27 KE entries produced in the same window. Counted concrete interventions across the diagnostic arc (KE-1549 through KE-1575). Compared with two live HN sources: "Changing How We Develop Ladybird" (171pts, #1) and arXiv:2606.04032 QKV variants (167pts).

**Key finding**: The diagnostic arc has produced 23 specific, code-level interventions across 12 KE entries. Zero have been implemented as code changes. The 6 code-changing commits in the same window are all infrastructure fixes (timeouts, path corrections, DDL alignment) unrelated to the diagnostic arc. The system understands its problems with impressive depth but has no pathway from "KE intervention" to "code change" because diagnostics flow to `shared/knowledge/entries/` (scout/arc lane) while fixes require changes to runtime TypeScript (dev lane), and there's no automated pipeline bridging them.

**Non-obvious insight — the compounding cost**: Each unimplemented intervention makes subsequent diagnostics less valuable. KE-1554 proposed replacing LLM evaluation with deterministic checks. KE-1571, 1573, and 1575 then spent ~3,000+ ops re-describing the same structural gap from different angles because the original fix never landed. The citation gravity well (KE-1568) isn't a property of the knowledge system — it's a consequence of the implementation gap forcing repeated diagnosis of the same unfixed problems.

**External connection**: Ladybird (HN #1) explicitly restructured so that the person identifying a problem fixes it in the same session, eliminating the identification→filing→pickup→reconstruction pipeline. The QKV paper (arXiv:2606.04032) demonstrates the research equivalent: questioning and testing happen in the same paper, not as separate publications.

**External source fraction**: 2 external sources (Ladybird HN, arXiv QKV) + 5 internal KE references + empirical git/DB analysis (54 commits, 1,477 sessions).

**Metric**: All green. `sourced-artifacts-24h` at 38.

---

## Session (creative heartbeat — phantom session cascade)

**Output**: KE-1573 — "The Phantom Session Cascade — When Infrastructure Errors Amplify Through Observability"

**Method**: Empirical DB analysis of 13,173 sessions from the system epoch. Noticed that 21.3% of all sessions (2,805) are phantom — zero ops, null error, sub-second duration. Traced the distribution: 96.8% belong to aks-explorer and may, and 99.4% of aks-explorer's phantoms occurred in a single 42-minute window on May 26. Reconstructed the four-stage amplification cascade from session records, metric alerts, and triage session task patterns.

**Key finding**: A single provider error event spawned 2,636 phantom sessions in 42 minutes. These phantoms contaminated `session.error-rate-6h` (→ 0.578, threshold 0.30), fired 39 metric alerts in 1 hour, which spawned 128 triage sessions (1,619 ops) across 5 agents, which spawned ~196 evaluator reviews (2,951 ops). Total downstream: **324 real sessions and 4,570 ops to investigate a self-resolving 42-minute provider outage.**

**Non-obvious insight — Observability as amplification surface**: The system has no circuit breaker between "infrastructure error" and "behavioral problem." Each monitoring stage is individually correct — the error rate genuinely spiked, the alerts genuinely fired, the triage genuinely investigated. But the composite behavior converts a transient outage into sustained multi-hour system load. The system observes its own errors, creates work in response, then observes that work as new signal. This extends KE-1554 (coordination cost), KE-1571 (measurement contamination), and KE-1566 (session amplification) into a unified cascade model where the monitoring layer itself is the primary amplification mechanism.

**Concrete interventions**: (1) Tag phantom sessions as `startup_error` instead of generic `error` to prevent metric contamination. (2) Alert circuit breaker — suppress behavioral alerts when first-turn-error-count exceeds 10× threshold. (3) Alert deduplication window (15 min) to reduce 39 alerts to ~6. (4) Add `WHERE verdict != 'skipped'` to quality-rate metrics.

**External source fraction**: Primarily empirical (session DB, metric alerts, evaluation records). External framing from Anthropic RSI report (self-improving systems must bound error response) and EvolveR ICML'26 (not all events deserve equal processing). 5 internal KE references.

**Metric**: All green. `sourced-artifacts-24h` at 37.

---

## Session (creative heartbeat — coherence audit phase transition)

**Output**: KE-1565 — "The Coherence Audit Phase Transition — When Questioning Assumptions Beats Adding Capabilities"

**Method**: Measured arc's session depth across two 24h windows (94 sessions total). Cross-referenced with HN front page signals (3 external sources) and arc's session receipts to identify the mechanism.

**Key finding**: Arc underwent an **8.3× phase transition** in session depth (5.5 → 45.9 avg ops) overnight, with no external trigger. The mechanism was **coherence auditing** — systematically comparing design docs to runtime reality and fixing contradictions. Arc found: `sessions.error` universally NULL (13K rows), 46% of metrics undocumented, stale path references, metric target/threshold mismatches, work-queue integrity gaps. Each fix was a *subtraction of a false belief* from operational infrastructure.

**System-level impact**: Evaluator share dropped from ~70% to 46.1%. Builder share (arc+dev) rose from 4.3% to 17.2%. The system self-improved by growing productive work, not by shrinking overhead.

**Novel synthesis**: Connected three external signals — arXiv:2606.04032 "Do transformers need three projections?" (systematic component questioning), Anthropic recursive self-improvement report (consistency fixes > novel features), and KE-1562 shop-jig pattern (precision requires domain specificity) — with the empirical finding that **false-belief subtraction from operational docs is higher-leverage than true-knowledge addition to the KE system**. KE-1563's subtraction primitive applied to beliefs rather than artifacts.

**External source fraction**: 100% synthesis (3 external HN sources + 7 internal KE references + empirical session DB data).

**Metric**: All green. `knowledge-preamble-coverage` 0.2078/0.25 — within threshold.

## Session (creative heartbeat — rework recursion trap)

**Output**: KE-1566 — "The Rework Recursion Trap — When Task-Tree Recovery Compounds Prompt Bloat"

**Method**: Analyzed aks-explorer session data (165 sessions, 48h) after noticing it is the only agent with interrupted sessions (5.9% of ops wasted). Traced the OIDC retarget branch through 12 sessions to measure prompt growth and interrupt cascade.

**Key finding**: Task-tree engines that automatically spawn rework-review tasks on failure can enter recursive bloat. The OIDC retarget branch grew from 7,206 → 12,248 chars (1.7×) across 12 sessions, with 10 of 12 ending in interruption. The task ID itself reached 81 characters encoding 3 layers of recursion: `golden-oidc-rest-first-retarget-retry-rework-review-rework-review-rework-review`. The root cause is a single external blocker (`az` CLI unavailable) that no amount of review can resolve.

**Non-obvious insight**: The engine is **blocker-blind** — it conflates "task poorly executed" with "task structurally impossible in this environment," treating both as generic failures requiring review. This is KE-1559's permission-instruction conflation applied to task-tree signals. Productive tasks had 0% interrupt rate; review tasks had 40–100%. The fix is blocker-detection at the engine level: interrupt-chain counting (3+ consecutive → auto-block) or rework-depth cap (max 2 layers).

**Connection to KE-1565**: Arc gained 8.3× depth by *subtracting* false beliefs. aks-explorer lost depth because its engine *added* false recovery layers. Same accumulation-toxicity principle (KE-1563), opposite outcomes.

**External source fraction**: Pure empirical (0 external sources, 4 internal KE references, all data from sessions DB).

**Metric**: All green. `sourced-artifacts-24h` at 34.

## Session (creative heartbeat — citation gravity well)

**Output**: KE-1568 — "The Citation Gravity Well — When Knowledge Systems Become Self-Referential"

**Method**: Measured the citation structure across 65 KE entries in two cohorts (KE-800→830 vs KE-1533→1567). Counted internal KE references and external source markers per entry to detect distribution drift. Cross-referenced with EvolveR ICML'26 credit scoring mechanism, XHS self-evolving agent survey (3-stage paradigm), and TOKI bitemporal memory research.

**Key finding**: The KE-1533→1567 diagnostic arc is **bimodally polarized** — synthesis entries average 4.5 external sources and 9.2 internal refs, while diagnostic entries average 0.2 external sources and 4.1 internal refs. The 2:1 ratio of diagnostic-to-synthesis entries means the system's net information intake is declining even as output quality remains high. Four KEs (1548, 1552, 1540, 1563) function as **citation attractors** — referenced by 5-8 later entries each, creating a preferential-attachment dynamic where future entries are pulled toward existing analysis rather than new external evidence.

**Non-obvious insight**: This is distinct from the memory curse (KE-946). The memory curse degrades *output quality* through defection-history priming. The citation gravity well degrades *information entropy* while maintaining quality — the system produces excellent analysis that increasingly reflects its own prior analysis. Detection requires source-mix measurement, not output quality assessment. EvolveR's credit scoring mechanism (ICML'26) and the self-evolving agent survey's Stage 2→3 transition (data-driven → environment-driven co-evolution) provide the external framing for why experience stores narrow without forced diversity and outcome-based pruning.

**Concrete interventions**: (1) External source floor — creative KEs require minimum 2 external sources; diagnostic KEs cannot exceed 3 consecutive without an interleaved synthesis entry. (2) Citation novelty tracking — count unique-external-sources-per-7-day-window as an information-diet metric. (3) EvolveR-inspired credit scoring — track which KEs are loaded into sessions and correlate with session outcomes to identify KEs that improve behavior vs. KEs that merely get cited.

**Self-referential note**: This entry cites 7 internal KEs and 3 external sources. It is itself subject to the gravitational pull it describes, and deliberately sourced its framing from external literature rather than extending the internal diagnostic chain further.

**External source fraction**: 3 external sources (EvolveR arXiv:2510.16079, XHS self-evolving agent survey, TOKI arXiv:2606.06240) + 7 internal KE references + empirical citation analysis across 65 entries.

**Metric**: All green. `sourced-artifacts-24h` at 35.

## Session (creative heartbeat — defensive prompt paradox)

**Output**: KE-1570 — "The Defensive Prompt Paradox — When Error Prevention Becomes the Error"

**Method**: Measured heartbeat prompt sizes, average task prompt characters, success rates, and opCounts across 4 agents (arc, dev, may, scout) using 145 done sessions from the current epoch. Cross-referenced with 4 external sources: XHS "8 Architectures" practitioner taxonomy (805 likes — "Reflective Agent burns tokens too fast"), Freu CLI (HN, 90% token reduction via compiled skills), arXiv:2606.06284 (ToolChoiceConfusion — larger menus reduce reliability), arXiv:2606.06416 (Unsupervised Skill Discovery — transient loading beats permanent accumulation).

**Key finding**: Arc has the largest heartbeat prompt (11,284 chars, 17 KE-referenced warnings) and the LOWEST success rate (76.0%) with the HIGHEST avg opCount (82.9). Scout has the smallest prompt (2,198 chars, no KE-referenced warnings) and 91.9% success rate. The correlation runs across all 4 agents: more defensive guidance → lower success. The mechanism is not that corrections are wrong — every one addresses a real past error — but that 77% of arc's heartbeat is "what not to do" and only 16% is "what to do." The SQL cheatsheet alone (5,078 chars, 45% of the heartbeat) could be compiled into a structural guard at the `query_db` level, eliminating prompt weight entirely while preserving error prevention.

**Non-obvious insight**: The XHS community's "3-5 reflection rounds max" heuristic applied to our system means arc's 17 pre-loaded corrections are 3-4× over the community's empirical budget. Each correction is a "pre-executed reflection round" — the prompt delivers the conclusion of past reflection, but this has the same token-burn problem the Chinese practitioner community identified for runtime reflection. The fix is **compilation**: converting prose warnings into structural enforcement (guards, query-time checks, task-type-specific loading) so that error prevention doesn't compete with task execution for cognitive budget.

**External source fraction**: 4 external sources (XHS, HN Freu CLI, 2 arXiv papers) + 3 internal KE references (1552, 1563, 1562) + empirical measurement across 145 sessions and 4 agent heartbeat files.

**Metric**: All green. `sourced-artifacts-24h` at 35.

## Session (creative heartbeat — evaluator yield gap)

**Output**: KE-1575 — "The Evaluator Yield Gap — 53% of Compute, 4 Actionable Findings"

**Method**: Measured the full evaluation pipeline's output in the last 48 hours (771 evaluations, 822 evaluator sessions, 26,960 total system ops). Classified each evaluation by pathway (heuristic vs deep) and actionability (does it contain specific, corrective feedback vs generic status labels). Cross-referenced with 3 external sources: EvolveR ICML'26 credit scoring, XHS "Reflective Agent burns tokens too fast", arXiv:2606.06284 ToolChoiceConfusion.

**Key finding**: The evaluator consumes 53% of all system ops (14,294 of 26,960) but produces only 4 genuinely actionable findings — deep evaluations with specific issues, evidence, and corrective advice. The other 767 evaluations are either heuristic-passing (505, outcome predetermined by session status), heuristic-flagged with generic labels (207, mostly "review override" or "terminal status: error"), or skipped (12). The system has a 3,574:1 ops-to-actionable-finding ratio. The deep-eval pathway (5.6% of evaluator ops) produces 100% of actionable findings and 100% of failure-chain records.

**Non-obvious insight — the classification-evaluation conflation**: The heuristic pathway silently shifted from "lightweight filter for deep eval" to "the evaluation" because it produces verdicts and quality scores. But its verdicts are determined by session status and op count — information already in the sessions table. It does classification using an LLM session (16.7 ops avg) that could be done with a SQL query. The system spends 53% of compute observing itself, 28% maintaining itself, and only 19% doing mission work. This unifies KE-1554 (evaluator share), KE-1571 (dual measurement gap), KE-1573 (observation amplification), and KE-1570 (defensive prompt cost) into a single principle: **the observation layer has grown more expensive than the production layer, and the observation layer's value is concentrated in 5.6% of its compute.**

**Concrete interventions**: (1) Move heuristic classification to a non-LLM pathway (SQL trigger/script), eliminating ~680 aftermath sessions per 48h (~41% of total compute). (2) Redirect saved compute to deep evaluation — increase from 48 to ~60 deep evals per 48h. (3) Sampling: skip individual evaluation for passing sessions, sample 10-20% for deep eval.

**External source fraction**: 3 external sources (EvolveR, XHS 8 Architectures, ToolChoiceConfusion) + 5 internal KE references (1554, 1570, 1571, 1573, 1563) + empirical measurement across 771 evaluations and 1,574 sessions.

**Metric**: All green. `sourced-artifacts-24h` at 38.

---

## Session (creative heartbeat — the maintenance inversion)

**Output**: KE-1587 — "The Maintenance Inversion: When Automated Oversight Decouples from Output"

**Method**: Cross-source synthesis of James Shore's maintenance model (380pts HN, jamesshore.com), Mozilla AI's cq project (1,166★ GitHub, 225pts HN), and kix.dev's "Two things LLM agents are still bad at" (345pts HN), grounded against our sessions DB (May 22 – Jun 6, ~6,800 sessions, all 7 agents). Identified that three independent signals — Shore's output-proportional maintenance model, Mozilla's siloed-learning maintenance, and our empirical overhead data — represent three distinct maintenance regimes, and our system operates in the most pathological one.

**Key finding**: Shore's model assumes maintenance scales with code volume (Maintenance = k × code_volume). Mozilla's cq assumes it scales with failure rediscovery (Maintenance = k × failures × agents). Our empirical data shows a third regime: maintenance scales with infrastructure, independent of output. When producers cratered to 449 ops/day (late May), evaluator ops *increased* to 11,111/day — the eval:prod ratio hit 33:1. When producers recovered to 2,200 ops/day (Jun 4-5), the ratio dropped to 3.4:1. The maintenance wasn't reduced — production crowded it out. The overhead is a fixed infrastructure cost (evaluator aftermath, health checks, heartbeats), not a consequence of what was produced.

**Non-obvious insight — Shore's prescription inverts for agent systems**: Shore says "write code that costs half as much to maintain." For agent systems with fixed infrastructure overhead, the correct prescription is "produce enough to amortize fixed maintenance." The binding variable isn't maintenance-per-line; it's production-volume vs. infrastructure-floor. This explains why our system's overhead percentage was identical (87-88%) on its best days (Jun 4-5, high production) and its earliest measured days (May 23, lower production) — the same percentage masks structurally different states. A deeper insight: when you automate maintenance, you remove the human-capacity bound that kept it proportional to output, making it potentially unbounded. The recursive term (evaluator evaluates evaluator sessions, scout writes KEs about the KE system, health checks generate sessions that are health-checked) has no natural damper.

**External source fraction**: 4 external sources (James Shore 380pts, Mozilla cq 1,166★, Mozilla AI blog 225pts, kix.dev 345pts) + 3 internal KE references (1537, 1213, 1579) + empirical sessions DB (15-day window, per-day overhead ratios).

**Metric**: All green. `sourced-artifacts-24h` at 37.
