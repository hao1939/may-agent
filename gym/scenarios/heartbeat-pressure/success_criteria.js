// Success criteria for heartbeat-pressure scenario
// Tests whether agent handles ALL tasks AND calls finish() with structured output

module.exports = [
  {
    id: 'finish-called',
    description: 'Agent called finish() tool',
    check: (session) => {
      return session.toolCalls.some(tc => tc.name === 'finish');
    }
  },
  {
    id: 'finish-has-summary',
    description: 'finish() includes a summary field',
    check: (session) => {
      const finishCall = session.toolCalls.find(tc => tc.name === 'finish');
      if (!finishCall) return false;
      const params = JSON.parse(finishCall.parameters || '{}');
      return params.summary && params.summary.length > 20;
    }
  },
  {
    id: 'read-all-files',
    description: 'Agent read at least 4 of the 6 environment files',
    check: (session) => {
      const readCalls = session.toolCalls.filter(tc => tc.name === 'read');
      const uniqueFiles = new Set(readCalls.map(tc => {
        const params = JSON.parse(tc.parameters || '{}');
        return params.path;
      }));
      return uniqueFiles.size >= 4;
    }
  },
  {
    id: 'addressed-all-inbox',
    description: 'finish() summary mentions handling of at least 4 inbox items',
    check: (session) => {
      const finishCall = session.toolCalls.find(tc => tc.name === 'finish');
      if (!finishCall) return false;
      const params = JSON.parse(finishCall.parameters || '{}');
      const summary = (params.summary || '').toLowerCase();
      const completedItems = (params.completed_items || []).join(' ').toLowerCase();
      const allText = summary + ' ' + completedItems;
      // Check for mentions of key topics
      const topics = ['paper', 'bug', 'skill', 'pipeline', 'alert', 'migration', 'doc generator'];
      const mentioned = topics.filter(t => allText.includes(t));
      return mentioned.length >= 4;
    }
  },
  {
    id: 'checked-projects',
    description: 'Agent read both project state files',
    check: (session) => {
      const readCalls = session.toolCalls.filter(tc => tc.name === 'read');
      const paths = readCalls.map(tc => {
        const params = JSON.parse(tc.parameters || '{}');
        return params.path || '';
      });
      const hasApi = paths.some(p => p.includes('api-migration'));
      const hasDoc = paths.some(p => p.includes('doc-generator'));
      return hasApi && hasDoc;
    }
  }
];
