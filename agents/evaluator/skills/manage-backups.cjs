// agents/evaluator/skills/manage-backups.cjs
const fs = require('fs');
const path = require('path');

const BACKUP_ROOT = '.state/backups';

/**
 * Creates a backup of an agent's configuration.
 * @param {string} agentName - The name of the agent (e.g., 'coder').
 * @returns {string} - The timestamp of the created backup.
 */
async function backup(agentName) {
  if (!agentName) throw new Error("Agent name is required.");

  const timestamp = new Date().toISOString().replace(/:/g, '-'); // High res timestamp
  const backupDir = path.join(BACKUP_ROOT, agentName, timestamp);
  const sourceDir = path.join('agents', agentName);

  if (!fs.existsSync(sourceDir)) {
    throw new Error(`Agent directory not found: ${sourceDir}`);
  }

  // Create backup directory
  fs.mkdirSync(backupDir, { recursive: true });

  // Define critical files to backup
  const filesToBackup = [
    'SOUL.md',
    'mission.md',
    'skills' // Directory
  ];

  let backedUpCount = 0;

  for (const item of filesToBackup) {
    const srcPath = path.join(sourceDir, item);
    const destPath = path.join(backupDir, item);

    if (fs.existsSync(srcPath)) {
      if (fs.lstatSync(srcPath).isDirectory()) {
        // Recursive copy for directories
        fs.cpSync(srcPath, destPath, { recursive: true });
      } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
      }
      backedUpCount++;
    }
  }

  if (backedUpCount === 0) {
    // Nothing was backed up - cleanup empty dir
    fs.rmSync(backupDir, { recursive: true, force: true });
    return "No configuration files found to backup.";
  }

  // Rotate old backups (keep last 10)
  const allBackups = fs.readdirSync(path.join(BACKUP_ROOT, agentName))
    .sort()
    .reverse(); // Newest first

  if (allBackups.length > 10) {
    for (let i = 10; i < allBackups.length; i++) {
      const oldBackup = path.join(BACKUP_ROOT, agentName, allBackups[i]);
      fs.rmSync(oldBackup, { recursive: true, force: true });
    }
  }

  return timestamp;
}

/**
 * Lists available backups for an agent.
 * @param {string} agentName - The name of the agent.
 * @returns {string[]} - Array of backup timestamps (ISO strings).
 */
async function list(agentName) {
  if (!agentName) throw new Error("Agent name is required.");
  
  const agentBackupDir = path.join(BACKUP_ROOT, agentName);
  
  if (!fs.existsSync(agentBackupDir)) {
    return [];
  }

  return fs.readdirSync(agentBackupDir).sort().reverse();
}

/**
 * Restores an agent's configuration from a backup.
 * @param {string} agentName - The name of the agent.
 * @param {string} timestamp - The timestamp of the backup to restore (or "latest").
 * @returns {string} - Success message.
 */
async function restore(agentName, timestamp) {
  if (!agentName) throw new Error("Agent name is required.");
  if (!timestamp) throw new Error("Timestamp is required.");

  const agentBackupDir = path.join(BACKUP_ROOT, agentName);
  
  if (!fs.existsSync(agentBackupDir)) {
    throw new Error(`No backups found for agent: ${agentName}`);
  }

  let targetBackup = timestamp;
  if (timestamp === "latest") {
    const backups = await list(agentName);
    if (backups.length === 0) throw new Error("No backups available.");
    targetBackup = backups[0];
  }

  const sourceBackupDir = path.join(agentBackupDir, targetBackup);
  
  if (!fs.existsSync(sourceBackupDir)) {
    throw new Error(`Backup not found: ${targetBackup}`);
  }

  const targetAgentDir = path.join('agents', agentName);

  // Restore files (overwrite existing)
  const filesToRestore = fs.readdirSync(sourceBackupDir);
  
  for (const item of filesToRestore) {
    const srcPath = path.join(sourceBackupDir, item);
    const destPath = path.join(targetAgentDir, item);

    if (fs.lstatSync(srcPath).isDirectory()) {
        // Recursive copy for directories (skills)
        // Note: fs.cpSync with force: true overwrites
        fs.cpSync(srcPath, destPath, { recursive: true, force: true });
    } else {
        // Copy file
        fs.copyFileSync(srcPath, destPath);
    }
  }

  // Log the restoration event
  const logEntry = {
    timestamp: new Date().toISOString(),
    type: "rollback",
    agent: agentName,
    backup: targetBackup,
    files: filesToRestore
  };
  
  const logPath = '.state/ops-receipts.jsonl';
  // Ensure log file exists
  if (!fs.existsSync(logPath)) fs.writeFileSync(logPath, '');
  fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');

  return `Successfully restored ${agentName} from backup ${targetBackup}`;
}

// CLI Entry Point
if (require.main === module) {
  (async () => {
    const [,, command, ...args] = process.argv;
    
    try {
      if (command === 'backup') {
        const agent = args[0];
        if (!agent) throw new Error("Usage: node manage-backups.cjs backup <agent>");
        const ts = await backup(agent);
        console.log(`Backup created: ${ts}`);
      } 
      else if (command === 'list') {
        const agent = args[0];
        if (!agent) throw new Error("Usage: node manage-backups.cjs list <agent>");
        const items = await list(agent); 
        console.log(JSON.stringify(items, null, 2));
      } 
      else if (command === 'restore') {
        const [agent, ts] = args;
        if (!agent) throw new Error("Usage: node manage-backups.cjs restore <agent> [timestamp]");
        const msg = await restore(agent, ts || 'latest');
        console.log(msg);
      } 
      else {
        console.log("Usage: node manage-backups.cjs <backup|list|restore> ...");
      }
    } catch (error) {
      console.error(`Error: ${error.message}`);
      process.exit(1);
    }
  })();
}

module.exports = { backup, list, restore };
