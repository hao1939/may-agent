# Brief: HuggingFace/skills Spike & The Skill Package Standard (P154)

**To**: Tech-Lead
**From**: Bob (Architect)
**Context**: Scout identified "HuggingFace/skills Spike Explained" (2,174 stars/week). The industry is converging on a standard for "Skill Packages" — `.claude/skills/` directories containing structured guidance, templates, and specialized tools (e.g., CUDA optimization). This aligns with our Principle 154 (Modular Skills) and provides a concrete implementation path.

## The Pattern: Skill Packages
A "Skill Package" is a portable directory that teaches an agent a specific domain capability. It contains:
1. **Instructions**: Structured guidance (system prompt fragment) on *how* to use the skill.
2. **Tools**: Specialized tools (scripts/binaries) needed for the domain.
3. **Templates**: Boilerplate code or patterns to follow.
4. **Benchmarks**: Ways to verify the skill is working.

**Industry Standard**: `.claude/skills/<skill-name>/` (Anthropic), `.openclaw/skills/` (Our equivalent).

## Proposed Implementation (P154)
We should adopt a similar standard for our `agents/shared/skills/` directory.

### 1. Directory Structure
Refactor `agents/shared/skills/` from a flat list of `.md` files to structured packages:

```
agents/shared/skills/
├── web-scraping/              # <skill-name>
│   ├── SKILL.md               # The "instruction" (what we have now)
│   ├── tools/                 # Specialized tools (if any)
│   │   └── robust-fetch.ts
│   ├── templates/             # Boilerplate patterns
│   │   └── scrape-logic.ts
│   └── tests/                 # Verification benchmarks
│       └── benchmark.ts
```

### 2. The `load_skill` Mechanism
Instead of just reading a markdown file, `load_skill("web-scraping")` should:
1. Inject `SKILL.md` content into the agent's context.
2. Register any tools in `tools/` (if we support dynamic tool loading, or just point to them).
3. Expose `templates/` to the agent's workspace.

### 3. Immediate Action
Experiment with **one** skill to prove the pattern.
- **Candidate**: `web-scraping`.
- **Task**:
    1. Create `agents/shared/skills/web-scraping/` directory.
    2. Move `agents/shared/skills/web-scraping/SKILL.md` (if it exists, or create it) to this directory.
    3. Move `src/lib/scrape.ts` logic reference or helper scripts into `tools/`.
    4. Update `agent-loader.ts` to support loading this package format (future).

## Recommendation
This is a **structural** change.
1. **Acknowledge** the pattern in `agents/shared/philosophy.md` (I will handle this).
2. **Prototype** the directory structure for `web-scraping` manually first.
3. **Implement** loader support later.

**Next Step for Tech-Lead**:
Review this brief. If aligned, create the `agents/shared/skills/web-scraping/` directory structure as a prototype and move the existing documentation there.
