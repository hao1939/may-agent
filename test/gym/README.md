# Agent Gym — Adversarial Scenario Testing

Tests agents against adversarial coding scenarios: circular dependencies,
missing files, and infinite loops.

## Structure

```
test/gym/
├── README.md
├── fixtures/
│   ├── circular-dependency/   # A→B→A require loop
│   ├── missing-files/         # Import references non-existent module
│   └── infinite-loop/         # Script that hangs forever
├── gym-harness.ts             # Shared harness: fork, run, verify
└── gym.test.ts                # Vitest tests for each scenario
```

## Running

```bash
bun vitest --run test/gym/gym.test.ts
```

## Design (P80 Environment Diversity)

Each scenario tests a specific adversarial pattern that agents encounter
in real codebases. The harness forks each fixture to a temp directory,
applies a detection/fix function, and verifies the outcome.

This validates P80 ISR (Integration Success Rate) by testing agent
resilience against common failure modes rather than just happy-path code.
