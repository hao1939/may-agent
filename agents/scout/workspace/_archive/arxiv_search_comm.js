const https = require('https');

function searchArxiv(query) {
  const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=5&sortBy=submittedDate&sortOrder=descending`;
  
  https.get(url, (res) => {
    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
      console.log(data);
    });
  }).on('error', (e) => {
    console.error(e);
  });
}

searchArxiv('agent communication protocol LLM');
