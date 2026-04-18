import { HealthReport } from './health-checker.js';

// Types

export interface AlertRule {
  id: string;
  name: string;
  condition: 'healthRate_below' | 'unhealthy_above' | 'agent_missing_file';
  threshold: number;
  severity: 'warning' | 'critical';
}

export interface Alert {
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'critical';
  message: string;
  triggeredAt: number;
}

/**
 * Evaluate a health report against a set of alert rules.
 * Returns an array of alerts for rules whose conditions are met.
 */
export function evaluateAlerts(report: HealthReport, rules: AlertRule[]): Alert[] {
  const alerts: Alert[] = [];

  for (const rule of rules) {
    switch (rule.condition) {
      case 'healthRate_below': {
        if (report.summary.healthRate < rule.threshold) {
          alerts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `Health rate ${Math.round(report.summary.healthRate * 100)}% is below threshold ${Math.round(rule.threshold * 100)}%`,
            triggeredAt: Date.now(),
          });
        }
        break;
      }
      case 'unhealthy_above': {
        if (report.summary.unhealthy > rule.threshold) {
          alerts.push({
            ruleId: rule.id,
            ruleName: rule.name,
            severity: rule.severity,
            message: `${report.summary.unhealthy} unhealthy agents exceeds threshold of ${rule.threshold}`,
            triggeredAt: Date.now(),
          });
        }
        break;
      }
      case 'agent_missing_file': {
        for (const result of report.results) {
          if (result.missingFiles.length > 0) {
            alerts.push({
              ruleId: rule.id,
              ruleName: rule.name,
              severity: rule.severity,
              message: `Agent "${result.agent}" is missing files: ${result.missingFiles.join(', ')}`,
              triggeredAt: Date.now(),
            });
          }
        }
        break;
      }
    }
  }

  return alerts;
}

/**
 * Returns a sensible set of default alert rules.
 */
export function defaultRules(): AlertRule[] {
  return [
    {
      id: 'health-rate-warning',
      name: 'Health Rate Warning',
      condition: 'healthRate_below',
      threshold: 0.8,
      severity: 'warning',
    },
    {
      id: 'health-rate-critical',
      name: 'Health Rate Critical',
      condition: 'healthRate_below',
      threshold: 0.5,
      severity: 'critical',
    },
    {
      id: 'unhealthy-count',
      name: 'Too Many Unhealthy Agents',
      condition: 'unhealthy_above',
      threshold: 3,
      severity: 'warning',
    },
    {
      id: 'missing-files',
      name: 'Agent Missing Required Files',
      condition: 'agent_missing_file',
      threshold: 0,
      severity: 'warning',
    },
  ];
}
