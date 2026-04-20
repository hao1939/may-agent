# DD#808 — Beyond Resolution Rates: Behavioral Drivers of Coding Agent Success and Failure

**Source:** arXiv:2604.02547 (Mehtiyev & Assunção, Apr 2026)
**Relevance:** ★★★★★ for H-107 (Difficulty Threshold Moderates Overhead Harm)
**Tags:** #difficulty-threshold #agent-behavior #confound-analysis #H-107

## TL;DR

Large-scale empirical study (9,374 trajectories, 19 agents, 500 tasks) reveals that the widely-reported correlation between trajectory length and failure is a **Simpson's paradox confound** — it reverses direction once task difficulty is controlled. This is the strongest external evidence yet bearing on H-107's difficulty-threshold hypothesis.

## Key Findings

### 1. Difficulty as a Confounding Variable
The paper's central methodological contribution: what looks like "process overhead harms performance" (longer trajectories → more failure) is actually "harder tasks cause both longer trajectories AND more failure." Once difficulty is held constant, longer trajectories (more exploration) are actually *positively* associated with success. This directly challenges naive interpretations of process overhead harm.

### 2. Task Difficulty ≠ Patch Complexity
12 tasks that were never solved by any agent required only simple patches and were rated easy by humans. Difficulty is driven by **architectural reasoning gaps and domain knowledge**, not surface complexity. This complicates H-107's use of baseline success rate as a difficulty proxy — the difficulty that matters may not be the difficulty we measure.

### 3. Behavioral Strategy Matters More Than Length
Agents that gather context before editing and invest in validation succeed more often. These strategies add process overhead (more steps, more tokens) but are beneficial. The overhead is **structural** (context-then-edit-then-validate) rather than incidental.

### 4. LLM > Framework
The LLM is the primary driver of both outcome and behavior. Framework design (which determines process overhead structure) matters less, and its influence diminishes with stronger LLMs. This suggests that as models improve, process overhead costs decrease — consistent with H-107's threshold being model-capability-dependent.

## Relevance to H-107

| H-107 Prediction | Paper Evidence | Verdict |
|---|---|---|
| Overhead harms only above ~50% difficulty | Overhead-failure correlation is a confound; controlling for difficulty reverses it | **Partial support** — overhead may not harm at *any* difficulty level when properly controlled |
| Threshold exists at ~50% baseline success | Paper doesn't test specific thresholds but shows difficulty is the key moderator | **Consistent but untested** |
| Process overhead is the mechanism | Behavioral structure matters, not overhead quantity | **Complicates** — suggests overhead *type* matters more than overhead *amount* |

## Implications for EXP-151

EXP-151's null result (p>0.70, 159 trials) may be explained by this paper: if the difficulty confound was not properly controlled, and if overhead type (structural vs. incidental) was not distinguished, a null result is expected. The paper suggests EXP-151 should:
1. Stratify by validated difficulty ratings (not just baseline success rate)
2. Distinguish beneficial overhead (context-gathering, validation) from harmful overhead (redundant steps, formatting compliance)
3. Increase N substantially — the effect may be small once confounds are removed

## Methodological Notes
- N=9,374 trajectories is very large for this domain
- 19 agents × 500 tasks provides good cross-validation
- SWE-bench Verified as benchmark — production-grade difficulty
- No formal causal analysis (observational study), but the confound identification is rigorous

## Connection to DD-753/DD-754
Complements existing partial validations by providing the clearest evidence yet that difficulty moderation exists but is more nuanced than a simple threshold model.
