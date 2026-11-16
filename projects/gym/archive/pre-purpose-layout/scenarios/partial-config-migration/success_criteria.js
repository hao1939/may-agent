/**
 * Success criteria for partial-config-migration scenario.
 * 
 * The task: migrate config.ini to config.yaml following schema.yaml and migration-notes.md
 * 
 * Key traps (designed to produce ~25-35% baseline):
 * 1. timeout: 30 (seconds) must become timeout_ms: 30000 (milliseconds)
 * 2. retry_count: 0 (legacy = unlimited) must become max_attempts: -1 (not 0)
 * 3. retry_delay: 2 (seconds) must become delay_ms: 2000 (milliseconds) 
 * 4. host:port must be split into separate fields
 * 5. scopes must be list, not string
 * 6. Several field renames
 * 
 * Expected baseline: ~25-35% pass (all checks must pass)
 * Most agents will get basic structure right but miss unit conversions or retry semantics
 */

const { Score } = require("@may-agent/gym/scoring");

const workDir = process.argv[2];
const s = new Score(workDir);

// Helper to parse YAML-like content (simple key-value extraction)
function parseSimpleYaml(content) {
  const result = {};
  const lines = content.split('\n');
  let currentSection = null;
  let currentSubsection = null;
  
  for (const line of lines) {
    const trimmed = line.replace(/#.*$/, '').trim();
    if (!trimmed) continue;
    
    const indent = line.search(/\S/);
    
    // Top-level section (no indent or 0 indent)
    if (indent === 0 && trimmed.endsWith(':') && !trimmed.includes(' ')) {
      currentSection = trimmed.replace(':', '');
      currentSubsection = null;
      result[currentSection] = {};
      continue;
    }
    
    // Sub-section (2-space indent, ends with colon, no value)
    if (indent === 2 && trimmed.endsWith(':') && !trimmed.includes(': ')) {
      currentSubsection = trimmed.replace(':', '');
      if (currentSection) {
        result[currentSection][currentSubsection] = {};
      }
      continue;
    }
    
    // Key-value pair
    const kvMatch = trimmed.match(/^([^:]+):\s*(.+)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      let value = kvMatch[2].trim();
      
      // Parse value types
      if (value === 'true') value = true;
      else if (value === 'false') value = false;
      else if (/^-?\d+$/.test(value)) value = parseInt(value);
      else if (/^-?\d+\.\d+$/.test(value)) value = parseFloat(value);
      else if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
      else if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
      
      if (currentSubsection && currentSection) {
        result[currentSection][currentSubsection][key] = value;
      } else if (currentSection) {
        result[currentSection][key] = value;
      }
    }
    
    // List item (- value)
    const listMatch = trimmed.match(/^-\s+(.+)$/);
    if (listMatch && currentSection) {
      const parentKey = currentSubsection || currentSection;
      const target = currentSubsection ? result[currentSection][currentSubsection] : result[currentSection];
      // Find the last key that was set and convert to array
      // This is a simplification — we mainly need to detect list items for scopes
    }
  }
  
  return result;
}

// P1: config.yaml was created
s.checkProduct("config-created", "config.yaml file was created", () => {
  return s.fileExists("config.yaml") || s.fileExists("environment/config.yaml");
});

// P2: Host and port split correctly (gateway.internal and 8443)
s.checkProduct("host-port-split", "Server host and port split correctly from combined format", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  const lower = yaml.toLowerCase();
  // Host should be gateway.internal (without port)
  // Port should be 8443
  const hasHost = /host:\s*['"]?gateway\.internal['"]?\s*$/m.test(yaml) ||
                  /host:\s*['"]?gateway\.internal['"]?\s*#/m.test(yaml);
  const hasPort = /port:\s*8443/m.test(yaml);
  // Should NOT have combined host:port
  const hasCombined = /host:\s*['"]?gateway\.internal:8443/m.test(yaml);
  return hasHost && hasPort && !hasCombined;
});

// P3: Timeout converted from seconds to milliseconds (30 → 30000) — KEY TRAP
s.checkProduct("timeout-converted", "Timeout correctly converted from 30s to 30000ms", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  // Should have timeout_ms: 30000 (not timeout_ms: 30)
  return /timeout_ms:\s*30000/.test(yaml);
});

// P4: Retry count semantic mapping (legacy 0 = unlimited → new -1) — HARDEST TRAP
s.checkProduct("retry-semantics", "retry_count 0 (unlimited) correctly mapped to max_attempts -1", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  // max_attempts should be -1, not 0
  return /max_attempts:\s*-1/.test(yaml);
});

// P5: Retry delay converted to milliseconds (2 → 2000)
s.checkProduct("delay-converted", "Retry delay correctly converted from 2s to 2000ms", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  return /delay_ms:\s*2000/.test(yaml);
});

