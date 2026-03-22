# AI & Agentic Systems Knowledge Base

A structured, living knowledge base built from 800+ research artifacts collected by Scout and Amy-Kimi. Designed for topic discovery, deep dives, and idea generation.

## Architecture

```
knowledge-base/
├── README.md              ← You are here
├── INDEX.md               ← Master topic index with cross-links
├── FRONTIER.md            ← Open questions, unexplored gaps, new idea candidates
├── topics/                ← Topic pages (one per major theme)
│   ├── multi-agent-coordination.md
│   ├── agent-safety-security.md
│   ├── memory-architecture.md
│   ├── evaluation-benchmarks.md
│   ├── reasoning-planning.md
│   ├── learning-self-improvement.md
│   ├── human-agent-interaction.md
│   ├── production-deployment.md
│   ├── training-rl.md
│   └── knowledge-management.md
├── theories/              ← Consolidated theoretical frameworks
│   └── grand-unified-synthesis.md  (→ links to GUS source)
└── methods/               ← How to use this KB
    ├── heuristic-discovery.md      ← How to find new ideas
    └── deep-dive-protocol.md       ← How to go deep on a topic
```

## Design Principles

### 1. Topic Organization (Taxonomy)
Topics are organized into **10 primary domains** derived from clustering 800+ research artifacts. Each topic page contains:
- **Core thesis**: What we know (1-3 sentences)
- **Key findings**: Numbered, citable claims with source links
- **Laws & principles**: From GUS framework that apply
- **Open questions**: What we don't know yet
- **Related topics**: Explicit bidirectional links

### 2. Cross-Linking (Knowledge Graph)
Every topic page links to related topics via three relationship types:
- **🔗 Depends on**: This topic assumes knowledge from another
- **⚡ Tensions with**: This topic has unresolved conflicts with another
- **🔄 Reinforces**: These topics provide mutual evidence

### 3. Heuristic Discovery (New Ideas)
The `FRONTIER.md` file maintains:
- **Gaps**: Topics where we have questions but no answers
- **Contradictions**: Places where findings conflict (fertile ground for new ideas)
- **Analogies**: Patterns from one domain that might transfer to another
- **Predictions**: Testable claims derived from combining topics

### 4. Deep Dive Protocol
For any topic, follow: `Skim → Contextualize → Challenge → Synthesize → Test`
See `methods/deep-dive-protocol.md`.

### 5. Theory Testing
Ideas move through: `Observation → Hypothesis → Mechanism → Prediction → Experiment`
The KB tracks where each idea sits in this pipeline.

## Source Material
- **Scout**: 800+ files (262 cross-refs, 166 deep-dives, 148 cross-ref essays, 242 deep-dive essays) — ~13MB
- **Amy-Kimi**: 26 files covering Agent RL, trust/security, filtering patterns, knowledge hierarchy — ~1.5MB
- **GUS Framework**: 31 Laws, 30 Mechanisms, 10 Trilemmas, 75 Design Principles, 80 Predictions

## How to Use

1. **Browse by topic**: Start at `INDEX.md`, find your domain, follow links
2. **Find new ideas**: Read `FRONTIER.md` for gaps and contradictions
3. **Go deep**: Pick a topic → read its page → follow source links → use deep-dive protocol
4. **Test a theory**: Use `methods/deep-dive-protocol.md` to design an experiment
5. **Contribute**: Scout/Amy-Kimi add new research → may/tech-lead update topic pages → FRONTIER.md evolves
