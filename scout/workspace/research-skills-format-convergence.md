# Agent Skills Format Convergence Analysis

**Date:** 2026-03-08  
**Task:** Compare .claude/skills/, HuggingFace skills, OpenCode skills. Is a universal format emerging?

## TL;DR — Yes, Decisively

A universal agent-skills format **has emerged**. It is the **agentskills.io standard**: a folder containing a `SKILL.md` file with YAML frontmatter (`name` + `description`) and a markdown body, plus optional bundled resources (`scripts/`, `references/`, `assets/`). This format is now adopted by **15+ tools** across every major vendor: Anthropic (Claude Code), OpenAI (Codex), Google DeepMind (Gemini CLI), HuggingFace, Cursor, JetBrains Junie, OpenHands, Letta, Goose, Amp, OpenCode, Firebender, Mux, and more. The convergence is not partial — it's near-total.

---

## 1. The Three Formats Compared

### 1a. `.claude/skills/` (Anthropic — the Origin)

**Source:** `anthropics/skills` (79,615⭐), `agentskills.io` spec  
**Canonical path:** `.claude/skills/<skill-name>/SKILL.md`

**Format:**
```
skill-name/
├── SKILL.md              ← required
│   ├── YAML frontmatter  ← required: `name`, `description`
│   └── Markdown body     ← instructions, workflows, guidance
├── scripts/              ← optional: executable code (Python/Bash)
├── references/           ← optional: docs loaded into context on demand
└── assets/               ← optional: files used in output (templates, images)
```

**Frontmatter (minimal spec):**
```yaml
---
name: skill-name
description: What this skill does and when to trigger it
---
```

**Key design principles:**
- **Progressive disclosure:** Only `name`+`description` are always in context (~100 tokens). Body loads when triggered. References load when needed by agent.
- **Lazy loading for agent cognition** — the `description` field is the *only* triggering mechanism
- **No other frontmatter fields in the base spec** (just `name` + `description`)
- Skills packaged as `.skill` files (zip with .skill extension) for distribution

**Real examples from our workspace:**
- `skill-creator/SKILL.md` — meta-skill teaching how to create skills
- `component-refactoring/SKILL.md` — React refactoring patterns
- `postgres/SKILL.md` — PlanetScale Postgres expertise with 20+ reference files
- `e2e-tester/SKILL.md` — Playwright E2E testing patterns

### 1b. HuggingFace Skills

**Source:** `huggingface/skills` (7,571⭐)  
**Install:** `kernels skills add cuda-kernels --claude` → drops into `.claude/skills/`

**Format:** **Identical to agentskills.io.** SKILL.md with YAML frontmatter (`name` + `description`) + markdown body. Explicitly documented as "Interoperable with all major coding agent tools: OpenAI Codex, Anthropic's Claude Code, Google DeepMind's Gemini CLI, and Cursor."

**Focus areas:** AI/ML domain skills — CUDA kernel writing, LLM training, model evaluation, dataset creation. The CUDA kernels skill that drove their 2,174⭐/week spike is ~550 tokens of structured guidance + GPU optimization references.

**Key difference from base Anthropic spec:** None at the format level. HuggingFace adopted the agentskills.io standard wholesale. The differentiation is in *content* (AI/ML domain expertise), not format.

### 1c. OpenCode Skills

**Source:** OpenCode (open-source Claude Code alternative), referenced across multiple ecosystem repos  
**Install paths:** Same `.claude/skills/` directory or equivalent local path

**Format:** **Identical to agentskills.io.** OpenCode is listed as one of the 15+ tools that adopted the standard. The `obra/superpowers` project (61k⭐) documents install paths for Claude Code, Cursor, Codex, and OpenCode — all using the same SKILL.md format. OpenCode reads the same skill files from the same directory structure.

**Key nuance:** OpenCode's ecosystem has a significant Chinese-language community building skills and tooling around it (Agent-Reach 6,787⭐, Star-Office-UI 3,075⭐, openclaw-agents 179⭐). The skills follow the same format but content is often bilingual or Chinese-first. No format divergence.

---

## 2. The Convergence Map

| Dimension | Claude Code | HuggingFace | OpenCode | Google WS CLI | Binance | Codex | Gemini CLI | Cursor |
|-----------|:-----------:|:-----------:|:--------:|:-------------:|:-------:|:-----:|:----------:|:------:|
| SKILL.md file | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| YAML frontmatter | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `name` field | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `description` field | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Markdown body | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `scripts/` dir | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| `references/` dir | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| `assets/` dir | ✅ | ✅ | ✅ | — | — | ✅ | ✅ | ✅ |
| Extended frontmatter | ❌ base | ❌ base | ❌ base | ✅ superset | ❌ base | ❌ base | ❌ base | ❌ base |

**Google Workspace CLI superset fields:** `version`, `metadata.openclaw` (with `category`, `requires.bins`, `requires.skills`, `cliHelp`). Backward compatible — any tool reading only `name`+`description` ignores extras.

---

## 3. Why Convergence Happened — Structural Reasons

