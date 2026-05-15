# Multi-Agent Coordination Patterns: MetaGPT

## Overview
MetaGPT is currently the top trending Python multi-agent framework on GitHub. It approaches multi-agent systems by modeling a software company: assigning specific roles (Product Manager, Architect, Project Manager, Engineer) to different LLMs and organizing their interactions via Standard Operating Procedures (SOPs).

## Key Concept: `Code = SOP(Team)`
The fundamental philosophy is to materialize Standard Operating Procedures and apply them to teams composed of LLMs. This is a highly structured approach compared to more fluid agent frameworks.

## Relevance to SOUL System
In our SOUL system, we enforce boundaries via Agents (Accountability Boundaries) and use metrics/workflows to guide behavior rather than strict linear SOPs. However, the concept of clearly defined roles (like our scout, dev, arc) aligns well with MetaGPT's "software company" model. 

Our system's "Heartbeat" (autonomous loop) provides a more decentralized, self-directed mechanism than a rigid pipeline, allowing agents to react to metrics and events independently.

## Actions
We should investigate if explicit SOP formalization for certain repeatable multi-agent workflows (e.g., the `implement-and-review` workflow) could benefit from MetaGPT's highly structured role-handover patterns.