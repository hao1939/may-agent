// agents/evaluator/skills/drift-controller.cjs
const { backup, restore, list } = require('./manage-backups.cjs');
const { analyzeDrift } = require('./detect-drift.cjs');
const fs = require('fs');
const path = require('path');

const BULLETIN_FILE = 'agents/shared/bulletin.md';

/**
 * Orchestrates the response to statistical drift.
 * Acts as the "Circuit Breaker" for the system.
 */
async function enforceStability() {
  const receiptsPath = '.state/ops-receipts.jsonl';
  
  if (!fs.existsSync(receiptsPath)) {
    console.log("No ops receipts found. Skipping drift check.");
    return;
  }

  // 1. Detect Drift
  const receipts = fs.readFileSync(receiptsPath, 'utf8')
    .split('\n')
    .filter(l => l.trim())
    .map(l => {
      try { return JSON.parse(l); } catch (e) { return null; }
    })
    .filter(r => r);

  const report = analyzeDrift(receipts);

  if (!report || report.verdict === 'stable') {
    console.log("System stable. No drift detected.");
    return;
  }

  // 2. Identify Failing Agents
  const driftItems = report.details.filter(d => d.status === 'drift');
  
  for (const item of driftItems) {
    await handleDrift(item);
  }
}

/**
 * Handles a specific drift instance for an agent.
 * @param {Object} item - The drift report item { agent, tool, drift, ... }
 */
async function handleDrift(item) {
  const agent = item.agent;
  const driftPercent = Math.abs(item.delta * 100).toFixed(1);
  
  console.log(`⚠️ CRITICAL DRIFT: ${agent} (${item.tool}) degraded by ${driftPercent}%`);

  try {
    // A. Quarantine Current State (for forensics)
    await backup(agent); 
    // Note: backup() creates a timestamped folder. We should ideally mark it as "quarantine", 
    // but for now timestamp is enough context given the log message.

    // B. Find Last Known Good State
    const backups = await list(agent);
    
    // Simplification: We assume the *previous* backup is good. 
    // In a real system, we'd check if that backup was also flagged.
    // Index 0 is the one we just made (quarantine). Index 1 is the previous one.
    if (backups.length < 2) {
      logToBulletin(`⚠️ DRIFT ALERT: ${agent} degraded by ${driftPercent}%, but no previous backup found to restore.`);
      return;
    }

    const targetBackup = backups[1]; // Restore the one BEFORE the current state

    // C. Revert
    await restore(agent, targetBackup);

    // D. Alert
    const message = `🚨 **AUTOMATED REVERT**: Rolled back **${agent}** to snapshot \`${targetBackup}\` due to **${driftPercent}% performance degradation** in \`${item.tool}\`.`;
    logToBulletin(message);

  } catch (error) {
    console.error(`Failed to handle drift for ${agent}:`, error);
    logToBulletin(`❌ DRIFT RECOVERY FAILED: Could not restore ${agent} due to error: ${error.message}`);
  }
}

function logToBulletin(message) {
  const timestamp = new Date().toISOString().split('T')[0];
  const entry = `- **${timestamp}**: ${message}\n`;
  
  if (fs.existsSync(BULLETIN_FILE)) {
    fs.appendFileSync(BULLETIN_FILE, entry);
  } else {
    fs.writeFileSync(BULLETIN_FILE, `# Bulletin\n\n${entry}`);
  }
}

module.exports = { enforceStability };
