import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  updateField,
  appendComment,
  scanAllProjects,
  diagnoseProject,
  newProjectHealthEntry,
  readHealthState,
  writeHealthState,
  readInflight,
  writeInflight,
  generateRunId,
  saveWorkflowRunFile,
  simpleHash,
  upsertProject,
  validateProjectFormat,
  MAX_LAUNCHES_PER_TICK,
  type ProjectInfo,
  type HealthState,
  type HealthAction,
} from '../lib/project-health';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('node:fs', async () => {
  const actual = await vi.importActual('node:fs');
  return { ...actual };
});

describe('project-health', () => {
  describe('updateField', () => {
    it('updates existing field', () => {
      const content = '---\nid: test\nowner: bob\nstatus: active\n---\n\n# Project\n';
      const result = updateField(content, 'Status', 'blocked');
      expect(result).toContain('status: blocked');
      expect(result).toContain('owner: bob');
    });

    it('adds field if not present', () => {
      const content = '# Project\nSome content';
      const result = updateField(content, 'Status', 'active');
      expect(result).toContain('status: active');
      expect(result).toContain('# Project');
    });
  });

  describe('validateProjectFormat', () => {
    it('accepts canonical shared project frontmatter', () => {
      const content = '---\nid: test-proj\nowner: bob\nstatus: active\n---\n\n# Test\n';
      expect(validateProjectFormat(content, 'test-proj')).toEqual([]);
    });

    it('rejects legacy bold metadata in shared projects', () => {
      const content = '# Test\n\n**Owner:** bob\n**Status:** active\n';
      expect(validateProjectFormat(content, 'test-proj')).toEqual(expect.arrayContaining([
        'missing YAML frontmatter',
        'missing frontmatter field: id',
        'missing frontmatter field: owner',
        'missing frontmatter field: status',
        'metadata duplicated as bold body field',
      ]));
    });
  });

  describe('appendComment', () => {
    it('appends to existing Comments section', () => {
      const content = '# Project\n## Comments\n- old comment\n';
      const result = appendComment(content, 'new comment');
      expect(result).toContain('new comment');
      expect(result).toContain('old comment');
    });

    it('creates Comments section if missing', () => {
      const content = '# Project\nContent here';
      const result = appendComment(content, 'first comment');
      expect(result).toContain('## Comments');
      expect(result).toContain('first comment');
    });
  });

  describe('diagnoseProject', () => {
    const baseProject: ProjectInfo = {
      relPath: 'shared/projects/test-proj',
      projectFile: '/tmp/test-proj/project.md',
      content: '# Test\n**Status**: active\n**Owner**: bob',
      status: 'active',
      owner: 'bob',
      blockerReason: '',
      workflow: 'master-worker',
    };

    const emptyState: HealthState = { lastFullScan: 0, projects: {} };

    it('returns skip for closed projects', () => {
      const proj = { ...baseProject, status: 'closed' };
      const result = diagnoseProject(proj, emptyState, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('closed');
    });

    it('returns launch-workflow for active projects', () => {
      const result = diagnoseProject(baseProject, emptyState, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('launch-workflow');
    });

    it('skips active project if already running', () => {
      const running = new Set(['bob/test-proj']);
      const result = diagnoseProject(baseProject, emptyState, new Set(), running, Date.now(), []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('live session');
    });

    it('skips active project during cooldown', () => {
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastLaunch: Date.now() - 30_000, // 30s ago — within 60s cooldown
          },
        },
      };
      const result = diagnoseProject(baseProject, state, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('cooldown');
    });

    it('force launches active project despite cooldown', () => {
      const now = Date.now();
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastLaunch: now - 30_000,
          },
        },
      };
      const result = diagnoseProject(baseProject, state, new Set(), new Set(), now, [], true);
      expect(result.type).toBe('launch-workflow');
      expect(result.reason).toContain('manual project trigger');
    });

    it('launches paused project only when explicit comments are pending', () => {
      const proj = {
        ...baseProject,
        status: 'paused',
        content: '# Test\n## Comments\n- resume with new evidence\n',
      };
      const result = diagnoseProject(proj, emptyState, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('launch-workflow');
      expect(result.reason).toContain('paused with unread comments');
    });

    it('keeps waiting project stopped until resume_after is due', () => {
      const now = Date.now();
      const proj = {
        ...baseProject,
        status: 'waiting',
        content: `---\nresume_after: ${new Date(now + 60_000).toISOString()}\n---\n# Test\n`,
      };
      const result = diagnoseProject(proj, emptyState, new Set(), new Set(), now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('until');
    });

    it('launches waiting project when resume_after is due', () => {
      const now = Date.now();
      const proj = {
        ...baseProject,
        status: 'waiting',
        content: `---\nresume_after: ${new Date(now - 60_000).toISOString()}\n---\n# Test\n`,
      };
      const result = diagnoseProject(proj, emptyState, new Set(), new Set(), now, []);
      expect(result.type).toBe('launch-workflow');
      expect(result.reason).toContain('resume_after is due');
    });

    it('does not escalate waiting project with a resume condition', () => {
      const proj = {
        ...baseProject,
        status: 'waiting',
        content: '---\nresume_condition: metric breaches again\n---\n# Test\n',
      };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastStatusChange: Date.now() - 3 * 60 * 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('resume condition');
    });

    it('escalates blocked projects after 2+ hours', () => {
      const proj = { ...baseProject, status: 'blocked' };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastStatusChange: Date.now() - 3 * 60 * 60 * 1000, // 3 hours ago
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('escalate');
    });

    it('skips repeated escalations during cooldown', () => {
      const now = Date.now();
      const proj = { ...baseProject, status: 'blocked' };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastStatusChange: now - 3 * 60 * 60 * 1000,
            lastEscalation: now - 10 * 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('escalation cooldown');
    });

    it('rate limits closed projects with unread comments', () => {
      const now = Date.now();
      const tmpDir = path.join(tmpdir(), `closed-unread-${now}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      const projectFile = path.join(tmpDir, 'project.md');
      fs.writeFileSync(projectFile, '# Test\n**Status**: closed\n');
      fs.writeFileSync(path.join(tmpDir, 'discussion.md'), '# Discussion\nPlease revisit this\n');
      const proj = { ...baseProject, status: 'closed', projectFile };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastLaunch: now - 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), now, []);
      expect(result.type).toBe('skip');
      expect(result.reason).toContain('cooldown');
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('skips waiting project within 2 hours', () => {
      const proj = { ...baseProject, status: 'waiting' };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastStatusChange: Date.now() - 30 * 60 * 1000, // 30 min ago
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('skip');
    });

    it('treats done/complete as waiting', () => {
      const proj = { ...baseProject, status: 'done' };
      const state: HealthState = {
        lastFullScan: 0,
        projects: {
          'shared/projects/test-proj': {
            ...newProjectHealthEntry(),
            lastStatusChange: Date.now() - 60 * 1000,
          },
        },
      };
      const result = diagnoseProject(proj, state, new Set(), new Set(), Date.now(), []);
      expect(result.type).toBe('skip');
    });
  });

  describe('newProjectHealthEntry', () => {
    it('returns zeroed entry', () => {
      const entry = newProjectHealthEntry();
      expect(entry.blockerHash).toBe('');
      expect(entry.consecutiveSkips).toBe(0);
      expect(entry.reactivationAttempts).toBe(0);
      expect(entry.lastEscalation).toBe(0);
      expect(entry.lastLaunch).toBe(0);
    });
  });

  describe('readHealthState', () => {
    it('returns empty state for non-existent file', () => {
      const state = readHealthState('/nonexistent/path/state.json');
      expect(state.lastFullScan).toBe(0);
      expect(state.projects).toEqual({});
    });

    it('reads valid JSON file', () => {
      const tmpFile = path.join(tmpdir(), `health-test-${Date.now()}.json`);
      const data: HealthState = { lastFullScan: 12345, projects: {} };
      fs.writeFileSync(tmpFile, JSON.stringify(data));
      const state = readHealthState(tmpFile);
      expect(state.lastFullScan).toBe(12345);
      fs.unlinkSync(tmpFile);
    });
  });

  describe('writeHealthState', () => {
    it('writes state to file', () => {
      const tmpFile = path.join(tmpdir(), `health-write-${Date.now()}.json`);
      const state: HealthState = { lastFullScan: 999, projects: {} };
      writeHealthState(tmpFile, state);
      const read = JSON.parse(fs.readFileSync(tmpFile, 'utf-8'));
      expect(read.lastFullScan).toBe(999);
      fs.unlinkSync(tmpFile);
    });
  });

  describe('readInflight / writeInflight', () => {
    it('round-trips inflight set', () => {
      const tmpFile = path.join(tmpdir(), `inflight-${Date.now()}.txt`);
      const set = new Set(['proj-a', 'proj-b']);
      writeInflight(tmpFile, set);
      const result = readInflight(tmpFile);
      expect(result.has('proj-a')).toBe(true);
      expect(result.has('proj-b')).toBe(true);
      fs.unlinkSync(tmpFile);
    });

    it('returns empty set for missing file', () => {
      const result = readInflight('/nonexistent/inflight.txt');
      expect(result.size).toBe(0);
    });
  });

  describe('generateRunId', () => {
    it('returns a 16-char hex string', () => {
      const id = generateRunId();
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set(Array.from({ length: 10 }, () => generateRunId()));
      expect(ids.size).toBe(10);
    });
  });

  describe('simpleHash', () => {
    it('returns 8-char hex for non-empty string', () => {
      const hash = simpleHash('hello');
      expect(hash).toMatch(/^[0-9a-f]{8}$/);
    });

    it('returns empty string for empty input', () => {
      expect(simpleHash('')).toBe('');
    });

    it('returns same hash for same input', () => {
      expect(simpleHash('test')).toBe(simpleHash('test'));
    });
  });

  describe('saveWorkflowRunFile', () => {
    it('saves JSON file in .state/workflow-runs/', () => {
      const tmpDir = path.join(tmpdir(), `proj-${Date.now()}`);
      fs.mkdirSync(tmpDir, { recursive: true });
      saveWorkflowRunFile(tmpDir, { runId: 'abc123', status: 'done' });
      const file = path.join(tmpDir, '.state', 'workflow-runs', 'abc123.json');
      expect(fs.existsSync(file)).toBe(true);
      const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
      expect(data.status).toBe('done');
      fs.rmSync(tmpDir, { recursive: true });
    });
  });

  describe('scanAllProjects', () => {
    it('returns empty array for non-existent root', () => {
      const projects = scanAllProjects('/nonexistent/agents/root');
      expect(projects).toEqual([]);
    });

    it('scans shared projects directory', () => {
      const tmpRoot = path.join(tmpdir(), `agents-${Date.now()}`);
      const projDir = path.join(tmpRoot, 'shared', 'projects', 'my-proj');
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(
        path.join(projDir, 'project.md'),
        '---\nid: my-proj\nowner: alice\nstatus: active\nworkflow: master-worker\n---\n\n# My Project\n'
      );
      const projects = scanAllProjects(tmpRoot);
      expect(projects.length).toBe(1);
      expect(projects[0].status).toBe('active');
      expect(projects[0].owner).toBe('alice');
      expect(projects[0].formatErrors).toEqual([]);
      fs.rmSync(tmpRoot, { recursive: true });
    });

    it('flags shared projects with legacy metadata format', () => {
      const tmpRoot = path.join(tmpdir(), `agents-${Date.now()}`);
      const projDir = path.join(tmpRoot, 'shared', 'projects', 'legacy-proj');
      fs.mkdirSync(projDir, { recursive: true });
      fs.writeFileSync(
        path.join(projDir, 'project.md'),
        '# Legacy Project\n\n**Owner:** alice\n**Status:** active\n'
      );
      const projects = scanAllProjects(tmpRoot);
      expect(projects.length).toBe(1);
      expect(projects[0].owner).toBe('unknown');
      expect(projects[0].formatErrors).toContain('missing YAML frontmatter');
      fs.rmSync(tmpRoot, { recursive: true });
    });

  });

  describe('upsertProject', () => {
    it('calls db.run with correct params', () => {
      const mockDb = { run: vi.fn() };
      const proj: ProjectInfo = {
        relPath: 'shared/projects/test-proj',
        projectFile: '/tmp/test/project.md',
        content: '---\nid: test-proj\nname: Test Project\nowner: bob\nstatus: active\n---\n\n# Test\n- [x] Done\n- [ ] Todo\n',
        status: 'active',
        owner: 'bob',
        blockerReason: '',
        workflow: 'master-worker',
      };
      // Mock statSync
      vi.spyOn(fs, 'statSync').mockReturnValue({ mtimeMs: 1000 } as any);
      upsertProject(mockDb, proj);
      expect(mockDb.run).toHaveBeenCalledTimes(1);
      const args = mockDb.run.mock.calls[0][1];
      expect(args[0]).toBe('test-proj'); // id
      expect(args[2]).toBe('Test Project'); // name
      expect(args[3]).toBe('bob'); // owner
      expect(args[9]).toBe(1); // milestones_done
      expect(args[10]).toBe(2); // milestones_total
      vi.restoreAllMocks();
    });
  });

  describe('MAX_LAUNCHES_PER_TICK', () => {
    it('is 3', () => {
      expect(MAX_LAUNCHES_PER_TICK).toBe(3);
    });
  });
});
