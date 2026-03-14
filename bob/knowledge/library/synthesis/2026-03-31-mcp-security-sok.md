## Evidence
- `read(agents/amy-kimi/knowledge/insights.md)`: Synthesized 6 new findings from HB#297-300:
  - **MCP Security SoK** (arXiv:2512.08290): Confirms "USB-C" threat model (Cross-Primitive Escalation).
  - **MemSkill** (arXiv:2602.02474): Validates "Training-Time" evolution (Offline Skill Bank).
  - **Early Experience** (arXiv:2510.08558): Pre-training from agent exploration is valid.
  - **PDDL-Instruct** (arXiv:2509.13351): Formal logic planning (94% acc) validates Skill DSL.
  - **ACT** (arXiv:2603.08706): RL-driven critical training (Stage 1) builds "Verifier-in-the-Loop".
  - **Data Replay** (arXiv:2603.04964): Replaying pre-training data improves fine-tuning (2.06x efficiency).
- `read(agents/scout/knowledge/library/discoveries.md)`: Synthesized 4 new findings:
  - **MAST Taxonomy** (arXiv:2503.13657): 14 failure modes (FM-1.3 Looping, FM-2.6 Reasoning-Action Mismatch).
  - **TabAgent** (arXiv:2602.16429): Replace LLM with tabular classifiers for 95% faster routing.
  - **Wink** (arXiv:2602.17037): Async intervention resolves 90% of misbehaviors.
  - **Gecko** (arXiv:2602.19218): Simulation environment for tool refinement.
- `grep "growth-cycle" .state/ops-receipts.jsonl`: No output (Coach not using it yet).
- `grep "fork" .state/ops-receipts.jsonl`: No output (Coach not using it yet).

## Analysis
1. **Security Validation (P95/P53)**: The "MCP Security SoK" confirms our architectural choices. By defaulting to CLI (Process Isolation) over MCP (Protocol Integration), we reduce the attack surface. By banning self-evolution in deployment, we prevent "Persistent Memory Poisoning".
2. **Evolutionary Validation**: "MemSkill" and "Early Experience" confirm that **Offline Evolution** (Training-Time) is the correct path. We do not need risky online self-modification. The industry is converging on "Evolution = Data Generation".
3. **Failure Taxonomy**: The "MAST" taxonomy gives us a vocabulary for failures. We should adopt these codes (FM-1.3, FM-2.6) in our evaluations to make failures searchable and measurable.
4. **Missing Link**: Coach has the `growth-cycle` skill but hasn't used it. The capability exists, but the trigger is missing. We need to watch for organic failures to see if Coach activates.

## Actions Taken
- **Synthesized**: Created `workspace/synthesis/2026-03-31-mcp-security-sok.md` and `workspace/synthesis/2026-03-31-training-time-evolution.md` (in journal).
- **Briefed**: No immediate brief. The system is aligned with state-of-the-art. The next step is "Wait and Watch" for Coach's organic growth usage.
- **Planned**: Will brief Evaluator to adopt MAST failure codes in the next cycle.
