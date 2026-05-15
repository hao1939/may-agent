const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Safe Rollback Protocol
// Only allows reverting changes to Markdown files within agent directories.
// Aborts if the commit touches code or config files.

function run(cmd) {
  try {
    return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch (e) {
    throw new Error(`Command failed: ${cmd}\n${e.stderr}`);
  }
}

module.exports = async function revertChange({ filePath }) {
  // 1. Validate Path
  if (!filePath.startsWith('agents/') || !filePath.endsWith('.md')) {
    return "ERROR: unsafe_target. Only Markdown files in agents/ are allowed.";
  }
  
  if (!fs.existsSync(filePath)) {
    return `ERROR: file_not_found. ${filePath} does not exist.`;
  }

  try {
    // 2. Identify Commit
    // Get the last commit that touched this file
    const commitHash = run(`git log -n 1 --pretty=format:%H -- "${filePath}"`);
    
    if (!commitHash) {
      return "ERROR: no_history. No git history found for this file.";
    }

    // 3. Safety Check: Mixed Commits
    // Ensure the commit ONLY touched safe files.
    // If it touched src/ or .json, reverting it might break the build.
    const changedFiles = run(`git show --name-only --format= ${commitHash}`).split('\n').filter(Boolean);
    
    const unsafeFiles = changedFiles.filter(f => !f.startsWith('agents/') || !f.endsWith('.md'));
    
    if (unsafeFiles.length > 0) {
      return `ERROR: mixed_commit. Commit ${commitHash.substring(0,7)} also touches unsafe files (${unsafeFiles[0]}). Human intervention required.`;
    }

    // 4. Revert
    // Try to revert safely
    try {
      run(`git revert --no-edit ${commitHash}`);
    } catch (e) {
      // If revert fails (likely conflicts), abort immediately
      try { run(`git revert --abort`); } catch (_) {}
      return `ERROR: revert_conflict. Revert failed due to merge conflicts. Aborted.`;
    }

    // 5. Push (optional, depending on workflow, but standard for automated ops)
    // In this environment, we might just want to leave it staged/committed for review?
    // The design says "Push".
    // run(`git push`); // Commented out for safety during initial prototype - let the human/process decide to push.
    // Actually, for a self-healing system, it needs to apply. But let's stop at commit for now to be safe.
    
    // 6. Log
    const logEntry = {
      timestamp: new Date().toISOString(),
      file: filePath,
      commit: commitHash,
      reason: "DRIFT_REVERSION"
    };
    const logPath = 'agents/evaluator/revert-log.jsonl';
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

    return `SUCCESS: Reverted ${filePath} to state before commit ${commitHash.substring(0,7)}. Change committed locally. Verify and push.`;

  } catch (error) {
    return `ERROR: system_error. ${error.message}`;
  }
};
