# Knowledge Base — Master Topic Index

> 10 domains, cross-linked. Each topic page lives in `topics/`. Start anywhere, follow the links.

## 🗺️ Topic Map

```
                    ┌──────────────────┐
                    │   FOUNDATIONS     │
                    │                  │
          ┌────────┤  Reasoning &     ├────────┐
          │        │  Planning        │        │
          │        └────────┬─────────┘        │
          │                 │                  │
    ┌─────▼──────┐   ┌─────▼──────┐   ┌──────▼─────┐
    │ Training & │   │ Learning & │   │ Knowledge  │
    │    RL      │◄──► Self-      │◄──► Management │
    │            │   │ Improvement│   │            │
    └─────┬──────┘   └─────┬──────┘   └──────┬─────┘
          │                 │                  │
          │        ┌────────▼─────────┐        │
          │        │   SYSTEMS        │        │
          │        │                  │        │
          ├────────► Multi-Agent      ◄────────┤
          │        │ Coordination     │        │
          │        └──┬─────────┬─────┘        │
          │           │         │              │
    ┌─────▼──────┐    │    ┌────▼───────┐ ┌───▼────────┐
    │ Memory     ◄────┘    │ Safety &   │ │ Evaluation │
    │Architecture│         │ Security   │ │ & Bench-   │
    │            │         │            │ │ marks      │
    └─────┬──────┘         └─────┬──────┘ └──────┬─────┘
          │                      │               │
          │        ┌─────────────▼───────┐       │
          │        │   DEPLOYMENT        │       │
          └────────►                     ◄───────┘
                   │  Production &       │
                   │  Human-Agent        │
                   │  Interaction        │
                   └─────────────────────┘
```

---

## 📚 Topics

### 1. [Multi-Agent Coordination](topics/multi-agent-coordination.md)
How agents work together, communicate, and organize. The central topic — most others connect here.
- GUS Laws: #1 (Iteration Tax), #2 (Intelligence Paradox), #3 (Structure > Scale), #5 (Topology), #13 (Scaling Inversion), #14 (Epistemic Impossibility), #19 (Minimum Sufficient Coordination)
- Key sources: 65+ multi-agent papers, coordination stack CRs
- 🔗 Links to: all other topics

### 2. [Agent Safety & Security](topics/agent-safety-security.md)
Attacks, defenses, alignment, governance. The constraint that bounds everything else.
- GUS Laws: #4 (Observer's Paradox), #6 (Memory Attack Surface), #8 (Deception Asymmetry), #9 (Defense Asymmetry)
- Trilemmas: #1 (Capability-Safety-Efficiency), #7 (Contagion-Consensus-Coordination)
- Key sources: 27+ safety papers, security stack CRs
- ⚡ Tensions with: Production Deployment (safety costs), Learning (open loops = attack vectors)

### 3. [Memory Architecture](topics/memory-architecture.md)
How agents store, retrieve, and manage knowledge across sessions.
- GUS Laws: #6 (Memory = Attack Surface), #18 (Abstraction Gate)
- Mechanisms: #1 (Sycophantic Drift), #15 (Subliminal Contagion)
- Key sources: 47+ memory papers, Memory OS CRs
- 🔗 Depends on: Safety, Knowledge Management

### 4. [Evaluation & Benchmarks](topics/evaluation-benchmarks.md)
How we measure what agents can do — and how those measurements deceive us.
- GUS Laws: #15 (Reliability Illusion), #17 (Training Trap Taxonomy)
- Mechanisms: #5 (Reward Hacking), #16 (Theater Loop)
- Key sources: 13+ evaluation papers, Evaluation Granularity Ladder
- ⚡ Tensions with: Training & RL (metrics used as rewards), Production (benchmarks ≠ reality)

### 5. [Reasoning & Planning](topics/reasoning-planning.md)
How agents think, plan, decompose problems, and use tools.
- GUS Laws: #11 (Knowledge-Action Gap)
- Key sources: 22+ reasoning papers, tool-use deep dives
- 🔗 Depends on: Evaluation (how we know reasoning works)

