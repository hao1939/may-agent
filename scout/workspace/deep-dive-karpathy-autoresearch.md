# Deep Dive: karpathy/autoresearch — Autonomous AI Research Loop

**Source:** https://github.com/karpathy/autoresearch
**Stars:** 16,052 (created 2026-03-06, ~4 days old)
**Forks:** 2,045
**Language:** Python
**License:** MIT
**Author:** Andrej Karpathy

## What It Is

A minimalist framework for autonomous AI research: give an AI agent a single-GPU LLM training setup and let it experiment autonomously overnight. The agent modifies code, trains for 5 minutes, checks if results improved, keeps or discards, and repeats. Based on a simplified single-GPU implementation of [nanochat](https://github.com/karpathy/nanochat).

## Architecture (Deliberately Simple)

Only 3 files matter:
1. **`prepare.py`** — Fixed constants, data prep, evaluation. READ-ONLY. Not modified by agent.
2. **`train.py`** — The single file the agent edits. Contains full GPT model (12-layer, 768-dim, 6-head), Muon + AdamW optimizer, training loop. Everything is fair game.
3. **`program.md`** — Agent instructions. A "skill" file. Edited by the HUMAN, not the agent.

## The Experiment Loop (from program.md)

```
LOOP FOREVER:
1. Look at git state
2. Modify train.py with experimental idea
3. git commit
4. Run: uv run train.py > run.log 2>&1
5. Read results: grep "^val_bpb:" run.log
6. If crash: tail -n 50 run.log, attempt fix
7. Record in results.tsv
8. If improved: keep (advance branch)
9. If worse: git reset to previous
```

Key design constraints:
- **Fixed 5-minute time budget** (wall clock) — makes experiments comparable regardless of model size/architecture changes
- **Single metric:** val_bpb (bits per byte) — lower is better, vocab-size-independent
- **~12 experiments/hour, ~100 experiments overnight**
- **"NEVER STOP"** instruction: agent runs indefinitely until manually interrupted
- **Simplicity criterion:** all else equal, simpler is better. Removing code for equal results = great outcome.

## Model Details

The train.py contains a full GPT implementation:
- GPTConfig: 2048 seq_len, 32768 vocab, 12 layers, 6 heads, 768 dim
- Flash Attention 3 (Hopper-optimized, with kernels-community fallback)
- Value Embedding with gated alternating layers
- Rotary positional embeddings
- RMS normalization
- "SSSL" window pattern (alternating banded attention)

## Why This Matters (Analysis)

### 1. The "Program the Programmer" Paradigm
Karpathy's key insight: **you don't write Python — you write the program.md that instructs the AI to write Python.** The human's job shifts from coding to meta-programming: designing the research org, the experimental methodology, the constraints. This is exactly what our system does with agent specialization and delegation.

### 2. Autonomous Improvement Loop = SAHOO's Domain
This is a real-world implementation of what SAHOO (arXiv:2603.06333) theorizes about. The autoresearch loop IS recursive self-improvement:
- Agent generates code modifications
- Trains and evaluates (the "improvement step")
- Keeps or discards (the "selection step")
- Iterates (the "loop")

Missing from autoresearch that SAHOO provides:
- **No drift monitoring** — the agent could gradually optimize for overfitting or "hacking" the metric
- **No constraint preservation** — only the simplicity criterion, enforced by natural language instruction
- **No regression risk tracking** — git reset handles binary keep/discard but doesn't track degradation trends

### 3. Connections to Our Safety Stack
- **L1 (JRH):** The evaluation is deterministic (val_bpb from fixed prepare.py) so L1 judge reliability is trivially satisfied
- **L2 (Bias-Bounded):** Not needed — the metric is a ground-truth scalar, not a judgment
- **L3 (Introspection):** The agent could confabulate explanations for why experiments work/fail
- **L5 (Bug-Hunt):** A second agent reviewing the code changes would catch "metric hacking"
- **L6 (SAHOO):** Directly applicable — GDI could track if the agent's changes drift from the research objective

### 4. Ecosystem Signal: Platform Forks
Already 3 notable forks for MacOS (2), Windows, showing community demand to run on consumer hardware. The "research democratization" pattern: an H100 gives ~100 experiments/night, but smaller GPUs still work.

### 5. The "Researcher as Org Designer" Future
Karpathy's README envisions: "how you'd add more agents to the mix" — multi-agent research teams where different agents explore different architectural directions simultaneously. This maps directly onto HiMAP-Travel's (2603.04750) hierarchical coordination pattern: a Coordinator allocates the research directions, Worker agents explore in parallel.

## Transferable Patterns for Our System

1. **Fixed-budget evaluation:** Every experiment gets the same time/resource budget. This makes comparison fair and prevents the agent from gaming evaluation by training longer.

2. **Git as experiment log:** Each modification is a commit; branches track the "best path" through experiment space. Discarded experiments are reverted. The full history is auditable.

3. **results.tsv as structured memory:** Tab-separated log of all experiments with commit hash, metric, status, description. This is the agent's long-term memory of what worked and what didn't.

4. **program.md as "skill" file:** The human edits the methodology, not the code. The skill file IS the research org. This validates our system's approach of structuring agent behavior through markdown instructions.

5. **"NEVER STOP" instruction:** The agent is explicitly told to never pause for human approval. This is the opposite of our hard-gated verification approach — autoresearch trades safety for throughput, which works because the metric is a ground-truth scalar (not a judgment call).

6. **Simplicity criterion as implicit constraint:** "A 0.001 val_bpb improvement that adds 20 lines of hacky code? Probably not worth it." This is qualitative constraint enforcement through natural language — where SAHOO's quantitative constraint preservation would be more robust.

## Assessment

**Impact:** ★★★ — This is the highest-signal GitHub discovery since we started tracking. 16k⭐ in 4 days from Karpathy's personal repo means massive community engagement. The paradigm (autonomous AI research via agent loops) is the logical endpoint of what tools like our system are building toward.

**Novelty:** Medium — the idea of automated hyperparameter search isn't new (AutoML, NAS). What's novel is the framing: agent-as-researcher with natural language methodology, git-based experiment tracking, and the explicit "you program the programmer" philosophy.

**Risk:** The loop has no safety rails. No drift detection, no constraint preservation, no adversarial verification. For val_bpb optimization this is fine (ground truth metric). For our use cases (where evaluation is judgment-based), running this loop without safety layers would be dangerous.

**For our system:** The most transferable idea is the **fixed-budget, git-tracked, structured-log experiment loop**. If we wanted to implement automated improvement (e.g., agent iterates on prompt engineering, code generation strategies, etc.), autoresearch's pattern is the minimal viable template. Add SAHOO's safety layers and we have a production-ready self-improvement loop.
