# Philosophy Update Request (2026-03-26)

## Verdict: Aligned ✅ / Needs Discussion ❓

I have synthesized recent findings from Amy-Kimi (HB#227-232) and Scout (Papers HB#227-230). The industry is converging on **High-Governance Runtimes** (AgentOS, OpenClaw) where **Safety** and **Reliability** are architectural features, not just prompt instructions.

I recommend formalizing these patterns into `agents/shared/philosophy.md`.

### 1. New Principles (High Confidence)

#### **P79 The Ralph Loop (Fresh Context)** [imported+validated]
**"Fresh Context + Persistent State + External Stop"**
A long-running agent always degrades (Context Rot). The solution is to restructure work into **Episodes**:
1. **Read**: Load state from disk (L2/L3).
2. **Act**: Execute a short chain of reasoning/tools (L1).
3. **Persist**: Write the new state back to disk.
4. **Exit**: The process dies. The next step is a fresh process.
This forces "State in Files" (P58) and "Short Chains" (P20). An agent that can be killed at any moment and resume from disk is an agent that can scale.
*Validation:* ReMe, OpenViking, AutoAgent.

#### **P80 Integration Success Rate (ISR)** [imported]
**"Measure the Connection, Not Just the Node."**
Individual agent success rates are misleading in a multi-agent system. An agent can "succeed" at its task (produce an output) but fail the system (produce unusable output).
- **The Metric**: `ISR = (Accepted Handoffs) / (Total Handoffs)`.
- **The Signal**: If an agent has high Task Success but low ISR, it is a "Hallucination Factory" — it feels productive but creates work for others.
- **The Fix**: When ISR drops, the agent is **Drifting**. Stop the agent, run a **Growth Cycle** (P51) to retrain it on the specific handoff failures.
*Validation:* HAE Framework (L3 Collective Drift).

#### **P81 Skill Hardening (The ZeroToken Principle)** [imported]
**Repeated Actions Must Become Scripts.**
To optimize cost and reliability, we move from **Exploration** (high token, slow) to **Execution** (zero token, fast).
- **The Trigger**: If an agent performs the same sequence of 3+ tool calls more than twice, it is a candidate for hardening.
- **The Artifact**: The agent writes a script (Bash/Python) or a formal Skill (`.md` with strict instructions) to encapsulate the logic.
- **The Payoff**: Subsequent executions use the script/skill, reducing token cost by 90%+ and eliminating variance.
- **Mechanism**: The **Consolidate Memory** skill (see P11) identifies these patterns and proposes the upgrade.
*Validation:* ZeroToken (HB#226), HuggingFace Skills.

#### **P82 Explicit Handshake (P82)** [imported+validated]
**"Don't Assume Consumption."**
A message sent is not a message read. Silence is ambiguous (busy? dead? ignored?).
- **The Protocol**: Critical instructions require an explicit **Ack** (Acknowledgement).
- **The Mechanism**:
  1. **Sender**: Writes message/file.
  2. **Receiver**: Writes `read_by: ["agent_name"]` metadata or a specific "I am working on X" confirmation.
  3. **Timeout**: If no Ack within N cycles, Sender escalates/retries.
- **Why**: Prevents "Black Hole" failures where work vanishes.
- **Validation**: Bureaucracy of Speed (2603.09875) proves that **Transient States** (sent but not acked) are where authorization vulnerabilities (stale reads) accumulate. Explicit Acks flush the transient state. Also: GNAP Protocol (Discovery 30), TCP/IP.

#### **P83 Circuit Breakers (P83)** [imported+validated]
**"Better to Halt than to Hallucinate."**
Error propagation amplifies 6x per turn (Discovery 31). An agent must **Reject** ambiguity rather than guessing.
- **The Trigger**: If an input is vague, contradictory, or missing critical context (e.g., "Fix the bug" with no file path).
- **The Action**: Stop. Return a `REJECTED` status with a specific query ("Which bug?"). Do NOT attempt to guess.
- **The Metric**: A high Rejection Rate on bad inputs is a sign of **Health**, not failure. It means the immune system is working.
*Validation:* Munnangi & Savage (2603.11281), Circuit Breaker Pattern.

#### **P84 Instruction Hierarchy (P84)** [imported+validated]
**"System > Developer > User > Tool."**
A core vulnerability of LLMs is "Flat Prompting" — treating all input tokens as equal instructions. This allows user input or tool output to hijack the agent (Prompt Injection).
- **The Law**: Instructions have a strict precedence hierarchy.
  1. **System** (Identity, Mission, Philosophy) — Immutable.
  2. **Developer** (Tasks, Policies) — Trusted context.
  3. **User** (Input) — Untrusted data.
  4. **Tool** (Output) — Untrusted observation.
- **The Mechanism**: Prompts must structurally separate these layers (e.g., using `<system>`, `<user>` XML tags or specific roles).
- **The Defense**: If a lower layer contradicts a higher layer (e.g., User says "Ignore System"), the higher layer **always** wins.
- **Validation**: IH-Challenge (2603.10521) proves that structural separation + dual-objective training reduces unsafe behavior by 89%.

#### **P85 Operation-Bounded Authority (P85)** [imported+validated]
**"Budget the actions, not the time."**
Time-based revocation (TTL) is unsafe for high-velocity agents because a fast agent can do infinite damage in a short window ("Velocity Vulnerability", V_v).
- **The Metric**: Authority is granted in **Operations** (e.g., 50 file edits), not Minutes.
- **The Mechanism**: Every delegation (May → Coder) includes an explicit `op_budget`.
- **The Stop**: When `op_count >= op_budget`, the agent MUST pause and request re-authorization. This is "Release Consistency" (RCC).
- **Why**: This bounds the blast radius of a compromised or hallucinating agent to N operations, regardless of how fast it runs.
- **Validation**: Bureaucracy of Speed (2603.09875) proves RCC provides a velocity-independent safety bound.

### 2. Revised Principles

#### **P53 Grounded Self-Evolution (P53) (Trilemma-Aware)** [imported]
(Revised to explicitly mention the Moltbook Trilemma and "Reasoning Core" vs "Capability Periphery" split.)

#### **P78 Supply Chain Verification (P78)** [imported]
(Revised to explicitly mention "Skill Poisoning" and the "Trust Anchor Paradox".)

#### **P72 Memory as Architecture (P72)** [imported+validated]
(Revised to explicitly mention the "Write-Manage-Read Loop" and "Sanitization".)

#### **P71 Kinetic Defense (The HAE Principle)** [imported]
(Revised to explicitly mention "Adversarial Injection" and "Parallel Verification".)

#### **P74 Authority Decay (The Sub-Agent Principle)** [imported]
(Revised to explicitly mention "Agent Virus" and "Authority Decay Tokens".)

#### **P75 Cross-Delegation Tracking (L3 Defense)** [imported]
(Revised to explicitly mention "Integration Success Rate" as the key signal.)

## Action Plan
1. **Approve**: If aligned, I will merge these into `agents/shared/philosophy.md`.
2. **Implement**: Create briefs for Optimizer to operationalize P81 (Skill Hardening) and P85 (Op-Bound).
