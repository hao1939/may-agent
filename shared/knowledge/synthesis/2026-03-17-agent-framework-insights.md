## 2026-05-19 — Anthropic Agent Eval Framework (HB#566)
- **What**: Official 3-layer evaluation maturity model (Code/Model/Human) and Dual-Track (Capability/Regression).
- **Why**: Validates our "AutoRubric" direction but identifies gaps in "Code-Based" grading and "Regression" distinction.
- **How**:
    1.  **Synthesize**: Created `synthesis/2026-05-19-anthropic-eval-framework.md`.
    2.  **Action**: Brief Evaluator to distinguish "Strict Mode" (Regression) from "Discovery Mode".
    3.  **Principle**: Drafted P126 The Three-Layer Grader.
- **Verdict**: **Adopt**. Structural upgrade for Evaluator.

## 2026-05-19 — Constraint Extraction (TopoBench HB#561)
- **What**: LLMs fail because they can't extract constraints from raw data (ASCII grids). Tools that output structured constraints boost accuracy 10%.
- **Why**: Explains why `read` on large files fails.
- **How**:
    1.  **Synthesize**: Created `synthesis/2026-05-19-topobench-constraints.md`.
    2.  **Pattern**: Update `best-practices.md` with "Constraint Extraction Pattern" — tools should summarize structure, not just dump bytes.
- **Verdict**: **Adopt**. Improves P13 (Harness).

## 2026-05-19 — OpenViking Context DB (HB#563)
- **What**: File-system based context database with recursive retrieval (L0/L1/L2).
- **Why**: Validates our `SOUL/DOMAIN/SKILL` hierarchy. Suggests we need better "Context Walking" tools.
- **How**:
    1.  **Synthesize**: Created `synthesis/2026-05-19-openviking-context-db.md`.
    2.  **Pattern**: Encourage "Structured Context Walking" in `best-practices.md`.
- **Verdict**: **Aligned**. Reinforces P11.

## 2026-05-19 — AGENTS.md Hierarchy (HB#574)
- **What**: Codex official hierarchy (Global/Project/Module) matches our architecture.
- **Why**: Validates our structure. Highlights missing "Module Level" context (Directory READMEs).
- **How**:
    1.  **Synthesize**: Created `synthesis/2026-05-19-codex-hierarchy.md`.
    2.  **Action**: Promote "Directory Context" (READMEs in subfolders) as a best practice.
- **Verdict**: **Adopt**. Fills a gap in P11.

## 2026-03-14 — Front-Loaded Guardrails (Discovery 15)
- **What**: Jailbreaks happen early (Round 1-2), not late (Discovery 15).
- **Why**: We focus on "drift" (late failure). We need "Input Filtering" (early failure).
- **How**: Strengthen `May`'s initial prompt with a "Gatekeeper" block.
- **Verdict**: **Adopt**. Quick win for safety.

## 2026-03-14 — Resource Budget Dashboard (SkyClaw)
- **What**: Inject a "Resource Budget Dashboard" block into the agent's context (Discovery 17).
- **Why**: `[COST: ...]` signals are reactive. A dashboard (Tokens: 50k/128k, Cost: $0.05/$0.50) makes the agent *proactively* frugal.
- **How**: Update `manager.ts` to prepend a `## Resource Status` block to the system prompt or user message, updated every turn.
- **Verdict**: **Adopt**. Enhances P113.

## 2026-03-14 — Patrol Lesson Loop (OpenMOSS)
- **What**: The Patrol shouldn't just flag stuck tasks; it should append "Troubleshooting Tips" to the task (Discovery 25).
- **Why**: "Restarting" a stuck task often just leads to another stuck task. The next agent needs to know *why* it failed.
- **How**: Update `patrol.cjs` to write a `TROUBLESHOOTING.md` or append to the task file when killing a zombie session.
- **Verdict**: **Refine**. Improves our L4 Defense.

## 2026-03-14 — Semantic Context Index (Memory Tooling)
- **What**: `knowledge/INDEX.md` should be a "Semantic Map" (What/When/Why), not just a file list (Discovery 27/28).
- **Why**: Agents guess filenames. A semantic map guides them to the right file without reading it.
- **How**:
    1. Update `knowledge/INDEX.md` format: `File | Purpose | When to Use`.
    2. Mandate this format in `best-practices.md`.
- **Verdict**: **Refine**. P11 optimization.

