import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { checkAgent, checkAll, formatReport, HealthReport } from './health-checker';
import { evaluateAlerts, defaultRules, AlertRule } from './alert-rules';

const TEST_DIR = path.join(__dirname, '.test-agents');

async function createDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function createFile(filePath: string, content = '') {
  await fs.writeFile(filePath, content);
}

describe('health-checker', () => {
  beforeEach(async () => {
    await createDir(TEST_DIR);
  });

  afterEach(async () => {
    await fs.rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('checkAgent', () => {
    it('should report healthy when all required files exist', async () => {
      const agentDir = path.join(TEST_DIR, 'test-agent');
      await createDir(agentDir);
      await createFile(path.join(agentDir, 'SOUL.md'), '# Soul');
      await createFile(path.join(agentDir, 'DOMAIN.md'), '# Domain');

      const result = await checkAgent(agentDir);

      expect(result.agent).toBe('test-agent');
      expect(result.healthy).toBe(true);
      expect(result.missingFiles).toEqual([]);
      expect(result.checkedAt).toBeGreaterThan(0);
    });

    it('should report missing files by filename only, not full path', async () => {
      const agentDir = path.join(TEST_DIR, 'incomplete-agent');
      await createDir(agentDir);
      // Only create SOUL.md, leave DOMAIN.md missing

      await createFile(path.join(agentDir, 'SOUL.md'), '# Soul');

      const result = await checkAgent(agentDir);

      expect(result.agent).toBe('incomplete-agent');
      expect(result.healthy).toBe(false);
      // Missing files should be filenames, not full paths
      expect(result.missingFiles).toEqual(['DOMAIN.md']);
      expect(result.missingFiles[0]).not.toContain('/');
    });

    it('should report all files missing for empty directory', async () => {
      const agentDir = path.join(TEST_DIR, 'empty-agent');
      await createDir(agentDir);

      const result = await checkAgent(agentDir);

      expect(result.healthy).toBe(false);
      expect(result.missingFiles).toHaveLength(2);
    });
  });

  describe('checkAll', () => {
    it('should check all subdirectories', async () => {
      // Create 3 agent dirs: 2 healthy, 1 unhealthy
      for (const name of ['alpha', 'beta', 'gamma']) {
        const dir = path.join(TEST_DIR, name);
        await createDir(dir);
        await createFile(path.join(dir, 'SOUL.md'));
        if (name !== 'gamma') {
          await createFile(path.join(dir, 'DOMAIN.md'));
        }
      }

      const report = await checkAll(TEST_DIR);

      expect(report.results).toHaveLength(3);
      expect(report.summary.total).toBe(3);
      expect(report.summary.healthy).toBe(2);
      expect(report.summary.unhealthy).toBe(1);
      expect(report.summary.healthRate).toBeCloseTo(2 / 3, 2);
      expect(report.generatedAt).toBeGreaterThan(0);
    });

    it('should return empty report for empty directory', async () => {
      const report = await checkAll(TEST_DIR);

      expect(report.results).toHaveLength(0);
      expect(report.summary.total).toBe(0);
      expect(report.summary.healthy).toBe(0);
      expect(report.summary.healthRate).toBe(0);
    });
  });

  describe('formatReport', () => {
    it('should produce valid markdown with summary and details', () => {
      const report: HealthReport = {
        results: [
          { agent: 'good-agent', healthy: true, missingFiles: [], checkedAt: 1000 },
          { agent: 'bad-agent', healthy: false, missingFiles: ['DOMAIN.md'], checkedAt: 1000 },
        ],
        summary: { total: 2, healthy: 1, unhealthy: 1, healthRate: 0.5 },
        generatedAt: 1710000000000,
      };

      const output = formatReport(report);

      expect(output).toContain('# Health Report');
      expect(output).toContain('Total agents: 2');
      expect(output).toContain('Healthy: 1');
      expect(output).toContain('Unhealthy: 1');
      expect(output).toContain('50%');
      expect(output).toContain('✅ good-agent');
      expect(output).toContain('❌ bad-agent');
      expect(output).toContain('DOMAIN.md');
    });
  });
});

describe('alert-rules', () => {
  const makeReport = (overrides: Partial<HealthReport> = {}): HealthReport => ({
    results: [],
    summary: { total: 0, healthy: 0, unhealthy: 0, healthRate: 0 },
    generatedAt: Date.now(),
    ...overrides,
  });

  describe('evaluateAlerts', () => {
    it('should trigger healthRate_below when rate is under threshold', () => {
      const report = makeReport({
        summary: { total: 4, healthy: 1, unhealthy: 3, healthRate: 0.25 },
      });
      const rules: AlertRule[] = [
        { id: 'r1', name: 'Low Health', condition: 'healthRate_below', threshold: 0.5, severity: 'critical' },
      ];

      const alerts = evaluateAlerts(report, rules);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].ruleId).toBe('r1');
      expect(alerts[0].severity).toBe('critical');
      expect(alerts[0].message).toContain('25%');
      expect(alerts[0].message).toContain('50%');
    });

    it('should not trigger healthRate_below when rate meets threshold', () => {
      const report = makeReport({
        summary: { total: 4, healthy: 3, unhealthy: 1, healthRate: 0.75 },
      });
      const rules: AlertRule[] = [
        { id: 'r1', name: 'Low Health', condition: 'healthRate_below', threshold: 0.5, severity: 'warning' },
      ];

      const alerts = evaluateAlerts(report, rules);
      expect(alerts).toHaveLength(0);
    });

    it('should trigger unhealthy_above when count exceeds threshold', () => {
      const report = makeReport({
        summary: { total: 10, healthy: 5, unhealthy: 5, healthRate: 0.5 },
      });
      const rules: AlertRule[] = [
        { id: 'r2', name: 'Too Many Unhealthy', condition: 'unhealthy_above', threshold: 3, severity: 'warning' },
      ];

      const alerts = evaluateAlerts(report, rules);

      expect(alerts).toHaveLength(1);
      expect(alerts[0].ruleId).toBe('r2');
      expect(alerts[0].message).toContain('5');
    });

    it('should not trigger unhealthy_above when count is at threshold', () => {
      const report = makeReport({
        summary: { total: 6, healthy: 3, unhealthy: 3, healthRate: 0.5 },
      });
      const rules: AlertRule[] = [
        { id: 'r2', name: 'Too Many Unhealthy', condition: 'unhealthy_above', threshold: 3, severity: 'warning' },
      ];

      const alerts = evaluateAlerts(report, rules);
      expect(alerts).toHaveLength(0);
    });

    it('should trigger agent_missing_file for each unhealthy agent', () => {
      const report = makeReport({
        results: [
          { agent: 'a', healthy: true, missingFiles: [], checkedAt: 1000 },
          { agent: 'b', healthy: false, missingFiles: ['SOUL.md'], checkedAt: 1000 },
          { agent: 'c', healthy: false, missingFiles: ['SOUL.md', 'DOMAIN.md'], checkedAt: 1000 },
        ],
        summary: { total: 3, healthy: 1, unhealthy: 2, healthRate: 1 / 3 },
      });
      const rules: AlertRule[] = [
        { id: 'r3', name: 'Missing Files', condition: 'agent_missing_file', threshold: 0, severity: 'warning' },
      ];

      const alerts = evaluateAlerts(report, rules);

      expect(alerts).toHaveLength(2);
      expect(alerts[0].message).toContain('b');
      expect(alerts[1].message).toContain('c');
    });

    it('should evaluate multiple rules simultaneously', () => {
      const report = makeReport({
        results: [
          { agent: 'broken', healthy: false, missingFiles: ['SOUL.md'], checkedAt: 1000 },
        ],
        summary: { total: 1, healthy: 0, unhealthy: 1, healthRate: 0 },
      });
      const rules: AlertRule[] = [
        { id: 'r1', name: 'Rate Low', condition: 'healthRate_below', threshold: 0.5, severity: 'critical' },
        { id: 'r3', name: 'Missing Files', condition: 'agent_missing_file', threshold: 0, severity: 'warning' },
      ];

      const alerts = evaluateAlerts(report, rules);

      expect(alerts).toHaveLength(2);
      expect(alerts.map(a => a.ruleId)).toContain('r1');
      expect(alerts.map(a => a.ruleId)).toContain('r3');
    });

    it('should return no alerts for a fully healthy report', () => {
      const report = makeReport({
        results: [
          { agent: 'a', healthy: true, missingFiles: [], checkedAt: 1000 },
        ],
        summary: { total: 1, healthy: 1, unhealthy: 0, healthRate: 1 },
      });
      const rules = defaultRules();

      const alerts = evaluateAlerts(report, rules);
      expect(alerts).toHaveLength(0);
    });
  });

  describe('defaultRules', () => {
    it('should return an array of rules with required fields', () => {
      const rules = defaultRules();

      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(rule).toHaveProperty('id');
        expect(rule).toHaveProperty('name');
        expect(rule).toHaveProperty('condition');
        expect(rule).toHaveProperty('threshold');
        expect(rule).toHaveProperty('severity');
        expect(['warning', 'critical']).toContain(rule.severity);
        expect(['healthRate_below', 'unhealthy_above', 'agent_missing_file']).toContain(rule.condition);
      }
    });

    it('should include rules for different condition types', () => {
      const rules = defaultRules();
      const conditions = rules.map(r => r.condition);

      expect(conditions).toContain('healthRate_below');
      expect(conditions).toContain('unhealthy_above');
      expect(conditions).toContain('agent_missing_file');
    });

    it('should have unique rule ids', () => {
      const rules = defaultRules();
      const ids = rules.map(r => r.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });
});
