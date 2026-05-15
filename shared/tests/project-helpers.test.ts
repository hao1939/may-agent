import { describe, it, expect, vi } from 'bun:test';
import {
  extractField,
  extractSection,
  extractMilestones,
  checkOffMilestones,
  extractComments,
  clearComments,
  updateProjectStatus,
} from '../workflows/project-helpers';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('project-helpers', () => {
  describe('extractField', () => {
    it('extracts existing field', () => {
      expect(extractField('**Status**: active\n**Owner**: bob', 'Status')).toBe('active');
    });

    it('returns empty for missing field', () => {
      expect(extractField('No fields here', 'Status')).toBe('');
    });

    it('trims whitespace', () => {
      expect(extractField('**Name**:   spaced   ', 'Name')).toBe('spaced');
    });
  });

  describe('extractSection', () => {
    it('extracts section content', () => {
      const md = '## Plan\n- item 1\n- item 2\n## Other\nstuff';
      expect(extractSection(md, 'Plan')).toBe('- item 1\n- item 2');
    });

    it('returns empty for missing section', () => {
      expect(extractSection('no sections', 'Plan')).toBe('');
    });

    it('extracts to end if no following section', () => {
      const md = '## Plan\n- item 1\n- item 2';
      expect(extractSection(md, 'Plan')).toBe('- item 1\n- item 2');
    });
  });

  describe('extractMilestones', () => {
    it('extracts completed and pending milestones', () => {
      const md = '## Plan\n- [x] Done thing\n- [ ] Todo thing\n- [x] Another done';
      const result = extractMilestones(md);
      expect(result.total).toBe(3);
      expect(result.done).toBe(2);
      expect(result.completed).toContain('Done thing');
      expect(result.pending).toContain('Todo thing');
    });

    it('handles empty plan', () => {
      const result = extractMilestones('# Project\nNo plan here');
      expect(result.total).toBe(0);
      expect(result.done).toBe(0);
    });

    it('falls back to Milestones section', () => {
      const md = '## Milestones\n- [x] M1\n- [ ] M2';
      const result = extractMilestones(md);
      expect(result.total).toBe(2);
      expect(result.done).toBe(1);
    });
  });

  describe('checkOffMilestones', () => {
    it('checks off milestone by text match', () => {
      const content = '## Plan\n- [ ] Build the thing\n- [ ] Test it\n';
      const review = '✅ Build the thing';
      const result = checkOffMilestones(content, review);
      expect(result).toContain('[x] Build the thing');
      expect(result).toContain('[ ] Test it');
    });

    it('checks off milestone by index (M1, M2)', () => {
      const content = '## Plan\n- [ ] First milestone\n- [ ] Second milestone\n';
      const review = 'M1: Done, M2: Complete';
      const result = checkOffMilestones(content, review);
      expect(result).toContain('[x] First milestone');
      expect(result).toContain('[x] Second milestone');
    });

    it('returns unchanged content if no matches', () => {
      const content = '## Plan\n- [ ] Build\n';
      const result = checkOffMilestones(content, 'Nothing relevant');
      expect(result).toBe(content);
    });

    it('handles milestone completed pattern', () => {
      const content = '## Plan\n- [ ] Setup CI\n- [ ] Deploy\n';
      const review = 'milestone completed: Setup CI';
      const result = checkOffMilestones(content, review);
      expect(result).toContain('[x] Setup CI');
    });
  });

  describe('extractComments', () => {
    it('extracts comments section', () => {
      const md = '## Comments\n- comment 1\n- comment 2\n## Other';
      expect(extractComments(md)).toBe('- comment 1\n- comment 2');
    });

    it('returns empty if no comments', () => {
      expect(extractComments('# Project\nNo comments')).toBe('');
    });
  });

  describe('clearComments', () => {
    it('clears comments section content', () => {
      const md = '## Comments\n- old\n## Next';
      const result = clearComments(md);
      expect(result).not.toContain('- old');
      expect(result).toContain('## Next');
    });

    it('returns unchanged if no comments section', () => {
      const md = '# Project\nContent';
      expect(clearComments(md)).toBe(md);
    });
  });

  describe('updateProjectStatus', () => {
    it('updates status in file', () => {
      const tmpFile = join(tmpdir(), `proj-status-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, '**Status**: active\n**Iteration**: 1\n');
      updateProjectStatus(tmpFile, 'blocked', 'API down', 5);
      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('**Status**: blocked');
      expect(content).toContain('**Stop Reason**: API down');
      expect(content).toContain('**Iteration**: 5');
      fs.unlinkSync(tmpFile);
    });

    it('adds Stop Reason if not present', () => {
      const tmpFile = join(tmpdir(), `proj-status2-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, '**Status**: active\n');
      updateProjectStatus(tmpFile, 'blocked', 'timeout');
      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('**Stop Reason**: timeout');
      fs.unlinkSync(tmpFile);
    });

    it('works without stopReason or iteration', () => {
      const tmpFile = join(tmpdir(), `proj-status3-${Date.now()}.md`);
      fs.writeFileSync(tmpFile, '**Status**: active\n');
      updateProjectStatus(tmpFile, 'done');
      const content = fs.readFileSync(tmpFile, 'utf-8');
      expect(content).toContain('**Status**: done');
      fs.unlinkSync(tmpFile);
    });
  });
});