1. **Anthropic defined the spec early and made it open.** `agentskills.io` is vendor-neutral. No lock-in. Apache 2.0.

2. **The format is trivially simple.** YAML frontmatter + markdown = zero new tooling required. Any LLM can read it. Any human can write it. No schema validation needed beyond "does it have `name` and `description`?"

3. **Progressive disclosure solves the real problem.** The killer feature isn't the file format — it's the lazy loading architecture. Agent sees 100 tokens of metadata × N skills; loads full content only when triggered. This makes skills scalable (100+ skills without context bloat). Every tool wants this.

4. **Network effects are self-reinforcing.** Once anthropics/skills (79k⭐) + huggingface/skills (7.5k⭐) + Agent-Skills-for-Context-Engineering (12.7k⭐) + wshobson/agents (29.8k⭐) all use the same format, any new tool *must* be compatible to access the existing library. Binance, Google Workspace CLI, and obra/superpowers all adopted it for this reason.

5. **The alternative (MCP tools) is complementary, not competing.** MCP defines tool *execution* (function calling + structured I/O). Skills define *knowledge + workflow guidance* (what to do, not how to call). They occupy different layers: skills tell agents *when and why* to use tools; MCP tools *execute* the actions.

---

## 4. Variations and Extensions (Non-Breaking)

While the base format is converged, several extensions have emerged — all backward compatible:

### 4a. Extended Frontmatter (Superset Pattern)
- **Google Workspace CLI:** `version`, `metadata.openclaw.category`, `metadata.openclaw.requires.skills/bins`
- **e2e-tester skill (ralph-loop):** `metadata.scope`, `metadata.auto_invoke`, `allowed-tools`
- **postgres skill (PlanetScale):** `license`, `metadata.author`, `metadata.version`

**Pattern:** Extensions use additional YAML fields. Tools that don't understand them ignore them. No breaking change.

### 4b. AGENTS.md vs SKILL.md
- **AGENTS.md** = codebase-level instructions ("how to work in this repo") — cf. vitest-best-practices uses AGENTS.md
- **SKILL.md** = capability-level instructions ("how to do this task")
- These are **complementary**, not competing. A repo has AGENTS.md for codebase conventions + skills for domain capabilities.

### 4c. Persona/Recipe/Composition (GWS CLI Pattern)
Google Workspace CLI introduced a 4-tier skill taxonomy:
1. **Services** (18 core API skills)
2. **Helpers** (17 shortcut commands)  
3. **Personas** (10 role bundles — compose lower skills via `metadata.requires.skills`)
4. **Recipes** (50+ multi-step workflows)

This composition model (`requires.skills`) is the most significant format extension — it enables skill dependency graphs. Not yet standardized across other tools, but likely to become standard as skill libraries grow.

---

## 5. The Security Gap

The convergence is real but the security layer is missing:

- **ClawHavoc (arXiv:2602.20867):** ~1,200 malicious skills infiltrated a major agent marketplace. Skills used prompt injection payloads to exfiltrate API keys, crypto wallets, browser credentials.
- **arXiv:2602.12430 (Agent Skills Survey):** 26.1% of community-contributed skills have vulnerabilities. Proposes 4-tier Skill Trust & Lifecycle Governance Framework.
- **No signature verification** in the current spec. No provenance chain. No sandboxed execution model.
- **The format's simplicity is both strength and weakness** — anyone can create a skill, including adversaries.

---

## 6. Assessment: Where This Stands

| Question | Answer |
|----------|--------|
| Is a universal format emerging? | **Already emerged.** agentskills.io is the standard. |
| Is it adopted cross-vendor? | **Yes.** All 5 major vendors (Anthropic, OpenAI, Google, HuggingFace, JetBrains) + 10+ indie tools. |
| Is it stable? | **Yes.** Base spec (`name`+`description` frontmatter + markdown body) has been stable since inception. Extensions are additive. |
| Is it sufficient? | **Mostly.** Missing: composition/dependency model, trust/provenance, versioning. All solvable as backward-compatible extensions. |
| What's the analogy? | **package.json moment** — the format is settled, the ecosystem (registries, security, composition) is still forming. |

---

## 7. Implications for Our System

1. **Our agents already use the format.** The ralph-loop skills (skill-creator, component-refactoring, postgres, e2e-tester, vitest-best-practices) follow the SKILL.md pattern. Bob's research (research-anthropic-skills.md) correctly identified progressive disclosure as the key pattern to adopt.

2. **We can consume the entire ecosystem.** Any skill from anthropics/skills (79k⭐), huggingface/skills (7.5k⭐), wshobson/agents (29.8k⭐), Binance Skills Hub, Google WS CLI skills, etc. can be dropped into our agents' skill directories and loaded.

3. **The missing pieces for us:** (a) Trust-tiering — first-party vs community vs unknown skills need different permission levels. (b) Skill composition — our agents need the `requires.skills` pattern for building higher-order capabilities. (c) Automated skill evaluation — per the Agent Skills Survey, we should audit community skills before deployment.

4. **Format-level action items:** None. The format is settled. Our energy should go to the **ecosystem layer** — curation, security, composition — not format experimentation.
