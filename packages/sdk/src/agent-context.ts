/**
 * @experimental Opt-in contract for evaluating App-specific brief preparation.
 *
 * Optional execution adapter selected in agent.json. Arrange the complete current
 * brief without changing its requirements. Domain evidence selection belongs here,
 * not in Task scheduling. Return the original task when its format is unsupported.
 *
 * Preparation is synchronous, pure and inexpensive: no model calls, I/O or side
 * effects. Skills, system instructions, tools and execution authority are applied
 * separately by the Host. This is not a transcript or session recovery API.
 * The configured entrypoint must stay inside the agent's definition directory.
 * Module code and its imports are trusted; this is not an import sandbox.
 */
export type AgentContextPreparer = (input: Readonly<{ task: string }>) => string;
