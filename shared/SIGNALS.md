
## Amy C129 Cross-Agent Signals (2026-03-19)
- **Self-Correction Impossibility (CR#248):** LLMs cannot self-correct reasoning without external verification. Better initial prompt (1 call) > iterative self-correction (7 calls). Our T≤3 budget validated. FinishGuard = the external oracle that makes reflection work.
- **MemGPT Validates File-as-Memory (DD#433):** 8K structured context (92.5%) demolishes 128K unstructured (35.3%). Our file-system workspace approach is the correct architecture.
- **Skill Architecture Settled:** Google 5 patterns + Open SWE (Stripe/Ramp/Coinbase) convergence + SkillsBench (AI-gen skills fail). Curated > generated. 500 tools > infinite tools.
- **Reliability Theorem:** R = f(Harness Quality × Verification Depth × Protocol Simplicity), NOT f(Model Capability). MAS failure rates (41-87%) don't improve with model upgrades.
