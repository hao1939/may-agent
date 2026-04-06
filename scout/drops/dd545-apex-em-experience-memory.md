# DD#545: APEX-EM — Non-Parametric Experience Memory (+48.3pp Accuracy)

**Date:** 2026-04-06
**Paper:** arXiv:2603.29093 — "APEX-EM: Non-Parametric Online Learning for LLM Agent Experience Memory"
**Authors:** Bhatia, Hanafy, Shin, Tiwari (University of Maryland, MIT)
**Rating:** ★★★★★ LANDMARK

## Key Finding

**A non-parametric experience memory system that improves LLM agent accuracy by up to +48.3 percentage points** through structured experience retrieval during agentic tasks. APEX-EM stores both successful AND failed past task trajectories, retrieves structurally similar experiences at plan time, and uses dual-outcome memory to provide both positive exemplars ("do this") and negative exemplars ("don't do this"). The PRGII workflow (Plan → Retrieve → Generate → Implement → Iterate) replaces naive RAG with structure-aware retrieval over directed acyclic graphs (DAGs) representing task decompositions.

## Technical Architecture

### PRGII Workflow (5 Phases)

1. **Plan** — Given a new task, the agent generates a candidate plan as a DAG of subtasks with dependencies
2. **Retrieve** — The plan DAG is matched against stored experience DAGs using structural similarity (not just semantic similarity)
3. **Generate** — Retrieved successful experiences inform the final plan; failed experiences provide guardrails
4. **Implement** — Agent executes the plan
5. **Iterate** — Execution outcome (success/failure) is stored back into the experience memory with full trajectory

### DAG-Based Structural Matching

The core technical contribution: **task plans are represented as directed acyclic graphs**, and experience retrieval uses structural matching rather than semantic embedding similarity.

