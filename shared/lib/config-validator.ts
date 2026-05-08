/**
 * Validates project.md structure for required sections and well-formed content.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

function extractFrontmatter(content: string): Record<string, string> | null {
  const match = content.match(/^---\s*\n([\s\S]*?)\n---\s*(?:\n|$)/);
  if (!match) return null;

  const result: Record<string, string> = {};
  for (const line of match[1].split("\n")) {
    const field = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (!field) continue;
    result[field[1].trim()] = field[2].trim().replace(/^["\x27]|["\x27]$/g, "");
  }
  return result;
}

function hasSection(content: string, section: string): boolean {
  return new RegExp(`^#+\\s+${section}\\b`, "mi").test(content);
}

export function validateProjectConfig(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const frontmatter = extractFrontmatter(content);
  if (!frontmatter) {
    errors.push("Missing YAML frontmatter");
  } else {
    for (const field of ["id", "owner", "status"]) {
      if (!frontmatter[field]) {
        errors.push(`Missing required frontmatter: ${field}`);
      }
    }
  }

  const requiredSections = ["Goal", "Plan"];
  for (const section of requiredSections) {
    if (!hasSection(content, section)) {
      errors.push(`Missing required section: ${section}`);
    }
  }

  if (!hasSection(content, "Signals") && !hasSection(content, "Metrics")) {
    warnings.push("Project should include Signals or Metrics section");
  }
  if (!hasSection(content, "Validation")) {
    warnings.push("Project should include Validation section");
  }

  // Check metrics have targets (→ or -> format)
  const metricsMatch = content.match(/^#+\s+Metrics[\s\S]*?(?=^#+\s|\Z)/m);
  if (metricsMatch) {
    const metricsSection = metricsMatch[0];
    const metricLines = metricsSection.split('\n').filter(l => l.trim().startsWith('-') || l.trim().startsWith('*'));
    if (metricLines.length === 0) {
      warnings.push('Metrics section has no metric items');
    } else {
      for (const line of metricLines) {
        if (!line.includes('→') && !line.includes('->') && !line.includes('target')) {
          warnings.push(`Metric without target: ${line.trim()}`);
        }
      }
    }
  }

  // Check plan has items
  const planMatch = content.match(/^#+\s+Plan[^\n]*\n([\s\S]*?)(?=^#+\s|$(?![\s\S]))/m);
  if (planMatch) {
    const planSection = planMatch[0];
    const planItems = planSection.split('\n').filter(l => /^\s*-\s*\[/.test(l));
    if (planItems.length === 0) {
      warnings.push('Plan section has no checklist items');
    } else {
      const allChecked = planItems.every(l => /\[x\]/i.test(l));
      if (allChecked && !content.includes('Re-plan')) {
        warnings.push('All plan items checked but no Re-plan noted');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
