# DD#584 — SkillX: Automatic Plug-and-Play Skill Knowledge Base Construction

**Source:** Wang et al. (ZJU NLP), arXiv:2604.04804, 6 Apr 2026
**Repo:** https://github.com/zjunlp/SkillX (forthcoming)
**Rating:** ★★★★½ LANDMARK — Formalizes hierarchical skill extraction for cross-agent transfer

## Key Innovation

SkillX is a **fully automated pipeline** for constructing reusable skill knowledge bases from agent execution trajectories. Unlike previous self-evolving paradigms where agents learn in isolation (repeatedly rediscovering similar behaviors), SkillX creates a **transferable skill library** that improves weaker agents when plugged in.

## Architecture: Three Synergistic Innovations

### 1. Multi-Level Skills Design
Distills raw trajectories into a **three-tiered hierarchy**:
- **Strategic Plans** — high-level task decomposition strategies
- **Functional Skills** — composable sub-task capabilities
- **Atomic Skills** — minimal executable actions

This hierarchy mirrors the strategic→tactical→operational layering we see in constitutional meta-engineering (CR#302) and the Kaiju executive kernel (DD#564).

### 2. Iterative Skills Refinement
Skills are automatically revised based on execution feedback. The system:
- Tests skills against real environments
- Identifies failure modes
- Revises skill definitions to improve reliability
- Continuously improves library quality through feedback loops

### 3. Exploratory Skills Expansion
Proactively generates and validates **novel skills** to expand coverage beyond seed training data. This is the key differentiator — not just extracting existing skills, but synthesizing new ones.

## Evaluation
- Backbone: GLM-4.6 (strong) builds the skill library
- Transfer targets: weaker base agents on AppWorld, BFCL-v3, τ²-Bench
- Result: **consistent improvement in task success AND execution efficiency** when SkillKB plugged into weaker agents
- Long-horizon, user-interactive benchmarks — hardest evaluation setting

## Why This Matters for Us

### 1. SKILL.md Convergence Signal #7
This is now the **seventh independent signal** in the skill/knowledge-base convergence:
1. DD#537 (AGENTS.md) — agent instruction standards
2. DD#558 (oh-my-claudecode) — community skill packs
3. DD#560 (nuwa-skill) — automated skill generation
4. DD#566 (Agent HTTP Behavioral Signatures) — skill.md standard
5. DD#577 (Graphify) — code-to-knowledge-graph skills
6. DD#576 (Anti-Distill) — adversarial skill retention
7. **DD#584 (SkillX)** — automated hierarchical skill KB construction

SkillX is the most rigorous **academic treatment** of what the open-source ecosystem is building ad hoc. The three-tiered hierarchy (strategic/functional/atomic) provides the taxonomic framework the ecosystem needs.

### 2. Cross-Agent Transfer Is Real
The key empirical finding: skills built by a strong agent (GLM-4.6) **transfer to weaker agents** with measurable improvement. This validates the thesis that skills are agent-agnostic knowledge representations, not model-specific behaviors.

### 3. Exploratory Expansion
The proactive skill generation goes beyond pure extraction. This is the difference between a library and an evolving organism — the system doesn't just codify what happened, it hypothesizes what *should* work and validates it.

### 4. Missing Layer: Knowledge Provenance
SkillX doesn't address adversarial skill manipulation (DD#576 Anti-Distill). A skill library built by automated extraction could be poisoned, and SkillX has no provenance or integrity verification layer. This reinforces the need for the L0 knowledge provenance layer identified in CR#298.

## Connections
- **DD#537** (AGENTS.md) — SkillX's strategic plans ≈ AGENTS.md's instruction hierarchy
- **DD#560** (nuwa-skill) — Both automate skill generation, but SkillX adds hierarchical structuring
- **DD#576** (Anti-Distill) — Missing provenance/integrity layer in SkillX
- **DD#577** (Graphify) — Both extract structured knowledge from trajectories; complementary approaches
- **CR#302** (Constitutional Meta-Engineering) — SkillX's three-tier hierarchy mirrors constitutional stratification
- **DD#575** (AutoAgent) — Both automate agent improvement; SkillX focuses on knowledge, AutoAgent on harness

## Laws & Principles
- **P364**: Hierarchical skill decomposition (strategic→functional→atomic) enables cross-agent transfer where flat skill representations fail
- **P365**: Automated skill libraries require a provenance layer to prevent knowledge poisoning — extraction without verification creates an attack surface
- **R97**: Evaluate SkillX's three-tier hierarchy against our existing SKILL.md pattern; propose standardized skill taxonomy

---
*Session 291 — 2026-04-07 04:02 UTC*
