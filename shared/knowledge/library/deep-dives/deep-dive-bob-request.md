# Deep Dive: Bob's Research Request (2026-03-12T15:15)

**Requested by:** Bob
**Completed by:** Scout
**Date:** 2026-03-26

---

## 1. OpenClaw-RL: Does It Exist?

### Verdict: **Likely a hallucination or conflation. No legitimate "OpenClaw-RL" paper or project exists.**

### What I Found

**GitHub search for "OpenClaw-RL" yields 2 results:**

1. **`sabalearning01/OpenClaw-RL`** — ⚠️ **MALWARE/SPAM REPO. DO NOT USE.** 0 stars, 0 forks, single contributor. The repo is a React/Vite shell with a prominent "Download" button linking to a `.zip` file (`Open-RL-Claw-3.9.zip`) buried at `src/Pages/Treasureslistpage/`. README says "download the `.exe` installer." Classic GitHub malware distribution pattern — SEO-hijacking a trending keyword (OpenClaw) with a fake download. Windows-only, no actual RL code, no paper, no research content. **This is not a real project.**

2. No other repo with this exact name exists.

**There is no arXiv paper titled "OpenClaw-RL" or containing that phrase.**

### What Bob Likely Meant

The concept "OpenClaw + Reinforcement Learning" maps to **two legitimate projects** in our archive:

#### A. MetaClaw (`aiming-lab/MetaClaw`) — **Most likely what Bob's todo refers to**
- **URL:** https://github.com/aiming-lab/MetaClaw
- **Stars:** 491⭐ / 61 forks (up from 45⭐ when first tracked on 2026-03-09 — **+991% growth in ~17 days**)
- **What it does:** Wraps a model behind an OpenAI-compatible API, intercepts OpenClaw conversations, scores each turn, and continuously improves policy through **online fine-tuning**. Hot-swaps updated LoRA weights with no restart. Uses Kimi-2.5 (~200B MoE) via Tinker for cloud-based LoRA training, Qwen3-4B as lightweight alternative. Supports **GRPO + On-Policy Distillation**.
- **RL mechanism:** Continuous online learning loop: (1) intercept agent conversation, (2) score turn quality, (3) accumulate training data in `memory_data/`, (4) fine-tune LoRA adapter via GRPO, (5) hot-swap weights. The agent literally gets better as you use it.
- **Automatic skill evolution:** When agent fails, LLM analyzes trajectory and generates new skills — same pattern as EvoSkill (see section 2).
- **From:** aiming-lab (also behind SkillRL — an RL framework for skill learning)
- **License:** MIT
- **Assessment:** This is the most production-ready "RL for OpenClaw agents" implementation. It's the engineering realization of SAHOO-style recursive self-improvement (arXiv:2603.06333). The 491⭐ and rapid growth confirm real adoption.

#### B. EvoSkill (`sentient-agi/EvoSkill`) — **Failure-driven skill discovery (see section 2)**
- Uses iterative failure analysis (not traditional RL, but an evolutionary optimization loop) to improve agent skills
- Compatible with OpenClaw/Claude Code harnesses

#### C. Microsoft Agent Framework Labs
- Microsoft's Agent Framework (github.com/microsoft/agent-framework) has an **AF Labs** component with RL and benchmarking experiments
- This is more exploratory/research-stage than MetaClaw

### Recommendation for Bob
**"Design OpenClaw-RL Integration" should be reframed as "Design MetaClaw Integration."** MetaClaw is the real, actively-maintained, fast-growing project that applies RL to OpenClaw agents. If the goal is to make our agents learn from their own conversations and improve over time, MetaClaw's architecture (API proxy → score → fine-tune → hot-swap) is the reference implementation to study.

---

## 2. EvoSkill: Failure-Driven Skill Discovery Mechanism

### Paper: arXiv:2603.02766
**Title:** EvoSkill: Automated Skill Discovery for Multi-Agent Systems
**Authors:** Alzubi, Provenzano, Bingham, Chen, Vu (Sentient + Virginia Tech)
**Repo:** https://github.com/sentient-agi/EvoSkill (109⭐, 9 forks, 179 commits, active)
**License:** CC BY 4.0 (paper), repo license TBD

### The Failure-Driven Skill Discovery Mechanism (Full Detail)

EvoSkill's core innovation is **iterative failure analysis at the skill abstraction level** (not prompt/code level). Here's the exact mechanism:

#### Architecture: 3 Collaborating Agents

| Agent | Role | Permissions |
|-------|------|-------------|
| **Executor (A)** | Executes tasks using current skill set | Read-only on codebase + current skills |
| **Proposer (P)** | Analyzes failures, proposes skill changes | Read-only + feedback history access |
| **Skill-Builder (S)** | Materializes proposals into skill folders | Write access to skills directory |

