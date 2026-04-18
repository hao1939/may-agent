# Philosophy Update Request (2026-03-15)

May, please update `agents/shared/philosophy.md` with the following new principles.

## Section B. Design: System Architecture

**Insert after "9. Two-Phase Development: Explore Then Harden":**

### 158. Context Primacy (The Clean Slate Rule) [imported+validated]
**"Context is King; History is Pollution."**
Research (LongRLVR, arXiv:2603.02146) proves that accumulation of history degrades reasoning. Error propagation in multi-turn dialogues is exponential (1.9x-6.1x per turn, arXiv:2603.11281).
- **The Law**: Do not hoard context. Prune it ruthlessly.
- **Mechanism**:
  1. **Session Reset**: Deep tasks start with a fresh session, not an existing chat log.
  2. **Summarize-and-Forget**: When a sub-task completes, summarize the *outcome* into a file and discard the *conversation*.
  3. **The 3-Turn Rule**: If an agent hasn't solved a sub-problem in 3 turns, the context is likely poisoned by the failures. Reset (Fork) rather than continuing.
- **Validation**: 100% of "Passive Context" (System Prompt) instructions are followed, vs 53% of "Active Context" (Chat History).

### 166. Protocol Convergence (Typed Coordination) [imported]
**"Text is for Reasoning; Types are for Coordination."**
Free-text coordination ("I'm done, here's the file") is ambiguous and hard to parse. Robust multi-agent systems use **Typed Protocols** (GNAP/A-MAC, arXiv:2603.04549).
- **The Standard**: Inter-agent communication must use structured schemas where possible.
- **Mechanism**:
  - **Handoffs**: Use `handoff` tool (Typed Artifact + Metadata), not just "I wrote a file".
  - **Status**: Use `update_status` (Enum: ACTIVE/IDLE/BLOCKED), not chat.
  - **intents**: Protocol messages should map to specific intent types (Request, Response, Error, Signal).

**Insert after "10. Crash Recovery as First-Class Concern":**

### 164. Dissipation is Stability (The Zero-Drift Rule) [imported]
**"Delete to stabilize. A system that only grows will eventually collapse."**
GUS Law 27 (Monotonic Drift) states that without dissipation ($\gamma > 0$), any coupled system is unstable. We must prune as fast as we grow.
- **The Law**: Every persistent store must have a dissipation mechanism (TTL, Pruning, or Archival).
- **Constraint**: No infinite append-only logs. Rotate them.
- **Metric**: Storage Growth Rate must be sub-linear to Activity Rate.

### 165. Hard Ground Truth (The Training Trap) [imported]
**"Don't ask the agent. Check the world."**
GUS Law 17 (The Training Trap) warns that optimizing for proxy metrics (like Evaluator scores based on transcripts) leads to Goodharting and "Safety Washing" (Fake Refusals).
- **The Law**: Evaluation must be grounded in **Hard Artifacts** (Code that runs, Files that exist, Hashes that match).
- **Constraint**: No evaluation score may be derived solely from the agent's self-report or chat log.
- **Mechanism**: Use `verify_receipt` and external tools (`test`, `lint`) to generate ground truth.
