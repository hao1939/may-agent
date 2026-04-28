# DD903: DataPRM — Environment-Aware Process Reward for Agent Verification

**Paper**: Qiu et al., "Rewarding the Scientific Process: Process-Level Reward Modeling for Agentic Data Analysis" (arXiv:2604.24198, Apr 2026)
**Created**: 2026-12-24
**Relevance**: HIGH — Direct connection to our sequential auditor (EXP-242) and evaluator architecture

## Key Findings

1. **General PRMs fail on agentic tasks** — They can't detect "silent errors" (logically wrong but no exception) and penalize necessary exploration. This mirrors our evaluator's false-negative problem.

2. **Active verification beats passive** — DataPRM autonomously interacts with the execution environment to probe intermediate states. Not just reading outputs — executing checks. This is the same insight behind Bob's sequential auditor.

3. **Ternary reward: correct/correctable/irrecoverable** — Distinguishes between mistakes that lead to self-correction (good exploration) vs terminal failures. Our binary pass/fail eval misses this.

4. **4B parameter model outperforms larger baselines** — Small, specialized verifiers beat general large ones. Suggests our auditor doesn't need to be expensive.

5. **Process reward + RL >> outcome reward** — 78.73% on DABench vs outcome-only baseline. Validates rewarding intermediate steps, not just final answer.

## Connections to Our System

### EXP-242 Sequential Auditor
Bob's auditor checks intermediate steps in pipelines. DataPRM formalizes exactly this: step-level verification with environment interaction. Key difference: DataPRM trains a dedicated model; we use the same LLM with different prompting. Their ternary reward (correct/correctable/irrecoverable) could improve our auditor's signal.

### Evaluator False Negatives (H-EXP-022)
Our evaluator misses certain failure modes — "silent errors" in DataPRM's terms. Their approach of actively executing verification probes rather than passively inspecting output is directly applicable.

### MALT Connection (DD from last heartbeat)
MALT's generate→verify→refine pipeline + DataPRM's active verification = a concrete architecture for step-level auditing with environment grounding.

## Actionable Ideas

1. **Add ternary signal to auditor**: Instead of pass/fail, distinguish "wrong but agent self-corrected" from "wrong and propagated". This reduces false-positive audit triggers.
2. **Active verification probes**: Have the auditor execute small test cases against intermediate outputs, not just inspect them.
3. **Specialized small verifier**: If we ever move beyond prompt-based auditing, a fine-tuned small model for verification could be cheaper and better.

## Limitations
- No empirical eval in multi-agent settings (single agent + verifier only)
- Training data pipeline is non-trivial (diversity-driven trajectory generation)
- Ternary annotation requires domain expertise to distinguish correctable vs irrecoverable
