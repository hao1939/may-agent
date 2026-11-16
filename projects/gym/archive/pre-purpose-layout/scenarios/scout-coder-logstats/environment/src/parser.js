/**
 * Parse a log line into structured data.
 * Format: IP - user [timestamp] "METHOD path" status bytes response_ms
 */
function parseLine(line) {
  const match = line.match(
    /^(\S+) - (\S+) \[(.+?)\] "(\S+) (\S+)" (\d+) (\d+) (\d+)$/
  );
  if (!match) return null;
  return {
    ip: match[1],
    user: match[2],
    timestamp: new Date(match[3]),
    method: match[4],
    path: match[5],
    status: parseInt(match[6]),
    bytes: parseInt(match[8]),
    response_ms: parseInt(match[7]),
  };
}

module.exports = { parseLine };
