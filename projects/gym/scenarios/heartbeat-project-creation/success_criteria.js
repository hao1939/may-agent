/**
 * Success Criteria Verifier for "heartbeat-project-creation"
 *
 * Tests whether the agent:
 * 1. Recognizes the pattern across 3 low-quality KEs + red metric (not just individual fixes)
 * 2. Creates a project to address the recurring KE quality problem
 * 3. Project has required structure: goal, milestones, metrics
 * 4. Doesn't just dispatch one-off fixes without systemic tracking
 *
 * Ground truth: The correct response is to CREATE A PROJECT for knowledge-entry quality
 * improvement, because:
 * - 3 consecutive C-rated KEs (pattern, not isolated incident)
 * - Metric 🔴 for 3rd consecutive day
 * - Root cause is systemic (missing evidence links, no hypothesis connections, duplicates)
 *
 * Usage: node success_criteria.js <path-to-modified-environment>
 */

const path = require('path');
const fs = require('fs');

const envDir = process.argv[2] || path.join(__dirname, 'environment');

const results = {
  scenario: 'heartbeat-project-creation',
  passed: false,
  checks: [],
  summary: ''
};

function check(name, fn) {
  try {
    const result = fn();
    results.checks.push({ name, passed: result.passed, detail: result.detail });
    return result.passed;
  } catch (err) {
    results.checks.push({ name, passed: false, detail: `Error: ${err.message}` });
    return false;
  }
}

// Helper: find session transcript
function findTranscript() {
  const transcriptInEnv = path.join(envDir, 'transcript.jsonl');
  if (fs.existsSync(transcriptInEnv)) {
    return fs.readFileSync(transcriptInEnv, 'utf-8');
  }
  return '';
}

// Helper: find any project.md files created
function findProjectFiles() {
  const projectsDir = path.join(envDir, '.state', 'projects');
  const found = [];
  if (fs.existsSync(projectsDir)) {
    const dirs = fs.readdirSync(projectsDir);
    for (const d of dirs) {
      const pFile = path.join(projectsDir, d, 'project.md');
      if (fs.existsSync(pFile)) {
        found.push({ slug: d, content: fs.readFileSync(pFile, 'utf-8') });
      }
    }
  }
  // Also check workspace/projects
  const wsProjects = path.join(envDir, 'agents', 'bob', 'workspace', 'projects');
  if (fs.existsSync(wsProjects)) {
    const dirs = fs.readdirSync(wsProjects);
    for (const d of dirs) {
      const pFile = path.join(wsProjects, d, 'project.md');
      if (fs.existsSync(pFile)) {
        found.push({ slug: d, content: fs.readFileSync(pFile, 'utf-8') });
      }
    }
  }
  return found;
}

const transcript = findTranscript();
const projectFiles = findProjectFiles();
const transcriptLower = transcript.toLowerCase();

// Check 1: Agent recognized the PATTERN (not just individual KEs)
check('pattern-recognition', () => {
  // Look for evidence the agent identified this as a recurring/systemic issue
  const patternWords = ['pattern', 'recurring', 'systemic', 'consistent', 'repeated', 'trend', '3 consecutive', 'three consecutive', 'multiple', 'keeps happening'];
  const found = patternWords.some(w => transcriptLower.includes(w.toLowerCase()));
  return {
    passed: found,
    detail: found
      ? 'Agent recognized the recurring pattern in KE quality issues'
      : 'Agent did not identify the KE quality problems as a recurring pattern'
  };
});

// Check 2: Agent created a project file
check('project-created', () => {
  const hasProject = projectFiles.length > 0;
  // Also check transcript for write() calls creating project.md
  const wroteProject = transcriptLower.includes('project.md') && (transcriptLower.includes('write') || transcriptLower.includes('create'));
  const passed = hasProject || wroteProject;
  return {
    passed,
    detail: passed
      ? `Found ${projectFiles.length} project file(s): ${projectFiles.map(p => p.slug).join(', ')}`
      : 'No project file was created'
  };
});

// Check 3: Project is about KE quality (not unrelated)
check('project-relevant-topic', () => {
  if (projectFiles.length === 0) {
    // Check transcript for project creation about quality
    const qualityKeywords = ['quality', 'ke quality', 'knowledge entry', 'knowledge-entry', 'evidence', 'grading'];
    const relevant = qualityKeywords.some(w => {
      const idx = transcriptLower.indexOf('project');
      if (idx === -1) return false;
      const nearby = transcriptLower.substring(Math.max(0, idx - 200), idx + 200);
      return nearby.includes(w);
    });
    return { passed: relevant, detail: relevant ? 'Project appears related to KE quality' : 'Could not confirm project topic' };
  }
  const content = projectFiles.map(p => p.content.toLowerCase()).join(' ');
  const relevant = content.includes('quality') || content.includes('knowledge entry') || content.includes('evidence') || content.includes('grading');
  return {
    passed: relevant,
    detail: relevant ? 'Project addresses KE quality issues' : 'Project does not appear related to KE quality'
  };
});

// Check 4: Project has structure (goal + milestones)
check('project-has-structure', () => {
  if (projectFiles.length === 0) {
    return { passed: false, detail: 'No project file to check structure' };
  }
  const content = projectFiles[0].content.toLowerCase();
  const hasGoal = content.includes('goal') || content.includes('objective') || content.includes('purpose');
  const hasMilestones = content.includes('milestone') || content.includes('phase') || content.includes('step');
  const passed = hasGoal && hasMilestones;
  return {
    passed,
    detail: `Goal: ${hasGoal ? '✅' : '❌'}, Milestones: ${hasMilestones ? '✅' : '❌'}`
  };
});

// Check 5: Agent didn't ONLY do one-off fixes (should have systemic response)
check('not-only-oneoff-fixes', () => {
  // If they created a project, they clearly went beyond one-off
  if (projectFiles.length > 0) {
    return { passed: true, detail: 'Agent created a project (systemic response)' };
  }
  // If transcript shows only individual KE edits without project creation, that's a fail
  const editedKEs = (transcriptLower.match(/ke-40[123]/g) || []).length;
  const mentionedProject = transcriptLower.includes('project');
  if (editedKEs > 0 && !mentionedProject) {
    return { passed: false, detail: `Agent edited ${editedKEs} KEs but didn't create a project for systemic fix` };
  }
  return { passed: mentionedProject, detail: mentionedProject ? 'Agent at least considered project creation' : 'No systemic response detected' };
});

// Check 6: finish() called with meaningful summary
check('finish-called', () => {
  const hasFinish = transcriptLower.includes('finish');
  return {
    passed: hasFinish,
    detail: hasFinish ? 'finish() was called' : 'finish() was not called'
  };
});

// Score
const passed = results.checks.filter(c => c.passed).length;
const total = results.checks.length;
results.passed = passed >= 4; // Need at least 4/6 to pass
results.summary = `${passed}/${total} checks passed. ${results.passed ? 'PASS' : 'FAIL'}. ` +
  `Key: ${projectFiles.length > 0 ? 'Project created ✅' : 'No project created ❌'}`;

console.log(JSON.stringify(results, null, 2));
process.exit(results.passed ? 0 : 1);
