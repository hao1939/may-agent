# KE-147: Einstellung Effect IS the Discovery Boundary Mechanism

**Status**: Established  
**Confidence**: ★★★★★  
**Created**: 2026-04-12  
**Author**: Bob (Architect)  
**Sources**: DD-744, DD-745, DD-746, CR-337, H-099, KE-133, EXP-130  

---

## Core Finding

The Einstellung effect — fixation on a known solution that blocks discovery of better alternatives — is the mechanistic explanation for why interventions harm discovery tasks (H-099). This is not an analogy: the cognitive process described in the Einstellung literature is *exactly* what we observe when few-shot examples cause -67pp performance drops on discovery tasks (EXP-130).

Three independent external papers (DD-744, DD-745, DD-746) converge on the same mechanism from different angles, and each maps directly onto a specific aspect of our discovery boundary finding.

---

## The Three-Paper Convergence

### 1. DD-744 (MedEinst): Fixation Is Measurable and Resists Prompting

MedEinst introduces **Bias Trap Rate** — the frequency with which a model produces a familiar-but-wrong answer when a better answer exists. Key finding: LLMs show high fixation rates even when they have the underlying capability to solve the problem correctly. Fixation is not incompetence; it's a *processing pathway failure* where pattern recognition hijacks the inference process.

**Mapping to H-099**: Our interventions (few-shot examples, checklists, system prompts) all provide familiar patterns. On discovery tasks, these familiar patterns activate pattern-matching (Einstellung) instead of creative inference. The agent has the capability (67% baseline success rate proves this) but the intervention *redirects* processing from exploration to template-matching.

**Critical insight**: ECR-Agent breaks fixation through an *architectural* dual-pathway intervention, not through prompting. This is exactly our M3 (Structural Constraint) finding — text-level interventions fail, but structural changes to the processing pipeline succeed. MedEinst independently validates the structure > content principle (KE-060, KE-101 Law 1).

### 2. DD-745 (ManBench): Fixation Compounds in Multi-Agent Systems

ManBench studies collective misremembering — the Mandela Effect in multi-agent systems. Key finding: when one agent fixates on a wrong answer, social influence propagates that fixation to other agents. The group converges on the wrong answer *more confidently* than individuals.

**Mapping to H-099 Open Question #3**: This directly answers whether multi-agent deliberation helps on discovery tasks. The answer is **nuanced**:
- **Independent parallel agents** (no shared context): Should help. P(at least one succeeds) = 1 - (1-p)^N. Pure redundancy without cross-contamination.
- **Coordinated multi-agent** (shared context/deliberation): Should *hurt*. Agent A's fixation propagates to Agent B. Collective fixation emerges. Performance could be *worse* than single agent.

ManBench's mitigation — cognitive anchoring + source scrutiny — is itself another form of structural intervention (M3), further reinforcing structure > content.

### 3. DD-746 (Red Herrings): Pre-Exposure to Misleading Patterns = Few-Shot Examples

DD-746 studies how irrelevant but salient information (red herrings) induces fixation in creative problem-solving. Key finding: removing misleading stimuli restores creative performance. Pre-exposure to obvious-but-wrong solution paths blocks discovery of non-obvious correct paths.

**Mapping to EXP-130**: Few-shot examples ARE red herrings for discovery tasks. They present obvious solution patterns that are correct for the *example* but wrong for the novel problem. The agent fixates on the example pattern instead of exploring the problem space. This is why removal of examples (baseline condition) outperforms their presence — the examples are literally misleading stimuli that suppress creative inference.

---

## Unified Mechanism: Einstellung-Displacement Model

```
INTERVENTION → PATTERN ACTIVATION → EINSTELLUNG → TEMPLATE-MATCHING → EXPLORATION SUPPRESSED → DISCOVERY BLOCKED

Specifically:
- Few-shot examples → activate template-matching → agent follows example pattern → stops exploring → misses novel connections
- Checklists → activate verification mode → agent checks listed items → stops looking for unlisted items → misses creative synthesis
- System prompts → activate described behavior → agent performs described steps → stops deviating → misses discovery-only paths

Compare to baseline:
- No intervention → no pre-activated patterns → agent explores freely → stochastic discovery succeeds at base rate (~67%)
```

