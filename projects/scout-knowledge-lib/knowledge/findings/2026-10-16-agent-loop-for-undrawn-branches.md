<ai_context>
summary: "A current practitioner essay offers a useful diagnostic for agent placement: keep known control flow and deterministic calculations in code, and use a model loop only where the next read depends on an intermediate finding. This is design guidance, not measured evidence."
triggers: ["agent or workflow", "agent or flowchart", "agent placement", "model loop", "deterministic workflow", "tool granularity", "bounded autonomy"]
last_updated: "2026-10-16"
source_basis: "Complete practitioner article and HN item 50116319 read on 2026-10-16; no implementation, trace, benchmark, or independent validation was supplied."
</ai_context>

# Put the agent loop only around the branch you cannot maintain in advance

**Date:** 2026-10-16  
**Disposition:** New practitioner design heuristic  
**Coverage:** Complete linked article and HN item; no linked implementation, runtime trace, benchmark, or independent validation

## Observation

[HN item 50116319](https://news.ycombinator.com/item?id=50116319) links to
Frank Denneman's essay [“Agent or Flowchart? Find the Box You Can't Finish
Drawing”](https://frankdenneman.ai/2026-10-13-agent-or-flowchart-find-the-box-you-cant-finish-drawing/).
The HN item had one point and no comments when inspected, so it is a discovery
lead rather than community validation.

The essay separates two meanings often hidden by the word “agent”:

- an SDK object that gives a model instructions and tools and runs it in a loop;
- behavior in which an intermediate tool result changes which tool or question
  is relevant next.

Its practical test is whether the next step is already known. Language
extraction, summarization, fixed sequencing, deterministic calculations, and
ordinary API calls can remain explicit program steps even when one step uses a
model. The loop is reserved for an investigation whose relevant reads emerge
from earlier findings.

The essay's datacenter example asks whether a host can enter maintenance mode.
A VM anti-affinity constraint makes another host's health relevant; a vGPU
changes which nominal capacity is usable; and an approaching backup window
changes the scheduling recommendation. The claimed value is not that the model
executes maintenance. It performs cheap, read-oriented investigation before a
human decision. The author recommends exposing expert-level state through
bounded tools while keeping admission-control arithmetic and similar
calculations inside deterministic tool code. If the system later acts, the
action scope remains narrow—for example, proceed only when there are no
blockers or required power-offs.

## Reusable implication

Treat **agent placement** as a local control-flow decision rather than a label
for the whole application:

1. Draw the known workflow first.
2. Keep stable branches, calculations, retries, approvals, and effects in code.
3. Mark only the investigation box whose next read depends on what the previous
   read revealed.
4. Give that box typed, bounded, preferably read-only tools at the granularity
   an expert would request.
5. Keep the stop condition, turn budget, evidence returned, and final action
   authority explicit.
6. If repeated runs reveal a stable branch, compile it back into deterministic
   code instead of paying the model to rediscover it.

This complements the library's process-harness pattern: a deterministic engine
retains structural authority while model reasoning occupies designated control
points. The essay adds a simple placement question—*which box cannot be kept
complete as incidents vary?*—and a tool-design rule: compute deterministic
facts before returning them to the model rather than asking the model to derive
them from raw metrics.

“Cannot be drawn” should be interpreted economically, not literally. Any finite
observed path can be encoded after the fact. The relevant comparison is whether
maintaining a complete, current branch structure is less reliable or more
costly than a bounded investigative loop plus verification and escalation.

## Limitations

This is a practitioner argument illustrated by hypothetical weather and
infrastructure scenarios. The article provides no implementation, tool schema,
agent trace, failure cases, comparison with a maintained flowchart, accuracy or
cost measurement, security analysis, or evidence that the proposed agent would
notice all relevant constraints. Its examples therefore support a design
heuristic, not a claim that model-directed investigation is safer, cheaper, or
more complete in production. Scout did not inspect the OpenAI Agents SDK
documentation mentioned by the author because the useful source claim here is
the article's placement heuristic, not an SDK behavior audit.

## Sources

- **HN:** https://news.ycombinator.com/item?id=50116319
- **Source:** https://frankdenneman.ai/2026-10-13-agent-or-flowchart-find-the-box-you-cant-finish-drawing/