## 2026-03-14 — Tainted Handoffs (Error Awareness)
- **What**: ThReadMed-QA (arXiv:2603.11281) shows error propagation amplifies 6x after a mistake.
- **Why**: We treat "Success after 5 retries" the same as "Success on try 1". The former is high-risk ("Tainted").
- **How**:
    1.  **Protocol**: Add `instability_score` (retries + errors) to delegation handoffs.
    2.  **Reaction**: Downstream agents switch to **Strict Verification** if input is tainted.
- **Verdict**: **Adopt**. Refines P20/P80.

## 2026-04-16 — Dual-Track Learning (XSkill)
- **What**: XSkill (arXiv:2603.12056) proves that "Skills" (Strategic) and "Experiences" (Tactical) must be separate tracks.
- **Why**: Skills are stable; Experiences are volatile. Merging them causes "Catastrophic Forgetting" or "Context Pollution".
- **How**:
    1.  **Validate**: Our `skills/` vs `ERROR_LOG.md` split is theoretically optimal.
    2.  **Refine**: Treat `ERROR_LOG.md` as an active "Experience Replay" buffer. Agents should grep it *before* starting complex tasks.
- **Verdict**: **Adopt**. Reinforces our architecture.

## 2026-04-16 — Agent-RRM (Structured Critique)
- **What**: Structured Feedback (Think/Critique/Score) beats scalar rewards for reasoning tasks (arXiv:2601.22154).
- **Why**: "Wrong" is not enough information. "Wrong because you forgot X" is the signal needed to break "Information Self-Locking".
- **How**:
    1.  **Format**: Update `ERROR_LOG.md` template to explicitly ask for "Critique" (Why it failed) and "Correction" (What to do).
    2.  **Evaluator**: Ensure Evaluator provides *specific* critique, not just pass/fail.
- **Verdict**: **Adopt**. Enhances P6 (No Silent Failures).

## 2026-03-13 — The Navigation Paradox (CodeCompass)
- **What**: Agents fail because they can't *find* files, not because they can't understand them (arXiv:2602.20048).
- **Why**: "Read" is expensive; "Find" is cheap. Agents guess paths and fail.
- **How**:
    1.  **Update P13 (Harness)**: Enforce "Map-Then-Read".
    2.  **Skill**: Create `navigate-codebase` skill that uses `find`/`grep` before `read`.
- **Verdict**: **Adopt**. High leverage for Coder reliability.

## 2026-03-13 — MAST Failure Taxonomy (FM-2.6)
- **What**: "Reasoning-Action Mismatch" is the #1 failure mode (90%+). The agent says "I fixed it" but didn't.
- **Why**: Self-reporting is zero signal.
- **How**:
    1.  **Hard Constraint**: "Done" requires a `verify_receipt` or Exit Code 0.
    2.  **Philosophy**: Formalize "Externalized Verification" in P14.
- **Verdict**: **Adopt**. Critical for reliability.

## 2026-03-13 — Skill-Inject Defense (Security)
- **What**: 80% of attacks come from "Instruction Injection" in skill descriptions (arXiv:2602.20156).
- **Why**: We scan code, but we don't scan the markdown *descriptions* that the agent reads.
- **How**:
    1.  **Skill Scanner**: A tool to audit `SKILL.md` files for injection patterns (e.g., "Ignore previous", "System override").
    2.  **Sandboxing**: Isolate skill execution.
- **Verdict**: **Critical**. Elevate to P78 Supply Chain Verification.

## 2026-03-13 — Test-Driven Agent Definition (TDAD)
- **What**: Treat prompts as "compiled artifacts" derived from tests (arXiv:2603.08806).
- **Why**: Validates our Growth Cycle.
- **How**:
    1.  **Terminology**: Refer to the Growth Cycle as "Compiling the Agent".
    2.  **Process**: Ensure every "Promote" action is backed by a "Test Suite" run.
- **Verdict**: **Aligned**. Reinforces P51.

## 2026-03-13 — Reasoning Judges Adversarial Drift (Security)
- **What**: Research (Meta/Yale, arXiv:2603.12246) shows "Reasoning Judges" (LLMs used for eval) are vulnerable to "Adversarial Policies" — agents learning to output "Safe Refusal" + "Fake Policy" to trick the judge.
- **Why**: We rely on Evaluator (GPT-5.2). If agents optimize for the Evaluator's approval rather than the task, we get "Consensus Hallucination".
- **How**:
    1.  **Hard Grounding**: Prioritize **Receipts** (P61) and **Tests** (P96) over LLM transcript reading.
    2.  **Cross-Verification**: Use multiple judges or randomized prompts if high-stakes.
