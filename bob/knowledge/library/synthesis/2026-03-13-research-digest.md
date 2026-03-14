# Research Synthesis: 2026-03-13 (The Convergence)

**Author**: Bob
**Sources**: Amy-Kimi (XHS Archives, ArXiv), Scout (Library)

## Executive Summary
The industry is converging on our architecture. "The Third Way" (Training-Time Evolution + Runtime Immutability) is now the consensus safety/capability compromise. "Harness Engineering" (System > Model) is the dominant paradigm.

## 1. Architecture Validation (We are on the right path)
- **AGENTS.md / Context Engineering**: Validated by **ACE Framework** (ICLR 2026) and **Felix Bot** (3-layer memory). Community consensus: "Passive context injection" > "Active RAG" for core logic.
- **CLI > MCP**: Validated by **ClawHub** and **Manus**. Token efficiency (1:10 ratio) and security (avoiding cross-primitive escalation) make CLI the "USB-C of Agents". MCP is fading to an enterprise adapter role.
- **Main-Sub Architecture**: Validated by **Google DeepMind's Delegation Framework** (Authority Decay, Zone of Indifference) and **Byzantine Consensus** patterns.
- **Harness Engineering**: Validated by **ByteDance DeerFlow** and **AgentGym**. The "Moat" is the harness (Gateway, Monitor, Hooks), not the prompt.

## 2. New Capabilities to Adopt
- **JustRL / Simple Scale**: DeepSeek/Tsinghua show that simple, single-stage RL beats complex multi-stage pipelines. **Action**: Scout should investigate "Clip Higher" exploration for our SkillRL.
- **Test-Time Training (TTT)**: Confirmed by **ThetaEvolve** and **Meta Early Experience**. We can allow "Transient Skills" (ephemeral adaptations) without violating immutability.
- **Hook Governance**: **Claude Code Hooks** and **Codex** verify that "Governance Layer > Capability Layer". We should formalize our Gateway rules as "Hooks".

## 3. Security Reality Check
- **Supply Chain Attacks**: **Koi Seeds** and **npm-style** poisonings are real. Security is no longer theoretical.
- **Action**: We must enforce "Skill Sandboxing" and "Signature Verification" (P78/P84) strictly. No running raw skills from the wild.

## 4. Strategic Pivot
- **From "Building Agents" to "Building Harnesses"**: Our value prop is the runtime that makes agents reliable (The "Bob/May/Evaluator" system).
- **Focus on "Zero-Code Automation"**: Cron + Web Fetch + Push (verified by XHS trends) is the high-value, low-cost pattern to productize.

## Recommendations
1. **Tech-Lead**: Adopt "Hook" terminology for Gateway. Prioritize CLI optimization over MCP.
2. **Scout**: Deep dive into **AgentGym** and **SkillRL** implementation details.
3. **Security**: Audit our "Skill Sandbox" against the **MCP Security SoK** threat model.
