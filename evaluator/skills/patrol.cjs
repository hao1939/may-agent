const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Helper Functions ---

function getTimestamp() {
  return new Date().toISOString();
}

function calculateHash(filePath) {
  try {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
  } catch (error) {
    return null; // File might not exist
  }
}

function readJson(filePath) {
  try {
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Error reading JSON ${filePath}:`, error.message);
    return null;
  }
}

function readJsonl(filePath) {
    try {
        if (!fs.existsSync(filePath)) return [];
        const content = fs.readFileSync(filePath, 'utf8');
        return content.trim().split('\n').map(line => {
            try { return JSON.parse(line); } catch (e) { return null; }
        }).filter(Boolean);
    } catch (error) {
        console.error(`Error reading JSONL ${filePath}:`, error.message);
        return [];
    }
}


// --- Core Patrol Logic ---

async function patrol() {
  const report = {
    timestamp: getTimestamp(),
    status: "OK",
    l3_integrity: [],
    l4_coordination: [],
    alerts: []
  };

  // 1. L3 Integrity Check (Hash Patrol)
  const snapshotPath = path.resolve('agents/shared/compliance-snapshot.json');
  const snapshot = readJson(snapshotPath);

  if (!snapshot) {
    report.l3_integrity.push({ error: "Missing compliance-snapshot.json" });
    report.status = "CRITICAL";
  } else {
    for (const file of snapshot.files) {
      const fullPath = path.resolve(file.path);
      const currentHash = calculateHash(fullPath);
      
      if (!currentHash) {
         report.l3_integrity.push({ file: file.path, error: "File Missing" });
         report.status = "CRITICAL";
      } else if (currentHash !== file.hash) {
         report.l3_integrity.push({ 
             file: file.path, 
             error: "Hash Mismatch", 
             expected: file.hash, 
             actual: currentHash 
         });
         report.status = "CRITICAL"; // Tampering detected
      }
    }
  }

  // 2. L4 Coordination Check (Orphan Patrol)
  // Assuming .state/delegations.jsonl contains { id, from, to, status, timestamp, ... }
  // Assuming agents/{agent}/heartbeat.md timestamp logic (future enhancement)
  // For now, we check for stuck delegations.
  
  const delegationsPath = path.resolve('.state/delegations.jsonl');
  const delegations = readJsonl(delegationsPath);
  
  // Filter for active items
  const activeDelegations = delegations.filter(d => d.status === 'active' || d.status === 'pending');
  
  const now = Date.now();
  const STUCK_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes
  
  for (const d of activeDelegations) {
      const startTime = new Date(d.timestamp).getTime();
      if (now - startTime > STUCK_THRESHOLD_MS) {
          report.l4_coordination.push({
              id: d.id,
              from: d.from,
              to: d.to,
              error: "Stuck Task",
              duration_minutes: Math.round((now - startTime) / 60000)
          });
          if (report.status !== "CRITICAL") report.status = "WARNING";
      }
  }

  // 3. Generate Alerts
  const l3MissingBaselineOnly =
    report.l3_integrity.length === 1 &&
    report.l3_integrity[0] &&
    report.l3_integrity[0].error === "Missing compliance-snapshot.json";

  if (report.l3_integrity.length > 0) {
    if (l3MissingBaselineOnly) {
      report.alerts.push(
        "⚠️ [L3 INTEGRITY] Missing compliance-snapshot.json baseline (integrity patrol degraded — not a hash mismatch event)."
      );
    } else {
      report.alerts.push(
        `🚨 [L3 INTEGRITY] ${report.l3_integrity.length} integrity issue(s) detected (hash mismatch / missing file).`
      );
    }
  }
  if (report.l4_coordination.length > 0) {
    report.alerts.push(`⚠️ [L4 COORDINATION] ${report.l4_coordination.length} stuck tasks detected.`);
  }

  return report;
}

// --- CLI Runner ---
if (require.main === module) {
    patrol().then(report => {
        console.log(JSON.stringify(report, null, 2));
        if (report.status !== "OK") {
            process.exit(1); // Signal failure to caller
        }
    }).catch(err => {
        console.error(err);
        process.exit(1);
    });
}

module.exports = { patrol };
