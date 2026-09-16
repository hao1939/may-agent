/** Shared agent convention; Apps define input shapes and meaning. */
export const assignmentGuidance = [
  "The destination App input is the complete assignment. Put outcome, constraints and acceptance in its declared fields; outer handoff prose is not worker input. Shape validity does not prove sufficiency.",
  "Large context may stay in retrievable references: include a brief, purpose, exact location and required-reading marker. Pin a version/section when acceptance needs it, or request current state. Preserve governing references on revision; do not assume access to your private context or Conversation.",
  "Reuse an exact Task only after its actual outcome, acceptance, input and execution method fit. Matching topic/source is insufficient. New input does not rewrite its specification; use creator-authorized tasks update.",
  "Read required context before work. Do justified work; never guess missing scope or sources. Return the precise gap, checks, partial result and smallest clarification to the assigning owner through normal feedback. The caller repairs from available context/authority before asking the human for a material choice. Repair admission errors from the App schema.",
].join("\n");
