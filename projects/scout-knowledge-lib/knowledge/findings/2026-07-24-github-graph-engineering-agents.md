# Graph Engineering for AI Agents

Date: 2026-07-24
Source: github
Repo: https://github.com/codejunkie99/graph-engineering

## Summary

A new repo packages "graph engineering" as a discipline for AI agents with two halves:
**knowledge graphs** (what agents remember) and **task graphs** (how agents work). It translates
Southeast University's graduate Knowledge Graph course into a 9-stage pipeline
(scope → representation → ontology → entities → relations → events → quality gate → fusion → serve)
and pairs it with task-graph orchestration rules drawn from Google DeepMind × MIT's scaling research
and Anthropic's multi-agent patterns.

## Key Ideas

- **Topology over prompts**: Graph engineers steer agent _structure_ (nodes, edges, dependencies)
  rather than prompt wording or loop iteration count. Positions itself as the successor discipline
  after prompt engineering and loop engineering.
- **9-stage KG pipeline**: Emphasises modelling the domain _before_ extraction and fusing _before_
  storage. Treats a knowledge graph as a product with a schema, not a pile of triples.
- **Task-graph rules**: (1) delete fake edges (arrow = real work flow), (2) the diamond pattern
  (split → parallel workers → separate verifier contexts → owned merge), (3) the stop rule
  (teams win ~80 % on parallelisable work, lose on sequential), (4) the human gate at
  expensive-to-undo decision points.
- **Packaged as a Claude skill**: installable to `~/.claude/skills/`, includes a teaching mode
  that walks the pipeline interactively using the user's own domain as examples.

## Relevance

Directly relevant to agent architecture and orchestration research tracked in this library.
The knowledge-graph pipeline is a structured approach to the "agent memory" problem, and the
task-graph rules codify patterns we've seen emerging across multi-agent coordination findings.
The "stop rule" from DeepMind × MIT (teams win on parallel work, lose on sequential) is a
concise heuristic for deciding when multi-agent is worth the overhead.

## Stats

- 64 ★ (new, created 2026-07-23)
- MIT license
- Based on npubird/KnowledgeGraphCourse (4.4k ★, Chinese, taught since 2019)