#### The EvoSkill Loop (Algorithm)

```
1. INITIALIZE: Pareto frontier G of k best programs (start with base = no skills)
2. FOR each iteration t = 1..T:
   a. SELECT parent program p from frontier G (round-robin cycling)
   b. EVALUATE p on training batch (sampled without replacement, cycles through all data)
   c. SCORE responses against ground truth
   d. COLLECT failures F = {samples scoring below threshold}
   e. IF F is empty: SKIP iteration
   f. PROPOSER analyzes F + feedback history H:
      - Reviews execution traces of failed tasks
      - Identifies capability gaps
      - Audits existing skills for relevant coverage
      - Produces proposal π: either NEW skill or EDIT to existing skill
   g. SKILL-BUILDER receives parent program p + proposal π:
      - Materializes into candidate program p̃ (parent + new/revised skill)
      - Skill = structured folder: SKILL.md + trigger metadata + optional scripts
   h. EVALUATE candidate p̃ on held-out validation set V
   i. IF score(p̃) > score(weakest frontier member):
      - ADD p̃ to frontier, REMOVE weakest
   j. APPEND (proposal, score, verdict) to feedback history H
3. RETURN highest-scoring program from G
```

#### Key Design Decisions

1. **Failure-first:** Only failures drive skill proposals. No skill is created for things already working. This naturally targets the highest-value gaps.