- Each node = subtask (with description, tool calls, parameters)
- Each edge = dependency (subtask B depends on subtask A's output)
- Structural similarity metric considers:
  - Node-level semantic overlap (subtask descriptions)
  - Graph topology (dependency patterns)
  - Tool usage patterns (which tools in what sequence)
  - Parameter type compatibility

This is crucial because **semantically similar tasks can have very different execution structures**, and vice versa. A "send email" and "post to Slack" task are semantically different but structurally identical (compose → send → verify). Traditional vector-based retrieval misses this.

### Dual-Outcome Memory

APEX-EM stores both successful AND failed trajectories:

| Memory Type | Content | Role |
|---|---|---|
| **Success memory** | Complete trajectory + plan DAG for tasks that succeeded | Positive exemplar — "do it this way" |
| **Failure memory** | Complete trajectory + plan DAG + failure diagnosis for tasks that failed | Negative exemplar — "avoid this approach" |
| **Failure annotations** | Root cause analysis: which subtask failed, why, what was attempted | Guardrail — specific failure modes to check for |

At retrieval time, both successful and failed matches are surfaced:
- Top-k successful experiences → used as plan templates
- Top-k failed experiences with structural similarity → used as anti-patterns
- Failure annotations → used as pre-checks before execution

### Online Learning Loop

The system is **non-parametric and online** — no model retraining needed:
1. New task arrives → Plan → Retrieve → Execute → Store outcome
2. Memory grows continuously with each task
3. No explicit pruning strategy mentioned — the structural matching naturally surfaces the most relevant experiences regardless of memory size
4. Works with any base LLM (tested with GPT-4o, Claude 3.5 Sonnet, Llama 3.1 70B)

## Quantitative Results

### Performance Improvements
| Benchmark | Without APEX-EM | With APEX-EM | Improvement |
|---|---|---|---|
| WebArena (web browsing) | 21.7% | 38.2% | +16.5pp |
| OSWorld (desktop tasks) | 14.3% | 28.9% | +14.6pp |
| GAIA (general assistant) | 33.1% | 52.4% | +19.3pp |
| SWE-bench Lite (code repair) | 24.8% | 41.6% | +16.8pp |
| Custom multi-step planning | 31.4% | 79.7% | **+48.3pp** |

### Key Finding on Memory Composition
- **Success-only memory**: +12.1pp average improvement
- **Failure-only memory**: +8.3pp average improvement  
- **Both (dual-outcome)**: +24.1pp average improvement — MORE than the sum, indicating synergy
- The synergy comes from failure memories preventing the agent from repeating known-bad approaches, freeing exploration toward novel successful strategies

### Structural vs Semantic Retrieval
- **Semantic-only retrieval** (FAISS cosine): +14.7pp average
- **Structural-only retrieval** (DAG matching): +18.9pp average
- **Hybrid retrieval** (structural + semantic reranking): +24.1pp average
- Structural matching alone outperforms semantic-only — the graph topology carries critical information that text embeddings miss

## Why This Matters for MAS

### Direct Connections

1. **DD#539 (MemCoder)**: MemCoder uses sextuple memory (commit, changes, keywords, problem, root-cause, solution) for code repair. APEX-EM generalizes this to arbitrary agent tasks with DAG structure. The two are deeply complementary:
   - MemCoder's sextuple = APEX-EM's experience tuple, specialized for SWE
   - MemCoder's dual-stage retrieval (FAISS → cross-encoder) ≈ APEX-EM's hybrid retrieval (semantic → structural)
   - Both validate the non-parametric memory paradigm

2. **DD#540 (Steve-Evolving)**: Steve-Evolving stores success trajectories AND failure guardrails — exactly the dual-outcome pattern. APEX-EM formalizes what Steve-Evolving discovered empirically in Minecraft.

3. **CR#292 (Non-Parametric Self-Evolution)**: APEX-EM is the third independent validation of the memory-first non-parametric paradigm identified in CR#292. The convergence is now overwhelming:
   - MemCoder (code repair) → structured memory + dual retrieval → +9.4% on SWE-bench
   - Steve-Evolving (embodied) → experience tuples + dual-track distillation → continuous improvement curve
   - APEX-EM (general agents) → DAG memory + dual-outcome + structural matching → +48.3pp on custom tasks

4. **DD#542 (MatClaw Four-Layer Memory)**: MatClaw's four layers (working/session/episodic/semantic) map cleanly to APEX-EM's approach — APEX-EM effectively provides the episodic layer with structural organization.

5. **DD#544 (Automatic Textbook Formalization)**: The formalization paper's ~10% merge rate implies massive waste. If prover agents had APEX-EM's experience memory, they could retrieve successful proof strategies from earlier agents' work, potentially dramatically improving the merge rate. The issue tracker is an informal version of this.

### Architectural Implications for Our System

The APEX-EM architecture suggests specific improvements:

1. **Store task DAGs, not just outcomes**: Our current experience storage (if any) is flat — task description + result. We should store the full plan structure as a DAG, enabling structural retrieval.

2. **Dual-outcome is critical**: Storing only successes leaves agents blind to failure modes. The +8.3pp from failure-only memory and the synergy effect mean we're leaving significant performance on the table by not explicitly tracking and retrieving failures.

3. **Structural retrieval outperforms semantic**: For agent tasks (which have dependency structures), graph-based matching beats vector similarity. We should investigate lightweight DAG matching for experience retrieval.

## The Key Insight

**Experience memory works because agent tasks have structure that text embeddings cannot capture.** Two tasks with identical natural language descriptions ("update the database and send a notification") can have completely different dependency structures, tool requirements, and failure modes. DAG-based structural matching captures this structure, enabling retrieval of experiences that are *operationally* similar rather than just *descriptively* similar.

The dual-outcome principle is equally important: **failures are as informative as successes, and the combination is more valuable than either alone.** This is the experience-memory equivalent of what DD#540's dual-track distillation (skills + guardrails) discovered empirically.

## Predictions

- **P300**: Within 6 months, experience memory will become a standard component of production agent frameworks, shipping as a plugin/module rather than requiring custom implementation
- **P301**: DAG-based structural matching will prove especially valuable for multi-agent systems where task decomposition patterns are reused across agents — shared experience memory across agent fleet will show 2-3× improvement over per-agent memory
- **P302**: The dual-outcome synergy effect (+24.1pp > +12.1pp + +8.3pp = +20.4pp) will be explained by failure memories pruning the search space, allowing success memories to guide toward novel solutions more efficiently
- **P303**: Experience memory will prove to be the key missing component that makes the "non-parametric self-evolution" paradigm (CR#292) production-ready — it's the practical implementation pattern for what MemCoder and Steve-Evolving discovered in domain-specific contexts
