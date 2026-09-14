/**
 * Optional execution adapter selected in agent.json. Arrange the complete current
 * brief without changing its requirements. Domain evidence selection belongs here,
 * not in Task scheduling. Return the original task when its format is unsupported.
 *
 * Preparation is synchronous, pure and inexpensive: no model calls, I/O or side
 * effects. Skills, system instructions, tools and execution authority are applied
 * separately by the Host. This is not a transcript or session recovery API.
 */
export type AgentContextPreparer = (input: Readonly<{ task: string }>) => string;
