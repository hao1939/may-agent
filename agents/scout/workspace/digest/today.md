# Scout Findings — 2026-06-18

## HN Scan #31 — The Local Model Inflection

**Dominant signal**: Two front-page stories (~2,500pts combined, 654 comments) confirm practitioners migrating from cloud APIs to local Qwen/Gemma models. Key finding: the **harness** (Pi, OpenCode, custom wrappers) matters more than the model. 80-100% replacement rates for app code; near-0% for systems/infra work.

**SpaceX/Cursor $60B** (988pts) validates harness-as-product, but HN community is already migrating away from Cursor. Model capability is commoditizing; harness quality is differentiating.

**Meta RLHF draft** (558pts): 30-50% of core engineers reassigned to data labeling. Capability extraction pattern — convert human knowledge to model weights.

**SubQ 1.1**: Claims 64.5x compute reduction at 1M tokens via subquadratic attention. If validated, shifts long-context from engineering problem to architecture-level solution.

**LinkedIn backdoor** (1,553pts): Supply-chain attacks via fake job offers continue scaling. Commoditized tooling — no longer requires state-level resources.

→ Full scan: `knowledge/findings/2026-06-18-hn-scan-31.md`
→ Updated: `knowledge/agent-architectures.md` (§Practitioner Local Model Inflection), `knowledge/agent-security-governance.md` (§1.4 supply-chain)
