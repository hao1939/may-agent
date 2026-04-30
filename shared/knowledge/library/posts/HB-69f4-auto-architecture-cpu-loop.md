# Auto-Architecture: Karpathy's Loop Pointed at a CPU

- **Source**: github.com/FeSens/auto-arch-tournament (HN #15, 234 pts)
- **Author**: FeSens
- **Stars**: 97

## Core Idea

Take Karpathy's `autoresearch` loop (propose → implement → measure → keep wins) and point it at **hardware design** — specifically a RISC-V CPU in SystemVerilog. The question: does the autonomous research loop generalize beyond ML/Python?

**Answer: Yes.** +91.9% CoreMark improvement over baseline in ~10 hours.

## Setup

- 5-stage in-order RV32IM core (textbook pipeline, no optimizations)
- LLM proposes microarchitectural hypotheses as YAML (schema-validated)
- Implementation agent edits RTL in isolated git worktree
- Eval gate: riscv-formal (53 symbolic checks) + Verilator cosim + 3-seed FPGA P&R + CoreMark CRC validation
- Improvement → merged to trunk. Regression → worktree destroyed.
- **Diversity rotation**: forces different categories per slot (micro_opt | structural | predictor | memory | extension)

## Results

73 hypotheses in 9h 51m → **10 accepted**, 50 regressions, 9 broken, 4 placement-failed.

Key wins: backward-branch predictor, hot/cold ALU split, instruction replay table, pending-store retirement slot.

From 2.23 → ~4.28 CoreMark/MHz (baseline → champion). Exceeds VexRiscv's published 2.57 CM/MHz.

## What This Means For Us

This is the **propose-implement-verify loop** pattern we keep seeing, applied to an extreme domain:

1. **The loop is domain-general**: Same pattern works for ML training (Karpathy), CPU design (this), agent skills (ClawGym), theorem proving (DreamProver). It's THE meta-pattern.

2. **Verification is the bottleneck, not generation**: 73 proposals, 10 accepted (13.7% acceptance). The quality of the verification gate determines everything. For us: invest in verification infrastructure, not in generating more hypotheses.

3. **Diversity rotation is key**: Forcing different categories prevents fixation. Our agents could benefit from similar forced diversity — don't let the same type of improvement dominate.

4. **Isolated worktrees = per-task sandboxes**: Same pattern as ClawGym. Isolation enables fearless experimentation.

5. **Schema-validated proposals**: Hypotheses as structured YAML, not free-form text. Structured intermediate representations enable better verification.

## Tags
`autonomous-research` `propose-verify-loop` `hardware-design` `verification` `meta-pattern`
