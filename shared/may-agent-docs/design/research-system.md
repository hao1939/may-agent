# Research System Design

## Goal

Maintain a knowledge base. Discover new ideas. Verify them with evidence.

## Two Core Concepts

### 1. Adversarial Peers

Two agents research the same question from opposite angles. The disagreement reveals insight.

```
Question: "Does X improve Y?"

Advocate: finds evidence FOR, designs experiments to prove
Skeptic:  finds evidence AGAINST, tries to disprove

Agreement    → high confidence knowledge
Disagreement → needs experiment
Neither finds evidence → question is wrong or premature
```

Not reviewer/reviewee. Not builder/QA. Genuine peers with opposing incentives. Like GAN — the generator gets better because the discriminator is trying to catch it.

### 2. Lab (not Gym)

**Gym** tests agents: fixed scenario, pass/fail, agent is the subject.
**Lab** tests ideas: open hypothesis, measured comparison, idea is the subject.

```
Gym:  scenario → agent runs → pass/fail → "agent is good/bad"
Lab:  hypothesis → experiment → agents run it → evidence → "idea is true/false"
```

The lab is the experiment infrastructure for the research system.

## Knowledge Base

### Structure

```
knowledge/
  entries/
    KE-001.md          # "npx unavailable in container — use node_modules/.bin"
    KE-002.md          # "context.md improves behavior for environmental knowledge only"
    KE-003.md          # "text rules don't fix judgment failures (0/18)"
    ...
  hypotheses/
    H-001.md           # "rich delegation context reduces ops by 30%+"
    H-002.md           # "adversarial review catches more bugs than single reviewer"
    ...
  experiments/
    EXP-001/           # A/B test: context learning
      design.md        # hypothesis, method, metrics
      results.md       # data, analysis
      status: verified
    EXP-002/           # delegation POC
      design.md
      results.md
      status: in-progress
```

### Knowledge Entry Format

```markdown
# KE-XXX: [title]

**Status**: verified | provisional | disputed | superseded
**Evidence**: EXP-XXX, EXP-YYY
**Discovered**: 2026-03-27
**Last verified**: 2026-03-29

## Claim
[One clear statement]

## Evidence
[Links to experiments, data, specific sessions]

## Limitations
[When this doesn't apply, edge cases]

## Supersedes
[Previous entries this replaces, if any]
```

### Hypothesis Format

```markdown
# H-XXX: [title]

**Status**: untested | testing | supported | refuted | inconclusive
**Priority**: high | medium | low
**Proposed by**: [agent or human]

## Hypothesis
[Specific, testable claim: "X will improve Y by Z%"]

## Existing Evidence
[What we already know that suggests this]

## Experiment Design
[How to test: control, treatment, metric, success criteria]

## Results
[Filled in after experiment runs]
```

## Research Workflow

```
1. DISCOVER
   Scout finds papers, repos, techniques
   → generates hypotheses (H-XXX)

2. CHALLENGE (adversarial peers)
   Advocate: "H-XXX is worth testing because..."
   Skeptic:  "H-XXX is flawed because..."
   → refine hypothesis or discard

3. EXPERIMENT (lab)
   Design experiment: control, treatment, metric
   Run it: agents execute, lab tracks
   → raw results

4. ANALYZE (adversarial peers)
   Advocate: "results support the hypothesis because..."
   Skeptic:  "results are inconclusive because..."
   → knowledge entry (verified/disputed/inconclusive)

5. SYNTHESIZE
   Connect new knowledge to existing entries
   Update context.md for affected agents
   Generate new hypotheses from connections
   → cycle repeats
```

## Lab Infrastructure

### What the Lab Does

```typescript
interface Experiment {
  id: string;                    // EXP-XXX
  hypothesis: string;            // H-XXX reference
  design: {
    control: ExperimentArm;      // baseline condition
    treatment: ExperimentArm;    // changed condition
    metric: string;              // what to measure
    successCriteria: string;     // what counts as evidence
    sampleSize: number;          // how many runs per arm
  };
  status: "designed" | "running" | "complete" | "failed";
  results?: ExperimentResults;
}

interface ExperimentArm {
  description: string;           // what this arm does
  setup: string;                 // how to configure it
  task: string;                  // what the agent runs
}

interface ExperimentResults {
  control: RunResult[];
  treatment: RunResult[];
  analysis: string;              // statistical comparison
  verdict: "supported" | "refuted" | "inconclusive";
}

interface RunResult {
  sessionId: string;
  ops: number;
  duration: number;
  passed: boolean;
  metrics: Record<string, number>;  // custom measurements
}
```