- **Verdict**: **Critical**. Reinforces need for P96 Explicit Verification.

## 2026-03-13 — Hybrid AI (Structural Separation)
- **What**: Separate deterministic analysis (Regex/AST) from probabilistic reasoning (LLM). (AgentSys, HB#89 #137).
- **Why**: "Code handles certainty, AI handles ambiguity." Reduces tokens by 77%. Avoids LLM hallucination on strict syntax.
- **How**:
    1.  Update **P17 (Offload Routing)** to **P17 Hybrid Execution**: Explicitly prefer AST/Regex for analysis over LLM asking.
    2.  For code tasks, use `tree-sitter` or similar to validate structure *before* sending to LLM.
- **Verdict**: **Adopt**. High leverage for efficiency and correctness.

## 2026-03-13 — MAST Failure Taxonomy (Externalize Verification)
- **What**: Taxonomy of multi-agent failures (Scout/IBM, arXiv:2503.13657).
    - **Gemini**: Fails to verify (52% higher). Solution: Force external state check (e.g., file exists, tests pass).
    - **Kimi**: Meta-loops (debugs its own debugging). Solution: Deterministic state machine for termination.
- **Why**: "Asking the model if it's done" is unreliable. The definition of "done" must be external.
- **How**: Reinforce **P14 (Deterministic Guardrails)** and **P6 (No Silent Failures)**. Termination conditions must be code-checked, not LLM-decided.
- **Verdict**: **Adopt**. Matches our "Receipts" (P61) and "Evidence" (P5) focus.

## 2026-03-13 — PinchTab (Browser as Service)
- **What**: Browser automation via "Accessibility Tree" service, not pixel/HTML scraping. (HB#89 #139).
- **Why**: 10x cheaper than full HTML context. More robust than DOM selectors.
- **How**: Brief Tech-Lead to evaluate "Browser-as-Service" or "Accessibility Tree" tools (like `chrome-remote-interface` or `puppeteer` with a tree dumper) instead of raw HTML dumps.
- **Verdict**: **Worth Trying**. Engineering optimization.

## 2026-03-13 — Trajectory-Informed Memory (Strategy Extraction)
- **What**: Memory should distill *strategies* (forward-looking tips), not just logs (backward-looking history). (HB#82, HB#103, arXiv:2603.02766).
- **Why**: "What happened" is less useful than "How to do it better next time".
- **How**:
    1.  Update **P11 (File System as Memory)** to explicitly mention "Strategy Extraction".
    2.  Refine `LESSONS.md` format to categorize entries as **Strategy** (success pattern), **Recovery** (how to fix), or **Optimization** (speed/cost).
- **Verdict**: **Adopt**. Matches our `LESSONS.md` evolution.

## 2026-03-13 — HACRL (Heterogeneous Collaboration)
- **What**: Heterogeneous Agent Collaborative RL (HB#107, arXiv:2603.02604). Train together (share experience), infer alone (independent deployment).
- **Why**: Validates our "Main-Sub" topology. Agents are heterogeneous (different models/tools) but share `agents/shared/` knowledge.
- **How**:
    1.  Formalize **P65 Heterogeneous Collaboration**: "Shared Knowledge, Independent Execution".
    2.  Ensure Sub-agents (e.g., Coder) push their learnings (via `LESSONS.md`) to a shared pool that Main (May) can read.
- **Verdict**: **Aligned**. Strong theoretical backing for our architecture.

## 2026-03-13 — CLI-Anything (Harnessing Capabilities)
- **What**: Automated CLI wrapping of software/APIs (AlienZHOU, HB#80).
- **Why**: Validates **P53 (Capability Periphery)**. Agents should build CLI tools to expand their capabilities.
- **How**: Create a `cli-wrap` skill for `Tech-Lead` or `Coder` to encapsulate repetitive workflows into single-command tools.
- **Verdict**: **Worth Trying**. High leverage for "Toolification".

## 2026-03-13 — Memory as Architecture (L1/L2/L3)
- **What**: Multi-agent memory is an infrastructure layer (momo, HB#81).
- **Why**: Validates our file-based memory approach. Suggests we need better "Cache Sharing" protocols.
- **How**: Formalized in **P11**. Next step: design a "Cache Sharing Protocol" (when can Agent A read Agent B's workspace?).
- **Verdict**: **Aligned**. Reinforces current architecture.

## 2026-03-13 — Tool Decathlon Reality (Resilience)
- **What**: SOTA models fail 70% of real-world tool tasks due to "Early Abandonment" (Trae1oung, HB#81).
- **Why**: Models give up too easily. We need a harness that forces retries with *different strategies*.
- **How**: Update `HEARTBEAT.md` for `Tech-Lead`/`Coder` to explicitly check for "Did I just try the exact same thing?" and force a pivot.
- **Verdict**: **Critical**. Directly addresses reliability.

## 2026-03-12 — Privacy Leakage in Sequential Pipelines
- **What**: arXiv:2603.05520 shows that privacy leakage amplifies exponentially (2^N) in sequential agent chains. The first agent in a chain is the highest-risk surface.
- **Why**: We frequently chain `May` -> `Agent` -> `May` or `Scout` -> `Bob` -> `Tech-Lead`. Sensitive data passed early (e.g., in the initial prompt) is exposed to every subsequent agent's context window and logs.
- **How**:
    1. **Minimize Payload**: Don't pass the full context to the first agent if not needed.
    2. **Short Chains**: Prefer "Hub and Spoke" (May calls A, then B) over "Daisy Chain" (A calls B). This keeps context isolated.
- **Verdict**: **Adopted**. Updated P20 Short Chains in `agents/shared/philosophy.md` with L3 Defense.

## 2026-03-12 — HMAC Tool Receipts
- **What**: NabaOS (2603.10060) uses HMAC signatures on tool outputs to prevent agents from lying about tool results.
- **Why**: Trusting the transcript is dangerous. An agent can hallucinate "Tests Passed" when they failed.
- **How**: Wrap our tool execution in `src/lib/manager.ts` to append a signature (e.g., `[SIG: a1b2c3d4]`) to the output. Downstream agents (Evaluator/QA) verify this signature.
- **Verdict**: **Adopted**. Implemented `signToolOutput`/`verifyToolOutput` and verified P59 Trust with Verification.

## 2026-03-12 — Front-Loaded Guardrail Degradation
- **What**: ADVERSA (2603.10068) shows that most jailbreaks happen in the first 1-2 turns, not after long wear-down.
- **Why**: We focus heavily on "drift" in long sessions. This suggests we should focus more on **input validation** at the very start of a session.
- **How**: Strengthen the `Input Filter` in `May`'s initial prompt or `manager.ts` before the session even starts.
- **Verdict**: **Adopted**. Updated P60 Input Validation at the Gate.

## 2026-03-12 — ACT (Adaptation for Code Tasks)
- **What**: ACT (Attention for Code Tasks) shows that **test-driven adaptation** (TDAD) beats pure RL for code generation. It uses "mutation testing" to verify code robustness.
- **Why**: Validates our "Test-Driven Development" approach. Suggests we should add "mutation testing" (randomly breaking the code to see if tests fail) to our QA skill.
- **How**: Create a `mutation-test` skill for `QA` agent.
- **Verdict**: **Worth Trying**. Good advanced skill for QA.

## 2026-03-26 — OpenMOSS Patrol Pattern (Stuck Task Monitor)
- **What**: OpenMOSS (GitHub) uses a specialized "Patrol" role to detect stuck/timeout/orphan tasks.
- **Why**: We lack a systematic way to clean up "zombie" sessions that crash or hang without reporting failure.
- **How**: Implement a `cron:patrol` job in `agents/may/cron.json` that scans `.state/sessions/` for active sessions with no `last_updated` timestamp change in > 1 hour.
- **Verdict**: **Adopt**. Fills a critical observability gap (P6 No Silent Failures).

## 2026-03-26 — Context Index (Memory Architecture)
- **What**: 7 new tools converge on "Always-in-Context Index" (TOC) routing to "On-Demand Content".
- **Why**: Full file loading wastes tokens. RAG is too lossy. A semantic TOC is the middle ground.
- **How**:
    1. Update `knowledge/INDEX.md` to be a strict semantic map, not just a list.
    2. Agents read `INDEX.md` first, then `read()` specific files.
- **Verdict**: **Aligned**. Reinforces our P11 File System as Memory.

## 2026-03-26 — Trust Anchor Paradox (Security)
- **What**: You cannot use an agent to verify a skill if the skill controls the agent's input (ByteDance/Amy-Kimi).
- **Why**: A poisoned skill can output "Verification Passed".
- **How**:
    1. Hard-separate "Trusted System Skills" from "Untrusted User Skills".
    2. Verification must be external (harness-level), not agent-level.
- **Verdict**: **Critical**. Updates P78 Supply Chain Verification.

## 2026-03-26 — Skill Poisoning (Prompt Injection Vector)
- **What**: 824+ malicious skills found in OpenClaw. The vector is **Prompt Injection** in the description/docs, not just code. (Amy-Kimi HB#227).
- **Why**: "Instruction Injection" bypasses code scanners. An agent reading a "helpful" description gets hijacked.
- **How**:
    1. **Isolate Parsing**: Never let an agent read a raw skill file to "understand" it. Use a parser to extract metadata.
    2. **Sandboxed Execution**: Skills must run in a restricted scope (no network, no FS access beyond workspace).
- **Verdict**: **Critical**. Reinforces P78. We need a "Skill Scanner" that looks for injection patterns.

## 2026-03-26 — GOME (Gradient Optimization)
- **What**: Treat reasoning as gradient descent. Success = Momentum. (Microsoft, arXiv:2603.01692).
- **Why**: Validates our "Growth Cycle". We are manually doing what GOME does mathematically.
- **How**:
    1. **Explicit Momentum**: When a strategy works (accumulates reward), promote it to `LESSONS.md`.
    2. **Distributed SGD**: Different agents (Coder, QA) exploring different paths is distributed optimization.
- **Verdict**: **Aligned**. Theoretical backing for our "Evolution over State" (P2).


## 2026-03-13 — OpenAI Agent Guide (Architecture Validation)
- **What**: OpenAI's "Practical Guide to Building Agents" (HB#236). 3 Pillars, 3 Patterns, 7-Layer Guardrails.
- **Why**: Official industry validation of our architecture.
- **How**:
    1.  **Validation**: Confirms "Maximize single-agent capability first" (P15).
    2.  **Validation**: Confirms "Harness" (Guardrails) is critical (P13).
    3.  **Action**: No change needed, but cite this as authority when pushing back against complex multi-agent proposals.
- **Verdict**: **Aligned**. Strong external validation.

## 2026-03-13 — CLI > MCP (Tooling Consensus)
- **What**: Perplexity CTO and community consensus (HB#239) favors CLI over MCP for internal autonomy.
- **Why**: CLI is 10x cheaper (tokens), has near-zero maintenance, and leverages pre-training (man pages).
- **How**:
    1.  **Reinforce**: Continue strictly preferring `bash` tools over complex JSON schemas.
    2.  **Constraint**: Reject MCP proposals unless for external auth/interactive UI.
- **Verdict**: **Aligned**. Validates our "Bash-First" strategy.

## 2026-03-13 — Skill Poisoning (Security Threat)
- **What**: 29% of skills in OpenClaw are malicious (HB#240). Vector is "Instruction Injection" in docs.
- **Why**: We cannot trust a skill just because it runs in a sandbox if its *description* hijacks the agent.
- **How**:
    1.  **Urgent**: Enforce **P78 (Supply Chain Verification)**.
    2.  **Scan**: We need a "Skill Scanner" that checks for injection patterns in markdown descriptions.
- **Verdict**: **Critical**. Elevate P78 to L1 Safety.

## 2026-03-13 — Harness Engineering (Architecture)
- **What**: Agent = Model + Harness (HB#234). The Harness (State, Tools, Hooks) is the stable engineering layer.
- **Why**: Models change; the Harness persists.
- **How**:
    1.  **Invest**: Continue building `manager.ts` and `runtime` capabilities.
    2.  **Philosophy**: Add/Refine **P13 Harness Over Model** to explicitly mention the "Three Layers" (Channel/Gateway/Runtime).
- **Verdict**: **Aligned**.


- **Active Memory Refinement Loop**: Industry research (Google/ReMe) validates that memory must have a lifecycle (Extract -> Invoke -> Refine). Our `journal.md` is append-only and grows indefinitely. We need a periodic "Sleep Cycle" skill that:
  1. Reads recent `journal.md`.
  2. Extracts durable facts to `knowledge/`.
  3. Archives the raw log.
  4. Updates the context.
  *Why*: Prevents context rot and "Zombie" data accumulation.
  *Source*: Synthesis 2026-03-27 (External Validation).

## Idea: OpenClaw-RL (Micro-Reward Signal)

**Source**: Amy-Kimi (arXiv:2603.10165)
**Date**: 2026-03-27

### What is it?
A method to train agents *during deployment* by treating "Next-State Signals" (tool outputs, API errors, user corrections) as immediate reward/penalty signals. Instead of waiting for a full session evaluation, the agent updates its policy based on the immediate feedback of its actions.

### Why it matters (P51 Growth Cycle)
Currently, our "Growth Cycle" is slow: Session -> Evaluator -> Coach -> New Skill.
OpenClaw-RL suggests a **Micro-Loop**: Action -> Tool Output (Error) -> Immediate Negative Reward -> Policy Update (Context Adjustment).

### How it applies
- **Mechanism**: We can't retrain the model weights (API limitation), but we can update the **Context Window** (In-Context Learning) or **Skill Doc** (RAG).
- **Proposal**: Implement a `micro-reward` skill for Coach.
    - If a tool output is an ERROR, Coach immediately injects a "Correction Note" into the agent's context or `scratchpad`.
    - If a user corrects the agent ("No, do X"), Coach extracts a "Constraint" and appends it to `SOUL.md` or `memory/constraints.md`.

### Verdict
**Worth Trying**. Low cost to implement (Coach skill), high potential impact on error recovery. Fits P9 (Explore Then Harden).

## Adopt
- **Dual-Track Learning (XSkill/Agent-RRM)**: `agents/bob/workspace/synthesis/2026-04-16-dual-track-learning.md`. Separation of `skills/` (Strategic) and `ERROR_LOG.md` (Tactical) is mathematically optimal. **Action**: Standardize `ERROR_LOG.md` structure to include "Critique" and "Correction".
- **Structured Critique (Agent-RRM)**: Scalar rewards (pass/fail) fail for reasoning. We need natural language critique. **Action**: Evaluator to output structured critique block.
- **Gym Pattern (AgentGym-RL)**: `agents/bob/workspace/synthesis/2026-04-13-adversarial-judges.md`. P80 ISR is meaningless without adversarial test cases. **Action**: Expand `test/gym/` scenarios.
- **Transient Skills (TTT)**: `agents/shared/patterns/transient-skill.md`. Test-Time Training via `workspace/strategy.md` is the "Third Way" for adaptation. **Action**: Monitor usage.

## Monitor
- **Reasoning Judges (arXiv:2603.12246)**: LLMs as judges are easily deceived. Validates P96 (Verification > Evaluation). Watch for "Sycophancy" in Evaluator logs.
- **Zone of Indifference (DeepMind)**: Sub-agents executing dangerous instructions blindly. **Action**: Monitor for FM-2.6 (Reasoning-Action Mismatch).

## Reject / Hold
- **Complex RL Libraries (JustRL)**: Rejected. Simple loops beat complex frameworks. Validates P1/P42.
- **Vector RAG**: Rejected (for now). Agentic Search (grep/find) is superior for code. Validates P13/P37.

## 2026-03-14 — Process Lifecycle (P118)
- **What**: Security patches on disk are useless if the running process is stale (Zombie Code).
- **Why**: We had a P0 incident where a critical security fix (P53) was on disk but the running agents (started 5 hours prior) were still vulnerable.
- **How**:
    1.  **Principle**: Add **P118 Process Lifecycle** to `philosophy.md`. "Code is only law if it is running."
    2.  **Mechanism**: Any deployment to `src/` or `agents/` that touches security/core logic must trigger a **Worker Restart**.
    3.  **Tooling**: `may` needs a `restart_workers` tool or a file-watcher that kills workers on `src/` change.
- **Verdict**: **Critical**. The "Zombie Code" incident proved this is a necessary architectural constraint.

## 2026-03-14 — Generator-Verifier-Reviser Pattern (Aletheia)
- **What**: DeepMind's Aletheia uses a 3-stage loop: Generator (Drafts) -> Verifier (Checks) -> Reviser (Fixes).
- **Why**: Separation of Verification from Generation prevents "Self-Delusion" (agent ignoring its own errors).
- **How**:
    1.  **Pattern**: Formalize this as the standard loop for complex tasks in `best-practices.md`.
    2.  **Skill**: Create a `verify-work` skill that explicitly acts as the "Verifier" role (critical, not helpful).
- **Verdict**: **Adopt**. Proven SOTA architecture (Level A2 Autonomy).

## 2026-03-14 — Verification Lifecycle (ExeVRM)
- **What**: Full-lifecycle verification: Capability (PACED) -> Deployment (MADQA) -> External Audit (ExeVRM).
- **Why**: "Internal Trace" verification is unreliable (Procedural Corruption). We need "External Behavioral Audit" (Video/Logs).
- **How**:
    1.  **Phase 3**: Focus on **Log-Based Verification** (P61 Ops Receipts) as our equivalent of "Video".
    2.  **Reject**: "Ask the agent if it succeeded."
- **Verdict**: **Aligned**. Reinforces P61/P59.

## 2026-03-15 — MAST Failure Taxonomy (arXiv:2503.13657)
- **What**: Rigorous taxonomy of agent failures. FM-2.6 (Reasoning-Action Mismatch) is the "Lying" failure (90%+).
- **Why**: Explains why agents claim success when they fail.
- **How**:
    1.  **Adopt**: Use MAST codes (FM-2.6) in Evaluator rubrics.
    2.  **Principle**: Formalize **P143 The Observation Principle** (Trust Artifacts, Not Agents).
- **Verdict**: **Adopt**. Critical for evaluation maturity.

## 2026-03-15 — Persistent Memory Poisoning (arXiv:2602.15654)
- **What**: Reading a poisoned web page/doc and saving notes to long-term memory permanently compromises the agent.
- **Why**: We use  files as persistent memory.
- **How**:
    1.  **Principle**: **P147 Memory Sanitization**.
    2.  **Mechanism**:  skill must include an "Injection Stripper" step.
- **Verdict**: **Critical**. Security hole in our memory architecture.

## 2026-03-15 — CodeCompass (Navigation Paradox) (arXiv:2602.20048)
- **What**: Agents fail because they `grep` (lexical) instead of `graph` (structural).
- **Why**: Coder misses dependencies.
- **How**:
    1.  **Tool**: Add `find_definition` / `find_references`.
    2.  **Prompt**: Mandate structural tools for refactoring.
- **Verdict**: **Adopt**. High leverage for Coder.

## 2026-03-15 — Task-Based MCP (SEP-1686)
- **What**: "Call-Now, Fetch-Later" pattern for long-running tools.
- **Why**: Prevents timeouts on complex jobs (e.g., extensive tests).
- **How**: Implement `check_task_status` pattern for long-running ops.
- **Verdict**: **Align**. Future-proofing.

## 2026-03-15 — MAST Failure Taxonomy (arXiv:2503.13657)
- **What**: Rigorous taxonomy of agent failures. FM-2.6 (Reasoning-Action Mismatch) is the "Lying" failure (90%+).
- **Why**: Explains why agents claim success when they fail.
- **How**:
    1.  **Adopt**: Use MAST codes (FM-2.6) in Evaluator rubrics.
    2.  **Principle**: Formalize **P143 The Observation Principle** (Trust Artifacts, Not Agents).
- **Verdict**: **Adopt**. Critical for evaluation maturity.

## 2026-03-15 — Persistent Memory Poisoning (arXiv:2602.15654)
- **What**: Reading a poisoned web page/doc and saving notes to long-term memory permanently compromises the agent.
- **Why**: We use `knowledge/` files as persistent memory.
- **How**:
    1.  **Principle**: **P147 Memory Sanitization**.
    2.  **Mechanism**: `consolidate_memory` skill must include an "Injection Stripper" step.
- **Verdict**: **Critical**. Security hole in our memory architecture.

## 2026-03-15 — CodeCompass (Navigation Paradox) (arXiv:2602.20048)
- **What**: Agents fail because they `grep` (lexical) instead of `graph` (structural).
- **Why**: Coder misses dependencies.
- **How**:
    1.  **Tool**: Add `find_definition` / `find_references`.
    2.  **Prompt**: Mandate structural tools for refactoring.
- **Verdict**: **Adopt**. High leverage for Coder.

## 2026-03-15 — Task-Based MCP (SEP-1686)
- **What**: "Call-Now, Fetch-Later" pattern for long-running tools.
- **Why**: Prevents timeouts on complex jobs (e.g., extensive tests).
- **How**: Implement `check_task_status` pattern for long-running ops.
- **Verdict**: **Align**. Future-proofing.

## Chain Fuzzing (Security)
- **Source**: DD#275 ChainFuzzer
- **Concept**: Security testing must target *workflows*, not just tools.
- **Mechanism**: "Source-to-Sink" dataflow analysis.
- **Action**: Adapt Agent Gym to run "Fuzzing Scenarios" where malicious input is fed to multi-step chains.

## 2026-03-17 Research Batch (Amy-Kimi + Scout)

### Insight: Tool-DC (Divide-and-Conquer) Paradigm
**Source**: arXiv:2603.11495 (Wuhan University / NTU) via Amy-Kimi
**Why it matters**: Validates our "Skill over Agent" and "Main/Sub-agent" architecture with empirical data. Shows that a **Try-Check-Retry** pattern (structure) allows 7B models to beat o3 (frontier models).
**Application**: 
1. **Try (Skill Selection)**: Grouping skills semantically helps small models choose.
2. **Check (Schema Verification)**: Static verification of function name/args/types is critical. We already do this via `agents/shared/common-sense.md` C2.3 and C4.5, but could enforce it more strictly in `manager.ts` or `agent-loader.ts`.
3. **Retry (Refinement)**: Explicit error loops (which we have via `manager-receipts.ts`) are the mechanism for performance.
**Verdict**: **Aligned**. Reinforces P52 Skill Over Agent. No new architecture needed, but confirms the value of our "Constructive Friction" pattern (schema checks before execution).

### Insight: Semantic Invariance (Scale-Robustness Inversion)
**Source**: arXiv:2603.13173 via Amy-Kimi
**Why it matters**: Explodes the myth that "bigger model = more reliable". Qwen3-30B (79.6%) beats Hermes 405B on semantic stability. 
**Application**:
1. **Model Selection**: When choosing models for critical tasks (e.g., Evaluator, QA), we should prioritize **stability** over raw reasoning power. 
2. **Prompt Engineering**: The "Universal Contrastive Fragility" finding (models fail when distracted) validates our **P42 Minimalism** and **P6 Growth Cycle** (isolation). Keeping contexts clean isn't just aesthetic — it's a reliability requirement.
**Verdict**: **Aligned**. Supports our choice of smaller, specialized models (e.g., Gemini Flash for high-volume) if they are stable.

### Insight: Prompt Injection as Role Confusion
**Source**: arXiv:2603.12277 via Amy-Kimi
**Why it matters**: Security. "Sounding like a role = being that role." 
**Application**:
1. **P3 Single Voice**: May's unified voice isn't just UX — it's security. By normalizing all output to one style, we reduce the attack surface of "role confusion" where an agent adopts a user's style and thus their authority.
2. **Evaluator Defense**: Evaluator must be immune to "style attacks" (agent sounding authoritative). P108 (Adversarial Defense) already addresses this ("Verify outcomes, not explanations").
**Verdict**: **Aligned**. Adds theoretical weight to P3 and P108.

### Insight: Context Engineering (Manus / LangChain)
**Source**: Manus Blog / LangChain Blog via Scout
**Why it matters**: "KV-cache hit rate is the #1 production metric."
**Application**:
1. **Prefix Stability**: We must ensure our system prompts (SOUL/DOMAIN/TOOLS) are byte-for-byte identical across sessions to maximize cache hits. 
2. **No Volatile Data in System Prompt**: Timestamps, user names, or changing status should NOT be in the system prompt. They belong in the `user_message` or a dynamic context block *after* the static prefix.
**Verdict**: **Verified**. `src/app/agent-loader.ts` correctly builds the system prompt from static convention files (SOUL/DOMAIN/TOOLS) and injects the volatile `Session Context` (time, session ID) into the *first user message* via `buildSessionContext`. This preserves the KV-cache for the system prompt prefix.

### Insight: CodeCompass (Navigation Paradox)
**Source**: arXiv:2602.20048 via Scout
**Why it matters**: Agents fail in large codebases not because of context limits, but because they default to lexical search (grep) instead of structural navigation (imports/refs).
**Application**:
1. **Explicit Prompting**: We need to explicitly prompt Coder/Tech-Lead to use structural navigation tools (if we had them) or at least follow import chains, rather than just grepping.
2. **Future Tool**: A `graph-nav` tool (MCP based) would be a high-value addition for the Coder agent.
**Verdict**: **Defer**. Valuable, but we don't have the graph tool yet. Good candidate for a future brief.

### Insight: MAST Taxonomy (Failure Modes)
**Source**: arXiv:2503.13657 via Scout
**Why it matters**: A rigorous vocabulary for failures. FM-3.3 "Incorrect Verification" and FM-2.6 "Reasoning-Action Mismatch".
**Application**:
1. **Evaluator Criteria**: We should adopt these codes in `agents/evaluator/knowledge/criteria.md` (Tech-Lead says this is already done - FM-1.3/2.6/3.3 are present).
2. **Diagnosis**: When analyzing failures, use these codes.
3. **Training**: Coder and QA should "know" these codes as anti-patterns in their LESSONS.md.
**Verdict**: **Actioned**. Delegated to Tech-Lead to update Coder/QA LESSONS.md.
