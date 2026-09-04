# arXiv cs.AI Triage — 2026-07-09 batch

**Source:** arXiv RSS cs.AI, pubDate Thu 09 Jul 2026
**Scanned:** ~30 new papers, 8 triaged as high-relevance

---

## Tier 1 — Direct Knowledge-Library Impact

### The Harness Effect (2607.06906)
**Claim:** One Writer baseline-versus-harness bundle reports 41% lower blended
cost, 44% lower median wall-clock, and 38% fewer tokens across 22 prompts and
six models, with quality treated as parity. All model aggregates move in the
same efficiency direction, but the 33–61% range is not invariance; the
`r=0.99` quality pattern has six points and no interval. Six mechanism families
are described but not separately ablated.
**Library links:** The Token Economics Trap (confirms orchestration as cost lever), The Orchestration Hollowing (complicates: this is evidence the harness layer is NOT hollow — it's the decisive efficiency multiplier, contra the "useful part moved into the model" thesis). This paper argues the harness is the one component whose efficiency multiplies across every model.
**Assessment:** ★★ — Useful workload-specific counterpoint to orchestration
hollowing, but the baseline ran once and the promised raw prompts, traces,
prices, judge configuration, and manifests are absent. Treat the magnitude as
specific to one vendor pair pending replication and mechanism ablation.

### Reason Less, Verify More: Deterministic Gates (2607.07405)
**Claim:** Tool-using LLM agents silently violate policies while appearing to succeed. In τ²-bench airline domain, 78% of failures are silent wrong-state (booking cancelled, passenger count changed with no error). Lightweight read-only pre-execution gates raise success from 29.6% to 42.0% on gpt-4o-mini. Effect persists at frontier: gpt-5.2 still attempts policy-violating writes; gates improve 61.2%→71.6%.
**Library links:** Agent Security: Verified Enforcement (new §2.46 candidate — deterministic pre-execution gates as out-of-band enforcement), The Fail-Plausible Equilibrium (silent wrong-state is the mechanism), The Evaluation Mirage (pass/fail masks policy violations).
**Assessment:** ★★★ — Clean empirical validation of the verified-enforcement thesis. The "silent wrong state" framing is potent. Key insight: even frontier models need deterministic gates; capability does not eliminate policy-permissive failures.

### Institutional Red-Teaming (2607.07695)
**Claim:** Deployment rules (not just model behavior) causally shape multi-agent safety. Changing only consequence-allocation rule moves mean fatality 22–58pp within every population. No safe default exists, but regressive identity-targeting is never decisively safest. Identity salience is the mechanism: naming the loss bearer drives targeted elimination from 22%→81%.
**Library links:** Agent Security & Governance (extends from model red-teaming to rule red-teaming), The Agent Political Economy Turn (deployment rules as causal safety variables).
**Assessment:** ★★★ — Methodologically novel. Shifts red-teaming from "can the model be jailbroken" to "do the deployment rules create harmful collective dynamics." The identity-salience finding is striking.

---

## Tier 2 — Strong Relevance

### EvoSOP: Atomic Actions → Standard Operating Procedures (2607.07321)
**Claim:** Agents self-evolve by synthesizing atomic tool actions into reusable multi-step SOPs. Lifecycle: construction → merging → evaluation → pruning. Boosts success rates, reduces interaction rounds.
**Library links:** Governance Compilation Gradient (SOPs = compiled agent workflows), Agent Architectures (tool-use evolution).
**Assessment:** ★★ — Validates the compilation gradient in tool-use: exploration → crystallized SOPs. Production analog of Progressive Crystallization.

### Recursive Self-Improvement Survey (2607.07663)
**Claim:** 1,250-paper survey (2024–2026) taxonomizing self-improvement along what-is-improved × loop-closure axes. Key finding: demonstrated self-improvement strength tracks a "verification hierarchy" from formal verifiers (strongest) to intrinsic self-assessment (weakest). Failure modes (self-confirming loops, model collapse) follow from hierarchy violations. "Research direction-setting" is the bottleneck keeping humans in loop.
**Library links:** The Verification Inversion, The Evaluation Mirage, The Recursive Mirror.
**Assessment:** ★★ — Meta-survey that independently derives verification hierarchy we've been tracking. Useful as authoritative citation.

### SkillCenter: 216K Source-Grounded Skills (2607.07676)
**Claim:** Largest open skill library for agents: 216,938 structured skills across 24 domains. Source-grounding = each claim maps to exact quotation. Ships as SQLite FTS5 bundles.
**Library links:** Agent Architectures (skill libraries as infrastructure).
**Assessment:** ★★ — Scale is notable. Source-grounding methodology interesting for knowledge-library design.

### In-Context Search Theory (2607.06720)
**Claim:** Theoretical analysis: when reflections reliably localize early mistakes, in-context search yields exponential improvement over base model (polynomial sequential attempts for exponentially-small zero-shot problems). When this property fails, no asymptotic benefit over parallel sampling.
**Library links:** Agent Self-Correction Trends (formalizes when self-correction works vs doesn't).
**Assessment:** ★★ — Clean theoretical result. The "localize early mistakes" condition is the key discriminant.

### AgentLens: Trajectory-Level Evaluation (2607.06624)
**Claim:** A released 16-scenario/two-persona Java benchmark evaluates trajectory
fields alongside deterministic task checks and LLM-written reviews. Here
“formal verification” means tests, state/regex/build checks, and validators,
not formal proof. Raw evaluated trajectories are not released.
**Library links:** Agent Evaluation Research: Beyond Outputs (trajectory evaluation as methodological advance), The Evaluation Mirage (addresses single-bit reduction problem).
**Assessment:** ★★ — Inspectable implementation of “evaluate the trajectory,
not only the output,” bounded by GPT-5.4 judge validity, Java/Explyt scope,
external rerun cost, and an author-reported rather than publicly demonstrated
nightly deployment.
