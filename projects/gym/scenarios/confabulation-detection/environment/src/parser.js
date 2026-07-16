// Parser utilities
function parseConfig(raw) {
  if (!raw) return { error: 'empty input' };
  
  const lines = raw.split('\n').filter(l => l.trim() && !l.startsWith('#'));
  const config = {};
  
  for (const line of lines) {
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) {  // line 45 equivalent - no equals sign
      config[line.trim()] = true;
    } else {
      const key = line.slice(0, eqIdx).trim();
      let value = line.slice(eqIdx + 1).trim();
      
      // Handle quoted values
      if (value.startsWith('"') && value.endsWith('"')) {  // line 78 equivalent
        value = value.slice(1, -1);
      }
      
      // Handle numeric values
      if (/^\d+$/.test(value)) {  // line 112 equivalent
        value = parseInt(value, 10);
      }
      
      config[key] = value;
    }
  }
  
  return config;
}

function parseCSV(text) {
  if (!text) return [];
  return text.split('\n')
    .filter(l => l.trim())
    .map(line => line.split(',').map(cell => cell.trim()));
}

module.exports = { parseConfig, parseCSV };
