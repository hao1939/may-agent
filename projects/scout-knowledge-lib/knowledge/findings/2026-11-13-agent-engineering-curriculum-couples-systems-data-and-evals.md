<ai_context>
summary: "Stanford's Fall 2026 CS 329Z course treats agent engineering as an end-to-end systems discipline: students build retrieval, tools, loops, memory, and multi-agent coordination, then study trace data, benchmark design, judge infrastructure, safety, and applied projects. The reusable implication is to make component construction, evidence collection, evaluation, and deployment controls one continuous engineering loop rather than separate specialties."
triggers: ["CS 329Z", "agent engineering curriculum", "compound AI systems", "agent evaluation curriculum", "agent data flywheel", "agent project rubric"]
last_updated: "2026-11-13"
source_basis: "Complete Stanford CS 329Z Fall 2026 public course page and HN item 50479838. Scout did not attend the course, inspect unreleased materials, interview instructors or students, assess student work, or verify learning outcomes. The published schedule is explicitly tentative."
</ai_context>

# Agent engineering curriculum couples systems, data, and evals

**Date:** 2026-11-13  
**Disposition:** New source-grounded finding  
**Coverage:** Complete public course page; no course participation or outcome evaluation

## Question

What does Stanford's new engineering-oriented agent course treat as the minimum
scope of practical agent development?

## Source observation

[HN item 50479838](https://news.ycombinator.com/item?id=50479838) surfaced
Stanford's Fall 2026 [CS 329Z: Engineering AI Agents](https://cs329z.stanford.edu/).
The HN item had one point and no comments when inspected, so it is discovery
evidence only. The substantive source is the public course page.

The course does not frame agent engineering as prompt design plus a framework.
Its sequence starts with compound AI systems and core components—language-model
behavior, retrieval, tool use, orchestration, agent loops, context management,
memory, and multi-agent coordination—then continues through optimization, trace
data, data selection, benchmark design, judge infrastructure, safety, coding
agents, and personal agents.

Three design choices in the published syllabus are especially useful signals:

1. **Build before abstraction.** Students first implement RAG, tool use, and
   agent loops, then study frameworks such as DSPy and LangGraph. Framework use
   is therefore placed after the underlying state and control flow are visible.
2. **Data, system, and evaluation are one stack.** The orchestration lecture
   explicitly names data, systems, and evals as the three pillars of agent
   engineering. Later lectures connect traces and human interaction to
   optimization data, then treat evaluation as a four-part contract: request,
   environment, stopping criteria, and scorer.
3. **Reliability is longitudinal.** The schedule includes context-management
   patterns, memory maintenance, multi-agent failure modes, non-determinism
   metrics such as `pass@k` and `pass^k`, sandboxing, permissions, and human
   oversight. A quarter-long project, midpoint demo, report, peer-reviewed task
   submission, final demo, and final report make system behavior over time part
   of the work product rather than an afterthought.

## Reusable implication

An internal agent-engineering program or project rubric should close the loop
between implementation and evidence:

- require builders to expose component boundaries before adopting an
  orchestration framework;
- collect normalized traces as both debugging evidence and candidate training
  data, while keeping evaluation holdouts separate;
- specify every evaluation with a request, controlled environment, stopping
  condition, and scorer rather than reporting one undifferentiated success
  rate;
- measure repeated-run reliability and cost alongside single-run quality;
- assess safety at the same system boundaries as tool use, memory, and
  delegation; and
- use staged demonstrations and reviewable artifacts so a final showcase cannot
  substitute for intermediate evidence.

This is a curriculum-derived engineering pattern, not evidence that the course
sequence is optimal or that it improves deployed-agent outcomes. Its value is
that a major university course now presents agents as compound systems whose
components, data, evaluation, and controls must be designed together.

## Evidence limits

The page says the schedule is tentative and subject to change. Some lecture
materials were linked when inspected, but Scout reviewed the complete public
course page rather than every slide, video, reading, homework, or project
artifact. The page describes intended instruction, not student performance or
production results. Sponsor involvement is listed but does not validate any
technical claim. Scout did not attend the course, interview participants, or
compare the curriculum systematically with other courses.

## Primary evidence

- **HN:** https://news.ycombinator.com/item?id=50479838
- **Source:** https://cs329z.stanford.edu/
- **Reviewed page fingerprint (SHA-256):** `21601ff370043621c5754af5992116ec74e95a478fba33daa9a2d44505994284`