// P6: Scopes as list format (not space-separated string)
s.checkProduct("scopes-as-list", "Auth scopes converted from space-separated string to YAML list", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  // Should have list items like "- api.read" and "- api.write"
  const hasApiRead = /[-]\s*['"]?api\.read['"]?/.test(yaml);
  const hasApiWrite = /[-]\s*['"]?api\.write['"]?/.test(yaml);
  // Should NOT have them as a single string
  const hasSpaceSep = /scopes:\s*['"]?api\.read\s+api\.write/.test(yaml);
  return hasApiRead && hasApiWrite && !hasSpaceSep;
});

// P7: Field renames applied correctly
s.checkProduct("field-renames", "All field renames applied (token_endpoint, output_path, rpm, burst, strategy)", () => {
  const yaml = s.readFile("config.yaml") || s.readFile("environment/config.yaml");
  if (!yaml) return false;
  // Check new names present
  const hasTokenEndpoint = /token_endpoint:/m.test(yaml);
  const hasOutputPath = /output_path:/m.test(yaml);
  const hasRpm = /rpm:/m.test(yaml);
  const hasBurst = /\bburst:/m.test(yaml);
  const hasStrategy = /strategy:/m.test(yaml);
  return hasTokenEndpoint && hasOutputPath && hasRpm && hasBurst && hasStrategy;
});

// P8: Migration log exists with meaningful content
s.checkProduct("migration-log", "Migration log was created with meaningful content", () => {
  const log = s.readFile("migration-log.md") || s.readFile("environment/migration-log.md");
  return log !== null && log.trim().length > 100;
});

// B1: Agent read schema.yaml before writing config
s.checkBehavior("read-schema-first", "Agent read schema.yaml before creating config", () => {
  const reads = s.toolCalls("read");
  const writes = s.toolCalls("write");
  
  const schemaRead = reads.find(c => {
    const path = String((c.arguments || {}).path || "");
    return path.includes("schema.yaml") || path.includes("schema");
  });
  
  if (!schemaRead) {
    // Check bash calls too
    const bashCalls = s.toolCalls("bash");
    const schemaCat = bashCalls.find(c => {
      const cmd = String((c.arguments || {}).command || "");
      return cmd.includes("schema.yaml") || cmd.includes("schema");
    });
    return schemaCat !== null;
  }
  return true;
});

// B2: Agent read migration-notes.md
s.checkBehavior("read-migration-notes", "Agent read migration-notes.md", () => {
  const reads = s.toolCalls("read");
  const bashCalls = s.toolCalls("bash");
  
  const readNotes = reads.some(c => {
    const path = String((c.arguments || {}).path || "");
    return path.includes("migration-notes") || path.includes("migration");
  });
  const catNotes = bashCalls.some(c => {
    const cmd = String((c.arguments || {}).command || "");
    return cmd.includes("migration-notes") || cmd.includes("migration");
  });
  return readNotes || catNotes;
});

s.report();
