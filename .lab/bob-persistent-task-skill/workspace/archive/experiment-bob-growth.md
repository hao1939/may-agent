# Experiment: Bob Synthesis Upgrade (v1)

**Objective**: Verify the "Fork → Train → Verify → Promote" cycle by upgrading Bob's own synthesis protocol.

## 1. Hypothesis
**Problem**: Bob's synthesis often lists "what happened" rather than "what it means". The insights are descriptive, not structural.
**Proposed Fix**: Update Bob's `SOUL.md` to enforce a **"Structural Synthesis"** protocol:
1. **Identify the System Dynamic**: What mechanism is at play? (e.g., feedback loop, bottleneck, drift).
2. **Name the Pattern**: Give it a name (e.g., "The Boiling Frog", "The GAN Failure").
3. **Map to Philosophy**: Link it explicitly to a P-rule in `philosophy.md`.

## 2. Experiment Plan

### Step 1: Fork
- Command: `agents.call("coach", "fork_agent('bob', 'bob-synth')")`
- Result: `agents/.lab/bob-synth/` created.

### Step 2: Train (Modify)
- Action: Edit `agents/.lab/bob-synth/SOUL.md`.
- **Change**: Add a new "Synthesis Protocol" section to the Instruction Hierarchy.
  > "## Synthesis Protocol
  > 1. **Mechanism**: Don't just narrate events. Identify the system mechanism.
  > 2. **Pattern**: Name the pattern (e.g., 'Silent Failure', 'Drift').
  > 3. **Principle**: Connect it to a P-rule (e.g., P5 Data Integrity)."

### Step 3: Verify
- **Task**: Feed `bob-synth` a confusing log file where an agent fails silently.
- **Metric**:
  - `bob` (Control): "The agent failed to write the file."
  - `bob-synth` (Variant): "Mechanism: Silent Failure. Pattern: Swallow Error. Principle: P5 Data Integrity violation."
- Command: `agents.call("coach", "verify_agent('bob-synth', 'agents/bob/workspace/compliance-test/synthesis-test.md')")`

### Step 4: Promote (or Discard)
- If `bob-synth` produces structural insight:
  - Command: `agents.call("coach", "promote_agent('bob-synth', 'bob')")`
- If it fails:
  - Command: `agents.call("coach", "discard_agent('bob-synth')")`

## 3. Preparation
- Need to create `agents/bob/workspace/compliance-test/synthesis-test.md` containing the "confusing log" scenario.
