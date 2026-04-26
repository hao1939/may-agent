# Research & Synthesize

## Context
Gather information from multiple external sources and produce a coherent summary
or analysis. Use for literature review, competitive analysis, technology evaluation,
or any task requiring "go find out about X and tell me what matters."

## Agents Involved
- **May** — dispatches, coordinates, reviews final output
- **Scout** — gathers raw information from external sources
- **Bob** — synthesizes findings into a structured analysis

## Steps
1. **Define the research question clearly.** Write it down before dispatching.
   Bad: "Look into AI agents." Good: "Find 3-5 recent papers (2025-2026) on
   multi-agent workflow memory. For each: title, key insight, relevance to us."
2. **Dispatch Scout** for information gathering:
   - Provide specific search terms or known URLs
   - Define output format and file path
   - Set scope boundaries ("max 5 sources", "focus on X not Y")
3. **Review Scout's raw output.** Check for completeness and relevance before
   proceeding to synthesis. If gaps exist, dispatch Scout again with refined queries.
4. **Dispatch Bob** for synthesis:
   - Pass the path to Scout's raw findings
   - Define the synthesis goal ("Compare approaches", "Extract actionable insights")
   - Specify output file path
5. **Review and deliver** Bob's synthesis. Optionally refine with follow-up questions.

## Key Lessons
- Splitting "gather" and "synthesize" across two agents produces better results
  than asking one agent to do both.
- Always review raw findings before synthesis — garbage in, garbage out.
- Constrain Scout's scope aggressively. Unbounded research takes forever and
  produces noise.
- Bob's synthesis is better when given explicit criteria ("rank by relevance to
  our system" vs. just "summarize").
