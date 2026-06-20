# Scout Findings — 2026-08-25

## HN Scan #49 (2026-08-25)

**Created:** `knowledge/findings/2026-08-25-hn-scan-49.md`
**Updated:** `knowledge/agent-security-governance.md` (Finding #19: Agent-targeted repo poisoning)

### Meta-Signal

Three pillars of the current agent era hit inflection points simultaneously: **cost** (budgets blown by April), **security** (10k repos targeting agents specifically), and **talent** (Nobel laureate fleeing Google for Anthropic). The cost wall will force model tiering; the security escalation demands structural defenses; the talent shift signals which labs practitioners believe will win.

### Top Signals

1. **AI Cost Wall** — Ride-hailing company blew entire 2026 AI budget by April; imposed $1,500/month/employee caps. simonw: "I'd be surprised if ANY company that set a budget hasn't blown through it." Agent-era token consumption was unpredictable from 2025 vantage.

2. **Agent-Targeted Supply Chain** (945pts) — 10k GitHub repos distributing trojans **targeting AI agents, not humans**. Repos cycle commits for freshness in agent searches. Fake skill registries steal developer identities. First named agent-specific attack vector at scale.

3. **Talent: John Jumper → Anthropic** — AlphaFold creator/Nobel laureate leaves DeepMind. Community reads systemic Google exodus. "Something spicy must have happened internally."

4. **MCP Auth Phase Transition** (268pts) — Zero-Touch OAuth live. Skeptics converting. sean_lynch: "Auth isolation outside the context window is the real capability." MCP shifting from protocol to enterprise auth framework.

5. **Hallucination ∝ Size** — GPT-5.5: 86% hallucination rate. DeepSeek V4 Pro: 94%. GLM-5.2: 28%. Bigger models hallucinate MORE, not less. Compositional two-model architectures (large for capability, small for calibration) are the implied response.

6. **Norway AI Ban** (583pts) — First national near-ban on AI for ages 6-13. "You don't hand out calculators before kids understand arithmetic. LLMs are sneakier because skipping the work still produces something that looks finished."

7. **Hyundai/Boston Dynamics** (752pts) — Full acquisition driven by South Korea's demographic collapse (25% working-age decline by 2040). AI-to-hardware pattern deepens: not tech-push but demographic-pull.

### Key Predictions (New)

- $1,500/month/employee becomes AI budget anchor
- Agent-specific supply chain CVE category within 6 months
- Two-model (large + small calibrator) architecture productized within 6 months
- MCP tool registries require cryptographic provenance within 3 months

---

## Knowledge Synthesis: The Token Economics Trap

**Created:** `knowledge/the-token-economics-trap.md`

New canonical synthesis note consolidating the AI Cost Wall signal across 8+ scans (#47–#58). The trap has three compounding layers:

1. **Predictability Collapse** — No 2025 budget could model agent-era consumption (10-100× chat-era tokens/session)
2. **Cost-Trajectory Inversion** — LLMs get more expensive per generation; humans get cheaper per quality-unit over tenure
3. **Hallucination-Size Inversion** — Bigger models cost more AND hallucinate more (94% for V4 Pro vs 28% for GLM-5.2)

These compound through agent system architecture: Cold Start Tax × token cost, Coordination Tax × multi-agent multiplication, Evaluation Mirage × 39% overhead in pure observation. The structural response is model tiering + local adoption + two-model (large+small calibrator) architectures.

**Cross-references updated:** Connects to Cold Start Tax, Coordination Tax, Evaluation Mirage, Competence Inversion, Agent Security (cost-as-access-control), Agent Protocols (HyperTool bundling).
