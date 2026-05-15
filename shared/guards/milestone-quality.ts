import type { Demand, WorkflowGuard, WorkflowGuardEvent } from "@may-agent/sdk";

/**
 * milestone-quality — Validates milestone specificity when projects start.
 *
 * Evidence: milestone-specificity-audit.md found specificity <4.0 correlates
 * with 5.75 iters/milestone (vs 1.8 for ≥4.0) and 30% stall rate.
 * Auto-scoping rules reduce projected stall rate to <15%.
 *
 * Rules (all must pass):
 * 1. Named Deliverable: milestone names a specific file or artifact
 * 2. Boolean Done-Check: has verifiable completion criterion
 * 3. Bounded Scope: ≤3 iterations per milestone (max 6 milestones)
 * 4. Research → Written Artifact: investigation milestones produce documents
 *
 * Fires on: worker-iteration-1 (first iteration only)
 * Action: warn (not block) — flags vague milestones for the reviewer
 */

function scoreMilestone(text: string): { score: number; issues: string[] } {
  const issues: string[] = [];
  let score = 1; // base

  // Rule 1: Named deliverable — looks for file paths, specific artifacts
  const hasFilePath = /\.(md|ts|js|json|yaml|sh|sql|txt)\b/.test(text) ||
    /`[^`]+`/.test(text) ||
    /\b(file|document|report|artifact|script|table|schema)\b/i.test(text);
  if (hasFilePath) {
    score += 1;
  } else {
    issues.push("No named deliverable (file path or artifact)");
  }

  // Rule 2: Boolean done-check — quantified criteria
  const hasQuantity = /\b(\d+\+?|≥\d+|>=\d+|at least \d+)\b/.test(text);
  const hasVerb = /\b(write|create|produce|build|implement|deploy|add|update|measure|verify)\b/i.test(text);
  const hasCriteria = /\b(pass|exist|meet|reach|reduce|increase|show|confirm|contain)\b/i.test(text);
  if (hasQuantity || (hasVerb && hasCriteria)) {
    score += 1;
  } else {
    issues.push("No boolean done-check (add quantity or verifiable criterion)");
  }

  // Rule 3: Bounded scope — penalize vague/huge scope words
  const hugeScope = /\b(full|entire|all|complete system|everything|comprehensive)\b/i.test(text);
  if (!hugeScope) {
    score += 1;
  } else {
    issues.push("Scope may be too large (use bounded language)");
  }

  // Rule 4: Research milestones must produce artifacts
  const isResearch = /\b(investigate|research|understand|explore|audit|analyze|study|profile)\b/i.test(text);
  const producesArtifact = /\b(write|create|produce|document|report|\.md)\b/i.test(text);
  if (isResearch && !producesArtifact) {
    issues.push("Research milestone should produce a written artifact");
  } else if (!isResearch || producesArtifact) {
    score += 1;
  }

  return { score, issues };
}

export const guard: WorkflowGuard = {
  name: "milestone-quality",
  events: ["step_start"],

  handle(event: WorkflowGuardEvent): Demand[] {
    // Only fire on the first worker iteration
    if (!event.step || !event.step.match(/^worker-iteration-1$/)) return [];

    // Extract milestones from the task/project content
    const taskText = event.task ?? "";
    const milestoneSection = taskText.match(/## Milestones.*?\n([\s\S]*?)(?=\n##|$)/);
    if (!milestoneSection) return [];

    const milestoneLines = milestoneSection[1]
      .split("\n")
      .filter(l => /^\s*-\s*\[[ x]\]/i.test(l))
      .map(l => l.replace(/^\s*-\s*\[[ x]\]\s*/i, "").trim())
      .filter(l => l.length > 0);

    if (milestoneLines.length === 0) return [];

    const results = milestoneLines.map(m => ({
      text: m.slice(0, 60),
      ...scoreMilestone(m),
    }));

    const avgScore = results.reduce((s, r) => s + r.score, 0) / results.length;
    const vagueOnes = results.filter(r => r.score < 4);

    if (vagueOnes.length === 0) return [];

    const details = vagueOnes.map(v =>
      `  - "${v.text}..." (score=${v.score}/5): ${v.issues.join("; ")}`
    ).join("\n");

    return [{
      type: "warn",
      reason: `Milestone quality check: ${vagueOnes.length}/${results.length} milestones have low specificity (avg=${avgScore.toFixed(1)}/5). Vague milestones correlate with 3x more iterations and 30% stall rate.\n\nVague milestones:\n${details}\n\nFix: Add file paths, quantities, and verifiable criteria. See .state/intervention-implementation.md for examples.`,
    }];
  },
};