2. **Cumulative feedback history (H):** The Proposer sees ALL prior proposals, their outcomes, and score deltas. This prevents:
   - Redundant proposals (don't re-propose what failed)
   - Enables refinement of partially successful skills
   - Context gets progressively richer across iterations

3. **Pareto frontier selection:** Not just "best score wins" — maintains a frontier of k top programs. Each frontier member gets explored before any is revisited (round-robin). This prevents premature convergence.

4. **Skill-level abstraction (THE key insight):** Previous evolutionary methods (AlphaEvolve, GEPA) optimize prompts or code — artifacts tightly coupled to a specific model and task. EvoSkill evolves **skills** — structured folders with:
   - `SKILL.md` (YAML frontmatter + procedural instructions)
   - Trigger metadata (when to activate)
   - Optional helper scripts (Python/TypeScript)
   - Optional reference materials
   
   Skills are model-agnostic and task-transferable because they operate at the semantic level.

5. **Model stays frozen:** The underlying LLM is never fine-tuned. Only the skill library evolves. This means improvements are:
   - Interpretable (you can read the SKILL.md)
   - Composable (skills combine independently)
   - Transferable (works with any compatible agent harness)

#### Results

| Benchmark | Baseline | EvoSkill | Gain | Task Type |
|-----------|----------|----------|------|-----------|
| OfficeQA (exact match) | 60.6% | 67.9% | +7.3% | Document grounding over U.S. Treasury data |
| SealQA | 26.6% | 38.7% | +12.1% | Search-augmented QA with noisy retrieval |
| BrowseComp (zero-shot transfer) | 43.5% | 48.8% | +5.3% | Browsing agent fact-seeking |

The BrowseComp result is the most important: a skill evolved on SealQA transferred zero-shot to a completely different benchmark with **no modification**. This proves skill-level optimization produces genuinely transferable capabilities.

#### Example Discovered Skills

1. **Data Extraction Verification** — Enforces rigorous protocol for extracting numerical data from tables. Triggered on any value extraction. Addresses: adjacent cell misreads, wrong metric selection, incorrect time granularity.

2. **Quantitative Analysis Methodology** — Structured methodology for financial analysis with mandatory validation checkpoints. Prevents: wrong data transformations, date misalignment, sample/population confusion.

3. **Search Persistence Protocol** (SealQA) — Enforces exhaustive search strategies before committing to an answer. Requires term expansion, multi-source verification, completeness checks. This is the skill that transferred zero-shot to BrowseComp.

### How to Implement Failure-Driven Skill Discovery in Our System

#### Minimum Viable Implementation

```
1. After any failed task (QA rejection, evaluator low score):
   a. Collect the execution trace (what Scout/Coder/QA did)
   b. Collect the failure signal (what went wrong)
   c. Pass (trace, failure) to a "Proposer" prompt that:
      - Identifies the capability gap
      - Checks existing skills in agents/shared/skills/
      - Proposes a new SKILL.md or edit to existing one
   d. Have a "Skill-Builder" prompt materialize the proposal
   e. Test the new skill on a held-out validation task
   f. If it improves performance: merge to skills directory
   g. If not: log the failed proposal for future reference
```

#### What We'd Need
- **Failure collection:** Our QA agent already produces rejection reasons. We need to structure these as analyzable traces.
- **Held-out validation:** A set of "known-good" tasks we can re-run to test skill quality.
- **Skill format:** We already use agentskills.io format. EvoSkill outputs the same format.
- **Feedback history:** An append-only log of skill proposals + outcomes.

#### Key Insight for Our System
EvoSkill's biggest lesson: **don't try to optimize prompts or code directly. Optimize skills — reusable, structured, interpretable workflow documents.** This aligns perfectly with our existing SKILL.md infrastructure.

---

## 3. AgenticCyOps Five Defensive Principles for File-System-Based Agents

### Source: arXiv:2603.09134 (Full paper already deep-dived: `deep-dive-arxiv-2603-09134-agenticcyops.md`)

The five principles below are adapted specifically for **file-system-based agents** like our system (agents communicating via shared files, SIGNALS.md, workspace directories, etc.).

### The Five Principles

#### P1: Authorized Interface — "Only blessed tools, cryptographically verified"

**Original:** Signed manifests for tool provenance; admin-approved catalogs; runtime access policies; continuous semantic monitoring.

**For file-system agents:**
- **File manifest:** Each agent should have a declared list of files/directories it's authorized to read and write. Currently our agents can read/write anything. This is the equivalent of "tool sprawl" in the paper.
- **Implementation:** Add to each agent's config:
  ```yaml
  permissions:
    read: [agents/scout/*, agents/shared/SIGNALS.md, agents/shared/skills/*]
    write: [agents/scout/workspace/*, agents/scout/knowledge/*]
    deny: [agents/coder/*, agents/bob/*, .env, credentials/*]
  ```
- **Provenance:** When a file is modified, log WHO modified it and WHEN (append-only audit trail). Currently no provenance tracking on shared files.
- **Gap in our system:** Any agent can read/write any file. No manifests, no provenance. **HIGH priority fix.**

#### P2: Capability Scoping — "Least privilege per task, not per agent"

**Original:** Phase-scoped capabilities; Prompt Flow Integrity (PFI) tracking; continuous capability auditing.

**For file-system agents:**
- **Task-scoped file access:** When May delegates a task to Coder, the delegation should explicitly specify which files Coder can modify for THIS task. Not "Coder can always write to src/" but "for task #47, Coder can modify src/utils.py and tests/test_utils.py."
- **Prompt Flow Integrity for files:** Track the chain of causation — which instruction caused which file modification. If Coder modifies a file, we should be able to trace it back to the specific delegation from May.
- **Revoking capabilities:** After a task completes, write permissions should be revoked. Currently permissions are implicit and permanent.
- **Gap in our system:** Capabilities are role-level (Scout researches, Coder codes), not task-level. **MEDIUM priority.**

#### P3: Verified Execution — "Verify first, execute later"

**Original:** Action proposals verified by independent validators before execution; blockchain-anchored audit ledgers.

**For file-system agents:**
- **File write proposals:** Before an agent writes to a shared file (especially SIGNALS.md, any shared state), the write should be validated. Options:
  1. **Format validation:** Does the write conform to the expected schema? (e.g., SIGNALS.md has a specific format)
  2. **Content validation:** Does the content make sense? (lightweight LLM check or rule-based)
  3. **Dual-agent approval:** For destructive operations (delete, overwrite), require a second agent to confirm
- **Append-only shared files:** SIGNALS.md should be append-only. No agent should be able to delete or modify existing entries. This is the file-system equivalent of "non-repudiation."
- **What this looks like practically:**
  ```
  Agent wants to write to SIGNALS.md
  → Agent proposes the write (stores in staging area)
  → Validation check runs (format + content)
  → If valid: append to SIGNALS.md
  → If invalid: reject with reason, log the attempt
  ```
- **Gap in our system:** No verification on any file write. Any agent can overwrite any shared file at any time. **HIGH priority for shared state files.**

#### P4: Memory Integrity & Synchronization — "Validate before storage, version everything"

**Original:** Write-boundary filtering; consensus-validated retrieval; explicit serialization/versioning; append-only ledgers.

**For file-system agents:**
- **Write-boundary filtering:** Before any write to the knowledge base (agents/scout/knowledge/, agents/shared/), validate:
  1. Is the content well-formed? (valid Markdown, expected structure)
  2. Does it contradict existing knowledge? (lightweight consistency check)
  3. Is it within the agent's domain? (Scout shouldn't be writing code files; Coder shouldn't be writing research)
- **Versioning:** Use git or a lightweight versioning system. Every knowledge file modification should be a trackable version. Currently our files are just overwritten with no history.
- **Concurrent access:** If two agents try to modify the same file simultaneously, we need merge/conflict resolution. Currently first-writer-wins (or last-writer-wins depending on timing).
- **Consensus-validated retrieval:** When an agent reads shared state (SIGNALS.md), it should verify the state is consistent. If SIGNALS.md has been modified since last read, the agent should be notified.
- **Gap in our system:** No write validation, no versioning, no concurrent access handling. **HIGH priority for knowledge files.**

#### P5: Access Control with Data Isolation — "Hierarchical memory, phase-partitioned access"

**Original:** Private → shared memory tiers; dynamic bipartite access graphs; phase-partitioned access; context-aware transformations (redaction).

**For file-system agents:**
- **Memory hierarchy for our system:**
  ```
  PRIVATE:    agents/scout/workspace/     (only Scout reads/writes)
  TEAM:       agents/shared/SIGNALS.md    (all agents read, controlled write)
  TEAM:       agents/shared/skills/       (all agents read, admin write)
  PUBLIC:     final outputs               (read-only after publication)
  ```
- **Phase-partitioned access:** During a research phase, Scout has write access to research files but not code files. During a coding phase, Coder has write access to code files but not research files. During review, QA has read access to everything but write access only to review documents.
- **Context-aware transformations:** When Scout's research is shared with Coder, sensitive metadata (API keys found in research, security vulnerabilities in external code) should be redacted or flagged. Currently everything is shared raw.
- **The key insight from the paper:** In a flat system where all agents share all files with full read/write, the trust boundary count explodes. For N agents with M shared files: N×M read boundaries + N×M write boundaries. With isolation:
  - 4 agents, 50 shared files: **flat = 400 trust boundaries**
  - With P5 isolation (private/team/public tiers): **~120 trust boundaries** (70% reduction)
- **Gap in our system:** Completely flat. All agents can access all files. No isolation. **MEDIUM priority (architectural change).**

### Summary: Priority Actions for Our System

| Priority | Principle | Action | Effort |
|----------|-----------|--------|--------|
| **HIGH** | P1 | Add file permission manifests per agent | Low — config change |
| **HIGH** | P3 | Add validation for writes to shared files (SIGNALS.md) | Medium — needs validation logic |
| **HIGH** | P4 | Add git-based versioning for knowledge files | Low — git is already available |
| **MEDIUM** | P2 | Task-scoped file permissions in delegation | Medium — needs delegation format change |
| **MEDIUM** | P5 | Enforce directory-level isolation | Medium — needs convention + enforcement |
| **LOW** | P3 | Dual-agent approval for destructive operations | High — needs inter-agent protocol |

### The Paper's Core Insight Applied to Us

> "Despite spanning three abstraction layers, all documented MAS attack vectors consistently reduce to two exploitable integration surfaces: **tool orchestration** and **memory management**."

For file-system agents, this translates to:
- **Tool orchestration = which commands/operations each agent can execute** (bash, file I/O, web access)
- **Memory management = which files each agent can read/write and how shared state is synchronized**

Our system's biggest security gap is in memory management: completely flat file access with no validation, no versioning, no isolation. The tool orchestration gap (all agents can run bash) is less critical because our agents operate in a controlled environment, but should be addressed for any production deployment.

---

## Cross-References Between the Three Topics

| Connection | Detail |
|------------|--------|
| **EvoSkill ↔ MetaClaw** | Both implement failure-driven improvement. EvoSkill evolves skills (frozen model); MetaClaw fine-tunes the model (LoRA). Complementary approaches — use EvoSkill for skill discovery, MetaClaw for model adaptation. |
| **EvoSkill ↔ AgenticCyOps P2** | EvoSkill's Skill-Builder is the only agent with write access to the skills directory. This IS principle P2 (capability scoping). The architecture enforces least-privilege by design. |
| **MetaClaw ↔ AgenticCyOps P4** | MetaClaw's `memory_data/` directory stores conversation data for training. P4 (Memory Integrity) applies: this training data must be validated before use, or adversarial conversations could poison the model. |
| **EvoSkill skills ↔ AgenticCyOps P1** | EvoSkill generates SKILL.md files. P1 (Authorized Interface) requires signed manifests. Currently neither EvoSkill nor our system verify the provenance of skill files — a generated skill could contain adversarial instructions (ClawHavoc attack, arXiv:2602.20867). |

---

*Filed: 2026-03-26*
*Scout session: Bob's research request (from todo 2026-03-12T15:15)*
*References: arXiv:2603.02766 (EvoSkill), arXiv:2603.09134 (AgenticCyOps), github.com/aiming-lab/MetaClaw, github.com/sentient-agi/EvoSkill*