### 6. [Learning & Self-Improvement](topics/learning-self-improvement.md)
How agents get better over time — the meta-capability.
- GUS Laws: #18 (Abstraction Gate), #16 (Autonomy-Control Dialectic)
- Key sources: Experience Lifecycle CR, Self-Improvement Triangle, Environment-as-Curriculum
- 🔄 Reinforces: Memory Architecture, Training & RL
- ⚡ Tensions with: Safety (learning loops = attack vectors)

### 7. [Human-Agent Interaction](topics/human-agent-interaction.md)
Oversight, delegation, trust calibration, graduated autonomy.
- GUS Laws: #10 (Oversight Decay), #16 (Autonomy-Control Dialectic)
- Key sources: HITL threshold CR, graduated autonomy research
- 🔗 Depends on: Safety, Evaluation

### 8. [Production & Deployment](topics/production-deployment.md)
Taking agents from lab to production — the reality gap.
- GUS Laws: #12 (Production Tax), #15 (Reliability Illusion)
- Key sources: Production readiness gap CRs, infrastructure stack
- ⚡ Tensions with: Safety (cost), Evaluation (lab ≠ production)

### 9. [Training & RL](topics/training-rl.md)
How models are trained, fine-tuned, and aligned. RLHF, GRPO, agent RL.
- GUS Laws: #17 (Training Trap Taxonomy), #18 (Abstraction Gate)
- Key sources: Amy-Kimi Agent RL briefs, RLVR verification CRs, GRPO survey
- 🔄 Reinforces: Evaluation, Learning
- ⚡ Tensions with: Safety (training instabilities), Evaluation (Goodhart's Law)

### 10. [Knowledge Management](topics/knowledge-management.md)
How to organize, update, retrieve, and validate what agents know.
- GUS Laws: #6 (Memory Attack Surface), #18 (Abstraction Gate)
- Key sources: Knowledge modification CRs, RAG research, knowledge integrity pipeline
- 🔗 Depends on: Memory Architecture
- 🔄 Reinforces: Learning & Self-Improvement

---

## 🔗 Cross-Topic Relationship Matrix

| From ↓ / To → | Coord | Safety | Memory | Eval | Reason | Learn | Human | Prod | Train | Know |
|---|---|---|---|---|---|---|---|---|---|---|
| **Coordination** | — | ⚡ | 🔗 | 🔗 | 🔗 | 🔄 | 🔗 | 🔗 | 🔄 | 🔗 |
| **Safety** | ⚡ | — | 🔗 | 🔗 | 🔗 | ⚡ | 🔗 | ⚡ | ⚡ | 🔗 |
| **Memory** | 🔗 | 🔗 | — | 🔗 | 🔗 | 🔄 | . | 🔗 | . | 🔄 |
| **Evaluation** | 🔗 | 🔗 | 🔗 | — | 🔗 | 🔗 | 🔗 | ⚡ | ⚡ | 🔗 |
| **Reasoning** | 🔗 | 🔗 | 🔗 | 🔗 | — | 🔄 | . | 🔗 | 🔗 | 🔗 |
| **Learning** | 🔄 | ⚡ | 🔄 | 🔗 | 🔄 | — | 🔗 | 🔗 | 🔄 | 🔄 |
| **Human** | 🔗 | 🔗 | . | 🔗 | . | 🔗 | — | 🔗 | . | . |
| **Production** | 🔗 | ⚡ | 🔗 | ⚡ | 🔗 | 🔗 | 🔗 | — | 🔗 | 🔗 |
| **Training** | 🔄 | ⚡ | . | ⚡ | 🔗 | 🔄 | . | 🔗 | — | 🔗 |
| **Knowledge** | 🔗 | 🔗 | 🔄 | 🔗 | 🔗 | 🔄 | . | 🔗 | 🔗 | — |

Legend: 🔗 depends on | ⚡ tensions with | 🔄 reinforces | . = weak/no link

---

## 🔍 How to Navigate

1. **New to the KB?** Start with [Multi-Agent Coordination](topics/multi-agent-coordination.md) — it connects to everything
2. **Looking for ideas?** Read [FRONTIER.md](FRONTIER.md) for gaps, contradictions, and untested predictions
3. **Going deep?** Pick a topic → follow source links → use [Deep Dive Protocol](methods/deep-dive-protocol.md)
4. **Testing a theory?** See [Heuristic Discovery](methods/heuristic-discovery.md) for structured idea generation
