# DD-777: Measuring Agents in Production (MAP)

**Paper**: Pan et al., "Measuring Agents in Production" (arXiv 2512.04123, Dec 2025, rev. Feb 2026)  
**Rating**: ★★★★★  
**Session**: 629 (CR#326 Path A — production-first evaluation literature search)  
**Tags**: #production-evaluation #agent-deployment #practitioner-study #observability #CR326

## Why This Paper Matters

This is the **first large-scale empirical study of how production LLM agents are actually built, deployed, and evaluated** — precisely the evidence base CR#326 Path A needs. With 20 in-depth case studies and a 306-practitioner survey across 26 domains, MAP provides ground truth about the gym–production gap from the practitioners' perspective.

## Key Findings

### 1. Production Agents Are Simple by Design
- **68% execute ≤10 steps** before requiring human intervention
- **70% rely on prompting off-the-shelf models** (no fine-tuning/weight tuning)
- This directly validates our observation (KE-110, H-096) that gym benchmarks test capabilities production agents don't use — production agents are deliberately constrained, not autonomously open-ended

### 2. Human Evaluation Dominates
- **74% depend primarily on human evaluation** — not automated benchmarks
- This is a stunning indictment of the benchmark-first paradigm: the majority of real practitioners don't trust automated metrics as their primary signal
- Connects to KE-112 ("verdicts lie") — practitioners independently discovered that automated evaluation is unreliable

### 3. Reliability Is the #1 Challenge
- Not capability, not intelligence, not reasoning — **consistent correct behavior over time** is the top concern
- Practitioners address this through **systems-level design** (guardrails, human-in-the-loop, step limits) rather than model improvement
- This reframes the evaluation question: we should measure reliability/consistency, not peak capability

### 4. The Gap Between Research and Practice
- Research benchmarks test autonomous multi-step reasoning on complex tasks
- Production agents are short-horizon, human-supervised, prompt-engineered systems
- The evaluation paradigm mismatch is not a minor calibration issue — it's a fundamental disconnect in what's being measured

## Connection to Our System

### Direct CR#326 Validation
MAP provides external empirical confirmation of CR#326's core thesis: **gym performance doesn't predict production success because gym and production test fundamentally different things**.

- Gym tests: autonomous, long-horizon, capability-maximizing
- Production reality: supervised, short-horizon, reliability-maximizing

### Implications for Our Evaluation Architecture
1. **Shift from capability to reliability metrics**: Our gym measures "can it solve X?" when we should measure "does it consistently handle X correctly over 100 runs?"
2. **Human evaluation integration**: If 74% of practitioners rely on human eval, our evaluation architecture needs systematic human-in-the-loop assessment, not just automated verdicts
3. **Step-count realism**: Our gym tasks may be unrealistically long-horizon compared to actual production patterns (≤10 steps for 68% of production agents)
4. **Systems-level evaluation**: Evaluating the agent in isolation misses the systems-level reliability engineering that makes production agents work

### Layer Mapping (per CR#334 Stack)
MAP findings reinforce that Layer 5 (meta-evaluation) insights are correct but Layers 2-3 (structured logging, cognitive attribution) remain the gap — practitioners compensate with human evaluation because they lack the observability infrastructure to automate it.

## Methodological Strengths
- Mixed methods: qualitative case studies + quantitative survey
- Large sample: 306 practitioners across 26 domains (not just tech companies)
- Real deployed systems, not research prototypes
- Berkeley/Databricks/Stanford authorship with industry connections

## Limitations
- Self-reported data (no actual production telemetry analyzed)
- Survivorship bias: only studies successful/existing deployments
- Snapshot in time (Dec 2025) — rapid field evolution
- Doesn't measure the evaluation gap directly, just documents practice

## Key Quotes / Data Points
- "68% execute at most 10 steps before human intervention"
- "70% rely on prompting off-the-shelf models instead of weight tuning"
- "74% depend primarily on human evaluation"
- "Reliability (consistent correct behavior over time) remains the top development challenge"

## Cross-References
- **CR#326**: Direct evidence for gym–production gap thesis
- **CR#328**: Production reality external convergence
- **CR#334**: Agent observability stack (MAP explains why L2-L3 gaps exist)
- **KE-110**: Gym saturation — MAP shows practitioners already work around this
- **KE-112**: Verdicts lie — 74% human eval dependency confirms automated metrics aren't trusted
- **H-096**: Evaluation architecture ceiling — MAP provides the practitioner-side evidence
- **DD-778**: EDDOps (process model for addressing MAP's identified gaps)
- **DD-779**: Sim2Real Gap (quantifies one specific gap MAP documents qualitatively)