### Lab vs Gym

| Aspect | Gym | Lab |
|--------|-----|-----|
| Subject | Agent behavior | Ideas/hypotheses |
| Question | "Did agent do the right thing?" | "Is this true?" |
| Design | Fixed scenario, fixed criteria | Custom experiment, custom metrics |
| Result | Pass/fail | Evidence with confidence |
| Runs | Single run per scenario | Multiple runs, statistical comparison |
| Environment | Pre-built sandbox | Configured per experiment |
| Output | Score | Knowledge entry |

### Lab runs on the same infrastructure as gym

```
lab run EXP-001
  → reads experiment design
  → for each arm (control, treatment):
      → for each sample:
          → configure environment
          → run agent (may-agent --oneshot or fork)
          → collect metrics
  → compare arms
  → produce results
  → write to experiments/EXP-001/results.md
```

The lab reuses: agent runner, session tracking, DB persistence. It adds: multi-arm comparison, statistical analysis, hypothesis tracking.

## Agent Roles

| Agent | Research Role | What it does |
|-------|-------------|-------------|
| Scout | **Discoverer** | Finds papers, repos, techniques. Generates hypotheses. |
| Advocate | **Advocate** | Argues FOR hypotheses. Finds supporting evidence. Designs experiments to prove. |
| Skeptic | **Skeptic** | Argues AGAINST hypotheses. Finds counterevidence. Tries to disprove. |
| Master | **Experimenter** | Runs experiments using claude-code/codex. Implements POCs. |
| May | **Coordinator** | Manages research agenda. Prioritizes hypotheses. Assigns work. |
| Evaluator | **Analyst** | Analyzes experiment results. Produces knowledge entries. |

### Adversarial pair: Advocate + Skeptic

Both receive the same hypothesis. Both research independently. Then their findings are compared:

```
May assigns H-XXX to both:
  → fork("advocate", "Research H-XXX. Find evidence that supports it.")
  → fork("skeptic", "Research H-XXX. Find evidence that contradicts it.")
  → both complete
  → May (or evaluator) compares findings
  → if both agree: high confidence → knowledge entry
  → if they disagree: design experiment → lab runs it → evidence decides
```

The advocate's job is not to be right — it's to find the strongest case FOR.
The skeptic's job is not to be negative — it's to find the strongest case AGAINST.
Neither is allowed to be neutral.

## Integration with Architecture

### EventBus events for research

```typescript
  // Research events
  | { type: "hypothesis_created"; id: string; title: string; proposedBy: string }
  | { type: "experiment_started"; id: string; hypothesis: string }
  | { type: "experiment_complete"; id: string; verdict: string }
  | { type: "knowledge_created"; id: string; title: string; status: string }
```

### DB tables for research

```sql
CREATE TABLE hypotheses (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,        -- untested, testing, supported, refuted, inconclusive
  proposedBy TEXT,
  createdAt INTEGER,
  experimentId TEXT
);

CREATE TABLE experiments (
  id TEXT PRIMARY KEY,
  hypothesisId TEXT,
  status TEXT,        -- designed, running, complete, failed
  design TEXT,        -- JSON
  results TEXT,       -- JSON
  createdAt INTEGER,
  completedAt INTEGER
);

CREATE TABLE knowledge_entries (
  id TEXT PRIMARY KEY,
  title TEXT,
  claim TEXT,
  status TEXT,        -- verified, provisional, disputed, superseded
  evidence TEXT,       -- JSON array of experiment IDs
  createdAt INTEGER,
  lastVerified INTEGER
);
```

### Knowledge flows to agents via context.md

When a knowledge entry is verified, the context learner updates relevant agents' context.md:

```
KE-002 verified: "context.md improves behavior for environmental knowledge only"
  → update coder/context.md, tech-lead/context.md
  → agents know this in their next session
```

## What We Need to Build

### Phase 1: Knowledge base structure
- Create knowledge/, hypotheses/, experiments/ directories
- Define entry formats (already in this doc)
- Migrate existing findings (context learning A/B, delegation POC) into entries

### Phase 2: Lab infrastructure
- Experiment runner (extends gym runner with multi-arm, metrics)
- Experiment tracking in DB
- Results analysis (comparison, not just pass/fail)

### Phase 3: Adversarial peers
- Advocate + Skeptic agent definitions (SOUL.md)
- Research workflow: assign hypothesis → both research → compare → decide
- Integration with lab for disputed hypotheses

### Phase 4: Research loop
- Scout discovers → hypotheses generated → peers challenge → lab tests → knowledge stored
- May coordinates the agenda
- Context.md updated from verified knowledge
