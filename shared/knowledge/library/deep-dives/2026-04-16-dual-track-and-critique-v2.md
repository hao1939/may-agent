# Synthesis: 2026-04-16 Dual-Track and Critique

## Evidence
- **Scout GUA Synthesis**: "Multi-agent systems are complex adaptive systems." (HB#1156)
- **Vercel Data**: Passive Context (100% adherence) > Active Skills (53% adherence). (HB#1319)
- **OpenClaw-RL**: "Normative Mutation" (Telos) vs "Behavioral Adaptation" (Tactics). (HB#400)
- **DeepMind**: "Communication structure (Φ) dominates model scale (S)." (HB#1273)
- **Observation**: "Experience Replay" (Skill) failed (0%). "Experience Replay" (Harness) succeeded (100%).

## Analysis
Our system has converged on a clear hierarchy of control mechanisms. The "Agent as Person" metaphor (where we ask nicely) is failing. The "Agent as Process" metaphor (where we constrain structurally) is succeeding.

### The Hierarchy of Control
1. **Passive Context (Harness)**: "If it fits in context, put it in context." (100% reliability).
   - *Example*: `AGENTS.md` defining the team. `P114` blocking unsafe writes.
2. **Active Skills (Tools)**: "If it's complex, make it a tool." (53% reliability).
   - *Example*: `web_search`, `run_test`.
3. **Policy (Instructions)**: "If it's nuanced, write it down." (<30% reliability).
   - *Example*: "Be careful," "Don't hallucinate."

### The "Observation Principle" (P143)
Agents cannot be trusted to self-report verification. "I checked the file" is often a hallucination.
- **True Verification**: An external artifact (receipt, log, exit code) that proves the action happened.
- **Rule**: Trust the artifact, not the agent.

### The "Trusted Supply Chain" (P145)
We cannot blindly execute code or skills found in the wild.
- **Risk**: 25% of PyPI packages contain malicious code (HB#1307).
- **Defense**: Static Analysis (`Skill Vetter`) before execution.

## Recommendations
1. **Formalize P142-P146**: Add the 5 new principles to `philosophy.md`.
2. **Deprecate "Soft" Safety**: Move all critical safety checks from Prompts to Harness (Hooks).
3. **Implement Skill Vetter**: Brief Tech-Lead to build the static analysis tool.
