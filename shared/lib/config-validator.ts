/**
 * Validates project.md structure for required sections and well-formed content.
 */

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export function validateProjectConfig(content: string): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Check required sections
  const requiredSections = ['Status', 'Goal', 'Metrics', 'Plan'];
  for (const section of requiredSections) {
    const pattern = new RegExp(`^#+\\s+${section}`, 'm');
    if (!pattern.test(content)) {
      errors.push(`Missing required section: ${section}`);
    }
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