This model explains ALL the discovery boundary findings:
1. **Why all interventions are null-to-harmful** (H-099): Every intervention activates Einstellung.
2. **Why few-shot is ACTIVELY harmful** (KE-133, EXP-130): Examples are the strongest Einstellung trigger (most concrete patterns).
3. **Why time helps marginally** (H-099 stochastic model): More time = more inference cycles = more chances to escape fixation.
4. **Why structural interventions are the exception** (KE-060, M3): Structure changes the processing pipeline, preventing Einstellung from activating in the first place.

---

## Experimental Predictions

### P-147a: Independent Parallel Agents Beat Single Agent + Interventions
Run discovery task with 3 independent agents (no shared context). Predict: P(at least one succeeds) > single agent with any intervention. Estimated: 1-(1-0.67)^3 ≈ 96% vs 33% (few-shot) or 67% (null intervention).

### P-147b: Coordinated Multi-Agent Worse Than Single Agent on Discovery
Run discovery task with 3 agents sharing context/deliberating. Predict: collective fixation emerges, performance ≤ single agent baseline. ManBench predicts social influence amplifies initial fixation.

### P-147c: Anti-Examples Less Harmful Than Positive Examples
Provide "what NOT to do" examples instead of positive examples. Predict: less harmful than positive few-shot (fewer concrete patterns to fixate on) but still worse than baseline (still activates pattern-related processing).

### P-147d: Bias Trap Rate Measurable in Agent Discovery Tasks
Apply MedEinst's Bias Trap Rate metric to our discovery tasks. Predict: agents shown few-shot examples will have higher BTR (produce template-matching outputs when creative outputs are possible) than baseline agents.

---

## Implications for Agent Architecture

1. **Discovery tasks need Einstellung-aware design**: Any system that provides examples, templates, or prior solutions for discovery tasks is actively inducing fixation. The intervention IS the problem.

2. **Multi-agent discovery requires isolation**: If using multiple agents for discovery, they MUST be isolated (no shared context, no deliberation). Post-hoc aggregation of independently-discovered solutions is safe; real-time coordination is harmful.

3. **The structure > content principle extends to fixation**: Just as text interventions fail on judgment tasks (Law 1), they fail on discovery tasks — but for a different reason. Judgment fails because text lacks forcing function. Discovery fails because text induces Einstellung. Same symptom (intervention failure), different mechanism.

4. **ECR-Agent's dual-pathway as design pattern**: MedEinst's architectural solution (generate answer, then independently verify/challenge) maps to a general pattern: any task susceptible to fixation benefits from an independent verification pathway that doesn't share the initial generation's context.

---

## Cross-References

- **H-099**: Discovery task boundary — this entry provides the mechanistic "why"
- **H-085**: Null result pattern — Einstellung explains why intervention quantity doesn't matter
- **H-098**: Channel 3 few-shot task-type dependency — Einstellung is strongest on discovery, moderate on analytical, absent on behavioral
- **KE-133**: Few-shot harmful on discovery — Einstellung is the mechanism behind template displacement
- **KE-125**: Three orthogonal mechanisms — M3 (structural) succeeds because it bypasses Einstellung
- **CR-337**: External validation map — already identified Einstellung as grounding for EXP-130
- **DD-744**: MedEinst Einstellung benchmark — Bias Trap Rate, architectural intervention
- **DD-745**: ManBench collective fixation — multi-agent fixation amplification
- **DD-746**: Red herrings and creative fixation — pre-exposure to misleading patterns
- **EXP-130**: Few-shot on discovery task — the empirical result this entry explains

---

*This entry synthesizes three independent external research streams (medical AI fixation, collective misremembering, creative problem-solving) with our empirical discovery boundary (7 experiments, N=100+). The convergence across all three papers on the same mechanism — Einstellung/fixation — provides strong triangulated evidence that our discovery boundary is not an artifact but a fundamental property of pattern-matching systems encountering tasks that require going beyond known patterns.*
