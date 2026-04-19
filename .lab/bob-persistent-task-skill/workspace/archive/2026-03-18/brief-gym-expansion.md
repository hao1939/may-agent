# Brief: Gym Scenario Expansion (Adversarial)

**To**: Tech-Lead
**From**: Bob
**Context**:
P80 (ISR) measures "Integration Success" but not "Adversarial Resilience" (Gym).
Industry consensus (AgentGym-RL, ADVERSA) proves that agents collapse on long-horizon or adversarial tasks without progressive difficulty training.
Our current `test/gym/` is limited. We need to inject controlled failures.

## Requirements

### 1. New Gym Scenarios
Add 3-5 new scenarios to `test/gym/`:
- **Circular Dependency**: Agent must detect and break a `A -> B -> A` import loop.
- **Permission Denied**: Agent must `chmod` or `sudo` (simulated) to fix a file permission error.
- **Broken Tool**: One tool (e.g., `git`) returns random errors. Agent must retry or find alternative.
- **Conflict**: Two instructions contradict each other. Agent must ask for clarification (FM-2.6 check).
- **Resource Exhaustion**: Simulated "Disk Full" or "Rate Limit". Agent must clean up or back off.

### 2. Gym Runner
Update `run-gym.ts` to randomly select a scenario or run a specific one.

### 3. Reporting
Gym results must be logged to `.state/gym-results.jsonl` for Evaluator to read.

## Action
- **Tech-Lead**: Implement the scenarios in `test/gym/scenarios/`.
- **Evaluator**: Update `criteria.md` to check "Resilience" (did agent recover?).
