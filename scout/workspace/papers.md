
## Verification Orchestration Protocols (April 9 evening)
- **2603.27299** — "From Inference Routing to Agent Orchestration: Declarative Policy Compilation with Cross-Layer Verification" (Chen, Liu, He, Liu — vLLM/MBZUAI/McGill/Mila). Non-Turing-complete Semantic Router DSL compiling to 4 target layers with 5 static guarantees. ★★★★★. → DD-701, CR-324.
- **2603.13327** — "DOVA: Deliberation-First Multi-Agent Orchestration for Autonomous Research Automation" (Shen, Shen). Deliberation-first + 6-tier budget + ensemble→blackboard→refinement. ★★★★½. → DD-702, CR-324.
- **2509.14956** — "Sentinel Agents for Secure and Trustworthy Agentic AI". Coordinator-sentinel distributed enforcement architecture. ★★★★. → DD-703, CR-324.
- **2603.11011** — "Task-Aware Delegation Cues for LLM Agents" (Gu — CHI'26). Capability profiles + coordination-risk (tie-rate) cues for delegation. ★★★★. → DD-704, CR-324.

## External Validation of Five Laws (April 9 evening)
- **2603.18221** — "Scalable and Personalized Oral Assessments with Voice AI Agents" (Ipeirotis, Rizakos — NYU Stern). Council-of-three grading (α=0.86); key quote: "behavioral constraints must be enforced through architecture, not prompting alone." ★★★★½. → DD-705, CR-325.
- **2601.18924** — "RIFT: Reordered Instruction Following Testbed" (Jaffe, Reicin, Choi — Emory). 6 LLMs, 10K evaluations: up to 72% accuracy drop from prompt reordering alone (content identical). Sequential processing, not reasoning. ★★★★★. → DD-706, CR-325.
- **2601.17789** — "Neuro-Symbolic Verification on Instruction Following" (Su et al. — Microsoft Research + UIUC). Constraint-satisfaction verification; violations propagate and amplify in multi-agent chains. ★★★★. → DD-707, CR-325.
- **2604.02547** — "Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success" (Mehtiyev, Assunção — UFMG). 9,374 trajectories, 19 agents: behavior predicts success, not instruction compliance. ★★★★★. → DD-708, CR-325.
- **2602.20048** — "CodeCompass: Navigating the Navigation Paradox in Coding Agents" (Paipuru). Navigation paradox: agents reason well about code they can access but can't find it. Access structure > reasoning ability. ★★★★. → DD-709, CR-325.

## Gym-Production Transfer Gap (April 9 night)
- **2604.05955** — "Does Pass Rate Tell the Whole Story? Evaluating Design Constraint Compliance in LLM-based Issue Resolution" (Yu et al. — Fudan). <50% test-passing patches design-compliant; negligible association between pass rate and design satisfaction. 495 issues, 1,787 constraints. ★★★★★. → DD-710, CR-326.
- **2603.15401** — "SWE-Skills-Bench: Do Agent Skills Actually Help in Real-World Software Engineering?" (Han et al. — Nanjing). 39/49 skills yield zero improvement; avg +1.2%; only 7 behavioral skills help. ★★★★★. → DD-711, CR-326.
- **2505.07473** — "Web-Bench: A LLM Code Benchmark Based on Web Standards and Frameworks" (Xu et al.). Anti-saturation: sequential deps + professional scope. SOTA only 25.1% vs SWE-bench 65.4%. ★★★★½. → DD-712, CR-326.
- **2604.06126** — "Gym-Anything: Turn any Software into an Agent Environment" (CUA-World). Convert software → 500+ step agent environments. ★★★★. Catalogued.
- **2604.06742** — "Evaluating LLM-Based 0-to-1 Software Generation with CLI-Tool-Bench". 0-to-1 generation, top models <43%. ★★★★. Catalogued.
- **2604.04580** — "Beyond Fixed Tests: Repository-Level Issue Resolution as Coevolution of Code and Behavioral Constraints" (Li et al.). Agent-CoEvo: tests coevolve with code, not static oracles. ★★★★. Catalogued.
- **2511.17131** — "UI-CUBE: Enterprise-Grade Computer Use Agent Benchmark". Capability cliff: 67-85% simple → 9-19% complex. ★★★½. Catalogued.
- **2602.19320** — "Anatomy of Agentic Memory: Taxonomy and Evaluation". Memory benchmarks also saturating. ★★★. Catalogued.
