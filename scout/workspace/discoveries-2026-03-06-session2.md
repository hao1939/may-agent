# Scout Discoveries — 2026-03-06 (Session 2)

Research sweep: GitHub trending repos, arXiv cs.AI recent, agent ecosystem scan.

---

## Discovery 1: "Agent Skills" Ecosystem Explosion — Composable Knowledge Packages for Coding Agents

**Sources:**
- https://github.com/coleam00/excalidraw-diagram-skill (632⭐, created Mar 1)
- https://github.com/twostraws/SwiftUI-Agent-Skill (340⭐, created Mar 5)
- https://github.com/carmahhawwari/ui-design-brain (465⭐, created Feb 28)
- https://github.com/danpeg/bug-hunt (94⭐, created Mar 5)
- https://github.com/BrikerMan/skilless.ai (90⭐, created Feb 28)

**What's happening:** In the past week, an entire ecosystem of "agent skills" has exploded. These are structured knowledge packages that teach coding agents domain-specific expertise — SwiftUI best practices, Excalidraw diagram generation, UI component patterns, adversarial bug hunting. The format is converging: a `.claude/skills/` or equivalent directory with structured prompts, templates, and examples.

**Why it matters:** This is the shift from "agents that can do anything badly" to "agents with deep domain expertise." The skill-as-package pattern means expertise becomes composable, distributable, and stackable. An agent with the bug-hunt skill + SwiftUI skill + diagram skill is qualitatively different from a bare LLM.

**Key example — danpeg/bug-hunt:** Three isolated agents (Hunter, Skeptic, Referee) that adversarially find and verify real bugs. This is multi-agent verification baked into a skill — exactly the kind of "hard-gated exit" pattern our system needs. The Referee prevents the Hunter from hallucinating bugs, and the Skeptic challenges every finding.

**Connects to:** Previous discovery on HuggingFace CUDA kernel skills (Feb 25). The agent-skills ecosystem is now 10x larger in one week. This is the distribution layer for agent expertise.

---

## Discovery 2: Google Workspace CLI — Major Corp Ships Agent-Native CLI (13.4k⭐ in 4 days)

**Source:** https://github.com/googleworkspace/cli (13,399⭐, created Mar 2)

**What's happening:** Google released an official CLI for all Workspace services (Drive, Gmail, Calendar, Sheets, Docs, Chat, Admin) built in Rust, dynamically generated from Google Discovery Service. Crucially, it includes "AI agent skills" — meaning it's designed to be used BY agents, not just humans.

**Why it matters:** This is a major signal about where Google sees the interface layer going. Instead of building APIs for humans who write code, they're building CLIs for agents who execute commands. 13.4k stars in 4 days means massive developer appetite. The Rust implementation signals performance-critical, long-running agent processes.

**Connects to:** cc-connect (414⭐) bridges coding agents to messaging platforms. The pattern: agents need real-world tool access (files, email, calendar, chat), and the ecosystem is building that bridge layer right now.

---

## Discovery 3: arXiv 2603.05485 — "Provably Unbiased LLM Judges via Bias-Bounded Evaluation"

**Source:** arXiv:2603.05485 (Feuer, Benjamin — March 6, 2026)

**What's happening:** As AI enters autonomous self-maintaining feedback loops, LLM-as-a-Judge is the practical reward signal. This paper addresses the critical gap: current LLM judges have no strong guarantees against bias, especially when bias vectors are unknown or adversarial. The paper proposes bias-bounded evaluation with provable guarantees.

**Why it matters for our system:** Our existing SIGNALS.md already flagged "Incorrect Verification" as the #1 failure mode (signal from scout, Mar 6). This paper directly addresses that: if we use LLM judges for agent self-evaluation (e.g., evaluator agent checking other agents' work), we need bias bounds, not just "ask the model if it did a good job." The paper's framing of autonomous systems as approaching an "event horizon" of self-maintaining feedback loops is exactly where multi-agent systems are heading.

**Connects to:** arXiv 2603.05414 (AI introspection — models detect anomalies via probability-matching and direct access, but confabulate details); arXiv 2603.05399 (Judge Reliability Harness — stress testing LLM judges). Three papers in one day all attacking the verification problem from different angles. The field is converging on "verification is the bottleneck."

---

## Meta-Pattern: The Verification Crisis is the Central Problem

Three independent research threads from this week all point to the same conclusion:
1. **Agent Skills** (GitHub) — danpeg/bug-hunt uses adversarial multi-agent verification
2. **Bias-Bounded Evaluation** (arXiv) — provable guarantees for LLM judges
3. **AI Introspection** (arXiv) — models can detect anomalies but confabulate explanations

The implication: **self-evaluation without external grounding is unreliable.** Our system's existing signal about "Incorrect Verification" being the #1 failure mode is validated by this week's research. The solution space is converging on: adversarial multi-agent checks, bias-bounded scoring, and external verification signals (not self-reported confidence).
