import { describe, it, expect, vi } from 'vitest';

// Mock fs before importing
vi.mock('fs', async () => {
  const actual = await vi.importActual('fs');
  return {
    ...actual as any,
    existsSync: vi.fn(() => false),
    readFileSync: vi.fn(() => ''),
  };
});

import { existsSync, readFileSync } from 'fs';
import {
  diagnoseProject,
  newProjectHealthEntry,
  readHealthState,
  writeHealthState,
  readInflight,
  writeInflight,
  generateRunId,
  simpleHash,
  updateField,
  appendComment,
  scanAllProjects,
} from '../lib/project-health.js';
import type { ProjectInfo, HealthState, HealthAction } from '../lib/project-health.js';

function makeProject(overrides: Partial<ProjectInfo> = {}): ProjectInfo {
  return {
    owner: 'test',
    relPath: 'test/project',
    projectFile: '/agents/test/projects/project/project.md',
    status: 'active',
    content: '# Test\n\nStatus: active\n',
    ...overrides,
  } as ProjectInfo;
}

describe('project-health extended', () => {
  describe('diagnoseProject', () => {
    const emptyHealth: HealthState = { projects: {} };
    const emptyBreached = new Set<string>();
    const emptyRunning = new Set<string>();
    const now = Date.now();

    it('returns skip for closed project without comments', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'closed' });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.reason).toContain('closed');
    });

    it('reopens closed project with unread comments', () => {
      (existsSync as any).mockReturnValue(true);
      (readFileSync as any).mockReturnValue('# Discussion\nHey can you fix this?');
      const p = makeProject({ status: 'closed' });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('launch-workflow');
      expect(result.reason).toContain('unread comments');
    });

    it('treats done/complete as terminal status', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'done' as any });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.reason).toContain('terminal status');
    });

    it('escalates waiting project stopped >24h', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'waiting' });
      const health: HealthState = {
        projects: {
          'test/project': {
            ...newProjectHealthEntry(),
            lastStatusChange: now - 25 * 60 * 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(p, health, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('escalate');
      expect(result.reason).toContain('needs human attention');
    });

    it('escalates waiting project stopped >2h', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'waiting' });
      const health: HealthState = {
        projects: {
          'test/project': {
            ...newProjectHealthEntry(),
            lastStatusChange: now - 3 * 60 * 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(p, health, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('escalate');
      expect(result.reason).toContain('needs review');
    });

    it('skips waiting project recently stopped', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'waiting' });
      const health: HealthState = {
        projects: {
          'test/project': {
            ...newProjectHealthEntry(),
            lastStatusChange: now - 30 * 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(p, health, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('waiting');
    });

    it('launches workflow for waiting project with unread comments', () => {
      (existsSync as any).mockReturnValue(true);
      (readFileSync as any).mockReturnValue('# Discussion\n---read @bot\nNew comment here');
      const p = makeProject({ status: 'waiting' });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('launch-workflow');
      expect(result.reason).toContain('unread comments');
    });

    it('launches workflow for active project without live session', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'active' });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('launch-workflow');
    });

    it('skips active project with live session', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'active' });
      const running = new Set(['test/project']);
      const result = diagnoseProject(p, emptyHealth, emptyBreached, running, now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('live session');
    });

    it('skips active project in cooldown', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'active' });
      const health: HealthState = {
        projects: {
          'test/project': {
            ...newProjectHealthEntry(),
            lastLaunch: now - 30_000, // 30s ago
          },
        },
      };
      const result = diagnoseProject(p, health, emptyBreached, emptyRunning, now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('cooldown');
    });

    it('handles blocked status same as waiting', () => {
      (existsSync as any).mockReturnValue(false);
      const p = makeProject({ status: 'blocked' });
      const result = diagnoseProject(p, emptyHealth, emptyBreached, emptyRunning, now, []);
      expect(result.reason).toContain('blocked');
    });
  });

  describe('utility functions', () => {
    it('updateField replaces field value', () => {
      const content = '# Project\n**Status**: active\n**Priority**: high\n';
      const result = updateField(content, 'Status', 'done');
      expect(result).toContain('status: done');
      expect(result).toContain('**Priority**: high');
    });

    it('appendComment adds to content', () => {
      const content = '# Project\n\n## Comments\n';
      const result = appendComment(content, 'New comment');
      expect(result).toContain('New comment');
    });

    it('newProjectHealthEntry returns valid entry', () => {
      const entry = newProjectHealthEntry();
      expect(entry).toBeDefined();
      expect(entry.lastLaunch).toBe(0);
    });

    it('generateRunId returns string', () => {
      const id = generateRunId();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    it('simpleHash returns consistent hash', () => {
      const h1 = simpleHash('test');
      const h2 = simpleHash('test');
      expect(h1).toBe(h2);
      expect(simpleHash('other')).not.toBe(h1);
    });
  });
});
