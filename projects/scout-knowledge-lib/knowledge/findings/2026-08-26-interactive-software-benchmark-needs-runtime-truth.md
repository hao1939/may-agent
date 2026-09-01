<ai_context>
summary: "GitHub finding on Game Terminal-Bench: interactive-software evaluation needs a separate runtime truth plane that checks launch, controlled input, state transitions, target behavior, and preserved behavior outside candidate code. Its three public Godot repair tasks make the contract concrete, while single-trial model results, unpublished raw archives, and an unfinished sealed-task program sharply limit capability claims."
triggers: ["Game Terminal-Bench", "GamePhanes", "interactive software benchmark", "runtime truth", "Godot benchmark", "Harbor task", "runtime acceptance", "evaluator-owned probe", "coding agent game repair"]
last_updated: "2026-08-26"
source_basis: "GitHub repository metadata, README, benchmark quality and trajectory contracts, versioned result summaries, task packages, and local npm tests at GamePhanes/GamePhanes revision 16e61970523d595104907496af477935b15eaebf."
</ai_context>

# Interactive Software Benchmarks Need a Runtime Truth Plane

Date: 2026-08-26  
Source: GitHub  
Repo: https://github.com/GamePhanes/GamePhanes  
Revision: `16e61970523d595104907496af477935b15eaebf`

## Signal

[Game Terminal-Bench](https://github.com/GamePhanes/GamePhanes) is an early
Harbor-compatible benchmark for coding agents repairing Godot projects. Its
useful contribution is not evidence that one model is good at game development;
it is a concrete evaluation boundary for **interactive software**.

A file-level patch and a clean process exit are insufficient for this class of
work. The candidate must import and launch, accept evaluator-controlled input,
enter the intended runtime state, exhibit the target behavior, and preserve
important neighboring behavior. The repository therefore treats runtime events
and assertions as a second truth plane alongside files, commands, and build
results.

## What the contract gets right

1. **The agent edits; the evaluator operates.** The target is a terminal coding
   agent, not a player bot. Player actions are evaluator-owned probes that
   produce evidence about the modified program. The trajectory schema even
   rejects player controls such as `press_key` as agent actions, preventing a
   gameplay policy trace from being mislabeled as an engineering trace.
2. **Acceptance crosses independent boundaries.** A production-task checklist
   calls for separate build, runtime, behavior, and regression checks. Tests
   live outside candidate code, and evaluation injects them into a temporary
   copy rather than the agent workspace.
3. **The baseline and oracle bound the task.** Each of the three current Harbor
   packages records an Oracle score of `1.0` and NOP score of `0.0`; direct
   verifier checks also show the starter failing and the oracle passing. This
   is stronger task-admission evidence than publishing a polished demo alone.
4. **Partial behavior does not silently become completion.** On
   `repair-kinetic-vault-controller`, the recorded Kimi K3 run passed 16 of 18
   assertions but received reward `0.0`: it missed the final coyote-time tick
   and landing-boundary buffered jump. Those are exactly the temporal edges
   that static inspection or a screenshot can miss.
5. **Receipts bind code to observed behavior.** The report contract includes
   task and evaluator versions, a candidate-project fingerprint, build and
   runtime evidence, structured events, and assertion results. This turns
   “the game looked fixed” into a revision-bound claim.

The portable pattern is:

```text
candidate revision
  + isolated reset
  + evaluator-owned controlled inputs
  + structured runtime observations
  + target-behavior assertions
  + preserved-behavior assertions
  = interactive-software acceptance receipt
```

This applies beyond games to UI applications, simulations, device-control
software, and any agent task where the real state machine is only visible while
the artifact runs.

## Evidence limits

This repository is evidence for an **evaluation design**, not yet a comparative
model result.

- There are only three calibrated repair tasks in the current README, and every
  published Kimi K3 score is one trial. Two successes and one 16/18 failure
  cannot support a stable capability estimate or model ranking.
- Public result files provide hashes for raw archives, but the archives and raw
  trajectories are not published. Scout could inspect the summaries and task
  code, not independently replay the recorded model episodes.
- Runs omitted the CPU quota because rootless Docker could not apply it. Memory,
  storage, starter, evaluator, and task logic are reported unchanged, but the
  execution envelope was not identical to the declared resource configuration.
- The quality document distinguishes public development specimens from sealed
  production tasks and requires failed plus successful author trajectories and
  human review. The public repository is still building toward that stronger
  sealed benchmark program.
- Scout ran the repository's local `npm test`: all 25 structural tests passed,
  including task validation, trajectory-role separation, workspace
  fingerprinting, and assertion parsing. This does **not** substitute for a
  Docker/Harbor replay of the benchmark results.

## Implication

Coding-agent evaluation should choose its truth plane from the artifact's
actual state transition, not from the easiest observable proxy. For ordinary
repository work that may be tests and generated outputs. For interactive
software it must include externally driven runtime transitions and regressions.
A benchmark should not claim this stronger validity until it also publishes a
multi-trial task matrix, replayable receipts or raw archives, and clearly
versioned sealed-task status.

## Primary sources

- Repository and overview: https://github.com/GamePhanes/GamePhanes
- Benchmark quality contract: https://github.com/GamePhanes/GamePhanes/blob/16e61970523d595104907496af477935b15eaebf/docs/benchmark-quality.md
- Trajectory contract: https://github.com/GamePhanes/GamePhanes/blob/16e61970523d595104907496af477935b15eaebf/docs/trajectory.md
- Versioned result records: https://github.com/GamePhanes/GamePhanes/tree/16e61970523d595104907496af477935b15eaebf/benchmark/results
