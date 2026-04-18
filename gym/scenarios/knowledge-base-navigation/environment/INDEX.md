# Knowledge Base Index

This knowledge base contains research findings, experiments, hypotheses, and deep-dive analyses for the Acme Agent Improvement Project.

## Directory Structure

```
.
├── INDEX.md                    ← You are here
├── entries/                    ← Knowledge entries (verified findings)
│   ├── RKE-003.md              — Structural enforcement > text rules
│   ├── RKE-007.md              — Skills don't fix tool-calling patterns
│   ├── RKE-011.md              — Forced externalization improves judgment
│   └── RKE-015.md              — Task-level few-shot outperforms system prompt
├── experiments/                ← Experiment records
│   ├── RX-031/                 — SOUL text vs workflow enforcement
│   │   ├── design.md
│   │   └── results.md
│   ├── RX-055/                 — Skill generalization across domains
│   │   ├── design.md
│   │   └── results.md
│   └── RX-058/                 — Production observation pilot
│       ├── design.md
│       └── results.md
├── hypotheses/                 ← Active/archived hypotheses
│   ├── PRIORITY-TRACKER.md     — Tracks hypothesis priorities
│   ├── RH-044.md               — Structural interventions are necessary for tool patterns
│   └── RH-048.md               — Few-shot position determines effectiveness
└── library/
    └── deep-dives/             ← In-depth analyses
        ├── INDEX.md             — Deep dive index
        ├── failure-taxonomy-analysis.md  — Failure mode classification
        └── few-shot-literature-review.md — Few-shot learning survey
```

## Quick Navigation

- **Hypotheses**: `hypotheses/` — Active research hypotheses
- **Experiments**: `experiments/` — Experiment designs and results
- **Knowledge Entries**: `entries/` — Verified knowledge claims
- **Deep Dives**: `library/deep-dives/` — Extended analyses
