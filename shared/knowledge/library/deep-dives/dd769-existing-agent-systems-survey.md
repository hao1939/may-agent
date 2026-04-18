# DD#769: Survey of Existing Agent Systems — Mechanisms for Tool Usage, Memory, Coordination, and Behavior Testing

**Date:** 2026-04-18
**Source:** Project 2 research — OpenClaw, Claude Skills (Pi), Hermes Function-Calling, Evo Harness
**Relevance:** ★★★★★ — Direct input for Project 2 (Learn from Existing Agent Systems)

---

## 1. Claude Agent Skills (formerly "Pi Skills")

**Source:** [Anthropic Engineering Blog](https://www.anthropic.com/engineering/equipping-agents-for-the-real-world-with-agent-skills), [GitHub cookbook](https://github.com/anthropics/claude-cookbooks/tree/main/skills), [agentskills.io](https://agentskills.io)

### Tool Usage Enforcement
- **Progressive disclosure architecture** — 3-level loading: (1) name+description metadata preloaded into system prompt at startup, (2) full SKILL.md loaded when Claude deems relevant, (3) linked files loaded on-demand
- Skills are **directories** containing SKILL.md (YAML frontmatter + instructions) plus optional bundled scripts/resources
- Code execution is **deterministic** — skills bundle Python scripts that Claude executes via tool calls (e.g., PDF form field extraction), not via token generation
- Key insight: **context is effectively unbounded** because agents with filesystem access don't need to load entire skills into context window

### Agent Memory
- No explicit memory mechanism in Skills — memory is the filesystem itself
- Skills are persistent across sessions (installed as directories)
- The agent "remembers" capabilities through the pre-loaded metadata index

### Multi-Agent Coordination
- Skills are designed as **portable packages** — published as an open standard (agentskills.io) for cross-platform portability
- No explicit multi-agent coordination protocol — Skills are single-agent capability extensions
- However, the composable structure means different agents could share a skill library

### Behavior Testing
- **Evaluation-first development**: "Start with evaluation — identify specific gaps by running agents on representative tasks"
- **Iterative with Claude**: Ask Claude to self-reflect on what went wrong and capture successful approaches into skills
- Security model: audit skills from untrusted sources, check for data exfiltration instructions

### Key Patterns for Us
1. **Progressive disclosure is the core mechanism** — maps directly to our skill loading. We already do something similar with CLAUDE.md → skill files, but Skills formalizes the 3-tier loading
2. **"Expertise packages" framing** — skills as onboarding guides, not code libraries. Procedural knowledge, not just capabilities
3. **Code as deterministic tools** — scripts bundled alongside instructions, agent decides when to run them vs. read them as reference
4. **Unbounded context via filesystem** — the skill directory IS the context, loaded incrementally. Our skills are flat files; theirs are directories with linked resources

---

## 2. Hermes Function-Calling (NousResearch)

**Source:** [GitHub](https://github.com/NousResearch/Hermes-Function-Calling) (1.3k stars, 170 forks)

### Tool Usage Enforcement
- **Structured prompt format** enforces tool use via ChatML template with XML-delimited tool schemas
- Tools provided in `<tools>` XML tags in system prompt; responses use `<tool_call>` XML tags
- **Schema-driven**: tools defined as OpenAI-compatible JSON schemas, auto-generated from Python functions with `@tool` decorator
- **Pydantic validation** for both function call arguments and JSON mode outputs — structural type enforcement, not just prompting
- Hermes-3 adds **GOAP (Goal Oriented Action Planning)** via `<scratch_pad>` — structured reasoning before tool calls with Goal/Actions/Observation blocks
- **Recursive function calling** with configurable `max_depth` (default 5) — agent can chain tool calls

### Agent Memory
- No persistent memory system — stateless function calling
- `<scratch_pad>` in Hermes-3 provides within-turn working memory (plan, reflect, observe)
- Tool results returned as `<tool_response>` blocks, accumulated in conversation context

### Multi-Agent Coordination
- Single-agent system — no coordination mechanisms
- The tool infrastructure is designed for one model ↔ many tools, not agent ↔ agent

### Behavior Testing
- Includes `template_tests/` directory and `validator.py` for schema validation
- JSON schema validation ensures tool call structural correctness
- No behavioral testing framework — testing is at the schema/format level

### Key Patterns for Us
1. **Schema-as-enforcement** — Pydantic models + JSON schema validation ensure structurally correct tool calls. We could enforce tool output schemas similarly
2. **GOAP scratch pad** — structured reasoning framework before action. Goal → Actions → Observation cycle. Maps to our "plan-once-amend" skill but as a prompt format rather than a skill instruction
3. **Recursive depth limits** — configurable max_depth prevents infinite tool-call loops. Simple but effective safety mechanism
4. **XML delimiters for tool boundaries** — clear structural separation between reasoning and tool invocation

---

## 3. OpenClaw

**Status: NOT FOUND** — The task specified OpenClaw at `/home/hao/openclaw/` but that path doesn't exist in this environment. GitHub search for "openclaw" returns no relevant multi-agent/plugin system repositories. This appears to be a private/local project.

**What was searched:**
- GitHub repository search: "openclaw", "openclaw agent", "openclaw multi-agent" — no relevant matches
- The path `/home/hao/openclaw/` is not accessible from this environment

**Recommendation:** Hao should either make the OpenClaw source available at a path within `/app/`, or provide a brief description of its architecture for Bob to work from. Key questions to answer:
- Plugin system: how are plugins registered, discovered, loaded?
- Channels: what is the communication primitive? Pub/sub? Point-to-point?
- Multi-agent coordination: how do agents discover and communicate with each other?
- Tool enforcement: how is tool usage enforced vs. suggested?

---

## 4. Evo Harness

**Status: NOT FOUND** — No specific "evo harness" agent evaluation system found on GitHub or in academic literature.

**What was searched:**
- GitHub: "evo harness", "evo harness agent evaluation" — only result was FishSerrie/skill-evolver (tangentially related: autonomous skill evolution engine, 1 star)
- No arXiv papers specifically named "evo harness"

**Possibly related systems (for follow-up):**
- **lm-evaluation-harness** (EleutherAI) — the standard LLM evaluation harness, but not agent-specific
- **Agent-CoEvo** (2604.04580) — co-evolutionary agent evaluation (already in our papers.md)
- **skill-evolver** — fuses AutoResearch's self-driving loop with GT-based evaluation and "Meta-Harness" trace analysis

**Recommendation:** Hao should clarify what "evo harness" refers to — could be a private project, an internal name, or a system we need more specific search terms for.

---

## Cross-System Synthesis

### Mechanisms Comparison

| Mechanism | Claude Skills | Hermes FC | OpenClaw | Evo Harness |
|---|---|---|---|---|
| **Tool enforcement** | Progressive disclosure (3-tier) | Schema + XML delimiters + Pydantic | Unknown | Unknown |
| **Agent memory** | Filesystem (skill directories) | None (stateless) | Unknown | Unknown |
| **Multi-agent coord** | Portable skill packages | None (single-agent) | Unknown | Unknown |
| **Behavior testing** | Evaluation-first + self-reflection | Schema validation only | Unknown | Unknown |

### Patterns Worth Testing in Our System

1. **Progressive disclosure for skills** (from Claude Skills): Instead of loading full skill files, provide metadata index → load on-demand. Could reduce context bloat.
   - **Experiment idea:** Compare current full-skill-loading vs. metadata-index-then-load approach. Measure: token usage, task success rate, skill adoption rate.

2. **Schema enforcement for tool outputs** (from Hermes): Add Pydantic-style validation to tool call outputs. Currently we have no structural validation of what agents produce.
   - **Experiment idea:** Add JSON schema validation to finish() calls. Measure: malformed output rate before/after.

3. **GOAP-style structured reasoning** (from Hermes): Force Goal → Actions → Observation cycle before tool calls.
   - **Experiment idea:** Compare plan-once-amend skill (our current approach) vs. GOAP prompt template. Measure: tool call efficiency, error recovery rate.

4. **Skill directories vs. flat files** (from Claude Skills): Bundle instructions + scripts + resources in directories instead of single .md files.
   - **Experiment idea:** Convert one skill to directory format with linked resources. Measure: skill compliance rate.

### What's Missing from ALL Systems

- **Cross-agent memory** — none of these systems have agents that share learned knowledge across sessions or between agents. Our knowledge/hypotheses pipeline (Scout→Bob→Tech-lead) is actually more advanced.
- **Adversarial verification** — no system has built-in adversarial checks between agents. Our AEGIS-inspired patterns (DD#698) go beyond what any of these offer.
- **Behavioral experiment infrastructure** — no system has Bob-style experiment→verify→adopt loops.

---

## Recommendations for Bob

1. **Immediate**: Design EXP-108 testing progressive disclosure for our skill system (Claude Skills pattern)
2. **Medium-term**: Add schema validation to tool outputs (Hermes pattern)  
3. **Long-term**: Convert skills to directory format with bundled code (Claude Skills pattern)
4. **Blocked**: OpenClaw and Evo Harness studies require Hao to provide access or clarification

---

*Session: s_1776502867172_56 | Counters: DD#769, Session#794*
