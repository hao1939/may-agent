/**
 * project-scanner.ts — Scans an agent's workspace/projects/ for active projects
 * and produces injection text with exact workflow.run() commands.
 */

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export interface ActiveProject {
  name: string;
  path: string;       // relative path like "workspace/projects/foo.md"
  goal: string;
  status: string;
}

/**
 * Scan an agent's workspace/projects/ directory for active project files.
 * @param agentDir - Absolute path to the agent directory (e.g., /app/agents/bob)
 * @returns Array of active projects found
 */
export function scanActiveProjects(agentDir: string): ActiveProject[] {
  const projectsDir = join(agentDir, "workspace", "projects");
  if (!existsSync(projectsDir)) return [];

  const files = readdirSync(projectsDir).filter(f => f.endsWith(".md"));
  const results: ActiveProject[] = [];

  for (const file of files) {
    const filePath = join(projectsDir, file);
    const content = readFileSync(filePath, "utf-8");

    // Check for active status (case-insensitive, flexible formatting)
    const statusMatch = content.match(/\*\*Status\*\*:\s*(\w+)/i) 
      || content.match(/^Status:\s*(\w+)/im);
    if (!statusMatch) continue;
    
    const status = statusMatch[1].toLowerCase();
    if (status !== "active") continue;

    // Extract goal from ## Goal section or first meaningful paragraph
    let goal = "";
    const goalMatch = content.match(/##\s*Goal\s*\n+([\s\S]*?)(?=\n##|\n\*\*|$)/);
    if (goalMatch) {
      goal = goalMatch[1].trim().split("\n")[0].trim();
    }
    if (!goal) {
      // Fallback: use the title
      const titleMatch = content.match(/^#\s+(?:Project:\s*)?(.+)/m);
      if (titleMatch) goal = titleMatch[1].trim();
    }

    const relativePath = `workspace/projects/${file}`;
    results.push({
      name: file.replace(/\.md$/, ""),
      path: relativePath,
      goal: goal || file,
      status,
    });
  }

  return results;
}

/**
 * Generate the injection text for active projects.
 * Returns empty string if no active projects found.
 */
export function buildProjectInjection(agentName: string, agentDir: string): string {
  const projects = scanActiveProjects(agentDir);
  if (projects.length === 0) return "";

  // Pick the first active project (could add priority logic later)
  const project = projects[0];

  return `## ⚠️ REQUIRED: Use persistent-task workflow

You have an active project. Your FIRST tool call must be:
\`\`\`
workflow.run("persistent-task", { task: "Resume active project: ${project.goal.replace(/"/g, '\\"')}", project: "${project.path}" })
\`\`\`

Do NOT read the project file manually. Do NOT start working directly. Call the workflow FIRST.`;
}
